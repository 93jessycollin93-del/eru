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
    strained: 'border-orange-500/20 bg-orange-500/10 text-orange-300',
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

export function getRoleBand(bot) {
  if (bot.role?.includes('leader')) return 'leader';
  if (bot.role?.includes('commander')) return 'commander';
  if (bot.role?.includes('security')) return 'security';
  return 'task';
}

export function computeBotFit(bot, task, squad) {
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
  if (bot.status === 'maintenance' || bot.status === 'quarantined' || bot.status === 'offline') score -= 55;
  if (bot.status === 'overloaded') score -= 18;
  return Math.max(0, Math.min(100, score));
}

export function computeAssignmentQuality(bot, task, squad, commanderBoost = 0) {
  const fit = computeBotFit(bot, task, squad);
  const squadBonus = squad ? Math.round((squad.coordination_quality || 0) * 0.1) : 0;
  const commanderEffect = Math.round(commanderBoost * 0.8);
  return Math.max(10, Math.min(100, fit + squadBonus + commanderEffect));
}

export function computeOutputQuality(bot, task, squad, upgradeEffect = 0, commanderBoost = 0) {
  const assignmentQuality = computeAssignmentQuality(bot, task, squad, commanderBoost);
  const overloadPenalty = Math.max(0, (bot.load || 0) - 70) * 0.55;
  const fatiguePenalty = Math.max(0, (bot.fatigue || 0) - 45) * 0.45;
  const integrityPenalty = Math.max(0, 78 - (bot.integrity || 0)) * 0.45;
  const coordinationPenalty = Math.max(0, (task.coordination_cost || 0) + (squad?.coordination_overhead || 0) - ((bot.coordination_efficiency || 0) * 0.18));
  const upgradeBoost = Math.round(upgradeEffect * 0.9);
  return Math.max(12, Math.min(99, Math.round(assignmentQuality + upgradeBoost - overloadPenalty - fatiguePenalty - integrityPenalty - coordinationPenalty)));
}

export function computeMissionSuccessProbability(mission, squads, outputs, risks) {
  const squadStrength = squads.length ? squads.reduce((sum, squad) => sum + (squad.throughput_score || 0) + (squad.reliability_score || 0), 0) / (squads.length * 2) : 60;
  const outputStrength = outputs.length ? outputs.reduce((sum, item) => sum + (item.quality_score || 0), 0) / outputs.length : 65;
  const riskPenalty = risks.length ? risks.reduce((sum, risk) => sum + (risk.severity === 'critical' ? 14 : risk.severity === 'warning' ? 7 : 3), 0) / Math.max(1, risks.length) : 0;
  const complexityPenalty = (mission?.coordination_complexity || 0) * 0.28;
  const securityPenalty = (mission?.security_pressure || 0) * 0.18;
  return Math.max(10, Math.min(98, Math.round(squadStrength * 0.45 + outputStrength * 0.4 + 22 - riskPenalty - complexityPenalty - securityPenalty)));
}

export function summarizeFarmMetrics(bots, tasks, missions, risks, outputs, squads, upgrades) {
  const activeBots = bots.filter((bot) => bot.status === 'active').length;
  const idleBots = bots.filter((bot) => bot.status === 'idle').length;
  const overloadedBots = bots.filter((bot) => bot.status === 'overloaded').length;
  const maintenanceBots = bots.filter((bot) => bot.status === 'maintenance').length;
  const averageQuality = outputs.length ? Math.round(outputs.reduce((sum, item) => sum + (item.quality_score || 0), 0) / outputs.length) : 0;
  const missionProgress = missions.length ? Math.round(missions.reduce((sum, mission) => sum + (mission.progress || 0), 0) / missions.length) : 0;
  const systemEfficiency = bots.length ? Math.round(bots.reduce((sum, bot) => sum + (bot.efficiency || 0) + (bot.coordination_efficiency || 0) - ((bot.fatigue || 0) * 0.2), 0) / (bots.length * 2)) : 0;
  const queueDepth = tasks.filter((task) => ['pending', 'assigned', 'active', 'blocked', 'review'].includes(task.status)).length;
  const usedCapacity = bots.reduce((sum, bot) => sum + (bot.load || 0), 0);
  const totalCapacity = bots.reduce((sum, bot) => sum + ((bot.max_concurrent_tasks || 1) * 50), 0);
  const farmCapacity = totalCapacity ? Math.round((usedCapacity / totalCapacity) * 100) : 0;
  const complexityLoad = upgrades.reduce((sum, item) => sum + (item.complexity_cost || 0) * (item.level || 1), 0);
  const squadReliability = squads.length ? Math.round(squads.reduce((sum, squad) => sum + (squad.reliability_score || 0), 0) / squads.length) : 0;
  return {
    total_bots: bots.length,
    active_bots: activeBots,
    idle_bots: idleBots,
    overloaded_bots: overloadedBots,
    maintenance_bots: maintenanceBots,
    output_rate: outputs.reduce((sum, item) => sum + (item.value_score || 0), 0),
    mission_progress: missionProgress,
    system_efficiency: Math.max(0, systemEfficiency - Math.round(complexityLoad * 0.6)),
    integrity_warning_count: bots.filter((bot) => (bot.integrity || 0) < 70).length,
    security_alert_count: risks.filter((risk) => risk.severity === 'critical').length,
    task_queue_depth: queueDepth,
    average_output_quality: averageQuality,
    capacity_usage: farmCapacity,
    squad_reliability: squadReliability,
    management_tradeoff: complexityLoad,
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

export function buildRoleSummary(bots) {
  return {
    leader: bots.filter((bot) => getRoleBand(bot) === 'leader'),
    commanders: bots.filter((bot) => getRoleBand(bot) === 'commander'),
    taskBots: bots.filter((bot) => getRoleBand(bot) === 'task'),
    security: bots.filter((bot) => getRoleBand(bot) === 'security'),
  };
}