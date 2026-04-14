import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Globe, Plus } from 'lucide-react';
import WebsiteGeneratorProjectList from './WebsiteGeneratorProjectList';
import WebsiteGeneratorForm from './WebsiteGeneratorForm';
import WebsiteGeneratorPreview from './WebsiteGeneratorPreview';

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
    if (selectedProjectId && !rows.some((row) => row.id === selectedProjectId)) {
      setSelectedProjectId(rows[0]?.id || null);
    } else if (!selectedProjectId && rows[0]) {
      setSelectedProjectId(rows[0].id);
    }
    setLoading(false);
  };

  const handleNew = () => {
    setSelectedProjectId(null);
    setForm({ ...EMPTY_FORM });
  };

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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
        <WebsiteGeneratorProjectList
          projects={projects}
          loading={loading}
          selectedProjectId={selectedProjectId}
          onSelect={setSelectedProjectId}
          onCreateNew={handleNew}
        />

        <div className="space-y-4">
          <WebsiteGeneratorForm
            form={form}
            modeLabel={selectedProjectId ? 'Edit Website Project' : 'Create New Website'}
            saving={saving}
            generating={generating}
            onChange={handleFieldChange}
            onSaveDraft={handleSaveDraft}
            onGenerate={handleGenerate}
          />
          <WebsiteGeneratorPreview project={selectedProject} />
        </div>
      </div>
    </div>
  );
}