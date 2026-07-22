import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Cpu, Crosshair, ShieldCheck, Activity, Radio, Server, Flag, Loader2,
} from 'lucide-react';
import { useRealtimeEntityList } from '@/hooks/useLiveSync';
import { useOnline } from '@/lib/connectivity';
import SyncHealthWidget from '@/components/dashboard/SyncHealthWidget';
import FleetStatCard from '@/components/commander/FleetStatCard';
import MissionCard from '@/components/commander/MissionCard';
import AgentRow from '@/components/commander/AgentRow';

const ACTIVE_MISSION_STATUSES = ['active', 'paused', 'escalated', 'planned'];
const STATUS_FILTERS = ['all', 'active', 'idle', 'assigned', 'maintenance', 'offline'];
const DOWN_STATUSES = ['maintenance', 'offline', 'quarantined', 'blocked', 'overloaded', 'recovering'];

export default function AppCommander() {
  const online = useOnline();
  const { data: bots, loading: loadingBots } = useRealtimeEntityList('BotFarmBot', { sort: '-updated_date', limit: 300 });
  const { data: missions } = useRealtimeEntityList('CommandMission', { sort: '-updated_date', limit: 100 });
  const [statusFilter, setStatusFilter] = useState('all');

  const fleet = useMemo(() => bots || [], [bots]);
  const activeMissions = useMemo(
    () => (missions || []).filter((m) => ACTIVE_MISSION_STATUSES.includes(m.status)),
    [missions],
  );

  const stats = useMemo(() => {
    const active = fleet.filter((b) => b.status === 'active').length;
    const idle = fleet.filter((b) => ['idle', 'assigned'].includes(b.status)).length;
    const down = fleet.filter((b) => DOWN_STATUSES.includes(b.status)).length;
    const avgHealth = fleet.length ? Math.round(fleet.reduce((s, b) => s + (b.system_health || 0), 0) / fleet.length) : 0;
    const clearComms = fleet.filter((b) => b.communication_status === 'clear').length;
    return { active, idle, down, avgHealth, clearComms };
  }, [fleet]);

  const filtered = statusFilter === 'all' ? fleet : fleet.filter((b) => b.status === statusFilter);

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28 md:pb-12">
      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 pt-4">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Home
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">eYe · Fleet Command</span>
        </div>

        {/* Hero HUD */}
        <div className="eru-neon-foundation relative overflow-hidden rounded-2xl p-4">
          <div className="eru-neon-grid-bg" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-primary/40 bg-primary/15">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="eru-neon-glow-text text-lg font-bold leading-tight">App Commander</h1>
              <p className="text-[11px] leading-tight text-muted-foreground">Unified fleet command · live status feed</p>
            </div>
            <div className="flex-shrink-0 text-right">
              <p className={`font-mono text-xs font-semibold ${online ? 'text-emerald-300' : 'text-amber-300'}`}>
                {online ? '● ONLINE' : '● OFFLINE'}
              </p>
              <p className="text-[10px] text-muted-foreground">comms {online ? 'linked' : 'down'}</p>
            </div>
          </div>
        </div>

        <SyncHealthWidget />

        {/* Stat grid */}
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <FleetStatCard icon={Cpu} label="Agents" value={fleet.length} sub={`${stats.active} active`} tone="cyan" />
          <FleetStatCard icon={Flag} label="Missions" value={activeMissions.length} sub="active ops" tone="fuchsia" />
          <FleetStatCard icon={Activity} label="Fleet health" value={`${stats.avgHealth}%`} sub={`${stats.down} need attn`} tone="emerald" />
          <FleetStatCard icon={Radio} label="Comms clear" value={`${stats.clearComms}/${fleet.length}`} sub="linked" tone="amber" />
        </div>

        {/* Missions */}
        <section className="space-y-2">
          <SectionTitle icon={Crosshair} label="Active Missions" count={activeMissions.length} />
          {activeMissions.length === 0 ? (
            <EmptyState text="No active missions. Plan one from the Command Center." to="/ailab" cta="Open AI Lab" />
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {activeMissions.slice(0, 6).map((m) => (
                <MissionCard key={m.id} mission={m} />
              ))}
            </div>
          )}
        </section>

        {/* Fleet roster */}
        <section className="space-y-2">
          <SectionTitle icon={Cpu} label="Fleet Roster" count={fleet.length} />
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`inline-flex h-7 flex-shrink-0 items-center rounded-full border px-3 text-[11px] capitalize ${
                  statusFilter === s
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-accent'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {loadingBots ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState text="No agents deployed here yet. Stand up the Bot Farm." to="/bot-farm" cta="Open Bot Farm" />
          ) : (
            <div className="space-y-2">
              {filtered.slice(0, 40).map((b) => (
                <AgentRow key={b.id} bot={b} />
              ))}
            </div>
          )}
        </section>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <QuickLink to="/bot-farm" icon={Cpu} label="Bot Farm" />
          <QuickLink to="/agent-operations" icon={Server} label="Agent Ops" />
          <QuickLink to="/ailab" icon={Crosshair} label="AI Lab" />
          <QuickLink to="/dashboard" icon={Activity} label="Dashboard" />
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, label, count }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <h2 className="text-sm font-semibold text-foreground">{label}</h2>
      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-mono text-muted-foreground">{count}</span>
    </div>
  );
}

function EmptyState({ text, to, cta }) {
  return (
    <div className="eru-neon-card flex flex-col items-center gap-2 p-6 text-center">
      <p className="text-[12px] text-muted-foreground">{text}</p>
      <Link
        to={to}
        className="inline-flex h-9 items-center rounded-full border border-primary/40 bg-primary/10 px-4 text-[12px] font-medium text-foreground hover:bg-primary/20"
      >
        {cta}
      </Link>
    </div>
  );
}

function QuickLink({ to, icon: Icon, label }) {
  return (
    <Link
      to={to}
      className="eru-theme-button flex flex-col items-center gap-1.5 rounded-xl border border-border p-3 text-center hover:bg-accent"
    >
      <Icon className="h-5 w-5 text-primary" />
      <span className="text-[11px] font-medium text-foreground">{label}</span>
    </Link>
  );
}