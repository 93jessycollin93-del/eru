#!/usr/bin/env node
// i18n lint check — fails if hardcoded user-visible strings exceed the
// allowlisted budget per file. Designed to PREVENT new translation
// regressions while letting existing legacy hardcoded strings stay.
//
// Usage: node scripts/lint-i18n.mjs
// Exit 0 = OK, exit 1 = budget exceeded somewhere.
//
// Budget file: scripts/i18n-budget.json
//   Shape: { "src/pages/Foo.jsx": 47, ... }
//   Each entry is the max allowed hardcoded-string count for that file.
//   When you wrap strings in t(), lower the budget. New files default to 0.
//
// Workflow:
//   1. Run `node scripts/audit-strings.mjs` to see current counts.
//   2. Lower a file's budget in scripts/i18n-budget.json as you translate.
//   3. CI / pre-push runs this script; PR fails if any file exceeds its
//      allowed count.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'src');
const BUDGET_PATH = path.resolve(process.cwd(), 'scripts/i18n-budget.json');

const SKIP_DIRS = new Set(['__tests__', '__mocks__', 'test', 'tests']);
const SKIP_FILES = new Set(['translations.json', 'utils.js', 'index.css']);

const VISIBLE_ATTRS = ['title', 'placeholder', 'aria-label', 'aria-description', 'alt', 'label', 'summary'];

function looksLikeText(s) {
  const t = s.trim();
  if (t.length <= 2) return false;
  if (/^-?\d+(\.\d+)?(px|rem|em|%|s|ms)?$/.test(t)) return false;
  if (/^#[0-9a-f]{3,8}$/i.test(t)) return false;
  if (/^https?:\/\//i.test(t)) return false;
  if (/^\//.test(t) && !t.includes(' ')) return false;
  if (/^[a-z_]+([._-][a-z0-9_-]+)+$/i.test(t) && !t.includes(' ')) return false;
  if (/^[A-Z_]+$/.test(t)) return false;
  if (/^[a-z]+([A-Z][a-z0-9]*)+$/.test(t) && !t.includes(' ')) return false;
  if (/^[a-z]+(-[a-z0-9]+)+$/.test(t) && !t.includes(' ')) return false;
  if (t.startsWith('{') || t.startsWith('[')) return false;
  if (!/[a-zA-Z]/.test(t)) return false;
  if (!/\s/.test(t) && t.length < 4) return false;
  return true;
}

function* walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      yield* walk(path.join(dir, ent.name));
    } else if (ent.isFile()) {
      if (SKIP_FILES.has(ent.name)) continue;
      if (/\.(jsx|js|tsx|ts)$/.test(ent.name)) yield path.join(dir, ent.name);
    }
  }
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');
}

function findHardcoded(src) {
  const found = [];
  const jsxRe = />([^<>{}\n][^<>{}]*)</g;
  let m;
  while ((m = jsxRe.exec(src)) !== null) {
    const txt = m[1].trim();
    if (txt.startsWith('{') && txt.endsWith('}')) continue;
    if (looksLikeText(txt)) found.push(txt);
  }
  for (const attr of VISIBLE_ATTRS) {
    for (const quote of ['"', "'"]) {
      const re = new RegExp(`\\b${attr}\\s*=\\s*${quote}([^${quote}]+)${quote}`, 'g');
      let am;
      while ((am = re.exec(src)) !== null) {
        const txt = am[1].trim();
        if (looksLikeText(txt)) found.push(`${attr}=${txt}`);
      }
    }
  }
  return found;
}

const budget = fs.existsSync(BUDGET_PATH)
  ? JSON.parse(fs.readFileSync(BUDGET_PATH, 'utf8'))
  : {};

let exitCode = 0;
const violations = [];
const surplus = [];

for (const file of walk(ROOT)) {
  const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
  const src = stripComments(fs.readFileSync(file, 'utf8'));
  const count = findHardcoded(src).length;
  const allowed = budget[rel] ?? 0;
  if (count > allowed) {
    violations.push({ rel, count, allowed, over: count - allowed });
  } else if (count < allowed) {
    surplus.push({ rel, count, allowed });
  }
}

if (violations.length > 0) {
  console.error('\n[i18n lint] FAIL — hardcoded-string budget exceeded:\n');
  for (const v of violations.sort((a, b) => b.over - a.over)) {
    console.error(`  +${v.over}   ${v.rel}   (${v.count} hardcoded, budget ${v.allowed})`);
  }
  console.error('\nFix by wrapping new strings in t(...), or — if the strings');
  console.error('are intentional and untranslatable — increase the budget for');
  console.error('that file in scripts/i18n-budget.json.\n');
  exitCode = 1;
}

if (surplus.length > 0) {
  console.log('\n[i18n lint] tip — these files have ROOM in their budget. If you');
  console.log('translated some strings, lower the budget in scripts/i18n-budget.json:\n');
  for (const s of surplus.slice(0, 10)) {
    console.log(`  -${s.allowed - s.count}   ${s.rel}   (${s.count} hardcoded, budget ${s.allowed})`);
  }
  if (surplus.length > 10) console.log(`  …and ${surplus.length - 10} more`);
}

if (exitCode === 0) {
  console.log('\n[i18n lint] OK — no file exceeds its hardcoded-string budget.');
}
process.exit(exitCode);
