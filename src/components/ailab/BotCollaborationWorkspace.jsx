import { useEffect, useMemo, useState } from 'react';
import { BrainCircuit, CheckSquare, Loader2, MessageSquareShare, Square, Users } from 'lucide-react';
import SpeechToTextInput from './SpeechToTextInput.jsx';
import CollaborationLiveRoom from './CollaborationLiveRoom.jsx';
import { base44 } from '@/api/base44Client';

export default function BotCollaborationWorkspace({ bots }) {
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [selectedBotIds, setSelectedBotIds] = useState([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [liveMessages, setLiveMessages] = useState([]);
  const [guidance, setGuidance] = useState('');
  const [guidanceNotes, setGuidanceNotes] = useState([]);

  const selectedBots = useMemo(() => bots.filter((bot) => selectedBotIds.includes(bot.id)), [bots, selectedBotIds]);

  const loadSessions = async () => {
    const rows = await base44.entities.BotCollaborationSession.list('-created_date', 12);
    setSessions(rows);
  };

  useEffect(() => { loadSessions(); }, []);

  const toggleBot = (botId) => {
    setSelectedBotIds((prev) => prev.includes(botId) ? prev.filter((id) => id !== botId) : [...prev, botId]);
  };

  const runCollaboration = async () => {
    if (!goal.trim() || selectedBots.length < 2 || running) return;
    setRunning(true);
    setResult(null);
    setGuidance('');
    setGuidanceNotes([]);
    setLiveMessages([{ role: 'system', label: 'Session started', content: `Starting collaboration for: ${goal}` }]);

    const planner = await base44.integrations.Core.InvokeLLM({
      prompt: `You are coordinating a team of AI bots for a complex task.
Goal: ${goal}
Bots available: ${selectedBots.map((bot) => `${bot.name} (${bot.role})`).join(', ')}

Assign one focused subtask to each bot. Return plain text in this format exactly:
Bot Name: task`
    });

    setLiveMessages((prev) => [...prev, { role: 'system', label: 'Delegation plan', content: planner }]);

    const planLines = planner.split('\n').filter(Boolean);
    const delegationPlan = selectedBots.map((bot, index) => {
      const matchingLine = planLines.find((line) => line.toLowerCase().startsWith(bot.name.toLowerCase() + ':'));
      return {
        bot_id: bot.id,
        bot_name: bot.name,
        task: matchingLine ? matchingLine.split(':').slice(1).join(':').trim() : `Contribute to the goal from the perspective of a ${bot.role} bot.`
      };
    });

    const findings = [];
    for (const item of delegationPlan) {
      const bot = selectedBots.find((entry) => entry.id === item.bot_id);
      const currentGuidance = guidanceNotes.length > 0 ? `\nLive guidance from the user:\n${guidanceNotes.map((note) => `- ${note}`).join('\n')}` : '';
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are ${bot.name}. ${bot.instructions || ''}
Role: ${bot.role}
Task goal: ${goal}
Your delegated task: ${item.task}${currentGuidance}

Produce your best finding for the team. Be concrete, useful, and concise.`
      });
      findings.push({ ...item, finding: response });
      setLiveMessages((prev) => [...prev, { role: 'bot', label: `${bot.name} finding`, content: response }]);
    }

    const feedback = [];
    for (const reviewer of selectedBots) {
      const peerSummary = findings.filter((item) => item.bot_id !== reviewer.id).map((item) => `${item.bot_name}: ${item.finding}`).join('\n\n');
      const currentGuidance = guidanceNotes.length > 0 ? `\nUser guidance to consider:\n${guidanceNotes.map((note) => `- ${note}`).join('\n')}` : '';
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are ${reviewer.name}. ${reviewer.instructions || ''}
Goal: ${goal}
Other bots shared these findings:
${peerSummary}${currentGuidance}

Give short peer feedback that improves quality, catches gaps, and increases accuracy.`
      });
      feedback.push({
        reviewer_bot_id: reviewer.id,
        reviewer_bot_name: reviewer.name,
        feedback: response,
      });
      setLiveMessages((prev) => [...prev, { role: 'bot', label: `${reviewer.name} feedback`, content: response }]);
    }

    const finalOutput = await base44.integrations.Core.InvokeLLM({
      prompt: `Synthesize this collaborative bot work into one final answer.
Goal: ${goal}
Delegation plan:
${delegationPlan.map((item) => `${item.bot_name}: ${item.task}`).join('\n')}

Findings:
${findings.map((item) => `${item.bot_name}: ${item.finding}`).join('\n\n')}

Peer feedback:
${feedback.map((item) => `${item.reviewer_bot_name}: ${item.feedback}`).join('\n\n')}

Live user guidance:
${guidanceNotes.length > 0 ? guidanceNotes.map((note) => `- ${note}`).join('\n') : 'None'}

Return the best final answer with clear sections: Summary, Key Findings, Recommended Next Step.`
    });
    setLiveMessages((prev) => [...prev, { role: 'system', label: 'Final synthesis', content: finalOutput }]);

    const payload = {
      title: title.trim() || 'Bot Collaboration Session',
      goal,
      status: 'completed',
      selected_bot_ids: selectedBotIds,
      delegation_plan: delegationPlan,
      findings,
      feedback,
      final_output: finalOutput,
    };

    await base44.entities.BotCollaborationSession.create(payload);
    setResult(payload);
    setTitle('');
    setGoal('');
    setSelectedBotIds([]);
    setRunning(false);
    loadSessions();
  };

  const sendGuidance = () => {
    if (!guidance.trim() || !running) return;
    const note = guidance.trim();
    setGuidanceNotes((prev) => [...prev, note]);
    setLiveMessages((prev) => [...prev, { role: 'user', label: 'User guidance', content: note }]);
    setGuidance('');
  };

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
        <p className="text-xs font-semibold text-primary mb-1">🤝 Bot Collaboration Workspace</p>
        <p className="text-[10px] text-muted-foreground">Bots can split work, share findings, review each other, and produce a stronger final answer together.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Session title"
          className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none text-foreground"
        />
        <SpeechToTextInput
          value={goal}
          onChange={setGoal}
          placeholder="Describe the complex task you want the bots to solve together..."
          multiline
          minHeightClass="min-h-[90px]"
        />
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Choose collaborating bots</p>
          <div className="space-y-2">
            {bots.map((bot) => (
              <button
                key={bot.id}
                onClick={() => toggleBot(bot.id)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left ${selectedBotIds.includes(bot.id) ? 'border-primary bg-primary/10' : 'border-border bg-secondary'}`}
              >
                <div className="flex items-center gap-2">
                  {selectedBotIds.includes(bot.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{bot.name}</p>
                    <p className="text-[10px] text-muted-foreground">{bot.role} · {bot.response_style || 'detailed'}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={runCollaboration}
          disabled={!goal.trim() || selectedBotIds.length < 2 || running}
          className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          {running ? 'Running collaboration…' : 'Run collaborative task'}
        </button>
      </div>

      {running && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-primary" /> Bots are delegating, sharing findings, and reviewing each other.
        </div>
      )}

      <CollaborationLiveRoom
        messages={liveMessages}
        guidance={guidance}
        setGuidance={setGuidance}
        onSendGuidance={sendGuidance}
        running={running}
      />

      {result && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">Final collaborative result</p>
            </div>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{result.final_output}</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">Delegation and findings</p>
            </div>
            {result.findings.map((item) => (
              <div key={item.bot_id} className="rounded-xl border border-border bg-secondary p-3 space-y-1.5">
                <p className="text-xs font-semibold text-foreground">{item.bot_name}</p>
                <p className="text-[10px] text-primary">Task: {item.task}</p>
                <p className="text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed">{item.finding}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquareShare className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">Peer feedback</p>
            </div>
            {result.feedback.map((item) => (
              <div key={item.reviewer_bot_id} className="rounded-xl border border-border bg-secondary p-3">
                <p className="text-xs font-semibold text-foreground">{item.reviewer_bot_name}</p>
                <p className="mt-1 text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed">{item.feedback}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recent collaboration sessions</p>
        {sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No collaboration sessions yet.</div>
        ) : sessions.map((session) => (
          <div key={session.id} className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs font-semibold text-foreground">{session.title}</p>
            <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2">{session.goal}</p>
          </div>
        ))}
      </div>
    </div>
  );
}