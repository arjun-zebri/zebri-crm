#!/usr/bin/env node
/**
 * Lint ratchet gate (Phase 0.4).
 *
 * The legacy ESLint violation set is large and ~91 errors are behavioural
 * (react-hooks strict) or typing debt (`any`) in feature code — fixed
 * per-page during hardening, not in a risky big-bang. This gate enforces a
 * **monotonically-decreasing budget**: lint counts must never exceed the
 * baseline below. Same proven pattern as `typecheck:strict`.
 *
 * When a page is hardened and violations drop, RATCHET THESE DOWN to the new
 * numbers so the gain is locked in. Errors must reach 0 first, then warnings.
 *
 * Usage: `npm run lint:gate` (used by CI in Phase 0.7).
 */
import { execSync } from 'node:child_process';

// Baseline captured 2026-05-20 (Phase 0.4); warnings re-baselined in 0.5
// after the off-token-colour rule landed (876 → 884, +8 surfaced sites);
// 0.5b autofixed one import-order in app/layout.tsx (884 → 883).
// Only ever decrease these.
const ERROR_BUDGET = 91;
const WARNING_BUDGET = 883;

function runEslintJson() {
  try {
    return execSync('npx eslint . --format json', {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (e) {
    // ESLint exits non-zero when violations exist — the JSON is still on stdout.
    if (e.stdout) return e.stdout;
    throw e;
  }
}

const results = JSON.parse(runEslintJson());
let errors = 0;
let warnings = 0;
for (const f of results) {
  errors += f.errorCount;
  warnings += f.warningCount;
}

const errOk = errors <= ERROR_BUDGET;
const warnOk = warnings <= WARNING_BUDGET;

console.log(
  `lint ratchet — errors ${errors}/${ERROR_BUDGET} ${errOk ? 'OK' : 'EXCEEDED'} · ` +
    `warnings ${warnings}/${WARNING_BUDGET} ${warnOk ? 'OK' : 'EXCEEDED'}`,
);

if (!errOk || !warnOk) {
  console.error(
    '\nLint budget exceeded. New code must be clean; do not raise the budget. ' +
      'Fix the new violations (or, if you legitimately reduced others, ratchet ' +
      'the budget DOWN in scripts/lint-gate.mjs).',
  );
  process.exit(1);
}

if (errors < ERROR_BUDGET || warnings < WARNING_BUDGET) {
  console.log(
    `Budget has slack (errors ${ERROR_BUDGET - errors} under, warnings ` +
      `${WARNING_BUDGET - warnings} under) — ratchet the baseline DOWN to lock it in.`,
  );
}
