import { useState, useEffect, useMemo } from 'react';
import { Bot, Plus, Zap, Edit3, Trash2, Play, Copy, Globe, Lock, ChevronRight, FlaskConical, Sparkles, MapPin, Link2, Wand2, Network, Brain, BarChart2, History, Pin, LayoutDashboard, Download, Save, CheckSquare, Square, Search, ArrowUpDown, Filter } from 'lucide-react';
import BotFactory from '../components/ailab/BotFactory';
import AgentRunner from '../components/ailab/AgentRunner';
import MemoryViewer from '../components/ailab/MemoryViewer';
import MultiAgentOrchestrator from '../components/ailab/MultiAgentOrchestrator';
import LabAnalytics from '../components/ailab/LabAnalytics';
import BotVersionHistory from '../components/ailab/BotVersionHistory';
import BotMarketplaceShell from '../components/ailab/BotMarketplaceShell';
import BotDashboard from '../components/ailab/BotDashboard';
import PinnedCards from '../components/ailab/PinnedCards';
import SquadBoard from '../components/ailab/SquadBoard';
import { base44 } from '@/api/base44Client';

const ROLES = [
  { id: 'assistant',   label: 'Assistant',    icon: '🤖', desc: 'General help & answers' },
  { id: 'trader',      label: 'Trader',       icon: '📈', desc: 'Market & trading guidance' },
  { id: 'game_helper', label: 'Game Guide',   icon: '🎮', desc: 'Game strategy & tips' },
  { id: 'social',      label: 'Social',       icon: '💬', desc: 'Community & conversation' },
  { id: 'security',    label: 'Security',     icon: '🛡️', desc: 'Scan and analyze the app' },
  { id: 'custom',      label: 'Custom',       icon: '⚡', desc: 'Fully custom role' },
];

const STYLES = ['short', 'detailed', 'strategic', 'creative'];
const CAPABILITY_LABELS = {
  memory_boost: 'Memory Boost',
  web_search: 'Web Search',
  code_execution: 'Code Execution',
  auto_schedule: 'Auto Schedule',
};

const PAGE_OPTIONS = [
  { route: '/', label: 'Dashboard' },
  { route: '/markets', label: 'Markets' },
  { route: '/trade', label: 'Trade' },
  { route: '/nfts', label: 'NFTs' },
  { route: '/portfolio', label: 'Portfolio' },
  { route: '/collectables', label: 'Collectables' },
  { route: '/jackie', label: 'Jackie AI' },
  { route: '/ailab', label: 'AI Lab' },
  { route: '/arena', label: 'Card Arena' },
  { route: '/jta', label: 'Jade Atelier' },
  { route: '/storefront', label: 'Storefront' },
  { route: '/creator', label: 'Creator Hub' },
  { route: '/thinkers', label: 'Thinkers Club' },
];

const BLANK = { name: '', description: '', role: 'assistant', personality: '', instructions: '', response_style: 'detailed', memory_enabled: false, is_public: false, status: 'active', page_assignments: [], connected_bot_ids: [], handoff_instructions: '' };

