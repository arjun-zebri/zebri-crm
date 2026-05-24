# Zebri — Production Readiness Roadmap

> Status: **Phase 0 (Foundation) COMPLETE** · **Phase 1 (Auth & account)** ✅ · **Phase 2A (Stripe routes + webhook idempotency)** ✅ on staging · **Phase 2B (Billing UI DoD)** ✅ on staging · **Phase 2C (/payments decomposition + RLS proofs + email-send)** ✅ on staging · **Phase 2C.2 (builder modal decomposition + UI redesign)** ✅ in flight. **Phase 2D (Stripe Connect + public surfaces)** next. Full plan: `.claude/docs/phase-2-payments.md`.
>
> Promotion: current multi-phase batch stays on `staging` only — no per-phase `main` promotion. One big merge at the end of all phases.

### Builder modal decomposition + UI redesign (Phase 2C.2)

The Quote + Invoice builder modals — the biggest files in the
repo before this PR — refactored into composition over shared
parts, with the UI redesigned to match the calm document-style
aesthetic the user signed off on for the Billing tab.

- **10 new shared parts** under `components/builders/parts/*`:
  builder-modal-shell, builder-meta-row, line-items-table,
  totals-panel, discount-control, tax-control, notes-field,
  share-and-send, payment-schedule, template-picker. Each ≤ 200
  LOC, TSDoc'd, primitive-clean.
- **Shared `StatePill`** extracted to `components/ui/state-pill.tsx`.
  Used by Billing tab + both builders + payment-schedule stages.
  5 tones + optional filled/hollow dot. Replaces the pastel pill
  badges across the app.
- **`/payments/actions.ts`** server actions —
  `saveQuoteAction` / `saveInvoiceAction` / `deleteQuoteAction` /
  `deleteInvoiceAction`. Zod-validated, RLS-scoped via the session
  Supabase client. Modal files no longer carry inline
  `supabase.from('quotes').update(...)` calls.
- **UI redesign**: hero title input + status pill at the top;
  document-style section flow (meta → items → totals → schedule
  → notes); `Send to couple` as a single primary CTA (saves +
  enables share + sends email in one click); contextual
  status-aware header CTA on invoices (Mark deposit paid → Mark
  final paid → none when paid); destructive actions tucked into
  a `⋯` overflow menu.
- **Line items**: `quantity` removed entirely. Both quotes and
  invoices now show `description + amount` only.
  `saveInvoiceAction` writes `quantity = 1, unit_price = amount`
  for forward-compat with the existing schema. Column drop
  scheduled for Phase 9.
- **Payment schedule (invoice)**: vertical timeline (deposit ┊
  final) with state pill + amount + due date + inline "Mark paid"
  per stage. Replaces the previous two-card layout.
- **Quote templates**: "Start from template" picker shown
  prominently on empty quotes; collapses to a smaller "Apply
  template" link in the items header once items exist.
- **47 new tests** — +41 unit (StatePill 10, parts 31) + 6
  integration (saveQuoteAction + saveInvoiceAction against local
  Supabase, including cross-tenant denial + the `quantity = 1`
  invariant).
- **Stats**: Quote modal 1047 → 623 LOC (-40%). Invoice modal
  1465 → 780 LOC (-47%). Strict ratchet 293 → 288 (-5). Lint
  errors 86 → 78 (-8), warnings 596 → 559 (-37).

### Payments page decomposition + email-send hardening (Phase 2C)

`/payments` and the email-send routes lifted through the §5 DoD.
Builder modal decomposition split out to PR 2C.2 (separate review
of money-critical structural refactor).

- **`/payments` page (851 LOC) → 10 files** under
  `app/(dashboard)/payments/`. Orchestrator (262 LOC) composes
  `payments-header` + `payments-table` + per-tab list components
  (`quotes-list`, `invoices-list`, `contracts-list`) + footer +
  data hooks + keyboard-shortcut hook. Contracts tab kept fully
  functional per the Phase 3 scope boundary.
- **Email-send routes hardened** —
  `/api/email/send-{quote,invoice}` now use Zod (`{ id: uuid }`)
  + 5/min/user via `EMAIL_RATE_LIMITS` + structured logger. Hits
  fire `email_rate_limit_hit`. `/api/email/send-contract` stays
  Phase 3.
- **7 RLS proofs added** —
  `tests/integration/rls/payments-tables.test.ts` proves
  cross-tenant denial for `quotes`, `quote_items`, `quote_templates`,
  `quote_template_items`, `invoices`, `invoice_items`,
  `stripe_customers`. Matrix ticked in `security.md`.
- **Public RPC audit** of `get_public_quote` / `get_public_invoice`
  — tokens ✅, field selection ✅, one §7.4 stale `user_metadata`
  read of `stripe_connect_enabled` flagged for PR 2D fix. Findings
  in `security.md`.
- **+29 unit tests** for the new page sections
  (`PaymentsTable`, `PaymentsHeader`, `PaymentsFooter`,
  `InvoicesList` + the pure `deriveInvoices` helper).

