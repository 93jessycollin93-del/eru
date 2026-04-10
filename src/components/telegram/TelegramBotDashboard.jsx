import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Bot, Loader2, Plus, RefreshCw, Radio, Save, Settings2, TerminalSquare, CheckCircle2, Power, Copy, Trash2, BarChart3 } from 'lucide-react';
import BotFlowBuilder from './BotFlowBuilder';
import TelegramBotAnalytics from './TelegramBotAnalytics';
import TelegramAgentBuilder from './TelegramAgentBuilder';

const DEFAULT_FORM = {
  name: '',
  bot_username: '',
  bot_token: '',
  system_prompt: 'You are a helpful Telegram AI assistant.',
  greeting_message: 'Welcome. Ask me anything.',
  flow_blocks: [],
  memory_enabled: true,
  max_memory_messages: 12,
  tool_modules: [],
};

function BotCard({ bot, onSelect, active }) {
  return (
    <button
      onClick={() => onSelect(bot)}
      className={`w-full rounded-xl border p-3 text-left transition-colors ${active ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Bot className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{bot.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{bot.bot_username ? `@${bot.bot_username}` : 'Username not set'}</p>
          </div>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${bot.status === 'active' ? 'bg-green-500/10 text-green-400' : bot.status === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-secondary text-muted-foreground'}`}>
          {bot.status}
        </span>
      </div>
    </button>
  );
}

