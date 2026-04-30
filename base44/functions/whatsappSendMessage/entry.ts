// whatsappSendMessage — admin-only send. Refuses to send if secrets are
// missing or if the IntegrationProvider row isn't marked Connected.
//
// Body: { provider: 'meta'|'twilio', to: '+E.164', text: string }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function ensureConnected(base44, providerKey) {
  const rows = await base44.asServiceRole.entities.IntegrationProvider.filter({ providerKey });
  const row = rows?.[0];
  if (!row || row.status !== 'connected') {
    throw new Error(`${providerKey} is not connected. Run setup and verification first.`);
  }
  return row;
}

async function sendViaMeta(to, text) {
  const token = Deno.env.get('WHATSAPP_META_TOKEN');
  const phoneId = Deno.env.get('WHATSAPP_META_PHONE_NUMBER_ID');
  if (!token || !phoneId) throw new Error('Server not configured: WHATSAPP_META_TOKEN and WHATSAPP_META_PHONE_NUMBER_ID required.');
  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Meta API ${res.status}: ${errText.slice(0, 200)}`);
  }
  return await res.json();
}

async function sendViaTwilio(to, text) {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_WHATSAPP_FROM');
  if (!sid || !token || !from) throw new Error('Server not configured: Twilio credentials missing.');
  const auth = btoa(`${sid}:${token}`);
  const body = new URLSearchParams({
    From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
    To: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
    Body: text,
  });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Twilio API ${res.status}: ${errText.slice(0, 200)}`);
  }
  return await res.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required.' }, { status: 403 });

    const { provider, to, text } = await req.json();
    if (!provider || !to || !text) return Response.json({ error: 'Missing required fields: provider, to, text.' }, { status: 400 });
    if (!/^\+[1-9]\d{6,14}$/.test(to)) return Response.json({ error: 'Recipient must be E.164 format (e.g. +14155550100).' }, { status: 400 });

    const providerKey = provider === 'twilio' ? 'whatsapp_twilio' : 'whatsapp_meta';
    await ensureConnected(base44, providerKey);

    const result = provider === 'twilio' ? await sendViaTwilio(to, text) : await sendViaMeta(to, text);

    await base44.asServiceRole.entities.IntegrationAuditLog.create({
      actor: user.email || 'admin',
      providerKey,
      action: 'message.sent',
      result: 'ok',
      severity: 'info',
      details: `to ${to.replace(/.(?=.{4})/g, '*')} · ${text.length} chars`,
    }).catch(() => null);

    return Response.json({ ok: true, providerResponseId: result?.messages?.[0]?.id || result?.sid || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});