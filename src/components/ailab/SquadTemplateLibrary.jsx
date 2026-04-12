import { CopyPlus, Library, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function SquadTemplateLibrary({ templates, onClone, onRefresh }) {
  const removeTemplate = async (templateId) => {
    await base44.entities.SquadTemplate.delete(templateId);
    onRefresh?.();
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Library className="w-4 h-4 text-primary" />
        <div>
          <p className="text-xs font-semibold text-foreground">Squad template library</p>
          <p className="text-[10px] text-muted-foreground">Reuse successful squad setups in new projects.</p>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No templates saved yet.</div>
      ) : (
        <div className="space-y-2">
          {templates.map((template) => (
            <div key={template.id} className="rounded-xl border border-border bg-background p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{template.name}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{template.description || 'No description'}</p>
                <p className="mt-1 text-[10px] text-primary">From: {template.source_squad_name || 'Custom template'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => onClone(template)} className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-[10px] font-medium text-primary">
                  <CopyPlus className="w-3 h-3" /> Clone
                </button>
                <button onClick={() => removeTemplate(template.id)} className="text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}