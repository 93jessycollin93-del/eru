import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const TELEGRAM_API = 'https://api.telegram.org';

async function telegramCall(token, method, body = {}) {
  const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.description || `Telegram ${method} failed`);
  }
  return data.result;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { botId, botToken, action } = await req.json();
    if (!botId || !action) {
      return Response.json({ error: 'botId and action are required' }, { status: 400 });
    }

    const bot = await base44.entities.TelegramBot.get(botId);
    if (!bot) {
      return Response.json({ error: 'Bot not found' }, { status: 404 });
    }

    if (bot.created_by !== user.email && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const token = botToken || bot.bot_token || Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!token) {
      return Response.json({ error: 'Telegram bot token is required' }, { status: 400 });
    }

    const requestUrl = new URL(req.url);
    const appBaseUrl = (Deno.env.get('BASE44_APP_BASE_URL') || Deno.env.get('APP_BASE_URL') || `${requestUrl.protocol}//${requestUrl.host}`).replace(/\/$/, '');
    const webhookUrl = `${appBaseUrl}/functions/telegramWebhook?botId=${encodeURIComponent(botId)}`;

    if (action === 'verify') {
      const me = await telegramCall(token, 'getMe');
      await base44.asServiceRole.entities.TelegramBot.update(botId, {
        bot_token: token,
        bot_username: me.username || bot.bot_username,
        name: bot.name || me.first_name || me.username,
        token_label: botToken ? 'custom' : 'TELEGRAM_BOT_TOKEN',
        last_error: ''
      });
      return Response.json({ success: true, bot_username: me.username, webhook_url: webhookUrl });
    }

    if (action === 'activate') {
      const me = await telegramCall(token, 'getMe');
      await telegramCall(token, 'setWebhook', { url: webhookUrl, allowed_updates: ['message'] });
      await base44.asServiceRole.entities.TelegramBot.update(botId, {
        bot_token: token,
        bot_username: me.username || bot.bot_username,
        webhook_url: webhookUrl,
        status: 'active',
        token_label: botToken ? 'custom' : 'TELEGRAM_BOT_TOKEN',
        last_error: ''
      });
      await base44.asServiceRole.entities.TelegramBotLog.create({
        bot_id: botId,
        level: 'info',
        event_type: 'system',
        message: 'Bot activated and webhook connected',
        metadata: { webhook_url: webhookUrl, bot_username: me.username }
      });
      return Response.json({ success: true, bot_username: me.username, webhook_url: webhookUrl, status: 'active' });
    }

    if (action === 'offline') {
      await telegramCall(token, 'deleteWebhook', { drop_pending_updates: false });
      await base44.asServiceRole.entities.TelegramBot.update(botId, {
        bot_token: token,
        status: 'offline',
        last_error: ''
      });
      await base44.asServiceRole.entities.TelegramBotLog.create({
        bot_id: botId,
        level: 'info',
        event_type: 'system',
        message: 'Bot set to offline and webhook removed',
        metadata: {}
      });
      return Response.json({ success: true, status: 'offline' });
    }

    return Response.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || 'Telegram webhook action failed' }, { status: 500 });
  }
});