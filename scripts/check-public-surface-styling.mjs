#!/usr/bin/env node
/**
 * Public surface styling gate (Task 16: branding hardening).
 *
 * The public surfaces (invoices, contracts, proposals, questionnaires, portal)
 * must inherit typography and colors from the MC's global branding instead of
 * hardcoded Tailwind classes. This gate prevents new hardcoded styling from
 * leaking back in.
 *
 * Scans: lib/branding/public-blocks, components/proposal, components/questionnaires,
 * app/proposal, app/invoice, app/contract, app/portal, app/questionnaire.
 *
 * Exemptions (declared inline with why-comments):
 * - Files matching *-loading.tsx and *-unavailable.tsx (render before branding RPC resolves)
 * - Inline unavailable states in portal page.tsx (marked with // gate-allow: pre-branding state)
 * - App-chrome tokens on portal interactive controls ONLY: <button>, <input>, <select>, <textarea>,
 *   elements with onClick/onChange/cursor-pointer/role="button" (app-chrome is UI furniture on controls,
 *   not document content; portal document text must use branding colors)
 *
 * Usage: npm run check:public-styling
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOTS = [
  'lib/branding/public-blocks',
  'components/proposal',
  'components/questionnaires',
  'app/proposal',
  'app/invoice',
  'app/contract',
  'app/portal',
  'app/questionnaire',
];

const EXTS = new Set(['.ts', '.tsx', '.mts', '.mjs', '.js']);

/**
 * Patterns flagged as hardcoded styling violations.
 * Each entry: { name, regex, reason }
 */
