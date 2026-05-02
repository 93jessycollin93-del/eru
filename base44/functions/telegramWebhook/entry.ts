import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const TELEGRAM_API = 'https://api.telegram.org';

const sendTelegramMessage = async (token, chatId, text) => {
  return await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
};

// --- Knowledge base retrieval (inline, no auth needed — service role) -------
// Lightweight lexical match over docs linked to this bot. Mirrors the scoring
// in retrieveKnowledgeBaseContext.js but skips the per-doc usage_count writes
// to keep the webhook fast.
const tokenize = (text) => Array.from(new Set(String(text || '')
  .toLowerCase()
  .replace(/[^a-z0-9+#.\s/-]/g, ' ')
  .split(/\s+/)
  .filter((w) => w.length > 2)));

const buildSearchText = (doc) => {
  const faqText = (doc.faq_items || []).map((i) => `${i.question} ${i.answer}`).join(' ');
  return [doc.title, doc.content, doc.file_name, faqText, ...(doc.keywords || [])]
    .filter(Boolean).join(' ').toLowerCase().slice(0, 12000);
};

const buildSnippet = (doc, queryTokens) => {
  if (doc.source_type === 'faq') {
    const best = (doc.faq_items || []).find((i) =>
      queryTokens.some((t) => `${i.question} ${i.answer}`.toLowerCase().includes(t)));
    if (best) return `Q: ${best.question}\nA: ${best.answer}`;
  }
  const text = doc.content || doc.file_name || '';
  if (!text) return doc.title || '';
  const lower = text.toLowerCase();
  const hit = queryTokens.find((t) => lower.includes(t));
  if (!hit) return text.slice(0, 400);
  const idx = lower.indexOf(hit);
  return text.slice(Math.max(0, idx - 160), Math.min(text.length, idx + 280)).trim();
};

const retrieveKbContext = async (base44, botId, query) => {
  try {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return '';

    // Pull docs linked to this bot (or unrestricted ones owned by anyone — the
    // webhook runs server-side so RLS doesn't filter by owner here).
    const docs = await base44.asServiceRole.entities.KnowledgeBaseDocument.list('-updated_date', 200);
    const linked = (docs || []).filter((d) => {
      if (d.status && d.status !== 'active') return false;
      const ids = d.linked_bot_ids || [];
      return ids.includes(botId);
    });
    if (linked.length === 0) return '';

    const ranked = linked.map((d) => {
      const searchText = buildSearchText(d);
      let score = 0;
      for (const tok of queryTokens) {
        if ((d.title || '').toLowerCase().includes(tok)) score += 8;
        if (searchText.includes(tok)) score += 4;
      }
      return { doc: d, score, snippet: buildSnippet(d, queryTokens) };
    }).filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    if (ranked.length === 0) return '';
    return ranked.map((r, i) => `Source ${i + 1} — ${r.doc.title}:\n${r.snippet}`).join('\n\n');
  } catch {
    return '';
  }
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const url = new URL(req.url);
    const botId = url.searchParams.get('botId') || url.searchParams.get('bot_id');

    const incomingMessage = payload.message || payload.edited_message;
    if (!incomingMessage?.chat?.id) {
      return Response.json({ success: true, ignored: true });
    }

    if (!botId) {
      return Response.json({ success: false, error: 'Missing botId' }, { status: 400 });
    }

    const bot = await base44.asServiceRole.entities.TelegramBot.get(botId);
    if (!bot) {
      return Response.json({ success: false, error: 'No Telegram bot configured' }, { status: 404 });
    }

    // Verify the per-bot secret_token Telegram passes back on every webhook.
    // Telegram sends it in the X-Telegram-Bot-Api-Secret-Token header; we
    // compare against webhook_secret_token stored on the bot when activate
    // ran. Bots that haven't been re-activated yet (no stored token) are
    // accepted with a one-time bypass to avoid breaking existing deployments;
    // the activate flow now always sets one going forward.
    const expectedSecret = bot.webhook_secret_token;
    if (expectedSecret) {
      const provided = req.headers.get('x-telegram-bot-api-secret-token') || '';
      if (provided !== expectedSecret) {
        return Response.json({ success: false, error: 'Invalid webhook signature' }, { status: 401 });
      }
    }

    const token = bot.bot_token || Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!token) {
      return Response.json({ success: false, error: 'Missing bot token' }, { status: 400 });
    }

    const chatId = String(incomingMessage.chat.id);
    const telegramUserId = String(incomingMessage.from?.id || '');
    const text = incomingMessage.text || '';
    const normalizedText = text.toLowerCase();
    const isCommand = text.startsWith('/');
    const startedAt = Date.now();

    let sessions = await base44.asServiceRole.entities.TelegramBotSession.filter({
      bot_id: bot.id,
      telegram_chat_id: chatId
    }, '-updated_date', 1);

    let session = sessions?.[0];
    if (!session) {
      session = await base44.asServiceRole.entities.TelegramBotSession.create({
        bot_id: bot.id,
        telegram_chat_id: chatId,
        telegram_user_id: telegramUserId,
        telegram_username: incomingMessage.from?.username || '',
        last_user_message: text,
        memory_summary: '',
        message_count: 0,
        last_message_at: new Date().toISOString()
      });
    }

    await base44.asServiceRole.entities.TelegramBotMessage.create({
      bot_id: bot.id,
      session_id: session.id,
      telegram_chat_id: chatId,
      telegram_message_id: String(incomingMessage.message_id || ''),
      direction: 'incoming',
      message_type: isCommand ? 'command' : 'text',
      content: text,
      status: 'processed'
    });

    const handoffKeywords = (bot.human_handoff_keywords || []).map((item) => String(item).toLowerCase());
    const keywordTriggered = !!bot.human_handoff_enabled && handoffKeywords.some((keyword) => keyword && normalizedText.includes(keyword));
    const handoffAlreadyActive = session.human_handoff_status === 'requested' || session.human_handoff_status === 'active';

    if (bot.human_handoff_enabled && (keywordTriggered || handoffAlreadyActive) && bot.human_handoff_pause_ai !== false) {
      const handoffReason = keywordTriggered ? `Keyword trigger from user: ${text}` : (session.human_handoff_reason || 'Human handoff already active');
      const handoffReply = 'A human support teammate has been notified and will take over shortly.';

      await base44.asServiceRole.entities.TelegramBotSession.update(session.id, {
        telegram_user_id: telegramUserId,
        telegram_username: incomingMessage.from?.username || session.telegram_username || '',
        last_user_message: text,
        last_bot_response: handoffReply,
        human_handoff_requested: true,
        human_handoff_status: 'active',
        human_handoff_reason: handoffReason,
        human_handoff_requested_at: session.human_handoff_requested_at || new Date().toISOString(),
        last_message_at: new Date().toISOString()
      });

      await base44.asServiceRole.entities.AppNotification.create({
        user_email: bot.created_by,
        type: 'task_assigned',
        title: `Human handoff requested for ${bot.name}`,
        message: `${incomingMessage.from?.username || chatId} needs live support: ${text}`,
        metadata: {
          bot_id: bot.id,
          session_id: session.id,
          telegram_chat_id: chatId,
          handoff: true,
          handoff_reason: handoffReason
        }
      });

      await sendTelegramMessage(token, chatId, handoffReply);

      await base44.asServiceRole.entities.TelegramBotMessage.create({
        bot_id: bot.id,
        session_id: session.id,
        telegram_chat_id: chatId,
        telegram_message_id: '',
        direction: 'outgoing',
        message_type: 'system',
        content: handoffReply,
        status: 'sent'
      });

      if (bot.human_handoff_admin_chat_id) {
        await sendTelegramMessage(token, bot.human_handoff_admin_chat_id, `Human handoff needed for ${bot.name}\nUser: ${incomingMessage.from?.username || chatId}\nMessage: ${text}`);
      }

      return Response.json({ success: true, handoff: true, paused: true });
    }

    let replyText = bot.greeting_message || 'Hello.';

    if (text === '/start') {
      replyText = bot.greeting_message || 'Welcome. Your AI bot is ready.';
    } else if (text === '/help') {
      replyText = 'Available commands: /start, /help, /reset';
    } else if (text === '/reset') {
      await base44.asServiceRole.entities.TelegramBotSession.update(session.id, {
        memory_summary: '',
        last_user_message: '',
        last_bot_response: 'Conversation memory reset',
        message_count: 0,
        last_message_at: new Date().toISOString()
      });
      replyText = 'Conversation memory reset.';
    } else {
      // Pull knowledge-base snippets linked to this bot, if any. The agent
      // will ground its answer in this context and admit when it doesn't know.
      const kbContext = await retrieveKbContext(base44, bot.id, text);
      const isSupportAgent = bot.front_door_role === 'support';

      const groundingInstruction = kbContext
        ? `Answer the user's question using ONLY the knowledge base sources below. If the sources don't contain the answer, say so honestly and suggest contacting human support — do NOT invent facts.\n\nKnowledge base:\n${kbContext}`
        : (isSupportAgent
            ? 'You are a customer support agent. If you do not know the answer from your instructions, say so honestly and offer to escalate to a human teammate.'
            : '');

      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt: [
          'You are a Telegram AI agent.',
          `System prompt:\n${bot.system_prompt}`,
          groundingInstruction,
          `Conversation memory:\n${session.memory_summary || 'No prior memory.'}`,
          `User message:\n${text}`,
          'Write a concise Telegram-ready reply in plain text.'
        ].filter(Boolean).join('\n\n'),
        model: 'automatic'
      });
      replyText = typeof aiResponse === 'string' ? aiResponse : String(aiResponse);
    }

    const telegramResponse = await sendTelegramMessage(token, chatId, replyText);
    const telegramResult = await telegramResponse.json();
    const latencyMs = Date.now() - startedAt;

    await base44.asServiceRole.entities.TelegramBotMessage.create({
      bot_id: bot.id,
      session_id: session.id,
      telegram_chat_id: chatId,
      telegram_message_id: String(telegramResult.result?.message_id || ''),
      direction: 'outgoing',
      message_type: isCommand ? 'command' : 'text',
      content: replyText,
      status: telegramResult.ok ? 'sent' : 'failed',
      error_message: telegramResult.ok ? '' : (telegramResult.description || 'Telegram send failed'),
      latency_ms: latencyMs
    });

    await base44.asServiceRole.entities.TelegramBotSession.update(session.id, {
      telegram_user_id: telegramUserId,
      telegram_username: incomingMessage.from?.username || session.telegram_username || '',
      last_user_message: text,
      last_bot_response: replyText,
      memory_summary: `Latest user intent: ${text}. Latest assistant reply: ${replyText}`,
      message_count: Number(session.message_count || 0) + 1,
      last_message_at: new Date().toISOString(),
      human_handoff_status: session.human_handoff_status === 'resolved' ? 'resolved' : 'none',
      human_handoff_requested: false
    });

    await base44.asServiceRole.entities.TelegramBot.update(bot.id, {
      last_webhook_at: new Date().toISOString(),
      status: 'active',
      last_error: ''
    });

    await base44.asServiceRole.entities.TelegramBotLog.create({
      bot_id: bot.id,
      level: telegramResult.ok ? 'info' : 'error',
      event_type: isCommand ? 'command' : 'ai_response',
      message: telegramResult.ok ? 'Message processed successfully' : 'Telegram response failed',
      metadata: {
        chat_id: chatId,
        input: text,
        output: replyText,
        latency_ms: latencyMs,
        telegram_ok: !!telegramResult.ok
      }
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});