import { useEffect, useState } from 'react';
import { Shield, Upload, CheckCircle, XCircle, AlertTriangle, Code, FileText, RotateCcw, Trash2 } from 'lucide-react';
import { scanCode, CATEGORIES } from '@/lib/codeScanner';

// Real on-device review. The previous version picked a random verdict and
// showed a hardcoded score and history; this one reads the submitted code
// with src/lib/codeScanner.js and reports what it actually found.

const HISTORY_KEY = 'eru_app_review_history';
const MAX_FILE_BYTES = 2_000_000;
const ACCEPT = '.js,.mjs,.cjs,.jsx,.ts,.tsx,.py,.sol,.json,.txt,.sh,.html,.php,.rb,.go';

const VERDICT = {
  safe: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20', label: 'Passed automatic checks' },
  warning: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20', label: 'Needs a human review' },
  dangerous: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20', label: 'Dangerous patterns found' },
};

const SEVERITY_STYLE = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  low: 'bg-secondary text-muted-foreground border-border',
};

function loadHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function AppReview() {
  const [tab, setTab] = useState('submit');
  const [file, setFile] = useState(null);
  const [pasteCode, setPasteCode] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(loadHistory);

  useEffect(() => {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20))); } catch { /* storage unavailable */ }
  }, [history]);

  const startReview = async () => {
    if (!file && !pasteCode.trim()) return;
    setError('');
    setBusy(true);
    try {
      let source = pasteCode;
      let fileName = 'pasted code';
      if (file) {
        if (file.size > MAX_FILE_BYTES) throw new Error('File is larger than 2 MB.');
        source = await file.text();
        fileName = file.name;
      }
      const scan = scanCode(source, { fileName });
      setResult(scan);
      setHistory((prev) => [
        { id: Date.now(), name: fileName, date: new Date().toISOString(), score: scan.score, verdict: scan.verdict, findings: scan.findings.length },
        ...prev,
      ].slice(0, 20));
    } catch (err) {
      setError(err?.message || 'Could not read that file.');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setFile(null); setPasteCode(''); setResult(null); setError('');
  };

  const verdict = result ? VERDICT[result.verdict] : null;

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" /> App Review System
        </h2>
        <p className="text-xs text-muted-foreground">Check code for malware techniques on this device before you run, share or sell it</p>
      </div>

      <div className="flex border-b border-border">
        {[{ id: 'submit', label: 'Scan' }, { id: 'history', label: 'History' }, { id: 'info', label: 'How It Works' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${tab === t.id ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 space-y-4">
        {tab === 'submit' && !result && (
          <>
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
              <p className="text-xs text-primary">The scan runs entirely on your device. Your code is not uploaded anywhere.</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1.5"><Code className="w-3.5 h-3.5" />Paste your code</label>
              <textarea value={pasteCode} onChange={e => { setPasteCode(e.target.value); setFile(null); }}
                placeholder="Paste code, script, or application here..."
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm font-mono outline-none resize-none min-h-[140px]" />
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex-1 h-px bg-border" />or upload file<div className="flex-1 h-px bg-border" />
            </div>

            <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl py-8 gap-2 cursor-pointer hover:border-primary/40 transition-colors">
              <Upload className="w-6 h-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{file ? file.name : 'Tap to upload file'}</p>
              <p className="text-xs text-muted-foreground/50">.js .ts .py .sol .sh .json .html and more · up to 2 MB</p>
              <input type="file" className="hidden" onChange={e => { setFile(e.target.files[0] || null); setPasteCode(''); }} accept={ACCEPT} />
            </label>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button onClick={startReview} disabled={busy || (!file && !pasteCode.trim())}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40">
              <Shield className="w-4 h-4" /> {busy ? 'Scanning…' : 'Start Security Review'}
            </button>
          </>
        )}

        {tab === 'submit' && result && verdict && (
          <div className="space-y-4">
            <div className={`rounded-xl p-5 text-center border ${verdict.bg} ${verdict.border}`}>
              <verdict.icon className={`w-12 h-12 mx-auto mb-3 ${verdict.color}`} />
              <h3 className={`font-bold text-lg ${verdict.color}`}>{verdict.label}</h3>
              <p className="text-xs text-muted-foreground mt-1">{result.fileName} · {result.lineCount} lines{result.truncated ? ' · only the first 2 MB was checked' : ''}</p>
              <div className={`mt-3 inline-block rounded-lg px-4 py-2 border ${verdict.border} ${verdict.bg}`}>
                <p className={`text-xs font-mono ${verdict.color}`}>SAFETY SCORE: {result.score}/100 · {result.findings.length} FINDING{result.findings.length === 1 ? '' : 'S'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              {result.categories.map(c => (
                <div key={c.key} className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2">
                  <span className="text-xs text-foreground">{c.label}</span>
                  {c.findings === 0
                    ? <span className="text-[11px] text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" />clear</span>
                    : <span className="text-[11px] text-yellow-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{c.findings}</span>}
                </div>
              ))}
            </div>

            {result.findings.length > 0 && (
              <div className="space-y-2">
                {result.findings.map(f => (
                  <div key={f.id} className="bg-card border border-border rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{f.title}</p>
                      <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${SEVERITY_STYLE[f.severity]}`}>{f.severity}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Line {f.line}{f.count > 1 ? ` · ${f.count} matches` : ''} · {CATEGORIES[f.category]}</p>
                    {f.excerpt && <pre className="text-[11px] font-mono bg-secondary/60 rounded-lg px-2 py-1.5 overflow-x-auto whitespace-pre-wrap break-all">{f.excerpt}</pre>}
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">An automatic pattern check can miss new or well-hidden tricks. Read any flagged lines yourself before running the code.</p>

            <button onClick={reset} className="w-full flex items-center justify-center gap-2 border border-border rounded-xl py-3 text-sm text-muted-foreground hover:bg-secondary/40 transition-colors">
              <RotateCcw className="w-4 h-4" /> Scan Another
            </button>
          </div>
        )}

        {tab === 'history' && (
          <div className="space-y-3">
            {history.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No scans yet on this device.</p>}
            {history.map(r => {
              const cfg = VERDICT[r.verdict] || VERDICT.warning;
              return (
                <div key={r.id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <p className="font-medium text-sm truncate">{r.name}</p>
                    </div>
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                      <cfg.icon className="w-3 h-3" />{r.score}/100
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{new Date(r.date).toLocaleString()} · {r.findings} finding{r.findings === 1 ? '' : 's'}</p>
                </div>
              );
            })}
            {history.length > 0 && (
              <button onClick={() => setHistory([])} className="w-full flex items-center justify-center gap-2 border border-border rounded-xl py-2.5 text-xs text-muted-foreground">
                <Trash2 className="w-3.5 h-3.5" /> Clear history on this device
              </button>
            )}
          </div>
        )}

        {tab === 'info' && (
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              <h4 className="font-semibold text-foreground">What it checks</h4>
              <p>The scanner reads your code on this device and looks for techniques that malware and scams commonly use. Each finding shows the line so you can judge it yourself.</p>
            </div>
            {Object.entries(CATEGORIES).map(([key, label], i) => (
              <div key={key} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs text-primary font-bold flex-shrink-0 mt-0.5">{i + 1}</div>
                <p className="font-medium text-foreground">{label}</p>
              </div>
            ))}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mt-2">
              <p className="text-xs text-primary">Score: 100 minus points per finding (critical 45, high 20, medium 8, low 3). 80+ with nothing high or critical passes; any critical finding or a score under 50 is marked dangerous.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
