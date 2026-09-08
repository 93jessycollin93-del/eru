import { useState, useEffect } from 'react';
import { X, Wifi, WifiOff, RefreshCw, Cpu, Check, ExternalLink, Smartphone } from 'lucide-react';
import {
  LOCAL_PROVIDERS,
  isLocalProvider,
  getProviderUrl,
  setProviderUrl,
  testProviderConnection,
} from '@/lib/localModelProviders';

const PROVIDER_OPTIONS = [
  { value: 'base44', label: 'Base44 AI', desc: 'Built-in cloud' },
  { value: 'ollama', label: 'Ollama', desc: 'localhost:11434' },
  { value: 'lmstudio', label: 'LM Studio', desc: 'localhost:1234' },
  { value: 'bionic', label: 'Bionic', desc: 'LM Studio agent' },
  { value: 'offgrid', label: 'Off-Grid-AI', desc: 'localhost:1337' },
  { value: 'pocketpal', label: 'PocketPal', desc: 'On-device mobile' },
];

export default function LocalModelConnector({ open, onClose, provider, model, onChange }) {
  const [endpointDraft, setEndpointDraft] = useState('');
  const [models, setModels] = useState([]);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');

  const isLocal = isLocalProvider(provider);
  const isApp = LOCAL_PROVIDERS[provider]?.type === 'app';
  const providerConfig = LOCAL_PROVIDERS[provider];

  const probe = async (key) => {
    setStatus('testing');
    setError('');
    const result = await testProviderConnection(key);
    if (result.ok) {
      setModels(result.models || []);
      setStatus('ok');
      if (result.models?.length && !model) {
        onChange({ model: result.models[0] });
      }
    } else {
      setModels([]);
      setStatus('error');
      setError(result.error);
    }
  };

  useEffect(() => {
    if (open && isLocal && !isApp) {
      setEndpointDraft(getProviderUrl(provider));
      probe(provider);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, provider]);

  const saveEndpoint = () => {
    setProviderUrl(provider, endpointDraft);
    probe(provider);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-card p-4 space-y-3 eru-enter max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Model Connection</p>
          </div>
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {PROVIDER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ provider: opt.value, model: '' })}
              className={`flex flex-col items-start gap-0.5 rounded-xl border p-2.5 text-left transition-all ${provider === opt.value ? 'border-primary/40 bg-primary/10' : 'border-border bg-secondary/30 hover:border-primary/20'}`}
            >
              <span className={`text-xs font-semibold ${provider === opt.value ? 'text-primary' : 'text-foreground'}`}>{opt.label}</span>
              <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
            </button>
          ))}
        </div>

        {isLocal && !isApp && (
          <div className="space-y-2.5 rounded-xl border border-border bg-background p-3">
            <p className="text-[11px] text-muted-foreground">{providerConfig.description}</p>
            <div className="flex items-center gap-2">
              <input
                value={endpointDraft}
                onChange={(e) => setEndpointDraft(e.target.value)}
                placeholder={providerConfig.defaultBaseUrl}
                style={{ fontSize: '16px' }}
                className="flex-1 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-[11px] text-foreground outline-none focus:border-primary/40"
              />
              <button onClick={saveEndpoint} className="rounded-lg bg-primary px-3 py-1.5 text-[10px] font-semibold text-primary-foreground">
                Save
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              {status === 'ok' && (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span className="text-emerald-400">Connected · {models.length} models</span>
                </>
              )}
              {status === 'testing' && (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin flex-shrink-0" />
                  <span className="text-muted-foreground">Probing…</span>
                </>
              )}
              {status === 'error' && (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                  <span className="text-red-400 line-clamp-2">{error}</span>
                </>
              )}
              <button onClick={() => probe(provider)} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border bg-secondary px-2 py-1 text-[10px] text-muted-foreground">
                <RefreshCw className="w-3 h-3" /> Rescan
              </button>
            </div>
            {status === 'ok' && models.length > 0 && (
              <select
                value={model || ''}
                onChange={(e) => onChange({ model: e.target.value })}
                className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none focus:border-primary/40"
              >
                {models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}
            {status === 'ok' && models.length === 0 && (
              <p className="text-[11px] text-amber-400">Server reachable but no models loaded. Load a model in {providerConfig.label} first.</p>
            )}
            <p className="text-[10px] text-muted-foreground">
              Tip: enable CORS on your server (Ollama: set <code className="text-primary">OLLAMA_ORIGINS</code>; LM Studio: toggle CORS in server settings).
            </p>
          </div>
        )}

        {isApp && (
          <div className="flex items-start gap-2.5 rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground">
            <Smartphone className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p>{providerConfig.note}</p>
              <a href={providerConfig.appUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                <ExternalLink className="w-3 h-3" /> Get {providerConfig.label}
              </a>
            </div>
          </div>
        )}

        {!isLocal && (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground">
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Using Base44's built-in AI — no configuration needed.</span>
          </div>
        )}
      </div>
    </div>
  );
}