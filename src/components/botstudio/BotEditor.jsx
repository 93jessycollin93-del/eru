import { useState, useRef } from 'react';
import { X, Loader2, Upload, Bot as BotIcon, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import * as store from '@/lib/botStudioStore';

const DEFAULTS = {
  name: '',
  role: 'assistant',
  system_prompt: '',
  model: 'llama3.2',
  temperature: 0.7,
  top_p: 0.9,
  max_tokens: 2048,
  memory_pod_ids: [],
  is_agent: false,
  tools_enabled: false,
};

/** BotEditor — create/edit a bot. Avatar uploaded via Base44 file storage. */
export default function BotEditor({ bot, pods = [], models = [], onSave, onClose }) {
  const [form, setForm] = useState({ ...DEFAULTS, ...(bot || {}) });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setField('avatar_image_url', file_url);
    } catch {
      setError('Avatar upload failed. Check your connection and try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const data = {
        name: form.name.trim(),
        avatar_image_url: form.avatar_image_url || '',
        role: form.role || 'assistant',
        system_prompt: form.system_prompt || '',
        model: form.model || 'llama3.2',
        temperature: Number(form.temperature) || 0.7,
        top_p: Number(form.top_p) || 0.9,
        max_tokens: Number(form.max_tokens) || 2048,
        memory_pod_ids: form.memory_pod_ids || [],
        is_agent: !!form.is_agent,
        tools_enabled: !!form.tools_enabled,
      };
      if (bot && bot.id && !String(bot.id).startsWith('temp_')) {
        await store.updateRow('bots', bot.id, data);
      } else {
        await store.createRow('bots', data);
      }
      await onSave();
    } catch (e) {
      setError('Could not save bot. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function togglePod(id) {
    setForm((f) => {
      const has = (f.memory_pod_ids || []).includes(id);
      return { ...f, memory_pod_ids: has ? f.memory_pod_ids.filter((x) => x !== id) : [...(f.memory_pod_ids || []), id] };
    });
  }

  return (
    <div className="eru-theme-card fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-3xl border border-border bg-card p-4 shadow-2xl sm:rounded-3xl"
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-foreground">{bot ? 'Edit bot' : 'New bot'}</p>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Avatar */}
        <div className="mb-3 flex items-center gap-3">
          <div className="relative">
            {form.avatar_image_url ? (
              <img src={form.avatar_image_url} alt="" className="h-16 w-16 rounded-2xl object-cover border border-border" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-secondary/60 text-muted-foreground">
                <BotIcon className="h-6 w-6" />
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-primary text-primary-foreground"
              aria-label="Upload avatar"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
          </div>
          <p className="text-[11px] text-muted-foreground">Upload a picture — it's stored permanently in your file storage.</p>
        </div>

        <Field label="Name">
          <input value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="My offline bot" className={inputCls} />
        </Field>

        <Field label="Role">
          <input value={form.role} onChange={(e) => setField('role', e.target.value)} placeholder="assistant" className={inputCls} />
        </Field>

        <Field label="Model">
          {models.length > 0 ? (
            <select value={form.model} onChange={(e) => setField('model', e.target.value)} className={inputCls}>
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          ) : (
            <input value={form.model} onChange={(e) => setField('model', e.target.value)} placeholder="llama3.2" className={inputCls} />
          )}
        </Field>

        <Field label="System prompt">
          <textarea value={form.system_prompt} onChange={(e) => setField('system_prompt', e.target.value)} rows={3} placeholder="You are a helpful assistant…" className={`${inputCls} resize-none`} />
        </Field>

        <div className="grid grid-cols-3 gap-2">
          <Field label="Temp">
            <input type="number" step="0.1" min="0" max="2" value={form.temperature} onChange={(e) => setField('temperature', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Top P">
            <input type="number" step="0.05" min="0" max="1" value={form.top_p} onChange={(e) => setField('top_p', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Max tokens">
            <input type="number" step="64" min="64" value={form.max_tokens} onChange={(e) => setField('max_tokens', e.target.value)} className={inputCls} />
          </Field>
        </div>

        {/* Memory pods */}
        {pods.length > 0 && (
          <Field label="Memory pods">
            <div className="flex flex-wrap gap-1.5">
              {pods.map((p) => {
                const on = (form.memory_pod_ids || []).includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePod(p.id)}
                    className={`inline-flex h-8 items-center rounded-full border px-3 text-[12px] ${on ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-secondary/40 text-muted-foreground'}`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        <div className="mt-3 flex gap-4">
          <label className="flex items-center gap-2 text-[12px] text-foreground">
            <input type="checkbox" checked={!!form.is_agent} onChange={(e) => setField('is_agent', e.target.checked)} className="accent-primary" /> Agent
          </label>
          <label className="flex items-center gap-2 text-[12px] text-foreground">
            <input type="checkbox" checked={!!form.tools_enabled} onChange={(e) => setField('tools_enabled', e.target.checked)} className="accent-primary" /> Tools enabled
          </label>
        </div>

        {error && <p className="mt-3 text-[12px] text-destructive">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {bot ? 'Save changes' : 'Create bot'}
        </button>
      </div>
    </div>
  );
}

const inputCls =
  'h-11 w-full rounded-xl border border-border bg-secondary/60 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none';

function Field({ label, children }) {
  return (
    <div className="mb-3">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}