import { useCallback, useEffect, useMemo, useState } from 'react';
import { Filter, Save, Trash2, Download, RotateCcw } from 'lucide-react';
import { SEVERITY_STYLES, SeverityBadge, StatusPill, SourceChip, relativeTime } from './SecurityPrimitives';

const PRESET_KEY = 'soc:presets:v1';
const SOURCES = [
  { id: 'audit', label: 'Audit' },
  { id: 'alert', label: 'Alert' },
  { id: 'risk', label: 'Risk' },
  { id: 'botflag', label: 'Bot Flag' },
  { id: 'integrity', label: 'Integrity' },
];
const SEVERITIES = ['critical', 'warning', 'caution', 'info'];
const STATUSES = ['open', 'acknowledged', 'reviewing', 'resolved', 'failed', 'success'];
const WINDOWS = [
  { id: '15m', label: '15 min', ms: 15 * 60 * 1000 },
  { id: '1h', label: '1 hr', ms: 60 * 60 * 1000 },
  { id: '24h', label: '24 hr', ms: 24 * 60 * 60 * 1000 },
  { id: '7d', label: '7 d', ms: 7 * 24 * 60 * 60 * 1000 },
  { id: 'all', label: 'All', ms: null },
];

const DEFAULT_QUERY = {
  severities: [],
  sources: [],
  statuses: [],
  window: 'all',
  textMatch: '',
};

