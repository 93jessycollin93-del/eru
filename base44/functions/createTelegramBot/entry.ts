import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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

const TELEGRAM_API = 'https://api.telegram.org';

async function callTelegram(token, method, body) {
  const requestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  };
  if (body && Object.keys(body).length > 0) {
    requestInit.body = JSON.stringify(body);
  }
  const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, requestInit);
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.description || `Telegram ${method} failed`);
  }
  return data.result;
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

    const payload = await req.json();
    const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!token) {
      return Response.json({ error: 'Missing Telegram token' }, { status: 500 });
    }

    const me = await callTelegram(token, 'getMe', {});
    const webhookBase = `${new URL(req.url).origin}/functions/telegramWebhook`;
    const webhookUrl = `${webhookBase}?bot=${encodeURIComponent(me.username)}`;

    await callTelegram(token, 'setWebhook', { url: webhookUrl, allowed_updates: ['message'] });

    const botRecord = await base44.entities.TelegramBot.create({
      name: payload.name || me.first_name || me.username,
      bot_username: me.username,
      bot_token_label: 'TELEGRAM_BOT_TOKEN',
      status: 'active',
      webhook_url: webhookUrl,
      webhook_enabled: true,
      personality_prompt: payload.personality_prompt,
      welcome_message: payload.welcome_message || 'Hi! I am ready to help.',
      model_preference: payload.model_preference || 'automatic',
      memory_enabled: payload.memory_enabled ?? true,
      max_memory_messages: payload.max_memory_messages || 12,
      allowed_commands: ['/start', '/help', '/reset'],
      custom_logic_notes: payload.custom_logic_notes || '',
      total_messages: 0,
    });

    return Response.json({ bot: botRecord, telegram: { username: me.username, webhook_url: webhookUrl } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});