import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  Store, Plus, RefreshCw, Settings, Plug, AlertCircle, CheckCircle2,
  Clock, XCircle, Search, Filter, Gem, Image, Bot, Sword, Package,
  Globe, Lock, ChevronRight, Wifi, WifiOff, Loader2, ExternalLink,
  ToggleLeft, ToggleRight, Edit2, Trash2, Shield, Activity,
  Square, CheckSquare, Send, BarChart2
} from 'lucide-react';
import { Link } from 'react-router-dom';

// ─── CONNECTOR PRESETS (templates for adding new connectors) ──────────────────
const CONNECTOR_TEMPLATES = [
  { name: 'OpenSea-style NFT Market', connector_type: 'nft_marketplace', icon: '🖼️', desc: 'ERC-721/1155 NFT marketplace adapter' },
  { name: 'Crypto Asset Exchange', connector_type: 'crypto_exchange', icon: '₿', desc: 'Token & crypto asset trading layer' },
  { name: 'Game Item Marketplace', connector_type: 'game_items', icon: '⚔️', desc: 'In-game items & cards trading platform' },
  { name: 'Digital Goods Market', connector_type: 'digital_goods', icon: '📦', desc: 'Generic digital product marketplace' },
  { name: 'Custom API Connector', connector_type: 'custom_api', icon: '🔌', desc: 'Build a custom marketplace integration' },
];

const ASSET_ICONS = { jade: Gem, nft: Image, bot: Bot, card: Sword, item: Package, collectible: Package };
const ASSET_COLORS = { jade: 'text-green-400', nft: 'text-purple-400', bot: 'text-blue-400', card: 'text-orange-400', item: 'text-yellow-400', collectible: 'text-pink-400' };

const STATUS_CONFIG = {
  active:       { icon: CheckCircle2, color: 'text-green-400',  bg: 'bg-green-500/10',  label: 'Active' },
  inactive:     { icon: XCircle,      color: 'text-muted-foreground', bg: 'bg-secondary', label: 'Inactive' },
  error:        { icon: AlertCircle,  color: 'text-red-400',    bg: 'bg-red-500/10',    label: 'Error' },
  pending_auth: { icon: Clock,        color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'Auth Needed' },
};

const SYNC_CONFIG = {
  synced:        { icon: CheckCircle2, color: 'text-green-400',  label: 'Synced' },
  pending:       { icon: Clock,        color: 'text-yellow-400', label: 'Pending' },
  failed:        { icon: AlertCircle,  color: 'text-red-400',    label: 'Failed' },
  not_connected: { icon: WifiOff,      color: 'text-muted-foreground', label: 'Not Connected' },
};

// ─── SUBCOMPONENTS ────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.inactive;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-2.5 h-2.5" /> {cfg.label}
    </span>
  );
}

