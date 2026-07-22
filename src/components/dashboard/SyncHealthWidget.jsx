import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Wifi, WifiOff, Cloud, RefreshCw, Loader2, CheckCircle2,
  CloudOff, Github, AlertTriangle,
} from 'lucide-react';
import { useOnline } from '@/lib/connectivity';
import * as store from '@/lib/botStudioStore';

const REPO_TS_KEY = 'app_last_repo_update';

/** Stamp the current load as the latest "repo → app" update time. A new
 *  platform deploy (triggered by a GitHub 2-way sync) reloads the app, so
 *  this timestamp is a reliable freshness proxy for GitHub→app sync. */
function stampRepoLoad() {
  try {
    const prev = localStorage.getItem(REPO_TS_KEY);
    // Only advance the timestamp — never go backwards.
    if (!prev || new Date(prev) < new Date()) {
      localStorage.setItem(REPO_TS_KEY, new Date().toISOString());
    }
  } catch { /* ignore */ }
}

function relTime(iso) {
  if (!iso) return 'never';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/**
 * SyncHealthWidget — at-a-glance dashboard card for connection + sync health.
 * Three honest rows:
 *   1. Device  — live online/offline (navigator.onLine)
 *   2. Cloud   — local data → Base44 cloud, with a live progress bar while
 *                flushing the offline write queue
 *   3. GitHub  — repo → app freshness (advances on each platform deploy)
 */
export default function SyncHealthWidget() {
  const online = useOnline();
  const [lastSync, setLastSync] = useState(store.getLastSync());
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [repoTs, setRepoTs] = useState(null);
  const rafRef = useRef(null);

  useEffect(() => {
    stampRepoLoad();
    try { setRepoTs(localStorage.getItem(REPO_TS_KEY)); } catch { setRepoTs(null); }
  }, []);

  const refreshPending = useCallback(async () => {
    const q = (await store.listAll('queue')) || [];
    setPending(q.length);
  }, []);

  useEffect(() => {
    refreshPending();
    const onNet = () => {
      setLastSync(store.getLastSync());
      refreshPending();
    };
    window.addEventListener('online', onNet);
    window.addEventListener('offline', onNet);
    return () => {
      window.removeEventListener('online', onNet);
      window.removeEventListener('offline', onNet);
    };
  }, [refreshPending]);

  // Smooth the progress bar toward 90% while syncing, snap to 100% on finish.
  const tickProgress = useCallback((target) => {
    cancelAnimationFrame(rafRef.current);
    const step = () => {
      setProgress((p) => {
        if (p >= target) return p;
        const next = p + Math.max(1, (target - p) * 0.18);
        rafRef.current = requestAnimationFrame(step);
        return next;
      });
    };
    rafRef.current = requestAnimationFrame(step);
  }, []);

  const handleSync = useCallback(async () => {
    if (!online || syncing) return;
    setSyncing(true);
    setProgress(8);
    tickProgress(90);
    try {
      await store.syncNow();
      setLastSync(store.getLastSync());
      await refreshPending();
      setProgress(100);
    } catch {
      setProgress(0);
    } finally {
      setSyncing(false);
      cancelAnimationFrame(rafRef.current);
      setTimeout(() => setProgress(0), 1200);
    }
  }, [online, syncing, refreshPending, tickProgress]);

  const cloudOk = online && pending === 0 && !!lastSync;
  const repoFresh = !!repoTs && (Date.now() - new Date(repoTs).getTime()) < 1000 * 60 * 60 * 24; // < 24h

  return (
    <div className="eru-theme-card rounded-2xl border border-border p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
            <RefreshCw className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">Sync &amp; Connection</p>
            <p className="text-[11px] text-muted-foreground leading-tight">Device · Cloud · GitHub</p>
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={!online || syncing}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 text-[12px] font-medium text-foreground disabled:opacity-40 hover:bg-accent"
          aria-label="Sync now"
        >
          {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Sync
        </button>
      </div>

      {/* Live progress bar — only visible while syncing */}
      <div className={`transition-opacity duration-200 ${syncing ? 'opacity-100' : 'opacity-0'}`}>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-150 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Rows */}
      <div className="space-y-2">
        {/* Device */}
        <Row
          icon={online ? <Wifi className="h-4 w-4 text-emerald-400" /> : <WifiOff className="h-4 w-4 text-amber-400" />}
          label="Device"
          value={online ? 'Online' : 'Offline'}
          tone={online ? 'ok' : 'warn'}
        />

        {/* Cloud */}
        <Row
          icon={
            syncing ? <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
            : pending > 0 ? <CloudOff className="h-4 w-4 text-amber-400" />
            : cloudOk ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            : <Cloud className="h-4 w-4 text-muted-foreground" />
          }
          label="Cloud sync"
          value={
            syncing ? 'Syncing local data…'
            : !online ? 'Paused (offline)'
            : pending > 0 ? `${pending} change${pending === 1 ? '' : 's'} queued`
            : lastSync ? `Up to date · ${relTime(lastSync)}`
            : 'Not synced yet'
          }
          tone={syncing ? 'busy' : !online ? 'warn' : pending > 0 ? 'warn' : cloudOk ? 'ok' : 'idle'}
        />

        {/* GitHub → app */}
        <Row
          icon={repoFresh ? <Github className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-amber-400" />}
          label="GitHub → app"
          value={repoTs ? `Repo synced · ${relTime(repoTs)}` : 'No update recorded'}
          tone={repoFresh ? 'ok' : repoTs ? 'warn' : 'idle'}
          hint={!online ? 'Reconnect to pull latest repo build' : null}
        />
      </div>
    </div>
  );
}

const TONE = {
  ok: 'text-emerald-300',
  warn: 'text-amber-300',
  busy: 'text-cyan-300',
  idle: 'text-muted-foreground',
};
const DOT = {
  ok: 'bg-emerald-400',
  warn: 'bg-amber-400',
  busy: 'bg-cyan-400',
  idle: 'bg-muted-foreground/50',
};

function Row({ icon, label, value, tone = 'idle', hint }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-background/60">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground leading-tight">{label}</p>
        <p className={`truncate text-[13px] font-medium leading-tight ${TONE[tone]}`}>{value}</p>
        {hint && <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{hint}</p>}
      </div>
      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${DOT[tone]}`} />
    </div>
  );
}