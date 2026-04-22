import { useMemo } from 'react';
import { Users, MapPin, KeyRound, LogIn, LogOut, ShieldAlert, Network } from 'lucide-react';
import { SEVERITY_STYLES, relativeTime } from './SecurityPrimitives';

function isAuthEvent(e) {
  const t = (e.event_type || '').toLowerCase();
  return (
    e.source === 'audit' &&
    (t.includes('login') || t.includes('logout') || t.includes('auth') || t.includes('session') || t.includes('mfa'))
  );
}

function classifyEvent(e) {
  const t = (e.event_type || '').toLowerCase();
  if (t.includes('logout')) return 'logout';
  if (t.includes('fail') || e.status === 'failed') return 'failed';
  if (t.includes('mfa')) return 'mfa';
  return 'login';
}

function summarisePerUser(authEvents) {
  const map = new Map();
  authEvents.forEach(e => {
    const k = e.user_email || e.ip_address || 'unknown';
    const cur = map.get(k) || {
      key: k,
      email: e.user_email || null,
      ips: new Set(),
      lastSeen: 0,
      logins: 0,
      logouts: 0,
      failed: 0,
      mfa: 0,
      recent: [],
    };
    const ts = new Date(e.created_date).getTime();
    if (ts > cur.lastSeen) cur.lastSeen = ts;
    if (e.ip_address) cur.ips.add(e.ip_address);
    const cls = classifyEvent(e);
    cur[cls === 'login' ? 'logins' : cls === 'logout' ? 'logouts' : cls === 'mfa' ? 'mfa' : 'failed'] += 1;
    cur.recent.push(e);
    map.set(k, cur);
  });
  return Array.from(map.values())
    .map(s => ({ ...s, ips: Array.from(s.ips), recent: s.recent.slice(0, 6) }))
    .sort((a, b) => b.lastSeen - a.lastSeen);
}

function summariseIps(authEvents) {
  const map = new Map();
  authEvents.forEach(e => {
    if (!e.ip_address) return;
    const cur = map.get(e.ip_address) || { ip: e.ip_address, users: new Set(), total: 0, failed: 0, lastSeen: 0 };
    cur.total += 1;
    cur.lastSeen = Math.max(cur.lastSeen, new Date(e.created_date).getTime());
    if (e.user_email) cur.users.add(e.user_email);
    if (classifyEvent(e) === 'failed') cur.failed += 1;
    map.set(e.ip_address, cur);
  });
  return Array.from(map.values())
    .map(x => ({ ...x, users: Array.from(x.users) }))
    .sort((a, b) => b.failed - a.failed || b.total - a.total)
    .slice(0, 12);
}

function ActivityDots({ events }) {
  return (
    <div className="flex gap-0.5 flex-wrap">
      {events.map(e => {
        const sev = SEVERITY_STYLES[e.severity] || SEVERITY_STYLES.info;
        const cls = classifyEvent(e);
        const Icon = cls === 'logout' ? LogOut : cls === 'failed' ? ShieldAlert : cls === 'mfa' ? KeyRound : LogIn;
        return (
          <span key={e.id} title={`${e.title} · ${new Date(e.created_date).toLocaleString()}`}
                className={`w-4 h-4 rounded-sm flex items-center justify-center ${sev.bg} ${sev.border} border`}>
            <Icon className={`w-2.5 h-2.5 ${sev.text}`} />
          </span>
        );
      })}
    </div>
  );
}

