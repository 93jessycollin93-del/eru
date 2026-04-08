import crypto from 'crypto';

/**
 * WEBHOOK AUTHENTICATION LAYER
 * 
 * All payment webhooks must:
 * - Have valid signature from trusted provider
 * - Have timestamp within acceptable window (prevent replay)
 * - Have correct provider origin
 * - Not be a duplicate (idempotency key)
 */

const WEBHOOK_SECRETS = {
  stripe: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_stripe',
  crypto: process.env.CRYPTO_WEBHOOK_SECRET || 'whsec_test_crypto',
  wallet: process.env.WALLET_WEBHOOK_SECRET || 'whsec_test_wallet',
};

const TIMESTAMP_TOLERANCE_SECONDS = 300; // 5 minutes
const PROCESSED_WEBHOOKS = new Set(); // In-memory replay cache (use Redis in production)

/**
 * Validate webhook signature
 * @param {string} provider - 'stripe' | 'crypto' | 'wallet'
 * @param {string} signature - Signature from webhook header
 * @param {string} rawBody - Raw webhook payload (string)
 * @returns {boolean} true if signature is valid
 */
export function validateWebhookSignature(provider, signature, rawBody) {
  const secret = WEBHOOK_SECRETS[provider];
  if (!secret) {
    throw new Error(`❌ WEBHOOK VALIDATION: Unknown provider "${provider}"`);
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return false;
  }

  return true;
}

/**
 * Validate webhook timestamp (prevent replay attacks)
 * @param {number} webhookTimestamp - Timestamp from webhook (Unix seconds)
 * @returns {boolean} true if timestamp is recent
 */
export function validateWebhookTimestamp(webhookTimestamp) {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.abs(now - webhookTimestamp);

  if (diff > TIMESTAMP_TOLERANCE_SECONDS) {
    return false; // Webhook is too old or too far in future
  }

  return true;
}

/**
 * Prevent replay attacks using idempotency key
 * @param {string} idempotencyKey - Unique key from webhook
 * @returns {{allowed: boolean, reason?: string}}
 */
export function checkReplayAttempt(idempotencyKey) {
  if (PROCESSED_WEBHOOKS.has(idempotencyKey)) {
    return {
      allowed: false,
      reason: 'Webhook already processed (replay attempt detected)',
    };
  }

  PROCESSED_WEBHOOKS.add(idempotencyKey);
  return { allowed: true };
}

/**
 * Full webhook validation
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateWebhook(webhookData) {
  const errors = [];

  // Check signature
  if (!webhookData.signature) {
    errors.push('Missing webhook signature');
  } else if (!validateWebhookSignature(webhookData.provider, webhookData.signature, webhookData.rawBody)) {
    errors.push('Invalid webhook signature — rejected');
  }

  // Check timestamp
  if (!webhookData.timestamp) {
    errors.push('Missing webhook timestamp');
  } else if (!validateWebhookTimestamp(webhookData.timestamp)) {
    errors.push('Webhook timestamp outside acceptable window (replay attack?)');
  }

  // Check idempotency
  if (!webhookData.idempotencyKey) {
    errors.push('Missing idempotency key');
  } else {
    const replay = checkReplayAttempt(webhookData.idempotencyKey);
    if (!replay.allowed) {
      errors.push(replay.reason);
    }
  }

  // Check provider
  if (!['stripe', 'crypto', 'wallet'].includes(webhookData.provider)) {
    errors.push(`Unknown provider: ${webhookData.provider}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Example: Stripe webhook validation
 */
export function validateStripeWebhook(signature, rawBody) {
  try {
    return validateWebhookSignature('stripe', signature, rawBody);
  } catch (err) {
    console.error('Stripe webhook validation error:', err.message);
    return false;
  }
}

/**
 * Example: Crypto provider webhook validation
 */
export function validateCryptoWebhook(signature, rawBody) {
  try {
    return validateWebhookSignature('crypto', signature, rawBody);
  } catch (err) {
    console.error('Crypto webhook validation error:', err.message);
    return false;
  }
}