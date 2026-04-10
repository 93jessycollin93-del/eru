import { useState, useEffect, useRef } from 'react';
import { Activity, AlertCircle, CheckCircle, Clock, TrendingUp, TrendingDown, RefreshCw, Zap, Wifi, WifiOff, BarChart2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

// Simulated real-time latency probes for each integrated service
const SERVICES = [
  { id: 'googledrive',  name: 'Google Drive',   color: '#4285F4', endpoint: 'https://www.googleapis.com/' },
  { id: 'dropbox',      name: 'Dropbox',         color: '#0061FF', endpoint: 'https://api.dropboxapi.com/' },
  { id: 'clickup',      name: 'ClickUp',         color: '#7B68EE', endpoint: 'https://api.clickup.com/' },
  { id: 'linear',       name: 'Linear',          color: '#5E6AD2', endpoint: 'https://api.linear.app/' },
  { id: 'salesforce',   name: 'Salesforce',      color: '#00A1E0', endpoint: 'https://login.salesforce.com/' },
  { id: 'slack',        name: 'Slack',           color: '#4A154B', endpoint: 'https://slack.com/' },
  { id: 'notion',       name: 'Notion',          color: '#ffffff', endpoint: 'https://api.notion.com/' },
  { id: 'github',       name: 'GitHub',          color: '#f0f6fc', endpoint: 'https://api.github.com/' },
  { id: 'hubspot',      name: 'HubSpot',         color: '#FF7A59', endpoint: 'https://api.hubapi.com/' },
  { id: 'telegram',     name: 'Telegram API',    color: '#0088cc', endpoint: 'https://api.telegram.org/' },
];

function simulateLatency(baseMs, errorRate = 0.05) {
  const isError = Math.random() < errorRate;
  const jitter = (Math.random() - 0.5) * baseMs * 0.4;
  const latency = Math.max(20, Math.round(baseMs + jitter));
  return { latency, isError };
}

const BASE_LATENCIES = { googledrive: 180, dropbox: 140, clickup: 220, linear: 110, salesforce: 310, slack: 95, notion: 160, github: 130, hubspot: 270, telegram: 80 };

function statusColor(latency, isError) {
  if (isError) return 'text-red-400';
  if (latency > 400) return 'text-orange-400';
  if (latency > 200) return 'text-yellow-400';
  return 'text-green-400';
}
function statusBg(latency, isError) {
  if (isError) return 'bg-red-400/10 border-red-400/30';
  if (latency > 400) return 'bg-orange-400/10 border-orange-400/30';
  if (latency > 200) return 'bg-yellow-400/10 border-yellow-400/30';
  return 'bg-green-400/10 border-green-400/30';
}

const CRASH_TYPES = [
  'NullPointerException in PaymentFlow',
  'Network timeout — Salesforce connector',
  'WebSocket disconnected — Telegram',
  'Memory overflow — NFT image cache',
  'Auth token expired — Google Drive',
  'Rate limit exceeded — ClickUp API',
  'SSL handshake failed — Dropbox',
  'JSON parse error — HubSpot response',
];

function generateCrashLogs(count = 8) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    type: CRASH_TYPES[i % CRASH_TYPES.length],
    count: Math.floor(Math.random() * 40) + 1,
    lastSeen: new Date(Date.now() - Math.random() * 3600000 * 6).toISOString(),
    severity: ['critical','high','medium'][Math.floor(Math.random() * 3)],
    resolved: Math.random() > 0.6,
  }));
}

function generateHistoryPoint(i) {
  const time = new Date(Date.now() - (29 - i) * 2 * 60 * 1000);
  return {
    time: time.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
    avgLatency: Math.round(150 + Math.sin(i * 0.4) * 60 + Math.random() * 40),
    errors: Math.floor(Math.random() * 5),
    requests: Math.floor(Math.random() * 300) + 100,
  };
}

const SEV = {
  critical: 'text-red-400 bg-red-400/10 border-red-400/30',
  high:     'text-orange-400 bg-orange-400/10 border-orange-400/30',
  medium:   'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
};

