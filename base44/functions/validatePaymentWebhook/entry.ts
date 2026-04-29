// Server-side payment webhook validation. Reads HMAC secrets from
// Deno.env.get(...) — they NEVER leave this runtime. Replaces the
// browser-side stub in src/lib/webhookValidator.js, which used to inline
// VITE_*_WEBHOOK_SECRET into the JS bundle.
//
// Expected request body (already parsed JSON):
//   {
//     provider: 'stripe' | 'crypto' | 'wallet',
//     signature: string,        // header value forwarded from upstream
//     rawBody: string,          // exact bytes the upstream signed
//     timestamp: number,        // unix seconds
//     idempotencyKey: string,
//   }
//
// Response:
//   200 { valid: true }                       — caller may set
//                                                Order.payment_webhook_verified = true
//   400 { valid: false, errors: string[] }   — fail closed everywhere else

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TIMESTAMP_TOLERANCE_SECONDS = 300; // 5 minutes

function getSecretFor(provider) {
  if (provider === 'stripe') return Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
  if (provider === 'crypto') return Deno.env.get('CRYPTO_WEBHOOK_SECRET') || '';
  if (provider === 'wallet') return Deno.env.get('WALLET_WEBHOOK_SECRET') || '';
  return '';
}

async function hmacHex(secret, body) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

Deno.serve(async (req) => {
  try {
    // Caller must be authenticated; only callers acting on the user's behalf
    // (e.g. order processing) should reach this endpoint.
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ valid: false, errors: ['Unauthorized'] }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { provider, signature, rawBody, timestamp, idempotencyKey } = body || {};
    const errors = [];

    if (!['stripe', 'crypto', 'wallet'].includes(provider)) {
      errors.push(`Unknown provider: ${provider}`);
    }
    if (!signature) errors.push('Missing webhook signature');
    if (!rawBody) errors.push('Missing rawBody');
    if (!timestamp) errors.push('Missing webhook timestamp');
    if (!idempotencyKey) errors.push('Missing idempotency key');

    if (errors.length > 0) {
      return Response.json({ valid: false, errors }, { status: 400 });
    }

    // Replay window check.
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - Number(timestamp)) > TIMESTAMP_TOLERANCE_SECONDS) {
      return Response.json({
        valid: false,
        errors: ['Webhook timestamp outside acceptable window (replay attempt?)'],
      }, { status: 400 });
    }

    const secret = getSecretFor(provider);
    if (!secret) {
      return Response.json({
        valid: false,
        errors: [`No secret configured for provider ${provider}. Set ${provider.toUpperCase()}_WEBHOOK_SECRET env var.`],
      }, { status: 500 });
    }

    const expected = await hmacHex(secret, rawBody);
    if (!timingSafeEqual(String(signature), expected)) {
      return Response.json({ valid: false, errors: ['Invalid webhook signature — rejected'] }, { status: 400 });
    }

    // Idempotency dedupe — record this key so a replay with a valid signature
    // still gets rejected on the second hit. Stored under PaymentEvent so
    // it survives function restarts.
    const existing = await base44.asServiceRole.entities.PaymentEvent.filter(
      { idempotency_key: idempotencyKey },
      null,
      1,
    ).catch(() => []);
    if (existing && existing.length > 0) {
      return Response.json({
        valid: false,
        errors: ['Webhook already processed (replay attempt detected)'],
      }, { status: 409 });
    }

    await base44.asServiceRole.entities.PaymentEvent.create({
      provider,
      idempotency_key: idempotencyKey,
      verified_at: new Date().toISOString(),
      verifier_email: user.email,
    }).catch(() => {});

    return Response.json({ valid: true });
  } catch (error) {
    return Response.json({ valid: false, errors: [error.message || 'Webhook validation crashed'] }, { status: 500 });
  }
});
