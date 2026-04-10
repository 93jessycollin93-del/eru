# ✅ SECURITY IMPLEMENTATION CHECKLIST
## Step-by-Step Fix Guide for Commercial Deployment

---

## 🔴 CRITICAL FIXES (Complete Before Beta)

### [ ] 1. Redis Webhook Replay Cache
**Priority:** CRITICAL  
**Effort:** 4 hours  
**File:** `lib/webhookValidator.js`

**Current Code:**
```javascript
const PROCESSED_WEBHOOKS = new Set(); // ❌ In-memory
```

**Fix:**
```javascript
import redis from 'redis';

const client = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
});

export async function checkReplayAttempt(idempotencyKey) {
  const exists = await client.get(`webhook:${idempotencyKey}`);
  
  if (exists) {
    return { allowed: false, reason: 'Already processed' };
  }
  
  // Set with 24-hour TTL
  await client.setex(`webhook:${idempotencyKey}`, 86400, '1');
  return { allowed: true };
}
```

**Testing:**
```bash
# Test webhook replay
curl -X POST https://api.yourapp.com/webhook \
  -H "X-Idempotency-Key: test-123" \
  -d '{"event": "payment.succeeded"}'

# Try again with same key — should be rejected
curl -X POST https://api.yourapp.com/webhook \
  -H "X-Idempotency-Key: test-123" \
  -d '{"event": "payment.succeeded"}'
# Expected: 409 Conflict
```

---

### [ ] 2. Production Payment Provider Configuration
**Priority:** CRITICAL  
**Effort:** 8 hours  
**Files:** `functions/*.js`, `lib/paymentConfig.js`

**Checklist:**
- [ ] Stripe: Live API keys configured
- [ ] Stripe: Webhook signing secret (not test)
- [ ] Apple IAP: Bundle ID matches app
- [ ] Apple IAP: Shared secret from App Store Connect
- [ ] Google Play: Service account JSON
- [ ] All test mode flags set to `false`

**Setup Steps:**

1. **Stripe:**
   ```bash
   # 1. Go to https://dashboard.stripe.com/apikeys
   # 2. Copy "Secret key" (starts with sk_live_)
   # 3. Set STRIPE_SECRET_KEY=sk_live_xxx
   # 4. Set STRIPE_PUBLIC_KEY=pk_live_xxx
   # 5. Set STRIPE_WEBHOOK_SECRET=whsec_live_xxx
   ```

2. **Apple IAP:**
   ```bash
   # 1. Go to App Store Connect
   # 2. Users and Access → API Keys → App Store Connect API
   # 3. Download key.p8
   # 4. Set APPLE_SHARED_SECRET=xxxxx
   ```

3. **Google Play:**
   ```bash
   # 1. Go to Google Cloud Console
   # 2. Create service account
   # 3. Download JSON key
   # 4. Set GOOGLE_SERVICE_ACCOUNT=<JSON>
   ```

**Validation Script:**
```javascript
// scripts/validate-payment-providers.js
const providers = {
  stripe: process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_'),
  apple: !!process.env.APPLE_SHARED_SECRET && process.env.APPLE_SHARED_SECRET.length > 20,
  google: !!process.env.GOOGLE_SERVICE_ACCOUNT,
};

Object.entries(providers).forEach(([provider, valid]) => {
  console.log(`${valid ? '✅' : '❌'} ${provider}`);
  if (!valid) process.exit(1);
});
```

**Run Before Deployment:**
```bash
node scripts/validate-payment-providers.js
```

---

### [ ] 3. Telegram Signature Validation
**Priority:** CRITICAL  
**Effort:** 6 hours  
**Files:** `lib/telegramValidator.js` (new)

**Create File:**
```javascript
// lib/telegramValidator.js

import crypto from 'crypto';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export function validateTelegramInitData(initData) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');
  
  // Create data check string
  const dataCheckArray = [];
  for (const [key, value] of params.entries()) {
    dataCheckArray.push(`${key}=${value}`);
  }
  const dataCheckString = dataCheckArray.sort().join('\n');
  
  // Create secret key
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(BOT_TOKEN)
    .digest();
  
  // Calculate expected hash
  const expectedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  
  // ✅ Constant-time comparison
  if (!crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash))) {
    throw new Error('Invalid Telegram signature');
  }
  
  // Verify auth_date is recent (< 1 day old)
  const authDate = parseInt(params.get('auth_date'));
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > 86400) {
    throw new Error('Auth data too old');
  }
  
  return JSON.parse(params.get('user'));
}
```