export default function TelegramBotDashboard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [verification, setVerification] = useState(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedBotIds, setSelectedBotIds] = useState([]);
  const [data, setData] = useState({ bots: [], messages: [], logs: [], sessions: [] });
  const [selectedBotId, setSelectedBotId] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);

  const load = async () => {
    setLoading(true);
    const response = await base44.functions.invoke('listTelegramBotDashboard', {});
    setData(response.data || { bots: [], messages: [], logs: [], sessions: [] });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const selectedBot = useMemo(
    () => data.bots.find((bot) => bot.id === selectedBotId) || data.bots[0] || null,
    [data.bots, selectedBotId]
  );

  useEffect(() => {
    if (selectedBot) {
      setSelectedBotId(selectedBot.id);
      setForm({
        name: selectedBot.name || '',
        bot_username: selectedBot.bot_username || '',
        bot_token: selectedBot.bot_token || '',
        system_prompt: selectedBot.system_prompt || DEFAULT_FORM.system_prompt,
        greeting_message: selectedBot.greeting_message || DEFAULT_FORM.greeting_message,
        flow_blocks: selectedBot.flow_blocks || [],
        memory_enabled: selectedBot.memory_enabled ?? true,
        max_memory_messages: selectedBot.max_memory_messages || 12,
        tool_modules: selectedBot.tool_modules || [],
      });
      setVerification(null);
    } else {
      setForm(DEFAULT_FORM);
    }
  }, [selectedBot?.id]);

  const selectedMessages = useMemo(
    () => data.messages.filter((message) => message.bot_id === selectedBot?.id).slice(0, 12),
    [data.messages, selectedBot?.id]
  );

  const selectedLogs = useMemo(
    () => data.logs.filter((log) => log.bot_id === selectedBot?.id).slice(0, 12),
    [data.logs, selectedBot?.id]
  );

  const selectedSessions = useMemo(
    () => data.sessions.filter((session) => session.bot_id === selectedBot?.id),
    [data.sessions, selectedBot?.id]
  );

  const toggleSelectedBot = (botId) => {
    setSelectedBotIds((prev) => prev.includes(botId) ? prev.filter((id) => id !== botId) : [...prev, botId]);
  };

  const cloneBot = async () => {
    if (!selectedBot) return;
    await base44.entities.TelegramBot.create({
      ...selectedBot,
      name: `${selectedBot.name} Copy`,
      status: 'draft'
    });
    await load();
  };

  const deleteSelectedBots = async () => {
    await Promise.all(selectedBotIds.map((id) => base44.entities.TelegramBot.delete(id)));
    setSelectedBotIds([]);
    await load();
  };

  const bulkActivateSelected = async () => {
    await Promise.all(selectedBotIds.map((id) => {
      const bot = data.bots.find((item) => item.id === id);
      return base44.functions.invoke('manageTelegramWebhook', {
        botId: id,
        botToken: bot?.bot_token,
        action: 'activate'
      });
    }));
    setSelectedBotIds([]);
    await load();
  };

  const createBot = async () => {
    setSaving(true);
    const created = await base44.entities.TelegramBot.create({
      ...form,
      system_prompt: [
        form.system_prompt,
        ...(form.flow_blocks || []).map((block) => block.value),
      ].filter(Boolean).join('\n\n'),
      status: 'draft',
      memory_enabled: form.memory_enabled,
      max_memory_messages: Number(form.max_memory_messages || 12),
      tool_modules: form.tool_modules || [],
      commands: [
        { command: '/start', description: 'Start the bot' },
        { command: '/help', description: 'See bot help' },
        { command: '/reset', description: 'Reset memory' }
      ]
    });
    setSelectedBotId(created.id);
    await load();
    setSaving(false);
  };

  const updateBot = async () => {
    if (!selectedBot) return;
    setSaving(true);
    await base44.entities.TelegramBot.update(selectedBot.id, {
      ...form,
      system_prompt: [
        form.system_prompt,
        ...(form.flow_blocks || []).map((block) => block.value),
      ].filter(Boolean).join('\n\n'),
      memory_enabled: form.memory_enabled,
      max_memory_messages: Number(form.max_memory_messages || 12),
      tool_modules: form.tool_modules || [],
    });
    await load();
    setSaving(false);
  };

  const verifyConnection = async () => {
    if (!selectedBot) return;
    setVerifying(true);
    const response = await base44.functions.invoke('manageTelegramWebhook', {
      botId: selectedBot.id,
      botToken: form.bot_token,
      action: 'verify'
    });
    setVerification(response.data);
    await load();
    setVerifying(false);
  };

  const registerWebhook = async () => {
    if (!selectedBot) return;
    setRegistering(true);
    const response = await base44.functions.invoke('manageTelegramWebhook', {
      botId: selectedBot.id,
      botToken: form.bot_token,
      action: 'activate'
    });
    setVerification(response.data);
    await load();
    setRegistering(false);
  };

  const toggleBotStatus = async () => {
    if (!selectedBot) return;
    setToggling(true);
    const response = await base44.functions.invoke('manageTelegramWebhook', {
      botId: selectedBot.id,
      botToken: form.bot_token,
      action: selectedBot.status === 'active' ? 'offline' : 'activate'
    });
    setVerification(response.data);
    await load();
    setToggling(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase">Bots</p>
          <p className="text-lg font-semibold mt-1">{data.bots.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase">Sessions</p>
          <p className="text-lg font-semibold mt-1">{selectedSessions.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase">Messages</p>
          <p className="text-lg font-semibold mt-1">{selectedMessages.length}</p>
        </div>
      </div>

      <TelegramAgentBuilder onCreated={load} />

      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={createBot} disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-50">
          <Plus className="w-4 h-4" /> New Bot
        </button>
        <button onClick={() => setBulkMode((prev) => !prev)} className="px-3 py-3 bg-secondary border border-border rounded-xl text-muted-foreground text-sm">
          Bulk
        </button>
        <button onClick={cloneBot} disabled={!selectedBot} className="px-3 py-3 bg-secondary border border-border rounded-xl text-muted-foreground">
          <Copy className="w-4 h-4" />
        </button>
        <button onClick={load} className="px-3 py-3 bg-secondary border border-border rounded-xl text-muted-foreground">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {bulkMode && selectedBotIds.length > 0 && (
        <div className="flex gap-2">
          <button onClick={bulkActivateSelected} className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium">Activate selected</button>
          <button onClick={deleteSelectedBots} className="px-4 py-2.5 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl text-sm font-medium flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      )}

      <div className="space-y-2">
        {data.bots.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">No Telegram bots yet. Create one to begin.</div>
        ) : data.bots.map((bot) => (
          <div key={bot.id} className="flex items-center gap-2">
            {bulkMode && (
              <input type="checkbox" checked={selectedBotIds.includes(bot.id)} onChange={() => toggleSelectedBot(bot.id)} className="accent-primary" />
            )}
            <div className="flex-1">
              <BotCard bot={bot} active={selectedBot?.id === bot.id} onSelect={(item) => setSelectedBotId(item.id)} />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold">AI Behavior</p>
        </div>
        <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Bot name" className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm outline-none" />
        <input value={form.bot_username} onChange={(e) => setForm((prev) => ({ ...prev, bot_username: e.target.value }))} placeholder="Telegram username" className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm outline-none" />
        <input value={form.bot_token} onChange={(e) => setForm((prev) => ({ ...prev, bot_token: e.target.value }))} placeholder="Telegram bot token" className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm outline-none" />
        <textarea value={form.system_prompt} onChange={(e) => setForm((prev) => ({ ...prev, system_prompt: e.target.value }))} placeholder="System prompt" className="w-full min-h-[120px] bg-secondary border border-border rounded-xl px-3 py-2 text-sm outline-none resize-none" />
        <textarea value={form.greeting_message} onChange={(e) => setForm((prev) => ({ ...prev, greeting_message: e.target.value }))} placeholder="Greeting message" className="w-full min-h-[80px] bg-secondary border border-border rounded-xl px-3 py-2 text-sm outline-none resize-none" />
        <div className="grid grid-cols-2 gap-2">
          <label className="rounded-xl border border-border bg-secondary/40 px-3 py-3 text-sm">
            <span className="block text-xs text-muted-foreground mb-2">Memory enabled</span>
            <input type="checkbox" checked={form.memory_enabled} onChange={(e) => setForm((prev) => ({ ...prev, memory_enabled: e.target.checked }))} className="accent-primary" />
          </label>
          <label className="rounded-xl border border-border bg-secondary/40 px-3 py-3 text-sm">
            <span className="block text-xs text-muted-foreground mb-2">Memory retention</span>
            <input type="number" min="1" max="100" value={form.max_memory_messages} onChange={(e) => setForm((prev) => ({ ...prev, max_memory_messages: e.target.value }))} className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none" />
          </label>
        </div>
        <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
          <p className="text-xs text-muted-foreground">Tool modules</p>
          <div className="flex flex-wrap gap-2">
            {(form.tool_modules || []).length === 0 ? <span className="text-[11px] text-muted-foreground">No modules selected</span> : form.tool_modules.map((module) => <span key={module} className="px-2 py-1 rounded-full bg-primary/10 text-primary text-[11px]">{module}</span>)}
          </div>
        </div>
        <BotFlowBuilder value={form.flow_blocks} onChange={(flow_blocks) => setForm((prev) => ({ ...prev, flow_blocks }))} />
        <div className="flex gap-2 flex-wrap">
          <button onClick={updateBot} disabled={!selectedBot || saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-50">
            <Save className="w-4 h-4" /> Save
          </button>
          <button onClick={verifyConnection} disabled={!selectedBot || verifying} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-secondary border border-border rounded-xl text-sm font-medium disabled:opacity-50">
            {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Verify
          </button>
          <button onClick={registerWebhook} disabled={!selectedBot || registering} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-secondary border border-border rounded-xl text-sm font-medium disabled:opacity-50">
            {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />} Set Webhook
          </button>
          <button onClick={toggleBotStatus} disabled={!selectedBot || toggling} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-secondary border border-border rounded-xl text-sm font-medium disabled:opacity-50">
            {toggling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />} {selectedBot?.status === 'active' ? 'Go Offline' : 'Go Active'}
          </button>
        </div>
        {verification?.bot_username && <p className="text-[11px] text-green-400">Connected as @{verification.bot_username}</p>}
        {selectedBot?.webhook_url && <p className="text-[11px] text-muted-foreground break-all">Webhook: {selectedBot.webhook_url}</p>}
      </div>

      <TelegramBotAnalytics bot={selectedBot} messages={selectedMessages} logs={selectedLogs} sessions={selectedSessions} />

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <TerminalSquare className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold">Live Activity</p>
        </div>
        <div className="space-y-2">
          {selectedMessages.length === 0 ? (
            <p className="text-xs text-muted-foreground">No messages yet.</p>
          ) : selectedMessages.map((message) => (
            <div key={message.id} className="rounded-lg bg-secondary/60 border border-border px-3 py-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] uppercase text-muted-foreground">{message.direction}</span>
                <span className="text-[10px] text-muted-foreground">{message.status}</span>
              </div>
              <p className="text-xs text-foreground whitespace-pre-wrap">{message.content}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2 border-t border-border pt-3">
          {selectedLogs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No logs yet.</p>
          ) : selectedLogs.map((log) => (
            <div key={log.id} className="flex items-start justify-between gap-3 text-xs">
              <div>
                <p className="text-foreground">{log.message}</p>
                <p className="text-muted-foreground mt-0.5">{log.event_type}</p>
              </div>
              <span className={`${log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-yellow-400' : 'text-green-400'}`}>{log.level}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}