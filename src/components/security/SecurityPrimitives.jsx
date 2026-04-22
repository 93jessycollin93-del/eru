import { useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, ShieldAlert, Flag, Cpu, ScrollText,
  CheckCircle2, CircleDot, XCircle, Radio, Clock,
} from 'lucide-react';

export const SEVERITY_STYLES = {
  critical: {
    text: 'text-red-400',
    bg: 'bg-red-400/10',
    border: 'border-red-400/30',
    solid: 'bg-red-400',
    ring: 'ring-red-400/40',
    hex: '#f87171',
  },
  warning: {
    text: 'text-orange-400',
    bg: 'bg-orange-400/10',
    border: 'border-orange-400/30',
    solid: 'bg-orange-400',
    ring: 'ring-orange-400/40',
    hex: '#fb923c',
  },
  caution: {
    text: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
    border: 'border-yellow-400/30',
    solid: 'bg-yellow-400',
    ring: 'ring-yellow-400/40',
    hex: '#facc15',
  },
  info: {
    text: 'text-sky-400',
    bg: 'bg-sky-400/10',
    border: 'border-sky-400/30',
    solid: 'bg-sky-400',
    ring: 'ring-sky-400/40',
    hex: '#38bdf8',
  },
};

export const SOURCE_ICON = {
  audit: ScrollText,
  alert: AlertTriangle,
  risk: ShieldAlert,
  botflag: Flag,
  integrity: Cpu,
};

export function SeverityBadge({ severity }) {
  const s = SEVERITY_STYLES[severity] || SEVERITY_STYLES.info;
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${s.bg} ${s.text} ${s.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.solid}`} />
      {severity.toUpperCase()}
    </span>
  );
}

export function StatusPill({ status }) {
  const map = {
    success: { icon: CheckCircle2, cls: 'text-green-400 bg-green-400/10 border-green-400/30' },
    resolved: { icon: CheckCircle2, cls: 'text-green-400 bg-green-400/10 border-green-400/30' },
    acknowledged: { icon: CircleDot, cls: 'text-sky-400 bg-sky-400/10 border-sky-400/30' },
    reviewing: { icon: Radio, cls: 'text-sky-400 bg-sky-400/10 border-sky-400/30' },
    open: { icon: CircleDot, cls: 'text-orange-400 bg-orange-400/10 border-orange-400/30' },
    failed: { icon: XCircle, cls: 'text-red-400 bg-red-400/10 border-red-400/30' },
  };
  const meta = map[status] || { icon: CircleDot, cls: 'text-muted-foreground bg-secondary border-border' };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${meta.cls}`}>
      <Icon className="w-2.5 h-2.5" />
      {String(status).toUpperCase()}
    </span>
  );
}

export function SourceChip({ source, label }) {
  const Icon = SOURCE_ICON[source] || Activity;
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

export function PulseDot({ active = true, color = 'bg-primary' }) {
  return (
    <span className="relative inline-flex w-2 h-2">
      {active && <span className={`absolute inline-flex h-full w-full rounded-full ${color} opacity-60 animate-ping`} />}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${active ? color : 'bg-muted-foreground'}`} />
    </span>
  );
}

export function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
      <Clock className="w-3 h-3" />
      {now.toLocaleTimeString()}
    </span>
  );
}

export function relativeTime(iso) {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function summarise(event) {
  const who = event.user_email ? ` · ${event.user_email}` : '';
  const ip = event.ip_address ? ` · ${event.ip_address}` : '';
  const target = event.entity_id ? ` · ${event.entity_id}` : '';
  return `${event.title}${who}${ip}${target}`;
}
