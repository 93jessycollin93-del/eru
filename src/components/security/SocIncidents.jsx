import { useMemo, useState } from 'react';
import { X, ShieldCheck, Check, AlertCircle, Link2, ExternalLink } from 'lucide-react';
import { SEVERITY_STYLES, SeverityBadge, StatusPill, SourceChip, relativeTime } from './SecurityPrimitives';

function correlate(target, all) {
  if (!target) return [];
  const keys = [target.user_email, target.ip_address, target.entity_id].filter(Boolean);
  if (keys.length === 0) return [];
  return all
    .filter(e => e.id !== target.id)
    .filter(e => keys.some(k =>
      (e.user_email && e.user_email === k) ||
      (e.ip_address && e.ip_address === k) ||
      (e.entity_id && e.entity_id === k),
    ))
    .slice(0, 12);
}

export function IncidentDrawer({ event, allEvents, onClose, onAction, actionState }) {
  const rawJson = useMemo(() => {
    if (!event) return '';
    try { return JSON.stringify(event.raw, null, 2); } catch { return 'Unable to serialise record.'; }
  }, [event]);

  if (!event) return null;
  const sev = SEVERITY_STYLES[event.severity] || SEVERITY_STYLES.info;
  const related = correlate(event, allEvents);
  const canAct = event.actionable && ['alert', 'risk', 'botflag'].includes(event.source);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-card border-l border-border flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="flex items-start justify-between gap-2 p-4 border-b border-border">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <SeverityBadge severity={event.severity} />
              <StatusPill status={event.status} />
              <SourceChip source={event.source} label={event.sourceLabel} />
            </div>
            <h3 className="text-sm font-semibold capitalize truncate">{event.title}</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
              {new Date(event.created_date).toLocaleString()} · {relativeTime(event.created_date)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {event.description && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Detail</p>
              <p className="text-xs leading-relaxed">{event.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {event.user_email && (
              <div className="bg-secondary/50 rounded-lg p-2">
                <p className="text-[9px] text-muted-foreground uppercase">User</p>
                <p className="text-xs font-mono truncate">{event.user_email}</p>
              </div>
            )}
            {event.ip_address && (
              <div className="bg-secondary/50 rounded-lg p-2">
                <p className="text-[9px] text-muted-foreground uppercase">IP</p>
                <p className="text-xs font-mono truncate">{event.ip_address}</p>
              </div>
            )}
            {event.entity_id && (
              <div className="bg-secondary/50 rounded-lg p-2 col-span-2">
                <p className="text-[9px] text-muted-foreground uppercase">Target</p>
                <p className="text-xs font-mono truncate">{event.entity_id}</p>
              </div>
            )}
          </div>

          {related.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                <Link2 className="w-3 h-3" /> Correlated · {related.length}
              </p>
              <div className="space-y-1">
                {related.map(r => {
                  const rsev = SEVERITY_STYLES[r.severity] || SEVERITY_STYLES.info;
                  return (
                    <div key={r.id} className={`rounded-md border p-2 ${rsev.bg} ${rsev.border}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[11px] font-medium truncate">{r.title}</p>
                        <span className="text-[9px] text-muted-foreground font-mono flex-shrink-0">{relativeTime(r.created_date)}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <SeverityBadge severity={r.severity} />
                        <SourceChip source={r.source} label={r.sourceLabel} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> Raw record
            </p>
            <pre className="text-[10px] bg-secondary/50 rounded-lg p-2 overflow-x-auto font-mono leading-snug max-h-60">
              {rawJson}
            </pre>
          </div>
        </div>

        <div className="border-t border-border p-3 space-y-2 flex-shrink-0">
          {!canAct && (
            <p className="text-[10px] text-muted-foreground text-center">
              This record is read-only. Actions are available on alerts, risk reports and bot flags.
            </p>
          )}
          {canAct && (
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={actionState === 'working' || event.status === 'acknowledged'}
                onClick={() => onAction(event, 'acknowledge')}
                className={`text-[11px] font-semibold py-2 rounded-lg border flex items-center justify-center gap-1 transition-all ${sev.border} ${sev.bg} hover:brightness-125 disabled:opacity-50`}
              >
                <AlertCircle className="w-3.5 h-3.5" /> Acknowledge
              </button>
              <button
                type="button"
                disabled={actionState === 'working' || event.status === 'reviewing'}
                onClick={() => onAction(event, 'review')}
                className="text-[11px] font-semibold py-2 rounded-lg border border-sky-400/30 bg-sky-400/10 text-sky-400 hover:bg-sky-400/20 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Review
              </button>
              <button
                type="button"
                disabled={actionState === 'working' || event.status === 'resolved'}
                onClick={() => onAction(event, 'resolve')}
                className="text-[11px] font-semibold py-2 rounded-lg border border-green-400/30 bg-green-400/10 text-green-400 hover:bg-green-400/20 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <Check className="w-3.5 h-3.5" /> Resolve
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SocIncidents({ events, onSelectEvent }) {
  const [scope, setScope] = useState('open');
  const incidents = useMemo(() => {
    const actionable = events.filter(e => e.actionable);
    if (scope === 'all') return actionable;
    if (scope === 'resolved') return actionable.filter(e => e.status === 'resolved');
    return actionable.filter(e => e.status !== 'resolved');
  }, [events, scope]);

  const counts = {
    open: events.filter(e => e.actionable && e.status !== 'resolved').length,
    resolved: events.filter(e => e.actionable && e.status === 'resolved').length,
    all: events.filter(e => e.actionable).length,
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 mb-3 flex-shrink-0">
        {[['open', 'Open'], ['resolved', 'Resolved'], ['all', 'All']].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setScope(id)}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all ${
              scope === id ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {label} · {counts[id]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5">
        {incidents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Nothing to triage</p>
            <p className="text-xs mt-1">Actionable incidents from alerts, risk reports and bot flags will surface here.</p>
          </div>
        ) : (
          incidents.map(e => {
            const sev = SEVERITY_STYLES[e.severity] || SEVERITY_STYLES.info;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => onSelectEvent(e)}
                className={`w-full text-left rounded-xl border p-3 flex items-start gap-3 ${sev.bg} ${sev.border} hover:ring-2 ${sev.ring} transition-all`}
              >
                <div className={`w-1 self-stretch rounded-full ${sev.solid}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold capitalize truncate">{e.title}</p>
                    <span className="text-[9px] text-muted-foreground font-mono flex-shrink-0">{relativeTime(e.created_date)}</span>
                  </div>
                  {e.description && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{e.description}</p>}
                  <div className="flex items-center gap-1 flex-wrap mt-1.5">
                    <SeverityBadge severity={e.severity} />
                    <StatusPill status={e.status} />
                    <SourceChip source={e.source} label={e.sourceLabel} />
                    {e.entity_id && <span className="text-[9px] text-muted-foreground font-mono truncate">· {e.entity_id}</span>}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
