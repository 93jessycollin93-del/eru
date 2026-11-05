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
/* global Deno */

function makeCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

Deno.serve(async (req) => {
  const offlineBlock = offlineResponse('telegram');
  if (offlineBlock) return offlineBlock;

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await base44.entities.TelegramAccount.filter({ user_email: user.email }, '-updated_date', 1);
    const linkCode = makeCode();
    const botUsername = Deno.env.get('TELEGRAM_LINK_BOT_USERNAME') || 'your_bot';
    const payload = {
      user_email: user.email,
      link_code: linkCode,
      link_status: 'pending'
    };

    let account;
    if (existing?.[0]) {
      account = await base44.entities.TelegramAccount.update(existing[0].id, payload);
    } else {
      account = await base44.entities.TelegramAccount.create(payload);
    }

    return Response.json({
      link_code: linkCode,
      deep_link_url: `https://t.me/${botUsername}?start=link_${linkCode}`,
      account
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});