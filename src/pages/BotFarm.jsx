import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import BotFarmHeader from '../components/bot-farm/BotFarmHeader';
import BotFarmMetricGrid from '../components/bot-farm/BotFarmMetricGrid';
import BotFarmBotCard from '../components/bot-farm/BotFarmBotCard';
import BotFarmQueuePanel from '../components/bot-farm/BotFarmQueuePanel';
import BotFarmSquadPanel from '../components/bot-farm/BotFarmSquadPanel';
import BotFarmOutputPanel from '../components/bot-farm/BotFarmOutputPanel';
import BotFarmUpgradePanel from '../components/bot-farm/BotFarmUpgradePanel';
import BotFarmControlPanel from '../components/bot-farm/BotFarmControlPanel';
import BotFarmMaintenancePanel from '../components/bot-farm/BotFarmMaintenancePanel';
import BotFarmMissionPanel from '../components/bot-farm/BotFarmMissionPanel';
import { buildRoleSummary, computeAssignmentQuality, computeBotFit, computeMissionSuccessProbability, computeOutputQuality, summarizeFarmMetrics } from '../components/bot-farm/BotFarmUtils';
import { DEMO_ACTIVITY, DEMO_BOTS, DEMO_MAINTENANCE, DEMO_MISSIONS, DEMO_OUTPUTS, DEMO_RISKS, DEMO_SQUADS, DEMO_TASKS, DEMO_UPGRADES } from '../components/bot-farm/BotFarmDemoData';

