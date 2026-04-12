import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const run = payload?.data;

    if (!run?.bot_id) {
      return Response.json({ skipped: true, reason: 'Missing bot id' });
    }

    const recentRuns = await base44.entities.BotTestRun.filter({ bot_id: run.bot_id }, '-created_date', 3);
    if (recentRuns.length < 3) {
      return Response.json({ skipped: true, reason: 'Not enough runs yet' });
    }

    const allFailedThreshold = recentRuns.every((item) => Number(item.pass_rate_snapshot || 0) < 70);
    if (!allFailedThreshold) {
      return Response.json({ skipped: true, reason: 'Threshold not met' });
    }

    const existingAlerts = await base44.entities.AppNotification.filter({ related_id: run.bot_id }, '-created_date', 10);
    const alreadyAlerted = existingAlerts.some((item) => item.title === 'Bot regression detected');

    const versions = await base44.entities.BotVersion.filter({ bot_id: run.bot_id }, '-created_date', 1);
    const latestVersion = versions[0];

    if (!alreadyAlerted) {
      await base44.entities.AppNotification.create({
        title: 'Bot regression detected',
        message: `${run.bot_name || 'A bot'} dropped below 70% pass rate for three consecutive tests.${latestVersion ? ' Automatic rollback was applied.' : ' No saved version was available for rollback.'}`,
        is_read: false,
        type: 'warning',
        related_id: run.bot_id,
      });
    }

    if (latestVersion) {
      await base44.entities.UserBot.update(run.bot_id, {
        instructions: latestVersion.instructions,
        personality: latestVersion.personality,
        response_style: latestVersion.response_style,
        handoff_instructions: latestVersion.handoff_instructions,
        prompt_template_id: latestVersion.prompt_template_id || '',
        prompt_template_values: latestVersion.prompt_template_values || {},
      });
    }

    return Response.json({ success: true, rollback_applied: !!latestVersion });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});