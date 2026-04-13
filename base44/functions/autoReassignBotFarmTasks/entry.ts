/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PRIORITY_WEIGHT = { low: 1, medium: 2, high: 3, critical: 4 };

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value || 0)));
}

function computeBotFit(bot, task, squad) {
  let score = 45;
  const specialtyMatch = bot.specialty === (task.required_specialization || task.work_type);
  if (specialtyMatch) score += 28;
  score += Math.round((bot.efficiency || 0) * 0.12);
  score += Math.round((bot.integrity || 0) * 0.08);
  score += Math.round((bot.coordination_efficiency || 0) * 0.06);
  score -= Math.round((bot.fatigue || 0) * 0.16);
  score -= Math.round((bot.load || 0) * 0.14);
  score -= Math.round((task.coordination_cost || 0) * 0.8);
  if (squad) score -= Math.round((squad.coordination_overhead || 0) * 0.6);
  if (['maintenance', 'quarantined', 'offline'].includes(bot.status)) score -= 55;
  if (bot.status === 'overloaded') score -= 18;
  return Math.max(0, Math.min(100, score));
}

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const priorityDiff = (PRIORITY_WEIGHT[b.priority] || 1) - (PRIORITY_WEIGHT[a.priority] || 1);
    if (priorityDiff !== 0) return priorityDiff;
    return (b.urgency || 0) - (a.urgency || 0);
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const [bots, squads, tasks] = await Promise.all([
      base44.asServiceRole.entities.BotFarmBot.list('-updated_date', 200),
      base44.asServiceRole.entities.BotFarmSquad.list('-updated_date', 80),
      base44.asServiceRole.entities.BotFarmTask.list('-updated_date', 200),
    ]);

    const activeTasks = sortTasks((tasks || []).filter((task) => ['assigned', 'active', 'review'].includes(task.status)));
    const reassignments = [];

    for (const task of activeTasks) {
      const assignedBot = (bots || []).find((bot) => bot.id === task.assigned_bot_id);
      const assignedSquad = (squads || []).find((squad) => squad.id === (task.assigned_squad_id || assignedBot?.squad_id));
      const assignedRisk = assignedBot
        ? Math.max(Number(assignedBot.fatigue || 0), 100 - Number(assignedBot.integrity || 0), Number(assignedBot.load || 0))
        : 0;

      const needsReassignment = assignedBot && (
        (assignedBot.fatigue || 0) >= 72 ||
        (assignedBot.integrity || 0) <= 68 ||
        (assignedBot.load || 0) >= 78 ||
        assignedBot.status === 'overloaded'
      );

      if (!needsReassignment) continue;

      const candidates = (bots || [])
        .filter((bot) => bot.id !== assignedBot.id)
        .filter((bot) => !['maintenance', 'quarantined', 'offline', 'overloaded'].includes(bot.status))
        .filter((bot) => (bot.fatigue || 0) <= 65 && (bot.integrity || 0) >= 72 && (bot.load || 0) <= 70)
        .map((bot) => {
          const squad = (squads || []).find((item) => item.id === bot.squad_id);
          const fit = computeBotFit(bot, task, squad);
          return { bot, squad, fit };
        })
        .filter((item) => item.fit >= 58)
        .sort((a, b) => b.fit - a.fit);

      const replacement = candidates[0];
      if (!replacement) continue;

      await Promise.all([
        base44.asServiceRole.entities.BotFarmTask.update(task.id, {
          assigned_bot_id: replacement.bot.id,
          assigned_squad_id: replacement.squad?.id,
          bot_fit_score: replacement.fit,
          status: 'assigned'
        }),
        base44.asServiceRole.entities.BotFarmBot.update(assignedBot.id, {
          assigned_task_id: null,
          assigned_task_name: null,
          status: assignedBot.fatigue >= 85 || assignedBot.integrity <= 60 ? 'recovering' : 'idle',
          risk_level: assignedBot.integrity <= 60 ? 'high' : 'medium',
          load: clamp((assignedBot.load || 0) - Math.max(12, Math.round((task.estimated_load || 20) * 0.55)))
        }),
        base44.asServiceRole.entities.BotFarmBot.update(replacement.bot.id, {
          assigned_task_id: task.id,
          assigned_task_name: task.title,
          status: 'assigned',
          load: clamp((replacement.bot.load || 0) + Math.max(10, Math.round((task.estimated_load || 20) * 0.65))),
          fatigue: clamp((replacement.bot.fatigue || 0) + Math.max(6, Math.round((task.estimated_load || 20) * 0.22)))
        }),
        base44.asServiceRole.entities.BotFarmActivityHistory.create({
          actor_type: 'farm',
          actor_id: task.id,
          event_type: 'task_auto_reassigned',
          summary: `${task.title} moved from ${assignedBot.name} to ${replacement.bot.name} before overload escalation.`,
          impact_score: replacement.fit
        })
      ]);

      if (assignedSquad?.id) {
        await base44.asServiceRole.entities.BotFarmSquad.update(assignedSquad.id, {
          current_load: clamp((assignedSquad.current_load || 0) - Math.max(8, Math.round((task.estimated_load || 20) * 0.45))),
          status: 'active'
        });
      }

      if (replacement.squad?.id) {
        await base44.asServiceRole.entities.BotFarmSquad.update(replacement.squad.id, {
          current_load: clamp((replacement.squad.current_load || 0) + Math.max(8, Math.round((task.estimated_load || 20) * 0.45))),
          status: (replacement.squad.current_load || 0) > ((replacement.squad.capacity_limit || 100) * 0.82) ? 'strained' : 'active'
        });
      }

      reassignments.push({
        task_id: task.id,
        task_title: task.title,
        from_bot_id: assignedBot.id,
        from_bot_name: assignedBot.name,
        to_bot_id: replacement.bot.id,
        to_bot_name: replacement.bot.name,
        previous_risk: assignedRisk,
        new_fit: replacement.fit
      });
    }

    return Response.json({ success: true, reassignments });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});