import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Shield, Activity, TrendingUp, AlertTriangle, Users, Wifi } from 'lucide-react';
import { SEVERITY_STYLES } from './SecurityPrimitives';

const TOOLTIP = {
  background: 'hsl(230 22% 9%)',
  border: '1px solid hsl(230 18% 16%)',
  borderRadius: 8,
  fontSize: 11,
  color: 'hsl(220 15% 90%)',
};

function Kpi({ label, value, sub, tone = 'text-foreground', bg = 'bg-card', border = 'border-border', icon: Icon }) {
  return (
    <div className={`rounded-2xl border p-3 ${bg} ${border}`}>
      <div className="flex items-center justify-between mb-1.5">
        <p className={`text-[10px] font-semibold uppercase tracking-wide ${tone}`}>{label}</p>
        {Icon && <Icon className={`w-3.5 h-3.5 ${tone}`} />}
      </div>
      <p className={`text-2xl font-bold leading-none ${tone}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1 truncate">{sub}</p>}
    </div>
  );
}

function PostureGauge({ score }) {
  const pct = Math.max(0, Math.min(100, score));
  const tone =
    pct >= 85 ? SEVERITY_STYLES.info
    : pct >= 65 ? SEVERITY_STYLES.caution
    : pct >= 40 ? SEVERITY_STYLES.warning
    : SEVERITY_STYLES.critical;
  const label =
    pct >= 85 ? 'Secure'
    : pct >= 65 ? 'Elevated'
    : pct >= 40 ? 'At Risk'
    : 'Critical';

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className={`rounded-2xl border p-4 ${tone.bg} ${tone.border}`}>
      <div className="flex items-center justify-between mb-2">
        <p className={`text-[10px] font-semibold uppercase tracking-wide ${tone.text}`}>Security Posture</p>
        <Shield className={`w-3.5 h-3.5 ${tone.text}`} />
      </div>
      <div className="flex items-center gap-4">
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r={radius} stroke="hsl(230 18% 16%)" strokeWidth="8" fill="none" />
            <circle
              cx="50" cy="50" r={radius}
              stroke={tone.hex}
              strokeWidth="8"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 600ms ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className={`text-2xl font-bold leading-none ${tone.text}`}>{pct}</p>
            <p className="text-[9px] text-muted-foreground">/ 100</p>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${tone.text}`}>{label}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Composite of critical/warning events, failed auth attempts, and unresolved incidents in the last 24h.
          </p>
        </div>
      </div>
    </div>
  );
}

