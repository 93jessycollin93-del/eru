import { Monitor, Smartphone } from 'lucide-react';

const SECTION_STYLE = {
  hero: 'bg-gradient-to-br from-primary/10 to-secondary border-primary/20',
  features: 'bg-secondary/70 border-border',
  about: 'bg-secondary/70 border-border',
  testimonials: 'bg-secondary/70 border-border',
  pricing: 'bg-secondary/70 border-border',
  faq: 'bg-secondary/70 border-border',
  cta: 'bg-primary/10 border-primary/20',
  contact: 'bg-secondary/70 border-border',
  footer: 'bg-card border-border',
};

function SectionBlock({ section, onSelect, selected, previewMode }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-2xl border text-left transition-colors ${previewMode === 'mobile' ? 'p-3' : 'p-4'} ${selected ? 'border-primary ring-1 ring-primary/40 bg-primary/5' : SECTION_STYLE[section.section_type] || 'border-border bg-secondary/70'}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold capitalize text-foreground">{section.section_type}</p>
        <span className="rounded-full bg-card px-2 py-1 text-[10px] uppercase text-muted-foreground">section</span>
      </div>
      {section.title && <p className="mt-3 text-lg font-bold text-foreground">{section.title}</p>}
      {section.subtitle && <p className="mt-2 text-sm text-muted-foreground">{section.subtitle}</p>}
      {Array.isArray(section.items) && section.items.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {section.items.slice(0, 4).map((item, index) => (
            <div key={`${item}-${index}`} className="rounded-xl bg-card px-3 py-2 text-xs text-muted-foreground">{item}</div>
          ))}
        </div>
      )}
      {section.cta_label && (
        <div className="mt-4">
          <span className="inline-flex rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">{section.cta_label}</span>
        </div>
      )}
    </button>
  );
}

export default function WebsiteGeneratorLivePreview({ pages, sections, activePageType, previewMode, selectedSectionType, onPageChange, onModeChange, onSelectSection }) {
  const activePage = pages.find((page) => page.page_type === activePageType) || pages[0];
  const visibleSections = (activePage?.sections || []).map((sectionType) => sections.find((section) => section.section_type === sectionType)).filter(Boolean);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {pages.map((page) => (
            <button
              key={page.page_type}
              onClick={() => onPageChange(page.page_type)}
              className={`rounded-xl px-3 py-2 text-xs font-semibold ${activePage?.page_type === page.page_type ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}
            >
              {page.page_name}
            </button>
          ))}
        </div>
        <div className="flex gap-2 self-start lg:self-auto">
          <button onClick={() => onModeChange('desktop')} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${previewMode === 'desktop' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
            <Monitor className="w-3.5 h-3.5" /> Desktop
          </button>
          <button onClick={() => onModeChange('mobile')} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${previewMode === 'mobile' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
            <Smartphone className="w-3.5 h-3.5" /> Mobile
          </button>
        </div>
      </div>

      <div className="rounded-[28px] border border-border bg-background p-3">
        <div className={`mx-auto rounded-[24px] border border-border bg-card p-4 transition-all ${previewMode === 'mobile' ? 'max-w-sm' : 'max-w-5xl'}`}>
          <div className="space-y-4">
            {visibleSections.map((section, index) => (
              <SectionBlock
                key={`${section.section_type}-${index}`}
                section={section}
                selected={selectedSectionType === section.section_type}
                onSelect={() => onSelectSection(section.section_type)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}