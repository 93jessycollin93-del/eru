import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import BotFarmHeader from '../components/bot-farm/BotFarmHeader';
import BotFarmMetricGrid from '../components/bot-farm/BotFarmMetricGrid';
import BotFarmBotCard from '../components/bot-farm/BotFarmBotCard';
import BotFarmQueuePanel from '../components/bot-farm/BotFarmQueuePanel';
import BotFarmSquadPanel from '../components/bot-farm/BotFarmSquadPanel';
import BotFarmOutputPanel from '../components/bot-farm/BotFarmOutputPanel';
import BotFarmUpgradePanel from '../components/bot-farm/BotFarmUpgradePanel';
import { computeBotFit, computeOutputQuality, summarizeFarmMetrics } from '../components/bot-farm/BotFarmUtils';
import { DEMO_ACTIVITY, DEMO_BOTS, DEMO_MISSIONS, DEMO_OUTPUTS, DEMO_RISKS, DEMO_SQUADS, DEMO_TASKS, DEMO_UPGRADES } from '../components/bot-farm/BotFarmDemoData';

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

  const loadAll = async () => {
    const [botRows, squadRows, taskRows, missionRows, outputRows, riskRows, upgradeRows, historyRows] = await Promise.all([
      base44.entities.BotFarmBot.list('-updated_date', 100),
      base44.entities.BotFarmSquad.list('-updated_date', 50),
      base44.entities.BotFarmTask.list('-updated_date', 100),
      base44.entities.BotFarmMission.list('-updated_date', 50),
      base44.entities.BotFarmOutputLog.list('-updated_date', 50),
      base44.entities.BotFarmRiskFlag.list('-updated_date', 50),
      base44.entities.BotFarmUpgrade.list('-updated_date', 30),
      base44.entities.BotFarmActivityHistory.list('-updated_date', 80),
    ]);
    setBots(botRows || []);
    setSquads(squadRows || []);
    setTasks(taskRows || []);
    setMissions(missionRows || []);
    setOutputs(outputRows || []);
    setRisks(riskRows || []);
    setUpgrades(upgradeRows || []);
    setHistory(historyRows || []);
    setLoading(false);
  };

  const seedIfNeeded = async () => {
    const existing = await base44.entities.BotFarmBot.list('-created_date', 1);
    if ((existing || []).length > 0) return;

    const createdSquads = await base44.entities.BotFarmSquad.bulkCreate(DEMO_SQUADS);
    const createdMissions = await base44.entities.BotFarmMission.bulkCreate(DEMO_MISSIONS);
    const createdTasks = await base44.entities.BotFarmTask.bulkCreate(DEMO_TASKS);
    const createdBots = await base44.entities.BotFarmBot.bulkCreate(
      DEMO_BOTS.map((bot, index) => ({
        ...bot,
        squad_id: createdSquads[index % createdSquads.length]?.id,
        assigned_task_id: createdTasks[index % createdTasks.length]?.id,
        assigned_task_name: createdTasks[index % createdTasks.length]?.title,
      }))
    );

    await Promise.all([
      base44.entities.BotFarmOutputLog.bulkCreate(DEMO_OUTPUTS.map((item, index) => ({
        ...item,
        bot_id: createdBots[index % createdBots.length]?.id,
        task_id: createdTasks[index % createdTasks.length]?.id,
        mission_id: createdMissions[0]?.id,
      }))),
      base44.entities.BotFarmRiskFlag.bulkCreate(DEMO_RISKS.map((item, index) => ({
        ...item,
        bot_id: createdBots[index % createdBots.length]?.id,
        task_id: createdTasks[index % createdTasks.length]?.id,
        mission_id: createdMissions[0]?.id,
      }))),
      base44.entities.BotFarmUpgrade.bulkCreate(DEMO_UPGRADES),
      base44.entities.BotFarmActivityHistory.bulkCreate(DEMO_ACTIVITY),
    ]);
  };

  useEffect(() => {
    seedIfNeeded().then(loadAll);
  }, []);

  const metrics = useMemo(() => summarizeFarmMetrics(bots, tasks, missions, risks, outputs), [bots, tasks, missions, risks, outputs]);

  const assignTaskToBot = async (task, botOverride) => {
    const candidateBots = botOverride ? [botOverride] : bots;
    const ranked = candidateBots
      .map((bot) => ({ bot, fit: computeBotFit(bot, task) }))
      .filter((item) => !['maintenance', 'quarantined', 'offline'].includes(item.bot.status))
      .sort((a, b) => b.fit - a.fit);
    const chosen = ranked[0]?.bot;
    if (!chosen) return;

    const nextLoad = Math.min(100, (chosen.load || 0) + (task.estimated_load || 15));
    const nextFatigue = Math.min(100, (chosen.fatigue || 0) + Math.max(8, Math.round((task.estimated_load || 15) * 0.5)));
    const nextStatus = nextLoad > 80 || nextFatigue > 75 ? 'overloaded' : 'active';
    const quality = computeOutputQuality(chosen, task, 6);
    const riskLevel = chosen.integrity < 70 || nextStatus === 'overloaded' ? 'medium' : chosen.risk_level;

    await Promise.all([
      base44.entities.BotFarmTask.update(task.id, {
        assigned_bot_id: chosen.id,
        status: 'assigned',
        bot_fit_score: ranked[0].fit,
        progress: task.status === 'pending' ? 12 : task.progress,
      }),
      base44.entities.BotFarmBot.update(chosen.id, {
        assigned_task_id: task.id,
        assigned_task_name: task.title,
        load: nextLoad,
        fatigue: nextFatigue,
        status: nextStatus,
        output_quality: quality,
        risk_level: riskLevel,
      }),
      base44.entities.BotFarmActivityHistory.create({
        actor_type: 'bot',
        actor_id: chosen.id,
        event_type: 'task_assigned',
        summary: `${chosen.name} assigned to ${task.title}`,
        impact_score: ranked[0].fit,
      })
    ]);

    await loadAll();
  };

  const handleRest = async (bot) => {
    await Promise.all([
      base44.entities.BotFarmBot.update(bot.id, {
        fatigue: Math.max(0, (bot.fatigue || 0) - 25),
        load: Math.max(0, (bot.load || 0) - 15),
        status: 'recovering',
        maintenance_status: 'healthy',
      }),
      base44.entities.BotFarmMaintenanceLog.create({
        bot_id: bot.id,
        maintenance_type: 'rest',
        status: 'complete',
        impact: 'Fatigue reduced and operating headroom restored.',
        recovery_gain: 25,
      })
    ]);
    await loadAll();
  };

  const handleRepair = async (bot) => {
    await Promise.all([
      base44.entities.BotFarmBot.update(bot.id, {
        integrity: Math.min(100, (bot.integrity || 0) + 18),
        system_health: Math.min(100, (bot.system_health || 0) + 15),
        maintenance_status: 'recalibrating',
        status: 'maintenance',
      }),
      base44.entities.BotFarmMaintenanceLog.create({
        bot_id: bot.id,
        maintenance_type: 'repair',
        status: 'in_progress',
        impact: 'Repair cycle started to restore integrity and stability.',
        recovery_gain: 18,
      })
    ]);
    await loadAll();
  };

  const handleQuarantine = async (bot) => {
    await base44.entities.BotFarmBot.update(bot.id, {
      status: 'quarantined',
      communication_status: 'offline',
      risk_level: 'critical',
    });
    await loadAll();
  };

  const handleUpgrade = async (upgrade) => {
    await base44.entities.BotFarmUpgrade.update(upgrade.id, {
      level: (upgrade.level || 1) + 1,
      effect_value: (upgrade.effect_value || 0) + 4,
    });
    await base44.entities.BotFarmActivityHistory.create({
      actor_type: 'system',
      event_type: 'upgrade_expanded',
      summary: `${upgrade.name} advanced to level ${(upgrade.level || 1) + 1}.`,
      impact_score: (upgrade.effect_value || 0) + 4,
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

            <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
              <BotFarmQueuePanel tasks={tasks} sortMode={sortMode} setSortMode={setSortMode} onAssignTask={assignTaskToBot} />
              <BotFarmUpgradePanel upgrades={upgrades} onUpgrade={handleUpgrade} />
            </div>

            <BotFarmSquadPanel squads={squads} bots={bots} missions={missions} />

            <section className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Bot Workforce</p>
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

            <BotFarmOutputPanel outputs={outputs} risks={risks} history={history.slice(0, 5)} />
          </>
        )}
      </div>
    </div>
  );
}