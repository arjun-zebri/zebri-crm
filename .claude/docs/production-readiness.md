# Zebri — Production Readiness Roadmap

> Status: **Phase 0 (Foundation)** — 0.0 ✅ · 0.1 ✅ · 0.2 ✅ · 0.3 ✅ · 0.4 ✅ · 0.5 ✅ · 0.5.5 ✅ · 0.6 ✅ · 0.7 ✅ · 0.8a ✅ (security headers + cron-auth constant-time + service-role leak guard + Zod + rate-limit infra + RLS matrix) · 0.8b next (user_metadata privilege fix — own PR)

### Security infrastructure (Phase 0.8a)

Foundational, low-risk security work — additive across the board. See
`.claude/docs/security.md` for the full audit, RLS coverage matrix,
and per-page security checklist.

- HTTP security headers in `next.config.ts` (`X-Frame-Options`,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
  prod-only HSTS). CSP deferred (needs per-page testing against
  Stripe/Supabase/inline theme bootstrap; landing in a later tightening
  phase).
- **Audit findings:** Stripe webhook signature ✅ verified;
  service-role key ✅ exclusively server-side; cron-secret check ⚠️
  was non-constant-time, **fixed**. Resend webhook doesn't exist
  (documented as future).
- `@/lib/api/cron-auth` — shared `isCronAuthorized()` with constant-
  time comparison, replacing two inline implementations.
- `scripts/check-no-service-role-in-client.mjs` — wired into CI as a
  required step; fails the build if any `'use client'` file references
  the service-role key.
- `@/lib/api/validate` — Zod-backed `parseJsonBody` /
  `parseSearchParams`. Per-route adoption is per-page work; new code
  uses these from now on.
- `@/lib/api/rate-limit` — `inMemoryLimiter` + `ipOf`; per-route
  adoption (auth, money, public surfaces) per-page.
- 12 new unit tests (cron-auth 5, rate-limit 6, validate 4).

**0.8b (next) — `user_metadata` privilege escalation fix.** Its own
focused PR (per the 2026-05-21 scope decision) doing the migration
end-to-end across middleware + `lib/payments/subscription` + the 5
public-page RPCs + signup flow + admin shadow-mode, with integration
tests landing alongside each piece proving the escalation paths are
blocked. Backfill all live users; verify in staging.

### CI/CD pipeline (Phase 0.7)

Shipped (see runbook in `.claude/docs/cicd.md`):

- **`ci.yml`** — required PR pipeline on `main`/`staging`: install →
  `typecheck` → `typecheck:strict` → `lint:gate` → `knip`
  (non-blocking) → unit → build → integration vs **local Supabase**
  with real RLS. Cheapest-first so failures surface fast.
- **`deploy-staging.yml`** + **`deploy-prod.yml`** — push migrations to
  Supabase on merge to `staging` / `main`. Production is gated by the
  `production` GitHub Environment (required reviewers). App deploys
  remain on Vercel's GitHub integration; these workflows are DB-only.
- **`scripts/check-migrations.sh`** — refuses to deploy destructive
  migrations (`DROP TABLE` / `DROP COLUMN` / `TRUNCATE` / `DROP SCHEMA`
  / un-guarded `DELETE FROM`) without an explicit
  `-- @ALLOW_DESTRUCTIVE: <reason>` marker. Verified end-to-end on the
  existing `drop_price_from_events` migration; marker added there with
  rationale.
- The §7.9 ledger discrepancy (deleted/renamed migrations from 0.2) is
  reconciled via a documented one-time `supabase migration repair` per
  env — see the runbook.

User-side setup (one-time): create `staging` + `production` GitHub
Environments with `SUPABASE_ACCESS_TOKEN`/`PROJECT_REF`/`DB_PASSWORD`
secrets, branch protection on both branches requiring the `ci.yml` job.
Runbook lists every step.

### Observability & alerting (Phase 0.6)

Shipped: structured `lib/alerts/logger` (`debug/info/warn/error` + `.child()` + pluggable `Transport`s), typed `AlertEvent` discriminated-union catalog, `sendAlert(event)` dispatcher that fans out to Slack + the logger pipeline, and the full alert matrix in `.claude/docs/alerts.md` (1:1 with the events catalog). 18 new unit tests across the alerts module (suite now 66).

