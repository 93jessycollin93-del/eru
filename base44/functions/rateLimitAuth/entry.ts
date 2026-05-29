import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const RATE_LIMITS = {
  login: { max: 5, window: 60000 }, // 5 attempts per minute
  signup: { max: 3, window: 3600000 }, // 3 signups per hour
  passwordReset: { max: 3, window: 3600000 }, // 3 resets per hour
};

// Persistent rate limiting backed by the RateLimitCounter entity.
//
// The previous implementation kept counters in an in-memory Map, which reset
// on every function cold start and was not shared across horizontally-scaled
// instances — so an attacker could sidestep the limit simply by spreading
// requests over time or instances. Persisting to an entity makes the limit
// durable and cluster-wide. (There is no atomic increment, so a burst of
// truly-simultaneous requests can race by a small margin; this is acceptable
// for auth throttling and is a large improvement over in-memory state.)
async function checkRateLimit(base44, key, action) {
  const limit = RATE_LIMITS[action];
  if (!limit) return { allowed: true };

  const now = Date.now();
  let entry = null;
  try {
    const rows = await base44.asServiceRole.entities.RateLimitCounter.filter({ key });
    entry = rows?.[0] || null;
  } catch {
    entry = null;
  }

  // No record yet, or the window has expired → start a fresh window.
  if (!entry || now > Number(entry.reset_time || 0)) {
    const data = { key, action, count: 1, reset_time: now + limit.window };
    try {
      if (entry) await base44.asServiceRole.entities.RateLimitCounter.update(entry.id, data);
      else await base44.asServiceRole.entities.RateLimitCounter.create(data);
    } catch {
      /* best effort — never let counter persistence block the auth flow */
    }
    return { allowed: true, remaining: limit.max - 1 };
  }

  const count = Number(entry.count || 0);
  if (count >= limit.max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((Number(entry.reset_time) - now) / 1000),
    };
  }

  try {
    await base44.asServiceRole.entities.RateLimitCounter.update(entry.id, { count: count + 1 });
  } catch {
    /* best effort */
  }
  return { allowed: true, remaining: limit.max - count - 1 };
}

export async function handleRateLimitedAuth(req) {
  const base44 = createClientFromRequest(req);
  const action = req.headers.get('x-auth-action') || 'login'; // login, signup, passwordReset
  const identifier = req.headers.get('x-identifier'); // email or IP

  if (!identifier) {
    return Response.json({ error: 'Missing identifier' }, { status: 400 });
  }

  const key = `${action}:${identifier}`;
  const check = await checkRateLimit(base44, key, action);

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
      { status: 429, headers: { 'Retry-After': String(check.retryAfter) } }
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
