import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();
    const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const tasks = await base44.asServiceRole.entities.Task.list('-due_date', 200);
    const dueSoonTasks = (tasks || []).filter((task) => {
      if (!task.due_date || task.status === 'done' || !task.assigned_to) return false;
      return task.due_date > now.toISOString() && task.due_date <= next24Hours;
    });

    for (const task of dueSoonTasks) {
      const existing = await base44.asServiceRole.entities.AppNotification.filter({
        user_email: task.assigned_to,
        type: 'task_due_soon',
        entity_id: task.id,
      }, '-created_date', 1);

      if (existing?.length) continue;

      const notification = await base44.asServiceRole.entities.AppNotification.create({
        user_email: task.assigned_to,
        type: 'task_due_soon',
        title: `Upcoming task due: ${task.title}`,
        message: `Your task "${task.title}" is due within 24 hours.`,
        entity_type: 'Task',
        entity_id: task.id,
        metadata: {
          due_date: task.due_date,
          priority: task.priority,
        },
      });

      await base44.integrations.Core.SendEmail({
        to: task.assigned_to,
        subject: `Task due soon: ${task.title}`,
        body: `Your task "${task.title}" is due on ${task.due_date}.\n\nPlease review it in the app.`,
      });

      await base44.asServiceRole.entities.AppNotification.update(notification.id, { email_sent: true });
    }

    return Response.json({ success: true, created: dueSoonTasks.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});