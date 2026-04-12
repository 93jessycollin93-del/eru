import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import BotFarmHeader from '../components/bot-farm/BotFarmHeader';
import BotFarmMetricGrid from '../components/bot-farm/BotFarmMetricGrid';
import BotFarmBotCard from '../components/bot-farm/BotFarmBotCard';
import BotFarmQueuePanel from '../components/bot-farm/BotFarmQueuePanel';
import BotFarmSquadPanel from '../components/bot-farm/BotFarmSquadPanel';
import BotFarmUpgradePanel from '../components/bot-farm/BotFarmUpgradePanel';
import BotFarmOutputPanel from '../components/bot-farm/BotFarmOutputPanel';
import BotFarmAssignmentPanel from '../components/bot-farm/BotFarmAssignmentPanel';
import BotFarmMaintenancePanel from '../components/bot-farm/BotFarmMaintenancePanel';
import BotFarmIntegrityPanel from '../components/bot-farm/BotFarmIntegrityPanel';
import BotFarmLeaderPanel from '../components/bot-farm/BotFarmLeaderPanel';
import { createFarmSeed } from '../components/bot-farm/BotFarmSeedFactory';
import { computeOutputScores, deriveTaskStatus, evaluateSquadReliability, summarizeOperationalMetrics } from '../components/bot-farm/BotFarmEngine';
import { sortTasks } from '../components/bot-farm/BotFarmUtils';

