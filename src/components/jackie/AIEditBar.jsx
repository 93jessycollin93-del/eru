import { Wand2, RefreshCw, Braces, Eye, Palette, LayoutTemplate, Bot, PlusSquare } from 'lucide-react';

const ACTIONS = [
  { key: 'explain', label: 'Explain', icon: Bot },
  { key: 'refactor', label: 'Refactor', icon: Braces },
  { key: 'regenerate', label: 'Regenerate', icon: RefreshCw },
  { key: 'insert', label: 'Insert', icon: PlusSquare },
  { key: 'preview', label: 'Preview', icon: Eye },
  { key: 'styles', label: 'Modify styles', icon: Palette },
  { key: 'layout', label: 'Change layout', icon: LayoutTemplate },
  { key: 'logic', label: 'Add logic', icon: Wand2 },
];

export default function AIEditBar({ instruction, onInstructionChange, onAction, busy = false }) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((action) => {
          const ActionIcon = action.icon;
          return (
            <button
              key={action.key}
              onClick={() => onAction(action.key)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium text-foreground disabled:opacity-50"
            >
              <ActionIcon className="w-3.5 h-3.5 text-primary" /> {action.label}
            </button>
          );
        })}
      </div>
      <input
        value={instruction}
        onChange={(e) => onInstructionChange(e.target.value)}
        placeholder="e.g. Make the button blue and add a hover animation"
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground outline-none"
      />
    </div>
  );
}