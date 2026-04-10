import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Bot, Loader2, Save } from 'lucide-react';
import ToolModulePicker from './ToolModulePicker';

const DEFAULTS = {
  name: '',
  systemPrompt: 'You are a helpful Telegram AI assistant.',
  memoryEnabled: true,
  memoryRetention: 12,
  toolModules: ['faq'],
};

export default function TelegramAgentBuilder({ onCreated }) {
  const [form, setForm] = useState(DEFAULTS);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    await base44.entities.TelegramBot.create({
      name: form.name,
      system_prompt: form.systemPrompt,
      greeting_message: 'Welcome. Ask me anything.',
      status: 'draft',
      flow_blocks: [],
      memory_enabled: form.memoryEnabled,
      max_memory_messages: Number(form.memoryRetention || 12),
      tool_modules: form.toolModules,
      commands: [
        { command: '/start', description: 'Start the bot' },
        { command: '/help', description: 'See bot help' },
        { command: '/reset', description: 'Reset memory' }
      ]
    });
    setForm(DEFAULTS);
    setSaving(false);
    onCreated?.();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Bot className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold">AI Agent Builder</p>
      </div>
      <input
        value={form.name}
        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
        placeholder="Bot name"
        className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm outline-none"
      />
      <textarea
        value={form.systemPrompt}
        onChange={(e) => setForm((prev) => ({ ...prev, systemPrompt: e.target.value }))}
        placeholder="Define the core system prompt"
        className="w-full min-h-[120px] bg-secondary border border-border rounded-xl px-3 py-2 text-sm outline-none resize-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="rounded-xl border border-border bg-secondary/40 px-3 py-3 text-sm">
          <span className="block text-xs text-muted-foreground mb-2">Memory enabled</span>
          <input
            type="checkbox"
            checked={form.memoryEnabled}
            onChange={(e) => setForm((prev) => ({ ...prev, memoryEnabled: e.target.checked }))}
            className="accent-primary"
          />
        </label>
        <label className="rounded-xl border border-border bg-secondary/40 px-3 py-3 text-sm">
          <span className="block text-xs text-muted-foreground mb-2">Memory retention</span>
          <input
            type="number"
            min="1"
            max="100"
            value={form.memoryRetention}
            onChange={(e) => setForm((prev) => ({ ...prev, memoryRetention: e.target.value }))}
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none"
          />
        </label>
      </div>
      <ToolModulePicker value={form.toolModules} onChange={(toolModules) => setForm((prev) => ({ ...prev, toolModules }))} />
      <button
        onClick={handleCreate}
        disabled={!form.name || saving}
        className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? 'Creating…' : 'Create AI Agent Bot'}
      </button>
    </div>
  );
}