export default function BotFarm() {
  const [bots, setBots] = useState([]);
  const [squads, setSquads] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [missions, setMissions] = useState([]);
  const [outputs, setOutputs] = useState([]);
  const [risks, setRisks] = useState([]);
  const [upgrades, setUpgrades] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState('priority');
  const [selectedMissionId, setSelectedMissionId] = useState('');

  const loadAll = async () => {
    const [botRows, squadRows, taskRows, missionRows, outputRows, riskRows, upgradeRows, historyRows] = await Promise.all([
      base44.entities.BotFarmBot.list('-updated_date', 100),
      base44.entities.BotFarmSquad.list('-updated_date', 50),
      base44.entities.BotFarmTask.list('-updated_date', 100),
      base44.entities.BotFarmMission.list('-updated_date', 50),
      base44.entities.BotFarmOutputLog.list('-updated_date', 100),
      base44.entities.BotFarmRiskFlag.list('-updated_date', 100),
      base44.entities.BotFarmUpgrade.list('-updated_date', 30),
      base44.entities.BotFarmActivityHistory.list('-updated_date', 100),
    ]);
    setBots(botRows || []);
    setSquads(squadRows || []);
    setTasks(taskRows || []);
    setMissions(missionRows || []);
    setOutputs(outputRows || []);
    setRisks(riskRows || []);
    setUpgrades(upgradeRows || []);
    setHistory(historyRows || []);
    setSelectedMissionId((current) => current || missionRows?.[0]?.id || '');
    setLoading(false);
  };

  const seedIfNeeded = async () => {
    const existing = await base44.entities.BotFarmBot.list('-created_date', 1);
    if ((existing || []).length > 0) return;

    const seed = createFarmSeed();
    const createdMissions = await base44.entities.BotFarmMission.bulkCreate(seed.missions);
    const createdSquads = await base44.entities.BotFarmSquad.bulkCreate(seed.squads.map((squad, index) => ({
      ...squad,
      current_mission_id: createdMissions[index % createdMissions.length]?.id,
    })));

    const createdBots = await base44.entities.BotFarmBot.bulkCreate([
      { ...seed.leader, squad_id: null },
      ...seed.commanders.map((bot, index) => ({ ...bot, squad_id: createdSquads[index]?.id })),
      ...seed.securityBots.map((bot) => ({ ...bot, squad_id: createdSquads[0]?.id })),
      ...seed.taskBots.map((bot, index) => ({ ...bot, squad_id: createdSquads[index < 10 ? 0 : 1]?.id })),
    ]);

    const leader = createdBots.find((bot) => bot.role_type === 'leader');
    const commanders = createdBots.filter((bot) => bot.role_type === 'commander');
    const securityBots = createdBots.filter((bot) => bot.role_type === 'security');
    const taskBots = createdBots.filter((bot) => bot.role_type === 'task');

    await Promise.all(createdSquads.map((squad, index) => {
      const commander = commanders[index];
      const memberBots = taskBots.filter((bot) => bot.squad_id === squad.id);
      const security = securityBots[index % securityBots.length];
      return base44.entities.BotFarmSquad.update(squad.id, {
        leader_bot_id: leader?.id,
        commander_bot_id: commander?.id,
        security_bot_ids: security ? [security.id] : [],
        member_bot_ids: memberBots.map((bot) => bot.id),
      });
    }));

    const createdTasks = await base44.entities.BotFarmTask.bulkCreate(seed.tasks.map((task, index) => ({
      ...task,
      mission_id: createdMissions[index % createdMissions.length]?.id,
      assigned_squad_id: createdSquads[index < 8 ? 0 : 1]?.id,
    })));

    await Promise.all([
      base44.entities.BotFarmUpgrade.bulkCreate(seed.upgrades),
      base44.entities.BotFarmActivityHistory.bulkCreate(seed.history),
      base44.entities.BotFarmRiskFlag.bulkCreate([
        {
          flag_type: 'integrity_drop',
          severity: 'warning',
          status: 'open',
          bot_id: taskBots[2]?.id,
          mission_id: createdMissions[0]?.id,
          details: 'Task bot integrity drift detected after repeated load spikes.'
        },
        {
          flag_type: 'contradiction',
          severity: 'critical',
          status: 'open',
          bot_id: taskBots[5]?.id,
          mission_id: createdMissions[0]?.id,
          details: 'Contradiction risk increased due to weak assignment quality and queue stress.'
        }
      ])
    ]);

    await Promise.all(createdTasks.slice(0, 6).map((task, index) => {
      const bot = taskBots[index];
      if (!bot) return Promise.resolve();
      return Promise.all([
        base44.entities.BotFarmTask.update(task.id, {
          assigned_bot_id: bot.id,
          status: 'assigned',
          progress: task.progress || 8,
        }),
        base44.entities.BotFarmBot.update(bot.id, {
          assigned_task_id: task.id,
          assigned_task_name: task.title,
          status: 'assigned',
          load: Math.min(100, (bot.load || 0) + (task.estimated_load || 15)),
        })
      ]);
    }));
  };

  useEffect(() => {
    seedIfNeeded().then(loadAll);
  }, []);

  const leader = useMemo(() => bots.find((bot) => bot.role_type === 'leader'), [bots]);
  const commanders = useMemo(() => bots.filter((bot) => bot.role_type === 'commander'), [bots]);
  const taskBots = useMemo(() => bots.filter((bot) => bot.role_type === 'task'), [bots]);
  const botsNeedingAttention = useMemo(() => bots.filter((bot) => (bot.fatigue || 0) > 60 || (bot.integrity || 100) < 70 || ['maintenance', 'overloaded', 'recovering'].includes(bot.status)).slice(0, 8), [bots]);

  const metrics = useMemo(() => summarizeOperationalMetrics({ bots, squads, tasks, missions, risks, outputs, upgrades }), [bots, squads, tasks, missions, risks, outputs, upgrades]);

  const squadReliability = useMemo(() => Object.fromEntries(squads.map((squad) => {
    const squadBots = bots.filter((bot) => (squad.member_bot_ids || []).includes(bot.id));
    const squadRisks = risks.filter((risk) => risk.mission_id === squad.current_mission_id && risk.status !== 'resolved');
    return [squad.id, evaluateSquadReliability(squadBots, squad, squadRisks)];
  })), [squads, bots, risks]);

  const assignTaskToBot = async (task, forcedBot) => {
    const mission = missions.find((item) => item.id === task.mission_id) || missions[0];
    const candidateBots = forcedBot ? [forcedBot] : taskBots.filter((bot) => !['maintenance', 'quarantined', 'offline'].includes(bot.status));
    const ranked = candidateBots
      .map((bot) => {
        const squad = squads.find((item) => item.id === bot.squad_id);
        const commander = commanders.find((item) => item.id === squad?.commander_bot_id || item.bot_id === bot.commander_code);
        const scores = computeOutputScores({ bot, task, squad, mission, commander, leader, upgrades });
        return { bot, squad, commander, ...scores };
      })
      .sort((a, b) => (b.quality + b.value + b.fit) - (a.quality + a.value + a.fit));

    const chosen = ranked[0];
    if (!chosen) return;

    const nextLoad = Math.min(100, (chosen.bot.load || 0) + (task.estimated_load || 15));
    const nextFatigue = Math.min(100, (chosen.bot.fatigue || 0) + Math.max(7, Math.round((task.estimated_load || 15) * 0.55)));
    const nextIntegrity = Math.max(35, (chosen.bot.integrity || 100) - Math.max(0, Math.round((chosen.contradictionRisk - 40) * 0.08)));
    const nextProgress = Math.min(100, (task.progress || 0) + Math.max(14, Math.round(chosen.quality * 0.22)));
    const nextStatus = nextLoad > 84 || nextFatigue > 78 ? 'overloaded' : nextProgress >= 100 ? 'idle' : 'active';
    const taskStatus = deriveTaskStatus(nextProgress);

    const updates = [
      base44.entities.BotFarmTask.update(task.id, {
        assigned_bot_id: chosen.bot.id,
        assigned_squad_id: chosen.squad?.id,
        mission_id: mission?.id,
        status: taskStatus,
        bot_fit_score: chosen.fit,
        progress: nextProgress,
      }),
      base44.entities.BotFarmBot.update(chosen.bot.id, {
        assigned_task_id: task.id,
        assigned_task_name: task.title,
        load: nextLoad,
        fatigue: nextFatigue,
        integrity: nextIntegrity,
        status: nextStatus,
        output_quality: chosen.quality,
        risk_level: chosen.contradictionRisk > 74 ? 'high' : chosen.contradictionRisk > 52 ? 'medium' : 'low',
      }),
      base44.entities.BotFarmOutputLog.create({
        bot_id: chosen.bot.id,
        task_id: task.id,
        mission_id: mission?.id,
        output_type: chosen.contradictionRisk > 70 ? 'alert' : 'processed_intelligence',
        quality_score: chosen.quality,
        value_score: chosen.value,
        specialization_fit_score: chosen.fit,
        coordination_penalty: chosen.coordinationPenalty,
        management_boost: chosen.managementBoost,
        contradiction_risk: chosen.contradictionRisk,
        summary: `${chosen.bot.name} processed ${task.title} with fit ${chosen.fit}, coordination cost ${chosen.coordinationPenalty}, and output quality ${chosen.quality}.`,
      }),
      base44.entities.BotFarmActivityHistory.create({
        actor_type: 'bot',
        actor_id: chosen.bot.id,
        event_type: 'task_executed',
        summary: `${chosen.bot.name} executed ${task.title} with quality ${chosen.quality}.`,
        impact_score: chosen.value,
      })
    ];

    if (chosen.contradictionRisk > 68 || nextIntegrity < 68) {
      updates.push(base44.entities.BotFarmRiskFlag.create({
        bot_id: chosen.bot.id,
        task_id: task.id,
        mission_id: mission?.id,
        flag_type: chosen.contradictionRisk > 68 ? 'contradiction' : 'integrity_drop',
        severity: chosen.contradictionRisk > 84 || nextIntegrity < 58 ? 'critical' : 'warning',
        status: 'open',
        details: `${chosen.bot.name} triggered elevated operational risk during ${task.title}.`,
      }));
    }

    if (chosen.squad) {
      updates.push(base44.entities.BotFarmSquad.update(chosen.squad.id, {
        status: nextStatus === 'overloaded' ? 'strained' : 'active',
        throughput_score: Math.max(30, Math.min(100, Math.round((chosen.squad.throughput_score || 72) + (chosen.quality * 0.06) - (chosen.coordinationPenalty * 0.08)))),
      }));
    }

    await Promise.all(updates);
    await loadAll();
  };

  const assignSquadToMission = async (squad, commander) => {
    const mission = missions.find((item) => item.id === selectedMissionId) || missions[0];
    if (!mission) return;

    const squadBots = taskBots.filter((bot) => (squad.member_bot_ids || []).includes(bot.id));
    const targetTasks = sortTasks(tasks.filter((task) => !task.assigned_squad_id || task.assigned_squad_id === squad.id), 'priority').slice(0, squadBots.length);

    await Promise.all([
      base44.entities.BotFarmSquad.update(squad.id, {
        current_mission_id: mission.id,
        commander_bot_id: commander?.id,
        status: 'assigned',
      }),
      base44.entities.BotFarmMission.update(mission.id, {
        assigned_squad_ids: Array.from(new Set([...(mission.assigned_squad_ids || []), squad.id])),
        status: 'active',
      }),
      base44.entities.BotFarmActivityHistory.create({
        actor_type: 'squad',
        actor_id: squad.id,
        event_type: 'mission_assignment',
        summary: `${squad.name} assigned to ${mission.title}${commander ? ` under ${commander.name}` : ''}.`,
        impact_score: squad.throughput_score || 70,
      })
    ]);

    await Promise.all(targetTasks.map((task, index) => {
      const bot = squadBots[index];
      if (!bot) return Promise.resolve();
      return assignTaskToBot(task, bot);
    }));

    await loadAll();
  };

  const handleRecover = async (bot) => {
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
        impact: 'Recovery cycle reduced fatigue and freed capacity.',
        recovery_gain: 28,
      })
    ]);
    await loadAll();
  };

  const handleRepair = async (bot) => {
    await Promise.all([
      base44.entities.BotFarmBot.update(bot.id, {
        integrity: Math.min(100, (bot.integrity || 0) + 20),
        system_health: Math.min(100, (bot.system_health || 0) + 16),
        fatigue: Math.max(0, (bot.fatigue || 0) - 12),
        status: 'maintenance',
        maintenance_status: 'recalibrating',
      }),
      base44.entities.BotFarmMaintenanceLog.create({
        bot_id: bot.id,
        maintenance_type: 'repair',
        status: 'in_progress',
        impact: 'Repair and recalibration cycle restoring bot integrity.',
        recovery_gain: 20,
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
        details: `${bot.name} was quarantined due to operational instability.`,
      })
    ]);
    await loadAll();
  };

  const handleUpgrade = async (upgrade) => {
    await Promise.all([
      base44.entities.BotFarmUpgrade.update(upgrade.id, {
        level: (upgrade.level || 1) + 1,
        effect_value: (upgrade.effect_value || 0) + 4,
      }),
      base44.entities.BotFarmActivityHistory.create({
        actor_type: 'system',
        event_type: 'upgrade_expanded',
        summary: `${upgrade.name} advanced to level ${(upgrade.level || 1) + 1}.`,
        impact_score: (upgrade.effect_value || 0) + 4,
      })
    ]);
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

            <div className="grid gap-4 xl:grid-cols-[1.05fr,0.95fr]">
              <BotFarmLeaderPanel metrics={metrics} />
              <BotFarmAssignmentPanel
                missions={missions}
                squads={squads}
                commanders={commanders}
                selectedMissionId={selectedMissionId}
                setSelectedMissionId={setSelectedMissionId}
                onAssignSquad={assignSquadToMission}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
              <BotFarmQueuePanel tasks={tasks} sortMode={sortMode} setSortMode={setSortMode} onAssignTask={assignTaskToBot} />
              <BotFarmUpgradePanel upgrades={upgrades} onUpgrade={handleUpgrade} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr,1fr]">
              <BotFarmSquadPanel squads={squads} bots={bots} missions={missions} />
              <BotFarmIntegrityPanel squads={squads} squadReliability={squadReliability} risks={risks} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[0.95fr,1.05fr]">
              <BotFarmMaintenancePanel botsNeedingAttention={botsNeedingAttention} onRecover={handleRecover} onRepair={handleRepair} onQuarantine={handleQuarantine} />
              <section className="space-y-3">
                <p className="text-sm font-semibold text-foreground">Bot Workforce</p>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
                  {bots.map((bot) => (
                    <BotFarmBotCard
                      key={bot.id}
                      bot={bot}
                      onAssign={(selectedBot) => {
                        const pendingTask = sortTasks(tasks.filter((task) => task.status === 'pending'), 'priority')[0];
                        if (pendingTask) assignTaskToBot(pendingTask, selectedBot);
                      }}
                      onRest={handleRecover}
                      onRepair={handleRepair}
                      onQuarantine={handleQuarantine}
                    />
                  ))}
                </div>
              </section>
            </div>

            <BotFarmOutputPanel outputs={outputs} risks={risks} history={history} />
          </>
        )}
      </div>
    </div>
  );
}