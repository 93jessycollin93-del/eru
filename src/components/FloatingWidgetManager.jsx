import { useEffect, useMemo, useState } from 'react';
import { Bot, Cpu, MessageSquare, SlidersHorizontal, Eye, EyeOff } from 'lucide-react';

const STORAGE_KEY = 'floating_widget_preferences';

const DEFAULT_WIDGETS = {
  jackie: { visible: true, x: 16, y: 100 },
  botMarket: { visible: true, x: 16, y: 156 },
  botChat: { visible: true, x: null, y: null },
};

const WIDGET_META = [
  { id: 'jackie', label: 'Jackie', icon: Bot },
  { id: 'botMarket', label: 'Bot Market', icon: Cpu },
  { id: 'botChat', label: 'Bot Chat', icon: MessageSquare },
];

export function useFloatingWidgetPrefs() {
  const [prefs, setPrefs] = useState(() => {
    try {
      return { ...DEFAULT_WIDGETS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
    } catch {
      return DEFAULT_WIDGETS;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const updateWidget = (id, next) => {
    setPrefs((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...next },
    }));
  };

  return { prefs, updateWidget };
}

export default function FloatingWidgetManager({ prefs, onToggle }) {
  const [open, setOpen] = useState(false);
  const visibleCount = useMemo(() => Object.values(prefs || {}).filter((item) => item?.visible).length, [prefs]);

  return (
    <div className="fixed right-4 top-24 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="w-44 rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-2xl p-2">
          <div className="px-2 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Floating widgets</div>
          <div className="space-y-1">
            {WIDGET_META.map(({ id, label, icon: Icon }) => {
              const isVisible = prefs?.[id]?.visible;
              return (
                <button
                  key={id}
                  onClick={() => onToggle(id)}
                  className="w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-xs hover:bg-secondary transition-colors"
                >
                  <span className="flex items-center gap-2 text-foreground">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                    {label}
                  </span>
                  {isVisible ? <Eye className="w-3.5 h-3.5 text-primary" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="h-11 w-11 rounded-full border border-border bg-card/95 backdrop-blur-md shadow-lg flex items-center justify-center hover:border-primary/40 transition-colors"
        title="Edit floating widgets"
      >
        <SlidersHorizontal className="w-4.5 h-4.5 text-primary" />
      </button>
      <div className="rounded-full bg-card/90 border border-border px-2 py-1 text-[10px] text-muted-foreground shadow-sm">
        {visibleCount} active
      </div>
    </div>
  );
}