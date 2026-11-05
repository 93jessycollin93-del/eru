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

Deno.serve(async (req) => {
  const offlineBlock = offlineResponse('email');
  if (offlineBlock) return offlineBlock;

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { data, old_data, changed_fields } = payload;

    if (!changed_fields?.includes('status') || !data?.status || data.status === old_data?.status) {
      return Response.json({ success: true, skipped: true });
    }

    const recipients = Array.from(new Set([
      data.owner_email,
      ...(data.member_emails || []),
    ].filter(Boolean)));

    for (const email of recipients) {
      const notification = await base44.asServiceRole.entities.AppNotification.create({
        user_email: email,
        type: 'project_status_changed',
        title: `Project status changed: ${data.name}`,
        message: `Project "${data.name}" changed from ${old_data?.status || 'unknown'} to ${data.status}.`,
        entity_type: 'Project',
        entity_id: data.id,
        metadata: {
          old_status: old_data?.status,
          new_status: data.status,
        },
      });

      await base44.integrations.Core.SendEmail({
        to: email,
        subject: `Project update: ${data.name}`,
        body: `Project "${data.name}" status changed from ${old_data?.status || 'unknown'} to ${data.status}.`,
      });

      await base44.asServiceRole.entities.AppNotification.update(notification.id, { email_sent: true });
    }

    return Response.json({ success: true, recipients: recipients.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});