function SeverityTimeline({ events }) {
  const data = useMemo(() => {
    const now = Date.now();
    const bucketSize = 60 * 60 * 1000; // 1 hour
    const buckets = [];
    for (let i = 23; i >= 0; i--) {
      const start = now - i * bucketSize;
      buckets.push({
        key: start,
        time: new Date(start).toLocaleTimeString('en', { hour: '2-digit' }),
        critical: 0, warning: 0, caution: 0, info: 0,
      });
    }
    events.forEach(e => {
      const t = new Date(e.created_date).getTime();
      const idx = buckets.findIndex(b => t >= b.key && t < b.key + bucketSize);
      if (idx >= 0) buckets[idx][e.severity] = (buckets[idx][e.severity] || 0) + 1;
    });
    return buckets;
  }, [events]);

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-xs font-semibold mb-3 flex items-center gap-2">
        <TrendingUp className="w-3.5 h-3.5 text-primary" /> Severity · last 24h
      </p>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={data}>
          <defs>
            {['critical', 'warning', 'caution', 'info'].map(k => (
              <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={SEVERITY_STYLES[k].hex} stopOpacity={0.5} />
                <stop offset="95%" stopColor={SEVERITY_STYLES[k].hex} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#666' }} interval={3} />
          <YAxis tick={{ fontSize: 8, fill: '#666' }} width={24} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP} />
          <Area type="monotone" stackId="1" dataKey="info" stroke={SEVERITY_STYLES.info.hex} fill="url(#g-info)" strokeWidth={1.2} />
          <Area type="monotone" stackId="1" dataKey="caution" stroke={SEVERITY_STYLES.caution.hex} fill="url(#g-caution)" strokeWidth={1.2} />
          <Area type="monotone" stackId="1" dataKey="warning" stroke={SEVERITY_STYLES.warning.hex} fill="url(#g-warning)" strokeWidth={1.2} />
          <Area type="monotone" stackId="1" dataKey="critical" stroke={SEVERITY_STYLES.critical.hex} fill="url(#g-critical)" strokeWidth={1.2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function TypeBreakdown({ events, onSelectType }) {
  const data = useMemo(() => {
    const counts = new Map();
    events.forEach(e => {
      const t = (e.event_type || 'unknown').toString();
      const cur = counts.get(t) || { type: t, count: 0, worst: 'info' };
      cur.count += 1;
      if (['critical', 'warning', 'caution', 'info'].indexOf(e.severity) <
          ['critical', 'warning', 'caution', 'info'].indexOf(cur.worst)) {
        cur.worst = e.severity;
      }
      counts.set(t, cur);
    });
    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map(d => ({ ...d, label: d.type.replace(/_/g, ' ').slice(0, 18) }));
  }, [events]);

  if (data.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-xs font-semibold mb-3 flex items-center gap-2">
        <Activity className="w-3.5 h-3.5 text-primary" /> Top event types
      </p>
      <ResponsiveContainer width="100%" height={Math.max(120, data.length * 22)}>
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 12, top: 0, bottom: 0 }}>
          <XAxis type="number" tick={{ fontSize: 8, fill: '#666' }} allowDecimals={false} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 9, fill: '#888' }} width={110} />
          <Tooltip contentStyle={TOOLTIP} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} onClick={(d) => onSelectType?.(d.type)} cursor="pointer">
            {data.map((d) => (
              <Cell key={d.type} fill={SEVERITY_STYLES[d.worst].hex} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ActivityHeatmap({ events }) {
  const { matrix, maxCell } = useMemo(() => {
    const rows = ['critical', 'warning', 'caution', 'info'];
    const cols = 24;
    const m = rows.map(() => Array(cols).fill(0));
    const nowHour = new Date().getHours();
    events.forEach(e => {
      const t = new Date(e.created_date);
      const ageH = Math.floor((Date.now() - t.getTime()) / 3600000);
      if (ageH < 0 || ageH >= cols) return;
      const colIdx = cols - 1 - ageH;
      const rowIdx = rows.indexOf(e.severity);
      if (rowIdx >= 0) m[rowIdx][colIdx] += 1;
    });
    let max = 0;
    m.forEach(r => r.forEach(v => { if (v > max) max = v; }));
    return { matrix: m, rows, maxCell: max, currentHour: nowHour };
  }, [events]);

  const rows = ['critical', 'warning', 'caution', 'info'];

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-xs font-semibold mb-3 flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-primary" /> 24h heatmap
      </p>
      <div className="space-y-1">
        {rows.map((sev, i) => (
          <div key={sev} className="flex items-center gap-2">
            <span className={`text-[9px] font-bold w-14 ${SEVERITY_STYLES[sev].text}`}>{sev.toUpperCase()}</span>
            <div className="flex-1 grid gap-0.5" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
              {matrix[i].map((v, j) => {
                const intensity = maxCell === 0 ? 0 : v / maxCell;
                const style = { backgroundColor: intensity > 0 ? SEVERITY_STYLES[sev].hex : 'hsl(230 18% 12%)', opacity: intensity > 0 ? 0.25 + intensity * 0.75 : 1 };
                return (
                  <div key={j} title={`${v} events · ${23 - j}h ago`} className="h-4 rounded-sm" style={style} />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-2 text-[9px] text-muted-foreground font-mono">
        <span>24h ago</span>
        <span>now</span>
      </div>
    </div>
  );
}

export default function SocOverview({ events, kpis, onSelectType }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Kpi label="Critical 24h" value={kpis.critical24h} sub={kpis.critical24h === 0 ? 'clean window' : 'needs review'}
             tone={SEVERITY_STYLES.critical.text} bg={SEVERITY_STYLES.critical.bg} border={SEVERITY_STYLES.critical.border}
             icon={AlertTriangle} />
        <Kpi label="Open Incidents" value={kpis.openIncidents} sub={`${kpis.ackIncidents} acked`}
             tone={SEVERITY_STYLES.warning.text} bg={SEVERITY_STYLES.warning.bg} border={SEVERITY_STYLES.warning.border}
             icon={Shield} />
        <Kpi label="Failed Auth 24h" value={kpis.failedAuth24h} sub={`${kpis.uniqueIps} unique IPs`}
             tone={SEVERITY_STYLES.caution.text} bg={SEVERITY_STYLES.caution.bg} border={SEVERITY_STYLES.caution.border}
             icon={Users} />
        <Kpi label="Event Rate" value={`${kpis.perMin.toFixed(1)}/m`} sub={`${kpis.total} in window`}
             tone={SEVERITY_STYLES.info.text} bg={SEVERITY_STYLES.info.bg} border={SEVERITY_STYLES.info.border}
             icon={Wifi} />
      </div>

      <PostureGauge score={kpis.postureScore} />

      <div className="grid md:grid-cols-2 gap-3">
        <SeverityTimeline events={events} />
        <TypeBreakdown events={events} onSelectType={onSelectType} />
      </div>

      <ActivityHeatmap events={events} />
    </div>
  );
}
