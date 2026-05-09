import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function buildQuotaState(existing = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const lastReset = existing.last_reset_date || '';
  const extra = Number(existing.extra_uses_balance || 0);
  const dailyLimit = Number(existing.daily_limit || 50);
  const usedToday = lastReset === today ? Number(existing.used_today || 0) : 0;
  const remainingToday = Math.max(0, dailyLimit - usedToday);
  return {
    daily_limit: dailyLimit,
    used_today: usedToday,
    remaining_today: remainingToday,
    extra_uses_balance: extra,
    last_reset_date: today,
    warned_at_80: lastReset === today ? (existing.warned_at_80 || '') : '',
    warned_at_100: lastReset === today ? (existing.warned_at_100 || '') : ''
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const quota = buildQuotaState(user.integration_quota || {});
    await base44.auth.updateMe({ integration_quota: quota });
    return Response.json({ quota });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});