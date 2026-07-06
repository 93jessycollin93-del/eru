import { useEffect, useState, useCallback } from 'react';
import { Cloud, Wifi, WifiOff, Bluetooth, RefreshCw, Loader2, CheckCircle2, XCircle, Cpu } from 'lucide-react';
import { useOnline, useConnectionInfo, hasBluetooth, requestBluetoothDevice, getConnectionInfo } from '@/lib/connectivity';
import * as store from '@/lib/botStudioStore';
import { toast } from 'sonner';

/** ConnectivityPanel — honest device capability surface. */
export default function ConnectivityPanel() {
  const online = useOnline();
  const connInfo = useConnectionInfo();
  const btSupported = hasBluetooth();
  const [lastSync, setLastSync] = useState(store.getLastSync());
  const [syncing, setSyncing] = useState(false);
  const [btDevice, setBtDevice] = useState(null);
  const [btBusy, setBtBusy] = useState(false);
  const [btError, setBtError] = useState('');

  useEffect(() => {
    const onOnline = () => {
      store.syncNow().then(() => setLastSync(store.getLastSync())).catch(() => {});
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  const handleSync = useCallback(async () => {
    if (!online) {
      toast.error("You're offline — reconnect to sync.");
      return;
    }
    setSyncing(true);
    try {
      await store.syncNow();
      setLastSync(store.getLastSync());
      toast.success('Synced with cloud.');
    } catch (e) {
      toast.error('Sync failed — will retry automatically.');
    } finally {
      setSyncing(false);
    }
  }, [online]);

  async function handleBt() {
    setBtBusy(true);
    setBtError('');
    try {
      const dev = await requestBluetoothDevice();
      setBtDevice(dev);
      toast.success(`Connected to ${dev.name}`);
    } catch (e) {
      setBtError(e.message || 'Bluetooth request failed.');
    } finally {
      setBtBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Cloud sync */}
      <Section icon={Cloud} accent="cyan" title="Cloud sync" subtitle="Base44 entities (bots, chats, messages, pods)">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12px] text-foreground">
              {lastSync ? `Last sync: ${new Date(lastSync).toLocaleString()}` : 'Never synced'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {online ? 'Auto-syncs on reconnect.' : 'Queued writes will flush when you reconnect.'}
            </p>
          </div>
          <button onClick={handleSync} disabled={syncing || !online} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sync now
          </button>
        </div>
      </Section>

      {/* Network status */}
      <Section icon={online ? Wifi : WifiOff} accent={online ? 'emerald' : 'amber'} title="Network status" subtitle="Real online/offline + connection details">
        <div className="flex items-center gap-2">
          {online ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-amber-400" />}
          <p className="text-[12px] text-foreground">{online ? 'Online' : 'Offline'}</p>
        </div>
        {connInfo ? (
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
            <Info label="Type" value={connInfo.effectiveType || '—'} />
            <Info label="Downlink" value={connInfo.downlink != null ? `${connInfo.downlink} Mbps` : '—'} />
            <Info label="RTT" value={connInfo.rtt != null ? `${connInfo.rtt} ms` : '—'} />
            <Info label="Data saver" value={connInfo.saveData ? 'On' : 'Off'} />
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Connection details aren't available on this browser (navigator.connection unsupported on iOS Safari).
          </p>
        )}
      </Section>

      {/* Bluetooth */}
      <Section icon={Bluetooth} accent="fuchsia" title="Bluetooth" subtitle="Web Bluetooth (Chrome/Android/desktop only)">
        {btSupported ? (
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              {btDevice ? (
                <p className="truncate text-[12px] text-foreground">Connected: {btDevice.name}</p>
              ) : (
                <p className="text-[12px] text-muted-foreground">No device connected.</p>
              )}
              {btError && <p className="mt-1 text-[11px] text-destructive">{btError}</p>}
            </div>
            <button onClick={handleBt} disabled={btBusy} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/10 px-3 text-sm font-semibold text-fuchsia-300 disabled:opacity-50">
              {btBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bluetooth className="h-4 w-4" />} {btDevice ? 'Reconnect' : 'Connect'}
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
            <p className="text-[12px] text-muted-foreground">
              Bluetooth is not supported on this browser. Web Bluetooth works in Chrome on Android and desktop; iOS Safari does not support it.
            </p>
          </div>
        )}
      </Section>

      {/* Device / runtime */}
      <Section icon={Cpu} accent="cyan" title="Runtime" subtitle="Platform capabilities in use">
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <Info label="IndexedDB" value={typeof indexedDB !== 'undefined' ? 'Available' : 'Unavailable'} />
          <Info label="Service worker" value={('serviceWorker' in navigator) ? 'Supported' : 'Unsupported'} />
          <Info label="Streaming" value={('ReadableStream' in window) ? 'Supported' : 'Fallback'} />
          <Info label="Install (PWA)" value={('BeforeInstallPromptEvent' in window) ? 'Supported' : 'Via Safari Share'} />
        </div>
      </Section>
    </div>
  );
}

const ACCENTS = {
  cyan: 'border-cyan-400/30 text-cyan-300 bg-cyan-500/10',
  emerald: 'border-emerald-400/30 text-emerald-300 bg-emerald-500/10',
  amber: 'border-amber-400/30 text-amber-300 bg-amber-500/10',
  fuchsia: 'border-fuchsia-400/30 text-fuchsia-300 bg-fuchsia-500/10',
};

function Section({ icon: Icon, accent, title, subtitle, children }) {
  return (
    <div className="eru-theme-card rounded-2xl border border-border p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${ACCENTS[accent]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-[12px] text-foreground">{value}</p>
    </div>
  );
}