export default function SocSessions({ events, onInspect }) {
  const authEvents = useMemo(() => events.filter(isAuthEvent), [events]);
  const sessions = useMemo(() => summarisePerUser(authEvents), [authEvents]);
  const ipSummary = useMemo(() => summariseIps(authEvents), [authEvents]);

  const totals = useMemo(() => ({
    users: sessions.length,
    failed24h: authEvents.filter(e => classifyEvent(e) === 'failed' && Date.now() - new Date(e.created_date).getTime() < 86400000).length,
    mfa24h: authEvents.filter(e => classifyEvent(e) === 'mfa' && Date.now() - new Date(e.created_date).getTime() < 86400000).length,
    ips: ipSummary.length,
  }), [sessions.length, authEvents, ipSummary.length]);

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="grid grid-cols-4 gap-2 flex-shrink-0">
        <div className="rounded-xl border border-border bg-card p-2 text-center">
          <p className="text-lg font-bold text-sky-400">{totals.users}</p>
          <p className="text-[9px] text-muted-foreground">Users</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-2 text-center">
          <p className="text-lg font-bold text-orange-400">{totals.failed24h}</p>
          <p className="text-[9px] text-muted-foreground">Failed 24h</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-2 text-center">
          <p className="text-lg font-bold text-primary">{totals.mfa24h}</p>
          <p className="text-[9px] text-muted-foreground">MFA 24h</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-2 text-center">
          <p className="text-lg font-bold text-yellow-400">{totals.ips}</p>
          <p className="text-[9px] text-muted-foreground">Source IPs</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3 flex-1 overflow-hidden">
        <div className="bg-card border border-border rounded-2xl p-3 flex flex-col overflow-hidden">
          <p className="text-xs font-semibold mb-2 flex items-center gap-2 flex-shrink-0">
            <Users className="w-3.5 h-3.5 text-primary" /> Session monitor
          </p>
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                No authentication events in the current window.
              </div>
            ) : (
              sessions.map(s => (
                <div key={s.key} className="rounded-lg border border-border bg-secondary/30 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold truncate">{s.email || s.key}</p>
                    <span className="text-[9px] text-muted-foreground font-mono flex-shrink-0">{relativeTime(new Date(s.lastSeen).toISOString())}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-1 flex-wrap">
                    <span className="bg-sky-400/10 text-sky-400 border border-sky-400/30 rounded-sm px-1">logins {s.logins}</span>
                    <span className="bg-orange-400/10 text-orange-400 border border-orange-400/30 rounded-sm px-1">failed {s.failed}</span>
                    <span className="bg-primary/10 text-primary border border-primary/30 rounded-sm px-1">mfa {s.mfa}</span>
                    {s.ips.slice(0, 2).map(ip => (
                      <span key={ip} className="bg-secondary border border-border rounded-sm px-1 font-mono">{ip}</span>
                    ))}
                    {s.ips.length > 2 && <span>+{s.ips.length - 2}</span>}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <ActivityDots events={s.recent} />
                    <button
                      type="button"
                      onClick={() => onInspect?.(s.recent[0])}
                      className="text-[10px] text-primary hover:underline"
                    >
                      Inspect →
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-3 flex flex-col overflow-hidden">
          <p className="text-xs font-semibold mb-2 flex items-center gap-2 flex-shrink-0">
            <Network className="w-3.5 h-3.5 text-primary" /> IP intelligence
          </p>
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {ipSummary.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                No IP data in the current window.
              </div>
            ) : (
              ipSummary.map(row => {
                const dangerous = row.failed >= 3;
                return (
                  <div key={row.ip} className={`rounded-lg border p-2 ${dangerous ? 'bg-red-400/10 border-red-400/30' : 'border-border bg-secondary/30'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs font-mono font-semibold ${dangerous ? 'text-red-400' : ''}`}>
                        <MapPin className="w-3 h-3 inline mr-1 -mt-0.5" />
                        {row.ip}
                      </p>
                      <span className="text-[9px] text-muted-foreground font-mono">{relativeTime(new Date(row.lastSeen).toISOString())}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[9px] mt-1 flex-wrap">
                      <span className="text-muted-foreground">{row.total} events</span>
                      <span className="text-orange-400">· {row.failed} failed</span>
                      <span className="text-muted-foreground">· {row.users.length} user{row.users.length === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
