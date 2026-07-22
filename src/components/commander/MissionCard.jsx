const PRIORITY = {
  critical: 'text-red-400',
  high: 'text-amber-300',
  medium: 'text-cyan-300',
  low: 'text-muted-foreground',
};
const STATUS = {
  active: 'bg-emerald-500/15 text-emerald-300',
  paused: 'bg-amber-500/15 text-amber-300',
  escalated: 'bg-red-500/15 text-red-300',
  completed: 'bg-cyan-500/15 text-cyan-300',
  failed: 'bg-red-500/15 text-red-300',
  draft: 'bg-secondary text-muted-foreground',
  planned: 'bg-secondary text-muted-foreground',
};

export default function MissionCard({ mission }) {
  return (
    <div className="eru-neon-card space-y-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">{mission.title}</p>
        <span className={`inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS[mission.status] || STATUS.draft}`}>
          {mission.status}
        </span>
      </div>
      {mission.objective && (
        <p className="line-clamp-2 text-[11px] text-muted-foreground">{mission.objective}</p>
      )}
      <div className="flex items-center gap-3 font-mono text-[10px]">
        <span className={PRIORITY[mission.priority] || PRIORITY.low}>◉ {mission.priority}</span>
        <span className="text-muted-foreground">risk {mission.overall_risk}</span>
        <span className="text-muted-foreground">cmd {mission.leader_decision}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${Math.min(100, mission.completion_progress || 0)}%` }}
          />
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">{Math.round(mission.completion_progress || 0)}%</span>
      </div>
    </div>
  );
}