/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Offline by default: this function reaches outside services, so it only runs
// when the owner turns its group on in the ONLINE_FEATURES secret
// (comma-separated, e.g. "cloud_ai,email", or "all"). Empty or unset = offline.
function isOnline(group: string): boolean {
  const on = (Deno.env.get('ONLINE_FEATURES') || '').split(',').map((g) => g.trim().toLowerCase());
  return on.includes('all') || on.includes(group);
}
function offlineResponse(...groups: string[]): Response | null {
  const off = groups.find((g) => !isOnline(g));
  if (!off) return null;
  return Response.json(
    { ok: false, error: 'offline_mode', group: off, message: `Offline mode: "${off}" is turned off. The owner can add it to the ONLINE_FEATURES secret.` },
    { status: 403 },
  );
}

Deno.serve(async (req) => {
  const offlineBlock = offlineResponse('telegram');
  if (offlineBlock) return offlineBlock;

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