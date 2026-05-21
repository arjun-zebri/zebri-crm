---
description: Enforce the full per-page Definition of Done before merging a hardening PR.
---

@.claude/docs/production-readiness.md
@.claude/docs/security.md
@.claude/docs/frontend-design.md
@.claude/docs/component-library.md
@.claude/docs/database-schema.md
@.claude/docs/testing.md

Run a complete pre-merge review of the current branch against the
**§5 Definition of Done** (production-readiness roadmap). For each
checklist item below, verify and report **pass / fail / N/A** with a
file:line reference where relevant.

Do not relax any item. If something fails, flag it; do not auto-fix
unless explicitly asked. The point of `/ship-check` is to catch.

## Types

- [ ] `npm run typecheck` exits 0.
- [ ] `npm run typecheck:strict` does not exceed the ratchet budget
      (`scripts/typecheck-strict-gate.mjs`). New code is clean under
      strict.
- [ ] No `any` introduced. (`grep -rn ': any' app/ lib/ components/` —
      report any new sites in changed files.)
- [ ] Uses generated `Database` types where it touches Supabase.

## Comments

- [ ] **Every exported function / type / module has a TSDoc block**
      (the project-wide standard — see `CONTRIBUTING.md`).
- [ ] Why-comments on any non-obvious logic (the comment explains
      the why; the code explains the what).

## Tests

- [ ] Unit tests added/updated for new logic. `npm run test:unit`
      green.
- [ ] Integration tests added for any owned table the change
      touches. `npm run test:integration` green (requires local
      Supabase running).
- [ ] **Cross-tenant RLS denial test** present for every owned
      table the change touches. Mirror
      `tests/integration/rls/couples.test.ts`. Tick the matrix in
      `.claude/docs/security.md`.
- [ ] E2E covers the golden path + at least one edge case.
      `npx playwright test` green on Pixel 5 + iPhone 12 + desktop.

## Design system

- [ ] No `bg-[#…]`, `text-[#…]`, `border-[#…]`, etc. (off-token).
- [ ] No inline `style={{}}`.
- [ ] No native `<button>`, `<select>`, `<input>` — uses
      `components/ui/*` primitives.
- [ ] No `rounded-full` on text buttons (`rounded-xl` standard).
- [ ] All `lucide-react` icons have `strokeWidth={1.5}`.
- [ ] Page title: `text-3xl font-semibold`. Section title:
      `text-xl font-semibold`. Body: `text-sm`.

## UI states

- [ ] Loading state uses `<Loading />` primitive (or composes it).
- [ ] Empty state uses `<Empty />` primitive.
- [ ] Error state uses `<ErrorState />` primitive.

## Mobile

- [ ] Pixel 5 (375px) — no horizontal overflow, all primary actions
      reachable.
- [ ] iPhone 12 (390px) — same.
- [ ] Responsive via Tailwind prefixes (`sm:`, `md:`, `lg:`), not
      raw CSS media queries.

## Architecture

- [ ] Page file (`page.tsx`) is an orchestrator — no form logic, no
      mutations, no business rules inline.
- [ ] Section components are co-located with the page.
- [ ] No component file exceeds ~150 lines.
- [ ] Shared primitives live in `components/ui/`; shared composites
      in `components/<feature>/`.
- [ ] `lib/` modules are React-free (the `lib/` purity ESLint rule
      stays at warn — don't add new violations).

## Security (the per-page checklist from `security.md`)

- [ ] Every API route + server action validates inputs via
      `@/lib/api/validate` (Zod).
- [ ] Money / auth / public routes apply `@/lib/api/rate-limit`.
- [ ] Webhook handlers verify signatures at the boundary.
- [ ] Cron routes use `@/lib/api/cron-auth` `isCronAuthorized()`.
- [ ] No `SUPABASE_SERVICE_ROLE_KEY` reference in any file
      containing `'use client'`. CI gate also enforces.
- [ ] Any new entitlement field follows the §7.4 / Phase 0.8b
      model: stored in `app_metadata` (server-only), read via
      `@/lib/auth/entitlements`.
- [ ] No new `dangerouslySetInnerHTML` / `eval` / `Function(...)`
      without an explicit review-note rationale.

## Observability

- [ ] No raw `console.*` — uses `lib/alerts/logger` (the `no-console`
      lint rule stays at warn; don't add new violations).
- [ ] Failure paths fire a `sendAlert({ type: '…', … })` where the
      alert matrix in `.claude/docs/alerts.md` requires it.
- [ ] No console errors during e2e (Playwright captures these).

## Lint

- [ ] `npm run lint:gate` passes. If the change reduced violations,
      **ratchet the budget DOWN** in `scripts/lint-gate.mjs` to lock
      it in (errors → 0 first, then warnings).

## Docs

- [ ] If schema changed → `database-schema.md` updated.
- [ ] If page behaviour changed → `page-specs.md` updated.
- [ ] If new shared component → `component-library.md` updated.
- [ ] If new alert → `alerts.md` updated.
- [ ] If auth / entitlements changed → `authentication.md` updated.
- [ ] If security posture changed → `security.md` updated.
- [ ] If CI/CD changed → `cicd.md` updated.
- [ ] Roadmap status updated in `production-readiness.md` if the
      phase advanced.

## Build

- [ ] `npm run build` exits 0.

## Final report

After running through the checklist:

1. Summarise pass / fail counts.
2. List every failing item with `file:line → issue → suggested fix`.
3. Flag anything that needs a human decision (e.g. "should this
   public-RPC field move to `app_metadata`?").

Reviewing: $ARGUMENTS