function SyncBadge({ status }) {
  const cfg = SYNC_CONFIG[status] || SYNC_CONFIG.not_connected;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] ${cfg.color}`}>
      <Icon className="w-2.5 h-2.5" /> {cfg.label}
    </span>
  );
}

function ConnectorCard({ connector, onToggle, onEdit, onDelete, isAdmin }) {
  const sc = STATUS_CONFIG[connector.status] || STATUS_CONFIG.inactive;
  const Icon = sc.icon;
  return (
    <div className={`rounded-xl border p-4 transition-all ${connector.is_enabled ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
            <Plug className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">{connector.name}</p>
            <p className="text-[10px] text-muted-foreground capitalize">{connector.connector_type?.replace('_', ' ')}</p>
          </div>
        </div>
        <StatusBadge status={connector.status} />
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {(connector.supported_asset_types || []).map(t => {
          const AIcon = ASSET_ICONS[t] || Package;
          return (
            <span key={t} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-secondary text-[9px] ${ASSET_COLORS[t]}`}>
              <AIcon className="w-2.5 h-2.5" /> {t}
            </span>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-3">
        <span>Last sync: {connector.last_sync_at ? new Date(connector.last_sync_at).toLocaleDateString() : 'Never'}</span>
        <span>{connector.total_listings_synced || 0} listings synced</span>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-2 pt-3 border-t border-border">
          <button onClick={() => onToggle(connector)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-1 justify-center ${connector.is_enabled ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
            {connector.is_enabled ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
            {connector.is_enabled ? 'Enabled' : 'Disabled'}
          </button>
          <button onClick={() => onEdit(connector)} className="p-1.5 rounded-lg bg-secondary hover:bg-border transition-colors">
            <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button onClick={() => onDelete(connector)} className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors">
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      )}
    </div>
  );
}

function ListingCard({ listing, connectors, onEdit, selected, onSelect }) {
  const AssetIcon = ASSET_ICONS[listing.asset_type] || Package;
  const syncs = listing.external_syndications || [];
  const syncedCount = syncs.filter(s => s.sync_status === 'synced').length;
  const failedCount = syncs.filter(s => s.sync_status === 'failed').length;

  return (
    <div
      className={`rounded-xl border bg-card p-4 space-y-3 transition-colors ${selected ? 'border-primary bg-primary/5' : 'border-border'}`}
      onClick={() => onSelect && onSelect(listing.id)}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {onSelect && (
          <div className="mr-1 flex-shrink-0">
            {selected
              ? <CheckSquare className="w-4 h-4 text-primary" />
              : <Square className="w-4 h-4 text-muted-foreground" />}
          </div>
        )}
        <AssetIcon className={`w-4 h-4 ${ASSET_COLORS[listing.asset_type]}`} />
          <div>
            <p className="text-sm font-medium">{listing.title}</p>
            <p className="text-[10px] text-muted-foreground capitalize">{listing.asset_type}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-mono text-primary">{listing.base_price} {listing.currency}</p>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
            listing.status === 'active' ? 'bg-green-500/10 text-green-400' :
            listing.status === 'error' ? 'bg-red-500/10 text-red-400' :
            'bg-secondary text-muted-foreground'
          }`}>{listing.status}</span>
        </div>
      </div>

      {/* Syndication status row */}
      <div className="flex items-center gap-2 text-[10px]">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Globe className="w-3 h-3" />
          <span>Internal</span>
          {listing.internal_listed
            ? <CheckCircle2 className="w-3 h-3 text-green-400" />
            : <XCircle className="w-3 h-3 text-muted-foreground" />}
        </div>
        {syncs.length > 0 && (
          <div className="flex items-center gap-1 ml-auto">
            {syncedCount > 0 && <span className="text-green-400">{syncedCount} synced</span>}
            {failedCount > 0 && <span className="text-red-400">{failedCount} failed</span>}
            {syncs.length - syncedCount - failedCount > 0 && (
              <span className="text-muted-foreground">{syncs.length - syncedCount - failedCount} pending</span>
            )}
          </div>
        )}
      </div>

      {syncs.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-border">
          {syncs.map((s, i) => (
            <div key={i} className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">{s.connector_name}</span>
              <div className="flex items-center gap-2">
                {s.custom_price && <span className="text-foreground font-mono">{s.custom_price}</span>}
                <SyncBadge status={s.sync_status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ADD CONNECTOR MODAL ──────────────────────────────────────────────────────
function AddConnectorModal({ onClose, onSave }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '', connector_type: '', api_endpoint: '', api_key_ref: '',
    auth_type: 'api_key', supported_asset_types: [], is_enabled: false,
    read_only_fallback: true, sync_frequency_minutes: 60,
    capabilities: ['read'], status: 'inactive'
  });
  const [saving, setSaving] = useState(false);

  const toggleAsset = (t) => setForm(f => ({
    ...f,
    supported_asset_types: f.supported_asset_types.includes(t)
      ? f.supported_asset_types.filter(x => x !== t)
      : [...f.supported_asset_types, t]
  }));

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={onClose}>
      <div className="w-full max-w-md bg-card rounded-t-2xl border-t border-border p-5 space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Add Marketplace Connector</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><XCircle className="w-5 h-5" /></button>
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Choose a connector template:</p>
            {CONNECTOR_TEMPLATES.map(t => (
              <button key={t.connector_type}
                onClick={() => { setForm(f => ({ ...f, name: t.name, connector_type: t.connector_type })); setStep(2); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-secondary hover:border-primary/30 transition-all text-left">
                <span className="text-xl">{t.icon}</span>
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Connector Name</label>
              <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">API Endpoint (optional)</label>
              <input value={form.api_endpoint} onChange={e => setForm(f => ({...f, api_endpoint: e.target.value}))}
                placeholder="https://api.marketplace.com/v1"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/50 font-mono" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">API Key Label (reference only — never stored raw)</label>
              <input value={form.api_key_ref} onChange={e => setForm(f => ({...f, api_key_ref: e.target.value}))}
                placeholder="e.g. OPENSEA_API_KEY"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/50 font-mono" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Supported Asset Types</label>
              <div className="flex flex-wrap gap-2">
                {['jade','nft','bot','card','item','collectible'].map(t => {
                  const AIcon = ASSET_ICONS[t];
                  const selected = form.supported_asset_types.includes(t);
                  return (
                    <button key={t} onClick={() => toggleAsset(t)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-colors ${selected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                      <AIcon className="w-3 h-3" /> {t}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-secondary rounded-xl border border-border">
              <div>
                <p className="text-xs font-medium">Read-Only Fallback</p>
                <p className="text-[10px] text-muted-foreground">Use read-only mode if write access fails</p>
              </div>
              <button onClick={() => setForm(f => ({...f, read_only_fallback: !f.read_only_fallback}))}
                className={`w-9 h-5 rounded-full relative transition-colors ${form.read_only_fallback ? 'bg-primary' : 'bg-border'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.read_only_fallback ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setStep(1)} className="flex-1 py-2.5 text-sm bg-secondary rounded-xl">Back</button>
              <button onClick={handleSave} disabled={!form.name || saving}
                className="flex-1 py-2.5 text-sm bg-primary text-primary-foreground rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Connector
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CREATE LISTING MODAL ─────────────────────────────────────────────────────
function CreateListingModal({ connectors, onClose, onSave }) {
  const [form, setForm] = useState({
    title: '', asset_type: 'jade', base_price: '', currency: 'GOLD',
    description: '', asset_id: 'manual', internal_listed: true,
    external_syndications: [], status: 'draft', region_availability: ['global'],
    image_url: '', tags: '', rarity: 'common',
  });
  const [saving, setSaving] = useState(false);
  const activeConnectors = connectors.filter(c => c.is_enabled);

  const toggleSyndication = (c) => {
    setForm(f => {
      const exists = f.external_syndications.find(s => s.connector_id === c.id);
      if (exists) return { ...f, external_syndications: f.external_syndications.filter(s => s.connector_id !== c.id) };
      return { ...f, external_syndications: [...f.external_syndications, {
        connector_id: c.id, connector_name: c.name, enabled: true,
        sync_status: 'pending', custom_price: null, external_listing_id: null
      }]};
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const tags = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    await onSave({ ...form, base_price: parseFloat(form.base_price) || 0, tags, asset_snapshot: { title: form.title, type: form.asset_type, rarity: form.rarity, image_url: form.image_url } });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={onClose}>
      <div className="w-full max-w-md bg-card rounded-t-2xl border-t border-border p-5 space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Create Storefront Listing</h3>
          <button onClick={onClose}><XCircle className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Title</label>
            <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/50" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">Asset Type</label>
              <select value={form.asset_type} onChange={e => setForm(f => ({...f, asset_type: e.target.value}))}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm outline-none">
                {['jade','nft','bot','card','item','collectible'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">Price</label>
              <input type="number" value={form.base_price} onChange={e => setForm(f => ({...f, base_price: e.target.value}))}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/50 font-mono" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Currency</label>
            <select value={form.currency} onChange={e => setForm(f => ({...f, currency: e.target.value}))}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm outline-none">
              {['GOLD','TON','CRYPTO','TELEGRAM_STARS'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {form.asset_type === 'nft' && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Rarity</label>
              <select value={form.rarity} onChange={e => setForm(f => ({...f, rarity: e.target.value}))}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm outline-none">
                {['common','uncommon','rare','epic','legendary','mythic'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Image URL (optional)</label>
            <input value={form.image_url} onChange={e => setForm(f => ({...f, image_url: e.target.value}))}
              placeholder="https://…"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/50 font-mono" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
              rows={2} className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/50 resize-none" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Tags (comma-separated)</label>
            <input value={form.tags} onChange={e => setForm(f => ({...f, tags: e.target.value}))}
              placeholder="e.g. rare, art, pixel, 3d"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/50" />
          </div>

          {/* Syndication targets */}
          {activeConnectors.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Syndicate to External Markets</label>
              {activeConnectors.map(c => {
                const selected = form.external_syndications.some(s => s.connector_id === c.id);
                return (
                  <button key={c.id} onClick={() => toggleSyndication(c)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-sm transition-all ${selected ? 'border-primary bg-primary/5' : 'border-border bg-secondary'}`}>
                    <div className="flex items-center gap-2">
                      <Plug className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{c.name}</span>
                    </div>
                    {selected ? <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> : <div className="w-3.5 h-3.5 rounded-full border border-border" />}
                  </button>
                );
              })}
            </div>
          )}
          {activeConnectors.length === 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-xl text-[11px] text-muted-foreground">
              <WifiOff className="w-3.5 h-3.5" />
              No active connectors — listing will be internal only
            </div>
          )}

          <button onClick={handleSave} disabled={!form.title || !form.base_price || saving}
            className="w-full py-2.5 text-sm bg-primary text-primary-foreground rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Publish Listing
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'storefront', label: 'Storefront', Icon: Store },
  { id: 'connectors', label: 'Connectors', Icon: Plug },
  { id: 'admin',      label: 'Admin',      Icon: Shield },
];

export default function StorefrontHub() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [tab, setTab] = useState('storefront');
  const [listings, setListings] = useState([]);
  const [connectors, setConnectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterMarket, setFilterMarket] = useState('all');
  const [showAddConnector, setShowAddConnector] = useState(false);
  const [showCreateListing, setShowCreateListing] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkPushing, setBulkPushing] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  const load = async () => {
    setLoading(true);
    const [l, c] = await Promise.all([
      base44.entities.StorefrontListing.list('-created_date', 50),
      base44.entities.MarketConnector.list('-created_date', 50).catch(() => []),
    ]);
    setListings(l);
    setConnectors(c);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filteredListings = listings.filter(l => {
    const matchSearch = !search || l.title?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || l.asset_type === filterType;
    const matchMarket = filterMarket === 'all'
      || (filterMarket === 'internal' && l.internal_listed)
      || (filterMarket !== 'internal' && (l.external_syndications || []).some(s => s.connector_id === filterMarket));
    return matchSearch && matchType && matchMarket;
  });

  const handleSaveConnector = async (data) => {
    await base44.entities.MarketConnector.create(data);
    setShowAddConnector(false);
    load();
  };

  const handleToggleConnector = async (c) => {
    await base44.entities.MarketConnector.update(c.id, { is_enabled: !c.is_enabled, status: !c.is_enabled ? 'pending_auth' : 'inactive' });
    load();
  };

  const handleDeleteConnector = async (c) => {
    await base44.entities.MarketConnector.delete(c.id);
    load();
  };

  const handleCreateListing = async (data) => {
    await base44.entities.StorefrontListing.create(data);
    setShowCreateListing(false);
    load();
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredListings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredListings.map(l => l.id)));
    }
  };

  const handleBulkPush = async () => {
    if (!activeConnectors.length || !selectedIds.size) return;
    setBulkPushing(true);
    setBulkResult(null);
    let pushed = 0;
    let failed = 0;
    for (const id of selectedIds) {
      const listing = listings.find(l => l.id === id);
      if (!listing) continue;
      const existing = listing.external_syndications || [];
      const updated = [...existing];
      for (const c of activeConnectors) {
        if (!updated.find(s => s.connector_id === c.id)) {
          updated.push({ connector_id: c.id, connector_name: c.name, enabled: true, sync_status: 'pending', custom_price: null, external_listing_id: null });
        }
      }
      try {
        await base44.entities.StorefrontListing.update(id, { external_syndications: updated });
        pushed++;
      } catch {
        failed++;
      }
    }
    setBulkResult({ pushed, failed });
    setBulkPushing(false);
    setSelectedIds(new Set());
    load();
  };

  const activeConnectors = connectors.filter(c => c.is_enabled);
  const totalSynced = listings.reduce((sum, l) => sum + (l.external_syndications || []).filter(s => s.sync_status === 'synced').length, 0);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-card/90 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <Store className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Storefront Network</h2>
          <Link to="/storefront-analytics" className="ml-auto p-1.5 rounded-lg bg-secondary hover:bg-border transition-colors">
          <BarChart2 className="w-3.5 h-3.5 text-muted-foreground" />
        </Link>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Unified listing hub with external marketplace connectors</p>
      </div>

      {/* Stats bar */}
      <div className="flex border-b border-border bg-card/50 flex-shrink-0">
        {[
          { label: 'Listings', value: listings.length, color: 'text-foreground' },
          { label: 'Active', value: listings.filter(l => l.status === 'active').length, color: 'text-green-400' },
          { label: 'Connectors', value: activeConnectors.length, color: 'text-primary' },
          { label: 'Ext. Synced', value: totalSynced, color: 'text-blue-400' },
        ].map(s => (
          <div key={s.label} className="flex-1 text-center py-2">
            <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[9px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex-shrink-0 flex border-b border-border bg-card/50">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${tab === id ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-4">
        {/* Bulk result toast */}
        {bulkResult && (
          <div className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 text-xs font-medium ${bulkResult.failed > 0 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-green-500/10 text-green-400'}`}>
            <CheckCircle2 className="w-3.5 h-3.5" />
            Bulk push: {bulkResult.pushed} queued{bulkResult.failed > 0 ? `, ${bulkResult.failed} failed` : ''}
            <button onClick={() => setBulkResult(null)} className="ml-auto"><XCircle className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* STOREFRONT TAB */}
            {tab === 'storefront' && (
              <div className="space-y-4">
                {/* Search + filters */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search listings..."
                    className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:border-primary/50" />
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {['all','jade','nft','bot','card','item'].map(t => (
                    <button key={t} onClick={() => setFilterType(t)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-colors ${filterType === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                      {t === 'all' ? 'All Types' : t}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  <button onClick={() => setFilterMarket('all')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap ${filterMarket === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                    All Markets
                  </button>
                  <button onClick={() => setFilterMarket('internal')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap ${filterMarket === 'internal' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                    Internal
                  </button>
                  {connectors.map(c => (
                    <button key={c.id} onClick={() => setFilterMarket(c.id)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap ${filterMarket === c.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                      {c.name}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setShowCreateListing(true)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-border hover:border-primary/30 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <Plus className="w-4 h-4" /> New Listing
                  </button>
                  {filteredListings.length > 0 && (
                    <button onClick={selectAll}
                      className="px-3 py-2.5 rounded-xl border border-border bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors">
                      {selectedIds.size === filteredListings.length ? 'None' : 'All'}
                    </button>
                  )}
                </div>

                {/* Bulk action bar */}
                {selectedIds.size > 0 && (
                  <div className="sticky top-0 z-20 flex items-center gap-3 px-3 py-2.5 bg-primary/10 border border-primary/30 rounded-xl">
                    <span className="text-xs font-medium text-primary">{selectedIds.size} selected</span>
                    <button onClick={handleBulkPush}
                      disabled={bulkPushing || !activeConnectors.length}
                      className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium disabled:opacity-50">
                      {bulkPushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Push to {activeConnectors.length} connector{activeConnectors.length !== 1 ? 's' : ''}
                    </button>
                    <button onClick={() => setSelectedIds(new Set())} className="text-muted-foreground hover:text-foreground">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {filteredListings.length === 0 ? (
                  <div className="text-center py-10 space-y-2">
                    <Store className="w-8 h-8 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">No listings yet</p>
                    <p className="text-xs text-muted-foreground/60">Create your first listing to get started</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredListings.map(l => (
                      <ListingCard key={l.id} listing={l} connectors={connectors}
                        selected={selectedIds.has(l.id)}
                        onSelect={toggleSelect} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* CONNECTORS TAB */}
            {tab === 'connectors' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{connectors.length} connector{connectors.length !== 1 ? 's' : ''} configured</p>
                  {isAdmin && (
                    <button onClick={() => setShowAddConnector(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium">
                      <Plus className="w-3.5 h-3.5" /> Add Connector
                    </button>
                  )}
                </div>

                {/* Architecture note */}
                <div className="flex items-start gap-3 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                  <Activity className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p className="font-medium text-blue-400">Connector Architecture</p>
                    <p>Internal marketplace is the source of truth. External connectors are adapters — listings sync outward, conflicts always resolve to internal state.</p>
                  </div>
                </div>

                {connectors.length === 0 ? (
                  <div className="text-center py-10 space-y-3">
                    <Plug className="w-8 h-8 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">No connectors configured</p>
                    {isAdmin && (
                      <button onClick={() => setShowAddConnector(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm">
                        <Plus className="w-4 h-4" /> Add First Connector
                      </button>
                    )}
                    {!isAdmin && <p className="text-xs text-muted-foreground/60">Contact an admin to configure marketplace connectors</p>}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {connectors.map(c => (
                      <ConnectorCard key={c.id} connector={c} isAdmin={isAdmin}
                        onToggle={handleToggleConnector}
                        onEdit={() => {}}
                        onDelete={handleDeleteConnector} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ADMIN TAB */}
            {tab === 'admin' && (
              <div className="space-y-4">
                {!isAdmin ? (
                  <div className="flex flex-col items-center py-12 gap-3">
                    <Lock className="w-8 h-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Admin access required</p>
                  </div>
                ) : (
                  <>
                    <div className="p-4 bg-card rounded-xl border border-border space-y-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="w-4 h-4 text-primary" />
                        <p className="text-sm font-semibold">System Overview</p>
                      </div>
                      {[
                        { label: 'Total Listings', value: listings.length },
                        { label: 'Active Listings', value: listings.filter(l => l.status === 'active').length },
                        { label: 'Draft Listings', value: listings.filter(l => l.status === 'draft').length },
                        { label: 'Error Listings', value: listings.filter(l => l.status === 'error').length },
                        { label: 'Connectors Enabled', value: activeConnectors.length },
                        { label: 'External Syncs', value: totalSynced },
                      ].map(s => (
                        <div key={s.label} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{s.label}</span>
                          <span className="font-mono font-medium">{s.value}</span>
                        </div>
                      ))}
                    </div>

                    <div className="p-4 bg-card rounded-xl border border-border space-y-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Plug className="w-4 h-4 text-primary" />
                        <p className="text-sm font-semibold">Connector Health</p>
                      </div>
                      {connectors.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No connectors configured</p>
                      ) : connectors.map(c => (
                        <div key={c.id} className="flex items-center justify-between">
                          <div>
                            <p className="text-sm">{c.name}</p>
                            <p className="text-[10px] text-muted-foreground">Sync every {c.sync_frequency_minutes}m · {c.read_only_fallback ? 'RO fallback on' : 'RO fallback off'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={c.status} />
                            <button onClick={() => handleToggleConnector(c)}
                              className="text-[10px] px-2 py-1 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                              {c.is_enabled ? 'Disable' : 'Enable'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-yellow-400" />
                        <p className="text-sm font-semibold text-yellow-400">Safety Rules</p>
                      </div>
                      {[
                        'Internal marketplace is always the source of truth',
                        'No fake external confirmations are ever generated',
                        'Failed syncs are marked pending — never silently dropped',
                        'External connector unavailability shows "not connected" state',
                        'All external actions require verified API response',
                      ].map((rule, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="w-3 h-3 text-yellow-400 mt-0.5 flex-shrink-0" />
                          {rule}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {showAddConnector && <AddConnectorModal onClose={() => setShowAddConnector(false)} onSave={handleSaveConnector} />}
      {showCreateListing && <CreateListingModal connectors={connectors} onClose={() => setShowCreateListing(false)} onSave={handleCreateListing} />}
    </div>
  );
}