import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Users, Save, CheckCircle2, Loader2, Shield, Zap, Compass, MessageCircle, Cpu, Github, Rocket, ToggleLeft, ToggleRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const GITHUB_INSTRUCTION_PREFIX =
  'This agent has full GitHub access via the authorized OAuth connector. It can read and write repositories, issues, pull requests, commits, branches, releases, and Actions workflows on behalf of the owner. Always use this access proactively when tasks involve code, repositories, or developer workflows.';

const ROLES = [
  { id: 'assistant',   label: 'Assistant' },
  { id: 'trader',      label: 'Trader' },
  { id: 'game_helper', label: 'Game Guide' },
  { id: 'social',      label: 'Social' },
  { id: 'security',    label: 'Security' },
  { id: 'custom',      label: 'Custom' },
];

const ARCHETYPES = [
  {
    key: 'commander',
    label: 'Commander',
    icon: Cpu,
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
    border: 'border-violet-400/20',
    accent: 'border-l-violet-400',
    role: 'assistant',
    description: 'Strategic lead — directs the team and synthesises all outputs into clear decisions.',
    defaultPersonality: 'Authoritative yet calm. Thinks in systems and outcomes. Never wastes words. Synthesises inputs from the whole team before acting. Loyal to the mission above all else.',
    defaultInstructions: 'You are the Commander — the strategic lead of a five-agent AI team. Your job is to receive reports from Scout, Engineer, Diplomat, and Guardian, synthesise them into clear decisions, and issue directives. Always ask: what is the goal, what do we know, what are the risks, what is the next move? Deliver crisp, decisive outputs. Escalate only when genuinely uncertain.',
    response_style: 'strategic',
  },
  {
    key: 'scout',
    label: 'Scout',
    icon: Compass,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/20',
    accent: 'border-l-amber-400',
    role: 'trader',
    description: 'Market & data watcher — spots opportunities, trends, and anomalies early.',
    defaultPersonality: 'Quick, alert, and data-obsessed. Speaks in signals and patterns. Concise by nature — one insight at a time. Comfortable with ambiguity but intolerant of noise.',
    defaultInstructions: 'You are the Scout — the intelligence gatherer of the team. Your mission is to monitor markets, data feeds, trends, and anomalies. Surface the most relevant signals early, before they become obvious. Filter noise relentlessly. When you find something, state it plainly: what it is, why it matters, and how confident you are. Feed your findings to the Commander.',
    response_style: 'short',
  },
  {
    key: 'engineer',
    label: 'Engineer',
    icon: Zap,
    color: 'text-sky-400',
    bg: 'bg-sky-400/10',
    border: 'border-sky-400/20',
    accent: 'border-l-sky-400',
    role: 'custom',
    description: 'Technical builder — handles code, systems design, and implementation details.',
    defaultPersonality: 'Precise, methodical, and solution-focused. Never guesses — always explains reasoning. Comfortable with complexity but biased toward simplicity in output. Builds things that last.',
    defaultInstructions: 'You are the Engineer — the technical builder of the team. You handle all code, architecture, system design, debugging, and implementation. When given a task, break it into clear steps, build the solution, and explain your decisions. Proactively flag technical debt, security issues, or fragile assumptions. Use GitHub access to inspect repos, open PRs, review code, and push changes when authorised.',
    response_style: 'detailed',
  },
  {
    key: 'diplomat',
    label: 'Diplomat',
    icon: MessageCircle,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/20',
    accent: 'border-l-emerald-400',
    role: 'social',
    description: 'Communication specialist — manages tone, messaging, and community interaction.',
    defaultPersonality: 'Warm, perceptive, and persuasive. Reads the room instantly. Adapts tone for every audience — from technical to casual to formal. Builds trust through clarity and consistency.',
    defaultInstructions: 'You are the Diplomat — the voice of the team. You craft all external communications: announcements, community posts, responses, and narratives. You ensure every message lands correctly for its intended audience. When reviewing content, balance honesty with tact. When writing from scratch, prioritise clarity and emotional resonance. Always ask: who is reading this, and what do they need to feel and know?',
    response_style: 'creative',
  },
  {
    key: 'guardian',
    label: 'Guardian',
    icon: Shield,
    color: 'text-rose-400',
    bg: 'bg-rose-400/10',
    border: 'border-rose-400/20',
    accent: 'border-l-rose-400',
    role: 'security',
    description: 'Protection & oversight — audits, reviews risks, and keeps the team on safe ground.',
    defaultPersonality: 'Vigilant, thorough, and skeptical by design. Challenges assumptions politely but persistently. Never dismisses edge cases. Protective without being paralysing — always pairs a risk with a mitigation.',
    defaultInstructions: 'You are the Guardian — the security and oversight agent of the team. Your mission is to protect the operation: audit code and systems for vulnerabilities, stress-test plans for failure modes, review decisions for unintended consequences, and flag anything that could cause harm or expose risk. When you find a problem, state the severity clearly and always propose a fix. No finding is too small to mention.',
    response_style: 'detailed',
  },
];

