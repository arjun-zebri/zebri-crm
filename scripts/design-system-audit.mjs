#!/usr/bin/env node
/**
 * Design-system audit scanner.
 *
 * Walks `app/` and `components/` and counts the design-system
 * divergences that the /design-system showroom reports on: radius
 * utilities, raw Tailwind palette colours, native form controls,
 * typography classes, Lucide stroke widths and card padding.
 *
 * Output is written to `app/design-system/audit-data.json`, which the
 * showroom reads at build time. Re-run it whenever you want the page to
 * reflect today's reality:
 *
 * ```sh
 * node scripts/design-system-audit.mjs
 * ```
 *
 * The showroom's own source is excluded from every count. It is full of
 * deliberate demo markup (every radius, every raw control) and would
 * otherwise inflate the very numbers it is reporting.
 *
 * @module scripts/design-system-audit
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['app', 'components'];
const EXCLUDE_DIRS = new Set(['node_modules', '.next', 'design-system']);
const OUT = join(ROOT, 'app', 'design-system', 'audit-data.json');

/** Recursively collect every `.tsx` file under `dir`, skipping excludes. */
function collect(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!EXCLUDE_DIRS.has(name)) collect(full, acc);
    } else if (name.endsWith('.tsx')) {
      acc.push(full);
    }
  }
  return acc;
}

const FILES = SCAN_DIRS.flatMap((d) => collect(join(ROOT, d)));
const SOURCES = FILES.map((f) => ({
  path: relative(ROOT, f).split(sep).join('/'),
  text: readFileSync(f, 'utf8'),
}));

/**
 * Count matches of `pattern` across every scanned file.
 *
 * @returns `{ count, files }` where `files` is up to three example paths,
 *   ordered by how many times the pattern appears in each. Showing the
 *   heaviest offenders first makes the examples actionable rather than
 *   alphabetical trivia.
 */
function tally(pattern) {
  let count = 0;
  const perFile = [];
  for (const { path, text } of SOURCES) {
    const hits = text.match(new RegExp(pattern, 'g'));
    if (!hits) continue;
    count += hits.length;
    perFile.push({ path, hits: hits.length });
  }
  perFile.sort((a, b) => b.hits - a.hits);
  return { count, files: perFile.slice(0, 3) };
}

/** Build one audit group: a set of competing variants with counts. */
function group(id, title, note, variants) {
  const entries = variants.map(({ label, pattern, verdict }) => ({
    label,
    verdict,
    ...tally(pattern),
  }));
  return { id, title, note, entries };
}

const PALETTE_HUES = [
  'gray', 'slate', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber',
  'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue',
  'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
].join('|');
const PALETTE_RE = `(?:bg|text|border|ring|from|to|via|divide|accent)-(?:${PALETTE_HUES})-[0-9]{2,3}`;

