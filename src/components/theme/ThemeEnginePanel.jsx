import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Paintbrush, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useTheme } from '@/context/ThemeContext';

const EMPTY_FORM = {
  name: '',
  scope_type: 'global',
  scope_key: '',
  theme_mode: 'inherit',
  background_type: 'inherit',
  background_value: '',
  appBg: '',
  pageBg: '',
  surfaceBg: '',
  buttonBg: '',
  buttonFg: '',
  borderColor: '',
};

function toPayload(form, pathname) {
  const scopeKey = form.scope_type === 'page' ? pathname : form.scope_key;
  return {
    name: form.name || (form.scope_type === 'page' ? `Theme ${pathname}` : 'Global Theme'),
    scope_type: form.scope_type,
    scope_key: scopeKey || '',
    theme_mode: form.theme_mode,
    background_type: form.background_type,
    background_value: form.background_value,
    variables: {
      ...(form.appBg ? { '--app-bg': form.appBg } : {}),
      ...(form.pageBg ? { '--page-bg': form.pageBg } : {}),
      ...(form.surfaceBg ? { '--surface-bg': form.surfaceBg } : {}),
      ...(form.buttonBg ? { '--button-bg': form.buttonBg } : {}),
      ...(form.buttonFg ? { '--button-foreground': form.buttonFg } : {}),
      ...(form.borderColor ? { '--page-border': form.borderColor, '--button-border': form.borderColor } : {}),
    },
    is_active: true,
  };
}

export default function ThemeEnginePanel() {
  const location = useLocation();
  const { reloadCustomThemes, customThemes } = useTheme();
  const [form, setForm] = useState({ ...EMPTY_FORM, scope_key: location.pathname });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm((prev) => ({ ...prev, scope_key: location.pathname }));
  }, [location.pathname]);

  const matchingThemes = useMemo(() => {
    return (customThemes || []).filter((item) => item.scope_type === form.scope_type);
  }, [customThemes, form.scope_type]);

  const saveTheme = async () => {
    setSaving(true);
    const payload = toPayload(form, location.pathname);
    const existing = (customThemes || []).find((item) => item.scope_type === payload.scope_type && (item.scope_key || '') === (payload.scope_key || ''));
    if (existing) {
      await base44.entities.CustomThemeSetting.update(existing.id, payload);
    } else {
      await base44.entities.CustomThemeSetting.create(payload);
    }
    await reloadCustomThemes();
    setSaving(false);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Paintbrush className="w-4 h-4 text-primary" />
        <div>
          <p className="text-sm font-semibold">Visual Theme Engine</p>
          <p className="text-xs text-muted-foreground">Set global or page-specific background and layer colors.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Scope</span>
          <select value={form.scope_type} onChange={(e) => setForm((prev) => ({ ...prev, scope_type: e.target.value }))} className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm outline-none">
            <option value="global">Global app</option>
            <option value="page">Current page</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Theme name</span>
          <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="My theme" className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm outline-none" />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Background type</span>
          <select value={form.background_type} onChange={(e) => setForm((prev) => ({ ...prev, background_type: e.target.value }))} className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm outline-none">
            <option value="inherit">Inherit</option>
            <option value="solid">Solid</option>
            <option value="gradient">Gradient</option>
            <option value="image">Image URL</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Background value</span>
          <input value={form.background_value} onChange={(e) => setForm((prev) => ({ ...prev, background_value: e.target.value }))} placeholder="e.g. linear-gradient(...) or #0b1020" className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm outline-none" />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1"><span className="text-xs text-muted-foreground">App background</span><input type="color" value={form.appBg || '#0b0f1a'} onChange={(e) => setForm((prev) => ({ ...prev, appBg: e.target.value }))} className="h-11 w-full rounded-xl border border-border bg-secondary p-2" /></label>
        <label className="space-y-1"><span className="text-xs text-muted-foreground">Page layer</span><input type="color" value={form.pageBg || '#111827'} onChange={(e) => setForm((prev) => ({ ...prev, pageBg: e.target.value }))} className="h-11 w-full rounded-xl border border-border bg-secondary p-2" /></label>
        <label className="space-y-1"><span className="text-xs text-muted-foreground">Card surface</span><input type="color" value={form.surfaceBg || '#151b2c'} onChange={(e) => setForm((prev) => ({ ...prev, surfaceBg: e.target.value }))} className="h-11 w-full rounded-xl border border-border bg-secondary p-2" /></label>
        <label className="space-y-1"><span className="text-xs text-muted-foreground">Button fill</span><input type="color" value={form.buttonBg || '#29e3a1'} onChange={(e) => setForm((prev) => ({ ...prev, buttonBg: e.target.value }))} className="h-11 w-full rounded-xl border border-border bg-secondary p-2" /></label>
        <label className="space-y-1"><span className="text-xs text-muted-foreground">Button text</span><input type="color" value={form.buttonFg || '#07110d'} onChange={(e) => setForm((prev) => ({ ...prev, buttonFg: e.target.value }))} className="h-11 w-full rounded-xl border border-border bg-secondary p-2" /></label>
        <label className="space-y-1"><span className="text-xs text-muted-foreground">Borders</span><input type="color" value={form.borderColor || '#243042'} onChange={(e) => setForm((prev) => ({ ...prev, borderColor: e.target.value }))} className="h-11 w-full rounded-xl border border-border bg-secondary p-2" /></label>
      </div>

      <button onClick={saveTheme} disabled={saving} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        <Save className="w-4 h-4" /> {saving ? 'Saving theme...' : 'Save theme'}
      </button>

      {matchingThemes.length > 0 && (
        <div className="rounded-xl border border-border bg-secondary/30 p-3">
          <p className="text-xs font-medium mb-2">Saved themes in this scope</p>
          <div className="space-y-1">
            {matchingThemes.slice(0, 6).map((item) => (
              <div key={item.id} className="text-xs text-muted-foreground flex items-center justify-between gap-2">
                <span className="truncate">{item.name}</span>
                <span className="text-[10px] uppercase">{item.scope_key || 'app'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}