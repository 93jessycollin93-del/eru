/**
 * codeScanner — on-device static check of submitted code for common malware
 * and abuse techniques. Nothing is sent anywhere: the code is matched against
 * the rules below in the browser.
 *
 * It replaces the App Review "scan" that picked a random verdict. It is an
 * honest pattern check, not proof of safety: it catches well-known techniques
 * (hidden execution, obfuscation, data exfiltration, miners, destructive
 * commands, wallet drainers, leaked keys) and points at the exact lines, so a
 * person can read them.
 *
 * scanCode(source, { fileName }) → { score, verdict, findings, categories }
 *   verdict: 'safe' (score ≥ 80, nothing high or critical)
 *            'warning' (needs a human look)
 *            'dangerous' (a critical finding, or score < 50)
 */

export const SEVERITY_WEIGHT = { critical: 45, high: 20, medium: 8, low: 3 };

export const CATEGORIES = {
  execution: 'Hidden code execution',
  obfuscation: 'Obfuscation',
  network: 'Network and data exfiltration',
  system: 'System, persistence and destructive actions',
  crypto: 'Crypto wallets and mining',
  secrets: 'Hardcoded credentials',
  dependencies: 'Dependencies and install scripts',
};

// [id, category, severity, title, regex]
const RULES = [
  ['eval', 'execution', 'high', 'Runs text as code (eval)', /\beval\s*\(/],
  ['function-constructor', 'execution', 'high', 'Builds code from strings (new Function)', /\bnew\s+Function\s*\(/],
  ['string-timer', 'execution', 'medium', 'Timer runs a string as code', /\bset(?:Timeout|Interval)\s*\(\s*['"`]/],
  ['shell', 'execution', 'high', 'Starts system commands or processes',
    /\b(?:child_process|execSync|spawnSync|execFile)\b|\b(?:exec|spawn)\s*\(|\bsubprocess\.|\bos\.(?:system|popen)\s*\(|Runtime\.getRuntime\(\)\.exec|ShellExecute/i],
  ['encoded-powershell', 'execution', 'critical', 'Encoded PowerShell command', /powershell(?:\.exe)?[^\n]*\s-(?:e|enc|encodedcommand)\s/i],
  ['remote-import', 'execution', 'high', 'Loads code from the internet at runtime',
    /\bimport\s*\(\s*['"`]https?:|\brequire\s*\(\s*['"`]https?:|<script[^>]+src\s*=\s*["']https?:/i],
  ['html-injection', 'execution', 'medium', 'Writes raw HTML into the page',
    /\bdocument\.write(?:ln)?\s*\(|\.(?:inner|outer)HTML\s*=|insertAdjacentHTML\s*\(|dangerously\s*SetInnerHTML/],
  ['unsafe-deserialize', 'execution', 'medium', 'Unsafe deserialization', /\bpickle\.loads?\s*\(|\byaml\.load\s*\((?![^)]*Loader\s*=\s*yaml\.SafeLoader)|\bmarshal\.loads\s*\(/],

  ['packed', 'obfuscation', 'critical', 'Packed/encoded JavaScript (p,a,c,k,e,r)', /eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*[dr]\s*\)/],
  ['escape-run', 'obfuscation', 'high', 'Long run of hex/unicode escapes', /(?:\\x[0-9a-fA-F]{2}){20,}|(?:\\u[0-9a-fA-F]{4}){15,}/],
  ['char-codes', 'obfuscation', 'high', 'Text hidden as character codes', /String\.fromCharCode\s*\((?:\s*\d+\s*,){10,}/],
  ['base64-blob', 'obfuscation', 'medium', 'Large encoded blob in the code', /['"`][A-Za-z0-9+/]{200,}={0,2}['"`]/],
  ['decode', 'obfuscation', 'low', 'Decodes hidden text at runtime', /\batob\s*\(|Buffer\.from\([^)]*['"]base64['"]|\bbase64\.b64decode\s*\(/],

  ['network', 'network', 'low', 'Makes network requests',
    /\bfetch\s*\(|\bXMLHttpRequest\b|\baxios\.|navigator\.sendBeacon|\bnew\s+WebSocket\s*\(|\brequests\.(?:get|post|put)\s*\(|\burllib\b|\bhttps?\.request\s*\(|\b(?:curl|wget)\s+-?/],
  ['raw-ip', 'network', 'high', 'Talks to a raw IP address', /https?:\/\/\d{1,3}(?:\.\d{1,3}){3}/],
  ['drop-endpoint', 'network', 'high', 'Sends data to a webhook, paste or tunnel service',
    /discord(?:app)?\.com\/api\/webhooks|pastebin\.com|transfer\.sh|ngrok(?:-free)?\.(?:io|app)|webhook\.site|requestbin|hookbin|pipedream\.net|\.onion\b/i],
  ['telegram-api', 'network', 'medium', 'Calls the Telegram bot API directly', /api\.telegram\.org\/bot/i],
  ['browser-storage', 'network', 'low', 'Reads cookies or browser storage', /document\.cookie|\blocalStorage\.getItem\s*\(|\bsessionStorage\b|\bindexedDB\b/],
  ['keystrokes', 'network', 'low', 'Listens to every keystroke', /addEventListener\s*\(\s*['"]key(?:down|up|press)['"]/],
  ['password-field', 'network', 'low', 'Handles password fields', /type\s*=\s*['"]password['"]|\bpassword\s*[:=]/i],

  ['destructive', 'system', 'critical', 'Deletes or wipes the system',
    /\brm\s+-[a-z]*r[a-z]*f?\s+(?:\/(?:\s|$|\*)|~|\$HOME|\*)|\bdel\s+\/[fsq]\b|\bformat\s+[a-z]:|\bmkfs\.|\bdd\s+if=[^\n]*of=\/dev\//i],
  ['persistence', 'system', 'high', 'Installs itself to run automatically',
    /\bcrontab\s|\/etc\/cron|CurrentVersion\\\\?Run\b|LaunchAgents|LaunchDaemons|systemctl\s+enable|\bschtasks\s/i],
  ['privilege', 'system', 'medium', 'Asks for admin/root rights', /\bsudo\s|\bchmod\s+(?:\+s|[0-7]*777)\b|\brunas\s/i],
  ['disable-security', 'system', 'critical', 'Turns off antivirus or security tools',
    /Set-MpPreference[^\n]*-Disable|DisableAntiSpyware|netsh\s+advfirewall\s+set[^\n]*off|setenforce\s+0|ufw\s+disable/i],

  ['miner', 'crypto', 'critical', 'Cryptocurrency miner', /coinhive|coin-hive|cryptonight|stratum\+tcp|\bxmrig\b|webminepool|\bminero\b/i],
  ['drainer', 'crypto', 'high', 'Unlimited token approval (wallet drainer pattern)',
    /setApprovalForAll\s*\(|approve\s*\([^)]*(?:MaxUint256|type\s*\(\s*uint256\s*\)\.max|2\s*\*\*\s*256|0x[fF]{64})/],
  ['wallet-secrets', 'crypto', 'medium', 'Touches private keys or seed phrases', /\bprivate[_ ]?key\b|\bmnemonic\b|seed\s*phrase|secretRecoveryPhrase/i],
  ['solidity-danger', 'crypto', 'high', 'Dangerous Solidity (selfdestruct, delegatecall, tx.origin)', /\b(?:selfdestruct|delegatecall)\s*\(|\btx\.origin\b/],

  ['secret-key', 'secrets', 'high', 'Hardcoded API key or token',
    /AKIA[0-9A-Z]{16}|\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{24,}|\b(?:sk|rk)_live_[0-9a-zA-Z]{20,}|\bgh[pousr]_[A-Za-z0-9]{36,}|\bxox[baprs]-[A-Za-z0-9-]{10,}|\b[0-9]{8,10}:AA[A-Za-z0-9_-]{33}\b|\bAIza[0-9A-Za-z_-]{35}|\bhf_[A-Za-z0-9]{34,}/],
  ['private-key-block', 'secrets', 'critical', 'Private key embedded in the code', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],

  ['install-script', 'dependencies', 'high', 'Runs a script when installed (npm lifecycle)', /"(?:preinstall|install|postinstall)"\s*:\s*"/],
  ['remote-dependency', 'dependencies', 'high', 'Dependency fetched from a URL or git',
    /"[@\w./-]+"\s*:\s*"(?:git\+|git:|github:|https?:\/\/|file:)/],
];

// Combinations that are far more suspicious together than alone.
const COMBOS = [
  ['decode-and-run', 'obfuscation', 'critical', 'Decodes hidden text and runs it', ['decode', 'eval']],
  ['decode-and-run-fn', 'obfuscation', 'critical', 'Decodes hidden text and runs it', ['decode', 'function-constructor']],
  ['steal-storage', 'network', 'high', 'Reads cookies/storage and sends network requests', ['browser-storage', 'network']],
  ['keylogger', 'network', 'high', 'Captures keystrokes and sends network requests', ['keystrokes', 'network']],
  ['credential-harvest', 'network', 'medium', 'Collects passwords and sends network requests', ['password-field', 'network']],
];

const MAX_SOURCE = 2_000_000;

function lineAt(source, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (source.charCodeAt(i) === 10) line++;
  return line;
}

export function scanCode(source, { fileName = 'pasted code' } = {}) {
  const text = String(source || '').slice(0, MAX_SOURCE);
  const lines = text.split('\n');
  const hits = new Map();

  for (const [id, category, severity, title, re] of RULES) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let first = null;
    let count = 0;
    for (let m = g.exec(text); m; m = g.exec(text)) {
      count++;
      if (first === null) first = m.index;
      if (m[0] === '') g.lastIndex++;
      if (count >= 500) break;
    }
    if (count) {
      const line = lineAt(text, first);
      hits.set(id, { id, category, severity, title, count, line, excerpt: (lines[line - 1] || '').trim().slice(0, 160) });
    }
  }

  for (const [id, category, severity, title, needs] of COMBOS) {
    if (needs.every((n) => hits.has(n)) && !hits.has(id)) {
      const anchor = hits.get(needs[needs.length - 1]);
      hits.set(id, { id, category, severity, title, count: 1, line: anchor.line, excerpt: anchor.excerpt });
    }
  }

  const findings = [...hits.values()].sort(
    (a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity] || a.line - b.line,
  );
  const penalty = findings.reduce((sum, f) => sum + SEVERITY_WEIGHT[f.severity], 0);
  const score = Math.max(0, 100 - penalty);
  const hasCritical = findings.some((f) => f.severity === 'critical');
  const hasHigh = findings.some((f) => f.severity === 'high');
  const verdict = hasCritical || score < 50 ? 'dangerous' : hasHigh || score < 80 ? 'warning' : 'safe';

  const categories = Object.entries(CATEGORIES).map(([key, label]) => ({
    key,
    label,
    findings: findings.filter((f) => f.category === key).length,
  }));

  return { fileName, score, verdict, findings, categories, lineCount: lines.length, truncated: String(source || '').length > MAX_SOURCE };
}
