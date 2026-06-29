import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Users, Save, CheckCircle2, Loader2, Shield, Zap, Compass, MessageCircle, Cpu, Github } from 'lucide-react';
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
    personality: '',
    instructions: '',
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
    personality: '',
    instructions: '',
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
    personality: '',
    instructions: '',
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
    personality: '',
    instructions: '',
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
    personality: '',
    instructions: '',
    response_style: 'detailed',
  },
];

function AgentCard({ archetype, index }) {
  const Icon = archetype.icon;
  const [form, setForm] = useState({
    name: '',
    role: archetype.role,
    personality: archetype.personality,
    instructions: archetype.instructions,
    description: archetype.description,
    response_style: archetype.response_style,
    memory_enabled: true,
    is_public: false,
    status: 'draft',
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

  const toggleGithub = () => setGithubEnabled((v) => !v);

  const buildPayload = () => {
    const sources = githubEnabled
      ? [...new Set([...form.data_sources, 'github'])]
      : form.data_sources.filter((s) => s !== 'github');

    const baseInstructions = form.instructions.replaceAll(GITHUB_INSTRUCTION_PREFIX, '').trim();
    const instructions = githubEnabled
      ? `${GITHUB_INSTRUCTION_PREFIX}\n\n${baseInstructions}`.trim()
      : baseInstructions;

    return { ...form, data_sources: sources, instructions };
  };

  const save = async () => {
    if (!form.name.trim()) { setError('Give this agent a name first.'); return; }
    setSaving(true);
    setError('');
    try {
      await base44.entities.UserBot.create(buildPayload());
      setSaved(true);
    } catch (e) {
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
        <div>
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
          placeholder={`e.g. "Alpha ${archetype.label}"`}
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
          rows={2}
          placeholder="Describe how this agent thinks, speaks, and carries itself…"
          className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Instructions */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-foreground">Instructions</label>
        <textarea
          value={form.instructions}
          onChange={(e) => set('instructions', e.target.value)}
          rows={3}
          placeholder="What should this agent know and do? Define its mission, rules, and behaviour…"
          className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      {/* GitHub toggle */}
      <button
        type="button"
        onClick={toggleGithub}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-all ${
          githubEnabled
            ? 'border-emerald-500/30 bg-emerald-500/10'
            : 'border-border bg-secondary/50 hover:bg-secondary'
        }`}
      >
        <span className="flex items-center gap-2">
          <Github className={`h-4 w-4 ${githubEnabled ? 'text-emerald-400' : 'text-muted-foreground'}`} />
          <span className={`text-xs font-semibold ${githubEnabled ? 'text-emerald-400' : 'text-muted-foreground'}`}>
            GitHub Access
          </span>
          {githubEnabled && (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
              ON
            </span>
          )}
        </span>
        <span className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${githubEnabled ? 'bg-emerald-500' : 'bg-muted'}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${githubEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
        </span>
      </button>
      {githubEnabled && (
        <p className="text-[11px] text-muted-foreground -mt-2 px-1">
          Agent will have full repo, issues, PRs, branches &amp; Actions access via your connected GitHub OAuth.
        </p>
      )}

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
                Five agent slots, each pre-seeded with an archetype. Name them, define their character, and save — they'll appear in your AI Lab.
              </p>
            </div>
          </div>
          <Link
            to="/ailab"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-medium text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> AI Lab
          </Link>
        </div>

        {/* Instruction banner */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">How to use: </span>
            Fill in each agent's name, personality, and instructions below. Each slot is pre-assigned an archetype role — change any field to suit your vision. Hit <span className="font-semibold text-foreground">Save Agent</span> and the bot will appear in your AI Lab ready to run.
          </p>
        </div>

        {/* Agent cards grid */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {ARCHETYPES.map((archetype, i) => (
            <AgentCard key={archetype.key} archetype={archetype} index={i} />
          ))}
        </div>

      </div>
    </div>
  );
}
