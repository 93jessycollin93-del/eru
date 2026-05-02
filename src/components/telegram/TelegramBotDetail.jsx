import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Save, Trash2 } from 'lucide-react';
import TelegramKnowledgeLinkPanel from './TelegramKnowledgeLinkPanel';

export default function TelegramBotDetail({ bot, onSaved, onDeleted }) {
  const [form, setForm] = useState(bot);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setForm(bot);
  }, [bot]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    await base44.functions.invoke('updateTelegramBot', {
      botId: bot.id,
      personality_prompt: form.personality_prompt,
      welcome_message: form.welcome_message,
      model_preference: form.model_preference,
      memory_enabled: form.memory_enabled,
      max_memory_messages: Number(form.max_memory_messages || 12),
      custom_logic_notes: form.custom_logic_notes,
      status: form.status,
    });
    setSaving(false);
    onSaved();
  };

  const handleDelete = async () => {
    setDeleting(true);
    await base44.entities.TelegramBot.delete(bot.id);
    setDeleting(false);
    onDeleted();
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold">{bot.name}</p>
        <p className="text-xs text-muted-foreground">Webhook: {bot.webhook_enabled ? 'connected' : 'not connected'}</p>
      </div>
      <textarea value={form.personality_prompt || ''} onChange={(e) => setField('personality_prompt', e.target.value)} className="w-full min-h-[120px] bg-secondary border border-border rounded-xl px-3 py-2 text-sm outline-none resize-none" />
      <textarea value={form.welcome_message || ''} onChange={(e) => setField('welcome_message', e.target.value)} className="w-full min-h-[90px] bg-secondary border border-border rounded-xl px-3 py-2 text-sm outline-none resize-none" />
      <div className="grid grid-cols-2 gap-2">
        <select value={form.model_preference || 'automatic'} onChange={(e) => setField('model_preference', e.target.value)} className="bg-secondary border border-border rounded-xl px-3 py-2 text-sm outline-none">
          {['automatic', 'gpt_5_mini', 'gpt_5', 'claude_sonnet_4_6', 'gemini_3_flash'].map((model) => (
            <option key={model} value={model}>{model}</option>
          ))}
        </select>
        <select value={form.status || 'active'} onChange={(e) => setField('status', e.target.value)} className="bg-secondary border border-border rounded-xl px-3 py-2 text-sm outline-none">
          {['active', 'disabled', 'error', 'draft'].map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>
      <input type="number" min="1" max="40" value={form.max_memory_messages || 12} onChange={(e) => setField('max_memory_messages', e.target.value)} className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm outline-none" />
      <textarea value={form.custom_logic_notes || ''} onChange={(e) => setField('custom_logic_notes', e.target.value)} placeholder="Extra logic notes" className="w-full min-h-[90px] bg-secondary border border-border rounded-xl px-3 py-2 text-sm outline-none resize-none" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!form.memory_enabled} onChange={(e) => setField('memory_enabled', e.target.checked)} className="w-4 h-4 accent-primary" />
        Memory enabled
      </label>
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save changes
        </button>
        <button onClick={handleDelete} disabled={deleting} className="px-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl disabled:opacity-50">
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </button>
      </div>

      <TelegramKnowledgeLinkPanel bot={bot} />
    </div>
  );
}