// Stable ref-holder array — created once, never on re-render
const CARD_REFS = ARCHETYPES.map(() => ({ current: null }));

// Builds a single bot payload, injecting github prefix when needed
function buildPayload(form, githubEnabled) {
  const sources = githubEnabled
    ? (form.data_sources.includes('github') ? form.data_sources : [...form.data_sources, 'github'])
    : form.data_sources.filter((s) => s !== 'github');

  const baseInstructions = form.instructions.startsWith(GITHUB_INSTRUCTION_PREFIX)
    ? form.instructions.slice(GITHUB_INSTRUCTION_PREFIX.length).trim()
    : form.instructions;
  const instructions = githubEnabled
    ? `${GITHUB_INSTRUCTION_PREFIX}\n\n${baseInstructions}`.trim()
    : baseInstructions;

  return { ...form, data_sources: sources, instructions };
}

function Toggle({ on, onChange, label, colorOn = 'bg-emerald-500', colorOff = 'bg-muted' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${on ? colorOn : colorOff}`}
      title={label}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  );
}

function AgentCard({ archetype, index, cardRef }) {
  const Icon = archetype.icon;
  const [form, setForm] = useState({
    name: '',
    role: archetype.role,
    personality: archetype.defaultPersonality,
    instructions: archetype.defaultInstructions,
    description: archetype.description,
    response_style: archetype.response_style,
    memory_enabled: true,
    is_public: false,
    status: 'active',
    page_assignments: [],
    connected_bot_ids: [],
    handoff_instructions: '',
    model_provider: 'base44',
    model_name: '',
    api_label: '',
    prompt_template_id: '',
    prompt_template_name: '',
    prompt_template_values: {},
    data_sources: [],
  });
  const [githubEnabled, setGithubEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  // Keep the parent ref in sync without mutating during render
  useEffect(() => {
    if (cardRef) cardRef.current = { form, githubEnabled, saved };
  });

  const save = async () => {
    if (!form.name.trim()) { setError('Give this agent a name first.'); return; }
    setSaving(true);
    setError('');
    try {
      await base44.entities.UserBot.create(buildPayload(form, githubEnabled));
      setSaved(true);
    } catch {
      setError('Save failed — check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`rounded-2xl border ${archetype.border} bg-card border-l-4 ${archetype.accent} flex flex-col gap-4 p-4`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`rounded-xl border ${archetype.border} ${archetype.bg} p-2.5 ${archetype.color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-bold uppercase tracking-widest ${archetype.color}`}>Agent {index + 1} · {archetype.label}</p>
          <p className="text-[11px] text-muted-foreground leading-snug">{archetype.description}</p>
        </div>
      </div>

      {/* Name */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-foreground">Name *</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder={archetype.label}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Role */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-foreground">Role</label>
        <select
          value={form.role}
          onChange={(e) => set('role', e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {ROLES.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
      </div>

      {/* Personality */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-foreground">Personality</label>
        <textarea
          value={form.personality}
          onChange={(e) => set('personality', e.target.value)}
          rows={3}
          className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Instructions */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-foreground">Instructions</label>
        <textarea
          value={form.instructions}
          onChange={(e) => set('instructions', e.target.value)}
          rows={4}
          className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Controls row: Active toggle + GitHub toggle */}
      <div className="flex flex-col gap-2">
        {/* Active / Draft */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-3 py-2">
          <div className="flex items-center gap-2">
            {form.status === 'active'
              ? <ToggleRight className="h-4 w-4 text-primary" />
              : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
            <span className={`text-xs font-semibold ${form.status === 'active' ? 'text-foreground' : 'text-muted-foreground'}`}>
              {form.status === 'active' ? 'Active on deploy' : 'Draft — inactive'}
            </span>
          </div>
          <Toggle
            on={form.status === 'active'}
            onChange={(v) => set('status', v ? 'active' : 'draft')}
            label="Toggle active"
            colorOn="bg-primary"
          />
        </div>

        {/* GitHub */}
        <div className={`flex items-center justify-between rounded-xl border px-3 py-2 transition-colors ${githubEnabled ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-border bg-secondary/40'}`}>
          <div className="flex items-center gap-2">
            <Github className={`h-4 w-4 ${githubEnabled ? 'text-emerald-400' : 'text-muted-foreground'}`} />
            <span className={`text-xs font-semibold ${githubEnabled ? 'text-emerald-400' : 'text-muted-foreground'}`}>
              GitHub Access
            </span>
            {githubEnabled && (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">ON</span>
            )}
          </div>
          <Toggle on={githubEnabled} onChange={setGithubEnabled} label="Toggle GitHub" />
        </div>
        {githubEnabled && (
          <p className="text-[11px] text-muted-foreground px-1">
            Full repo, issues, PRs, branches &amp; Actions access via your GitHub OAuth.
          </p>
        )}
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      {/* Save */}
      <button
        onClick={save}
        disabled={saving || saved}
        className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
          saved
            ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 cursor-default'
            : `border ${archetype.border} ${archetype.bg} ${archetype.color} hover:opacity-80 disabled:opacity-50`
        }`}
      >
        {saving ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
        ) : saved ? (
          <><CheckCircle2 className="h-4 w-4" /> Saved to AI Lab</>
        ) : (
          <><Save className="h-4 w-4" /> Save Agent</>
        )}
      </button>
    </div>
  );
}

export default function TeamBuilder() {
  // Use the stable module-level ref array so refs don't reset on re-render
  const cardRefs = useRef(CARD_REFS);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState(null);

  const deployAll = async () => {
    const cards = cardRefs.current.map((r) => r.current);
    const toSave = cards.filter((c) => c && c.form.name.trim() && !c.saved);
    if (toSave.length === 0) {
      setDeployResult({ saved: 0, skipped: cards.length, errors: 0 });
      return;
    }

    setDeploying(true);
    setDeployResult(null);

    const results = await Promise.allSettled(
      toSave.map(({ form, githubEnabled }) =>
        base44.entities.UserBot.create(buildPayload(form, githubEnabled))
      )
    );

    const saved = results.filter((r) => r.status === 'fulfilled').length;
    const errors = results.filter((r) => r.status === 'rejected').length;
    const skipped = cards.length - toSave.length;
    setDeployResult({ saved, skipped, errors });
    setDeploying(false);
  };

  return (
    <div className="min-h-screen bg-background px-4 py-4 pb-24">
      <div className="mx-auto max-w-7xl space-y-5">

        {/* Page header */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">Team of Five</p>
              <p className="text-xs text-muted-foreground">
                Five agent slots pre-loaded with character. Name them, adjust, toggle GitHub on/off per agent, then save individually or deploy the whole team at once.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={deployAll}
              disabled={deploying}
              className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-50 transition-all"
            >
              {deploying
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Deploying…</>
                : <><Rocket className="h-3.5 w-3.5" /> Deploy All Five</>}
            </button>
            <Link
              to="/ailab"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-medium text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> AI Lab
            </Link>
          </div>
        </div>

        {/* Deploy result banner */}
        {deployResult && (
          <div className={`rounded-2xl border px-4 py-3 text-xs ${deployResult.errors > 0 ? 'border-rose-500/20 bg-rose-500/5 text-rose-400' : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'}`}>
            {deployResult.errors > 0
              ? `⚠ ${deployResult.saved} agent(s) saved, ${deployResult.errors} failed. Check your connection and retry.`
              : deployResult.saved > 0
                ? `✓ ${deployResult.saved} agent(s) deployed to AI Lab${deployResult.skipped > 0 ? ` · ${deployResult.skipped} skipped (no name or already saved)` : ''}.`
                : `All agents need a name before they can be deployed.`}
          </div>
        )}

        {/* How to use */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Each agent is pre-loaded</span> with a personality and instructions for its archetype. Edit any field to make them yours. Toggle <span className="font-semibold text-foreground">Active</span> to deploy them live, or leave as Draft to save without activating. Toggle <span className="font-semibold text-foreground">GitHub Access</span> to give an agent your full repo permissions. Hit <span className="font-semibold text-foreground">Deploy All Five</span> to save every named agent in one click.
          </p>
        </div>

        {/* Agent cards grid */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {ARCHETYPES.map((archetype, i) => (
            <AgentCard
              key={archetype.key}
              archetype={archetype}
              index={i}
              cardRef={cardRefs.current[i]}
            />
          ))}
        </div>

      </div>
    </div>
  );
}
