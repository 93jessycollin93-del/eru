export default function BotFarmMaintenancePanel({ botsNeedingAttention, onRecover, onRepair, onQuarantine }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground">Maintenance & Recovery</p>
        <p className="text-[11px] text-muted-foreground">Fatigued, unstable, or damaged units must be recovered before performance collapses.</p>
      </div>
      <div className="space-y-2">
        {botsNeedingAttention.map((bot) => (
          <div key={bot.id} className="rounded-xl border border-border bg-background p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold text-foreground">{bot.name}</p>
                <p className="text-[11px] text-muted-foreground">Fatigue {bot.fatigue} · Integrity {bot.integrity} · Status {bot.status}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => onRecover(bot)} className="rounded-xl border border-border px-3 py-2 text-[11px] text-muted-foreground">Recover</button>
                <button onClick={() => onRepair(bot)} className="rounded-xl border border-border px-3 py-2 text-[11px] text-muted-foreground">Repair</button>
                <button onClick={() => onQuarantine(bot)} className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">Quarantine</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}