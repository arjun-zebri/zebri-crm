#!/usr/bin/env node
/**
 * Strict-mode typecheck ratchet gate (Phase 0.7 fix).
 *
 * `tsc -p tsconfig.strict.json` exits non-zero on ANY error, but we
 * have ~295 grandfathered `noUncheckedIndexedAccess` /
 * `exactOptionalPropertyTypes` violations to burn down per-page (see
 * roadmap §0.2). This gate counts strict errors and fails only if
 * the count exceeds the budget. Same proven pattern as
 * `scripts/lint-gate.mjs`.
 *
 * Usage: `npm run typecheck:strict:gate` (used by CI).
 * `npm run typecheck:strict` stays as the raw reporter for dev.
 */
import { execSync } from 'node:child_process';

// Baseline 285 set in Phase 3.2 (-1 after the public-contract
// page decomposition replaced one big strict-leaky file with
// token-clean components). Previous: 286 (Phase 2D.2), 288
// (Phase 2C.2), 293 (Phase 2C), 294 (Phase 2A), 295 (Phase 0.2b
// — initial baseline when typed clients exposed strict sites
// `any` had masked).
// Only ever decrease.
const STRICT_BUDGET = 285;

function runTscStrict() {
  try {
    return execSync('npx tsc -p tsconfig.strict.json --noEmit', {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (e) {
    // tsc exits non-zero when errors exist — the output is still on stdout.
    if (e.stdout) return e.stdout;
    if (e.stderr) return e.stderr;
    throw e;
  }
}

const out = runTscStrict();
const errors = (out.match(/error TS\d+/g) ?? []).length;

const ok = errors <= STRICT_BUDGET;
console.log(`strict typecheck ratchet — errors ${errors}/${STRICT_BUDGET} ${ok ? 'OK' : 'EXCEEDED'}`);

if (!ok) {
  console.error(
    '\nStrict typecheck budget exceeded. New code must be strict-clean ' +
      '(noUncheckedIndexedAccess + exactOptionalPropertyTypes); do not raise ' +
      'the budget. Fix the new violations, or if you legitimately reduced ' +
      'others ratchet the budget DOWN in scripts/typecheck-strict-gate.mjs.',
  );
  process.exit(1);
}

if (errors < STRICT_BUDGET) {
  console.log(
    `Budget has ${STRICT_BUDGET - errors} slack — ratchet the baseline DOWN to lock it in.`,
  );
}
