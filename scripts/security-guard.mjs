#!/usr/bin/env node
// Security guard — repo-wide rules that fail CI when broken.
//
// Usage: node scripts/security-guard.mjs        (exit 0 = all rules pass)
//
// Every rule reads tracked files only (git ls-files). Allow-lists and block
// lists live in scripts/security-guard.config.json so the rules themselves
// never need editing to approve something; approving a new host, file or
// action is a reviewed one-line config change.
//
// CI runs this on every push and PR and once a day
// (.github/workflows/security-guard.yml). A failing run makes GitHub email
// the repo owner (Settings → Notifications → Actions).

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CONFIG_PATH = 'scripts/security-guard.config.json';
const TEXT_EXT = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.jsonc', '.md', '.html',
  '.css', '.yml', '.yaml', '.sh', '.txt', '.csv', '.svg', '']);
const LOCKFILE = /(^|\/)package-lock\.json$/;

// ─── Rule helpers (pure: path + content in, findings out) ───────────────────

const lineOf = (content, index) => content.slice(0, index).split('\n').length;

function findAll(re, content) {
  const out = [];
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  for (let m = g.exec(content); m; m = g.exec(content)) {
    out.push({ index: m.index, text: m[0] });
    if (m[0] === '') g.lastIndex++;
  }
  return out;
}

const SECRET_PATTERNS = [
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['OpenAI/Anthropic key', /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{24,}/],
  ['Stripe live key', /\b(?:sk|rk)_live_[0-9a-zA-Z]{20,}/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}|\bgithub_pat_[A-Za-z0-9_]{40,}/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}/],
  ['Private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['Telegram bot token', /\b[0-9]{8,10}:AA[A-Za-z0-9_-]{33}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}/],
  ['Hugging Face token', /\bhf_[A-Za-z0-9]{34,}/],
  ['JSON Web Token', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['Twilio API key', /\bSK[0-9a-f]{32}\b/],
];

export function checkSecrets(file, content) {
  if (LOCKFILE.test(file)) return [];
  const out = [];
  for (const [name, re] of SECRET_PATTERNS) {
    for (const m of findAll(re, content)) out.push({ line: lineOf(content, m.index), msg: `${name} committed` });
  }
  return out;
}

export function checkBlockedTerms(file, content, cfg) {
  if (cfg.blockedTermsAllowedIn.includes(file)) return [];
  const out = [];
  for (const term of cfg.blockedTerms) {
    const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const m = re.exec(content);
    if (m) out.push({ line: lineOf(content, m.index), msg: `retired service "${term}" referenced` });
  }
  return out;
}

const SHELLISH = /(\.sh|\.ya?ml)$|(^|\/)Dockerfile$/;
const CAT_CMD = /(^|[\s;&|(`$])cat(\s|$)/m;

export function checkNoCat(file, content) {
  const out = [];
  if (SHELLISH.test(file)) {
    for (const m of findAll(new RegExp(CAT_CMD.source, 'gm'), content)) {
      out.push({ line: lineOf(content, m.index), msg: '`cat` used (owner rule: use `head`)' });
    }
  }
  if (/(^|\/)package\.json$/.test(file)) {
    const scripts = JSON.parse(content).scripts || {};
    for (const [name, cmd] of Object.entries(scripts)) {
      if (CAT_CMD.test(cmd)) out.push({ line: 1, msg: `npm script "${name}" uses \`cat\`` });
    }
  }
  return out;
}

