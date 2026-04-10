import { useEffect, useState } from 'react';
import { Link2, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const HUGGING_FACE_CONNECTOR_ID = '69d912f9261810057ced4675';

export default function ExternalAISettingsPanel({ value = {}, onChange }) {
  const [user, setUser] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkConnection = async () => {
    try {
      await base44.functions.invoke('invokeHuggingFaceUserModel', { model: 'google/flan-t5-base', prompt: 'ping' });
      setConnected(true);
    } catch {
      setConnected(false);
    }
  };

  useEffect(() => {
    base44.auth.isAuthenticated().then(async (authed) => {
      if (authed) {
        const me = await base44.auth.me();
        setUser(me);
        await checkConnection();
      }
      setLoading(false);
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

  const handleDisconnect = async () => {
    await base44.connectors.disconnectAppUser(HUGGING_FACE_CONNECTOR_ID);
    setConnected(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <p className="text-xs font-semibold text-foreground">External AI Models</p>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <select value={value.provider || 'base44'} onChange={(e) => onChange?.({ ...value, provider: e.target.value })} className="rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none">
          <option value="base44">Base44 AI</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="huggingface_user">Hugging Face (user)</option>
        </select>
        <input value={value.model || ''} onChange={(e) => onChange?.({ ...value, model: e.target.value })} placeholder="Model name" className="rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none" />
        <input value={value.api_label || ''} onChange={(e) => onChange?.({ ...value, api_label: e.target.value })} placeholder="Display label" className="rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none" />
      </div>

      {loading ? (
        <div className="text-[11px] text-muted-foreground">Checking user connection…</div>
      ) : !user ? (
        <button onClick={() => base44.auth.redirectToLogin()} className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground">Sign in to connect Hugging Face</button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleConnect} className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
            <Link2 className="w-3.5 h-3.5" /> Connect Hugging Face
          </button>
          <button onClick={handleDisconnect} disabled={!connected} className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-40">
            Disconnect
          </button>
          <span className={`text-[11px] ${connected ? 'text-green-400' : 'text-muted-foreground'}`}>{connected ? 'Connected' : 'Not connected'}</span>
        </div>
      )}
    </div>
  );
}