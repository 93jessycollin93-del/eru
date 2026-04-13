/* eslint-env deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const risk = payload?.data;

    if (!risk || risk.severity !== 'critical' || risk.status !== 'open') {
      return Response.json({ skipped: true });
    }

    await base44.entities.AppNotification.create({
      user_email: user.email,
      type: 'project_status_changed',
      title: 'Critical Bot Farm Risk Detected',
      message: risk.details || 'A critical Bot Farm risk flag was opened and needs immediate attention.',
      entity_type: 'Project',
      entity_id: 'bot-farm-critical-risk',
      is_read: false,
      email_sent: false,
      metadata: {
        source: 'bot_farm',
        risk_flag_id: risk.id,
        link: '/bot-farm'
      }
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});