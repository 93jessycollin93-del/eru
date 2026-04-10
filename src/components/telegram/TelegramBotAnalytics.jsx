import { MessageSquare, Activity, Users, AlertTriangle } from 'lucide-react';

export default function TelegramBotAnalytics({ bot, messages = [], logs = [], sessions = [] }) {
  const outgoing = messages.filter((item) => item.direction === 'outgoing').length;
  const incoming = messages.filter((item) => item.direction === 'incoming').length;
  const errors = logs.filter((item) => item.level === 'error').length;
  const avgLatency = messages.length ? Math.round(messages.reduce((sum, item) => sum + (item.latency_ms || 0), 0) / messages.length) : 0;

  const stats = [
    { label: 'Incoming', value: incoming, icon: MessageSquare, color: 'text-blue-400' },
    { label: 'Replies', value: outgoing, icon: Activity, color: 'text-primary' },
    { label: 'Sessions', value: sessions.length, icon: Users, color: 'text-yellow-400' },
    { label: 'Errors', value: errors, icon: AlertTriangle, color: 'text-red-400' },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Bot Analytics</p>
          <p className="text-[11px] text-muted-foreground">Detailed activity for {bot?.name || 'this bot'}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Avg latency</p>
          <p className="text-sm font-semibold">{avgLatency} ms</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-secondary/40 p-3">
            <stat.icon className={`w-4 h-4 ${stat.color} mb-2`} />
            <p className="text-lg font-semibold">{stat.value}</p>
            <p className="text-[11px] text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}