/** Top raw-palette utilities by usage, for the colour conflict table. */
function topPaletteClasses(limit = 12) {
  const counts = new Map();
  for (const { text } of SOURCES) {
    for (const hit of text.match(new RegExp(PALETTE_RE, 'g')) ?? []) {
      counts.set(hit, (counts.get(hit) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

const audit = {
  scannedFiles: SOURCES.length,
  topPaletteClasses: topPaletteClasses(),
  groups: [
    group('radius', 'Corner radius', 'Three token radii exist. The app mostly ignores them.', [
      { label: 'rounded-control', pattern: 'rounded-control\\b', verdict: 'token' },
      { label: 'rounded-card', pattern: 'rounded-card\\b', verdict: 'token' },
      { label: 'rounded-pill', pattern: 'rounded-pill\\b', verdict: 'token' },
      { label: 'rounded-xl', pattern: 'rounded-xl\\b', verdict: 'legacy' },
      { label: 'rounded-md', pattern: 'rounded-md\\b', verdict: 'legacy' },
      { label: 'rounded-full', pattern: 'rounded-full\\b', verdict: 'legacy' },
      { label: 'rounded-lg', pattern: 'rounded-lg\\b', verdict: 'legacy' },
      { label: 'rounded-2xl', pattern: 'rounded-2xl\\b', verdict: 'legacy' },
      { label: 'rounded-sm', pattern: 'rounded-sm\\b', verdict: 'legacy' },
    ]),
    group('colour', 'Colour', 'Semantic tokens vs the raw Tailwind palette.', [
      { label: 'text-text*', pattern: 'text-text(?:-(?:muted|subtle|inverse))?\\b', verdict: 'token' },
      { label: 'bg-surface*', pattern: 'bg-surface(?:-(?:muted|emphasis))?\\b', verdict: 'token' },
      { label: 'border-border*', pattern: 'border-border(?:-strong)?\\b', verdict: 'token' },
      { label: 'raw palette', pattern: PALETTE_RE, verdict: 'legacy' },
    ]),
    group('controls', 'Form controls', 'The design system forbids native controls. ESLint warns; the app still ships them.', [
      { label: '<Button>', pattern: '<Button[\\s/>]', verdict: 'token' },
      { label: '<Input>', pattern: '<Input[\\s/>]', verdict: 'token' },
      { label: '<Select>', pattern: '<Select[\\s/>]', verdict: 'token' },
      { label: 'native <button>', pattern: '<button[\\s>]', verdict: 'legacy' },
      { label: 'native <input>', pattern: '<input[\\s>]', verdict: 'legacy' },
      { label: 'native <select>', pattern: '<select[\\s>]', verdict: 'legacy' },
    ]),
    group('typography', 'Typography', 'Semantic type tokens vs the raw Tailwind scale.', [
      { label: 'text-display', pattern: 'text-display\\b', verdict: 'token' },
      { label: 'text-section', pattern: 'text-section\\b', verdict: 'token' },
      { label: 'text-body', pattern: 'text-body\\b', verdict: 'token' },
      { label: 'text-caption', pattern: 'text-caption\\b', verdict: 'token' },
      { label: 'text-3xl', pattern: 'text-3xl\\b', verdict: 'legacy' },
      { label: 'text-2xl', pattern: 'text-2xl\\b', verdict: 'legacy' },
      { label: 'text-xl', pattern: 'text-xl\\b', verdict: 'legacy' },
      { label: 'text-lg', pattern: 'text-lg\\b', verdict: 'legacy' },
      { label: 'text-base', pattern: 'text-base\\b', verdict: 'legacy' },
      { label: 'text-sm', pattern: 'text-sm\\b', verdict: 'legacy' },
      { label: 'text-xs', pattern: 'text-xs\\b', verdict: 'legacy' },
    ]),
    group('icons', 'Icon stroke width', 'CLAUDE.md mandates strokeWidth={1.5} on every Lucide icon.', [
      { label: '1.5', pattern: 'strokeWidth=\\{1\\.5\\}', verdict: 'token' },
      { label: '2', pattern: 'strokeWidth=\\{2\\}', verdict: 'legacy' },
      { label: '1.75', pattern: 'strokeWidth=\\{1\\.75\\}', verdict: 'legacy' },
      { label: '2.5', pattern: 'strokeWidth=\\{2\\.5\\}', verdict: 'legacy' },
      { label: '1.25', pattern: 'strokeWidth=\\{1\\.25\\}', verdict: 'legacy' },
      { label: '3', pattern: 'strokeWidth=\\{3\\}', verdict: 'legacy' },
      { label: '1', pattern: 'strokeWidth=\\{1\\}', verdict: 'legacy' },
    ]),
    group('padding', 'Container padding', 'Padding on rounded containers. No canonical card padding exists.', [
      { label: 'p-2', pattern: 'rounded-(?:xl|lg|card|2xl)[^"\']*\\bp-2\\b', verdict: 'legacy' },
      { label: 'p-3', pattern: 'rounded-(?:xl|lg|card|2xl)[^"\']*\\bp-3\\b', verdict: 'legacy' },
      { label: 'p-4', pattern: 'rounded-(?:xl|lg|card|2xl)[^"\']*\\bp-4\\b', verdict: 'legacy' },
      { label: 'p-5', pattern: 'rounded-(?:xl|lg|card|2xl)[^"\']*\\bp-5\\b', verdict: 'legacy' },
      { label: 'p-6', pattern: 'rounded-(?:xl|lg|card|2xl)[^"\']*\\bp-6\\b', verdict: 'legacy' },
      { label: 'p-8', pattern: 'rounded-(?:xl|lg|card|2xl)[^"\']*\\bp-8\\b', verdict: 'legacy' },
    ]),
  ],
};

writeFileSync(OUT, `${JSON.stringify(audit, null, 2)}\n`);
console.log(`Scanned ${SOURCES.length} .tsx files.`);
for (const g of audit.groups) {
  const legacy = g.entries.filter((e) => e.verdict === 'legacy').reduce((n, e) => n + e.count, 0);
  const token = g.entries.filter((e) => e.verdict === 'token').reduce((n, e) => n + e.count, 0);
  console.log(`  ${g.id.padEnd(12)} token ${String(token).padStart(5)}   legacy ${String(legacy).padStart(5)}`);
}
console.log(`Wrote ${relative(ROOT, OUT)}`);