const downloadJson = (filename, data) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export default function AILab() {
  const [tab, setTab] = useState('my');
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(BLANK);
  const [editId, setEditId] = useState(null);
  const [testBot, setTestBot] = useState(null);
  const [testInput, setTestInput] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [testing, setTesting] = useState(false);
  const [selectedBotIds, setSelectedBotIds] = useState([]);
  const [bulkAction, setBulkAction] = useState('publish');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => { loadBots(); }, []);

  const loadBots = async () => {
    setLoading(true);
    const data = await base44.entities.UserBot.list('-created_date', 50);
    setBots(data);
    setLoading(false);
  };

  const save = async () => {
    if (!form.name) return;
    if (editId) {
      await base44.entities.UserBot.update(editId, form);
    } else {
      await base44.entities.UserBot.create(form);
    }
    setForm(BLANK); setEditId(null); setTab('my'); loadBots();
  };

  const del = async (id) => {
    await base44.entities.UserBot.delete(id);
    loadBots();
  };

  const toggleSelectedBot = (id) => {
    setSelectedBotIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };

  const toggleSelectAllBots = () => {
    setSelectedBotIds((prev) => prev.length === visibleBots.length ? [] : visibleBots.map((bot) => bot.id));
  };

  const applyBulkAction = async () => {
    const selectedBots = bots.filter((bot) => selectedBotIds.includes(bot.id));
    if (selectedBots.length === 0) return;

    if (bulkAction === 'delete') {
      await Promise.all(selectedBots.map((bot) => base44.entities.UserBot.delete(bot.id)));
    } else {
      const updates = {
        publish: { is_public: true },
        unpublish: { is_public: false },
        activate: { status: 'active' },
        pause: { status: 'paused' },
      };
      await Promise.all(selectedBots.map((bot) => base44.entities.UserBot.update(bot.id, updates[bulkAction])));
    }

    setSelectedBotIds([]);
    loadBots();
  };

  const startEdit = (bot) => {
    setForm({ name: bot.name, description: bot.description || '', role: bot.role, personality: bot.personality || '', instructions: bot.instructions || '', response_style: bot.response_style || 'detailed', memory_enabled: !!bot.memory_enabled, is_public: !!bot.is_public, status: bot.status || 'active' });
    setEditId(bot.id);
    setTab('build');
  };

  const duplicate = async (bot) => {
    await base44.entities.UserBot.create({ ...bot, name: bot.name + ' (copy)', id: undefined });
    loadBots();
  };

  const copyBotConfig = async (bot) => {
    await navigator.clipboard.writeText(JSON.stringify(bot, null, 2));
  };

  const downloadBotConfig = (bot) => {
    downloadJson(`${(bot.name || 'bot').replace(/\s+/g, '-').toLowerCase()}.json`, bot);
  };

  const saveBotAsAsset = async (bot) => {
    await base44.entities.JackieSaved.create({
      title: bot.name,
      content: JSON.stringify(bot, null, 2),
      tag: 'bot',
      asset_type: 'text',
    });
  };

  const awardXP = async (bot, amount) => {
    const newXp = (bot.xp || 0) + amount;
    const newUsage = (bot.usage_count || 0) + 1;
    const newLevel = Math.min(10, Math.floor(newXp / 100) + 1);
    const caps = bot.unlocked_capabilities || [];
    const newCaps = [...caps];
    if ((newLevel >= 3 || newUsage >= 5) && !caps.includes('memory_boost')) newCaps.push('memory_boost');
    if ((newLevel >= 5 || newUsage >= 10) && !caps.includes('web_search')) newCaps.push('web_search');
    if ((newLevel >= 7 || newUsage >= 20) && !caps.includes('code_execution')) newCaps.push('code_execution');
    if ((newLevel >= 10 || newUsage >= 30) && !caps.includes('auto_schedule')) newCaps.push('auto_schedule');
    await base44.entities.UserBot.update(bot.id, {
      xp: newXp, level: newLevel, usage_count: newUsage,
      unlocked_capabilities: newCaps, last_interaction: new Date().toISOString()
    });
    loadBots();
  };

  const visibleBots = useMemo(() => {
    const filtered = bots.filter((bot) => {
      const roleLabel = ROLES.find((role) => role.id === bot.role)?.label || '';
      const matchesSearch = !search || [bot.name, bot.description, bot.role, roleLabel].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === 'all' || bot.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || (bot.status || 'active') === statusFilter;
      const level = bot.level || 1;
      const matchesLevel = levelFilter === 'all'
        || (levelFilter === '1-3' && level >= 1 && level <= 3)
        || (levelFilter === '4-6' && level >= 4 && level <= 6)
        || (levelFilter === '7+' && level >= 7);
      return matchesSearch && matchesRole && matchesStatus && matchesLevel;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'role') return (a.role || '').localeCompare(b.role || '');
      if (sortBy === 'level') return (b.level || 1) - (a.level || 1);
      if (sortBy === 'status') return (a.status || 'active').localeCompare(b.status || 'active');
      return new Date(b.created_date || 0) - new Date(a.created_date || 0);
    });
  }, [bots, search, roleFilter, statusFilter, levelFilter, sortBy]);

  const runTest = async () => {
    if (!testInput.trim() || !testBot) return;
    setTesting(true);
    const prompt = `You are ${testBot.name}. ${testBot.instructions || ''}\nPersonality: ${testBot.personality || 'helpful'}\nResponse style: ${testBot.response_style || 'detailed'}\n\nUser: ${testInput}\n\n${testBot.name}:`;
    const res = await base44.integrations.Core.InvokeLLM({ prompt });
    setTestResponse(res);
    await awardXP(testBot, 10);
    setTesting(false);
  };

  const TABS = [
    { id: 'my', label: 'My Bots', icon: Bot },
    { id: 'build', label: editId ? 'Edit' : 'Build', icon: Plus },
    { id: 'factory', label: 'Factory', icon: Wand2 },
    { id: 'agents', label: 'Agents', icon: Zap },
    { id: 'memory', label: 'Memory', icon: Brain },
    { id: 'orchestrator', label: 'Orchestra', icon: Network },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'versions', label: 'Versions', icon: History },
    { id: 'dashboard', label: 'Stats', icon: LayoutDashboard },
    { id: 'pinned', label: 'Cards', icon: Pin },
    { id: 'squad', label: 'Squad', icon: Network },
    { id: 'discover', label: 'Discover', icon: Sparkles },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-primary" /> AI Lab
        </h2>
        <p className="text-xs text-muted-foreground">Create, train & deploy your own AI bots</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); if (t.id !== 'build') { setForm(BLANK); setEditId(null); } }}
            className={`flex-shrink-0 flex items-center gap-1 px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${tab === t.id ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}>
            <t.icon className="w-3 h-3" />{t.label}
          </button>
        ))}
      </div>

      {/* MY BOTS */}
      {tab === 'my' && (
        <div className="px-4 py-4 space-y-3">
          <button onClick={() => { setForm(BLANK); setEditId(null); setTab('build'); }}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm">
            <Plus className="w-4 h-4" /> Create New Bot
          </button>

          {bots.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-3 space-y-3">
              <div className="grid gap-2 md:grid-cols-4">
                <div className="flex items-center gap-2 bg-secondary border border-border rounded-xl px-3 py-2.5">
                  <Search className="w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search bots..."
                    className="flex-1 bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="flex items-center gap-2 bg-secondary border border-border rounded-xl px-3 py-2.5">
                  <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                  <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="w-full bg-transparent text-xs outline-none text-foreground">
                    <option value="all">All roles</option>
                    {ROLES.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 bg-secondary border border-border rounded-xl px-3 py-2.5">
                  <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full bg-transparent text-xs outline-none text-foreground">
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 bg-secondary border border-border rounded-xl px-3 py-2.5">
                  <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full bg-transparent text-xs outline-none text-foreground">
                    <option value="newest">Newest</option>
                    <option value="name">Name</option>
                    <option value="role">Role</option>
                    <option value="level">Level</option>
                    <option value="status">Status</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 flex-col sm:flex-row">
                <div className="flex items-center gap-2 bg-secondary border border-border rounded-xl px-3 py-2.5 text-xs text-muted-foreground sm:w-48">
                  <Filter className="w-3.5 h-3.5" />
                  <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="w-full bg-transparent outline-none text-foreground">
                    <option value="all">All levels</option>
                    <option value="1-3">Level 1-3</option>
                    <option value="4-6">Level 4-6</option>
                    <option value="7+">Level 7+</option>
                  </select>
                </div>
                <div className="flex items-center justify-between gap-3 flex-1 flex-wrap">
                  <button
                    onClick={toggleSelectAllBots}
                    className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground"
                  >
                    {selectedBotIds.length === visibleBots.length && visibleBots.length > 0 ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                    {selectedBotIds.length === visibleBots.length && visibleBots.length > 0 ? 'Clear selection' : 'Select visible'}
                  </button>
                  <span className="text-[11px] text-muted-foreground">{selectedBotIds.length} selected · {visibleBots.length} shown</span>
                </div>
              </div>
              <div className="flex gap-2 flex-col sm:flex-row">
                <select
                  value={bulkAction}
                  onChange={(e) => setBulkAction(e.target.value)}
                  className="flex-1 bg-secondary border border-border rounded-xl px-3 py-2.5 text-xs outline-none text-foreground"
                >
                  <option value="publish">Publish selected</option>
                  <option value="unpublish">Unpublish selected</option>
                  <option value="activate">Set active</option>
                  <option value="pause">Set paused</option>
                  <option value="delete">Delete selected</option>
                </select>
                <button
                  onClick={applyBulkAction}
                  disabled={selectedBotIds.length === 0}
                  className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
                >
                  Apply bulk action
                </button>
              </div>
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : bots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bot className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No bots yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Create your first AI bot above</p>
            </div>
          ) : visibleBots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bot className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No bots match your filters</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Try changing your search, sort, or filter settings</p>
            </div>
          ) : visibleBots.map(bot => {
            const role = ROLES.find(r => r.id === bot.role);
            return (
              <div key={bot.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleSelectedBot(bot.id)}
                    className="mt-1 text-muted-foreground hover:text-primary"
                  >
                    {selectedBotIds.includes(bot.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                  </button>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-xl flex-shrink-0">
                    {role?.icon || '🤖'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{bot.name}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${bot.status === 'active' ? 'bg-green-400/10 text-green-400' : 'bg-secondary text-muted-foreground'}`}>
                        {bot.status}
                      </span>
                      {bot.is_public ? <Globe className="w-3 h-3 text-muted-foreground" /> : <Lock className="w-3 h-3 text-muted-foreground" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{role?.label} · {bot.response_style}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] text-primary font-bold">Lv.{bot.level || 1}</span>
                      <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${((bot.xp || 0) % 100)}%` }} />
                      </div>
                      <span className="text-[9px] text-muted-foreground">{bot.xp || 0} XP</span>
                    </div>
                    <div className="mt-2 space-y-1">
                      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Unlocked capabilities</p>
                      {(bot.unlocked_capabilities || []).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {(bot.unlocked_capabilities || []).map(c => (
                            <span key={c} className="text-[8px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full">⚡ {CAPABILITY_LABELS[c] || c.replace('_', ' ')}</span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground">No advanced capabilities unlocked yet.</p>
                      )}
                      <p className="text-[9px] text-muted-foreground/70">Unlocks by level or usage: Web Search, Code Execution, and Auto Schedule.</p>
                    </div>
                    {bot.description && <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">{bot.description}</p>}
                  </div>
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <button onClick={() => { setTestBot(bot); setTestResponse(''); setTestInput(''); setTab('test'); }}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-medium min-w-[90px]">
                    <Play className="w-3 h-3" /> Test
                  </button>
                  <button onClick={() => startEdit(bot)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-secondary border border-border rounded-lg text-xs text-muted-foreground min-w-[90px]">
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => duplicate(bot)}
                    className="flex items-center justify-center px-2.5 py-1.5 bg-secondary border border-border rounded-lg text-xs text-muted-foreground">
                    <Copy className="w-3 h-3" />
                  </button>
                  <button onClick={() => copyBotConfig(bot)}
                    className="flex items-center justify-center px-2.5 py-1.5 bg-secondary border border-border rounded-lg text-xs text-muted-foreground">
                    <Copy className="w-3 h-3" />
                  </button>
                  <button onClick={() => saveBotAsAsset(bot)}
                    className="flex items-center justify-center px-2.5 py-1.5 bg-secondary border border-border rounded-lg text-xs text-muted-foreground">
                    <Save className="w-3 h-3" />
                  </button>
                  <button onClick={() => downloadBotConfig(bot)}
                    className="flex items-center justify-center px-2.5 py-1.5 bg-secondary border border-border rounded-lg text-xs text-muted-foreground">
                    <Download className="w-3 h-3" />
                  </button>
                  <button onClick={() => del(bot.id)}
                    className="flex items-center justify-center px-2.5 py-1.5 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* BUILD */}
      {tab === 'build' && (
        <div className="px-4 py-4 space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Bot Name *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. TradeMaster, CryptoGuide..."
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm outline-none text-foreground" />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Description</label>
            <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder={form.role === 'security' ? 'Scans the app for risks, gaps, and security issues' : 'What does this bot do?'}
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm outline-none text-foreground" />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Role</label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map(r => (
                <button key={r.id} onClick={() => setForm(p => ({ ...p, role: r.id }))}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${form.role === r.id ? 'border-primary bg-primary/10' : 'border-border bg-secondary'}`}>
                  <span className="text-lg leading-none">{r.icon}</span>
                  <div>
                    <p className="text-xs font-medium">{r.label}</p>
                    <p className="text-[9px] text-muted-foreground">{r.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Personality / Tone</label>
            <input value={form.personality} onChange={e => setForm(p => ({ ...p, personality: e.target.value }))}
              placeholder={form.role === 'security' ? 'e.g. Careful, analytical, technical, risk-aware...' : 'e.g. Calm, direct, motivating, technical...'}
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm outline-none text-foreground" />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Core Instructions</label>
            <textarea value={form.instructions} onChange={e => setForm(p => ({ ...p, instructions: e.target.value }))}
              placeholder={form.role === 'security' ? 'Tell this bot to scan the app, review flows, find weak points, and explain risks clearly...' : 'Tell your bot who it is, what it knows, and how it should behave...'}
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm outline-none resize-none min-h-[90px] text-foreground" />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Response Style</label>
            <div className="flex gap-2 flex-wrap">
              {STYLES.map(s => (
                <button key={s} onClick={() => setForm(p => ({ ...p, response_style: s }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all capitalize ${form.response_style === s ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <label className="flex items-center gap-2 flex-1 px-3 py-2.5 bg-secondary border border-border rounded-xl cursor-pointer">
              <input type="checkbox" checked={form.memory_enabled} onChange={e => setForm(p => ({ ...p, memory_enabled: e.target.checked }))} className="accent-primary" />
              <div>
                <p className="text-xs font-medium">Session Memory</p>
                <p className="text-[9px] text-muted-foreground">Remember context in conversation</p>
              </div>
            </label>
            <label className="flex items-center gap-2 flex-1 px-3 py-2.5 bg-secondary border border-border rounded-xl cursor-pointer">
              <input type="checkbox" checked={form.is_public} onChange={e => setForm(p => ({ ...p, is_public: e.target.checked }))} className="accent-primary" />
              <div>
                <p className="text-xs font-medium">Public Bot</p>
                <p className="text-[9px] text-muted-foreground">Visible in Discover</p>
              </div>
            </label>
          </div>

          {/* Page Assignments */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> Deploy to Pages</label>
            <p className="text-[9px] text-muted-foreground">Bot will appear as a floating assistant on selected pages.</p>
            <div className="flex flex-wrap gap-1.5">
              {PAGE_OPTIONS.map(p => {
                const active = (form.page_assignments || []).includes(p.route);
                return (
                  <button key={p.route} onClick={() => setForm(prev => ({
                    ...prev,
                    page_assignments: active
                      ? prev.page_assignments.filter(r => r !== p.route)
                      : [...(prev.page_assignments || []), p.route]
                  }))}
                    className={`text-[10px] px-2 py-1 rounded-lg border font-medium transition-all ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-muted-foreground border-border'}`}>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bot Connections */}
          {bots.filter(b => b.id !== editId).length > 0 && (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground flex items-center gap-1"><Link2 className="w-3 h-3" /> Connect Bots (delegation network)</label>
              <p className="text-[9px] text-muted-foreground">Selected bots will be consulted when this bot decides to delegate a task.</p>
              <div className="space-y-1.5">
                {bots.filter(b => b.id !== editId).map(b => {
                  const linked = (form.connected_bot_ids || []).includes(b.id);
                  return (
                    <button key={b.id} onClick={() => setForm(prev => ({
                      ...prev,
                      connected_bot_ids: linked
                        ? prev.connected_bot_ids.filter(id => id !== b.id)
                        : [...(prev.connected_bot_ids || []), b.id]
                    }))}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all ${linked ? 'border-primary bg-primary/10' : 'border-border bg-secondary'}`}>
                      <span>{ROLES.find(r => r.id === b.role)?.icon || '🤖'}</span>
                      <div className="flex-1">
                        <p className="text-xs font-medium">{b.name}</p>
                        <p className="text-[9px] text-muted-foreground">{b.role} · {b.response_style}</p>
                      </div>
                      {linked && <Zap className="w-3 h-3 text-primary" />}
                    </button>
                  );
                })}
              </div>
              {(form.connected_bot_ids || []).length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Handoff Instructions</label>
                  <textarea value={form.handoff_instructions} onChange={e => setForm(p => ({ ...p, handoff_instructions: e.target.value }))}
                    placeholder="e.g. Delegate market analysis to TraderBot. Delegate game questions to GameGuide."
                    className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm outline-none resize-none min-h-[70px] text-foreground" />
                </div>
              )}
            </div>
          )}

          <button onClick={save} disabled={!form.name}
            className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm disabled:opacity-40">
            {editId ? 'Save Changes' : 'Create Bot'}
          </button>
        </div>
      )}

      {/* TEST */}
      {tab === 'test' && testBot && (
        <div className="px-4 py-4 space-y-4">
          <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
            <span className="text-2xl">{ROLES.find(r => r.id === testBot.role)?.icon || '🤖'}</span>
            <div>
              <p className="font-semibold text-sm">{testBot.name}</p>
              <p className="text-xs text-muted-foreground">Sandbox test — changes won't be saved</p>
            </div>
          </div>
          {testResponse && (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-2">{testBot.name} says:</p>
              <p className="text-sm text-foreground leading-relaxed">{testResponse}</p>
            </div>
          )}
          <div className="flex gap-2">
            <input value={testInput} onChange={e => setTestInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runTest()}
              placeholder="Test your bot..."
              className="flex-1 bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm outline-none text-foreground" />
            <button onClick={runTest} disabled={!testInput.trim() || testing}
              className="bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-40">
              {testing ? '...' : 'Send'}
            </button>
          </div>
          <button onClick={() => setTab('my')} className="w-full text-sm text-muted-foreground py-2">← Back to My Bots</button>
        </div>
      )}

      {/* FACTORY */}
      {tab === 'factory' && <BotFactory onSaveBot={loadBots} />}

      {/* AGENTS */}
      {tab === 'agents' && <AgentRunner bots={bots} />}

      {/* MEMORY */}
      {tab === 'memory' && <MemoryViewer bots={bots} />}

      {/* ORCHESTRATOR */}
      {tab === 'orchestrator' && <MultiAgentOrchestrator bots={bots} />}

      {/* ANALYTICS */}
      {tab === 'analytics' && <LabAnalytics bots={bots} />}

      {/* VERSIONS */}
      {tab === 'versions' && <BotVersionHistory bots={bots} onRollback={loadBots} />}

      {/* DASHBOARD */}
      {tab === 'dashboard' && <BotDashboard bots={bots} />}

      {/* PINNED CARDS */}
      {tab === 'pinned' && <PinnedCards bots={bots} />}

      {/* SQUAD */}
      {tab === 'squad' && <SquadBoard bots={bots} />}

      {/* DISCOVER */}
      {tab === 'discover' && <div className="px-4 py-4"><BotMarketplaceShell onInstalled={loadBots} embedded /></div>}
    </div>
  );
}