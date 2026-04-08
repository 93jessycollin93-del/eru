import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Key, Plus, X, Copy, Check, ShieldCheck, ShieldOff, AlertTriangle, Clock, Trash2, Crown, Zap, Eye, BookOpen, Rocket, Star } from 'lucide-react';

const TIERS = [
  {
    id: 1, label: 'Tier 1 — Observer', icon: Eye, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20',
    desc: 'Read-only access to markets and public data.',
    scopes: ['markets:read', 'portfolio:read'],
  },
  {
    id: 2, label: 'Tier 2 — Builder', icon: BookOpen, color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20',
    desc: 'Use and chat with AI bots.',
    scopes: ['markets:read', 'portfolio:read', 'bots:read', 'messages:read'],
  },
  {
    id: 3, label: 'Tier 3 — Operator', icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20',
    desc: 'Create and execute custom bots.',
    scopes: ['markets:read', 'portfolio:read', 'bots:read', 'bots:write', 'messages:read', 'jackie:read'],
  },
  {
    id: 4, label: 'Tier 4 — Publisher', icon: Rocket, color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20',
    desc: 'Publish to marketplace + full Jackie access.',
    scopes: ['markets:read', 'portfolio:read', 'bots:read', 'bots:write', 'messages:read', 'jackie:read', 'jackie:write'],
  },
  {
    id: 5, label: 'Tier 5 — Automator', icon: Crown, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20',
    desc: 'Full automation. All permissions unlocked.',
    scopes: ['markets:read', 'portfolio:read', 'bots:read', 'bots:write', 'messages:read', 'jackie:read', 'jackie:write', 'admin:all'],
  },
];

const generateRawKey = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `sk_live_${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')}`;
};

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
  const [selectedTier, setSelectedTier] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newKeyRaw, setNewKeyRaw] = useState(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState(null);
  const [activeTab, setActiveTab] = useState('keys');

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.ApiKey.list('-created_date', 50);
    setKeys(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createKey = async () => {
    if (!name.trim() || !selectedTier) return;
    setCreating(true);
    const tier = TIERS.find(t => t.id === selectedTier);
    const raw = generateRawKey();
    const hashed = await hashKey(raw);
    const prefix = raw.slice(0, 15) + '...';
    await base44.entities.ApiKey.create({
      name: name.trim(),
      hashed_key: hashed,
      key_prefix: prefix,
      permissions: tier.scopes,
      status: 'active',
    });
    setNewKeyRaw(raw);
    setName(''); setSelectedTier(null); setShowCreate(false);
    setCreating(false);
    load();
  };

  const revokeKey = async (key) => {
    setRevoking(key.id);
    await base44.entities.ApiKey.update(key.id, { status: 'revoked' });
    setRevoking(null);
    load();
  };

  const deleteKey = async (id) => {
    await base44.entities.ApiKey.delete(id);
    load();
  };

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTierForKey = (key) => {
    if (!key.permissions) return null;
    return TIERS.slice().reverse().find(t => t.scopes.every(s => key.permissions.includes(s)));
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" /> API Keys
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Tiered access control for external integrations</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="bg-primary text-primary-foreground rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> New Key
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {[{ id: 'keys', label: 'My Keys' }, { id: 'tiers', label: 'Access Tiers' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${activeTab === t.id ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* New key reveal */}
        {newKeyRaw && (
          <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />
              <p className="text-sm font-semibold text-primary">Copy your key — shown only once!</p>
            </div>
            <div className="flex items-center gap-2 bg-secondary border border-border rounded-xl px-3 py-2">
              <code className="flex-1 text-xs text-primary font-mono break-all">{newKeyRaw}</code>
              <button onClick={() => copy(newKeyRaw)} className="flex-shrink-0 bg-primary text-primary-foreground rounded-lg p-1.5">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <button onClick={() => setNewKeyRaw(null)} className="w-full text-xs text-muted-foreground py-1">
              I've saved my key — dismiss
            </button>
          </div>
        )}

        {activeTab === 'tiers' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Each API key is assigned a tier that controls what it can access. Higher tiers include all permissions from lower tiers.</p>
            {TIERS.map(tier => {
              const Icon = tier.icon;
              return (
                <div key={tier.id} className={`rounded-2xl border p-4 space-y-2 ${tier.bg} ${tier.border}`}>
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${tier.color} flex-shrink-0`} />
                    <div className="flex-1">
                      <p className={`text-sm font-bold ${tier.color}`}>{tier.label}</p>
                      <p className="text-[10px] text-muted-foreground">{tier.desc}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${tier.bg} ${tier.color} border ${tier.border}`}>T{tier.id}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {tier.scopes.map(s => (
                      <span key={s} className={`text-[9px] px-1.5 py-0.5 rounded-full bg-black/20 ${tier.color} font-mono`}>{s}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'keys' && (
          <>
            <div className="flex items-start gap-2 bg-yellow-400/5 border border-yellow-400/20 rounded-xl px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-yellow-400">Keys are hashed and never stored in plaintext. Raw key shown only once at creation.</p>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : keys.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center">
                  <Key className="w-7 h-7 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground">No API keys yet.</p>
                <button onClick={() => setShowCreate(true)} className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium">
                  Create your first key
                </button>
              </div>
            ) : keys.map(k => {
              const tier = getTierForKey(k);
              const TierIcon = tier?.icon || Key;
              return (
                <div key={k.id} className={`bg-card border rounded-2xl p-4 space-y-3 ${k.status === 'revoked' ? 'opacity-50' : 'border-border'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <TierIcon className={`w-4 h-4 flex-shrink-0 ${tier?.color || 'text-muted-foreground'}`} />
                      <div>
                        <p className="font-semibold text-sm">{k.name}</p>
                        <code className="text-[10px] text-muted-foreground font-mono">{k.key_prefix}</code>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {tier && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${tier.bg} ${tier.color} border ${tier.border}`}>T{tier.id}</span>}
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${k.status === 'active' ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>
                        {k.status}
                      </span>
                    </div>
                  </div>
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
                          {revoking === k.id ? '...' : 'Revoke'}
                        </button>
                      )}
                      <button onClick={() => deleteKey(k.id)}
                        className="text-[10px] bg-destructive/10 text-destructive border border-destructive/20 rounded-lg px-2.5 py-1 flex items-center gap-1">
                        <Trash2 className="w-2.5 h-2.5" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Create Modal */}
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
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm outline-none text-foreground" />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-medium">Select Access Tier</label>
                {TIERS.map(tier => {
                  const Icon = tier.icon;
                  const selected = selectedTier === tier.id;
                  return (
                    <button key={tier.id} onClick={() => setSelectedTier(tier.id)}
                      className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${selected ? `${tier.bg} ${tier.border}` : 'border-border bg-secondary/40 hover:border-border/80'}`}>
                      <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${selected ? tier.color : 'text-muted-foreground'}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`text-xs font-bold ${selected ? tier.color : 'text-foreground'}`}>{tier.label}</p>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{tier.desc}</p>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {tier.scopes.map(s => (
                            <span key={s} className={`text-[8px] px-1 py-0.5 rounded font-mono ${selected ? `${tier.bg} ${tier.color}` : 'bg-secondary text-muted-foreground'}`}>{s}</span>
                          ))}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-border">
              <button onClick={createKey} disabled={!name.trim() || !selectedTier || creating}
                className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {creating ? <><div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> Generating...</> : <><Key className="w-4 h-4" /> Generate Key</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}