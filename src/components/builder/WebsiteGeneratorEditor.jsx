import { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import WebsiteGeneratorLivePreview from './WebsiteGeneratorLivePreview';
import WebsiteGeneratorSectionActions from './WebsiteGeneratorSectionActions';

function updatePage(pages, pageIndex, updater) {
  return pages.map((page, index) => index === pageIndex ? updater(page) : page);
}

function updateSection(sections, sectionIndex, updater) {
  return sections.map((section, index) => index === sectionIndex ? updater(section) : section);
}

export default function WebsiteGeneratorEditor({ project, onSaved }) {
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [activePageType, setActivePageType] = useState('home');
  const [previewMode, setPreviewMode] = useState('desktop');
  const [selectedSectionType, setSelectedSectionType] = useState(null);

  useEffect(() => {
    if (!project?.site_blueprint) {
      setDraft(null);
      return;
    }
    setDraft({
      site_blueprint: project.site_blueprint,
      generated_copy: project.generated_copy || {},
    });
    setActivePageType(project.site_blueprint.pages?.[0]?.page_type || 'home');
    setSelectedSectionType(project.site_blueprint.pages?.[0]?.sections?.[0] || null);
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

  const activePage = draft?.site_blueprint?.pages?.find((page) => page.page_type === activePageType) || draft?.site_blueprint?.pages?.[0];
  const activeSectionIndex = (draft?.site_blueprint?.reusable_sections || []).findIndex((section) => section.section_type === selectedSectionType);
  const activeSection = activeSectionIndex >= 0 ? draft?.site_blueprint?.reusable_sections?.[activeSectionIndex] : null;

  const moveSection = (direction) => {
    if (!activePage || !selectedSectionType) return;
    const currentIndex = (activePage.sections || []).findIndex((section) => section === selectedSectionType);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= activePage.sections.length) return;

    const nextSections = [...activePage.sections];
    [nextSections[currentIndex], nextSections[targetIndex]] = [nextSections[targetIndex], nextSections[currentIndex]];

    setDraft((prev) => ({
      ...prev,
      site_blueprint: {
        ...prev.site_blueprint,
        pages: prev.site_blueprint.pages.map((page) => page.page_type === activePage.page_type ? { ...page, sections: nextSections } : page),
      },
    }));
  };

  const duplicateSection = () => {
    if (!activePage || !activeSection) return;
    const duplicatedType = `${activeSection.section_type}_${Date.now()}`;
    const duplicatedSection = { ...activeSection, section_type: duplicatedType };
    const insertIndex = (activePage.sections || []).findIndex((section) => section === selectedSectionType) + 1;
    const nextPageSections = [...(activePage.sections || [])];
    nextPageSections.splice(insertIndex, 0, duplicatedType);

    setDraft((prev) => ({
      ...prev,
      site_blueprint: {
        ...prev.site_blueprint,
        pages: prev.site_blueprint.pages.map((page) => page.page_type === activePage.page_type ? { ...page, sections: nextPageSections } : page),
        reusable_sections: [...(prev.site_blueprint.reusable_sections || []), duplicatedSection],
      },
    }));
    setSelectedSectionType(duplicatedType);
  };

  const deleteSection = () => {
    if (!activePage || !activeSection) return;
    const nextPageSections = (activePage.sections || []).filter((section) => section !== selectedSectionType);

    setDraft((prev) => ({
      ...prev,
      site_blueprint: {
        ...prev.site_blueprint,
        pages: prev.site_blueprint.pages.map((page) => page.page_type === activePage.page_type ? { ...page, sections: nextPageSections } : page),
        reusable_sections: (prev.site_blueprint.reusable_sections || []).filter((section) => section.section_type !== selectedSectionType),
      },
    }));
    setSelectedSectionType(nextPageSections[0] || null);
  };

  const regenerateSection = async () => {
    if (!project?.id || !activeSection || !activePage) return;
    setRegenerating(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Regenerate one reusable website section for an ERU website generator project.
Project name: ${project.name}
Project description: ${project.description}
Site type: ${draft.site_blueprint.site_type}
Tone: ${draft.site_blueprint.tone}
CTA direction: ${draft.site_blueprint.cta_direction}
Page: ${activePage.page_name}
Section type: ${activeSection.section_type}
Current title: ${activeSection.title}
Current subtitle: ${activeSection.subtitle}
Current items: ${(activeSection.items || []).join(', ')}`,
      response_json_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          subtitle: { type: 'string' },
          cta_label: { type: 'string' },
          items: { type: 'array', items: { type: 'string' } }
        }
      }
    });

    setDraft((prev) => ({
      ...prev,
      site_blueprint: {
        ...prev.site_blueprint,
        reusable_sections: updateSection(prev.site_blueprint.reusable_sections || [], activeSectionIndex, (section) => ({ ...section, ...result })),
      },
    }));
    setRegenerating(false);
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

      <WebsiteGeneratorLivePreview
        pages={draft.site_blueprint.pages || []}
        sections={draft.site_blueprint.reusable_sections || []}
        activePageType={activePageType}
        previewMode={previewMode}
        selectedSectionType={selectedSectionType}
        onPageChange={setActivePageType}
        onModeChange={setPreviewMode}
        onSelectSection={setSelectedSectionType}
      />

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-3">
          <p className="text-xs font-semibold text-foreground">Pages</p>
          {(draft.site_blueprint.pages || []).map((page, pageIndex) => (
            <button key={`${page.page_type}-${pageIndex}`} onClick={() => setActivePageType(page.page_type)} className={`w-full rounded-xl p-3 text-left transition-colors ${activePageType === page.page_type ? 'border border-primary bg-primary/10' : 'border border-border bg-secondary'}`}>
              <p className="text-sm font-semibold text-foreground">{page.page_name}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">/{page.slug}</p>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {activePage && (
            <div className="rounded-xl bg-secondary p-3 space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{activePage.page_name}</p>
                <p className="text-[11px] text-muted-foreground">/{activePage.slug}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Page goal</label>
                <textarea value={activePage.page_goal || ''} onChange={(e) => handlePageGoalChange((draft.site_blueprint.pages || []).findIndex((page) => page.page_type === activePage.page_type), e.target.value)} className="min-h-[72px] w-full rounded-xl border border-border bg-card px-3 py-2 text-xs outline-none resize-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Sections (comma separated)</label>
                <input value={(activePage.sections || []).join(', ')} onChange={(e) => handlePageSectionsChange((draft.site_blueprint.pages || []).findIndex((page) => page.page_type === activePage.page_type), e.target.value)} className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs outline-none" />
              </div>
            </div>
          )}

          {activeSection && (
            <div className="rounded-xl bg-secondary p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground capitalize">{activeSection.section_type}</p>
                <WebsiteGeneratorSectionActions
                  onMoveUp={() => moveSection('up')}
                  onMoveDown={() => moveSection('down')}
                  onDuplicate={duplicateSection}
                  onDelete={deleteSection}
                  onRegenerate={regenerateSection}
                  disableUp={(activePage?.sections || []).findIndex((section) => section === selectedSectionType) <= 0}
                  disableDown={(activePage?.sections || []).findIndex((section) => section === selectedSectionType) >= (activePage?.sections || []).length - 1}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Title</label>
                  <input value={activeSection.title || ''} onChange={(e) => handleSectionFieldChange(activeSectionIndex, 'title', e.target.value)} className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">CTA Label</label>
                  <input value={activeSection.cta_label || ''} onChange={(e) => handleSectionFieldChange(activeSectionIndex, 'cta_label', e.target.value)} className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs outline-none" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Subtitle</label>
                <textarea value={activeSection.subtitle || ''} onChange={(e) => handleSectionFieldChange(activeSectionIndex, 'subtitle', e.target.value)} className="min-h-[72px] w-full rounded-xl border border-border bg-card px-3 py-2 text-xs outline-none resize-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Items (one per line)</label>
                <textarea value={(activeSection.items || []).join('\n')} onChange={(e) => handleSectionItemsChange(activeSectionIndex, e.target.value)} className="min-h-[96px] w-full rounded-xl border border-border bg-card px-3 py-2 text-xs outline-none resize-none" />
              </div>
              {regenerating && <p className="text-[11px] text-primary">Regenerating section...</p>}
            </div>
          )}
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