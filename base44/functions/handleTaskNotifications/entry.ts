import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
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