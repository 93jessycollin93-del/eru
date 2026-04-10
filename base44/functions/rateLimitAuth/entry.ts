import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// In-memory rate limit tracking (use Redis in production)
const rateLimitMap = new Map();
const RATE_LIMITS = {
  login: { max: 5, window: 60000 }, // 5 attempts per minute
  signup: { max: 3, window: 3600000 }, // 3 signups per hour
  passwordReset: { max: 3, window: 3600000 }, // 3 resets per hour
};

function checkRateLimit(key, action) {
  const limit = RATE_LIMITS[action];
  if (!limit) return { allowed: true };

  const now = Date.now();
  const entry = rateLimitMap.get(key) || { count: 0, resetTime: now + limit.window };

  if (now > entry.resetTime) {
    // Window expired, reset
    rateLimitMap.set(key, { count: 1, resetTime: now + limit.window });
    return { allowed: true, remaining: limit.max - 1 };
  }

  if (entry.count >= limit.max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
    };
  }

  entry.count++;
  rateLimitMap.set(key, entry);
  return { allowed: true, remaining: limit.max - entry.count };
}

export async function handleRateLimitedAuth(req) {
  const base44 = createClientFromRequest(req);
  const action = req.headers.get('x-auth-action') || 'login'; // login, signup, passwordReset
  const identifier = req.headers.get('x-identifier'); // email or IP

  if (!identifier) {
    return Response.json({ error: 'Missing identifier' }, { status: 400 });
  }

  const key = `${action}:${identifier}`;
  const check = checkRateLimit(key, action);

  if (!check.allowed) {
    // Log failed attempt
    try {
      await base44.asServiceRole.entities.SecurityAuditLog.create({
        event_type: 'login_failed',
        user_email: identifier,
        status: 'blocked',
        severity: 'warning',
        details: { reason: `Rate limit exceeded for ${action}` },
      });
    } catch (err) {
      console.log('Could not log rate limit event');
    }

    return Response.json(
      {
        error: `Too many ${action} attempts. Try again in ${check.retryAfter} seconds.`,
        retryAfter: check.retryAfter,
      },
      { status: 429, headers: { 'Retry-After': check.retryAfter } }
    );
  }

  return { allowed: true, remaining: check.remaining };
}

Deno.serve(async (req) => {
  const check = await handleRateLimitedAuth(req);
  if (typeof check === 'object' && check.status) {
    return check;
  }

  return Response.json(check);
});