**Use in Functions:**
```javascript
// functions/telegramPayment.js

Deno.serve(async (req) => {
  const initData = req.headers.get('x-telegram-init-data');
  
  try {
    const user = validateTelegramInitData(initData);
    // Proceed with payment
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 401 });
  }
});
```

---

### [ ] 4. Database Encryption at Rest
**Priority:** CRITICAL  
**Effort:** 12 hours  
**Impact:** PII protection

**Create:**
```javascript
// lib/encryption.js

import crypto from 'crypto';

const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
const ALGORITHM = 'aes-256-gcm';

export function encrypt(plaintext) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return `${iv.toString('hex')}:${encrypted}:${cipher.getAuthTag().toString('hex')}`;
}

export function decrypt(ciphertext) {
  const [ivHex, encryptedHex, tagHex] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

**Use on User Entity:**
```javascript
// Before saving to database
user.phone = encrypt(user.phone);
user.ssn = encrypt(user.ssn);

// After reading from database
user.phone = decrypt(user.phone);
```

---

### [ ] 5. Rate Limiting on Authentication
**Priority:** CRITICAL  
**Effort:** 4 hours  
**Protection:** Brute-force attacks

**Create:**
```javascript
// functions/rateLimitAuth.js

import { base44 } from '@/api/base44Client';

const RATE_LIMITS = {
  login: 5,      // 5 attempts per minute
  signup: 3,     // 3 signups per hour
  passwordReset: 3, // 3 resets per hour
};

export async function checkRateLimit(userId, action) {
  const key = `ratelimit:${action}:${userId}`;
  const count = await base44.cache.increment(key);
  
  if (count === 1) {
    await base44.cache.setExpiry(key, 3600); // 1 hour
  }
  
  if (count > RATE_LIMITS[action]) {
    throw new Error(`Too many ${action} attempts. Try again later.`);
  }
}
```

---

### [ ] 6. App Store Compliance — Privacy Policy
**Priority:** CRITICAL  
**Effort:** 4 hours

**Required Sections in Privacy Policy:**

```markdown
# Privacy Policy

## Data We Collect
- Email address
- Payment information (processed by Stripe/Apple Pay/Google Pay)
- Device information (OS, model, app version)
- Usage analytics (pages visited, features used)
- Location (if permission granted)

## Age Restrictions
- This app is intended for users 13+
- Users under 13 require parental consent
- We do not knowingly collect data from users under 13

## Your Rights (GDPR/CCPA)
- Right to access your data
- Right to delete your account and data
- Right to data portability
- Right to opt-out of analytics

## Contact
- Privacy Team: privacy@yourapp.com
- Data Protection Officer: dpo@yourapp.com
```

**Upload To:**
- iOS App Store: App Information → Privacy Policy URL
- Google Play: Policy & Programs → Privacy Policy
- Website: Footer link

---

## 🟠 HIGH-PRIORITY FIXES (Complete Before Launch)

### [ ] 7. Biometric Authentication Fallback
**Effort:** 8 hours  
**File:** `components/BiometricAuth.jsx`

**Add Fallback Flow:**
```javascript
export default function BiometricAuth() {
  const [method, setMethod] = useState('biometric'); // 'biometric' | 'pin'
  
  if (method === 'biometric') {
    return (
      <BiometricPrompt
        onSuccess={handleSuccess}
        onFallback={() => setMethod('pin')}
      />
    );
  }
  
  return (
    <PINVerification
      onSuccess={handleSuccess}
      onResendOTP={resendOTP}
    />
  );
}
```

---

### [ ] 8. Session Timeout
**Effort:** 2 hours  
**File:** `lib/AuthContext.jsx`

**Add:**
```javascript
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