**Out of Phase 2C**: builder modal decomposition (PR 2C.2);
public invoice payment surfaces + Connect (PR 2D); URL-search-
param-backed tab state (follow-up).

### Stripe route + webhook hardening (Phase 2A)

First per-page hardening PR of Phase 2. Locks down every money
path against retries, bad input, and abuse.

- **`stripe_events` idempotency ledger** — webhook handler INSERTs
  the event ID first; PK conflict = already processed → 200 no-op.
  Stripe can retry freely and we never double-fire side effects.
  90-day retention via the new daily prune cron at 03:00 UTC.
- **Per-event Zod schemas** in `lib/payments/webhook-events.ts`
  validate `event.data.object` against the fields we read. Stripe
  API drift (e.g. `current_period_end` moving onto items) can't
  silently break us. `readPeriodEndIso` helper centralises the
  items-first / root-fallback read.
- **Replay alerting** — single retries silent; ≥ 3 replays of the
  same event ID within 60s fires `stripe_webhook_replay` exactly
  once per breach (§11.2 lock-in).
- **Rate-limits** on all 3 auth-gated Stripe routes via
  `STRIPE_RATE_LIMITS` — checkout 5/min, portal 10/min,
  billing-history 30/min, all per-user. Hits fire
  `stripe_rate_limit_hit`.
- **Zod-validated bodies** + structured logger throughout — no
  more `console.error` in money paths.
- **3 new typed alerts**: `stripe_webhook_replay`,
  `stripe_rate_limit_hit`, `stripe_events_prune_high`.
- **Strict ratchet** -1 (295 → 294). Test suite +35 (145 unit /
  38 integration). Plan doc `.claude/docs/phase-2-payments.md`
  shipped alongside this PR as the canonical reference for 2A→2D.

**Out of Phase 2A** (explicit): the Billing UI DoD, the
`/payments` page + builder modals, Stripe Connect, and the public
invoice payment surfaces — moving as PRs 2B / 2C / 2D per the
plan doc.

### Auth & account hardening (Phase 1)

First per-page hardening PR — the gating surfaces shipped through
the full §5 DoD bar.

- **5 server actions** — `loginAction`, `signupAction`,
  `resetPasswordAction`, `updatePasswordAction`,
  `changePasswordAction`. Every action: Zod validation
  (`lib/auth/schemas`), per-action rate-limit, server-side Slack
  alert via `sendAlert()`, tagged `{ ok, error, fieldErrors }`
  return for inline form rendering. Closed the open POST surface
  on `/api/alerts/slack` (signup alert moved server-side).
- **All 5 auth pages rewritten** to server-component +
  client-form-component pattern, using `<Input>` / `<Button>` /
  `<PasswordStrengthMeter>` primitives with tokens. ~582 LOC →
  ~430 LOC. Mobile-responsive. TSDoc throughout.
- **Signup writes `app_metadata` directly** via
  `updateEntitlements()` — no longer depends on the INSERT
  trigger. Trigger stays as defence in depth for future OAuth /
  magic-link signup paths.
- **`?next=` redirect-after-login** with same-origin whitelist
  (`sameOriginPathSchema`). Middleware preserves it on unauth
  redirect; login action re-validates and bounces. Open-redirect
  proof (`?next=//evil.com` falls back to `/`).
- **Already-logged-in redirect** on `/login`, `/signup`,
  `/reset-password` (server-component guard). `/update-password`
  intentionally requires session.
- **Entitlements helper user_metadata fallback REMOVED** —
  `app_metadata` is now the sole source of truth. JS helper + the
  `enforce_starter_couple_limit` SQL function both updated.
  Tightens the §7.4 fix by removing the transitional escape hatch.
- **Settings Account tab** ported: change password via
  `changePasswordAction` (re-auth with current password first +
  per-session rate-limit). Email preferences + Danger Zone
  rewritten with primitives (Delete Account remains
  non-destructive — true destructive deletion is Phase 13).
- **Comprehensive billing scenario test matrix** — the user's
  explicit ask. 25 integration tests covering all 8 subscription
  states (never trialled / trialing / trial-expired / active /
  cancelling-in-grace / past-due / expired / comped), plan-tier
  gating (Starter / Pro / Max → `hasContractsAccess`), Stripe
  Connect identity, and the 5-couple cap (`enforce_starter_
  couple_limit` Postgres function — fires for Starter / past-due
  / expired; uncapped for Pro / Max / trialing / comped; blocks
  the §7.4 user_metadata escalation bypass).
- **Auth schema unit tests** — 33 tests pinning each Zod schema's
  accept/reject behaviour including the open-redirect rejection
  and password complexity rule.
- **Phase 1 stats:** 114 unit tests (+33 new), 34 integration
  tests (+25 new billing scenarios + 10 couple-cap). Lint budget
  ratcheted DOWN 91 → 86 errors / 849 → 826 warnings. Strict
  budget stays 295.

**Out of Phase 1** (explicit): the Billing UI rewrite, Stripe
webhook hardening, Stripe Checkout/Portal/Connect routes — all
move to Phase 2 alongside Payments. The sidebar admin-link
cosmetic `user_metadata` read is the only remaining read of that
bag on dashboard surfaces; tracked for Phase 13.



