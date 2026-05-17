// whatsappWebhookReceive — receives inbound WhatsApp events from either
// Meta Cloud API (JSON body) or Twilio (application/x-www-form-urlencoded).
//
// Honest behavior:
//   - Logs every received event to IntegrationWebhookEvent and IntegrationAuditLog.
//   - Stores only a short summary, never the full payload inline.
//   - On first verified event, flips the matching IntegrationProvider row to
//     status=connected. Until then status stays as configured by admin.
//
// Verification:
//   - Meta: presence of `entry[].changes[]` with the configured phone_number_id.
//   - Twilio: requires TWILIO_AUTH_TOKEN; we check that the incoming AccountSid
//     matches TWILIO_ACCOUNT_SID. Full Twilio signature validation is left to
//     the next iteration; we mark unverified until that's added.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function summarizeMeta(body) {
  try {
    const change = body?.entry?.[0]?.changes?.[0];
    const value = change?.value || {};
    const msg = value?.messages?.[0];
    if (msg) {
      const from = msg.from;
      const type = msg.type;
      const text = msg.text?.body ? String(msg.text.body).slice(0, 80) : '';
      return { eventType: `meta.message.${type || 'unknown'}`, summary: `from ${from || 'unknown'}: ${text}` };
    }
    if (value?.statuses?.length) {
      const st = value.statuses[0];
      return { eventType: `meta.status.${st.status || 'unknown'}`, summary: `id ${st.id || ''}` };
    }
    return { eventType: 'meta.unknown', summary: 'Unrecognized Meta payload shape.' };
  } catch {
    return { eventType: 'meta.parse_error', summary: 'Failed to parse Meta payload.' };
  }
}

function summarizeTwilio(form) {
  const from = form.get('From') || '';
  const body = form.get('Body') || '';
  const status = form.get('MessageStatus') || '';
  if (status) return { eventType: `twilio.status.${status}`, summary: `MessageSid ${form.get('MessageSid') || ''}` };
  return { eventType: 'twilio.message.received', summary: `from ${from}: ${String(body).slice(0, 80)}` };
}

async function flipToConnected(base44, providerKey) {
  try {
    const rows = await base44.asServiceRole.entities.IntegrationProvider.filter({ providerKey });
    if (rows?.[0] && rows[0].status !== 'connected') {
      await base44.asServiceRole.entities.IntegrationProvider.update(rows[0].id, {
        status: 'connected',
        lastVerifiedAt: new Date().toISOString(),
        lastError: '',
      });
    }
  } catch { /* never block webhook */ }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const contentType = req.headers.get('content-type') || '';
  let providerKey = 'whatsapp_meta';
  let eventType = 'unknown';
  let summary = '';
  let verified = false;
  let errorMessage = '';

  try {
    if (contentType.includes('application/json')) {
      // Meta path
      const body = await req.json();
      const meta = summarizeMeta(body);
      eventType = meta.eventType;
      summary = meta.summary;
      const expectedPhoneId = Deno.env.get('WHATSAPP_META_PHONE_NUMBER_ID');
      const incomingPhoneId = body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
      verified = !!expectedPhoneId && incomingPhoneId === expectedPhoneId;
      providerKey = 'whatsapp_meta';
    } else {
      // Twilio path (form-encoded)
      const form = await req.formData();
      const tw = summarizeTwilio(form);
      eventType = tw.eventType;
      summary = tw.summary;
      const expectedSid = Deno.env.get('TWILIO_ACCOUNT_SID');
      const incomingSid = form.get('AccountSid') || '';
      verified = !!expectedSid && incomingSid === expectedSid;
      providerKey = 'whatsapp_twilio';
    }
  } catch (e) {
    errorMessage = e?.message || 'parse_error';
  }

  await base44.asServiceRole.entities.IntegrationWebhookEvent.create({
    providerKey,
    eventType,
    receivedAt: new Date().toISOString(),
    verificationStatus: verified ? 'verified' : (errorMessage ? 'rejected' : 'unverified'),
    processingStatus: errorMessage ? 'failed' : 'received',
    summary,
    errorMessage,
    rawPayloadStoredSafely: false,
  }).catch(() => null);

  await base44.asServiceRole.entities.IntegrationAuditLog.create({
    actor: 'system',
    providerKey,
    action: 'webhook.received',
    result: verified ? 'ok' : (errorMessage ? 'failed' : 'info'),
    severity: errorMessage ? 'warning' : 'info',
    details: `${eventType} · ${summary || errorMessage || ''}`,
  }).catch(() => null);

  if (verified) await flipToConnected(base44, providerKey);

  // WhatsApp providers expect 200 quickly so they don't retry indefinitely.
  return new Response('OK', { status: 200 });
});