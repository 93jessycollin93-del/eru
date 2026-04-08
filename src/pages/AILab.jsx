import { useState, useEffect } from 'react';
import { Bot, Plus, Zap, Edit3, Trash2, Play, Copy, Globe, Lock, ChevronRight, FlaskConical, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const ROLES = [
  { id: 'assistant',   label: 'Assistant',    icon: '🤖', desc: 'General help & answers' },
  { id: 'trader',      label: 'Trader',       icon: '📈', desc: 'Market & trading guidance' },
  { id: 'game_helper', label: 'Game Guide',   icon: '🎮', desc: 'Game strategy & tips' },
  { id: 'social',      label: 'Social',       icon: '💬', desc: 'Community & conversation' },
  { id: 'custom',      label: 'Custom',       icon: '⚡', desc: 'Fully custom role' },
];

const STYLES = ['short', 'detailed', 'strategic', 'creative'];

const BLANK = { name: '', description: '', role: 'assistant', personality: '', instructions: '', response_style: 'detailed', memory_enabled: false, is_public: false, status: 'active' };

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

  const startEdit = (bot) => {
    setForm({ name: bot.name, description: bot.description || '', role: bot.role, personality: bot.personality || '', instructions: bot.instructions || '', response_style: bot.response_style || 'detailed', memory_enabled: !!bot.memory_enabled, is_public: !!bot.is_public, status: bot.status || 'active' });
    setEditId(bot.id);
    setTab('build');
  };

  const duplicate = async (bot) => {
    await base44.entities.UserBot.create({ ...bot, name: bot.name + ' (copy)', id: undefined });
    loadBots();
  };

  const awardXP = async (bot, amount) => {
    const newXp = (bot.xp || 0) + amount;
    const newUsage = (bot.usage_count || 0) + 1;
    const newLevel = Math.min(10, Math.floor(newXp / 100) + 1);
    const caps = bot.unlocked_capabilities || [];
    const newCaps = [...caps];
    if (newLevel >= 3 && !caps.includes('memory_boost')) newCaps.push('memory_boost');
    if (newLevel >= 5 && !caps.includes('web_search')) newCaps.push('web_search');
    if (newLevel >= 7 && !caps.includes('code_execution')) newCaps.push('code_execution');
    if (newLevel >= 10 && !caps.includes('auto_schedule')) newCaps.push('auto_schedule');
    await base44.entities.UserBot.update(bot.id, {
      xp: newXp, level: newLevel, usage_count: newUsage,
      unlocked_capabilities: newCaps, last_interaction: new Date().toISOString()
    });
    loadBots();
  };

  const runTest = async () => {
    if (!testInput.trim() || !testBot) return;
    setTesting(true);
    const prompt = `You are ${testBot.name}. ${testBot.instructions || ''}\nPersonality: ${testBot.personality || 'helpful'}\nResponse style: ${testBot.response_style || 'detailed'}\n\nUser: ${testInput}\n\n${testBot.name}:`;
    const res = await base44.integrations.Core.InvokeLLM({ prompt });
    setTestResponse(res);
    await awardXP(testBot, 10);
    setTesting(false);
  };

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
      <div className="flex border-b border-border">
        {[{ id: 'my', label: 'My Bots' }, { id: 'build', label: editId ? 'Edit Bot' : 'Create Bot' }, { id: 'discover', label: 'Discover' }].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); if (t.id !== 'build') { setForm(BLANK); setEditId(null); } }}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${tab === t.id ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}>
            {t.label}
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
          {loading ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : bots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bot className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No bots yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Create your first AI bot above</p>
            </div>
          ) : bots.map(bot => {
            const role = ROLES.find(r => r.id === bot.role);
            return (
              <div key={bot.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start gap-3">
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
                    {(bot.unlocked_capabilities || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(bot.unlocked_capabilities || []).map(c => (
                          <span key={c} className="text-[8px] bg-primary/10 text-primary border border-primary/20 px-1 py-0.5 rounded-full">⚡ {c.replace('_', ' ')}</span>
                        ))}
                      </div>
                    )}
                    {bot.description && <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">{bot.description}</p>}
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => { setTestBot(bot); setTestResponse(''); setTestInput(''); setTab('test'); }}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-medium">
                    <Play className="w-3 h-3" /> Test
                  </button>
                  <button onClick={() => startEdit(bot)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-secondary border border-border rounded-lg text-xs text-muted-foreground">
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => duplicate(bot)}
                    className="flex items-center justify-center px-2.5 py-1.5 bg-secondary border border-border rounded-lg text-xs text-muted-foreground">
                    <Copy className="w-3 h-3" />
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
              placeholder="What does this bot do?"
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
              placeholder="e.g. Calm, direct, motivating, technical..."
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm outline-none text-foreground" />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Core Instructions</label>
            <textarea value={form.instructions} onChange={e => setForm(p => ({ ...p, instructions: e.target.value }))}
              placeholder="Tell your bot who it is, what it knows, and how it should behave..."
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

      {/* DISCOVER */}
      {tab === 'discover' && (
        <div className="px-4 py-4 space-y-3">
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
            <Sparkles className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="font-semibold text-sm">Bot Discovery</p>
            <p className="text-xs text-muted-foreground mt-1">Public bots from the community coming soon. Make your bot public to appear here.</p>
          </div>
          {bots.filter(b => b.is_public).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Public Bots</p>
              {bots.filter(b => b.is_public).map(bot => {
                const role = ROLES.find(r => r.id === bot.role);
                return (
                  <div key={bot.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                    <span className="text-2xl">{role?.icon || '🤖'}</span>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{bot.name}</p>
                      <p className="text-xs text-muted-foreground">{bot.description || role?.label}</p>
                    </div>
                    <button onClick={() => duplicate(bot)} className="text-xs text-primary px-2 py-1 rounded-lg bg-primary/10 border border-primary/20">Clone</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}