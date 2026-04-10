import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from 'recharts';

const STATUS_COLORS = {
  active: '#22c55e',
  draft: '#64748b',
  offline: '#f59e0b',
  error: '#ef4444',
};

export default function BotOverviewCharts({ bots = [], messages = [], logs = [] }) {
  const statusData = Object.entries(
    bots.reduce((acc, bot) => {
      acc[bot.status || 'draft'] = (acc[bot.status || 'draft'] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const botVolumeData = bots.map((bot) => {
    const botMessages = messages.filter((message) => message.bot_id === bot.id);
    return {
      name: bot.name?.slice(0, 12) || 'Bot',
      incoming: botMessages.filter((message) => message.direction === 'incoming').length,
      outgoing: botMessages.filter((message) => message.direction === 'outgoing').length,
    };
  });

  const activityData = messages
    .slice()
    .reverse()
    .slice(-7)
    .map((message, index) => ({
      name: `${index + 1}`,
      latency: typeof message.latency_ms === 'number' ? message.latency_ms : 0,
      errors: logs.filter((log) => log.bot_id === message.bot_id && log.level === 'error').length,
    }));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold">Bot status mix</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={3}>
                {statusData.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#14b8a6'} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3 xl:col-span-2">
        <p className="text-sm font-semibold">Message volume by bot</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={botVolumeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="incoming" fill="#14b8a6" radius={[6, 6, 0, 0]} />
              <Bar dataKey="outgoing" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3 xl:col-span-3">
        <p className="text-sm font-semibold">Recent latency and error trend</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={activityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="latency" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}