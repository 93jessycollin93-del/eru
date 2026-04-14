export default function WebsiteGeneratorPreview({ project }) {
  if (!project?.site_blueprint) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
        <p className="text-sm font-semibold text-foreground">Preview area</p>
        <p className="mt-1 text-xs text-muted-foreground">Generated drafts will appear here after the first draft is created.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <p className="text-sm font-semibold">First Draft Preview</p>
      <div className="rounded-xl bg-secondary p-4">
        <p className="text-lg font-bold text-foreground">{project.generated_copy?.headline || project.site_blueprint.hero_title}</p>
        <p className="mt-2 text-sm text-muted-foreground">{project.generated_copy?.subheadline || project.site_blueprint.hero_subtitle}</p>
        <button className="mt-4 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
          {project.site_blueprint.cta || 'Get Started'}
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-secondary p-3">
          <p className="text-[11px] font-semibold text-foreground">Sections</p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {(project.site_blueprint.sections || []).map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </div>
        <div className="rounded-xl bg-secondary p-3">
          <p className="text-[11px] font-semibold text-foreground">Value Points</p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {(project.generated_copy?.value_points || project.site_blueprint.features || []).map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}