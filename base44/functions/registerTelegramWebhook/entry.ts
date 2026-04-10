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

    const response = await fetch(`${TELEGRAM_API}/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl })
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