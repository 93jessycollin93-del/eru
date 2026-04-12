import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Network, Save, Trash2, Plus, Play, Users, Crown } from 'lucide-react';

const ROLE_EMOJI = { assistant: '🤖', trader: '📈', game_helper: '🎮', social: '💬', security: '🛡️', custom: '⚙️' };
const BLANK_STEP = { id: '', title: '', instruction: '', assigned_bot_id: '' };
const BLANK_SQUAD = {
  name: '',
  description: '',
  master_bot_id: '',
  member_bot_ids: [],
  shared_context: '',
  pipeline_steps: [],
  status: 'draft',
};

function BotBadge({ bot, active }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${active ? 'border-primary bg-primary/10' : 'border-border bg-secondary'}`}>
      <div className="flex items-center gap-2">
        <span className="text-base">{ROLE_EMOJI[bot.role] || '🤖'}</span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-foreground">{bot.name}</p>
          <p className="text-[10px] capitalize text-muted-foreground">{bot.role}</p>
        </div>
      </div>
    </div>
  );
}

export default function SquadBoard({ bots }) {
  const [squads, setSquads] = useState([]);
  const [form, setForm] = useState(BLANK_SQUAD);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [runInput, setRunInput] = useState({});
  const [runningId, setRunningId] = useState(null);
  const [runOutput, setRunOutput] = useState({});

  const activeBots = useMemo(() => bots.filter((bot) => (bot.status || 'active') === 'active'), [bots]);
  const selectableBots = useMemo(() => activeBots.filter((bot) => bot.id !== form.master_bot_id), [activeBots, form.master_bot_id]);

  const loadSquads = async () => {
    setLoading(true);
    const rows = await base44.entities.BotSquad.list('-updated_date', 100);
    setSquads(rows);
    setLoading(false);
  };

  useEffect(() => {
    loadSquads();
  }, []);

  const resetForm = () => {
    setForm(BLANK_SQUAD);
    setEditingId(null);
  };

  const toggleMember = (botId) => {
    setForm((prev) => ({
      ...prev,
      member_bot_ids: prev.member_bot_ids.includes(botId)
        ? prev.member_bot_ids.filter((id) => id !== botId)
        : [...prev.member_bot_ids, botId],
    }));
  };

  const addStep = () => {
    setForm((prev) => ({
      ...prev,
      pipeline_steps: [...prev.pipeline_steps, { ...BLANK_STEP, id: `step_${Date.now()}` }],
    }));
  };

  const updateStep = (stepId, next) => {
    setForm((prev) => ({
      ...prev,
      pipeline_steps: prev.pipeline_steps.map((step) => step.id === stepId ? { ...step, ...next } : step),
    }));
  };

  const removeStep = (stepId) => {
    setForm((prev) => ({
      ...prev,
      pipeline_steps: prev.pipeline_steps.filter((step) => step.id !== stepId),
    }));
  };

  const saveSquad = async () => {
    if (!form.name.trim() || !form.master_bot_id) return;
    const payload = {
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
      shared_context: form.shared_context.trim(),
      pipeline_steps: form.pipeline_steps.filter((step) => step.title.trim() || step.instruction.trim()),
    };

    if (editingId) {
      await base44.entities.BotSquad.update(editingId, payload);
    } else {
      await base44.entities.BotSquad.create(payload);
    }

    await loadSquads();
    resetForm();
  };

  const editSquad = (squad) => {
    setEditingId(squad.id);
    setForm({
      name: squad.name || '',
      description: squad.description || '',
      master_bot_id: squad.master_bot_id || '',
      member_bot_ids: squad.member_bot_ids || [],
      shared_context: squad.shared_context || '',
      pipeline_steps: (squad.pipeline_steps || []).map((step) => ({
        id: step.id || `step_${Date.now()}_${Math.random()}`,
        title: step.title || '',
        instruction: step.instruction || '',
        assigned_bot_id: step.assigned_bot_id || '',
      })),
      status: squad.status || 'draft',
    });
  };

  const deleteSquad = async (id) => {
    await base44.entities.BotSquad.delete(id);
    if (editingId === id) resetForm();
    await loadSquads();
  };

  const runSquad = async (squad) => {
    const task = runInput[squad.id]?.trim();
    if (!task) return;

    const masterBot = bots.find((bot) => bot.id === squad.master_bot_id);
    const memberBots = bots.filter((bot) => (squad.member_bot_ids || []).includes(bot.id));
    setRunningId(squad.id);

    const stepOutputs = [];
    for (const step of (squad.pipeline_steps || [])) {
      const assignedBot = bots.find((bot) => bot.id === step.assigned_bot_id) || masterBot;
      if (!assignedBot) continue;

      const stepResult = await base44.integrations.Core.InvokeLLM({
        prompt: `You are ${assignedBot.name}. ${assignedBot.instructions || ''}
Personality: ${assignedBot.personality || 'helpful'}
Shared squad context: ${squad.shared_context || 'None'}
Squad request: ${task}
Pipeline step: ${step.title}
Step instruction: ${step.instruction}

Provide a concise specialist response for this step.`
      });

      stepOutputs.push({
        step_title: step.title,
        bot_name: assignedBot.name,
        output: stepResult,
      });
    }

    const finalResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `You are ${masterBot?.name || 'the master bot'}. ${masterBot?.instructions || ''}
Shared squad context: ${squad.shared_context || 'None'}
Cross-department request: ${task}
Squad description: ${squad.description || squad.name}
Specialist pipeline outputs:
${stepOutputs.map((item) => `${item.step_title} — ${item.bot_name}: ${item.output}`).join('\n\n')}

Create a final coordinated answer with these sections: Executive Summary, Department Findings, Recommended Pipeline Next Steps.`
    });

    setRunOutput((prev) => ({
      ...prev,
      [squad.id]: {
        steps: stepOutputs,
        final: finalResponse,
      },
    }));
    setRunningId(null);
  };

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
        <p className="text-xs font-semibold text-primary mb-1">Squads</p>
        <p className="text-[10px] text-muted-foreground">Group specialist bots, define shared context, and create reusable cross-department pipelines.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <div>
          <p className="text-xs font-semibold text-foreground">{editingId ? 'Edit squad' : 'New squad'}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Choose a master bot, add squad members, then define shared context and pipeline steps.</p>
        </div>

        <input
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Squad name"
          className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none"
        />

        <textarea
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="What kind of requests this squad handles"
          className="min-h-[72px] w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none resize-none"
        />

        <textarea
          value={form.shared_context}
          onChange={(e) => setForm((prev) => ({ ...prev, shared_context: e.target.value }))}
          placeholder="Shared context for all bots in this squad"
          className="min-h-[90px] w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none resize-none"
        />

        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Master bot</p>
          <div className="grid gap-2 md:grid-cols-2">
            {activeBots.map((bot) => (
              <button
                key={bot.id}
                onClick={() => setForm((prev) => ({
                  ...prev,
                  master_bot_id: bot.id,
                  member_bot_ids: prev.member_bot_ids.filter((id) => id !== bot.id),
                }))}
                className={`rounded-xl border p-0 text-left ${form.master_bot_id === bot.id ? 'border-primary bg-primary/5' : 'border-border bg-background'}`}
              >
                <BotBadge bot={bot} active={form.master_bot_id === bot.id} />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Squad members</p>
            <span className="text-[10px] text-muted-foreground">{form.member_bot_ids.length} selected</span>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {selectableBots.map((bot) => {
              const active = form.member_bot_ids.includes(bot.id);
              return (
                <button
                  key={bot.id}
                  onClick={() => toggleMember(bot.id)}
                  className={`rounded-xl border p-0 text-left ${active ? 'border-primary bg-primary/5' : 'border-border bg-background'}`}
                >
                  <BotBadge bot={bot} active={active} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-background p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-foreground">Pipeline</p>
              <p className="text-[10px] text-muted-foreground">Define reusable specialist steps for complex requests.</p>
            </div>
            <button
              onClick={addStep}
              className="inline-flex items-center gap-1 rounded-xl border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-primary"
            >
              <Plus className="w-3 h-3" /> Add step
            </button>
          </div>

          {(form.pipeline_steps || []).length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No pipeline steps yet.</div>
          ) : form.pipeline_steps.map((step, index) => (
            <div key={step.id} className="space-y-2 rounded-xl border border-border bg-secondary/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-foreground">Step {index + 1}</p>
                <button onClick={() => removeStep(step.id)} className="text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                value={step.title}
                onChange={(e) => updateStep(step.id, { title: e.target.value })}
                placeholder="Step title"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground outline-none"
              />
              <textarea
                value={step.instruction}
                onChange={(e) => updateStep(step.id, { instruction: e.target.value })}
                placeholder="What should happen in this step"
                className="min-h-[72px] w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground outline-none resize-none"
              />
              <select
                value={step.assigned_bot_id}
                onChange={(e) => updateStep(step.id, { assigned_bot_id: e.target.value })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground outline-none"
              >
                <option value="">Assign to master by default</option>
                {activeBots.filter((bot) => bot.id === form.master_bot_id || form.member_bot_ids.includes(bot.id)).map((bot) => (
                  <option key={bot.id} value={bot.id}>{bot.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={saveSquad}
            disabled={!form.name.trim() || !form.master_bot_id}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
          >
            <Save className="w-3.5 h-3.5" /> {editingId ? 'Update squad' : 'Save squad'}
          </button>
          {editingId && (
            <button onClick={resetForm} className="rounded-xl border border-border px-3 py-2.5 text-xs text-muted-foreground">Cancel</button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Saved squads</p>
        {loading ? (
          <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : squads.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No squads yet.</div>
        ) : squads.map((squad) => {
          const masterBot = bots.find((bot) => bot.id === squad.master_bot_id);
          const memberBots = bots.filter((bot) => (squad.member_bot_ids || []).includes(bot.id));
          const output = runOutput[squad.id];
          const isRunning = runningId === squad.id;

          return (
            <div key={squad.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{squad.name}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{squad.description || 'No description'}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => editSquad(squad)} className="rounded-lg border border-border px-2 py-1 text-[10px] text-muted-foreground">Edit</button>
                  <button onClick={() => deleteSquad(squad.id)} className="text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr,1fr]">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Crown className="w-4 h-4 text-primary" />
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Master bot</p>
                  </div>
                  {masterBot ? <BotBadge bot={masterBot} active /> : <p className="text-xs text-muted-foreground">Master bot unavailable</p>}
                </div>
                <div className="rounded-xl border border-border bg-background p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Members</p>
                  </div>
                  <div className="grid gap-2">
                    {memberBots.map((bot) => <BotBadge key={bot.id} bot={bot} />)}
                  </div>
                </div>
              </div>

              {squad.shared_context && (
                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Shared context</p>
                  <p className="text-[11px] whitespace-pre-wrap text-muted-foreground">{squad.shared_context}</p>
                </div>
              )}

              {(squad.pipeline_steps || []).length > 0 && (
                <div className="rounded-xl border border-border bg-background p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Network className="w-4 h-4 text-primary" />
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pipeline steps</p>
                  </div>
                  <div className="space-y-2">
                    {(squad.pipeline_steps || []).map((step, index) => {
                      const assignedBot = bots.find((bot) => bot.id === step.assigned_bot_id);
                      return (
                        <div key={step.id || index} className="rounded-xl border border-border bg-secondary/20 p-3">
                          <p className="text-xs font-semibold text-foreground">{index + 1}. {step.title || 'Untitled step'}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground whitespace-pre-wrap">{step.instruction}</p>
                          <p className="mt-2 text-[10px] text-primary">Assigned to: {assignedBot?.name || masterBot?.name || 'Master bot'}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-2 border-t border-border/60 pt-3">
                <textarea
                  value={runInput[squad.id] || ''}
                  onChange={(e) => setRunInput((prev) => ({ ...prev, [squad.id]: e.target.value }))}
                  placeholder="Give this squad a cross-department request..."
                  className="min-h-[72px] w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none resize-none"
                />
                <button
                  onClick={() => runSquad(squad)}
                  disabled={isRunning || !(runInput[squad.id] || '').trim()}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 py-2.5 text-xs font-semibold text-primary disabled:opacity-40"
                >
                  <Play className="w-3.5 h-3.5" /> {isRunning ? 'Running squad…' : 'Run squad pipeline'}
                </button>
              </div>

              {output && (
                <div className="space-y-3 rounded-xl border border-border bg-background p-3">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <p className="text-xs font-semibold text-foreground mb-1">Final squad response</p>
                    <p className="text-[11px] whitespace-pre-wrap text-muted-foreground leading-relaxed">{output.final}</p>
                  </div>
                  {output.steps?.length > 0 && (
                    <div className="space-y-2">
                      {output.steps.map((step, index) => (
                        <div key={`${step.step_title}_${index}`} className="rounded-xl border border-border bg-secondary p-3">
                          <p className="text-xs font-semibold text-foreground">{step.step_title}</p>
                          <p className="mt-1 text-[10px] text-primary">{step.bot_name}</p>
                          <p className="mt-1 text-[11px] whitespace-pre-wrap text-muted-foreground leading-relaxed">{step.output}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}