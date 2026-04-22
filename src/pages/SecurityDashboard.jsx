import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { AlertTriangle, RefreshCw, Shield, LayoutDashboard, Radio, ListChecks, Users, Filter } from 'lucide-react';
import { useSecurityFeed } from '@/components/security/useSecurityFeed';
import { LiveClock, PulseDot } from '@/components/security/SecurityPrimitives';
import SocOverview from '@/components/security/SocOverview';
import SocLive from '@/components/security/SocLive';
import SocIncidents, { IncidentDrawer } from '@/components/security/SocIncidents';
import SocCompose from '@/components/security/SocCompose';
import SocSessions from '@/components/security/SocSessions';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'live', label: 'Live Feed', icon: Radio },
  { id: 'incidents', label: 'Incidents', icon: ListChecks },
  { id: 'sessions', label: 'Sessions', icon: Users },
  { id: 'compose', label: 'Compose', icon: Filter },
];

function deriveKpis(events) {
  const now = Date.now();
  const within = (ms) => events.filter(e => now - new Date(e.created_date).getTime() < ms);
  const last24h = within(24 * 60 * 60 * 1000);
  const last1h = within(60 * 60 * 1000);
  const critical24h = last24h.filter(e => e.severity === 'critical').length;
  const warning24h = last24h.filter(e => e.severity === 'warning').length;
  const failedAuth24h = last24h.filter(e => e.source === 'audit' && (e.status === 'failed' || /fail|login/.test(e.event_type || ''))).length;
  const openIncidents = events.filter(e => e.actionable && e.status !== 'resolved').length;
  const ackIncidents = events.filter(e => e.actionable && e.status === 'acknowledged').length;
  const uniqueIps = new Set(last24h.map(e => e.ip_address).filter(Boolean)).size;
  const perMin = last1h.length / 60;

  // Posture: 100 baseline, subtract weighted penalties.
  const rawScore = 100 - (critical24h * 10 + warning24h * 3 + failedAuth24h * 2 + openIncidents * 2);
  const postureScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  return {
    total: events.length,
    critical24h, warning24h, failedAuth24h, openIncidents, ackIncidents,
    uniqueIps, perMin, postureScore,
  };
}

export default function SecurityDashboard() {
  const { currentUser } = useAuth();
  const [tab, setTab] = useState('overview');
  const [paused, setPaused] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [actionState, setActionState] = useState('idle');
  const [actionError, setActionError] = useState(null);
  const [composerSeed, setComposerSeed] = useState(null);

  const feed = useSecurityFeed({ live: !paused, intervalMs: 10000, windowLimit: 200 });
  const { events, loading, lastUpdate, refresh, applyAction, error, sources } = feed;

  const kpis = useMemo(() => deriveKpis(events), [events]);

  const handleSelectType = useCallback((type) => {
    setComposerSeed({ textMatch: type.replace(/_/g, ' ') });
    setTab('compose');
  }, []);

  const handleAction = useCallback(async (event, action) => {
    setActionState('working');
    setActionError(null);
    try {
      await applyAction(event, action);
      setActionState('done');
      // Refresh the selected event reference so the drawer reflects new state.
      setSelectedEvent(prev => prev ? { ...prev, status: action === 'acknowledge' ? 'acknowledged' : action === 'review' ? 'reviewing' : action === 'resolve' ? 'resolved' : prev.status } : prev);
    } catch (e) {
      setActionError(e?.message || 'Action failed');
      setActionState('idle');
    } finally {
      setTimeout(() => setActionState('idle'), 500);
    }
  }, [applyAction]);

  const togglePause = useCallback(() => {
    setPaused(p => {
      const next = !p;
      feed.setLive(!next);
      return next;
    });
  }, [feed]);

  if (currentUser && currentUser.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
          <p className="text-sm text-muted-foreground">Admin access required</p>
        </div>
      </div>
    );
  }

  const sourceStatus = Object.entries(sources).map(([k, v]) => `${k}:${v}`).join(' · ');

  return (
    <div className="flex flex-col min-h-screen bg-background pb-24">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 flex-shrink-0">
        <div className="min-w-0">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Security Operations Center
            <PulseDot active={!paused} color={paused ? 'bg-muted-foreground' : 'bg-primary'} />
          </h2>
          <p className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
            <LiveClock />
            <span className="font-mono truncate">{sourceStatus}</span>
            {lastUpdate && <span className="font-mono">· last pull {lastUpdate.toLocaleTimeString()}</span>}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={togglePause}
            className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${paused ? 'border-border bg-card text-muted-foreground' : 'border-primary/40 bg-primary/10 text-primary'}`}
          >
            {paused ? '○ Paused' : '● Live'}
          </button>
          <button
            type="button"
            onClick={refresh}
            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex border-b border-border overflow-x-auto flex-shrink-0">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 py-2.5 px-4 text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === t.id ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mx-4 mt-3 text-[10px] px-3 py-2 rounded-lg border border-red-400/30 bg-red-400/10 text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-3 h-3" /> Feed error: {error}
        </div>
      )}
      {actionError && (
        <div className="mx-4 mt-3 text-[10px] px-3 py-2 rounded-lg border border-red-400/30 bg-red-400/10 text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-3 h-3" /> Action failed: {actionError}
        </div>
      )}

      <div className="flex-1 overflow-hidden px-4 py-4">
        {loading && events.length === 0 ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="h-full flex flex-col min-h-0">
            {tab === 'overview' && (
              <div className="flex-1 overflow-y-auto pr-1">
                <SocOverview events={events} kpis={kpis} onSelectType={handleSelectType} />
              </div>
            )}
            {tab === 'live' && <SocLive feed={feed} onSelectEvent={setSelectedEvent} paused={paused} onPauseToggle={togglePause} />}
            {tab === 'incidents' && <SocIncidents events={events} onSelectEvent={setSelectedEvent} />}
            {tab === 'sessions' && <SocSessions events={events} onInspect={setSelectedEvent} />}
            {tab === 'compose' && <SocCompose events={events} onSelectEvent={setSelectedEvent} initialQuery={composerSeed} />}
          </div>
        )}
      </div>

      {selectedEvent && (
        <IncidentDrawer
          event={selectedEvent}
          allEvents={events}
          onClose={() => setSelectedEvent(null)}
          onAction={handleAction}
          actionState={actionState}
        />
      )}
    </div>
  );
}