const REMOTE_HTML = [
  ['remote <script>', /<script\b[^>]*\bsrc\s*=\s*["']?(?:https?:)?\/\//i],
  ['remote <iframe>', /<iframe\b[^>]*\bsrc\s*=\s*["']?(?:https?:)?\/\//i],
  ['remote <link>', /<link\b[^>]*\bhref\s*=\s*["']?(?:https?:)?\/\//i],
  ['<object>/<embed>', /<(?:object|embed)\b/i],
  ['<base> tag', /<base\b/i],
];

export function checkHtml(file, content) {
  if (!file.endsWith('.html')) return [];
  const out = [];
  for (const [name, re] of REMOTE_HTML) {
    for (const m of findAll(re, content)) out.push({ line: lineOf(content, m.index), msg: `${name} in HTML` });
  }
  return out;
}

const CODE_FILE = /\.(jsx?|mjs|cjs|tsx?|html)$/;
const NEVER_JS = [
  ['eval()', /\beval\s*\(/],
  ['new Function()', /\bnew\s+Function\s*\(/],
  ['document.write()', /\bdocument\.write(?:ln)?\s*\(/],
];
const HTML_SINKS = /\.(?:innerHTML|outerHTML)\s*=|\binsertAdjacentHTML\s*\(|\bdangerouslySetInnerHTML\b/;

export function checkDangerousJs(file, content, cfg) {
  if (!CODE_FILE.test(file) || file.startsWith('scripts/')) return [];
  const out = [];
  for (const [name, re] of NEVER_JS) {
    for (const m of findAll(re, content)) out.push({ line: lineOf(content, m.index), msg: `${name} is not allowed` });
  }
  if (!cfg.htmlInsertionAllowedIn.includes(file)) {
    const m = HTML_SINKS.exec(content);
    if (m) out.push({ line: lineOf(content, m.index), msg: 'raw HTML insertion outside the allow-list' });
  }
  return out;
}

const LIFECYCLE = ['preinstall', 'install', 'postinstall', 'prepare', 'preprepare', 'postprepare', 'prepublish'];

export function checkPackageJson(file, content) {
  if (!/(^|\/)package\.json$/.test(file)) return [];
  const pkg = JSON.parse(content);
  const out = [];
  for (const k of LIFECYCLE) if (pkg.scripts?.[k]) out.push({ line: 1, msg: `install-time script "${k}" is not allowed` });
  const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies };
  for (const [name, spec] of Object.entries(deps)) {
    if (!/^[\^~]?\d[\w.+-]*$|^[<>=]/.test(String(spec))) out.push({ line: 1, msg: `dependency ${name}@${spec} is not a registry version` });
  }
  return out;
}

export function checkLockfile(file, content) {
  if (!LOCKFILE.test(file)) return [];
  const out = [];
  for (const m of findAll(/"resolved":\s*"([^"]+)"/, content)) {
    const url = m.text.replace(/^"resolved":\s*"/, '').replace(/"$/, '');
    if (!url.startsWith('https://registry.npmjs.org/')) out.push({ line: lineOf(content, m.index), msg: `package resolved from ${url}` });
  }
  return out;
}

const SENSITIVE_FILE = /(^|\/)(\.env(\.(?!example$)[\w.-]+)?|id_rsa[\w.]*|id_ed25519[\w.]*|[^/]+\.(pem|key|p12|pfx|keystore))$/;

export function checkSensitiveFileName(file) {
  return SENSITIVE_FILE.test(file) ? [{ line: 1, msg: 'credential-type file committed' }] : [];
}

export function checkWorkflow(file, content, cfg) {
  if (!/^\.github\/workflows\/.+\.ya?ml$/.test(file)) return [];
  const out = [];
  const prt = /pull_request_target/.exec(content);
  if (prt) out.push({ line: lineOf(content, prt.index), msg: 'pull_request_target trigger is not allowed' });
  if (!/^permissions:/m.test(content)) out.push({ line: 1, msg: 'workflow must declare top-level permissions' });
  if (/^\s*[\w-]+:\s*write\b/m.test(content.split(/^jobs:/m)[0] || '')) out.push({ line: 1, msg: 'workflow grants write permission' });
  for (const m of findAll(/uses:\s*([^\s@#]+)@/, content)) {
    const action = m.text.replace(/^uses:\s*/, '').replace(/@$/, '');
    if (!cfg.allowedActions.includes(action)) out.push({ line: lineOf(content, m.index), msg: `action ${action} is not on the allow-list` });
  }
  return out;
}

const HOST_SCOPE = /^(src\/|public\/|index\.html$|router-console\/|media-converter\/)/;
const HOST_RE = /\b(?:https?|wss?):\/\/([a-z0-9.-]+\.[a-z]{2,})/gi;

export function extractHosts(file, content) {
  if (!HOST_SCOPE.test(file) || file.endsWith('.md') || LOCKFILE.test(file)) return [];
  return findAll(HOST_RE, content).map((m) => ({
    host: m.text.replace(/^[a-z]+:\/\//i, '').toLowerCase(),
    line: lineOf(content, m.index),
  }));
}

export function checkHosts(file, content, cfg) {
  const allowed = new Set(cfg.allowedHosts);
  return extractHosts(file, content)
    .filter((h) => !allowed.has(h.host))
    .map((h) => ({ line: h.line, msg: `new outside host ${h.host} (add to allowedHosts only if approved)` }));
}

export function checkAgentSettings(file, content, cfg) {
  if (file !== '.claude/settings.json') return [];
  const deny = JSON.parse(content).permissions?.deny || [];
  return cfg.requiredAgentDenyRules
    .filter((rule) => !deny.includes(rule))
    .map((rule) => ({ line: 1, msg: `required deny rule "${rule}" was removed` }));
}

const FILE_RULES = [
  ['secrets', checkSecrets],
  ['retired-service', checkBlockedTerms],
  ['no-cat', checkNoCat],
  ['remote-html', checkHtml],
  ['dangerous-js', checkDangerousJs],
  ['package-json', checkPackageJson],
  ['lockfile-source', checkLockfile],
  ['workflows', checkWorkflow],
  ['outside-hosts', checkHosts],
  ['agent-settings', checkAgentSettings],
];

// Repo-level rules.

export function checkCommitIdentity(cfg, author, committer) {
  const out = [];
  if (!cfg.allowedCommitAuthors.includes(author)) out.push(`commit author "${author}" is not on the allow-list`);
  if (!cfg.allowedCommitters.includes(committer)) out.push(`committer "${committer}" is not on the allow-list`);
  return out;
}

// ─── Runner ─────────────────────────────────────────────────────────────────

export function run(root = process.cwd()) {
  const cfg = JSON.parse(fs.readFileSync(path.join(root, CONFIG_PATH), 'utf8'));
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const findings = [];
  const requiredFiles = ['.claude/settings.json', CONFIG_PATH];
  for (const f of requiredFiles) if (!files.includes(f)) findings.push(`[agent-settings] ${f}: file is missing`);

  for (const file of files) {
    for (const f of checkSensitiveFileName(file)) findings.push(`[credential-files] ${file}:${f.line} ${f.msg}`);
    if (!TEXT_EXT.has(path.extname(file)) && !/Dockerfile$/.test(file)) continue;
    const full = path.join(root, file);
    if (!fs.existsSync(full) || fs.statSync(full).size > 5_000_000) continue;
    const content = fs.readFileSync(full, 'utf8');
    for (const [rule, check] of FILE_RULES) {
      for (const f of check(file, content, cfg)) findings.push(`[${rule}] ${file}:${f.line} ${f.msg}`);
    }
  }

  if (process.env.GITHUB_EVENT_NAME !== 'pull_request') {
    try {
      const [author, committer] = execFileSync('git', ['log', '-1', '--format=%an%x00%cn'], { cwd: root, encoding: 'utf8' })
        .trim().split('\0');
      for (const msg of checkCommitIdentity(cfg, author, committer)) findings.push(`[commit-identity] HEAD: ${msg}`);
    } catch {
      findings.push('[commit-identity] could not read the latest commit');
    }
  }
  return { findings, fileCount: files.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { findings, fileCount } = run();
  if (findings.length) {
    console.error(`[security guard] FAIL — ${findings.length} finding(s) in ${fileCount} tracked files:\n`);
    for (const f of findings) console.error('  ' + f);
    console.error('\nFix the code, or approve the item explicitly in scripts/security-guard.config.json.');
    process.exit(1);
  }
  console.log(`[security guard] OK — ${FILE_RULES.length + 2} rules passed on ${fileCount} tracked files.`);
}
