import { AlertTriangle, Wrench, TrendingDown } from 'lucide-react';

function buildTrendSeries(bot, maintenanceLogs) {
  const relevantLogs = maintenanceLogs
    .filter((item) => item.bot_id === bot.id)
    .slice(0, 6);

  const baseline = [
    Math.max(0, (bot.integrity || 0) - 18),
    Math.max(0, (bot.integrity || 0) - 12),
    Math.max(0, (bot.integrity || 0) - 7),
    Math.max(0, (bot.integrity || 0) - 3),
    bot.integrity || 0,
  ];

  if (!relevantLogs.length) return baseline;

  const recoveryOffset = relevantLogs.reduce((sum, item) => sum + (item.recovery_gain || 0), 0) / Math.max(1, relevantLogs.length);
  return baseline.map((value, index) => Math.max(0, Math.min(100, Math.round(value - (relevantLogs.length - index - 1) * 2 + recoveryOffset * 0.1))));
}

function getForecast(bot, maintenanceLogs) {
  const trend = buildTrendSeries(bot, maintenanceLogs);
  const slope = trend.length > 1 ? (trend[trend.length - 1] - trend[0]) / (trend.length - 1) : 0;
  const stressLoad = (bot.load || 0) * 0.18;
  const stressFatigue = (bot.fatigue || 0) * 0.22;
  const healthDrag = Math.max(0, 90 - (bot.system_health || 0)) * 0.3;
  const projectedIntegrity = Math.max(0, Math.min(100, Math.round((bot.integrity || 0) + slope * 2 - stressLoad - stressFatigue - healthDrag)));
  const degradationRisk = Math.max(0, Math.round((100 - projectedIntegrity) + ((bot.fatigue || 0) * 0.35) + ((bot.load || 0) * 0.25)));
  const maintenanceWindow = projectedIntegrity <= 45 ? 'Immediate' : projectedIntegrity <= 58 ? 'Next cycle' : projectedIntegrity <= 70 ? 'Within 2 cycles' : 'Monitor';
  const action = projectedIntegrity <= 45
    ? 'Repair + recalibration'
    : projectedIntegrity <= 58
      ? 'Preventive repair'
      : (bot.fatigue || 0) >= 68 || (bot.load || 0) >= 72
        ? 'Rest cycle'
        : 'Observation only';

  return {
    trend,
    projectedIntegrity,
    degradationRisk,
    maintenanceWindow,
    action,
  };
}

function MiniTrend({ points }) {
  const width = 140;
  const height = 42;
  const path = points
    .map((point, index) => {
      const x = (index / Math.max(1, points.length - 1)) * width;
      const y = height - (point / 100) * height;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-12 w-full">
      <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export default function BotFarmPredictiveAnalyticsPanel({ bots, maintenanceLogs }) {
  const ranked = (bots || [])
    .map((bot) => ({ bot, forecast: getForecast(bot, maintenanceLogs || []) }))
    .sort((a, b) => b.forecast.degradationRisk - a.forecast.degradationRisk)
    .slice(0, 6);

  const urgentCount = ranked.filter((item) => item.forecast.maintenanceWindow === 'Immediate').length;
  const preventiveCount = ranked.filter((item) => ['Immediate', 'Next cycle', 'Within 2 cycles'].includes(item.forecast.maintenanceWindow)).length;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Predictive Degradation Analytics</p>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Forecasts long-term integrity drift and flags bots that should enter preventive maintenance before hard failure pressure spikes.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:min-w-[220px]">
          <div className="rounded-xl border border-border bg-background px-3 py-2">
            <p className="text-[10px] text-muted-foreground">Immediate repairs</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{urgentCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-background px-3 py-2">
            <p className="text-[10px] text-muted-foreground">Preventive queue</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{preventiveCount}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {ranked.map(({ bot, forecast }) => (
          <div key={bot.id} className="rounded-xl border border-border bg-background p-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-foreground">{bot.name}</p>
                <p className="text-[10px] text-muted-foreground">{bot.status} · integrity {bot.integrity}% · health {bot.system_health || 0}%</p>
              </div>
              <div className={`rounded-full px-2 py-1 text-[10px] font-medium ${forecast.projectedIntegrity <= 45 ? 'bg-red-500/10 text-red-400' : forecast.projectedIntegrity <= 58 ? 'bg-orange-500/10 text-orange-300' : 'bg-primary/10 text-primary'}`}>
                {forecast.maintenanceWindow}
              </div>
            </div>

            <MiniTrend points={forecast.trend} />

            <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
              <div className="rounded-lg border border-border px-2 py-2">Projected integrity <span className="text-foreground">{forecast.projectedIntegrity}%</span></div>
              <div className="rounded-lg border border-border px-2 py-2">Risk score <span className="text-foreground">{forecast.degradationRisk}</span></div>
            </div>

            <div className="space-y-2 rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-2 text-[11px] text-foreground">
                <Wrench className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium">Suggested cycle</span>
              </div>
              <p className="text-[11px] text-muted-foreground">{forecast.action}</p>
              {(forecast.projectedIntegrity <= 58 || (bot.fatigue || 0) >= 68) && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-2.5 py-2 text-[10px] text-muted-foreground">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-red-400" />
                  <span>Schedule this bot before the next heavy assignment cycle to avoid hardware-failure-style degradation.</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}