export default function BotFarm() {
  const [bots, setBots] = useState([]);
  const [squads, setSquads] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [missions, setMissions] = useState([]);
  const [outputs, setOutputs] = useState([]);
  const [risks, setRisks] = useState([]);
  const [upgrades, setUpgrades] = useState([]);
  const [history, setHistory] = useState([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState('priority');

  const loadAll = async () => {
    const [botRows, squadRows, taskRows, missionRows, outputRows, riskRows, upgradeRows, historyRows, maintenanceRows] = await Promise.all([
      base44.entities.BotFarmBot.list('-updated_date', 100),
      base44.entities.BotFarmSquad.list('-updated_date', 50),
      base44.entities.BotFarmTask.list('-updated_date', 100),
      base44.entities.BotFarmMission.list('-updated_date', 50),
      base44.entities.BotFarmOutputLog.list('-updated_date', 100),
      base44.entities.BotFarmRiskFlag.list('-updated_date', 100),
      base44.entities.BotFarmUpgrade.list('-updated_date', 30),
      base44.entities.BotFarmActivityHistory.list('-updated_date', 80),
      base44.entities.BotFarmMaintenanceLog.list('-updated_date', 80),
    ]);
    setBots(botRows || []);
    setSquads(squadRows || []);
    setTasks(taskRows || []);
    setMissions(missionRows || []);
    setOutputs(outputRows || []);
    setRisks(riskRows || []);
    setUpgrades(upgradeRows || []);
    setHistory(historyRows || []);
    setMaintenanceLogs(maintenanceRows || []);
    setLoading(false);
  };

  const seedIfNeeded = async () => {
    const existing = await base44.entities.BotFarmBot.list('-created_date', 1);
    if ((existing || []).length > 0) return;

    const createdSquads = await base44.entities.BotFarmSquad.bulkCreate(DEMO_SQUADS);
    const leaderSquad = createdSquads.find((item) => item.role_type === 'leader');
    const commanderSquads = createdSquads.filter((item) => item.role_type === 'commander');
    const securitySquad = createdSquads.find((item) => item.role_type === 'security');
    const taskSquads = createdSquads.filter((item) => item.role_type === 'task');

    const createdBots = await base44.entities.BotFarmBot.bulkCreate(
      DEMO_BOTS.map((bot, index) => {
        if (bot.role.includes('leader')) return { ...bot, squad_id: leaderSquad?.id };
        if (bot.role.includes('commander')) return { ...bot, squad_id: commanderSquads[index % Math.max(1, commanderSquads.length)]?.id };
        if (bot.role.includes('security')) return { ...bot, squad_id: securitySquad?.id };
        return { ...bot, squad_id: taskSquads[index % Math.max(1, taskSquads.length)]?.id };
      })
    );

    const leaderBot = createdBots.find((bot) => bot.role.includes('leader'));
    const commanderBots = createdBots.filter((bot) => bot.role.includes('commander'));
    const securityBots = createdBots.filter((bot) => bot.role.includes('security'));

    const createdMissions = await base44.entities.BotFarmMission.bulkCreate(
      DEMO_MISSIONS.map((mission, index) => ({
        ...mission,
        leader_bot_id: leaderBot?.id,
        commander_bot_ids: commanderBots.map((bot) => bot.id),
        security_bot_ids: securityBots.map((bot) => bot.id),
        assigned_squad_ids: createdSquads.filter((squad) => squad.role_type !== 'leader').slice(0, index === 0 ? 4 : 3).map((squad) => squad.id),
      }))
    );

    const createdTasks = await base44.entities.BotFarmTask.bulkCreate(
      DEMO_TASKS.map((task, index) => ({
        ...task,
        mission_id: createdMissions[index % createdMissions.length]?.id,
        assigned_squad_id: taskSquads[index % Math.max(1, taskSquads.length)]?.id,
        assigned_commander_bot_id: commanderBots[index % Math.max(1, commanderBots.length)]?.id,
      }))
    );

    await Promise.all([
      base44.entities.BotFarmOutputLog.bulkCreate(DEMO_OUTPUTS.map((item, index) => ({
        ...item,
        bot_id: createdBots[(index + 5) % createdBots.length]?.id,
        task_id: createdTasks[index % createdTasks.length]?.id,
        mission_id: createdMissions[index % createdMissions.length]?.id,
        squad_id: taskSquads[index % Math.max(1, taskSquads.length)]?.id,
      }))),
      base44.entities.BotFarmRiskFlag.bulkCreate(DEMO_RISKS.map((item, index) => ({
        ...item,
        bot_id: createdBots[(index + 2) % createdBots.length]?.id,
        task_id: createdTasks[index % createdTasks.length]?.id,
        mission_id: createdMissions[index % createdMissions.length]?.id,
        squad_id: taskSquads[index % Math.max(1, taskSquads.length)]?.id,
      }))),
      base44.entities.BotFarmUpgrade.bulkCreate(DEMO_UPGRADES),
      base44.entities.BotFarmActivityHistory.bulkCreate(DEMO_ACTIVITY),
      base44.entities.BotFarmMaintenanceLog.bulkCreate(DEMO_MAINTENANCE.map((item, index) => ({
        ...item,
        bot_id: createdBots.filter((bot) => ['maintenance', 'overloaded'].includes(bot.status))[index % 2]?.id || createdBots[0]?.id,
      }))),
    ]);
  };

  useEffect(() => {
    seedIfNeeded().then(loadAll);
  }, []);

  const roleSummary = useMemo(() => buildRoleSummary(bots), [bots]);
  const metrics = useMemo(() => summarizeFarmMetrics(bots, tasks, missions, risks, outputs, squads, upgrades), [bots, tasks, missions, risks, outputs, squads, upgrades]);

  const findSquadForBot = (bot) => squads.find((squad) => squad.id === bot.squad_id);
  const getUpgradeEffect = () => upgrades.reduce((sum, item) => sum + (item.effect_value || 0) * (item.level || 1), 0) / Math.max(1, upgrades.length || 1);
  const getCommanderBoost = (task) => {
    const commander = bots.find((bot) => bot.id === task.assigned_commander_bot_id);
    return commander ? Math.round(((commander.coordination_efficiency || 0) + (commander.confidence || 0)) / 20) : 0;
  };

  const assignTaskToBot = async (task, botOverride) => {
    const candidateBots = (botOverride ? [botOverride] : roleSummary.taskBots)
      .filter((bot) => !['maintenance', 'quarantined', 'offline'].includes(bot.status));

    const ranked = candidateBots
      .map((bot) => {
        const squad = findSquadForBot(bot);
        return {
          bot,
          squad,
          fit: computeBotFit(bot, task, squad),
          assignmentQuality: computeAssignmentQuality(bot, task, squad, getCommanderBoost(task)),
        };
      })
      .sort((a, b) => b.fit - a.fit);

    const chosen = ranked[0];
    if (!chosen) return;

    const nextLoad = Math.min(100, (chosen.bot.load || 0) + (task.estimated_load || 15));
    const nextFatigue = Math.min(100, (chosen.bot.fatigue || 0) + Math.max(10, Math.round((task.estimated_load || 15) * 0.55)));
    const nextStatus = nextLoad > 82 || nextFatigue > 76 ? 'overloaded' : 'active';
    const nextRisk = chosen.bot.integrity < 72 || chosen.assignmentQuality < 62 || nextStatus === 'overloaded' ? 'medium' : chosen.bot.risk_level;

    await Promise.all([
      base44.entities.BotFarmTask.update(task.id, {
        assigned_bot_id: chosen.bot.id,
        assigned_squad_id: chosen.squad?.id,
        status: 'assigned',
        bot_fit_score: chosen.fit,
        progress: task.status === 'pending' ? 10 : task.progress,
      }),
      base44.entities.BotFarmBot.update(chosen.bot.id, {
        assigned_task_id: task.id,
        assigned_task_name: task.title,
        load: nextLoad,
        fatigue: nextFatigue,
        status: nextStatus,
        risk_level: nextRisk,
      }),
      chosen.squad ? base44.entities.BotFarmSquad.update(chosen.squad.id, {
        current_load: Math.min(100, (chosen.squad.current_load || 0) + Math.round((task.estimated_load || 15) * 0.7)),
        status: (chosen.squad.current_load || 0) > ((chosen.squad.capacity_limit || 100) * 0.78) ? 'strained' : 'active',
      }) : Promise.resolve(),
      base44.entities.BotFarmActivityHistory.create({
        actor_type: 'bot',
        actor_id: chosen.bot.id,
        event_type: 'task_assigned',
        summary: `${chosen.bot.name} assigned to ${task.title} with fit ${chosen.fit}.`,
        impact_score: chosen.fit,
      }),
    ]);

    if (chosen.assignmentQuality < 60) {
      await base44.entities.BotFarmRiskFlag.create({
        bot_id: chosen.bot.id,
        task_id: task.id,
        mission_id: task.mission_id,
        squad_id: chosen.squad?.id,
        flag_type: 'poor_assignment',
        severity: 'warning',
        status: 'open',
        details: `${chosen.bot.name} was assigned below ideal specialty/coordination fit.`
      });
    }

    await loadAll();
  };

  const handleRest = async (bot) => {
    await Promise.all([
      base44.entities.BotFarmBot.update(bot.id, {
        fatigue: Math.max(0, (bot.fatigue || 0) - 28),
        load: Math.max(0, (bot.load || 0) - 18),
        status: 'recovering',
        maintenance_status: 'healthy',
      }),
      base44.entities.BotFarmMaintenanceLog.create({
        bot_id: bot.id,
        maintenance_type: 'rest',
        status: 'complete',
        impact: 'Fatigue reduced and operating headroom restored.',
        recovery_gain: 28,
      })
    ]);
    await loadAll();
  };

  const handleRepair = async (bot) => {
    await Promise.all([
      base44.entities.BotFarmBot.update(bot.id, {
        integrity: Math.min(100, (bot.integrity || 0) + 18),
        system_health: Math.min(100, (bot.system_health || 0) + 16),
        maintenance_status: 'recalibrating',
        status: 'maintenance',
      }),
      base44.entities.BotFarmMaintenanceLog.create({
        bot_id: bot.id,
        maintenance_type: 'repair',
        status: 'in_progress',
        impact: 'Repair cycle started to restore integrity and system health.',
        recovery_gain: 18,
      })
    ]);
    await loadAll();
  };

  const handleRecover = async (bot) => {
    await Promise.all([
      base44.entities.BotFarmBot.update(bot.id, {
        fatigue: Math.max(0, (bot.fatigue || 0) - 12),
        load: Math.max(0, (bot.load || 0) - 10),
        integrity: Math.min(100, (bot.integrity || 0) + 8),
        status: 'idle',
        maintenance_status: 'healthy',
        communication_status: 'clear',
      }),
      base44.entities.BotFarmMaintenanceLog.create({
        bot_id: bot.id,
        maintenance_type: 'recalibration',
        status: 'complete',
        impact: 'Bot recovered to idle-ready state.',
        recovery_gain: 12,
      })
    ]);
    await loadAll();
  };

  const handleQuarantine = async (bot) => {
    await Promise.all([
      base44.entities.BotFarmBot.update(bot.id, {
        status: 'quarantined',
        communication_status: 'offline',
        risk_level: 'critical',
      }),
      base44.entities.BotFarmRiskFlag.create({
        bot_id: bot.id,
        flag_type: 'security_issue',
        severity: 'critical',
        status: 'open',
        details: `${bot.name} was quarantined due to operational risk.`
      })
    ]);
    await loadAll();
  };

  const handleUpgrade = async (upgrade) => {
    await Promise.all([
      base44.entities.BotFarmUpgrade.update(upgrade.id, {
        level: (upgrade.level || 1) + 1,
        effect_value: (upgrade.effect_value || 0) + 4,
        complexity_cost: (upgrade.complexity_cost || 0) + 1,
      }),
      base44.entities.BotFarmActivityHistory.create({
        actor_type: 'system',
        event_type: 'upgrade_expanded',
        summary: `${upgrade.name} advanced to level ${(upgrade.level || 1) + 1}, increasing both capacity and management complexity.`,
        impact_score: (upgrade.effect_value || 0) + 4,
      })
    ]);
    await loadAll();
  };

  const runOperationalCycle = async () => {
    const upgradeEffect = getUpgradeEffect();
    const actionableTasks = tasks.filter((task) => ['assigned', 'active', 'review'].includes(task.status) && task.assigned_bot_id);

    await Promise.all(actionableTasks.map(async (task) => {
      const bot = bots.find((item) => item.id === task.assigned_bot_id);
      const squad = squads.find((item) => item.id === task.assigned_squad_id || item.id === bot?.squad_id);
      if (!bot) return;

      const commanderBoost = getCommanderBoost(task);
      const quality = computeOutputQuality(bot, task, squad, upgradeEffect, commanderBoost);
      const assignmentQuality = computeAssignmentQuality(bot, task, squad, commanderBoost);
      const loadPenalty = Math.max(0, (bot.load || 0) - 65);
      const coordinationPenalty = Math.max(0, (task.coordination_cost || 0) + (squad?.coordination_overhead || 0) - 12);
      const nextProgress = Math.min(100, (task.progress || 0) + Math.max(8, Math.round((quality - coordinationPenalty) * 0.12)));
      const nextStatus = nextProgress >= 100 ? 'complete' : quality < 50 ? 'blocked' : 'active';

      await Promise.all([
        base44.entities.BotFarmTask.update(task.id, {
          actual_quality: quality,
          progress: nextProgress,
          status: nextStatus,
          blocked_reason: nextStatus === 'blocked' ? 'Low effective output quality under current load/coordination state.' : undefined,
        }),
        base44.entities.BotFarmBot.update(bot.id, {
          fatigue: Math.min(100, (bot.fatigue || 0) + 6),
          load: Math.min(100, (bot.load || 0) + 4),
          output_quality: quality,
          status: quality < 45 ? 'overloaded' : bot.status === 'recovering' ? 'idle' : bot.status,
        }),
        base44.entities.BotFarmOutputLog.create({
          bot_id: bot.id,
          task_id: task.id,
          mission_id: task.mission_id,
          squad_id: squad?.id,
          output_type: nextStatus === 'complete' ? 'report' : 'mission_progress',
          assignment_quality: assignmentQuality,
          specialization_fit: computeBotFit(bot, task, squad),
          load_penalty: loadPenalty,
          coordination_penalty: coordinationPenalty,
          quality_score: quality,
          value_score: Math.max(20, Math.round((task.expected_output_value || 50) * (quality / 100))),
          summary: `${bot.name} advanced ${task.title} to ${nextProgress}% with output quality ${quality}.`,
        }),
      ]);

      if (quality < 52 || bot.integrity < 70 || bot.status === 'quarantined') {
        await base44.entities.BotFarmRiskFlag.create({
          bot_id: bot.id,
          task_id: task.id,
          mission_id: task.mission_id,
          squad_id: squad?.id,
          flag_type: quality < 52 ? 'overload' : 'integrity_drop',
          severity: quality < 45 ? 'critical' : 'warning',
          status: 'open',
          details: `${bot.name} is degrading output quality under current operational conditions.`,
        });
      }
    }));

    const refreshedOutputs = await base44.entities.BotFarmOutputLog.list('-created_date', 100);
    const refreshedRisks = await base44.entities.BotFarmRiskFlag.list('-created_date', 100);
    const refreshedTasks = await base44.entities.BotFarmTask.list('-updated_date', 100);

    await Promise.all(missions.map(async (mission) => {
      const missionOutputs = refreshedOutputs.filter((item) => item.mission_id === mission.id);
      const missionRisks = refreshedRisks.filter((item) => item.mission_id === mission.id && item.status !== 'resolved');
      const missionSquads = squads.filter((squad) => (mission.assigned_squad_ids || []).includes(squad.id));
      const missionTasks = refreshedTasks.filter((task) => task.mission_id === mission.id);
      const actualOutputQuality = missionOutputs.length ? Math.round(missionOutputs.reduce((sum, item) => sum + (item.quality_score || 0), 0) / missionOutputs.length) : mission.actual_output_quality;
      const progress = missionTasks.length ? Math.round(missionTasks.reduce((sum, item) => sum + (item.progress || 0), 0) / missionTasks.length) : mission.progress;
      const successProbability = computeMissionSuccessProbability(mission, missionSquads, missionOutputs, missionRisks);

      await base44.entities.BotFarmMission.update(mission.id, {
        actual_output_quality: actualOutputQuality,
        progress,
        success_probability: successProbability,
        status: progress >= 100 ? 'complete' : successProbability < 45 ? 'blocked' : 'active',
      });
    }));

    await base44.entities.BotFarmActivityHistory.create({
      actor_type: 'farm',
      event_type: 'operational_cycle',
      summary: 'A full operational cycle recalculated assignment quality, output quality, and mission health.',
      impact_score: metrics.average_output_quality || 0,
    });

    await loadAll();
  };

  return (
    <div className="min-h-screen bg-background px-4 py-4 md:px-6 md:py-6 pb-24">
      <div className="mx-auto max-w-7xl space-y-4">
        <BotFarmHeader metrics={metrics} />
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <>
            <BotFarmMetricGrid metrics={metrics} />

            <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
              <BotFarmControlPanel roleSummary={roleSummary} metrics={metrics} onRunCycle={runOperationalCycle} />
              <BotFarmUpgradePanel upgrades={upgrades} onUpgrade={handleUpgrade} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
              <BotFarmQueuePanel tasks={tasks} sortMode={sortMode} setSortMode={setSortMode} onAssignTask={assignTaskToBot} />
              <BotFarmMaintenancePanel bots={bots} maintenanceLogs={maintenanceLogs} onRest={handleRest} onRepair={handleRepair} onRecover={handleRecover} />
            </div>

            <BotFarmMissionPanel missions={missions} squads={squads} bots={bots} />
            <BotFarmSquadPanel squads={squads} bots={bots} missions={missions} />

            <section className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Operational Workforce</p>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {bots.map((bot) => (
                  <BotFarmBotCard
                    key={bot.id}
                    bot={bot}
                    onAssign={(selectedBot) => {
                      const pendingTask = tasks.find((task) => task.status === 'pending');
                      if (pendingTask) assignTaskToBot(pendingTask, selectedBot);
                    }}
                    onRest={handleRest}
                    onRepair={handleRepair}
                    onQuarantine={handleQuarantine}
                  />
                ))}
              </div>
            </section>

            <BotFarmOutputPanel outputs={outputs.slice(0, 8)} risks={risks.slice(0, 6)} history={history.slice(0, 6)} />
          </>
        )}
      </div>
    </div>
  );
}