#!/usr/bin/env node
// Walks every .jsx/.js under src/ and counts hardcoded user-visible strings
// that are NOT going through the t() translation function. The output is a
// CSV (per-file counts) and a summary so we can plan i18n rollout.
//
// Usage: node scripts/audit-strings.mjs
//
// Heuristics — designed to err on the side of overcounting rather than
// undercounting (a real human/LLM pass will filter false positives):
//
//   - JSX text content between tags: >Some Text<
//   - User-visible attributes: title, placeholder, aria-label, aria-description,
//     alt, label, summary
//   - String values passed to <Toast>, toast.success/error/warning, console-
//     style helpers are NOT counted (those are usually dev-facing).
//
// Filters out:
//   - Strings that are <= 2 chars or look like tokens (numbers, hex, URLs,
//     CSS class fragments, snake_case keys, file paths)
//   - Strings inside className / id / key / type / data-* / role / href / src
//   - Strings already wrapped in t(...) — best-effort by line check
//   - JSX children that are comments or whitespace
//
// Out: scripts/string-audit.csv  +  printed summary to stdout.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'src');
const OUT = path.resolve(process.cwd(), 'scripts/string-audit.csv');

const SKIP_DIRS = new Set(['__tests__', '__mocks__', 'test', 'tests']);
const SKIP_FILES = new Set([
  'translations.json',
  'utils.js',
  'index.css',
]);

const VISIBLE_ATTRS = [
  'title',
  'placeholder',
  'aria-label',
  'aria-description',
  'alt',
  'label',
  'summary',
];

const NON_TEXT_ATTRS = new Set([
  'className',
  'id',
  'key',
  'type',
  'role',
  'href',
  'src',
  'data-testid',
  'name',
  'value',
  'autocomplete',
  'autoComplete',
]);

function looksLikeText(s) {
  const t = s.trim();
  if (t.length <= 2) return false;
  // numbers / hex / units
  if (/^-?\d+(\.\d+)?(px|rem|em|%|s|ms)?$/.test(t)) return false;
  if (/^#[0-9a-f]{3,8}$/i.test(t)) return false;
  // urls / paths / keys
  if (/^https?:\/\//i.test(t)) return false;
  if (/^\//.test(t) && !t.includes(' ')) return false; // route paths
  if (/^[a-z_]+([._-][a-z0-9_-]+)+$/i.test(t) && !t.includes(' ')) return false; // snake/dot keys
  if (/^[A-Z_]+$/.test(t)) return false; // UPPER_CASE constants
  if (/^[a-z]+([A-Z][a-z0-9]*)+$/.test(t) && !t.includes(' ')) return false; // camelCase ids
  // class fragments (Tailwind)
  if (/^[a-z]+(-[a-z0-9]+)+$/.test(t) && !t.includes(' ')) return false;
  // looks like JSON / JS code
  if (t.startsWith('{') || t.startsWith('[')) return false;
  // single tokens or symbols
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
      if (/\.(jsx|js|tsx|ts)$/.test(ent.name)) {
        yield path.join(dir, ent.name);
      }
    }
  }
}

// Strip JS/JSX/HTML comments naively to reduce noise.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');
}

// Find JSX text content: characters between > and < that aren't inside a tag.
// We do this by stripping tags, then splitting on tag boundaries.
function findJsxText(src) {
  const found = [];
  // Match >TEXT< where TEXT contains no < or { (avoids capturing JSX expressions).
  const re = />([^<>{}\n][^<>{}]*)</g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const txt = m[1].trim();
    if (!txt) continue;
    if (txt.startsWith('{') && txt.endsWith('}')) continue;
    if (looksLikeText(txt)) found.push(txt);
  }
  return found;
}

// Find user-visible string-literal attributes.
function findVisibleAttrs(src) {
  const found = [];
  for (const attr of VISIBLE_ATTRS) {
    const re = new RegExp(`\\b${attr}\\s*=\\s*"([^"]+)"`, 'g');
    let m;
    while ((m = re.exec(src)) !== null) {
      const txt = m[1].trim();
      if (looksLikeText(txt)) found.push(`${attr}=${txt}`);
    }
    const re2 = new RegExp(`\\b${attr}\\s*=\\s*'([^']+)'`, 'g');
    while ((m = re2.exec(src)) !== null) {
      const txt = m[1].trim();
      if (looksLikeText(txt)) found.push(`${attr}=${txt}`);
    }
  }
  return found;
}

// Detect lines that already use t('...') — for reporting coverage.
// Matches both t('foo') and t('foo', anything...) so we count Base44's
// extended signature t('key', undefined, 'fallback') correctly.
function countTCalls(src) {
  return (src.match(/\bt\(\s*['"][^'"]+['"]/g) || []).length;
}

const perFile = [];
let grandTotal = 0;
let totalT = 0;

for (const file of walk(ROOT)) {
  const src = stripComments(fs.readFileSync(file, 'utf8'));
  const jsx = findJsxText(src);
  const attrs = findVisibleAttrs(src);
  const tcalls = countTCalls(src);
  const total = jsx.length + attrs.length;
  if (total === 0 && tcalls === 0) continue;
  perFile.push({
    file: path.relative(ROOT, file),
    jsx: jsx.length,
    attrs: attrs.length,
    total,
    t_calls: tcalls,
  });
  grandTotal += total;
  totalT += tcalls;
}

perFile.sort((a, b) => b.total - a.total);

const csv = [
  'file,jsx_strings,attr_strings,total_hardcoded,t_calls',
  ...perFile.map((r) => `${r.file},${r.jsx},${r.attrs},${r.total},${r.t_calls}`),
].join('\n');
fs.writeFileSync(OUT, csv);

console.log(`\n=== ERU i18n string audit ===\n`);
console.log(`scanned ${perFile.length} files under src/`);
console.log(`hardcoded user-visible strings:  ${grandTotal.toLocaleString()}`);
console.log(`existing t() calls:               ${totalT.toLocaleString()}`);
console.log(`current coverage:                 ${(totalT / (totalT + grandTotal) * 100).toFixed(1)}% of visible strings flow through t()\n`);

console.log(`top 20 files by hardcoded-string count:`);
for (const r of perFile.slice(0, 20)) {
  console.log(`  ${String(r.total).padStart(5)}  ${r.file}`);
}

console.log(`\nbottom: ${perFile.length - 20} more files in scripts/string-audit.csv`);
console.log(`\ntotal translation work to fully cover Eru in 3 new languages:`);
const baseStrings = grandTotal + totalT;
console.log(`  base catalog size:     ~${baseStrings.toLocaleString()} unique English strings (rough — duplicates not yet deduped)`);
console.log(`  uk + zh + ru combined: ~${(baseStrings * 3).toLocaleString()} translated strings`);