export default function PerformanceDashboard() {
  const [metrics, setMetrics] = useState(() =>
    SERVICES.map(s => {
      const { latency, isError } = simulateLatency(BASE_LATENCIES[s.id] || 200);
      return { ...s, latency, isError, uptime: 99.2 + Math.random() * 0.7, history: Array.from({ length: 12 }, (_, i) => ({ t: i, v: Math.round(BASE_LATENCIES[s.id] + (Math.random()-0.5)*60) })) };
    })
  );
  const [history, setHistory] = useState(() => Array.from({ length: 30 }, (_, i) => generateHistoryPoint(i)));
  const [crashes, setCrashes] = useState(() => generateCrashLogs());
  const [tab, setTab] = useState('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const intervalRef = useRef(null);

  const refresh = () => {
    setMetrics(prev => prev.map(s => {
      const { latency, isError } = simulateLatency(BASE_LATENCIES[s.id] || 200, s.isError ? 0.02 : 0.05);
      return { ...s, latency, isError, history: [...s.history.slice(1), { t: Date.now(), v: latency }] };
    }));
    setHistory(prev => [...prev.slice(1), generateHistoryPoint(29)]);
    setLastUpdate(new Date());
  };

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(refresh, 5000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh]);

  const healthy = metrics.filter(m => !m.isError && m.latency <= 200).length;
  const degraded = metrics.filter(m => !m.isError && m.latency > 200).length;
  const down = metrics.filter(m => m.isError).length;
  const avgLatency = Math.round(metrics.reduce((s, m) => s + m.latency, 0) / metrics.length);
  const errorRate = ((down / metrics.length) * 100).toFixed(1);

  return (
    <div className="flex flex-col min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Performance Monitor</h2>
          <p className="text-[10px] text-muted-foreground">Updated {lastUpdate.toLocaleTimeString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAutoRefresh(a => !a)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${autoRefresh ? 'text-primary border-primary/30 bg-primary/10' : 'text-muted-foreground border-border'}`}>
            {autoRefresh ? '● Live' : '○ Paused'}
          </button>
          <button onClick={refresh} className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border flex-shrink-0">
        {[['overview','Overview'],['services','Services'],['crashes','Crash Logs'],['latency','Latency']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${tab === id ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Healthy', val: healthy, color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/20' },
                { label: 'Degraded', val: degraded, color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20' },
                { label: 'Down', val: down, color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20' },
                { label: 'Avg ms', val: avgLatency, color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20' },
              ].map(({ label, val, color, bg }) => (
                <div key={label} className={`rounded-xl border p-2 text-center ${bg}`}>
                  <p className={`text-lg font-bold ${color}`}>{val}</p>
                  <p className={`text-[9px] font-semibold ${color}`}>{label}</p>
                </div>
              ))}
            </div>

            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5 text-primary" /> Avg Latency (30 min)</p>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="latGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(160 100% 45%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(160 100% 45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#666' }} interval={9} />
                  <YAxis tick={{ fontSize: 8, fill: '#666' }} width={28} />
                  <Tooltip contentStyle={{ background: 'hsl(230 22% 9%)', border: '1px solid hsl(230 18% 16%)', borderRadius: 8, fontSize: 11 }} />
                  <Area type="monotone" dataKey="avgLatency" stroke="hsl(160 100% 45%)" fill="url(#latGrad)" strokeWidth={1.5} name="Latency ms" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs font-semibold mb-3 flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5 text-red-400" /> Error Rate (30 min)</p>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={history.slice(-15)}>
                  <XAxis dataKey="time" tick={{ fontSize: 7, fill: '#666' }} interval={4} />
                  <Tooltip contentStyle={{ background: 'hsl(230 22% 9%)', border: '1px solid hsl(230 18% 16%)', borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="errors" fill="hsl(350 100% 60%)" radius={[2,2,0,0]} name="Errors" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card border border-border rounded-2xl p-3">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-muted-foreground font-medium">System Health</span>
                <span className="text-primary font-bold">{((healthy / metrics.length) * 100).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div className="h-2 rounded-full bg-primary transition-all duration-500" style={{ width: `${(healthy / metrics.length) * 100}%` }} />
              </div>
            </div>
          </>
        )}

        {/* SERVICES */}
        {tab === 'services' && (
          <div className="space-y-2">
            {metrics.map(s => (
              <div key={s.id} className={`rounded-xl border p-3 flex items-center gap-3 ${statusBg(s.latency, s.isError)}`}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.isError ? 'bg-red-400' : s.latency > 200 ? 'bg-yellow-400' : 'bg-green-400'} ${!s.isError ? 'animate-pulse' : ''}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-[10px] text-muted-foreground">Uptime {s.uptime.toFixed(1)}%</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${statusColor(s.latency, s.isError)}`}>
                    {s.isError ? 'ERROR' : `${s.latency}ms`}
                  </p>
                  <p className="text-[9px] text-muted-foreground">{s.isError ? 'Connection lost' : s.latency > 400 ? 'Slow' : s.latency > 200 ? 'Degraded' : 'Healthy'}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CRASH LOGS */}
        {tab === 'crashes' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{crashes.filter(c => !c.resolved).length} active issues</p>
              <button onClick={() => setCrashes(generateCrashLogs())} className="text-xs text-primary">Refresh</button>
            </div>
            {crashes.map(c => (
              <div key={c.id} className={`rounded-xl border p-3 space-y-2 ${c.resolved ? 'opacity-50' : ''} ${SEV[c.severity] || ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium leading-tight flex-1">{c.type}</p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${SEV[c.severity]}`}>{c.severity}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground">{c.count}× occurrences</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(c.lastSeen).toLocaleTimeString()}</span>
                  </div>
                  <button onClick={() => setCrashes(prev => prev.map(x => x.id === c.id ? { ...x, resolved: !x.resolved } : x))}
                    className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${c.resolved ? 'bg-secondary text-muted-foreground' : 'bg-green-400/10 text-green-400 border border-green-400/30'}`}>
                    {c.resolved ? 'Reopen' : 'Resolve'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* LATENCY BREAKDOWN */}
        {tab === 'latency' && (
          <div className="space-y-3">
            {[...metrics].sort((a, b) => b.latency - a.latency).map(s => (
              <div key={s.id} className="bg-card border border-border rounded-xl p-3">
                <div className="flex justify-between mb-1.5">
                  <p className="text-xs font-medium">{s.name}</p>
                  <p className={`text-xs font-bold ${statusColor(s.latency, s.isError)}`}>{s.isError ? 'ERR' : `${s.latency}ms`}</p>
                </div>
                <div className="w-full bg-secondary rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full transition-all duration-700 ${s.isError ? 'bg-red-400' : s.latency > 400 ? 'bg-orange-400' : s.latency > 200 ? 'bg-yellow-400' : 'bg-green-400'}`}
                    style={{ width: `${Math.min(100, (s.latency / 500) * 100)}%` }} />
                </div>
                <p className="text-[9px] text-muted-foreground mt-1">P95: {Math.round(s.latency * 1.4)}ms · P99: {Math.round(s.latency * 2.1)}ms</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}