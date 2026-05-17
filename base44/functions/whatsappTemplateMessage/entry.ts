// whatsappTemplateMessage — admin-only template send (Meta Cloud API only).
// Refuses to run unless provider is Connected and template name is provided.
//
// Body: { to: '+E.164', templateName: string, languageCode?: string, components?: any[] }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required.' }, { status: 403 });

    const { to, templateName, languageCode = 'en_US', components = [] } = await req.json();
    if (!to || !templateName) return Response.json({ error: 'Missing required fields: to, templateName.' }, { status: 400 });
    if (!/^\+[1-9]\d{6,14}$/.test(to)) return Response.json({ error: 'Recipient must be E.164 format.' }, { status: 400 });

    const rows = await base44.asServiceRole.entities.IntegrationProvider.filter({ providerKey: 'whatsapp_meta' });
    if (!rows?.[0] || rows[0].status !== 'connected') {
      return Response.json({ error: 'WhatsApp (Meta) is not connected. Templates require a verified provider.' }, { status: 409 });
    }

    const token = Deno.env.get('WHATSAPP_META_TOKEN');
    const phoneId = Deno.env.get('WHATSAPP_META_PHONE_NUMBER_ID');
    if (!token || !phoneId) return Response.json({ error: 'Server not configured: Meta secrets missing.' }, { status: 503 });

    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: { name: templateName, language: { code: languageCode }, components },
      }),
    });
    const json = await res.json().catch(() => ({}));

    await base44.asServiceRole.entities.IntegrationAuditLog.create({
      actor: user.email || 'admin',
      providerKey: 'whatsapp_meta',
      action: 'template.sent',
      result: res.ok ? 'ok' : 'failed',
      severity: res.ok ? 'info' : 'warning',
      details: `${templateName} → ${to.replace(/.(?=.{4})/g, '*')}${res.ok ? '' : ` · ${JSON.stringify(json).slice(0, 200)}`}`,
    }).catch(() => null);

    if (!res.ok) return Response.json({ error: `Meta API ${res.status}`, details: json }, { status: 502 });
    return Response.json({ ok: true, providerResponseId: json?.messages?.[0]?.id || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});