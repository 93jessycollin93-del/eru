import { useState, useEffect } from 'react';
import { Plus, Trash2, ArrowRight, Play, Save, Zap, Network, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const ROLE_EMOJI = { assistant: '🤖', trader: '📈', game_helper: '🎮', social: '💬', custom: '⚙️' };

// A "pipeline" is a list of bot IDs in order with optional handoff notes between each step
const BLANK_PIPELINE = { name: '', steps: [], description: '' };

function BotNode({ bot, index, total, onRemove, handoff, onHandoffChange }) {
  return (
    <div className="flex items-stretch gap-2">
      <div className="flex flex-col items-center gap-2 flex-1">
        <div className="bg-card border-2 border-primary/40 rounded-2xl p-3 w-full">
          <div className="flex items-center gap-2">
            <span className="text-xl">{ROLE_EMOJI[bot.role] || '🤖'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">{bot.name}</p>
              <p className="text-[9px] text-muted-foreground capitalize">{bot.role}</p>
            </div>
            <button onClick={() => onRemove(index)} className="text-red-400 hover:text-red-300 flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {bot.description && <p className="text-[9px] text-muted-foreground mt-1 line-clamp-1">{bot.description}</p>}
        </div>

        {index < total - 1 && (
          <div className="flex flex-col items-center gap-1 w-full">
            <ArrowRight className="w-4 h-4 text-primary rotate-90" />
            <input
              value={handoff || ''}
              onChange={e => onHandoffChange(index, e.target.value)}
              placeholder="Handoff note (e.g. Pass market analysis to next bot)"
              className="w-full bg-secondary border border-border/50 border-dashed rounded-lg px-2 py-1 text-[9px] outline-none text-foreground placeholder:text-muted-foreground/50"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function SquadBoard({ bots }) {
  const [pipelines, setPipelines] = useState([]);
  const [activePipeline, setActivePipeline] = useState(null); // pipeline being edited
  const [form, setForm] = useState(BLANK_PIPELINE);
  const [handoffs, setHandoffs] = useState([]); // handoff notes between steps
  const [addingBot, setAddingBot] = useState(false);
  const [running, setRunning] = useState(false);
  const [runInput, setRunInput] = useState('');
  const [runResult, setRunResult] = useState(null);
  const [showRunInput, setShowRunInput] = useState(false);
  const [loading, setLoading] = useState(true);

  // Store pipelines as BotImprovement records with a special type, or better: as UserBot with role='custom' tagged
  // Simplest: store pipelines in localStorage for now since we have no dedicated entity
  useEffect(() => {
    const saved = localStorage.getItem('squad_pipelines');
    if (saved) setPipelines(JSON.parse(saved));
    setLoading(false);
  }, []);

  const savePipelines = (updated) => {
    localStorage.setItem('squad_pipelines', JSON.stringify(updated));
    setPipelines(updated);
  };

  const addStep = (botId) => {
    const bot = bots.find(b => b.id === botId);
    if (!bot) return;
    setForm(f => ({ ...f, steps: [...f.steps, botId] }));
    setHandoffs(h => [...h, '']);
    setAddingBot(false);
  };

  const removeStep = (idx) => {
    setForm(f => ({ ...f, steps: f.steps.filter((_, i) => i !== idx) }));
    setHandoffs(h => h.filter((_, i) => i !== idx));
  };

  const updateHandoff = (idx, val) => {
    setHandoffs(h => h.map((v, i) => i === idx ? val : v));
  };

  const savePipeline = () => {
    if (!form.name || form.steps.length < 2) return;
    const pipeline = { id: Date.now().toString(), name: form.name, description: form.description, steps: form.steps, handoffs, created_at: new Date().toISOString() };
    const updated = activePipeline
      ? pipelines.map(p => p.id === activePipeline ? pipeline : p)
      : [...pipelines, pipeline];
    savePipelines(updated);
    setForm(BLANK_PIPELINE);
    setHandoffs([]);
    setActivePipeline(null);
  };

  const deletePipeline = (id) => savePipelines(pipelines.filter(p => p.id !== id));

  const editPipeline = (p) => {
    setActivePipeline(p.id);
    setForm({ name: p.name, steps: p.steps, description: p.description || '' });
    setHandoffs(p.handoffs || []);
  };

  const runPipeline = async (pipeline) => {
    if (!runInput.trim()) return;
    setRunning(true);
    setRunResult(null);

    let currentOutput = runInput;
    const log = [];

    for (let i = 0; i < pipeline.steps.length; i++) {
      const bot = bots.find(b => b.id === pipeline.steps[i]);
      if (!bot) continue;
      const handoffNote = pipeline.handoffs?.[i] || '';
      const prompt = `You are ${bot.name}. ${bot.instructions || ''}\nPersonality: ${bot.personality || 'helpful'}\n\n${handoffNote ? `Context for this step: ${handoffNote}\n\n` : ''}Input from previous step:\n${currentOutput}\n\nProvide your output for the next step in the pipeline. Be concise and structured.`;

      const res = await base44.integrations.Core.InvokeLLM({ prompt });
      log.push({ bot: bot.name, output: res });
      currentOutput = res;

      // Update bot XP
      await base44.entities.UserBot.update(bot.id, { xp: (bot.xp || 0) + 5, usage_count: (bot.usage_count || 0) + 1 }).catch(() => {});
    }

    setRunResult(log);
    setRunning(false);
  };

  const stepBots = form.steps.map(id => bots.find(b => b.id === id)).filter(Boolean);
  const availableBots = bots.filter(b => !form.steps.includes(b.id));

  if (loading) return <div className="flex justify-center py-16"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="bg-blue-400/5 border border-blue-400/20 rounded-xl p-3">
        <p className="text-xs font-semibold text-blue-400 mb-1">🔗 Squad Board — Multi-Agent Pipelines</p>
        <p className="text-[10px] text-muted-foreground">Connect bots in sequence. Each bot's output feeds the next. Runs live with real AI.</p>
      </div>

      {/* Pipeline Builder */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <p className="text-xs font-semibold">{activePipeline ? 'Edit Pipeline' : 'New Pipeline'}</p>

        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Pipeline name (e.g. Trader → Analyst → Alert)"
          className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs outline-none" />

        {/* Steps */}
        <div className="space-y-2 min-h-[60px]">
          {stepBots.length === 0 ? (
            <div className="border-2 border-dashed border-border rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground">Add bots below to build the pipeline</p>
            </div>
          ) : stepBots.map((bot, i) => (
            <BotNode key={`${bot.id}-${i}`} bot={bot} index={i} total={stepBots.length}
              onRemove={removeStep} handoff={handoffs[i]} onHandoffChange={updateHandoff} />
          ))}
        </div>

        {/* Add bot */}
        {!addingBot ? (
          <button onClick={() => setAddingBot(true)} disabled={availableBots.length === 0}
            className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-primary/40 rounded-xl text-xs text-primary hover:bg-primary/5 disabled:opacity-40">
            <Plus className="w-3.5 h-3.5" /> Add Bot to Pipeline
          </button>
        ) : (
          <div className="bg-secondary border border-border rounded-xl p-2 space-y-1.5 max-h-40 overflow-y-auto">
            <p className="text-[10px] text-muted-foreground px-1">Select bot to add:</p>
            {availableBots.map(bot => (
              <button key={bot.id} onClick={() => addStep(bot.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-card rounded-lg text-left">
                <span>{ROLE_EMOJI[bot.role] || '🤖'}</span>
                <span className="text-xs font-medium">{bot.name}</span>
                <span className="text-[9px] text-muted-foreground ml-auto capitalize">{bot.role}</span>
              </button>
            ))}
            <button onClick={() => setAddingBot(false)} className="w-full text-[10px] text-muted-foreground py-1">Cancel</button>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={savePipeline} disabled={!form.name || form.steps.length < 2}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold disabled:opacity-40">
            <Save className="w-3 h-3" /> {activePipeline ? 'Update' : 'Save Pipeline'}
          </button>
          {activePipeline && (
            <button onClick={() => { setActivePipeline(null); setForm(BLANK_PIPELINE); setHandoffs([]); }}
              className="px-3 py-2 border border-border rounded-xl text-xs text-muted-foreground">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Saved Pipelines */}
      {pipelines.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Saved Pipelines</p>
          {pipelines.map(p => (
            <div key={p.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold flex items-center gap-2"><Network className="w-3.5 h-3.5 text-primary" />{p.name}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{p.steps.length} bots · {new Date(p.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => editPipeline(p)} className="text-[10px] px-2 py-1 border border-border rounded-lg text-muted-foreground">Edit</button>
                  <button onClick={() => deletePipeline(p.id)} className="text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              {/* Flow preview */}
              <div className="flex items-center gap-1 flex-wrap">
                {p.steps.map((sid, i) => {
                  const b = bots.find(bot => bot.id === sid);
                  return b ? (
                    <span key={i} className="flex items-center gap-1">
                      <span className="text-[10px] bg-secondary px-2 py-0.5 rounded-lg font-medium">{ROLE_EMOJI[b.role]} {b.name}</span>
                      {i < p.steps.length - 1 && <ArrowRight className="w-3 h-3 text-primary" />}
                    </span>
                  ) : null;
                })}
              </div>

              {/* Run controls */}
              <div className="space-y-2 border-t border-border/50 pt-2">
                {showRunInput === p.id ? (
                  <>
                    <textarea value={runInput} onChange={e => setRunInput(e.target.value)}
                      placeholder="Initial input for the pipeline…"
                      className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs outline-none resize-none min-h-[60px]" />
                    <div className="flex gap-2">
                      <button onClick={() => runPipeline(p)} disabled={running || !runInput.trim()}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold disabled:opacity-40">
                        {running ? <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Running…</> : <><Zap className="w-3 h-3" /> Run Pipeline</>}
                      </button>
                      <button onClick={() => { setShowRunInput(null); setRunResult(null); setRunInput(''); }}
                        className="px-3 py-2 border border-border rounded-xl text-xs text-muted-foreground">Cancel</button>
                    </div>
                  </>
                ) : (
                  <button onClick={() => { setShowRunInput(p.id); setRunResult(null); }}
                    className="w-full flex items-center justify-center gap-1.5 py-2 border border-primary/30 text-primary bg-primary/5 rounded-xl text-xs font-semibold hover:bg-primary/10">
                    <Play className="w-3 h-3" /> Run This Pipeline
                  </button>
                )}

                {runResult && showRunInput === p.id && (
                  <div className="space-y-2">
                    {runResult.map((step, i) => (
                      <div key={i} className="bg-secondary rounded-xl p-3">
                        <p className="text-[9px] font-semibold text-primary mb-1">Step {i + 1}: {step.bot}</p>
                        <p className="text-[10px] text-foreground/80 leading-relaxed">{step.output}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {pipelines.length === 0 && (
        <div className="text-center py-6 text-muted-foreground">
          <Network className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm">No pipelines yet</p>
          <p className="text-[10px] mt-1">Build a pipeline above with 2+ bots to create an automated workflow</p>
        </div>
      )}
    </div>
  );
}