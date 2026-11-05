// whatsappWebhookVerify — Meta Cloud API webhook verification handshake.
//
// Meta calls GET ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
// We only echo the challenge if the verify token matches the server-side
// secret WHATSAPP_META_VERIFY_TOKEN. Returns 403 otherwise.
//
// No client-side secrets are accepted. No fake success states.

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
  const offlineBlock = offlineResponse('whatsapp');
  if (offlineBlock) return offlineBlock;

  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    const expected = Deno.env.get('WHATSAPP_META_VERIFY_TOKEN');
    if (!expected) {
      return Response.json({ error: 'Server not configured: WHATSAPP_META_VERIFY_TOKEN missing.' }, { status: 503 });
    }

    const base44 = createClientFromRequest(req);
    const verified = mode === 'subscribe' && token === expected;

    await base44.asServiceRole.entities.IntegrationAuditLog.create({
      actor: 'system',
      providerKey: 'whatsapp_meta',
      action: 'webhook.verify',
      result: verified ? 'ok' : 'blocked',
      severity: verified ? 'info' : 'warning',
      details: verified ? 'Meta webhook verification succeeded.' : 'Meta webhook verification rejected.',
    }).catch(() => null);

    if (!verified) {
      return new Response('Forbidden', { status: 403 });
    }
    return new Response(challenge ?? '', { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});