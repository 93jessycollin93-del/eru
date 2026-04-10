import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FlaskConical, Play, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { invokeSelectedModel } from './modelRouting';

const EMPTY_CASE = {
  bot_id: '',
  title: '',
  input: '',
  expected_output: '',
  min_similarity_score: 0.75,
};

async function scoreSimilarity(expectedOutput, actualOutput) {
  const response = await base44.integrations.Core.InvokeLLM({
    prompt: `You are grading a bot response.
Expected output:\n${expectedOutput}\n\nActual output:\n${actualOutput}\n\nScore the semantic similarity from 0 to 1, where 1 means the actual output fully satisfies the expected output in meaning and logic. Return a short reason.`,
    response_json_schema: {
      type: 'object',
      properties: {
        similarity_score: { type: 'number' },
        reason: { type: 'string' }
      },
      required: ['similarity_score', 'reason']
    }
  });
  return response;
}

export default function BotTestingSuite({ bots, globalPolicy }) {
  const [testCases, setTestCases] = useState([]);
  const [testRuns, setTestRuns] = useState([]);
  const [form, setForm] = useState(EMPTY_CASE);
  const [runningBotId, setRunningBotId] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [caseRows, runRows] = await Promise.all([
      base44.entities.BotTestCase.list('-created_date', 200),
      base44.entities.BotTestRun.list('-created_date', 300),
    ]);
    setTestCases(caseRows);
    setTestRuns(runRows);
  };

  useEffect(() => { load(); }, []);

  const selectedBotCases = useMemo(() => testCases.filter((item) => !runningBotId || item.bot_id === runningBotId), [testCases, runningBotId]);

  const createCase = async () => {
    const bot = bots.find((item) => item.id === form.bot_id);
    if (!bot) return;
    setSaving(true);
    await base44.entities.BotTestCase.create({
      ...form,
      bot_name: bot.name,
      min_similarity_score: Number(form.min_similarity_score),
    });
    setForm(EMPTY_CASE);
    setSaving(false);
    load();
  };

  const runTests = async (botId) => {
    const bot = bots.find((item) => item.id === botId);
    if (!bot) return;
    setRunningBotId(botId);
    const cases = testCases.filter((item) => item.bot_id === botId && item.is_active !== false);
    const runGroup = `run_${Date.now()}`;
    const previousRuns = testRuns.filter((item) => item.bot_id === botId);

    for (const testCase of cases) {
      const policyBlock = globalPolicy?.is_active ? `\nGlobal instructions: ${globalPolicy.shared_instructions || 'None'}` : '';
      const prompt = `You are ${bot.name}. ${bot.instructions || ''}\nPersonality: ${bot.personality || 'helpful'}\nResponse style: ${bot.response_style || 'detailed'}${policyBlock}\n\nUser: ${testCase.input}\n\n${bot.name}:`;
      const actualOutput = await invokeSelectedModel({ provider: bot.model_provider, model: bot.model_name, prompt });
      const scored = await scoreSimilarity(testCase.expected_output, actualOutput);
      const previousForCase = previousRuns.find((item) => item.test_case_id === testCase.id);
      const similarity = Number(scored.similarity_score || 0);
      const passed = similarity >= Number(testCase.min_similarity_score || 0.75);
      const regressionFlag = !!previousForCase && similarity < (previousForCase.similarity_score || 0) - 0.1;
      const regressionReason = regressionFlag ? `Similarity dropped from ${previousForCase.similarity_score} to ${similarity}. ${scored.reason}` : '';

      await base44.entities.BotTestRun.create({
        bot_id: bot.id,
        bot_name: bot.name,
        test_case_id: testCase.id,
        test_title: testCase.title,
        input: testCase.input,
        expected_output: testCase.expected_output,
        actual_output: actualOutput,
        similarity_score: similarity,
        passed,
        pass_rate_snapshot: passed ? 100 : 0,
        regression_flag: regressionFlag,
        regression_reason: regressionReason,
        run_group: runGroup,
      });
    }

    setRunningBotId('');
    load();
  };

  const botSummaries = useMemo(() => bots.map((bot) => {
    const cases = testCases.filter((item) => item.bot_id === bot.id);
    const runs = testRuns.filter((item) => item.bot_id === bot.id);
    const latestGroup = runs[0]?.run_group;
    const latestRuns = latestGroup ? runs.filter((item) => item.run_group === latestGroup) : [];
    const passedCount = latestRuns.filter((item) => item.passed).length;
    const passRate = latestRuns.length ? Math.round((passedCount / latestRuns.length) * 100) : 0;
    const regressions = latestRuns.filter((item) => item.regression_flag).length;
    return { bot, caseCount: cases.length, passRate, regressions, latestRuns };
  }), [bots, testCases, testRuns]);

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Automated Bot Testing</p>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Create test cases, auto-run them, score semantic similarity, and catch regressions.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-semibold text-foreground">New test case</p>
        <select value={form.bot_id} onChange={(e) => setForm((prev) => ({ ...prev, bot_id: e.target.value }))} className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none">
          <option value="">Choose bot</option>
          {bots.map((bot) => <option key={bot.id} value={bot.id}>{bot.name}</option>)}
        </select>
        <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Test case name" className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none" />
        <textarea value={form.input} onChange={(e) => setForm((prev) => ({ ...prev, input: e.target.value }))} placeholder="Bot input" className="min-h-[90px] w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none" />
        <textarea value={form.expected_output} onChange={(e) => setForm((prev) => ({ ...prev, expected_output: e.target.value }))} placeholder="Expected output" className="min-h-[90px] w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none" />
        <input type="number" step="0.05" min="0" max="1" value={form.min_similarity_score} onChange={(e) => setForm((prev) => ({ ...prev, min_similarity_score: e.target.value }))} className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none" />
        <button onClick={createCase} disabled={!form.bot_id || !form.title || !form.input || !form.expected_output || saving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-40">
          <Plus className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Add test case'}
        </button>
      </div>

      <div className="space-y-3">
        {botSummaries.map(({ bot, caseCount, passRate, regressions, latestRuns }) => (
          <div key={bot.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{bot.name}</p>
                <p className="text-[11px] text-muted-foreground">{caseCount} test cases · {passRate}% latest pass rate · {(bot.api_label || bot.model_name || bot.model_provider || 'base44')}</p>
              </div>
              <button onClick={() => runTests(bot.id)} disabled={caseCount === 0 || runningBotId === bot.id} className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary disabled:opacity-40">
                <Play className="w-3.5 h-3.5" /> {runningBotId === bot.id ? 'Running...' : 'Run tests'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div className="rounded-xl bg-secondary p-3 text-muted-foreground">Cases <span className="font-semibold text-foreground">{caseCount}</span></div>
              <div className="rounded-xl bg-secondary p-3 text-muted-foreground">Pass rate <span className="font-semibold text-green-400">{passRate}%</span></div>
              <div className="rounded-xl bg-secondary p-3 text-muted-foreground">Regressions <span className="font-semibold text-red-400">{regressions}</span></div>
            </div>

            {latestRuns.length > 0 && (
              <div className="space-y-2">
                {latestRuns.map((run) => (
                  <div key={run.id} className="rounded-xl border border-border bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-foreground">{run.test_title}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">Similarity {Math.round((run.similarity_score || 0) * 100)}%</p>
                      </div>
                      {run.passed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-400/10 px-2 py-1 text-[10px] font-semibold text-green-400"><CheckCircle2 className="w-3 h-3" /> Pass</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-400/10 px-2 py-1 text-[10px] font-semibold text-red-400"><AlertTriangle className="w-3 h-3" /> Fail</span>
                      )}
                    </div>
                    {run.regression_flag && <p className="mt-2 text-[10px] text-red-300">Regression: {run.regression_reason}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedBotCases.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No test cases yet.</div>
      )}
    </div>
  );
}