const PATTERNS = [
  // Raw colours.
  { name: 'text-gray-*', regex: /\btext-gray-\d+\b/, reason: 'hardcoded grey text; use semantic text tokens' },
  { name: 'bg-gray-*', regex: /\bbg-gray-\d+\b/, reason: 'hardcoded grey background; use semantic bg tokens' },
  { name: 'border-gray-*', regex: /\bborder-gray-\d+\b/, reason: 'hardcoded grey border; use semantic border tokens' },
  { name: 'bg-white', regex: /\bbg-white\b/, reason: 'hardcoded white; use semantic bg tokens' },
  { name: 'bg-black', regex: /\bbg-black\b/, reason: 'hardcoded black; use semantic bg tokens' },

  // Status tokens (including opacity variants).
  { name: 'text-success*', regex: /\btext-(success|danger|warning)(?:\/\d+)?\b/, reason: 'status tokens must use lib/branding/status-colors' },
  { name: 'bg-success*', regex: /\bbg-(success|danger|warning)(?:\/\d+)?\b/, reason: 'status tokens must use lib/branding/status-colors' },
  { name: 'border-success*', regex: /\bborder-(success|danger|warning)(?:\/\d+)?\b/, reason: 'status tokens must use lib/branding/status-colors' },

  // Bare Tailwind text size utilities on document text (not allowed on any public surface).
  // These must be replaced with fontSize from roleDefaults(branding, role).
  { name: 'text-xs', regex: /\btext-xs\b/, reason: 'bare size class; use roleDefaults() typography' },
  { name: 'text-sm', regex: /\btext-sm\b/, reason: 'bare size class; use roleDefaults() typography' },
  { name: 'text-base', regex: /\btext-base\b/, reason: 'bare size class; use roleDefaults() typography' },
  { name: 'text-lg', regex: /\btext-lg\b/, reason: 'bare size class; use roleDefaults() typography' },
  { name: 'text-xl', regex: /\btext-xl\b/, reason: 'bare size class; use roleDefaults() typography' },
  { name: 'text-2xl', regex: /\btext-2xl\b/, reason: 'bare size class; use roleDefaults() typography' },
  { name: 'text-3xl', regex: /\btext-3xl\b/, reason: 'bare size class; use roleDefaults() typography' },

  // App-chrome semantic tokens on document surfaces (not portal).
  // Portal is exempted for interactive controls; these patterns catch document surfaces.
  { name: 'border-border', regex: /\bborder-border\b/, reason: 'app-chrome token on document surface; use branding.border_color' },
  { name: 'bg-surface-muted', regex: /\bbg-surface-muted\b/, reason: 'app-chrome token on document surface; use semantic branding tokens' },
  { name: 'text-text-muted', regex: /\btext-text-muted\b/, reason: 'app-chrome token on document surface; use semantic branding tokens' },
  { name: 'text-text-subtle', regex: /\btext-text-subtle\b/, reason: 'app-chrome token on document surface; use semantic branding tokens' },
  { name: 'border-border-strong', regex: /\bborder-border-strong\b/, reason: 'app-chrome token on document surface; use branding.border_color' },
  { name: 'bg-surface', regex: /\bbg-surface\b/, reason: 'app-chrome token on document surface; use semantic branding tokens' },
  { name: 'text-text', regex: /\btext-text\b/, reason: 'app-chrome token on document surface; use semantic branding tokens' },

  // Invalid CSS: rgba() with a hex literal or color variable directly inside (browsers silently drop this).
  // The correct pattern is rgba(r, g, b, a) where RGB are separate numbers. Hex values or
  // color variables must be decomposed via getRgb().
  { name: 'rgba(hex)', regex: /rgba\(\s*#/, reason: 'invalid CSS: rgba() with hex literal inside; use getRgb() to decompose the color' },
];

/**
 * Walk a directory tree and collect all files matching EXTS.
 */
function walk(dir, out = []) {
  try {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const p = join(dir, name);
      const s = statSync(p);
      if (s.isDirectory()) walk(p, out);
      else if (EXTS.has(extname(name))) out.push(p);
    }
  } catch {
    // Directory doesn't exist or is unreadable; skip.
  }
  return out;
}

/**
 * Parse a file line by line and return {lineNum, text} for each line.
 */
function getLines(src) {
  return src.split('\n').map((text, i) => ({ lineNum: i + 1, text }));
}

/**
 * Checks if a file is exempt from the gate.
 */
function isExemptFile(filePath) {
  // Pre-branding state files are fully exempt.
  if (/(-loading|-unavailable)\.tsx?$/.test(filePath)) {
    return true;
  }
  return false;
}

/**
 * Check if a line is marked with the inline exemption comment.
 * Supports both JS comments (//) and JSX comments (with slash-star).
 */
function hasInlineExemption(line) {
  return /(\/\/\s*gate-allow|\/\*\s*gate-allow).*pre-branding\s+state/.test(line);
}

/**
 * Check if a line in a portal file is part of an interactive control.
 * Looks at the line and surrounding context (±5 lines) for interactive signals:
 * cursor-pointer, <button, <input, <select, <textarea, onClick, onChange, role="button".
 * This handles className strings spanning multiple lines and various JSX structures.
 */
function isPortalInteractiveControl(lines, lineNum) {
  const windowStart = Math.max(0, lineNum - 6);
  const windowEnd = Math.min(lines.length, lineNum + 5);
  const window = lines.slice(windowStart, windowEnd).map(l => l.text).join('\n');

  const interactiveSignals = [
    /cursor-pointer/,
    /<button/,
    /<input/,
    /<select/,
    /<textarea/,
    /onClick/,
    /onChange/,
    /role=["']button["']/,
  ];

  return interactiveSignals.some(sig => sig.test(window));
}

/**
 * Find all violations in a file, respecting exemptions.
 */
function findViolations(filePath, src) {
  const violations = [];
  const lines = getLines(src);
  // Portal files are exempted for app-chrome tokens on interactive controls only.
  // Paths are relative from repo root (e.g. app/portal/[token]/page.tsx).
  const isPortalFile = filePath.startsWith('app/portal/');

  // Check if this is an inline-exemption file (portal page.tsx files).
  // Paths are relative from repo root (e.g. app/portal/[token]/page.tsx).
  const hasInlineExemptionPossibility = /app\/portal\/\[token\]\/(page|vendor\/page)\.tsx$/.test(filePath);

  for (const { lineNum, text } of lines) {
    // Skip lines already marked with inline exemption.
    if (hasInlineExemptionPossibility && hasInlineExemption(text)) {
      continue;
    }

    for (const pattern of PATTERNS) {
      if (!pattern.regex.test(text)) continue;

      // Portal exemption: allow app-chrome tokens ONLY on portal interactive controls.
      // Interactive controls are detected by interactive signals in surrounding context.
      if (isPortalFile && [
        'border-border',
        'bg-surface-muted',
        'text-text-muted',
        'text-text-subtle',
        'border-border-strong',
        'bg-surface',
        'text-text',
      ].includes(pattern.name)) {
        // This is a portal file and the pattern is an app-chrome token.
        // Only allow it if the line is part of an interactive control.
        if (isPortalInteractiveControl(lines, lineNum - 1)) {
          continue;
        }
      }

      violations.push({
        file: filePath,
        lineNum,
        pattern: pattern.name,
        reason: pattern.reason,
        text: text.trim(),
      });
    }
  }

  return violations;
}

// Main: walk and collect violations.
const allViolations = [];

for (const root of ROOTS) {
  const files = walk(root);
  for (const f of files) {
    if (isExemptFile(f)) continue;
    const src = readFileSync(f, 'utf8');
    const violations = findViolations(f, src);
    allViolations.push(...violations);
  }
}

// Report.
if (allViolations.length === 0) {
  console.log('public surface styling gate — OK (no hardcoded styling found)');
  process.exit(0);
}

console.error('public surface styling gate — FAIL');
console.error('');
console.error('The following violations found. Public surfaces must inherit colors and typography from branding.');
console.error('Fix by using: roleDefaults(), STATUS_COLORS, branding.border_color, branding.corner_radius, getRgb().');
console.error('See lib/branding for the full toolkit.');
console.error('');

const byFile = {};
for (const v of allViolations) {
  if (!byFile[v.file]) byFile[v.file] = [];
  byFile[v.file].push(v);
}

for (const [file, vv] of Object.entries(byFile)) {
  console.error(`${file}:`);
  for (const v of vv) {
    console.error(`  line ${v.lineNum}  ${v.pattern}  (${v.reason})`);
    console.error(`    ${v.text}`);
  }
  console.error('');
}

process.exit(1);
