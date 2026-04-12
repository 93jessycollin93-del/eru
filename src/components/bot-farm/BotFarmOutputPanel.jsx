export default function BotFarmOutputPanel({ outputs, risks, history }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
      <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Output Economy</p>
        <div className="space-y-2">
          {outputs.map((item) => (
            <div key={item.id} className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-foreground">{item.output_type.replaceAll('_', ' ')}</p>
                <span className="text-[10px] text-primary">value {item.value_score}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{item.summary}</p>
              <p className="mt-2 text-[10px] text-muted-foreground">quality {item.quality_score}%</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Alerts & Activity</p>
        <div className="space-y-2">
          {risks.map((risk) => (
            <div key={risk.id} className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
              <p className="text-xs font-semibold text-foreground">{risk.flag_type.replaceAll('_', ' ')}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{risk.details}</p>
            </div>
          ))}
          {history.map((item) => (
            <div key={item.id} className="rounded-xl border border-border bg-background p-3">
              <p className="text-xs font-semibold text-foreground">{item.event_type.replaceAll('_', ' ')}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{item.summary}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}