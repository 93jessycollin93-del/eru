import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const TELEGRAM_API = 'https://api.telegram.org';

const sendTelegramMessage = async (token, chatId, text) => {
  return await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
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
      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a Telegram AI agent.\n\nSystem prompt:\n${bot.system_prompt}\n\nConversation memory:\n${session.memory_summary || 'No prior memory.'}\n\nUser message:\n${text}\n\nWrite a concise Telegram-ready reply in plain text.`,
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