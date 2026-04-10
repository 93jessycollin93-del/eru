import { Brain, Settings2, Wrench } from 'lucide-react';

const MEMORY_PRESETS = [
  { id: 'short', label: 'Short', hint: 'Recent context only' },
  { id: 'medium', label: 'Medium', hint: 'Balanced memory' },
  { id: 'long', label: 'Long', hint: 'Extended context' },
];

const TOOL_MODULES = [
  { id: 'faq', label: 'FAQ replies' },
  { id: 'lead_capture', label: 'Lead capture' },
  { id: 'product_guidance', label: 'Product guidance' },
  { id: 'support_triage', label: 'Support triage' },
  { id: 'scheduling', label: 'Scheduling' },
  { id: 'upsell', label: 'Upsell prompts' },
];

export default function TelegramAgentBuilder({ form, setForm }) {
  const toggleModule = (moduleId) => {
    const active = (form.tool_modules || []).includes(moduleId);
    setForm((prev) => ({
      ...prev,
      tool_modules: active
        ? (prev.tool_modules || []).filter((id) => id !== moduleId)
        : [...(prev.tool_modules || []), moduleId]
    }));
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold">AI Agent Builder</p>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">System prompt</label>
        <textarea
          value={form.system_prompt}
          onChange={(e) => setForm((prev) => ({ ...prev, system_prompt: e.target.value }))}
          placeholder="Define the bot's role, tone, rules, and goals"
          className="w-full min-h-[120px] bg-secondary border border-border rounded-xl px-3 py-2 text-sm outline-none resize-none"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          <p className="text-sm font-medium">Memory settings</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MEMORY_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setForm((prev) => ({ ...prev, memory_retention: preset.id }))}
              className={`rounded-xl border p-3 text-left ${form.memory_retention === preset.id ? 'border-primary bg-primary/10' : 'border-border bg-secondary'}`}
            >
              <p className="text-xs font-medium">{preset.label}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{preset.hint}</p>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 px-3 py-2.5 bg-secondary border border-border rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.memory_enabled}
              onChange={(e) => setForm((prev) => ({ ...prev, memory_enabled: e.target.checked }))}
              className="accent-primary"
            />
            <span className="text-xs">Enable memory</span>
          </label>
          <input
            type="number"
            min="5"
            max="100"
            value={form.memory_message_limit}
            onChange={(e) => setForm((prev) => ({ ...prev, memory_message_limit: Number(e.target.value || 20) }))}
            placeholder="Message limit"
            className="bg-secondary border border-border rounded-xl px-3 py-2 text-sm outline-none"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-primary" />
          <p className="text-sm font-medium">Tool modules</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {TOOL_MODULES.map((module) => {
            const active = (form.tool_modules || []).includes(module.id);
            return (
              <button
                key={module.id}
                onClick={() => toggleModule(module.id)}
                className={`rounded-xl border px-3 py-2 text-xs text-left ${active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground'}`}
              >
                {module.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Agent notes</label>
        <textarea
          value={form.agent_notes || ''}
          onChange={(e) => setForm((prev) => ({ ...prev, agent_notes: e.target.value }))}
          placeholder="Optional notes about brand voice, escalation rules, or constraints"
          className="w-full min-h-[80px] bg-secondary border border-border rounded-xl px-3 py-2 text-sm outline-none resize-none"
        />
      </div>
    </div>
  );
}