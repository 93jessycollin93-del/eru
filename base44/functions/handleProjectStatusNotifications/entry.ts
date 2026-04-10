import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
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