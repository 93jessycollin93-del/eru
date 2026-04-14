/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));
    const automationId = payload.automationId;
    const webhookKey = payload.webhookKey;
    const eventType = payload.eventType || 'custom';
    const title = payload.title || 'Inbound bot webhook';
    const message = payload.message || 'An inbound webhook event was received.';

    if (!automationId || !webhookKey) {
      return Response.json({ error: 'automationId and webhookKey are required' }, { status: 400 });
    }

    const matches = await base44.asServiceRole.entities.BotAutomation.filter({ id: automationId }, '-created_date', 1);
    const automation = matches?.[0];

    if (!automation || automation.inbound_webhook_key !== webhookKey) {
      return Response.json({ error: 'Invalid webhook configuration' }, { status: 403 });
    }

    const response = await base44.asServiceRole.functions.invoke('dispatchBotAutomationAlert', {
      automationId,
      eventType,
      title,
      message,
      data: payload.data || {}
    });

    return Response.json({ success: true, dispatched: response.data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});