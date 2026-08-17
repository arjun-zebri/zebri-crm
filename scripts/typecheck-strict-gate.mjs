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

// Baseline 324 reconciled in Automations A1 (commit 6befe87 line).
// The previous floor of 277 (set in Phase 6) drifted out of sync
// with reality when commit ee7ef8c (Automations: expand trigger +
// action catalogue, UI-only) introduced ~47 new strict errors
// without ratcheting the budget — and CI didn't catch it because
// either the gate wasn't run on that push or the failure was
// merged through. This PR re-anchors the budget at the actual
// post-ee7ef8c count so future drift is caught at the source.
// History before drift:
// 277 (Phase 6, -2 from cleanup in use-task-groups.ts +
// tasks/page.tsx as inline supabase boilerplate moved into the
// new tasks/actions.ts which is strict-clean by design). Previous:
// 279 (Phase 4C), 280 (Phase 4B), 281 (Phase 4A), 285 (Phase 3.2),
// 286 (Phase 2D.2), 288 (Phase 2C.2), 293 (Phase 2C), 294 (Phase
// 2A), 295 (Phase 0.2b).
// Burn-down target: reach 277 again by ratcheting future
// page-hardening PRs down. Only ever decrease.
// A1 staging merge: 324 → 323 (one strict error removed via the
// auto-fix sweep inside the admin redesign commits that came in
// with the staging merge into this PR). Locking the gain in.
// Timeline internal flag + multi-day portals: 323 → 315 (deleted the
// dead run-sheet-section.tsx, which carried several strict errors;
// new portal/vendor day-selector code is strict-clean). Locking in.
// Quote/invoice templates hardening: 315 → 305 (shared manager + store
// replaced both legacy managers; widened optional prop types on the
// templates/payments surfaces for exactOptionalPropertyTypes; all new
// template code is strict-clean). Locking in.
// Quotes removal: 305 → 302 (deleted quote builder, public quote page and
// quote automations carried strict errors). Locking in.
// Branding editor redesign: net strict-clean new code + deletions (starter
// designs, dead theme paths) reduced strict errors 302 -> 295.
// Branding overhaul phase-a completion: fixed exactOptionalPropertyTypes
// violations in block-toolbar.tsx and render.tsx by conditionally spreading
// optional props instead of passing undefined (20-error reduction: 295 -> 290).
// Branding role-colour model removed 2 further strict errors (290 -> 288).
// Contract surface global styles: retiring the optional `headingStack` prop
// removed its exactOptionalPropertyTypes violation (288 -> 287).
// Extracting the branding onboarding gate into lib/branding/onboarding-gate.ts
// resolved two more inference sites on the branding page (287 -> 285).
// Welcome onboarding wizard: extracted usePreviewScript, useReducedMotion, and
// preview shape utilities into pure modules (286 -> 286). Locking in at 286.
// Single/multi-package + branding batch drifted the count up to 297
// (new surfaces passed `undefined` into optional props, plus grandfathered
// noUncheckedIndexedAccess in contrast/extract-colors). Fixed by widening the
// action-slot optional prop types to `| undefined` and guarding the pure
// colour helpers (297 -> 281).
// Invoice-modal GST-inclusive + skeleton batch: moving useCurrentBranding onto
// React Query dropped three `useState` inference sites (281 -> 278). Locking in
// at 278.
// Feature removal (2026-07-31): deleting the retired offer-document surface,
// builders, and email cleared five strict-error sites (278 -> 273). Locking in.
// Retiring the booking_cancelled trigger removed its Zod spec, and with
// it one exactOptionalPropertyTypes site (273 -> 272). The full trigger
// sweep then replaced seven more hand-written spec config types with
// z.infer-derived ones (272 -> 265), and the action-picker
// condensation cleared one more (265 -> 264). Moving the send_email
// config out of the card and into the composer modal cleared two more
// (264 -> 262). Locking in.
const STRICT_BUDGET = 262;

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
