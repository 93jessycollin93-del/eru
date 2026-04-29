#!/usr/bin/env node
// Seed scripts/i18n-budget.json from the current audit. Run once after
// adoption; afterward, lower budgets manually as you wrap strings in t().
//
// Usage: node scripts/seed-i18n-budget.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'src');
const OUT = path.resolve(process.cwd(), 'scripts/i18n-budget.json');

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

const budget = {};
for (const file of walk(ROOT)) {
  const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
  const src = stripComments(fs.readFileSync(file, 'utf8'));
  const count = findHardcoded(src).length;
  if (count > 0) budget[rel] = count;
}

fs.writeFileSync(OUT, JSON.stringify(budget, Object.keys(budget).sort(), 2) + '\n');
console.log(`Seeded ${Object.keys(budget).length} files into ${path.relative(process.cwd(), OUT)}`);
console.log(`Total hardcoded strings: ${Object.values(budget).reduce((a, b) => a + b, 0)}`);
