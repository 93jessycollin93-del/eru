import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { invokeSelectedModel } from './modelRouting';
import { BarChart3, CheckCircle2, FlaskConical, Save, Sparkles, Upload } from 'lucide-react';
import { buildRegressionPrompt, scoreSimilarity, runRegressionSuite } from './regressionTesting';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';

const EMPTY_GOLDEN = { title: '', input: '', expected_output: '', min_similarity_score: 0.75 };

export default function BotTrainingPanel({ bots, globalPolicy, onBotsUpdated }) {
  const [selectedBotId, setSelectedBotId] = useState('');
  const [goldens, setGoldens] = useState([]);
  const [candidateInstructions, setCandidateInstructions] = useState('');
  const [form, setForm] = useState(EMPTY_GOLDEN);
  const [running, setRunning] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState([]);

  const selectedBot = useMemo(() => bots.find((bot) => bot.id === selectedBotId) || null, [bots, selectedBotId]);

  useEffect(() => {
    if (!selectedBot) {
      setGoldens([]);
      setCandidateInstructions('');
      setResults([]);
      return;
    }

    setCandidateInstructions(selectedBot.instructions || '');
    base44.entities.BotTestCase.filter({ bot_id: selectedBot.id }, '-created_date', 20).then((rows) => {
      setGoldens(rows);
    });
    setResults([]);
  }, [selectedBot]);

  const addGolden = async () => {
    if (!selectedBot || !form.title || !form.input || !form.expected_output) return;
    await base44.entities.BotTestCase.create({
      bot_id: selectedBot.id,
      bot_name: selectedBot.name,
      title: form.title,
      input: form.input,
      expected_output: form.expected_output,
      min_similarity_score: Number(form.min_similarity_score),
      is_active: true,
    });
    const rows = await base44.entities.BotTestCase.filter({ bot_id: selectedBot.id }, '-created_date', 20);
    setGoldens(rows);
    setForm(EMPTY_GOLDEN);
  };

  const runTraining = async () => {
    if (!selectedBot || goldens.length === 0) return;
    setRunning(true);
    const nextResults = [];

    for (const golden of goldens.filter((item) => item.is_active !== false)) {
      const currentPrompt = buildRegressionPrompt(selectedBot, selectedBot.instructions || '', golden.input, globalPolicy);
      const candidatePrompt = buildRegressionPrompt(selectedBot, candidateInstructions, golden.input, globalPolicy);

      const currentOutput = await invokeSelectedModel({ provider: selectedBot.model_provider, model: selectedBot.model_name, prompt: currentPrompt }).catch(() => 'Model unavailable');
      const candidateOutput = await invokeSelectedModel({ provider: selectedBot.model_provider, model: selectedBot.model_name, prompt: candidatePrompt }).catch(() => 'Model unavailable');

      const currentScore = await scoreSimilarity(golden.expected_output, currentOutput);
      const candidateScore = await scoreSimilarity(golden.expected_output, candidateOutput);

      nextResults.push({
        id: golden.id,
        title: golden.title,
        minScore: Number(golden.min_similarity_score || 0.75),
        currentOutput,
        candidateOutput,
        currentScore: Number(currentScore.similarity_score || 0),
        candidateScore: Number(candidateScore.similarity_score || 0),
        currentReason: currentScore.reason,
        candidateReason: candidateScore.reason,
      });
    }

    setResults(nextResults);
    setRunning(false);
  };

  const handleCsvUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedBot) return;
    setUploading(true);
    const text = await file.text();
    const rows = text.split(/\r?\n/).filter(Boolean);
    const headers = rows[0].split(',').map((item) => item.trim().toLowerCase());
    const titleIndex = headers.indexOf('title');
    const inputIndex = headers.indexOf('input');
    const expectedIndex = headers.indexOf('expected_output');
    const minIndex = headers.indexOf('min_similarity_score');

    const records = rows.slice(1).map((row) => row.split(',')).filter((cols) => cols.length >= 3).map((cols) => ({
      bot_id: selectedBot.id,
      bot_name: selectedBot.name,
      title: cols[titleIndex]?.trim() || 'Imported test',
      input: cols[inputIndex]?.trim() || '',
      expected_output: cols[expectedIndex]?.trim() || '',
      min_similarity_score: Number(cols[minIndex]?.trim() || 0.75),
      is_active: true,
    })).filter((item) => item.input && item.expected_output);

    if (records.length > 0) {
      await base44.entities.BotTestCase.bulkCreate(records);
      const rows = await base44.entities.BotTestCase.filter({ bot_id: selectedBot.id }, '-created_date', 100);
      setGoldens(rows);
    }
    setUploading(false);
    event.target.value = '';
  };

  const publishChanges = async () => {
    if (!selectedBot) return;
    setPublishing(true);
    await base44.entities.BotVersion.create({
      bot_id: selectedBot.id,
      bot_name: selectedBot.name,
      version_label: `Pre-training ${new Date().toLocaleString()}`,
      instructions: selectedBot.instructions || '',
      personality: selectedBot.personality || '',
      response_style: selectedBot.response_style || '',
      handoff_instructions: selectedBot.handoff_instructions || '',
      notes: 'Auto-snapshot before Bot Training publish',
      user_email: selectedBot.created_by,
    });
    await base44.entities.UserBot.update(selectedBot.id, { instructions: candidateInstructions });
    await runRegressionSuite({ bot: { ...selectedBot, instructions: candidateInstructions }, instructions: candidateInstructions, globalPolicy });
    setPublishing(false);
    onBotsUpdated?.();
  };

  const summary = useMemo(() => {
    if (results.length === 0) return null;
    const previousAverage = Math.round((results.reduce((sum, item) => sum + item.currentScore, 0) / results.length) * 100);
    const candidateAverage = Math.round((results.reduce((sum, item) => sum + item.candidateScore, 0) / results.length) * 100);
    const previousPasses = results.filter((item) => item.currentScore >= item.minScore).length;
    const candidatePasses = results.filter((item) => item.candidateScore >= item.minScore).length;
    return { previousAverage, candidateAverage, previousPasses, candidatePasses };
  }, [results]);

  const chartData = useMemo(() => {
    if (results.length === 0) return [];
    return results.map((item) => ({
      name: item.title.length > 12 ? `${item.title.slice(0, 12)}…` : item.title,
      previous: Math.round(item.currentScore * 100),
      candidate: Math.round(item.candidateScore * 100),
    }));
  }, [results]);

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Bot Training</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Run iterative micro-tests on golden prompts and compare current instructions against a trained candidate before publishing.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <select value={selectedBotId} onChange={(e) => setSelectedBotId(e.target.value)} className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none">
          <option value="">Choose bot</option>
          {bots.map((bot) => <option key={bot.id} value={bot.id}>{bot.name}</option>)}
        </select>

        {selectedBot && (
          <>
            <textarea value={candidateInstructions} onChange={(e) => setCandidateInstructions(e.target.value)} placeholder="Write revised bot instructions to train against golden prompts" className="min-h-[120px] w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none" />

            <div className="rounded-xl border border-border bg-background p-3 space-y-2">
              <p className="text-xs font-semibold text-foreground">Add golden micro-test</p>
              <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Golden test title" className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none" />
              <textarea value={form.input} onChange={(e) => setForm((prev) => ({ ...prev, input: e.target.value }))} placeholder="Golden input" className="min-h-[70px] w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none" />
              <textarea value={form.expected_output} onChange={(e) => setForm((prev) => ({ ...prev, expected_output: e.target.value }))} placeholder="Expected outcome" className="min-h-[70px] w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none" />
              <div className="flex flex-wrap gap-2">
                <button onClick={addGolden} className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
                  <Sparkles className="w-3.5 h-3.5" /> Add golden test
                </button>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-semibold text-foreground">
                  <Upload className="w-3.5 h-3.5" /> {uploading ? 'Uploading...' : 'Upload CSV'}
                  <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
                </label>
              </div>
              <p className="text-[10px] text-muted-foreground">CSV columns: title,input,expected_output,min_similarity_score</p>
            </div>

            <div className="rounded-xl border border-border bg-background p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-foreground">Golden set</p>
                <span className="text-[10px] text-muted-foreground">{goldens.length} tests</span>
              </div>
              {goldens.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">Add a few small golden prompts to start training.</p>
              ) : (
                <div className="space-y-2">
                  {goldens.map((item) => (
                    <div key={item.id} className="rounded-lg border border-border bg-secondary/30 p-2">
                      <p className="text-xs font-medium text-foreground">{item.title}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{item.input}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={runTraining} disabled={running || goldens.length === 0 || !candidateInstructions.trim()} className="w-full rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-40">
              {running ? 'Running training...' : 'Run micro-tests'}
            </button>
          </>
        )}
      </div>

      {summary && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-border bg-secondary/30 p-3 text-[11px] text-muted-foreground">Previous avg <span className="block text-lg font-semibold text-foreground">{summary.previousAverage}%</span></div>
            <div className="rounded-xl border border-border bg-secondary/30 p-3 text-[11px] text-muted-foreground">Candidate avg <span className="block text-lg font-semibold text-foreground">{summary.candidateAverage}%</span></div>
            <div className="rounded-xl border border-border bg-secondary/30 p-3 text-[11px] text-muted-foreground">Previous passes <span className="block text-lg font-semibold text-foreground">{summary.previousPasses}</span></div>
            <div className="rounded-xl border border-border bg-secondary/30 p-3 text-[11px] text-muted-foreground">Candidate passes <span className="block text-lg font-semibold text-foreground">{summary.candidatePasses}</span></div>
          </div>

          <div className="rounded-xl border border-border bg-background p-3">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Previous vs new performance</p>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="previous" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="Previous" />
                <Bar dataKey="candidate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="New" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2">
            {results.map((item) => (
              <div key={item.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-foreground">{item.title}</p>
                  <span className="text-[10px] text-muted-foreground">{Math.round(item.currentScore * 100)}% → {Math.round(item.candidateScore * 100)}%</span>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">Previous: {item.currentReason}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">New: {item.candidateReason}</p>
              </div>
            ))}
          </div>

          <button onClick={publishChanges} disabled={publishing || !selectedBot} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-40">
            <Save className="w-3.5 h-3.5" /> {publishing ? 'Publishing...' : 'Publish new instructions'}
          </button>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> A pre-training snapshot is saved automatically before publish.
          </div>
        </div>
      )}
    </div>
  );
}