useEffect(() => {
  let timeout;
  
  const resetTimer = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      logout();
      toast.error('Session expired');
    }, SESSION_TIMEOUT);
  };
  
  // Reset on user activity
  window.addEventListener('click', resetTimer);
  window.addEventListener('scroll', resetTimer);
  
  resetTimer();
  
  return () => {
    window.removeEventListener('click', resetTimer);
    window.removeEventListener('scroll', resetTimer);
  };
}, []);
```

---

### [ ] 9. Security Audit Log
**Effort:** 6 hours  
**File:** `lib/auditLog.js` (new)

**Create Entity:**
```json
// entities/SecurityAuditLog.json
{
  "name": "SecurityAuditLog",
  "type": "object",
  "properties": {
    "event_type": {
      "type": "string",
      "enum": ["login", "logout", "payment_attempt", "failed_auth", "admin_action"]
    },
    "user_email": { "type": "string" },
    "ip_address": { "type": "string" },
    "status": { "type": "string" },
    "details": { "type": "object" },
    "severity": { "type": "string", "enum": ["info", "warning", "critical"] }
  },
  "rls": {
    "read": { "user_condition": { "role": "admin" } }
  }
}
```

---

### [ ] 10. Input Validation with Zod
**Effort:** 6 hours  
**Files:** `lib/validation.js` (new)

**Create:**
```javascript
// lib/validation.js
import { z } from 'zod';

export const PaymentSchema = z.object({
  email: z.string().email().max(255),
  amount: z.number().positive().max(10000),
  currency: z.enum(['USD', 'EUR', 'GBP']),
});

export const UserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12).regex(/[A-Z]/).regex(/[0-9]/),
  age: z.number().min(13).max(150),
});

// Use in forms
const validated = PaymentSchema.parse(formData);
```

---

## 🟡 MEDIUM-PRIORITY FIXES

### [ ] 11. Content Security Policy
**Effort:** 2 hours

**Add to all responses:**
```javascript
'Content-Security-Policy': [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https:",
  "connect-src 'self' https://api.stripe.com"
].join(';')
```

---

### [ ] 12. GDPR Data Deletion
**Effort:** 8 hours

**Add Endpoint:**
```javascript
// functions/deleteMyData.js

Deno.serve(async (req) => {
  const user = await base44.auth.me();
  
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  
  // Delete all personal data
  await base44.entities.User.delete(user.id);
  // Delete orders, transactions, etc.
  
  return Response.json({ success: true });
});
```

---

### [ ] 13. Encrypted Backups
**Effort:** 4 hours

**Add Backup Script:**
```bash
#!/bin/bash
# scripts/backup.sh

# Backup database with encryption
pg_dump $DATABASE_URL | \
  openssl enc -aes-256-cbc -salt -out backup-$(date +%s).enc

# Upload to S3
aws s3 cp backup-*.enc s3://backups/
```

---

## 🎯 TESTING CHECKLIST

### Security Testing

**Manual Testing:**
```bash
# 1. Test webhook replay protection
curl -X POST /webhook -H "X-Idempotency-Key: test-1" # Should succeed
curl -X POST /webhook -H "X-Idempotency-Key: test-1" # Should fail

# 2. Test rate limiting
for i in {1..10}; do curl -X POST /login -d '{"email":"test@example.com"}'; done
# After 5, should get 429 Too Many Requests

# 3. Test Telegram signature validation
# Attempt with invalid signature
curl -X POST /telegram-payment \
  -H "X-Telegram-Init-Data: invalid_signature"
# Should get 401 Unauthorized

# 4. Test payment amount validation
# Try to buy $100 item for $50
# Should be rejected
```

**Automated Testing:**
```bash
npm test -- --coverage
```

---

## 📊 DEPLOYMENT VALIDATION

**Before production deployment, run:**

```bash
# 1. Security audit
npm audit fix
npm run eslint

# 2. Secrets validation
node scripts/validate-secrets.js

# 3. Payment config
node scripts/validate-payment-providers.js

# 4. Database encryption
node scripts/encrypt-sensitive-fields.js

# 5. Load test
artillery run load-test.yml

# 6. Smoke test
npm run test:smoke
```

---

## 📋 SIGN-OFF CHECKLIST

Before going live:

- [ ] All CRITICAL fixes implemented & tested
- [ ] Legal review: Privacy policy + ToS
- [ ] Security consultant sign-off
- [ ] Penetration testing completed
- [ ] Incident response plan documented
- [ ] 24/7 support team trained
- [ ] Backup & recovery tested
- [ ] Payment provider testing complete
- [ ] App Store submission ready
- [ ] Monitoring & alerting configured

---

**Status:** 🔴 NOT READY FOR PRODUCTION  
**Estimated Timeline:** 4-6 weeks  
**Estimated Cost:** $15K-30K