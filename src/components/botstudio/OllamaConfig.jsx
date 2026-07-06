import { useState } from 'react';
import { Cpu, Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { getOllamaUrl, setOllamaUrl, testConnection } from '@/lib/ollama';
import { useOnline } from '@/lib/connectivity';

/**
 * OllamaConfig — editable base URL + Test connection + live status badge.
 * Calls onModels(models) when a test succeeds so the editor can populate its
 * model dropdown.
 */
export default function OllamaConfig({ onModels }) {
  const online = useOnline();
  const [url, setUrl] = useState(getOllamaUrl());
  const [status, setStatus] = useState(null); // { ok, models, error }
  const [testing, setTesting] = useState(false);

  async function handleTest() {
    setTesting(true);
    const cleaned = setOllamaUrl(url);
    setUrl(cleaned);
    const res = await testConnection(cleaned);
    setStatus(res);
    if (res.ok) onModels?.(res.models);
    setTesting(false);
  }

  return (
    <div className="eru-theme-card rounded-2xl border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-500/10 text-cyan-300">
          <Cpu className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Ollama host</p>
          <p className="text-[11px] text-muted-foreground">
            Run Ollama on your computer; reach it from this device.
          </p>
        </div>
        <StatusBadge online={online} status={status} />
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://localhost:11434"
          className="h-11 flex-1 rounded-xl border border-border bg-secondary/60 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
        />
        <button
          onClick={handleTest}
          disabled={testing || !online}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Test
        </button>
      </div>

      {status && (
        <div className={`rounded-xl border px-3 py-2 text-[12px] ${status.ok ? 'border-primary/30 bg-primary/10 text-primary' : 'border-destructive/30 bg-destructive/10 text-destructive'}`}>
          <div className="flex items-start gap-2">
            {status.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />}
            <div>
              {status.ok ? (
                <span>Connected · {status.models.length} model{status.models.length === 1 ? '' : 's'} available.</span>
              ) : (
                <span>{status.error}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {!online && (
        <p className="text-[11px] text-amber-300">
          You're offline — Ollama test is disabled. Reconnect to test your host.
        </p>
      )}
    </div>
  );
}

function StatusBadge({ online, status }) {
  if (!online) {
    return <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">Offline</span>;
  }
  if (!status) {
    return <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Not tested</span>;
  }
  if (status.ok) {
    return <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Online</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">Unreachable</span>;
}