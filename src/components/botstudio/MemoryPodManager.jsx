import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Loader2, Brain, Wand2, Save } from 'lucide-react';
import * as store from '@/lib/botStudioStore';
import { summarizeNotes, estimateTokens, getOllamaUrl, testConnection, friendlyOllamaError } from '@/lib/ollama';
import { useOnline } from '@/lib/connectivity';
import { toast } from 'sonner';

const EMPTY = { name: '', description: '', tags: [], raw_notes: '', summary: '' };

/** MemoryPodManager — create/edit/delete pods + Compress summary via Ollama. */
export default function MemoryPodManager() {
  const [pods, setPods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // pod or {} for new

  const refresh = useCallback(async () => {
    const rows = await store.listAll('pods');
    setPods((rows || []).sort((a, b) => (b.updated_date || '').localeCompare(a.updated_date || '')));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleDelete(pod) {
    if (!confirm(`Delete pod "${pod.name}"?`)) return;
    await store.deleteRow('pods', pod.id);
    await refresh();
  }

  async function handleSaved() {
    await refresh();
    setEditing(null);
  }

  if (editing) {
    return <PodEditor pod={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">{pods.length} pod{pods.length === 1 ? '' : 's'}</p>
        <button onClick={() => setEditing({ ...EMPTY })} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> New pod
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : pods.length === 0 ? (
        <div className="eru-theme-card rounded-2xl border border-dashed border-border p-8 text-center">
          <Brain className="mx-auto h-8 w-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium text-foreground">No memory pods</p>
          <p className="mt-1 text-[12px] text-muted-foreground">Compress big context into a reusable seed your bots can draw on.</p>
          <button onClick={() => setEditing({ ...EMPTY })} className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">
            <Plus className="h-4 w-4" /> Create pod
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {pods.map((pod) => (
            <div key={pod.id} className="eru-theme-card rounded-2xl border border-border p-3">
              <div className="flex items-start gap-2">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-300">
                  <Brain className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{pod.name}</p>
                  {pod.description && <p className="truncate text-[11px] text-muted-foreground">{pod.description}</p>}
                  {pod.summary && <p className="mt-1 line-clamp-2 text-[12px] text-foreground/80">{pod.summary}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {(pod.tags || []).map((t) => (
                      <span key={t} className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] text-muted-foreground">{t}</span>
                    ))}
                    <span className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] text-muted-foreground">~{pod.token_estimate || estimateTokens(pod.summary)} tok</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => setEditing(pod)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleDelete(pod)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PodEditor({ pod, onClose, onSaved }) {
  const online = useOnline();
  const [form, setForm] = useState({ ...EMPTY, ...pod, tags: pod.tags || [] });
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState('');

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  function addTag() {
    const t = tagInput.trim();
    if (!t) return;
    if (!form.tags.includes(t)) set('tags', [...form.tags, t]);
    setTagInput('');
  }

  async function compress() {
    if (!form.raw_notes.trim()) {
      setError('Add raw notes first to compress.');
      return;
    }
    setError('');
    setCompressing(true);
    try {
      if (!online) throw new Error('Offline');
      const res = await testConnection();
      if (!res.ok) throw new Error(res.error);
      const model = res.models[0] || 'llama3.2';
      const summary = await summarizeNotes({ baseUrl: getOllamaUrl(), model, notes: form.raw_notes });
      set('summary', summary.trim());
      set('token_estimate', estimateTokens(summary));
      toast.success('Compressed with ' + model);
    } catch (e) {
      // Graceful fallback: client-side truncation summary.
      const fallback = form.raw_notes.slice(0, 500).trim();
      set('summary', fallback);
      set('token_estimate', estimateTokens(fallback));
      toast.error(`Ollama unavailable — used truncation fallback. (${friendlyOllamaError(e).slice(0, 80)})`);
    } finally {
      setCompressing(false);
    }
  }

  async function save() {
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const data = {
        name: form.name.trim(),
        description: form.description || '',
        tags: form.tags || [],
        raw_notes: form.raw_notes || '',
        summary: form.summary || '',
        token_estimate: Number(form.token_estimate) || estimateTokens(form.summary),
      };
      if (pod.id && !String(pod.id).startsWith('temp_')) {
        await store.updateRow('pods', pod.id, data);
      } else {
        await store.createRow('pods', data);
      }
      await onSaved();
    } catch {
      setError('Could not save pod.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'h-11 w-full rounded-xl border border-border bg-secondary/60 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none';

  return (
    <div className="eru-theme-card fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-3xl border border-border bg-card p-4 shadow-2xl sm:rounded-3xl" style={{ maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">{pod.id ? 'Edit pod' : 'New memory pod'}</p>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="mb-3"><p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Name</p>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Trading rules" className={inputCls} />
        </div>
        <div className="mb-3"><p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Description</p>
          <input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Optional" className={inputCls} />
        </div>

        <div className="mb-3">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tags</p>
          <div className="flex gap-2">
            <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} placeholder="Add tag + Enter" className={inputCls} />
            <button onClick={addTag} className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-secondary/40 text-foreground"><Plus className="h-4 w-4" /></button>
          </div>
          {form.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {form.tags.map((t) => (
                <button key={t} onClick={() => set('tags', form.tags.filter((x) => x !== t))} className="inline-flex items-center gap-1 rounded-full bg-secondary/60 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground">
                  {t} <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mb-3"><p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Raw notes</p>
          <textarea value={form.raw_notes} onChange={(e) => set('raw_notes', e.target.value)} rows={5} placeholder="Paste long context here…" className={`${inputCls} h-auto resize-none py-2.5`} />
        </div>

        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Summary (injected into bot context)</p>
            <button onClick={compress} disabled={compressing} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-fuchsia-400/40 bg-fuchsia-500/10 px-2.5 text-[11px] font-semibold text-fuchsia-300 disabled:opacity-50">
              {compressing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />} Compress
            </button>
          </div>
          <textarea value={form.summary} onChange={(e) => { set('summary', e.target.value); set('token_estimate', estimateTokens(e.target.value)); }} rows={4} placeholder="Compressed summary…" className={`${inputCls} h-auto resize-none py-2.5`} />
          <p className="mt-1 text-[10px] text-muted-foreground">~{estimateTokens(form.summary)} tokens</p>
        </div>

        {error && <p className="mb-2 text-[12px] text-destructive">{error}</p>}

        <button onClick={save} disabled={saving} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save pod
        </button>
      </div>
    </div>
  );
}