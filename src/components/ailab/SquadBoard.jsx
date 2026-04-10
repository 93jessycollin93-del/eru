import { useEffect, useMemo, useState } from 'react';
import { Crown, Network, Play, Plus, Save, Trash2, Users, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const ROLE_EMOJI = { assistant: '🤖', trader: '📈', game_helper: '🎮', social: '💬', security: '🛡️', custom: '⚙️' };
const BLANK_SQUAD = { name: '', description: '', master_bot_id: '', member_bot_ids: [] };

function BotChip({ bot, tone = 'default' }) {
  const activeTone = tone === 'master'
    ? 'border-primary/40 bg-primary/10 text-primary'
    : 'border-border bg-secondary text-foreground';

  return (
    <div className={`rounded-xl border px-3 py-2 ${activeTone}`}>
      <div className="flex items-center gap-2">
        <span className="text-base">{ROLE_EMOJI[bot.role] || '🤖'}</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate">{bot.name}</p>
          <p className="text-[10px] text-muted-foreground capitalize">{bot.role}</p>
        </div>
      </div>
    </div>
  );
}

export default function SquadBoard({ bots }) {
  const [squads, setSquads] = useState([]);
  const [activeSquadId, setActiveSquadId] = useState(null);
  const [form, setForm] = useState(BLANK_SQUAD);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runTargetId, setRunTargetId] = useState(null);
  const [runInput, setRunInput] = useState('');
  const [runResult, setRunResult] = useState(null);

  const activeBots = useMemo(() => bots.filter((bot) => (bot.status || 'active') === 'active'), [bots]);
  const masterBot = activeBots.find((bot) => bot.id === form.master_bot_id) || null;
  const memberBots = activeBots.filter((bot) => form.member_bot_ids.includes(bot.id) && bot.id !== form.master_bot_id);
  const availableMembers = activeBots.filter((bot) => bot.id !== form.master_bot_id && !form.member_bot_ids.includes(bot.id));

  const mapSquads = (rows) => rows
    .filter((row) => Array.isArray(row.selected_bot_ids) && row.selected_bot_ids.length > 1)
    .map((row) => {
      const plan = row.delegation_plan || [];
      return {
        id: row.id,
        name: row.title,
        description: row.goal,
        master_bot_id: plan[0]?.bot_id || row.selected_bot_ids[0] || '',
        member_bot_ids: plan.slice(1).map((item) => item.bot_id),
        created_at: row.created_date,
      };
    });

  const loadSquads = async () => {
    setLoading(true);
    const rows = await base44.entities.BotCollaborationSession.list('-created_date', 50);
    setSquads(mapSquads(rows));
    setLoading(false);
  };

  useEffect(() => {
    loadSquads();
  }, []);

  const resetForm = () => {
    setForm(BLANK_SQUAD);
    setActiveSquadId(null);
  };

  const toggleMember = (botId) => {
    setForm((prev) => ({
      ...prev,
      member_bot_ids: prev.member_bot_ids.includes(botId)
        ? prev.member_bot_ids.filter((id) => id !== botId)
        : [...prev.member_bot_ids, botId],
    }));
  };

  const saveSquad = async () => {
    if (!form.name || !form.master_bot_id || form.member_bot_ids.length === 0) return;

    const master = activeBots.find((bot) => bot.id === form.master_bot_id);
    const members = activeBots.filter((bot) => form.member_bot_ids.includes(bot.id));
    const delegationPlan = [
      {
        bot_id: master.id,
        bot_name: master.name,
        task: 'Act as the master bot. Break down the goal, delegate tasks, review outputs, and deliver the final answer.'
      },
      ...members.map((bot) => ({
        bot_id: bot.id,
        bot_name: bot.name,
        task: `Handle delegated work as the ${bot.role} specialist and report back to ${master.name}.`
      }))
    ];

    const payload = {
      title: form.name,
      goal: form.description || form.name,
      status: 'draft',
      selected_bot_ids: [form.master_bot_id, ...form.member_bot_ids],
      delegation_plan: delegationPlan,
      findings: [],
      feedback: [],
      final_output: '',
    };

    if (activeSquadId) {
      await base44.entities.BotCollaborationSession.update(activeSquadId, payload);
    } else {
      await base44.entities.BotCollaborationSession.create(payload);
    }

    await loadSquads();
    resetForm();
  };

  const editSquad = (squad) => {
    setActiveSquadId(squad.id);
    setForm({
      name: squad.name,
      description: squad.description || '',
      master_bot_id: squad.master_bot_id,
      member_bot_ids: squad.member_bot_ids || [],
    });
  };

  const deleteSquad = async (id) => {
    await base44.entities.BotCollaborationSession.delete(id);
    if (activeSquadId === id) resetForm();
    await loadSquads();
  };

  const runSquad = async (squad) => {
    if (!runInput.trim()) return;
    const master = activeBots.find((bot) => bot.id === squad.master_bot_id);
    const members = activeBots.filter((bot) => squad.member_bot_ids.includes(bot.id));
    if (!master || members.length === 0) return;

    setRunning(true);
    setRunTargetId(squad.id);
    setRunResult(null);

    const planningResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `You are ${master.name}. ${master.instructions || ''}
Personality: ${master.personality || 'strategic'}
You are the master bot managing a squad workflow.
Goal: ${runInput}
Available specialist bots: ${members.map((bot) => `${bot.name} (${bot.role})`).join(', ')}

Return a JSON object with a delegations array. Each item must include bot_id, bot_name, and assignment. Use every specialist bot exactly once.` ,
      response_json_schema: {
        type: 'object',
        properties: {
          delegations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                bot_id: { type: 'string' },
                bot_name: { type: 'string' },
                assignment: { type: 'string' }
              },
              required: ['bot_id', 'bot_name', 'assignment']
            }
          }
        },
        required: ['delegations']
      }
    });

    const delegations = (planningResponse.delegations || []).filter((item) => members.some((bot) => bot.id === item.bot_id));
    const findings = [];

    for (const delegation of delegations) {
      const worker = members.find((bot) => bot.id === delegation.bot_id);
      if (!worker) continue;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are ${worker.name}. ${worker.instructions || ''}
Personality: ${worker.personality || 'helpful'}
Master bot: ${master.name}
Goal: ${runInput}
Your delegated assignment: ${delegation.assignment}

Provide a concise specialist response for the master bot.`
      });

      findings.push({ bot_id: worker.id, bot_name: worker.name, assignment: delegation.assignment, output: response });
      await base44.entities.UserBot.update(worker.id, { xp: (worker.xp || 0) + 6, usage_count: (worker.usage_count || 0) + 1 }).catch(() => {});
    }

    const finalResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `You are ${master.name}. ${master.instructions || ''}
Personality: ${master.personality || 'strategic'}
You are finalizing a squad workflow.
Original goal: ${runInput}
Delegations:
${findings.map((item) => `${item.bot_name}: ${item.assignment}`).join('\n')}

Specialist outputs:
${findings.map((item) => `${item.bot_name}: ${item.output}`).join('\n\n')}

Deliver the final answer with these sections: Master Summary, Delegated Findings, Recommended Next Step.`
    });

    await base44.entities.UserBot.update(master.id, { xp: (master.xp || 0) + 10, usage_count: (master.usage_count || 0) + 1 }).catch(() => {});

    setRunResult({ master, findings, final: finalResponse });
    setRunning(false);
  };

  if (loading) {
    return <div className="flex justify-center py-16"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
        <p className="text-xs font-semibold text-primary mb-1">👑 Squad Board — Master Bot Orchestration</p>
        <p className="text-[10px] text-muted-foreground">Build squads where one master bot manages the workflow and delegates work across active specialist bots.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <div>
          <p className="text-xs font-semibold text-foreground">{activeSquadId ? 'Edit squad' : 'New squad'}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Pick one master bot and at least one active specialist bot.</p>
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
          placeholder="What this squad is for"
          className="min-h-[72px] w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none resize-none"
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
                <BotChip bot={bot} tone={form.master_bot_id === bot.id ? 'master' : 'default'} />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Specialist bots</p>
            <span className="text-[10px] text-muted-foreground">{form.member_bot_ids.length} selected</span>
          </div>
          <div className="space-y-2">
            {availableMembers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Choose a different master bot to unlock specialists.</div>
            ) : availableMembers.map((bot) => (
              <button
                key={bot.id}
                onClick={() => toggleMember(bot.id)}
                className={`w-full rounded-xl border px-3 py-2 text-left ${form.member_bot_ids.includes(bot.id) ? 'border-primary bg-primary/10' : 'border-border bg-secondary'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{ROLE_EMOJI[bot.role] || '🤖'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">{bot.name}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{bot.role}</p>
                  </div>
                  {form.member_bot_ids.includes(bot.id) && <Plus className="w-3.5 h-3.5 rotate-45 text-primary" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        {(masterBot || memberBots.length > 0) && (
          <div className="rounded-xl border border-border bg-background p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-primary" />
              <p className="text-xs font-semibold text-foreground">Squad preview</p>
            </div>
            {masterBot && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Master</p>
                <BotChip bot={masterBot} tone="master" />
              </div>
            )}
            {memberBots.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Delegates</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {memberBots.map((bot) => <BotChip key={bot.id} bot={bot} />)}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={saveSquad}
            disabled={!form.name || !form.master_bot_id || form.member_bot_ids.length === 0}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
          >
            <Save className="w-3.5 h-3.5" /> {activeSquadId ? 'Update squad' : 'Save squad'}
          </button>
          {activeSquadId && (
            <button onClick={resetForm} className="rounded-xl border border-border px-3 py-2.5 text-xs text-muted-foreground">Cancel</button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Saved squads</p>
        {squads.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No squads yet.</div>
        ) : squads.map((squad) => {
          const squadMaster = activeBots.find((bot) => bot.id === squad.master_bot_id) || bots.find((bot) => bot.id === squad.master_bot_id);
          const squadMembers = bots.filter((bot) => squad.member_bot_ids.includes(bot.id));
          const isRunningThis = running && runTargetId === squad.id;

          return (
            <div key={squad.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{squad.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{squad.description || 'No description'}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => editSquad(squad)} className="rounded-lg border border-border px-2 py-1 text-[10px] text-muted-foreground">Edit</button>
                  <button onClick={() => deleteSquad(squad.id)} className="text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr,1.2fr]">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Master bot</p>
                  {squadMaster ? <BotChip bot={squadMaster} tone="master" /> : <p className="text-xs text-muted-foreground">Master bot unavailable</p>}
                </div>
                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Delegates</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {squadMembers.map((bot) => <BotChip key={bot.id} bot={bot} />)}
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t border-border/60 pt-3">
                <textarea
                  value={runTargetId === squad.id ? runInput : ''}
                  onChange={(e) => {
                    setRunTargetId(squad.id);
                    setRunInput(e.target.value);
                  }}
                  placeholder="Give the master bot a task for this squad..."
                  className="min-h-[70px] w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none resize-none"
                />
                <button
                  onClick={() => runSquad(squad)}
                  disabled={isRunningThis || !runInput.trim() || runTargetId !== squad.id}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 py-2.5 text-xs font-semibold text-primary disabled:opacity-40"
                >
                  {isRunningThis ? <><Zap className="w-3.5 h-3.5 animate-pulse" /> Running squad…</> : <><Play className="w-3.5 h-3.5" /> Run squad workflow</>}
                </button>
              </div>

              {runResult && runTargetId === squad.id && (
                <div className="space-y-3 rounded-xl border border-border bg-background p-3">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Crown className="w-4 h-4 text-primary" />
                      <p className="text-xs font-semibold text-foreground">Master summary</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed">{runResult.final}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      <p className="text-xs font-semibold text-foreground">Delegated findings</p>
                    </div>
                    {runResult.findings.map((item) => (
                      <div key={item.bot_id} className="rounded-xl border border-border bg-secondary p-3">
                        <p className="text-xs font-semibold text-foreground">{item.bot_name}</p>
                        <p className="mt-1 text-[10px] text-primary">Assignment: {item.assignment}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed">{item.output}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}