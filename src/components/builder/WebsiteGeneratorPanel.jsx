import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Globe, Plus, Loader2, Sparkles, FileText, Users, Palette, Save, FolderOpen } from 'lucide-react';

const PROJECT_TYPES = [
  { id: 'landing_page', label: 'Landing Page' },
  { id: 'business_site', label: 'Business Site' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'storefront', label: 'Storefront' },
  { id: 'custom', label: 'Custom' },
];

const EMPTY_FORM = {
  name: '',
  description: '',
  project_type: 'landing_page',
  prompt: '',
  target_audience: '',
  style_direction: '',
  notes: '',
};

export default function WebsiteGeneratorPanel() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (!selectedProject) {
      setForm(EMPTY_FORM);
      return;
    }
    setForm({
      name: selectedProject.name || '',
      description: selectedProject.description || '',
      project_type: selectedProject.project_type || 'landing_page',
      prompt: selectedProject.prompt || '',
      target_audience: selectedProject.target_audience || '',
      style_direction: selectedProject.style_direction || '',
      notes: selectedProject.notes || '',
    });
  }, [selectedProject]);

  const loadProjects = async () => {
    setLoading(true);
    const rows = await base44.entities.WebsiteGeneratorProject.list('-updated_date', 100).catch(() => []);
    setProjects(rows);
    if (!selectedProjectId && rows[0]) setSelectedProjectId(rows[0].id);
    setLoading(false);
  };

  const handleNew = () => {
    setSelectedProjectId(null);
    setForm(EMPTY_FORM);
  };

  const handleSaveDraft = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    if (selectedProjectId) {
      await base44.entities.WebsiteGeneratorProject.update(selectedProjectId, {
        ...form,
        status: selectedProject?.status || 'draft',
        site_blueprint: selectedProject?.site_blueprint || undefined,
        generated_copy: selectedProject?.generated_copy || undefined,
      });
    } else {
      const created = await base44.entities.WebsiteGeneratorProject.create({
        ...form,
        status: 'draft',
      });
      setSelectedProjectId(created.id);
    }
    await loadProjects();
    setSaving(false);
  };

  const handleGenerate = async () => {
    if (!form.name.trim()) return;
    setGenerating(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are generating a website project blueprint for an integrated website generator module.\nReturn a concise structured website plan.\nProject name: ${form.name}\nProject type: ${form.project_type}\nDescription: ${form.description}\nTarget audience: ${form.target_audience}\nStyle direction: ${form.style_direction}\nPrompt: ${form.prompt}\nNotes: ${form.notes}`,
      response_json_schema: {
        type: 'object',
        properties: {
          site_blueprint: {
            type: 'object',
            properties: {
              hero_title: { type: 'string' },
              hero_subtitle: { type: 'string' },
              sections: { type: 'array', items: { type: 'string' } },
              features: { type: 'array', items: { type: 'string' } },
              cta: { type: 'string' }
            }
          },
          generated_copy: {
            type: 'object',
            properties: {
              headline: { type: 'string' },
              subheadline: { type: 'string' },
              value_points: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    });

    if (selectedProjectId) {
      await base44.entities.WebsiteGeneratorProject.update(selectedProjectId, {
        ...form,
        status: 'generated',
        site_blueprint: result.site_blueprint,
        generated_copy: result.generated_copy,
      });
    } else {
      const created = await base44.entities.WebsiteGeneratorProject.create({
        ...form,
        status: 'generated',
        site_blueprint: result.site_blueprint,
        generated_copy: result.generated_copy,
      });
      setSelectedProjectId(created.id);
    }

    await loadProjects();
    setGenerating(false);
  };

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2"><Globe className="w-4 h-4 text-primary" /> Website Generator</h3>
            <p className="mt-1 text-xs text-muted-foreground">Create and manage website projects directly inside ERU with saved drafts and generation flow.</p>
          </div>
          <button onClick={handleNew} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
            <Plus className="w-3.5 h-3.5" /> New
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-4 py-3 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold">Saved Projects</p>
          </div>
          <div className="max-h-[28rem] overflow-y-auto p-3 space-y-2">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : projects.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No website projects yet.</p>
            ) : projects.map((project) => (
              <button
                key={project.id}
                onClick={() => setSelectedProjectId(project.id)}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedProjectId === project.id ? 'border-primary bg-primary/10' : 'border-border bg-secondary/40 hover:border-primary/30'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold truncate">{project.name}</p>
                  <span className="rounded-full bg-card px-2 py-1 text-[10px] uppercase text-muted-foreground">{project.status}</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{project.description || 'No description yet.'}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Project Name</label>
                <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none" placeholder="Website project name" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Project Type</label>
                <select value={form.project_type} onChange={(e) => setForm((prev) => ({ ...prev, project_type: e.target.value }))} className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none">
                  {PROJECT_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="w-3 h-3" /> Description</label>
              <textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} className="min-h-[80px] w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none resize-none" placeholder="What is this website for?" />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Target Audience</label>
                <input value={form.target_audience} onChange={(e) => setForm((prev) => ({ ...prev, target_audience: e.target.value }))} className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none" placeholder="Who is this for?" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1"><Palette className="w-3 h-3" /> Style Direction</label>
                <input value={form.style_direction} onChange={(e) => setForm((prev) => ({ ...prev, style_direction: e.target.value }))} className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none" placeholder="Modern, luxury, minimal..." />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Create-New Prompt</label>
              <textarea value={form.prompt} onChange={(e) => setForm((prev) => ({ ...prev, prompt: e.target.value }))} className="min-h-[100px] w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none resize-none" placeholder="Describe the website you want to generate..." />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} className="min-h-[80px] w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none resize-none" placeholder="Optional internal notes" />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button onClick={handleSaveDraft} disabled={!form.name.trim() || saving} className="flex-1 rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-foreground disabled:opacity-40 inline-flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Draft
              </button>
              <button onClick={handleGenerate} disabled={!form.name.trim() || generating} className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40 inline-flex items-center justify-center gap-2">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generate
              </button>
            </div>
          </div>

          {selectedProject?.site_blueprint && (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <p className="text-sm font-semibold">Generated Blueprint</p>
              <div className="rounded-xl bg-secondary p-3">
                <p className="text-xs font-semibold text-foreground">{selectedProject.site_blueprint.hero_title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{selectedProject.site_blueprint.hero_subtitle}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-secondary p-3">
                  <p className="text-[11px] font-semibold text-foreground">Sections</p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {(selectedProject.site_blueprint.sections || []).map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                </div>
                <div className="rounded-xl bg-secondary p-3">
                  <p className="text-[11px] font-semibold text-foreground">Features</p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {(selectedProject.site_blueprint.features || []).map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}