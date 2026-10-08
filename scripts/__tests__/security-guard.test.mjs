import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkSecrets, checkBlockedTerms, checkNoCat, checkHtml, checkDangerousJs,
  checkPackageJson, checkLockfile, checkSensitiveFileName, checkWorkflow,
  checkHosts, checkAgentSettings, checkCommitIdentity, run,
} from '../security-guard.mjs';

const cfg = {
  blockedTerms: ['forbidden-vendor'],
  blockedTermsAllowedIn: ['allowed.json'],
  htmlInsertionAllowedIn: ['src/ok.jsx'],
  allowedActions: ['actions/checkout'],
  allowedCommitAuthors: ['Owner'],
  allowedCommitters: ['Owner', 'GitHub'],
  requiredAgentDenyRules: ['Bash(cat *)', 'WebFetch'],
  allowedHosts: ['example.com'],
};

// Fake credentials are assembled at runtime so this file never contains one.
const fake = {
  aws: 'AKIA' + 'ABCDEFGHIJKLMNOP',
  openai: 'sk-' + 'proj-' + 'a'.repeat(30),
  github: 'ghp_' + 'b'.repeat(36),
  telegram: '123456789' + ':AA' + 'c'.repeat(33),
  key: '-----BEGIN ' + 'RSA PRIVATE KEY-----',
};

test('secrets: flags real-looking credentials, ignores placeholders and lockfiles', () => {
  for (const value of Object.values(fake)) {
    assert.equal(checkSecrets('src/a.js', `const k = "${value}";`).length, 1, value.slice(0, 8));
  }
  assert.equal(checkSecrets('src/a.js', 'const k = `sk_live_${token}`; // sk_live_xxx').length, 0);
  assert.equal(checkSecrets('package-lock.json', fake.github).length, 0);
});

test('retired service: blocked term fails except in allowed files', () => {
  assert.equal(checkBlockedTerms('src/a.js', 'import x from "Forbidden-Vendor"', cfg).length, 1);
  assert.equal(checkBlockedTerms('allowed.json', 'forbidden-vendor', cfg).length, 0);
});

test('no-cat: shell, workflow and npm scripts may not use cat', () => {
  assert.equal(checkNoCat('ci.yml', 'run: cat file.txt').length, 1);
  assert.equal(checkNoCat('run.sh', 'x && cat a | head').length, 1);
  assert.equal(checkNoCat('ci.yml', 'run: head -5 file.txt # category').length, 0);
  assert.equal(checkNoCat('package.json', JSON.stringify({ scripts: { a: 'cat x' } })).length, 1);
});

test('remote-html: remote scripts, frames and links are blocked', () => {
  assert.equal(checkHtml('index.html', '<script src="https://cdn.example.com/x.js"></script>').length, 1);
  assert.equal(checkHtml('index.html', '<link rel="icon" href="//evil.example/i.png">').length, 1);
  assert.equal(checkHtml('index.html', '<script type="module" src="/src/main.jsx"></script><link href="/icon.svg">').length, 0);
});

test('dangerous-js: eval-like calls always fail, HTML sinks only outside the allow-list', () => {
  assert.equal(checkDangerousJs('src/a.js', 'eval(code)', cfg).length, 1);
  assert.equal(checkDangerousJs('src/a.js', 'const f = new Function("a", body)', cfg).length, 1);
  assert.equal(checkDangerousJs('src/a.jsx', 'el.innerHTML = html', cfg).length, 1);
  assert.equal(checkDangerousJs('src/ok.jsx', 'el.innerHTML = html', cfg).length, 0);
  assert.equal(checkDangerousJs('src/a.js', 'const evaluate = 1; retrieval()', cfg).length, 0);
});

test('package-json: install-time scripts and non-registry dependencies fail', () => {
  assert.equal(checkPackageJson('package.json', JSON.stringify({ scripts: { postinstall: 'node x' } })).length, 1);
  assert.equal(checkPackageJson('package.json', JSON.stringify({ dependencies: { a: 'github:evil/a' } })).length, 1);
  assert.equal(checkPackageJson('package.json', JSON.stringify({ dependencies: { a: '^1.2.3', b: '~2.0.0' } })).length, 0);
});

test('lockfile-source: only the npm registry is allowed', () => {
  assert.equal(checkLockfile('package-lock.json', '"resolved": "https://evil.example/a.tgz"').length, 1);
  assert.equal(checkLockfile('package-lock.json', '"resolved": "https://registry.npmjs.org/a/-/a-1.0.0.tgz"').length, 0);
});

test('credential-files: env files and keys may not be committed', () => {
  for (const f of ['.env', '.env.local', 'config/id_rsa', 'certs/server.pem', 'a/b.key']) {
    assert.equal(checkSensitiveFileName(f).length, 1, f);
  }
  assert.equal(checkSensitiveFileName('.env.example').length, 0);
  assert.equal(checkSensitiveFileName('src/environment.js').length, 0);
});

test('workflows: permissions required, write access, pull_request_target and unknown actions fail', () => {
  const good = 'on: push\npermissions:\n  contents: read\njobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n';
  assert.equal(checkWorkflow('.github/workflows/a.yml', good, cfg).length, 0);
  assert.equal(checkWorkflow('.github/workflows/a.yml', good.replace('permissions:\n  contents: read\n', ''), cfg).length, 1);
  assert.equal(checkWorkflow('.github/workflows/a.yml', good.replace('contents: read', 'contents: write'), cfg).length, 1);
  assert.equal(checkWorkflow('.github/workflows/a.yml', good.replace('on: push', 'on: pull_request_target'), cfg).length, 1);
  assert.equal(checkWorkflow('.github/workflows/a.yml', good + '      - uses: someone/thing@v1\n', cfg).length, 1);
});

test('outside-hosts: only allow-listed hosts in app code', () => {
  assert.equal(checkHosts('src/a.js', 'fetch("https://example.com/x")', cfg).length, 0);
  assert.equal(checkHosts('src/a.js', 'fetch("https://collector.evil.example/x")', cfg).length, 1);
  assert.equal(checkHosts('docs/a.md', 'see https://anything.example', cfg).length, 0);
});

test('agent-settings: removing a required deny rule fails', () => {
  const full = JSON.stringify({ permissions: { deny: ['Bash(cat *)', 'WebFetch'] } });
  assert.equal(checkAgentSettings('.claude/settings.json', full, cfg).length, 0);
  const weakened = JSON.stringify({ permissions: { deny: ['WebFetch'] } });
  assert.equal(checkAgentSettings('.claude/settings.json', weakened, cfg).length, 1);
});

test('commit-identity: unknown authors and committers fail', () => {
  assert.equal(checkCommitIdentity(cfg, 'Owner', 'GitHub').length, 0);
  assert.equal(checkCommitIdentity(cfg, 'some-builder[bot]', 'some-builder[bot]').length, 2);
});

test('the repository itself passes every rule', () => {
  const { findings } = run();
  assert.deepEqual(findings, []);
});
