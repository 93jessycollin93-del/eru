import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const TELEGRAM_API = 'https://api.telegram.org';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { botId } = await req.json();
    if (!botId) {
      return Response.json({ error: 'botId is required' }, { status: 400 });
    }

    const bot = await base44.entities.TelegramBot.get(botId);
    if (!bot) {
      return Response.json({ error: 'Bot not found' }, { status: 404 });
    }

    if (bot.created_by !== user.email && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const appBaseUrl = Deno.env.get('BASE44_APP_BASE_URL') || Deno.env.get('APP_BASE_URL') || '';
    const webhookUrl = `${appBaseUrl}/functions/telegramWebhook`;

    // Per-bot secret_token Telegram echoes back as a header on every call —
    // the webhook handler rejects mismatches. Stored on the bot entity.
    const secretBytes = new Uint8Array(32);
    crypto.getRandomValues(secretBytes);
    const webhookSecret = Array.from(secretBytes).map((b) => b.toString(16).padStart(2, '0')).join('');

    const response = await fetch(`${TELEGRAM_API}/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, secret_token: webhookSecret })
    });

    const result = await response.json();

    if (!result.ok) {
      await base44.asServiceRole.entities.TelegramBot.update(botId, {
        status: 'error',
        last_error: result.description || 'Webhook registration failed'
      });
      return Response.json({ error: result.description || 'Webhook registration failed' }, { status: 400 });
    }

    await base44.asServiceRole.entities.TelegramBot.update(botId, {
      status: 'active',
      webhook_url: webhookUrl,
      webhook_secret_token: webhookSecret,
      token_label: 'TELEGRAM_BOT_TOKEN',
      last_error: ''
    });

    await base44.asServiceRole.entities.TelegramBotLog.create({
      bot_id: botId,
      level: 'info',
      event_type: 'system',
      message: 'Webhook registered successfully',
      metadata: { webhook_url: webhookUrl }
    });

    return Response.json({ success: true, webhookUrl, telegram: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});