function loadPresets() {
  try {
    const raw = localStorage.getItem(PRESET_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function savePresets(list) {
  try { localStorage.setItem(PRESET_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

function Chip({ active, onClick, children, tone = 'primary' }) {
  const toneCls = active
    ? tone === 'primary'
      ? 'bg-primary/15 border-primary/40 text-primary'
      : tone
    : 'bg-card border-border text-muted-foreground hover:text-foreground';
  return (
    <button type="button" onClick={onClick} className={`text-[10px] font-semibold px-2 py-1 rounded-md border transition-all ${toneCls}`}>
      {children}
    </button>
  );
}

export function applyQuery(events, query) {
  const { severities, sources, statuses, window, textMatch } = query;
  const cutoff = WINDOWS.find(w => w.id === window)?.ms;
  const since = cutoff ? Date.now() - cutoff : null;
  const needle = textMatch.trim().toLowerCase();

  return events.filter(e => {
    if (severities.length && !severities.includes(e.severity)) return false;
    if (sources.length && !sources.includes(e.source)) return false;
    if (statuses.length && !statuses.includes(e.status)) return false;
    if (since && new Date(e.created_date).getTime() < since) return false;
    if (needle) {
      const hay = [e.title, e.description, e.user_email, e.ip_address, e.entity_id, e.event_type]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

function downloadJson(events) {
  const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `soc-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SocCompose({ events, onSelectEvent, initialQuery }) {
  const [query, setQuery] = useState(() => ({ ...DEFAULT_QUERY, ...(initialQuery || {}) }));
  const [presets, setPresets] = useState(loadPresets);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (initialQuery) setQuery(q => ({ ...q, ...initialQuery }));
  }, [initialQuery]);

  const toggle = useCallback((key, value) => {
    setQuery(q => {
      const cur = new Set(q[key]);
      if (cur.has(value)) cur.delete(value);
      else cur.add(value);
      return { ...q, [key]: Array.from(cur) };
    });
  }, []);

  const results = useMemo(() => applyQuery(events, query), [events, query]);

  const totalSeverity = useMemo(() => {
    const acc = { critical: 0, warning: 0, caution: 0, info: 0 };
    results.forEach(e => { acc[e.severity] = (acc[e.severity] || 0) + 1; });
    return acc;
  }, [results]);

  const addPreset = () => {
    if (!newName.trim()) return;
    const next = [...presets.filter(p => p.name !== newName.trim()), { name: newName.trim(), query }];
    setPresets(next); savePresets(next); setNewName('');
  };
  const applyPreset = (p) => setQuery(p.query);
  const removePreset = (name) => {
    const next = presets.filter(p => p.name !== name);
    setPresets(next); savePresets(next);
  };

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="bg-card border border-border rounded-2xl p-3 space-y-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs font-semibold flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-primary" /> Compose query
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setQuery(DEFAULT_QUERY)}
              className="text-[10px] font-semibold px-2 py-1 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
            <button
              type="button"
              onClick={() => downloadJson(results)}
              disabled={results.length === 0}
              className="text-[10px] font-semibold px-2 py-1 rounded-md border border-primary/40 bg-primary/10 text-primary disabled:opacity-40 flex items-center gap-1"
            >
              <Download className="w-3 h-3" /> Export ({results.length})
            </button>
          </div>
        </div>

        <div>
          <p className="text-[9px] font-bold uppercase text-muted-foreground mb-1">Severity</p>
          <div className="flex gap-1 flex-wrap">
            {SEVERITIES.map(s => {
              const cls = SEVERITY_STYLES[s];
              const active = query.severities.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggle('severities', s)}
                  className={`text-[10px] font-semibold px-2 py-1 rounded-md border transition-all ${
                    active ? `${cls.bg} ${cls.border} ${cls.text}` : 'bg-card border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-[9px] font-bold uppercase text-muted-foreground mb-1">Source</p>
          <div className="flex gap-1 flex-wrap">
            {SOURCES.map(s => (
              <Chip key={s.id} active={query.sources.includes(s.id)} onClick={() => toggle('sources', s.id)}>{s.label}</Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[9px] font-bold uppercase text-muted-foreground mb-1">Status</p>
          <div className="flex gap-1 flex-wrap">
            {STATUSES.map(s => (
              <Chip key={s} active={query.statuses.includes(s)} onClick={() => toggle('statuses', s)}>{s}</Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[9px] font-bold uppercase text-muted-foreground mb-1">Time window</p>
          <div className="flex gap-1 flex-wrap">
            {WINDOWS.map(w => (
              <Chip key={w.id} active={query.window === w.id} onClick={() => setQuery(q => ({ ...q, window: w.id }))}>{w.label}</Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[9px] font-bold uppercase text-muted-foreground mb-1">Text match (title, user, ip, target)</p>
          <input
            type="text"
            value={query.textMatch}
            onChange={(e) => setQuery(q => ({ ...q, textMatch: e.target.value }))}
            placeholder="e.g. failed_login, 10.0.0.*, bot-123"
            className="w-full px-3 py-1.5 bg-secondary border border-border rounded-md text-xs font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="border-t border-border pt-2 space-y-1">
          <p className="text-[9px] font-bold uppercase text-muted-foreground mb-1">Presets</p>
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="preset name…"
              className="flex-1 px-2 py-1 bg-secondary border border-border rounded-md text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={addPreset}
              disabled={!newName.trim()}
              className="text-[10px] font-semibold px-2 py-1 rounded-md border border-primary/40 bg-primary/10 text-primary disabled:opacity-40 flex items-center gap-1"
            >
              <Save className="w-3 h-3" /> Save
            </button>
          </div>
          <div className="flex gap-1 flex-wrap">
            {presets.length === 0 && <span className="text-[10px] text-muted-foreground">No saved presets yet</span>}
            {presets.map(p => (
              <span key={p.name} className="inline-flex items-center gap-1 text-[10px] bg-secondary rounded-md border border-border pl-2 pr-1 py-0.5">
                <button type="button" className="hover:text-primary" onClick={() => applyPreset(p)}>{p.name}</button>
                <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => removePreset(p.name)}>
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-wrap flex-shrink-0">
        {SEVERITIES.map(s => (
          <span key={s} className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full border ${SEVERITY_STYLES[s].bg} ${SEVERITY_STYLES[s].text} ${SEVERITY_STYLES[s].border}`}>
            {s}: {totalSeverity[s] || 0}
          </span>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {results.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm font-medium">No matches</p>
            <p className="text-xs mt-1">Relax filters or widen the time window.</p>
          </div>
        ) : (
          results.map(e => {
            const sev = SEVERITY_STYLES[e.severity] || SEVERITY_STYLES.info;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => onSelectEvent(e)}
                className={`w-full text-left rounded-xl border p-2.5 ${sev.bg} ${sev.border} hover:ring-2 ${sev.ring} transition-all`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold capitalize truncate">{e.title}</p>
                  <span className="text-[9px] text-muted-foreground font-mono flex-shrink-0">{relativeTime(e.created_date)}</span>
                </div>
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  <SeverityBadge severity={e.severity} />
                  <StatusPill status={e.status} />
                  <SourceChip source={e.source} label={e.sourceLabel} />
                  {e.user_email && <span className="text-[9px] text-muted-foreground font-mono truncate">· {e.user_email}</span>}
                  {e.ip_address && <span className="text-[9px] text-muted-foreground font-mono">· {e.ip_address}</span>}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
