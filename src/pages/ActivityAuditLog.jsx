import { useState, useEffect } from 'react';
import { ClipboardList, Search, Filter, Shield, CreditCard, Key, Link, Database, Settings, LogIn, Fingerprint, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const TYPE_CONFIG = {
  auth:        { icon: LogIn,       color: 'text-blue-400',   bg: 'bg-blue-400/10 border-blue-400/20',   label: 'Auth' },
  payment:     { icon: CreditCard,  color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20', label: 'Payment' },
  wallet:      { icon: Shield,      color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/20', label: 'Wallet' },
  security:    { icon: Key,         color: 'text-red-400',    bg: 'bg-red-400/10 border-red-400/20',      label: 'Security' },
  integration: { icon: Link,        color: 'text-cyan-400',   bg: 'bg-cyan-400/10 border-cyan-400/20',    label: 'Integration' },
  data_access: { icon: Database,    color: 'text-green-400',  bg: 'bg-green-400/10 border-green-400/20',  label: 'Data' },
  settings:    { icon: Settings,    color: 'text-gray-400',   bg: 'bg-gray-400/10 border-gray-400/20',    label: 'Settings' },
  trade:       { icon: ChevronDown, color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20', label: 'Trade' },
  login:       { icon: LogIn,       color: 'text-indigo-400', bg: 'bg-indigo-400/10 border-indigo-400/20', label: 'Login' },
  biometric:   { icon: Fingerprint, color: 'text-primary',    bg: 'bg-primary/10 border-primary/20',      label: 'Biometric' },
};

const STATUS_CONFIG = {
  success: { icon: CheckCircle, color: 'text-green-400',  label: 'Success' },
  failed:  { icon: XCircle,     color: 'text-red-400',    label: 'Failed' },
  blocked: { icon: AlertTriangle, color: 'text-orange-400', label: 'Blocked' },
};

// Rich seed data for demo
const DEMO_LOGS = [
  { id:'d1',  action_type:'biometric', action:'Face ID Verified',           detail:'Biometric authentication completed for wallet access',           source_app:null,         severity:'info',     status:'success', platform:'ios',      created_date: new Date(Date.now()-1*60000).toISOString(),    amount:null },
  { id:'d2',  action_type:'payment',   action:'Outbound Transfer',          detail:'Sent 0.5 TON to wallet 0x4F3a...via TON Bridge',                 source_app:'TON Wallet', severity:'info',     status:'success', platform:'telegram', created_date: new Date(Date.now()-4*60000).toISOString(),    amount:0.5 },
  { id:'d3',  action_type:'security',  action:'2FA Challenge Failed',       detail:'Incorrect OTP entered 3 consecutive times — account locked 15m', source_app:null,         severity:'critical', status:'blocked', platform:'web',      created_date: new Date(Date.now()-12*60000).toISOString(),   amount:null },
  { id:'d4',  action_type:'integration',action:'Google Drive Connected',    detail:'OAuth scope granted: drive.readonly — via app user connector',   source_app:'Google Drive',severity:'info',    status:'success', platform:'web',      created_date: new Date(Date.now()-35*60000).toISOString(),   amount:null },
  { id:'d5',  action_type:'trade',     action:'NFT Purchase',               detail:'Bought "Cosmic Ape #4412" for 320 GOLD from Marketplace',        source_app:'Marketplace',severity:'info',     status:'success', platform:'web',      created_date: new Date(Date.now()-1.2*3600000).toISOString(),amount:320 },
  { id:'d6',  action_type:'payment',   action:'Stripe Payment',             detail:'USD $49.99 charged for Premium subscription — card ending 4242', source_app:'Stripe',     severity:'info',     status:'success', platform:'ios',      created_date: new Date(Date.now()-2*3600000).toISOString(),   amount:49.99 },
  { id:'d7',  action_type:'security',  action:'API Key Generated',          detail:'New API key created: sk_live_ab12... with scopes [markets:read, bots:write]', source_app:null, severity:'warning', status:'success', platform:'web', created_date: new Date(Date.now()-3*3600000).toISOString(),  amount:null },
  { id:'d8',  action_type:'integration',action:'ClickUp Sync',              detail:'Task list synced — 14 tasks imported from "Marketing" workspace', source_app:'ClickUp',    severity:'info',     status:'success', platform:'web',      created_date: new Date(Date.now()-5*3600000).toISOString(),   amount:null },
  { id:'d9',  action_type:'wallet',    action:'Private Key Export Attempt', detail:'User attempted to export private key — biometric gate triggered', source_app:null,         severity:'critical', status:'blocked', platform:'android',  created_date: new Date(Date.now()-6*3600000).toISOString(),   amount:null },
  { id:'d10', action_type:'login',     action:'Session Login',              detail:'New session from iPhone 15 Pro — Toronto, Canada',              source_app:null,         severity:'info',     status:'success', platform:'ios',      created_date: new Date(Date.now()-8*3600000).toISOString(),   amount:null },
  { id:'d11', action_type:'trade',     action:'Jade Purchase Failed',       detail:'Insufficient GOLD balance to purchase Jade block — 1,200 required', source_app:'JTA',    severity:'warning',  status:'failed',  platform:'web',      created_date: new Date(Date.now()-10*3600000).toISOString(),  amount:null },
  { id:'d12', action_type:'integration',action:'Salesforce Data Pull',      detail:'Contact list fetched: 42 records synced to portfolio module',    source_app:'Salesforce', severity:'info',     status:'success', platform:'web',      created_date: new Date(Date.now()-12*3600000).toISOString(),  amount:null },
  { id:'d13', action_type:'settings',  action:'Notification Settings',      detail:'Telegram notifications enabled for: trades, alerts, messages',   source_app:'Telegram',   severity:'info',     status:'success', platform:'telegram', created_date: new Date(Date.now()-14*3600000).toISOString(),  amount:null },
  { id:'d14', action_type:'biometric', action:'Fingerprint Registered',     detail:'TouchID fingerprint registered on this device for the first time',source_app:null,         severity:'info',     status:'success', platform:'android',  created_date: new Date(Date.now()-18*3600000).toISOString(),  amount:null },
  { id:'d15', action_type:'payment',   action:'Escrow Created',             detail:'Trade escrow opened: Card #AX-441 — Buyer 0xe3f... — 850 GOLD',  source_app:'Marketplace',severity:'info',     status:'success', platform:'web',      created_date: new Date(Date.now()-22*3600000).toISOString(),  amount:850 },
  { id:'d16', action_type:'security',  action:'Password Changed',           detail:'Account password updated — previous session revoked',            source_app:null,         severity:'warning',  status:'success', platform:'web',      created_date: new Date(Date.now()-26*3600000).toISOString(),  amount:null },
  { id:'d17', action_type:'data_access',action:'Export Trade History',      detail:'Full trade history CSV exported — 234 records — last 90 days',  source_app:null,         severity:'info',     status:'success', platform:'web',      created_date: new Date(Date.now()-30*3600000).toISOString(),  amount:null },
  { id:'d18', action_type:'integration',action:'GitHub Disconnect',         detail:'GitHub connector revoked — OAuth tokens invalidated',            source_app:'GitHub',     severity:'warning',  status:'success', platform:'web',      created_date: new Date(Date.now()-36*3600000).toISOString(),  amount:null },
];

const ALL_TYPES = ['all', ...Object.keys(TYPE_CONFIG)];
const ALL_STATUS = ['all', 'success', 'failed', 'blocked'];

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function LogItem({ log }) {
  const [expanded, setExpanded] = useState(false);
  const tc = TYPE_CONFIG[log.action_type] || TYPE_CONFIG.auth;
  const sc = STATUS_CONFIG[log.status] || STATUS_CONFIG.success;
  const Icon = tc.icon;
  const StatusIcon = sc.icon;

  return (
    <div className={`rounded-xl border ${tc.bg} overflow-hidden`}>
      <button onClick={() => setExpanded(e => !e)} className="w-full text-left px-3 py-3 flex items-start gap-2.5">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${tc.bg}`}>
          <Icon className={`w-3.5 h-3.5 ${tc.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <p className="text-xs font-semibold truncate">{log.action}</p>
            <StatusIcon className={`w-3.5 h-3.5 flex-shrink-0 ${sc.color}`} />
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`text-[9px] font-bold uppercase ${tc.color}`}>{tc.label}</span>
            {log.source_app && <span className="text-[9px] text-muted-foreground">{log.source_app}</span>}
            {log.platform && <span className="text-[9px] px-1.5 py-0.5 bg-secondary rounded-full text-muted-foreground capitalize">{log.platform}</span>}
            <span className="text-[9px] text-muted-foreground ml-auto">{timeAgo(log.created_date)}</span>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-3 h-3 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/30">
          <p className="text-xs text-foreground/80 leading-relaxed pt-2">{log.detail}</p>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div><span className="text-muted-foreground">Status: </span><span className={sc.color + ' font-medium'}>{sc.label}</span></div>
            <div><span className="text-muted-foreground">Severity: </span><span className="font-medium capitalize">{log.severity}</span></div>
            {log.amount && <div><span className="text-muted-foreground">Amount: </span><span className="font-medium text-yellow-400">{log.amount} {log.currency || 'GOLD'}</span></div>}
            <div><span className="text-muted-foreground">Time: </span><span className="font-medium">{new Date(log.created_date).toLocaleString()}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ActivityAuditLog() {
  const { currentUser } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const dbLogs = await base44.entities.AuditLog.list('-created_date', 100);
        const combined = [...dbLogs, ...DEMO_LOGS].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
        setLogs(combined);
      } catch {
        setLogs(DEMO_LOGS);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = logs.filter(l => {
    if (typeFilter !== 'all' && l.action_type !== typeFilter) return false;
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (search && !l.action.toLowerCase().includes(search.toLowerCase()) && !l.detail?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: logs.length,
    critical: logs.filter(l => l.severity === 'critical').length,
    failed: logs.filter(l => l.status === 'failed').length,
    payments: logs.filter(l => l.action_type === 'payment').length,
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2"><ClipboardList className="w-4 h-4 text-primary" /> Activity Log</h2>
          <p className="text-[10px] text-muted-foreground">All actions, payments & security events</p>
        </div>
        <button className="p-1.5 rounded-lg border border-border text-muted-foreground">
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 px-4 py-3 border-b border-border">
        {[
          { label: 'Total', val: stats.total, color: 'text-foreground' },
          { label: 'Critical', val: stats.critical, color: 'text-red-400' },
          { label: 'Failed', val: stats.failed, color: 'text-orange-400' },
          { label: 'Payments', val: stats.payments, color: 'text-yellow-400' },
        ].map(({ label, val, color }) => (
          <div key={label} className="text-center">
            <p className={`text-base font-bold ${color}`}>{val}</p>
            <p className="text-[9px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div className="px-4 py-3 space-y-2 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-secondary border border-border rounded-xl px-3 py-2">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search actions..."
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground" />
          </div>
          <button onClick={() => setShowFilters(f => !f)}
            className={`p-2 rounded-xl border transition-all ${showFilters ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
            <Filter className="w-3.5 h-3.5" />
          </button>
        </div>

        {showFilters && (
          <div className="space-y-2">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">Type</p>
              <div className="flex flex-wrap gap-1.5">
                {ALL_TYPES.map(t => (
                  <button key={t} onClick={() => setTypeFilter(t)}
                    className={`text-[10px] px-2 py-1 rounded-lg capitalize font-medium transition-all ${typeFilter === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                    {t === 'all' ? 'All Types' : TYPE_CONFIG[t]?.label || t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">Status</p>
              <div className="flex gap-1.5">
                {ALL_STATUS.map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`text-[10px] px-2 py-1 rounded-lg capitalize font-medium transition-all ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                    {s === 'all' ? 'All' : s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Log list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10">
            <ClipboardList className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No events match your filters</p>
          </div>
        ) : (
          filtered.map(log => <LogItem key={log.id} log={log} />)
        )}
      </div>
    </div>
  );
}