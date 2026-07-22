import { useEffect, useState, useCallback } from 'react';
import { Cloud, RefreshCw, Loader2, CheckCircle2, Wifi, WifiOff, CloudOff } from 'lucide-react';
import { useOnline } from '@/lib/connectivity';
import * as store from '@/lib/botStudioStore';

/**
 * ConnectionStatus — compact, always-visible strip that gives an at-a-glance
 * read of device connectivity and cloud-sync health. Sits at the top of the
 * Bot Studio so the status dashboard is immediately clear without navigating
 * to the Connectivity tab.
 */
function relTime(iso) {
  if (!iso) return 'never';
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return d.toLocaleDateString();
}

export default function ConnectionStatus() {
  const online = useOnline();
  const [lastSync, setLastSync] = useState(store.getLastSync());
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshPending = useCallback(async () => {
    const q = (await store.listAll('queue')) || [];
    setPending(q.length);
  }, []);

  useEffect(() => {
    refreshPending();
    const onOnline = () => {
      setLastSync(store.getLastSync());
      refreshPending();
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOnline);
    };
  }, [refreshPending]);

  const handleSync = useCallback(async () => {
    if (!online) return;
    setSyncing(true);
    try {
      await store.syncNow();
      setLastSync(store.getLastSync());
      await refreshPending();
    } catch {
      /* keep last state; toast handled elsewhere */
    } finally {
      setSyncing(false);
    }
  }, [online, refreshPending]);

  const synced = online && pending === 0 && lastSync;
  const hasPending = pending > 0;

  return (
    <div className="eru-theme-card flex items-center gap-3 rounded-2xl border border-border px-3 py-2.5">
      {/* Online/offline */}
      <div className="flex items-center gap-1.5">
        {online ? (
          <Wifi className="h-4 w-4 text-emerald-400" />
        ) : (
          <WifiOff className="h-4 w-4 text-amber-400" />
        )}
        <span className={`text-[12px] font-medium ${online ? 'text-emerald-300' : 'text-amber-300'}`}>
          {online ? 'Online' : 'Offline'}
        </span>
      </div>

      <div className="h-4 w-px bg-border" />

      {/* Cloud sync state */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {syncing ? (
          <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
        ) : hasPending ? (
          <CloudOff className="h-4 w-4 text-amber-400" />
        ) : synced ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        ) : (
          <Cloud className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="truncate text-[12px] text-foreground">
          {syncing
            ? 'Syncing to cloud…'
            : hasPending
            ? `${pending} change${pending === 1 ? '' : 's'} queued`
            : online
            ? `Cloud synced · ${relTime(lastSync)}`
            : 'Cloud paused (offline)'}
        </span>
      </div>

      {/* Sync button */}
      <button
        onClick={handleSync}
        disabled={!online || syncing}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-secondary px-2.5 text-[12px] font-medium text-foreground disabled:opacity-40 hover:bg-accent"
        aria-label="Sync now"
      >
        {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        Sync
      </button>
    </div>
  );
}