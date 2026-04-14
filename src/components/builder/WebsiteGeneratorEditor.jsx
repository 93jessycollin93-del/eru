import { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';

function updatePage(pages, pageIndex, updater) {
  return pages.map((page, index) => index === pageIndex ? updater(page) : page);
}

function updateSection(sections, sectionIndex, updater) {
  return sections.map((section, index) => index === sectionIndex ? updater(section) : section);
}

export default function WebsiteGeneratorEditor({ project, onSaved }) {
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!project?.site_blueprint) {
      setDraft(null);
      return;
    }
    setDraft({
      site_blueprint: project.site_blueprint,
      generated_copy: project.generated_copy || {},
    });
  }, [project]);

  const hasData = useMemo(() => Boolean(draft?.site_blueprint), [draft]);

  const handlePageGoalChange = (pageIndex, value) => {
    setDraft((prev) => ({
      ...prev,
      site_blueprint: {
        ...prev.site_blueprint,
        pages: updatePage(prev.site_blueprint.pages || [], pageIndex, (page) => ({ ...page, page_goal: value })),
      },
    }));
  };

  const handlePageSectionsChange = (pageIndex, value) => {
    const sections = value.split(',').map((item) => item.trim()).filter(Boolean);
    setDraft((prev) => ({
      ...prev,
      site_blueprint: {
        ...prev.site_blueprint,
        pages: updatePage(prev.site_blueprint.pages || [], pageIndex, (page) => ({ ...page, sections })),
      },
    }));
  };

  const handleSectionFieldChange = (sectionIndex, field, value) => {
    setDraft((prev) => ({
      ...prev,
      site_blueprint: {
        ...prev.site_blueprint,
        reusable_sections: updateSection(prev.site_blueprint.reusable_sections || [], sectionIndex, (section) => ({ ...section, [field]: value })),
      },
    }));
  };

  const handleSectionItemsChange = (sectionIndex, value) => {
    const items = value.split('\n').map((item) => item.trim()).filter(Boolean);
    setDraft((prev) => ({
      ...prev,
      site_blueprint: {
        ...prev.site_blueprint,
        reusable_sections: updateSection(prev.site_blueprint.reusable_sections || [], sectionIndex, (section) => ({ ...section, items })),
      },
    }));
  };

  const handleCopyFieldChange = (field, value) => {
    setDraft((prev) => ({
      ...prev,
      generated_copy: {
        ...prev.generated_copy,
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    if (!project?.id || !draft) return;
    setSaving(true);
    await base44.entities.WebsiteGeneratorProject.update(project.id, {
      site_blueprint: draft.site_blueprint,
      generated_copy: draft.generated_copy,
    });
    setSaving(false);
    onSaved?.();
  };

  if (!hasData) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Website Generator Engine</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Edit pages and reusable sections directly from the generated blueprint.</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40">
          <Save className="w-3.5 h-3.5" /> Save Structure
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          <p className="text-xs font-semibold text-foreground">Pages</p>
          {(draft.site_blueprint.pages || []).map((page, pageIndex) => (
            <div key={`${page.page_type}-${pageIndex}`} className="rounded-xl bg-secondary p-3 space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{page.page_name}</p>
                <p className="text-[11px] text-muted-foreground">/{page.slug}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Page goal</label>
                <textarea value={page.page_goal || ''} onChange={(e) => handlePageGoalChange(pageIndex, e.target.value)} className="min-h-[72px] w-full rounded-xl border border-border bg-card px-3 py-2 text-xs outline-none resize-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Sections (comma separated)</label>
                <input value={(page.sections || []).join(', ')} onChange={(e) => handlePageSectionsChange(pageIndex, e.target.value)} className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs outline-none" />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold text-foreground">Reusable Sections</p>
          {(draft.site_blueprint.reusable_sections || []).map((section, sectionIndex) => (
            <div key={`${section.section_type}-${sectionIndex}`} className="rounded-xl bg-secondary p-3 space-y-3">
              <p className="text-sm font-semibold text-foreground capitalize">{section.section_type}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Title</label>
                  <input value={section.title || ''} onChange={(e) => handleSectionFieldChange(sectionIndex, 'title', e.target.value)} className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">CTA Label</label>
                  <input value={section.cta_label || ''} onChange={(e) => handleSectionFieldChange(sectionIndex, 'cta_label', e.target.value)} className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs outline-none" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Subtitle</label>
                <textarea value={section.subtitle || ''} onChange={(e) => handleSectionFieldChange(sectionIndex, 'subtitle', e.target.value)} className="min-h-[72px] w-full rounded-xl border border-border bg-card px-3 py-2 text-xs outline-none resize-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Items (one per line)</label>
                <textarea value={(section.items || []).join('\n')} onChange={(e) => handleSectionItemsChange(sectionIndex, e.target.value)} className="min-h-[96px] w-full rounded-xl border border-border bg-card px-3 py-2 text-xs outline-none resize-none" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-secondary p-3 space-y-3">
        <p className="text-xs font-semibold text-foreground">Core Copy</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-[11px] text-muted-foreground">Headline</label>
            <input value={draft.generated_copy.headline || ''} onChange={(e) => handleCopyFieldChange('headline', e.target.value)} className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs outline-none" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-[11px] text-muted-foreground">Subheadline</label>
            <textarea value={draft.generated_copy.subheadline || ''} onChange={(e) => handleCopyFieldChange('subheadline', e.target.value)} className="min-h-[72px] w-full rounded-xl border border-border bg-card px-3 py-2 text-xs outline-none resize-none" />
          </div>
        </div>
      </div>
    </div>
  );
}