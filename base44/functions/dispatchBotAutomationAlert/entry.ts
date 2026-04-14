/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TELEGRAM_API = 'https://api.telegram.org';

const sendTelegramMessage = async (token, chatId, text) => {
  const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
  return await response.json();
};

const postWebhook = async (url, payload) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return { ok: response.ok, status: response.status };
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const payload = await req.json().catch(() => ({}));
    const automationId = payload.automationId;
    const eventType = payload.eventType || 'custom';
    const title = payload.title || 'Bot alert';
    const message = payload.message || '';
    const data = payload.data || {};

    if (!automationId) {
      return Response.json({ error: 'automationId is required' }, { status: 400 });
    }

    const automations = user
      ? await base44.entities.BotAutomation.filter({ id: automationId }, '-created_date', 1)
      : await base44.asServiceRole.entities.BotAutomation.filter({ id: automationId }, '-created_date', 1);
    const automation = automations?.[0];

    if (!automation) {
      return Response.json({ error: 'Automation not found' }, { status: 404 });
    }

    const enabledEvents = automation.alert_events || [];
    if (enabledEvents.length > 0 && !enabledEvents.includes(eventType)) {
      return Response.json({ success: true, skipped: true, reason: 'Event type not enabled' });
    }

    const alertText = `${title}\n\n${message}`.trim();
    const webhookUrls = [...new Set([...(automation.webhook_urls || []), ...(automation.slack_webhook_url ? [automation.slack_webhook_url] : [])].filter(Boolean))];
    const telegramChatIds = [...new Set((automation.telegram_chat_ids || []).filter(Boolean))];
    const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN');

    const webhookResults = await Promise.all(webhookUrls.map((url) => postWebhook(url, {
      automation_id: automation.id,
      automation_name: automation.name,
      bot_id: automation.bot_id,
      bot_name: automation.bot_name,
      event_type: eventType,
      title,
      message,
      data,
      sent_at: new Date().toISOString()
    }).catch((error) => ({ ok: false, error: error.message }))));

    const telegramResults = telegramToken
      ? await Promise.all(telegramChatIds.map((chatId) => sendTelegramMessage(telegramToken, chatId, alertText).catch((error) => ({ ok: false, error: error.message }))))
      : [];

    await base44.asServiceRole.entities.AlertNotification.create({
      user_email: automation.user_email || automation.created_by,
      alert_type: 'manual',
      title,
      message,
      data: {
        automation_id: automation.id,
        automation_name: automation.name,
        event_type: eventType,
        delivery_summary: {
          webhooks: webhookResults.length,
          telegram: telegramResults.length
        },
        ...data
      },
      sent_via: webhookUrls.length > 0 && telegramChatIds.length > 0 ? 'push' : webhookUrls.length > 0 ? 'in_app' : 'push',
      severity: 'info'
    });

    return Response.json({
      success: true,
      webhook_results: webhookResults,
      telegram_results: telegramResults
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});