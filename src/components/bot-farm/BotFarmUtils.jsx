export function getStatusTone(status) {
  const map = {
    idle: 'border-slate-500/20 bg-slate-500/10 text-slate-200',
    assigned: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
    active: 'border-green-500/20 bg-green-500/10 text-green-300',
    overloaded: 'border-orange-500/20 bg-orange-500/10 text-orange-300',
    blocked: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-300',
    recovering: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
    maintenance: 'border-purple-500/20 bg-purple-500/10 text-purple-300',
    quarantined: 'border-red-500/20 bg-red-500/10 text-red-300',
    offline: 'border-slate-600/20 bg-slate-600/10 text-slate-400',
  };
  return map[status] || map.idle;
}

export function getRiskTone(risk) {
  const map = {
    low: 'text-green-400',
    medium: 'text-yellow-400',
    high: 'text-orange-400',
    critical: 'text-red-400',
  };
  return map[risk] || map.low;
}

export function getTaskPriorityWeight(priority) {
  return { low: 1, medium: 2, high: 3, critical: 4 }[priority] || 1;
}

export function computeBotFit(bot, task) {
  let score = 50;
  if (bot.specialty === task.work_type) score += 25;
  score += Math.round((bot.efficiency || 0) * 0.12);
  score += Math.round((bot.integrity || 0) * 0.08);
  score -= Math.round((bot.fatigue || 0) * 0.15);
  score -= Math.round((bot.load || 0) * 0.12);
  if (bot.status === 'maintenance' || bot.status === 'quarantined' || bot.status === 'offline') score -= 40;
  return Math.max(0, Math.min(100, score));
}

export function computeOutputQuality(bot, task, managementBoost = 0) {
  const fit = computeBotFit(bot, task);
  const overloadPenalty = Math.max(0, (bot.load || 0) - 70) * 0.45;
  const fatiguePenalty = Math.max(0, (bot.fatigue || 0) - 45) * 0.35;
  const integrityPenalty = Math.max(0, 75 - (bot.integrity || 0)) * 0.4;
  return Math.max(20, Math.min(99, Math.round(fit + managementBoost - overloadPenalty - fatiguePenalty - integrityPenalty)));
}

export function summarizeFarmMetrics(bots, tasks, missions, risks, outputs) {
  const activeBots = bots.filter((bot) => bot.status === 'active').length;
  const idleBots = bots.filter((bot) => bot.status === 'idle').length;
  const overloadedBots = bots.filter((bot) => bot.status === 'overloaded').length;
  const maintenanceBots = bots.filter((bot) => bot.status === 'maintenance').length;
  const completedOutputs = outputs.reduce((sum, item) => sum + (item.value_score || 0), 0);
  const missionProgress = missions.length ? Math.round(missions.reduce((sum, mission) => sum + (mission.progress || 0), 0) / missions.length) : 0;
  const systemEfficiency = bots.length ? Math.round(bots.reduce((sum, bot) => sum + (bot.efficiency || 0) + (bot.coordination_efficiency || 0), 0) / (bots.length * 2)) : 0;
  return {
    total_bots: bots.length,
    active_bots: activeBots,
    idle_bots: idleBots,
    overloaded_bots: overloadedBots,
    maintenance_bots: maintenanceBots,
    output_rate: completedOutputs,
    mission_progress: missionProgress,
    system_efficiency: systemEfficiency,
    integrity_warning_count: bots.filter((bot) => (bot.integrity || 0) < 70).length,
    security_alert_count: risks.filter((risk) => risk.severity === 'critical').length,
    task_queue_depth: tasks.filter((task) => ['pending', 'assigned', 'active', 'blocked', 'review'].includes(task.status)).length,
  };
}

export function sortTasks(tasks, mode) {
  const sorted = [...tasks];
  sorted.sort((a, b) => {
    if (mode === 'priority') return getTaskPriorityWeight(b.priority) - getTaskPriorityWeight(a.priority);
    if (mode === 'urgency') return (b.urgency || 0) - (a.urgency || 0);
    if (mode === 'risk') return (b.risk || 0) - (a.risk || 0);
    if (mode === 'value') return (b.expected_output_value || 0) - (a.expected_output_value || 0);
    return (b.bot_fit_score || 0) - (a.bot_fit_score || 0);
  });
  return sorted;
}