### Claude system upgrade (Phase 0.9)

The foundation finale: refresh every piece of Claude infrastructure
to reflect the post-0.8 reality so future page-hardening PRs work off
accurate docs and well-scoped agents.

- **`.claude/CLAUDE.md`** rewritten end-to-end. Locked decisions
  named, layering rule + comment style + DoD summary, the §7.4
  entitlements model, the API-route conventions (Zod / rate-limit /
  cron-auth / no-service-role-leak), the lint + strict-type ratchet
  pattern, the post-§7.9 migration-deploy flow, agent + slash-command
  catalog. The obsolete "minimal MVP / do not build automation"
  framing is gone.
- **4 new specialised agents** in `.claude/agents/`:
  - `security-reviewer` — applies the per-page security checklist
    and the §7.4 / 0.8b entitlements model; outputs P0/P1/P2/P3
    findings with file:line + fix + pinning test.
  - `test-runner` — runs the full pyramid (typecheck, strict,
    lint:gate, unit, integration, build, e2e) and triages by fixing
    the app; ratchets budgets DOWN when violations drop.
  - `design-system-auditor` — token + primitive compliance,
    dark-mode regressions, mobile responsiveness; flags off-token
    colours and native HTML form controls.
  - `db-migration` — focused migration-writing specialist; knows
    the `@ALLOW_DESTRUCTIVE` marker, the from-zero replay rule,
    idempotent backfills, the INSERT-trigger pattern, and the CI
    `supabase db push` deploy flow.
- **Slash commands**:
  - `/ship-check` upgraded to enforce the **full §5 DoD** (types +
    comments + tests + design system + L/E/E states + mobile +
    architecture + security checklist + observability + lint + docs
    + build). Reports pass/fail per item with file:line.
  - `/harden-page` added — the canonical per-page hardening
    workflow. Scope identification → gap report → types →
    architecture → design system → security → tests →
    observability → docs → /ship-check → PR. Dispatches the 4 new
    agents where they fit.
- **Docs refreshed:**
  - `authentication.md` rewritten — the two-bag model
    (user_metadata + app_metadata), the helper as canonical, the
    INSERT trigger mechanics, the broken admin-override RLS pattern
    explicitly called out as forbidden.
  - `database-schema.md` — User Data section acknowledges the
    user_metadata + app_metadata split; the `get_public_invoice`
    note for `stripe_connect_enabled` flagged as a tracked
    residual.
  - `page-specs.md` — Settings page entries reflect the entitlement
    writes going through `app_metadata` (not `user_metadata`);
    Invoice modal references `stripeConnectEnabled(user)` via the
    helper.
  - Older `database` agent refreshed to point migration work at
    the new `db-migration` agent.

Phase 0 ends here. Phase 1 begins with **Auth & account** per
roadmap §4: hardening login, signup, reset/update-password,
middleware, paywall — the gateway to everything else.



### user_metadata privilege fix (Phase 0.8b) — §7.4 resolved

The centerpiece of the security work. Every entitlement read/write
previously trusted user-writable `user_metadata`; an attacker could
self-elevate to admin, bypass the paywall, or alter Stripe Connect
identity via `supabase.auth.updateUser({ data: … })`.

Landed in this PR:

- **`@/lib/auth/entitlements`** — single source of truth for all
  entitlement reads (account_type, subscription_*, stripe_*,
  is_beta_user). app_metadata wins; falls back to user_metadata only
  for users not yet migrated (sentinel: `app_metadata.account_type`).
  15 unit tests pin the escalation blocks.
- **`updateEntitlements(admin, userId, patch)`** — single write path
  into `app_metadata`. All write sites migrated (admin actions,
  Stripe webhook 4 paths, Stripe checkout, Stripe Connect callback).
- **DB migration** `20260521000000_backfill_app_metadata_entitlements`:
  idempotent UPDATE copies 11 entitlement fields user_metadata →
  app_metadata for every existing user. INSERT trigger mirrors the
  same fields for every new signup (no code change to signup flow
  needed). Re-authored `enforce_starter_couple_limit` to read from
  `app_metadata` (blocks the couple-cap bypass).
- **Integration tests** (`tests/integration/rls/entitlements-
  escalation.test.ts`): 4 tests against the live local DB proving
  the attacker writes don't grant admin or paid features, and that
  server writes via `app_metadata` DO work. The canonical regression
  test for §7.4.
- **lib/payments/subscription** demoted to a thin re-export of the
  entitlements helper; the deprecated test file removed.
- Lint warning budget ratcheted down 880 → 849.

Residual (per-page, not security-critical) documented in
`.claude/docs/security.md`: 5 public-RPC reads of bank/business
fields (user-owned, not escalation surface) + stripe_connect_enabled
(UX flip only), sidebar admin-link visibility (display only —
middleware enforces), and the user_metadata fallback inside the
helper (kept during the JWT-refresh soak window; cleanup follow-up).

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
