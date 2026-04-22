import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Radio, Lock, Unlock } from 'lucide-react';
import { SEVERITY_STYLES, SeverityBadge, StatusPill, SourceChip, PulseDot, relativeTime } from './SecurityPrimitives';

function EventRow({ event, isNew, onSelect }) {
  const sev = SEVERITY_STYLES[event.severity] || SEVERITY_STYLES.info;
  return (
    <button
      type="button"
      onClick={() => onSelect(event)}
      className={`w-full text-left rounded-xl border p-2.5 transition-all ${sev.bg} ${sev.border} hover:ring-2 ${sev.ring} ${isNew ? 'animate-in slide-in-from-top-2 fade-in-20 duration-500' : ''}`}
    >
      <div className="flex items-start gap-2">
        <div className={`w-1 self-stretch rounded-full ${sev.solid}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold capitalize truncate">{event.title}</p>
            <span className="text-[9px] text-muted-foreground font-mono flex-shrink-0">{relativeTime(event.created_date)}</span>
          </div>
          {event.description && (
            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{event.description}</p>
          )}
          <div className="flex items-center gap-1 flex-wrap mt-1.5">
            <SeverityBadge severity={event.severity} />
            <StatusPill status={event.status} />
            <SourceChip source={event.source} label={event.sourceLabel} />
            {event.user_email && (
              <span className="text-[9px] text-muted-foreground font-mono truncate">{event.user_email}</span>
            )}
            {event.ip_address && (
              <span className="text-[9px] text-muted-foreground font-mono">· {event.ip_address}</span>
            )}
            {event.entity_id && (
              <span className="text-[9px] text-muted-foreground font-mono truncate">· {event.entity_id}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function SocLive({ feed, onSelectEvent, paused, onPauseToggle }) {
  const { events, isLive } = feed;
  const listRef = useRef(null);
  const [newIds, setNewIds] = useState(new Set());
  const seenRef = useRef(new Set());
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    const existing = seenRef.current;
    const freshlyAdded = new Set();
    events.forEach(e => {
      if (!existing.has(e.id)) {
        freshlyAdded.add(e.id);
        existing.add(e.id);
      }
    });
    if (freshlyAdded.size === 0) return;
    setNewIds(freshlyAdded);
    const t = setTimeout(() => setNewIds(new Set()), 1200);
    if (autoScroll && listRef.current) {
      listRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    return () => clearTimeout(t);
  }, [events, autoScroll]);

  const severities = ['critical', 'warning', 'caution', 'info'];
  const counts = severities.reduce((acc, s) => {
    acc[s] = events.filter(e => e.severity === s).length;
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 mb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <PulseDot active={isLive && !paused} color={paused ? 'bg-muted-foreground' : 'bg-primary'} />
          <span className="text-xs font-semibold">{paused ? 'Paused' : isLive ? 'Live feed' : 'Idle'}</span>
          <span className="text-[10px] text-muted-foreground font-mono">{events.length} events in window</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPauseToggle}
            className="text-[10px] px-2 py-1 rounded-md border border-border bg-card hover:bg-secondary flex items-center gap-1"
          >
            {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button
            type="button"
            onClick={() => setAutoScroll(v => !v)}
            className={`text-[10px] px-2 py-1 rounded-md border flex items-center gap-1 ${autoScroll ? 'border-primary/40 text-primary bg-primary/10' : 'border-border bg-card'}`}
          >
            {autoScroll ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            {autoScroll ? 'Follow' : 'Free'}
          </button>
        </div>
      </div>

      <div className="flex gap-1 flex-wrap mb-2 flex-shrink-0">
        {severities.map(s => (
          <span key={s} className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full border ${SEVERITY_STYLES[s].bg} ${SEVERITY_STYLES[s].text} ${SEVERITY_STYLES[s].border}`}>
            {s}: {counts[s]}
          </span>
        ))}
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {events.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Radio className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No events in window</p>
            <p className="text-xs mt-1">Events from SecurityAuditLog, CommandAlert, RiskReport, BotFarmRiskFlag and IntegrityReport will appear here in real time.</p>
          </div>
        ) : (
          events.map(e => (
            <EventRow key={e.id} event={e} isNew={newIds.has(e.id)} onSelect={onSelectEvent} />
          ))
        )}
      </div>
    </div>
  );
}
