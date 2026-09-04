import { useEffect, useState } from 'react';
import { Link2, Sparkles, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import {
  LOCAL_PROVIDERS,
  isLocalProvider,
  getProviderUrl,
  setProviderUrl,
  testProviderConnection,
} from '@/lib/localModelProviders';

const HUGGING_FACE_CONNECTOR_ID = '69d912f9261810057ced4675';
const HUGGING_FACE_DEFAULT_MODEL = 'mistralai/Mistral-7B-Instruct-v0.3';

const PROVIDERS = [
  { value: 'base44', label: 'Base44 AI', models: ['automatic'] },
  { value: 'openai', label: 'OpenAI', models: ['gpt-4o-mini', 'gpt-5-mini'] },
  { value: 'anthropic', label: 'Anthropic', models: ['claude-3-5-sonnet', 'claude-3-5-haiku'] },
  { value: 'huggingface_builder', label: 'Hugging Face (builder key)', models: ['mistralai/Mistral-7B-Instruct-v0.3', 'meta-llama/Meta-Llama-3-8B-Instruct'] },
  { value: 'huggingface_user', label: 'Hugging Face (user account)', models: ['mistralai/Mistral-7B-Instruct-v0.3', 'meta-llama/Meta-Llama-3-8B-Instruct'] },
  { value: 'ollama', label: 'Ollama (local)', models: [], local: true },
  { value: 'lmstudio', label: 'LM Studio (local)', models: [], local: true },
  { value: 'bionic', label: 'Bionic (local)', models: [], local: true },
];

export default function ModelProviderPanel({ value, onChange }) {
  const [authed, setAuthed] = useState(false);
  const [localModels, setLocalModels] = useState([]);
  const [localStatus, setLocalStatus] = useState(null);
  const [localError, setLocalError] = useState('');
  const [endpointDraft, setEndpointDraft] = useState('');

  const isLocal = isLocalProvider(value.model_provider);
  const provider = PROVIDERS.find((item) => item.value === value.model_provider) || PROVIDERS[0];

  const probeLocal = async (providerKey) => {
    setLocalStatus('testing');
    setLocalError('');
    const result = await testProviderConnection(providerKey);
    if (result.ok) {
      setLocalModels(result.models || []);
      setLocalStatus('ok');
      if (result.models?.length && !value.model_name) {
        onChange({ ...value, model_name: result.models[0] });
      }
    } else {
      setLocalModels([]);
      setLocalStatus('error');
      setLocalError(result.error);
    }
  };

  useEffect(() => {
    if (isLocal) {
      setEndpointDraft(getProviderUrl(value.model_provider));
      probeLocal(value.model_provider);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.model_provider]);

  const handleSaveEndpoint = () => {
    const clean = setProviderUrl(value.model_provider, endpointDraft);
    setEndpointDraft(clean);
    probeLocal(value.model_provider);
  };

  const checkConnection = async () => {
    try {
      await base44.functions.invoke('invokeExternalModel', { provider: 'huggingface_user', model: HUGGING_FACE_DEFAULT_MODEL, prompt: 'Hello' });
      setAuthed(true);
    } catch {
      setAuthed(false);
    }
  };

  useEffect(() => {
    base44.auth.isAuthenticated().then(async (isAuthenticated) => {
      if (!isAuthenticated) return;
      await checkConnection();
    });
  }, []);

  const handleConnect = async () => {
    const url = await base44.connectors.connectAppUser(HUGGING_FACE_CONNECTOR_ID);
    const popup = window.open(url, '_blank');
    const timer = setInterval(async () => {
      if (!popup || popup.closed) {
        clearInterval(timer);
        await checkConnection();
      }
    }, 500);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <p className="text-xs font-semibold text-foreground">External AI model</p>
      </div>

      <select
        value={value.model_provider || 'base44'}
        onChange={(e) => onChange({ model_provider: e.target.value, model_name: PROVIDERS.find((item) => item.value === e.target.value)?.models?.[0] || '' })}
        className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none"
      >
        {PROVIDERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>

      {isLocal ? (
        <div className="space-y-2 rounded-xl border border-border bg-background p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-muted-foreground">{LOCAL_PROVIDERS[value.model_provider].description}</p>
            <button onClick={() => probeLocal(value.model_provider)} className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary px-2 py-1 text-[10px] text-muted-foreground">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={endpointDraft}
              onChange={(e) => setEndpointDraft(e.target.value)}
              placeholder={LOCAL_PROVIDERS[value.model_provider].defaultBaseUrl}
              style={{ fontSize: '16px' }}
              className="flex-1 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-[11px] text-foreground outline-none"
            />
            <button onClick={handleSaveEndpoint} className="rounded-lg bg-primary px-2.5 py-1.5 text-[10px] font-semibold text-primary-foreground">
              Save
            </button>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            {localStatus === 'ok' && <><Wifi className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /><span className="text-emerald-400">Connected · {localModels.length} models</span></>}
            {localStatus === 'testing' && <><RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin flex-shrink-0" /><span className="text-muted-foreground">Probing…</span></>}
            {localStatus === 'error' && <><WifiOff className="w-3.5 h-3.5 text-red-400 flex-shrink-0" /><span className="text-red-400">{localError}</span></>}
          </div>
          {localStatus === 'ok' && localModels.length > 0 && (
            <select
              value={value.model_name || ''}
              onChange={(e) => onChange({ ...value, model_name: e.target.value })}
              className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none"
            >
              {localModels.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          {localStatus === 'ok' && localModels.length === 0 && (
            <p className="text-[11px] text-amber-400">Server reachable but no models loaded. Load a model in {LOCAL_PROVIDERS[value.model_provider].label} first.</p>
          )}
        </div>
      ) : (
        <select
          value={value.model_name || provider.models[0]}
          onChange={(e) => onChange({ ...value, model_name: e.target.value })}
          className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none"
        >
          {provider.models.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      )}

      {value.model_provider === 'huggingface_user' && (
        <div className="rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground space-y-2">
          <p>{authed ? 'Your Hugging Face account is connected.' : 'Connect your Hugging Face account to use your own models.'}</p>
          {!authed && (
            <button onClick={handleConnect} className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
              <Link2 className="w-3.5 h-3.5" /> Connect Hugging Face
            </button>
          )}
        </div>
      )}
    </div>
  );
}