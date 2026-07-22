const STATUS_DOT = {
  active: 'bg-emerald-400',
  assigned: 'bg-cyan-400',
  idle: 'bg-muted-foreground/50',
  overloaded: 'bg-amber-400',
  blocked: 'bg-red-400',
  recovering: 'bg-amber-400',
  maintenance: 'bg-amber-400',
  quarantined: 'bg-red-400',
  offline: 'bg-red-400',
};

function Bar({ value, label }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[8px] uppercase text-muted-foreground">{label}</span>
      <div className="h-1 w-10 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary/80" style={{ width: `${Math.min(100, value || 0)}%` }} />
      </div>
    </div>
  );
}

export default function AgentRow({ bot }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 p-2.5">
      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${STATUS_DOT[bot.status] || STATUS_DOT.idle}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-foreground">{bot.name}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {bot.role_type} · {(bot.specialty || '').replace(/_/g, ' ')}
        </p>
      </div>
      <div className="hidden gap-2.5 sm:flex">
        <Bar value={bot.efficiency} label="eff" />
        <Bar value={bot.integrity} label="int" />
        <Bar value={bot.confidence} label="conf" />
      </div>
      <span className="flex-shrink-0 font-mono text-[10px] text-muted-foreground">{bot.status}</span>
    </div>
  );
}