import { useState } from 'react';
import { Shield, Upload, CheckCircle, AlertTriangle, XCircle, Clock, FileCode, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const SAMPLE_REVIEWS = [
  { id: 1, name: 'NFT Generator v1.2', submitted: '2 days ago', status: 'approved', score: 98, findings: [] },
  { id: 2, name: 'Voting Protocol Draft', submitted: '5 days ago', status: 'pending', score: null, findings: [] },
  { id: 3, name: 'Auto-Trader Bot v0.9', submitted: '1 week ago', status: 'flagged', score: 32, findings: ['Detected external API calls without disclosure', 'Potential data exfiltration pattern in line 147', 'Obfuscated variable names in critical section'] },
];

const STATUS_CONFIG = {
  approved: { label: 'Approved', icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' },
  pending: { label: 'Under Review', icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
  flagged: { label: 'Flagged', icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
};

function ReviewCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[item.status];
  const Icon = cfg.icon;
  return (
    <div className={`bg-card border rounded-xl p-4 space-y-3 ${item.status === 'flagged' ? 'border-red-500/30' : 'border-border'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold">{item.name}</p>
            <p className="text-xs text-muted-foreground">Submitted {item.submitted}</p>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${cfg.bg} ${cfg.color}`}>
          <Icon className="w-3 h-3" />{cfg.label}
        </div>
      </div>

      {item.score !== null && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Safety Score</span>
            <span className={item.score >= 80 ? 'text-green-400' : item.score >= 50 ? 'text-yellow-400' : 'text-red-400'}>{item.score}/100</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${item.score >= 80 ? 'bg-green-500' : item.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${item.score}%` }} />
          </div>
        </div>
      )}

      {item.findings.length > 0 && (
        <div>
          <button onClick={() => setExpanded(p => !p)} className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {item.findings.length} issue{item.findings.length > 1 ? 's' : ''} found
          </button>
          {expanded && (
            <ul className="mt-2 space-y-1.5">
              {item.findings.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />{f}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {item.status === 'approved' && (
        <div className="flex items-center gap-2 text-xs text-green-400">
          <CheckCircle className="w-3.5 h-3.5" />
          <span>Authorized Product label granted — ready for Marketplace</span>
        </div>
      )}
    </div>
  );
}

export default function AppReview() {
  const [reviews, setReviews] = useState(SAMPLE_REVIEWS);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState('submit');

  const runAnalysis = async () => {
    if (!code.trim() || !name.trim()) return;
    setAnalyzing(true);
    setResult(null);

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a code security auditor. Analyze the following code for: malware, data exfiltration, obfuscation, harmful logic, unauthorized network calls, or any negative/harmful implementations. Be thorough but concise. Return a safety score (0-100) and list specific findings if any.

Code name: "${name}"
Code:
\`\`\`
${code.slice(0, 3000)}
\`\`\`

Respond with a JSON object like:
{
  "score": number,
  "verdict": "safe" | "warning" | "dangerous",
  "summary": "brief summary",
  "findings": ["finding1", "finding2"]
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          score: { type: 'number' },
          verdict: { type: 'string' },
          summary: { type: 'string' },
          findings: { type: 'array', items: { type: 'string' } }
        }
      }
    });

    setResult(response);
    setAnalyzing(false);

    const status = response.score >= 80 ? 'approved' : response.score >= 50 ? 'pending' : 'flagged';
    setReviews(prev => [{ id: Date.now(), name, submitted: 'just now', status, score: response.score, findings: response.findings || [] }, ...prev]);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-24">
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <Shield className="w-5 h-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">App Review</h2>
          <p className="text-xs text-muted-foreground">AI-powered code safety scanner</p>
        </div>
      </div>

      {/* How it works */}
      <div className="px-4 pt-4">
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-primary flex items-center gap-2"><Zap className="w-3.5 h-3.5" /> How It Works</p>
          <p className="text-xs text-muted-foreground leading-relaxed">Submit your code or project for review. Our AI scans for malware, harmful logic, and security issues. If it passes, you receive an <span className="text-green-400 font-medium">Authorized Product</span> label enabling you to list it on the Marketplace.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mt-4">
        {['submit', 'my reviews'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-medium capitalize ${tab === t ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 space-y-4">
        {tab === 'submit' && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">Project / File Name</p>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. MyTradingBot v1.0"
                className="w-full bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground" />
            </div>

            <div className="bg-card border border-border rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-2">Paste Code or Content</p>
              <textarea value={code} onChange={e => setCode(e.target.value)}
                placeholder="Paste your code, script, or content here for review..."
                className="w-full bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground min-h-[180px] resize-none font-mono text-xs" />
            </div>

            {/* Result */}
            {result && (
              <div className={`rounded-xl border p-4 space-y-3 ${result.verdict === 'safe' ? 'bg-green-500/10 border-green-500/30' : result.verdict === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                <div className="flex items-center justify-between">
                  <span className={`font-semibold text-sm ${result.verdict === 'safe' ? 'text-green-400' : result.verdict === 'warning' ? 'text-yellow-400' : 'text-red-400'}`}>
                    {result.verdict === 'safe' ? '✓ Safe to Publish' : result.verdict === 'warning' ? '⚠ Review Required' : '✗ Issues Detected'}
                  </span>
                  <span className={`text-lg font-mono font-bold ${result.score >= 80 ? 'text-green-400' : result.score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{result.score}/100</span>
                </div>
                <p className="text-xs text-muted-foreground">{result.summary}</p>
                {result.findings?.length > 0 && (
                  <ul className="space-y-1.5">
                    {result.findings.map((f, i) => (
                      <li key={i} className="text-xs flex items-start gap-2 text-muted-foreground">
                        <AlertTriangle className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" />{f}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <button onClick={runAnalysis} disabled={analyzing || !code.trim() || !name.trim()}
              className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${analyzing || !code.trim() || !name.trim() ? 'bg-secondary text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground'}`}>
              {analyzing ? (
                <><div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> Analyzing...</>
              ) : (
                <><Shield className="w-4 h-4" /> Run Security Review</>
              )}
            </button>
          </div>
        )}

        {tab === 'my reviews' && (
          <div className="space-y-3">
            {reviews.map(r => <ReviewCard key={r.id} item={r} />)}
          </div>
        )}
      </div>
    </div>
  );
}