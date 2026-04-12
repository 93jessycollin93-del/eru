import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function getLast7DaysIso() {
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(now.getUTCDate() - 7);
  return start.toISOString();
}

function extractTaskGroupRoiMap(history = [], taskGroups = []) {
  const baseMap = Object.fromEntries((taskGroups || []).map((group) => [group.name || group.id, { totalRoi: 0, runs: 0 }]));

  for (const run of history) {
    const label = run.run_label || '';
    const matchedGroup = (taskGroups || []).find((group) => label.toLowerCase().includes((group.name || '').toLowerCase()));
    const key = matchedGroup?.name || 'General';
    if (!baseMap[key]) {
      baseMap[key] = { totalRoi: 0, runs: 0 };
    }
    baseMap[key].totalRoi += Number(run.estimated_roi || 0);
    baseMap[key].runs += 1;
  }

  return Object.entries(baseMap)
    .filter(([, value]) => value.runs > 0)
    .map(([name, value]) => ({ name, avgRoi: Math.round(value.totalRoi / value.runs), runs: value.runs }))
    .sort((a, b) => b.avgRoi - a.avgRoi);
}

function buildEmailBody(summaryRows, totalRuns, topSquadName) {
  return `Weekly Bot Squad Summary\n\nTotal squad runs: ${totalRuns}\nTop squad: ${topSquadName || 'None'}\n\n${summaryRows.map((row) => `${row.squadName}\n- Runs: ${row.runs}\n- Avg success: ${row.avgSuccess}%\n- Avg ROI: ${row.avgRoi}%\n- Task groups: ${row.groupRoi.length > 0 ? row.groupRoi.map((group) => `${group.name} (${group.avgRoi}% ROI)`).join(', ') : 'No task group data'}\n`).join('\n')}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const squads = await base44.asServiceRole.entities.BotSquad.list('-updated_date', 100);
    const last7Days = getLast7DaysIso();

    const summaryRows = squads.map((squad) => {
      const recentRuns = (squad.execution_history || []).filter((entry) => entry.created_at && entry.created_at >= last7Days);
      const runs = recentRuns.length;
      const avgSuccess = runs ? Math.round(recentRuns.reduce((sum, item) => sum + Number(item.success_rate || 0), 0) / runs) : 0;
      const avgRoi = runs ? Math.round(recentRuns.reduce((sum, item) => sum + Number(item.estimated_roi || 0), 0) / runs) : 0;
      const groupRoi = extractTaskGroupRoiMap(recentRuns, squad.task_groups || []);

      return {
        squadId: squad.id,
        squadName: squad.name,
        runs,
        avgSuccess,
        avgRoi,
        groupRoi,
      };
    }).filter((row) => row.runs > 0).sort((a, b) => b.avgRoi - a.avgRoi);

    const totalRuns = summaryRows.reduce((sum, row) => sum + row.runs, 0);
    const topSquadName = summaryRows[0]?.squadName || '';
    const emailBody = buildEmailBody(summaryRows, totalRuns, topSquadName);

    await Promise.all([
      base44.integrations.Core.SendEmail({
        to: user.email,
        subject: 'Weekly Bot Squad Report',
        body: emailBody,
      }),
      base44.asServiceRole.entities.AppNotification.create({
        title: 'Weekly squad report ready',
        message: `Weekly summary generated for ${totalRuns} squad runs.${topSquadName ? ` Top squad: ${topSquadName}.` : ''}`,
        is_read: false,
        type: 'info',
        related_id: 'weekly_squad_report',
      })
    ]);

    return Response.json({ success: true, total_runs: totalRuns, top_squad: topSquadName, squads: summaryRows });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});