export default function BotFarmMetricGrid({ metrics }) {
  const cards = [
    { label: 'Leader', value: metrics.leader_count },
    { label: 'Commanders', value: metrics.commander_count },
    { label: 'Task Bots', value: metrics.task_bot_count },
    { label: 'Security', value: metrics.security_count },
    { label: 'Idle', value: metrics.idle_bots },
    { label: 'Overloaded', value: metrics.overloaded_bots },
    { label: 'Queue Depth', value: metrics.task_queue_depth },
    { label: 'Output Quality', value: `${metrics.avg_output_quality}%` },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
      {cards.map((card) => (
        <div key={card.label} className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{card.label}</p>
          <p className="mt-2 text-xl font-bold text-foreground">{card.value}</p>
        </div>
      ))}
    </div>
  );
}