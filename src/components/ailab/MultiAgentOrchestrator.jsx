import { useState, useEffect } from 'react';
import { Network, ChevronRight, Loader2, Star } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const STAGES = ['plan', 'execution', 'analysis', 'improvement'];
const STAGE_LABELS = { plan: '🗺️ Plan', execution: '⚡ Execute', analysis: '🔍 Analyze', improvement: '📈 Improve' };

export default function MultiAgentOrchestrator() {
  const { currentUser } = useAuth();
  const [goal, setGoal] = useState('');
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState(null);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = async () => {
    setLoadingHistory(true);
    const data = await base44.entities.BotImprovement.list('-created_date', 10);
    setHistory(data);
    setLoadingHistory(false);
  };

  useEffect(() => { loadHistory(); }, []);

  const runCycle = async () => {
    if (!goal.trim() || running) return;
    setRunning(true);
    setResult(null);
    const cycleResult = {};

    // Phase 1: Plan
    setStage('plan');
    cycleResult.plan = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a strategic AI orchestrator. Create a clear, actionable step-by-step plan to achieve this goal:\n"${goal}"\n\nProvide 4-6 concrete steps. Be specific and practical.`,
    });

    // Phase 2: Execute
    setStage('execution');
    cycleResult.execution = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an execution AI. Based on this plan:\n${cycleResult.plan}\n\nSimulate executing each step. Report what was done, what worked, and what obstacles arose.`,
    });

    // Phase 3: Analyze
    setStage('analysis');
    cycleResult.analysis = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an analysis AI. Evaluate this execution:\n${cycleResult.execution}\n\nWas the goal "${goal}" achieved? What worked well? What failed? Be critical and honest.`,
    });

    // Phase 4: Improve
    setStage('improvement');
    const improvementRes = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an improvement AI. Based on this analysis:\n${cycleResult.analysis}\n\nProvide specific improvements for the next cycle. Then on a new line, output ONLY a number 1-10 representing overall effectiveness score.`,
    });

    const lines = improvementRes.split('\n').filter(Boolean);
    const scoreMatch = improvementRes.match(/\b([0-9]|10)\b/g);
    const score = scoreMatch ? parseInt(scoreMatch[scoreMatch.length - 1]) : 5;
    cycleResult.improvement = lines.slice(0, -1).join('\n') || improvementRes;
    cycleResult.score = score;

    // Save to DB
    await base44.entities.BotImprovement.create({
      goal,
      plan: cycleResult.plan,
      execution: cycleResult.execution,
      analysis: cycleResult.analysis,
      improvement: cycleResult.improvement,
      score: cycleResult.score,
      user_email: currentUser?.email,
    });

    setResult(cycleResult);
    setStage(null);
    setRunning(false);
    loadHistory();
  };

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="bg-orange-400/5 border border-orange-400/20 rounded-xl p-3">
        <p className="text-xs font-semibold text-orange-400 mb-1">🌐 Multi-Agent Orchestrator</p>
        <p className="text-[10px] text-muted-foreground">Chains 4 AI agents: Plan → Execute → Analyze → Improve. Each cycle learns and self-optimizes.</p>
      </div>

      {/* Goal input */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Define your goal</label>
        <textarea value={goal} onChange={e => setGoal(e.target.value)}
          placeholder="e.g. Increase portfolio ROI by 15% through diversification and automated rebalancing..."
          className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm outline-none resize-none min-h-[80px] text-foreground" />
        <button onClick={runCycle} disabled={!goal.trim() || running}
          className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-40 transition-all">
          {running ? <><Loader2 className="w-4 h-4 animate-spin" /> Running cycle…</> : <><Network className="w-4 h-4" /> Run Agent Cycle</>}
        </button>
      </div>

      {/* Stage progress */}
      {running && (
        <div className="flex items-center gap-1">
          {STAGES.map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${stage === s ? 'bg-orange-400 animate-pulse' : STAGES.indexOf(stage) > i ? 'bg-primary' : 'bg-secondary'}`} />
              {i < STAGES.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
            </div>
          ))}
        </div>
      )}
      {running && stage && (
        <p className="text-xs text-center text-orange-400 font-medium">{STAGE_LABELS[stage]} in progress…</p>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">Cycle Complete</p>
            <div className="flex items-center gap-1">
              {Array.from({ length: result.score }).map((_, i) => (
                <Star key={i} className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              ))}
              <span className="text-xs text-muted-foreground ml-1">{result.score}/10</span>
            </div>
          </div>
          {STAGES.map(s => (
            <details key={s} className="bg-card border border-border rounded-xl overflow-hidden">
              <summary className="px-3 py-2.5 text-xs font-medium cursor-pointer flex items-center gap-2 hover:bg-secondary/40">
                {STAGE_LABELS[s]}
              </summary>
              <div className="px-3 pb-3 text-[10px] text-muted-foreground leading-relaxed border-t border-border/50 pt-2">
                {result[s]}
              </div>
            </details>
          ))}
        </div>
      )}

      {/* History */}
      <div className="space-y-2">
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Improvement History</p>
        {loadingHistory ? (
          <div className="flex justify-center py-4"><div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : history.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No cycles run yet</p>
        ) : (
          history.map(h => (
            <div key={h.id} className="bg-card border border-border rounded-xl p-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-400/10 border border-orange-400/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-orange-400">{h.score || '?'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{h.goal}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{h.improvement?.slice(0, 100)}…</p>
                <p className="text-[9px] text-muted-foreground mt-1">{new Date(h.created_date).toLocaleDateString()}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}