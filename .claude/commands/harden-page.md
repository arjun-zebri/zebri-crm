---
description: Run a complete page through the production-readiness page-hardening flow — types, tests, design system, security, docs.
---

@.claude/docs/production-readiness.md
@.claude/docs/security.md
@.claude/docs/frontend-design.md
@.claude/docs/component-library.md
@.claude/docs/database-schema.md
@.claude/docs/authentication.md
@.claude/docs/testing.md

You are hardening a single page (or feature area) of Zebri CRM to
meet the **§5 Definition of Done** in
`.claude/docs/production-readiness.md`. This is the canonical
per-page workflow — each step is required, in order.

The page-by-page order is fixed in roadmap §4 (Auth → Payments →
Contracts → Couples+Events → Contacts → Tasks → Dashboard → Portal →
Quotes → Timeline → Branding → Settings → Admin → Workflows → Cron).
Don't skip ahead — security-critical surfaces stay first.

## Scope identification

Before touching code, identify exactly what's in scope:

1. **The page route(s)** — `app/(dashboard)/<route>/` or
   `app/<public-route>/`. List every file.
2. **API routes / server actions** owned by the page.
3. **Database tables** the page reads or writes (owned + joined).
4. **Postgres RPCs** the page calls (especially `SECURITY DEFINER`).
5. **Shared components** the page introduces or modifies.
6. **External integrations** (Stripe, Resend, Slack, cron).

Report the scope before doing anything else. Confirm with the user
if anything is ambiguous.

## Step 1 — Read the current state

- Read every file in scope.
- Read the matching section in `.claude/docs/page-specs.md`.
- Read the entitlements + RLS coverage rows in `security.md` for
  every owned table in scope.
- Identify which DoD items are already satisfied and which are not.

Output a **gap report**: what's done, what's missing, what's wrong.

## Step 2 — Type safety

- Audit for `any` casts. Replace with real types from
  `types/database.ts` or `@/types/<domain>`.
- Audit for missing TSDoc on exported functions / types / modules.
  Add it. Why-comments on non-obvious logic.
- Run `npm run typecheck` + `npm run typecheck:strict`. Fix all new
  violations. Ratchet the strict budget DOWN if you legitimately
  reduced it.

## Step 3 — Architecture

- Confirm the page file is an orchestrator — no form logic / no
  mutations / no inline business rules. Move them into section
  components (co-located) or `lib/` modules.
- Split any component over ~150 lines.
- Shared primitives → `components/ui/`. Shared composites →
  `components/<feature>/`. No `lib/*.tsx` (React in `lib/` is the
  layer-boundary violation).

## Step 4 — Design system

- Dispatch the `design-system-auditor` agent on every file in
  scope. Fix every reported violation.
- Confirm Loading / Empty / Error UI states are present and use
  the shared primitives.
- Mobile: verify Pixel 5 (375px) and iPhone 12 (390px). Tailwind
  prefixes only.

## Step 5 — Security

- Dispatch the `security-reviewer` agent on every API route, server
  action, and RPC in scope. Fix every P0 / P1 finding before moving
  on. P2 / P3 may stay for follow-up if explicitly recorded.
- Verify the page's per-page security checklist (`security.md`):
  Zod validation, rate-limit, webhook sigs, cron-auth, no
  service-role-key leak, app_metadata model for entitlements.

## Step 6 — Tests

Three layers — all required:

- **Unit:** every new lib/ function and component logic gets a unit
  test. `tests/unit/<path-mirroring-source>.test.ts`.
- **Integration:** every owned table the page touches gets a
  cross-tenant RLS test, mirroring
  `tests/integration/rls/couples.test.ts`. Tick the matrix in
  `security.md`.
- **E2E:** the golden path + at least one edge case (e.g. empty
  state, error state, permission boundary).
  `tests/e2e/<feature>.spec.ts`.

Use the `test-runner` agent to run all three layers and fix the
app for every failure. Never patch the test.

## Step 7 — Observability

- Replace any raw `console.*` with `logger.*` from `lib/alerts/`.
- For each failure path covered by the alert matrix in
  `.claude/docs/alerts.md`, wire up `sendAlert({ type: '…', … })`.
- Confirm no console errors during e2e.

## Step 8 — Docs

Update every relevant doc **in the same PR**:

- [ ] `page-specs.md` — the page's section reflects current
      behaviour.
- [ ] `database-schema.md` — any new table / column.
- [ ] `authentication.md` — any entitlement / auth change.
- [ ] `security.md` — tick the RLS matrix; record any residual
      findings.
- [ ] `component-library.md` — any new shared component.
- [ ] `alerts.md` — any new alert.
- [ ] `production-readiness.md` — mark the page complete in §4.

## Step 9 — `/ship-check`

Run `/ship-check` against the branch. Every item must pass. Resolve
every failure before opening the PR.

## Step 10 — Open the PR

- One PR per page. Small, reviewable, reversible.
- PR body: scope, what changed, gap report → resolution, test plan.
- Target `staging`. Verify on staging before promoting to `main`.

## Hand-off pattern

This command will commonly dispatch the four specialised agents:

- `security-reviewer` on API routes + RPCs + RLS.
- `design-system-auditor` on components + pages.
- `db-migration` when schema changes are needed.
- `test-runner` to run and triage the test pyramid.

Don't try to do every step single-handed — use the agents where they
fit. The page-hardening loop is: identify scope → use the right
specialist → run `/ship-check` → ship.

Page to harden: $ARGUMENTS
