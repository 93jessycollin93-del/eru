import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Download, Upload, FileJson, Check, AlertCircle, Loader2,
  Database, Boxes, FileDown, FileUp, X,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';

const EXPORTABLE_ENTITIES = [
  { name: 'JackieSaved', label: 'Saved Assets', desc: 'Snippets, code, prompts' },
  { name: 'UserBot', label: 'User Bots', desc: 'AI bot configurations' },
  { name: 'OfflineBot', label: 'Offline Bots', desc: 'Local Ollama bots' },
  { name: 'MemoryPod', label: 'Memory Pods', desc: 'Knowledge summaries' },
  { name: 'Note', label: 'Notes', desc: 'Personal notes' },
  { name: 'PromptTemplate', label: 'Prompt Templates', desc: 'Reusable prompts' },
];

const BUILT_IN_FIELDS = ['id', 'created_date', 'updated_date', 'created_by_id'];

function stripBuiltins(record) {
  const clean = { ...record };
  BUILT_IN_FIELDS.forEach((f) => delete clean[f]);
  return clean;
}

export default function DataPortability() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(() => new Set(EXPORTABLE_ENTITIES.map((e) => e.name)));
  const [counts, setCounts] = useState({});
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const next = {};
      await Promise.all(
        EXPORTABLE_ENTITIES.map(async (e) => {
          try {
            const records = await base44.entities[e.name].list('-created_date', 500);
            next[e.name] = records.length;
          } catch {
            next[e.name] = 0;
          }
        })
      );
      if (active) {
        setCounts(next);
        setLoadingCounts(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const toggleEntity = (name) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const totalSelected = Array.from(selected).reduce((sum, name) => sum + (counts[name] || 0), 0);

  const handleExport = async () => {
    if (selected.size === 0) return;
    setExporting(true);
    setError('');
    setExportStatus('Gathering records…');
    try {
      const bundle = {
        version: 1,
        exported_at: new Date().toISOString(),
        app: 'cybernetic67',
        entities: {},
      };
      for (const name of selected) {
        setExportStatus(`Exporting ${name}…`);
        const records = await base44.entities[name].list('-created_date', 500);
        bundle.entities[name] = records.map(stripBuiltins);
      }
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cybernetic-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportStatus('Export complete ✓');
      setTimeout(() => setExportStatus(''), 3000);
    } catch (err) {
      setError(err.message || 'Export failed');
      setExportStatus('');
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setImportResults(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.entities || typeof data.entities !== 'object') {
          setError('Invalid file — missing "entities" object.');
          return;
        }
        const summary = Object.entries(data.entities)
          .filter(([, records]) => Array.isArray(records))
          .map(([name, records]) => ({ entity: name, count: records.length }));
        if (summary.length === 0) {
          setError('No importable entity data found in file.');
          return;
        }
        setImportPreview({ data, summary });
      } catch {
        setError('Could not parse JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!importPreview) return;
    setImporting(true);
    setError('');
    const results = [];
    for (const [name, records] of Object.entries(importPreview.data.entities)) {
      if (!Array.isArray(records) || records.length === 0) continue;
      if (!base44.entities[name]) {
        results.push({ entity: name, status: 'skipped', message: 'Unknown entity type' });
        continue;
      }
      try {
        const cleaned = records.map(stripBuiltins);
        const created = await base44.entities[name].bulkCreate(cleaned);
        results.push({ entity: name, status: 'ok', count: created.length });
      } catch (err) {
        results.push({ entity: name, status: 'error', message: (err.message || 'Failed').slice(0, 120) });
      }
    }
    setImportResults(results);
    setImporting(false);
    setImportPreview(null);
    // Refresh counts
    setLoadingCounts(true);
    const next = {};
    await Promise.all(
      EXPORTABLE_ENTITIES.map(async (e) => {
        try {
          const recs = await base44.entities[e.name].list('-created_date', 500);
          next[e.name] = recs.length;
        } catch { next[e.name] = 0; }
      })
    );
    setCounts(next);
    setLoadingCounts(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-semibold">Import / Export</h2>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1 ml-12">Back up and restore your bots, assets, memory pods, notes, and prompts.</p>
      </div>

      <div className="px-4 py-4 space-y-5 max-w-2xl mx-auto w-full">
        {/* Export */}
        <section className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <FileDown className="w-4 h-4 text-primary" />
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">Export Data</p>
          </div>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="divide-y divide-border">
              {EXPORTABLE_ENTITIES.map((e) => {
                const checked = selected.has(e.name);
                return (
                  <button
                    key={e.name}
                    onClick={() => toggleEntity(e.name)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors text-left"
                  >
                    <div className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors flex-shrink-0 ${checked ? 'bg-primary border-primary' : 'border-border bg-background'}`}>
                      {checked && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{e.label}</p>
                      <p className="text-[11px] text-muted-foreground">{e.desc}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full flex-shrink-0">
                      {loadingCounts ? '…' : (counts[e.name] ?? 0)}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="px-4 py-3 border-t border-border bg-secondary/30 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {selected.size} types · {totalSelected} records
              </span>
              <button
                onClick={handleExport}
                disabled={exporting || selected.size === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
              >
                {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {exporting ? (exportStatus || 'Exporting…') : 'Export JSON'}
              </button>
            </div>
          </div>
        </section>

        {/* Import */}
        <section className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <FileUp className="w-4 h-4 text-primary" />
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">Import Data</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border py-6 hover:border-primary/40 hover:bg-primary/5 transition-colors"
            >
              <FileJson className="w-7 h-7 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Select JSON file</span>
              <span className="text-[11px] text-muted-foreground">Previously exported backup</span>
            </button>

            {importPreview && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">Ready to import</p>
                  <button onClick={() => setImportPreview(null)} className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {importPreview.summary.map((s) => (
                  <div key={s.entity} className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{s.entity}</span>
                    <span className="text-foreground font-medium">{s.count} records</span>
                  </div>
                ))}
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
                >
                  {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {importing ? 'Importing…' : 'Confirm Import'}
                </button>
              </div>
            )}

            {importResults && (
              <div className="rounded-xl border border-border bg-background p-3 space-y-1.5">
                <p className="text-xs font-semibold text-foreground mb-1">Import results</p>
                {importResults.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    {r.status === 'ok' && <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                    {r.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                    {r.status === 'skipped' && <X className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />}
                    <span className="text-muted-foreground flex-1">{r.entity}</span>
                    {r.status === 'ok' && <span className="text-emerald-400 font-medium">{r.count} added</span>}
                    {r.status === 'error' && <span className="text-red-400 truncate max-w-[160px]">{r.message}</span>}
                    {r.status === 'skipped' && <span className="text-yellow-400">skipped</span>}
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-[11px] text-red-400">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-[10px] text-muted-foreground">
              <Boxes className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <p>Importing creates <strong className="text-foreground">new</strong> records — it won't overwrite or delete existing ones. Built-in fields (id, dates) are stripped automatically.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}