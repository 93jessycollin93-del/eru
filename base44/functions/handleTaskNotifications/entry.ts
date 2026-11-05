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
    const { event, data, old_data } = payload;

    if (event?.type === 'create' && data?.assigned_to) {
      const notification = await base44.asServiceRole.entities.AppNotification.create({
        user_email: data.assigned_to,
        type: 'task_assigned',
        title: `New task assigned: ${data.title}`,
        message: `You have been assigned a new task: "${data.title}".`,
        entity_type: 'Task',
        entity_id: data.id,
        metadata: {
          due_date: data.due_date,
          project_id: data.project_id,
        },
      });

      await base44.integrations.Core.SendEmail({
        to: data.assigned_to,
        subject: `New task assigned: ${data.title}`,
        body: `You have been assigned a new task: "${data.title}".\n\nPlease check the app for full details.`,
      });

      await base44.asServiceRole.entities.AppNotification.update(notification.id, { email_sent: true });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});