// whatsappWebhookReceive — receives inbound WhatsApp events from either
// Meta Cloud API (JSON body) or Twilio (application/x-www-form-urlencoded).
//
// Honest behavior:
//   - Logs every received event to IntegrationWebhookEvent and IntegrationAuditLog.
//   - Stores only a short summary, never the full payload inline.
//   - On first verified event, flips the matching IntegrationProvider row to
//     status=connected. Until then status stays as configured by admin.
//
// Verification (cryptographic when the relevant secret is configured):
//   - Meta: HMAC-SHA256 of the raw body validated against X-Hub-Signature-256
//     using WHATSAPP_META_APP_SECRET. Falls back to a phone_number_id match
//     (not treated as verified) when the secret is absent.
//   - Twilio: HMAC-SHA1 of (URL + sorted params) validated against
//     X-Twilio-Signature using TWILIO_AUTH_TOKEN. Falls back to an AccountSid
//     match when the auth token is absent.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Constant-time string comparison to avoid leaking signature bytes via timing.
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function toHex(buf) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(algo, secret, data) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: algo }, false, ['sign']
  );
  return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
}

// Meta Cloud API signs the raw request body with the app secret (SHA-256) and
// sends it as `X-Hub-Signature-256: sha256=<hex>`.
async function verifyMetaSignature(rawBody, header, appSecret) {
  if (!appSecret || !header) return false;
  const expected = header.startsWith('sha256=') ? header.slice(7) : header;
  const computed = toHex(await hmac('SHA-256', appSecret, rawBody));
  return timingSafeEqual(computed, expected);
}

// Twilio signs (full URL + each POST param name/value, sorted by name) with the
// auth token (SHA-1, base64) and sends it as `X-Twilio-Signature`.
async function verifyTwilioSignature(url, params, header, authToken) {
  if (!authToken || !header) return false;
  let data = url;
  for (const k of Object.keys(params).sort()) data += k + params[k];
  const sig = await hmac('SHA-1', authToken, data);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return timingSafeEqual(b64, header);
}

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
      // Meta path — read the raw body so we can verify the HMAC signature,
      // then parse it.
      const rawBody = await req.text();
      const body = JSON.parse(rawBody || '{}');
      const meta = summarizeMeta(body);
      eventType = meta.eventType;
      summary = meta.summary;
      providerKey = 'whatsapp_meta';

      const appSecret = Deno.env.get('WHATSAPP_META_APP_SECRET');
      if (appSecret) {
        // Authoritative check: cryptographic signature over the raw body.
        verified = await verifyMetaSignature(rawBody, req.headers.get('x-hub-signature-256') || '', appSecret);
        if (!verified) errorMessage = 'invalid_signature';
      } else {
        // No app secret configured: fall back to the (weak) phone-id match but
        // never treat it as cryptographically verified.
        const expectedPhoneId = Deno.env.get('WHATSAPP_META_PHONE_NUMBER_ID');
        const incomingPhoneId = body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
        verified = !!expectedPhoneId && incomingPhoneId === expectedPhoneId;
      }
    } else {
      // Twilio path (form-encoded)
      const form = await req.formData();
      const tw = summarizeTwilio(form);
      eventType = tw.eventType;
      summary = tw.summary;
      providerKey = 'whatsapp_twilio';

      const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
      if (authToken) {
        // Authoritative check: HMAC-SHA1 over the request URL + sorted params.
        const params = {};
        for (const [k, v] of form.entries()) params[k] = String(v);
        const webhookUrl = Deno.env.get('TWILIO_WEBHOOK_URL') || req.url;
        verified = await verifyTwilioSignature(webhookUrl, params, req.headers.get('x-twilio-signature') || '', authToken);
        if (!verified) errorMessage = 'invalid_signature';
      } else {
        // No auth token configured: fall back to the (weak) AccountSid match.
        const expectedSid = Deno.env.get('TWILIO_ACCOUNT_SID');
        const incomingSid = form.get('AccountSid') || '';
        verified = !!expectedSid && incomingSid === expectedSid;
      }
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