import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Key, Plus, X, Copy, Check, ShieldCheck, ShieldOff, Eye, EyeOff, AlertTriangle, Clock, Trash2 } from 'lucide-react';

const SCOPES = [
  { id: 'jackie:read', label: 'Jackie Read', desc: 'Read Jackie conversations' },
  { id: 'jackie:write', label: 'Jackie Write', desc: 'Send messages to Jackie AI' },
  { id: 'bots:read', label: 'Bots Read', desc: 'List and read AI bots' },
  { id: 'bots:write', label: 'Bots Write', desc: 'Create and modify AI bots' },
  { id: 'markets:read', label: 'Markets Read', desc: 'Access market data' },
  { id: 'portfolio:read', label: 'Portfolio Read', desc: 'Read portfolio data' },
  { id: 'messages:read', label: 'Messages Read', desc: 'Access inbox messages' },
  { id: 'admin:all', label: 'Admin (All)', desc: 'Full access — use with caution' },
];

// Generate cryptographically random key
const generateRawKey = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `sk_live_${hex}`;
};

// SHA-256 hash of the key
const hashKey = async (raw) => {
  const enc = new TextEncoder().encode(raw);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const timeAgo = (ts) => {
  if (!ts) return 'Never';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export default function APIKeys() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState([]);
  const [creating, setCreating] = useState(false);
  const [newKeyRaw, setNewKeyRaw] = useState(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState(null);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.ApiKey.list('-created_date', 50);
    setKeys(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleScope = (id) => {
    setSelectedScopes(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const createKey = async () => {
    if (!name.trim() || selectedScopes.length === 0) return;
    setCreating(true);
    const raw = generateRawKey();
    const hashed = await hashKey(raw);
    const prefix = raw.slice(0, 15) + '...';
    await base44.entities.ApiKey.create({
      name: name.trim(),
      hashed_key: hashed,
      key_prefix: prefix,
      permissions: selectedScopes,
      status: 'active',
    });
    setNewKeyRaw(raw);
    setName('');
    setSelectedScopes([]);
    setShowCreate(false);
    setCreating(false);
    load();
  };

  const revokeKey = async (key) => {
    setRevoking(key.id);
    await base44.entities.ApiKey.update(key.id, { status: 'revoked' });
    setRevoking(null);
    load();
  };

  const deleteKey = async (key) => {
    await base44.entities.ApiKey.delete(key.id);
    load();
  };

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" /> API Keys
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Manage secure access keys for external integrations</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="bg-primary text-primary-foreground rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Create Key
        </button>
      </div>

      {/* New key reveal banner */}
      {newKeyRaw && (
        <div className="mx-4 mt-4 bg-primary/10 border border-primary/30 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />
            <p className="text-sm font-semibold text-primary">Your API Key — Copy it now!</p>
          </div>
          <p className="text-[10px] text-muted-foreground">This key will <strong className="text-foreground">never be shown again</strong>. Store it somewhere safe immediately.</p>
          <div className="flex items-center gap-2 bg-secondary border border-border rounded-xl px-3 py-2">
            <code className="flex-1 text-xs text-primary font-mono break-all">{newKeyRaw}</code>
            <button onClick={() => copy(newKeyRaw)}
              className="flex-shrink-0 bg-primary text-primary-foreground rounded-lg p-1.5 hover:opacity-90 transition-opacity">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <button onClick={() => setNewKeyRaw(null)}
            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
            I've saved my key — dismiss
          </button>
        </div>
      )}

      {/* Security note */}
      <div className="mx-4 mt-4 flex items-start gap-2 bg-yellow-400/5 border border-yellow-400/20 rounded-xl px-3 py-2">
        <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <p className="text-[10px] text-yellow-400 leading-relaxed">Keys are hashed and stored securely. Only the prefix is visible after creation. Never share your API keys publicly.</p>
      </div>

      {/* Keys list */}
      <div className="px-4 mt-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center">
              <Key className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground">No API keys yet.</p>
            <button onClick={() => setShowCreate(true)}
              className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium">
              Create your first key
            </button>
          </div>
        ) : (
          keys.map(k => (
            <div key={k.id} className={`bg-card border rounded-2xl p-4 space-y-3 ${k.status === 'revoked' ? 'border-border opacity-60' : 'border-border'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {k.status === 'active' ? (
                    <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />
                  ) : (
                    <ShieldOff className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <div>
                    <p className="font-semibold text-sm">{k.name}</p>
                    <code className="text-[10px] text-muted-foreground font-mono">{k.key_prefix}</code>
                  </div>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${k.status === 'active' ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>
                  {k.status}
                </span>
              </div>

              {/* Scopes */}
              <div className="flex flex-wrap gap-1">
                {(k.permissions || []).map(p => (
                  <span key={p} className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full">{p}</span>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-border">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>Last used: {timeAgo(k.last_used_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {k.status === 'active' && (
                    <button onClick={() => revokeKey(k)} disabled={revoking === k.id}
                      className="text-[10px] bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 rounded-lg px-2.5 py-1 hover:bg-yellow-400/20 transition-colors">
                      {revoking === k.id ? 'Revoking...' : 'Revoke'}
                    </button>
                  )}
                  <button onClick={() => deleteKey(k)}
                    className="text-[10px] bg-destructive/10 text-destructive border border-destructive/20 rounded-lg px-2.5 py-1 hover:bg-destructive/20 transition-colors flex items-center gap-1">
                    <Trash2 className="w-2.5 h-2.5" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Key Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md mx-auto bg-card rounded-t-2xl border-t border-border max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="font-semibold text-sm">Create API Key</p>
              <button onClick={() => setShowCreate(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Key Name</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Production Bot, Trading Script..."
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm outline-none text-foreground placeholder:text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-medium">Permissions (Scopes)</label>
                <div className="space-y-2">
                  {SCOPES.map(s => (
                    <label key={s.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedScopes.includes(s.id) ? 'border-primary/40 bg-primary/5' : 'border-border bg-secondary/40 hover:border-border/80'}`}>
                      <input type="checkbox" checked={selectedScopes.includes(s.id)} onChange={() => toggleScope(s.id)} className="mt-0.5 accent-primary" />
                      <div>
                        <p className="text-xs font-medium text-foreground">{s.label}</p>
                        <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-border space-y-2">
              {selectedScopes.length === 0 && <p className="text-[10px] text-muted-foreground text-center">Select at least one permission scope</p>}
              <button onClick={createKey} disabled={!name.trim() || selectedScopes.length === 0 || creating}
                className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {creating ? <><div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> Generating...</> : <><Key className="w-4 h-4" /> Generate Secure Key</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}