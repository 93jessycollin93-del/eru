// whatsappWebhookVerify — Meta Cloud API webhook verification handshake.
//
// Meta calls GET ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
// We only echo the challenge if the verify token matches the server-side
// secret WHATSAPP_META_VERIFY_TOKEN. Returns 403 otherwise.
//
// No client-side secrets are accepted. No fake success states.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
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