**Sentry deferred** (per user 2026-05-20). Observability stack is **Vercel runtime logs + Slack via `sendAlert()` + existing global error boundaries** — sufficient for current scale; Sentry slots in cleanly later via a registered Transport. Roadmap §1 amended accordingly.

Per-route wiring (`/api/stripe/webhook` calling `sendAlert({type:'stripe_webhook_failed',…})` etc.) is intentionally **not** done in 0.6 — those edits happen during the relevant page/route hardening, consistent with the ratchet/no-bulk-feature-edits philosophy. The 23 legacy raw `console.*` calls likewise migrate per-page to `logger.*` (the `no-console` lint rule stays `warn`/ratcheted).

### Design system (Phase 0.5)

Semantic tokens (colour, typography, radius) added to `app/globals.css`
`@theme` — see `.claude/docs/frontend-design.md` for the full table.
Three foundational primitives that every page-DoD needs (`<Loading />`,
`<Empty />`, `<ErrorState />`) shipped in `components/ui/` with TSDoc and
unit tests (11 new tests, 20 total). New ESLint rule (warn, ratcheted)
forbids arbitrary-value colour utilities (`bg-[#…]`, `text-[#…]`, …) —
surfaced 6 existing violations folded into the lint warning budget (876 →
884). No legacy codemod — token adoption happens per-page during hardening.

**0.5b retrofit (dark mode):** the `@theme` block was refactored to
`@theme inline` referencing `:root` CSS variables, with a `.dark` override
class. The same token utility (`bg-surface`, `text-text`, …) now resolves
to the correct value per theme — no `dark:` modifier needed at call sites.
Synchronous bootstrap in `app/layout.tsx` (no FOUC); `<ThemeToggle />`
primitive added (+4 tests, suite now 29). Scoped to the authenticated
dashboard; public surfaces follow the MC brand kit and remain unchanged.

### Lint ratchet (Phase 0.4)

ESLint expanded (Prettier-compatible via `eslint-config-prettier`; `import/order`, `no-console`, `lib/` layer-boundary as ratcheted warnings). Per the user's chosen approach, the large legacy set is **not** mass-fixed — ~91 of the errors are behavioural (react-hooks strict) or `any` typing debt in feature code, fixed per-page during hardening. Same pattern as the strict ratchet.

`npm run lint:gate` (`scripts/lint-gate.mjs`) enforces a monotonically-decreasing budget; CI uses it (0.7). `npm run lint` stays the raw reporter (severities kept honest, not downgraded).

| Metric | Baseline 2026-05-20 |
|---|---|
| ESLint **errors** (34 `any` + 57 react-hooks-strict) | **91** → target 0 first |
| ESLint **warnings** (import-order, no-console, unused-vars, exhaustive-deps, img, lib-purity) | **876** → then 0 |

Fixed now (safe, no behaviour change): 3 `prefer-const`, 2 `no-non-null-asserted-optional-chain`, 1 e2e `rules-of-hooks` false-positive (scoped off for Playwright), `react/no-unescaped-entities` disabled (low-signal noise rule). `knip` is report-only until 0.7 (promoted to a gate once the known dead routes are cut in their page phases). Prettier is **format-on-touch** (no repo-wide reformat — consistent with the ratchet/go-slow approach); `lib/` purity has ~21 real violations (React under `lib/branding/*.tsx`) tracked as warnings, fixed when those modules are hardened.

### Type-strictness ratchet (Phase 0.2)

Base `tsconfig.json` now also enforces (0 errors, zero-cost): `noImplicitOverride`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`. `npm run typecheck` must stay **0**.

Two high-volume flags are deferred behind `tsconfig.strict.json` (`npm run typecheck:strict`), burned down per page:

| Flag | Errors at 0.2 baseline |
|---|---|
| `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` (pre-typed-clients, 0.2a) | 289 |
| **Combined budget — re-baselined post-typed-clients (0.2b)** | **295** |

Rule: this number must **monotonically decrease** from the **295** baseline, target **0** by end of the page-by-page phases. CI (0.7) enforces "must not increase". New code must be clean under the strict config.

> One-time re-baseline 289 → 295: adopting `createClient<Database>()` replaced `any`-typed Supabase results with real types, which legitimately exposes ~6 more strict-flaggable sites that `any` had masked. This is increased honesty, not a regression — the denominator grew because the codebase got more typed. Monotonic-decrease applies from 295 onward.

### Sequencing note (0.2 ⇄ 0.3)

Generating `types/database.ts` needs a live DB; no Supabase login/DB-URL creds are available, so the **local Supabase stack (`supabase init` + `supabase start`, Docker) was brought forward from 0.3 into 0.2**. 0.3 still owns the Vitest/integration *harness* built on top of the now-running stack. `supabase/config.toml` added; migrations folder untouched (58, source of truth).
> Owner: Arjun (solo) · Last updated: 2026-05-19
> This is the master plan for taking Zebri from prototype to a production-grade SaaS.
> It is executed **foundation first, then page-by-page**. Take it slow. One section per PR.

---

## 1. Decisions (locked)

These were agreed up front and govern everything below.

| Area | Decision |
|---|---|
| Sequencing | **Foundation first**, then page-by-page hardening on top of the safety net |
| Scope | **Everything currently in the app** is in scope (core CRM + portal, branding, workflows, timeline, admin/shadow, email, Stripe Connect, subscriptions) |
| Team / process | **Solo**, lightweight process but **strict, required CI gates** |
| Observability | **Slack-only (Sentry deferred — amended 0.6)** — structured logger + typed `sendAlert()` + Slack matrix + Vercel runtime logs. Sentry can be added in ~half a day if/when error volume warrants it. |
| Promotion flow | `main` = production · `staging` branch = staging env · PR → CI gates → merge to `staging` (verify) → promote to `main` (prod) |
| Design system | **Design tokens + enforced primitives** (no Storybook) |
| Comment style | **TSDoc on every exported API** + why-comments on non-obvious logic |
| Definition of Done | **Full bar** + explicit **loading / empty / error** states (see §5) |
| Security posture | **Fix all security holes** with careful, backward-compatible migrations + backfill for live users, verified in staging first |
| Test DB | **Local Supabase** (`supabase start`, Docker) for unit/integration; real schema + RLS |
| Type safety | Adopt **generated Supabase DB types** + **ratchet TS strictness**, fix errors incrementally |

---

## 2. Current-state assessment

**Stack:** Next.js 16.1.6 (App Router) · React 19.2 · Tailwind 4 · Supabase (Postgres + Auth) · Stripe (+ Connect) · Resend · Google Places · Slack alerts · Vercel (hosting + cron). Node 22, Docker 29, Supabase CLI 2.65.5 all present.

**Size:** ~176 `.ts(x)` in `app/`, ~150 components, 58 SQL migrations.

**Strengths:** modern stack, `strict: true` already on, RLS model exists, migrations folder is the source of truth (no drift — "everything applied"), feature-rich and real (paying users).

**Gaps / risks identified:**

1. **No CI** — no `.github/`. Nothing prevents broken code reaching `main`/prod.
2. **No unit/integration tests** — only Playwright e2e (`tests/e2e/`). No Vitest, no RLS tests.
3. **No `types/` folder** — types scattered/co-located; Supabase client is **untyped** (no generated `Database` type).
4. **Security: privilege escalation** — `account_type` (incl. `admin`) and `subscription_status` live in **user-writable `user_metadata`**, used in RLS (`auth.jwt() -> user_metadata ->> account_type = 'admin'`) and the middleware paywall. A user can self-escalate to admin / bypass billing. **Must fix.**
5. **Misfiled (not dead) code** — *0.0 finding, supersedes the original "stale code" assumption.* The `events|quotes|invoices|contracts` dirs under `app/(dashboard)/` are **active modules misfiled** under route-group folders whose index pages were removed. The Quote/Invoice/Contract builder modals and the entire `events/*` module are heavily imported by the live `/payments` page and couple profile. Only the `/quotes/[id]` & `/invoices/[id]` detail **routes** are genuine deletion candidates. Real fix = relocation (Phase 0.1), not deletion. Full triage in §7.
6. **34 `any` casts**, **23 raw `console.*`** calls, no structured logging, no error tracking.
7. **CLAUDE.md is stale** — claims "minimal MVP, DO NOT build automation/analytics" while the app ships automation, analytics, portal, etc.
8. **Design system informal** — three component locations (`components/ui`, `app/components`, co-located), no token layer, ad-hoc Tailwind.
9. **No security headers / rate limiting**; webhook & CRON_SECRET verification not audited; no input-validation layer at boundaries.
10. **No committed `.env.example`** (`.env.test.example` referenced in `.gitignore` but missing).

---

## 3. Phase 0 — Foundation (the safety net)

No user-facing behaviour changes except the security fix (0.8). Each numbered item is **one PR**, merged to `staging`, verified, promoted to `main`. Order matters — later items depend on earlier ones.

### 0.0 Recon & baseline
- Triage stale dirs (`events`, `quotes`, `invoices/[id]`, `contracts`) — confirm which are still imported (couple-profile modals) vs dead; produce a keep/cut list (no deletion yet — deletions happen during the relevant page phase, guarded by tests).
- Inventory all ~40 API routes + every table's RLS policies into a coverage matrix (drives 0.8).
- Commit `.env.example` + `.env.test.example` (keys only, no secrets); document every env var.

### 0.1 Repo structure & conventions
- Create top-level `types/` — `types/database.ts` (generated), `types/domain.ts`, feature type modules. Establish import convention (`@/types/...`).
- Reorganise `lib/` into clear domains: `lib/db`, `lib/auth`, `lib/payments`, `lib/email`, `lib/branding`, `lib/alerts`, `lib/utils`. Pure functions only; no React.
- Document the layering rule: **pages = orchestrators**, section components co-located, shared primitives in `components/ui`, data access in `lib/db`, no mutations in components.
- `CONTRIBUTING.md` + update `CLAUDE.md` to reflect reality and these conventions.

### 0.2 Type safety
- `supabase gen types typescript` → `types/database.ts`; wire `createClient<Database>()` in `lib/supabase/{server,client}.ts` + `middleware.ts`.
- Typed data-access helpers in `lib/db` (no raw untyped queries in components).
- Ratchet `tsconfig`: add `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames` (defer `exactOptionalPropertyTypes` if backlog too large). Establish a tracked allowlist; **new code is strict**, legacy burned down per page.
- Track the 34 `any` casts to zero across the page phases.

### 0.3 Test infrastructure
- Vitest + React Testing Library + jsdom; `vitest.config.ts`; v8 coverage with thresholds on critical modules (payments math, auth, RLS helpers).
- `supabase init` + local stack; deterministic seed; integration harness that runs against **local Supabase with RLS**, with helpers to create isolated test users/tenants.
- Restructure `tests/` → `tests/unit`, `tests/integration`, `tests/e2e`; shared factories/fixtures; update `.claude/docs/testing.md`.
- Add npm scripts: `test:unit`, `test:integration`, `test:e2e`, `test` (all).

### 0.4 Lint & code-quality gates
- Expand ESLint: import ordering, layer boundaries (`no-restricted-imports`), no raw hex/ad-hoc style (design-token rule), `no-console` (allow via logger only), type-aware rules. Add Prettier.
- Add `knip` (or `ts-prune`) for dead-code detection wired into CI (non-blocking → blocking once clean).

### 0.5 Design system (tokens + primitives)
- Token layer (Tailwind theme + CSS vars) for color / spacing / typography / radius, mapped to brand assets.
- Consolidate component locations into a documented `components/ui` primitive set; codemod call-sites.
- Ship standard `Loading`, `Empty`, `Error` primitives (DoD requires these per page).
- Lint rule forbidding off-token styles. Refresh `frontend-design.md` + `component-library.md`.

### 0.6 Observability & alerting
- Sentry (client + server + edge), CI source-map upload, release tagging, PII scrubbing, tunneling to avoid ad-block.
- `lib/alerts` structured logger; replace all 23 `console.*`.
- **Alert matrix → Slack** (documented in `alerts.md`): Sentry error-rate spikes, Stripe webhook failures, payment/charge failures, Stripe Connect onboarding failures, cron job failure/missed run, Resend send failures + bounces, auth anomalies, RLS-denied spikes, subscription churn events.

### 0.7 CI/CD (GitHub Actions)
- **PR pipeline** (required, branch protection on `main` + `staging`): install → typecheck → lint → `knip` → unit → integration (local Supabase service container) → build → e2e (ephemeral) → Sentry dry-run. All required; no human-review gate (solo).
- **CD staging:** merge to `staging` → `supabase db push` to staging → Vercel staging deploy → post-deploy smoke tests → Sentry release.
- **CD prod:** promote `staging` → `main` → migration safety check (no destructive ops without flag) → `supabase db push` to prod → Vercel prod deploy → smoke tests → Sentry release + source maps.
- Secrets via GitHub Environments (`staging`, `production`). Document runbook + rollback.

### 0.8 Security baseline (the privilege-escalation fix lands here)
- Move `account_type` + all `subscription_*` / Stripe entitlement fields out of user-writable `user_metadata` → `app_metadata` and/or a service-role-only `profiles` table with strict RLS. Update: signup flow, middleware paywall, admin shadow-mode, all RLS policies referencing `user_metadata`. **Backward-compatible migration + backfill for live users; verified in staging before prod.**
- Security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy) via middleware/next config.
- Rate limiting on auth + public + API routes.
- Audit: Stripe/Resend webhook signature verification, `CRON_SECRET` enforcement, `SUPABASE_SERVICE_ROLE_KEY` usage (server-only, never leaked).
- Input validation with Zod at every API/server-action boundary.
- Full authz pass using the 0.0 route × RLS matrix; integration tests proving cross-tenant denial.

### 0.9 Claude system upgrade
- Rewrite `CLAUDE.md` (accurate product, prod standards, layering, DoD, comment style).
- Agents: `test-runner`, `security-reviewer`, `db-migration`, `design-system-auditor`.
- Commands: upgrade `/ship-check` to enforce the §5 DoD; add `/harden-page`.
- Refresh every `.claude/docs/*` to match reality.

---

## 4. Phase 1+ — Page-by-page hardening (order)

Each page/section is its own small PR(s) and must meet the §5 DoD before it's "done". Ordered by risk × value:

1. **Auth & account** (login, signup, reset/update-password, middleware, paywall) — gates everything
2. **Payments & invoices** + Stripe webhooks/Connect — money, highest risk
3. **Contracts** (e-sign) — legal/money
4. **Couples + Events** — core CRM
5. **Contacts**
6. **Tasks**
7. **Dashboard**
8. **Client Portal** (public surface)
9. **Quotes**
10. **Timeline**
11. **Branding editor**
12. **Settings**
13. **Admin / Shadow mode**
14. **Workflows / automation**
15. **Cron + email pipeline**

(Order can be revisited after Phase 0; security-critical surfaces stay first.)

---

## 5. Definition of Done (every page/section)

A section is production-ready only when **all** of the following hold:

- [ ] No `any`; strict types; uses generated DB types end to end
- [ ] TSDoc on every exported function/type/module; why-comments on non-obvious logic
- [ ] Unit + integration + e2e tests green; logic & RLS meaningfully covered
- [ ] Integration test proves cross-tenant RLS denial for its tables
- [ ] Design-system compliant (tokens + primitives, zero ad-hoc styles)
- [ ] Explicit **loading**, **empty**, and **error** UI states
- [ ] Works on desktop **and** mobile (Pixel 5 + iPhone 12)
- [ ] No console errors; Sentry-clean during e2e
- [ ] Components ≤ ~150 lines; page is an orchestrator (no mutations/form logic in page)
- [ ] Relevant `.claude/docs/*` updated
- [ ] Ships as its own PR through `staging` → `main`

---

## 6. Working agreement

- One section/item per PR. Small, reviewable, reversible.
- Foundation (Phase 0) completes before Phase 1 begins (safety net first).
- Security fixes affecting live users: backward-compatible migration + backfill, staged before prod.
- Never patch a test to make it pass — fix the app.
- Update this file's status as phases complete.

---

## 7. Phase 0.0 Findings (recon log)

Completed 2026-05-19 on branch `phase-0.0-recon`. Read-only investigation + baseline hygiene only.

### 7.1 Stale-dir triage (definitive)

Verdict: **none of the four dirs are dead code.** They are active modules misfiled under route-group folders that lost their index pages. Cuts are deferred to the relevant page phase, guarded by tests (per §6).

| Path | Reachable as route? | Imported by (live) | Verdict |
|---|---|---|---|
| `quotes/quote-builder-modal.tsx` | n/a (component) | `payments/page`, `couples/couple-payments`, `couples/couple-quotes` | **KEEP** → relocate in 0.1 |
| `quotes/[id]/page.tsx` (`/quotes/[id]`) | yes, but no inbound links anywhere (app/lib) | — | **CUT candidate** — verify no email/portal/RPC link in its page phase, then remove |
| `invoices/invoice-builder-modal.tsx` | n/a (component) | `payments/page` (rendered L654) | **KEEP** → relocate in 0.1 |
| `invoices/invoice-payment-schedule.tsx` | n/a (component) | `invoices/invoice-builder-modal` (internal) | **KEEP** (part of active invoice modal) |
| `invoices/[id]/page.tsx` (`/invoices/[id]`) | only via `quotes/[id]/page.tsx:244` `router.push` | — | **CUT candidate** — dies with `/quotes/[id]`; verify together |
| `contracts/contract-builder-modal.tsx` | n/a (`contracts/` has no page) | `payments/page`, `couples/couple-contracts` | **KEEP** → relocate in 0.1 |
| `events/*` (modals, calendars) + `events/[id]/timeline/page.tsx` | **timeline route LIVE** | `couples/*` (timeline, events, modal, calendar), `use-dashboard`, `settings/timeline-template-manager` | **KEEP** → relocation **deferred** to Events page-hardening phase (see §7.7) |

Action for 0.1: relocate the three builder modals + the `events` module to honest homes (e.g. `components/` feature modules or `app/(dashboard)/payments/_components`); they are not route dirs.

### 7.2 API surface inventory (20 route handlers)

`GET`: drive-time, places/{autocomplete,address-autocomplete,details}, stripe/{billing-history,connect,connect/callback}.
`POST`: alerts/slack, contract/{decline,sign}, email/{send-contract,send-invoice,send-quote}, portal/upload, stripe/{checkout,invoice-payment,portal,webhook}.
`GET+POST` (via `export const GET/POST = handle`): cron/expire-contracts, email/send-contract-reminders.

**Public (unauthenticated) prefixes** (middleware allowlist): `/api/alerts`, `/api/stripe/invoice-payment`, `/api/stripe/webhook`, `/api/portal`, `/api/contract`, `/api/cron`, `/api/email/send-contract-reminders`, plus public *pages* `/quote /invoice /portal /contract /timeline`. → 0.8 must verify each public route's own auth (webhook signature / `CRON_SECRET` / share-token), since middleware does **not** protect them.

### 7.3 RLS state

~25 tables, RLS enabled on all of them, **63 `CREATE POLICY` statements across 21 migration files**. Ownership model is consistent and sound where sampled: per-CRUD `auth.uid() = user_id` (e.g. `vendors`). Policy *syntax is inconsistent* across migrations (quoted vs unquoted names, multi-line) — a clean per-table policy matrix must be built in **0.8** (mechanical regex undercounts; needs the live DB introspected via local Supabase from 0.3).

### 7.4 Security locus (refines 0.8 scope — important)

There is **no SQL-level admin/role bypass** — no RLS policy references `user_metadata`/`account_type` (good: RLS is strictly per-user). The trust-in-user-writable-metadata problem lives in **three** layers and is broader than "move account_type":

1. `middleware.ts:91` — `user.user_metadata.account_type === 'admin'` → **admin self-escalation**.
2. `middleware.ts:115` + `lib/subscription.ts:10` — `user_metadata.subscription_status` / `is_subscribed` → **paywall bypass**.
3. **Postgres RPCs** (`get_public_*`, `get_portal_data`, branding/invoice/quote functions) read `raw_user_meta_data` for **financially material** fields surfaced on public pages: `bank_account_name/bsb/account_number`, `stripe_connect_enabled`, `business_name`, branding. User-writable → a user can alter bank details / Connect flag shown on their public invoices.

→ 0.8 is therefore "**stop trusting `user_metadata` for any security, entitlement, or financial decision**" across middleware + `lib/subscription` + ~5 SQL RPCs, with a backfill migration for live users, staged first. Task #9 updated to reflect this.

### 7.5 Baseline hygiene done in 0.0

- Committed `.env.example` + `.env.test.example` (keys only, documented, marked public/secret/required); `.gitignore` updated to permit them.
- `supabase/.temp/` now gitignored; `supabase/.temp/cli-latest` untracked (was tracked & dirtying every status).

### 7.10 Decision point (0.2): typed-client adoption sequencing

`types/database.ts` is generated and committed. Applying `createClient<Database>()` to the 3 clients surfaced **39 tsc errors** across ~13 files (portal, quote/contract/invoice public pages, contract APIs, invoice builder, a few react-query call sites). Categorised:
- ~30 mechanical type-honesty fixes (nullable columns → guards/`?? ''`; RPC-returns-`Json` → `as unknown as T`; query-fn annotations) — no behaviour change.
- ~2 genuine latent bugs: code writes the **dropped `events.price`** column (`invoices/[id]/page.tsx` — the §7.1 dead route — and the live `invoice-builder-modal.tsx`).
- ~5 public-page RPC `Json` casts.

The generated types alone break nothing (unused until imported), so they ship now with tsc still 0. The client-generic switch + burndown is deferred pending the user's chosen sequencing (fix-all-now as type-honesty in 0.2, vs. transitional seam + per-page burndown when each page gets its 0.3 test net). Tracked, not lost.

### 7.9 Finding (from 0.2): migration chain is systemically non-replayable

Beyond the demo-data issue (§7.8), real **schema** migrations also fail to replay. First instance: `20260405000001_create_branding_storage_bucket.sql` contained invalid SQL (`auth.uid()::text || '/' in name` — misused `IN`); it can never have applied to prod as written, yet prod has the bucket policies — i.e. **prod was hand-patched and the committed migrations diverge from reality**. (Here, the very next migration `…002_fix_branding_bucket_rls_policies` drops & recreates these policies correctly, so fixing `…001` to the valid form leaves the end state identical.)

This is systemic, not a one-off: the chain has clearly never been validated from zero. **Implication:** "everything has been applied" (0.0) was true only for the live cloud DBs via manual intervention; the repo's migration history is not a faithful, replayable source of truth. A clean from-zero replay is a hard prerequisite for the 0.3 test harness and 0.7 CI. Approach: fix forward migration-by-migration (each `supabase start` failure = one finding + minimal intent-preserving fix that matches prod's actual end state), tracked under task #11 (broadened). Remote ledger reconciliation handled in 0.7.

> **Resolved 2026-05-20.** Confirmed root cause: historical migrations were applied via the Supabase web SQL editor, which never writes to `supabase_migrations.schema_migrations`. Both staging and prod ledgers were back-filled by running `supabase migration repair --status applied <version>` for all 56 local versions; `migration list --linked` now shows 56/56 Local↔Remote with no gaps on both envs. Future migrations go through the CI deploy workflow (`supabase db push`) — **manual SQL-editor application is now deprecated** for schema changes (see new memory: `migration_management_2026.md`).

### 7.8 Finding (from 0.2): migrations are NOT reproducible from scratch

`supabase start` fails applying `20260312010000_insert_demo_data.sql`: it inserts demo `couples` with a **hardcoded `user_id` (`9524e31d…dde3`) that doesn't exist in `auth.users`** on a clean DB → FK violation, aborting the whole stack. Same hardcoded user in `20260321010000_add_demo_pricing_and_sources.sql`. These two are **pure demo fixtures mis-committed as schema migrations**; nothing in app/code/RPCs/other migrations references those rows. The migration chain only ever "worked" because that user was hand-created in the cloud envs (confirms 0.0's drift hypothesis: "everything applied" was true for cloud, but the set is not self-contained).

Impact: blocks local DB, the 0.3 test harness, and CI-from-zero (0.7). **Production defect** (non-reproducible schema). Prod data is unaffected by any fix — Supabase tracks migrations by version and never re-runs/un-applies; removing the files deletes nothing on remote and `db push` never reverts. Remediation chosen with the user (task #11); remote ledger note (`migration list` showing version applied-remote/absent-local) is cosmetic, reconciled in 0.7.

### 7.7 Decision (from 0.1): `events/` relocation deferred

Increment D was reassessed and **deliberately not done in 0.1**. `app/(dashboard)/events/` contains a **live route** (`events/[id]/timeline/page.tsx` → `/events/[id]/timeline`), so relocating the folder changes a production URL — a routing/product decision, not a structural move. It also has cross-feature relative imports (`../contacts`, `../couples`). Doing this safely requires the Phase 0.3 test net and a decision on whether that URL moves under `/couples`. Deferred to the **Events page-hardening phase** (Phase 4). 0.1's structural scope = `types/` extraction, builder-modal relocation, `lib/` domains, conventions docs. Consistent with §6 ("safety net first; small reversible PRs").

### 7.6 Finding (from 0.1): colliding generic export names

Domain type modules export the same generic identifiers (`SORT_OPTIONS`, `SortField`, `SortDirection`, `STATUS_LABELS`) from multiple files (`couple`, `contact`, `event`, `task`). A `types/` barrel is therefore not viable without renames. Convention adopted instead: **import the specific module** (`@/types/couple`), no barrel. The name collisions are a smell to resolve during the relevant per-page phases (rename to domain-scoped names, e.g. `COUPLE_SORT_OPTIONS`) — out of scope for 0.1 (risky cross-cutting churn without the 0.3 test net).
