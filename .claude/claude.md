# Zebri — Claude Development Guide

Zebri is a **production CRM for Wedding MCs** (Australia). Workflow:
Couple → Enquiry → Quote → Booked → Wedding → Follow-up. Feel: minimal,
fast, calm, modern. Real users, real money, real bookings.

## Production-readiness initiative — READ FIRST

This codebase is being hardened from prototype to production grade in
**phases**. The roadmap, locked decisions, phase order, and the
per-page Definition of Done live in
**`.claude/docs/production-readiness.md`** — that doc is the source of
truth. When CLAUDE.md and the roadmap conflict, the roadmap wins.

**Status (2026-05-21):** Phase 0 foundation complete (0.0 → 0.9).
Phase 1+ is per-page hardening, ordered by risk × value. Each page
must hit the §5 Definition of Done before it's "done".

**Locked decisions** that govern how we work (full table in roadmap §1):

- Sequencing: foundation first, then page-by-page.
- Promotion: PR → `staging` → verify → `main` (production).
- Comment style: **TSDoc on every exported API + why-comments on
  non-obvious logic** (full rationale: `CONTRIBUTING.md`).
- Observability: **Slack-only via `sendAlert()`** (Sentry deferred).
- Test DB: **local Supabase** (`supabase start`, Docker) for unit +
  integration; real schema + real RLS.
- Type safety: generated `Database` types + ratcheted strict tsc.
- Migration deploys: **CI `supabase db push` only** — never the
  Supabase web SQL editor (ledger drift, see roadmap §7.9).

## Tech stack

- **Frontend:** Next.js 16 (App Router, Turbopack) · React 19 ·
  Tailwind 4 (`@theme inline` tokens with `:root`).
- **Backend:** Supabase (Postgres + Auth + Storage), Row-Level
  Security on every owned table.
- **Payments:** Stripe (subscriptions) + Stripe Connect (MC → couple
  card payments via the public invoice page).
- **Email:** Resend.
- **Hosting:** Vercel (app + cron). Slack for alerts.
- **Libraries:** `@tanstack/react-table`, `@tanstack/react-query`,
  `@radix-ui/*`, `lucide-react`, `dnd-kit`, `zod`, `recharts`.
- **Testing:** Vitest 3 (unit + integration projects) · React
  Testing Library · Playwright (e2e, Pixel 5 + iPhone 12).

## Current scope (everything below is in scope for hardening)

Authentication & subscriptions · Couples (+ couple-owned Events) ·
Contacts · Tasks · Payments (Quotes, Invoices) · Contracts (e-sign) ·
Client Portal (public, token-gated) · Timeline · Branding editor ·
Workflows / automation · Admin + Shadow mode · Email pipeline ·
Stripe Connect · Slack alerts · Cron jobs.

The original "DO NOT build: Analytics / Automation / …" rule from the
MVP is **obsolete** — those features exist and ship to paying users.

## App layout

Sidebar (240px fixed) + main content. Sidebar nav: Dashboard, Couples,
Calendar, Tasks, Contacts, Payments, Branding, Settings. Admin link is
shown only when `isAdmin(user)` returns true (read via the entitlements
helper — see Auth model below).

## Repo structure (the layering rule)

Full rationale in **`CONTRIBUTING.md`**. Summary:

- **`app/`** — Next.js App Router. Pages are **orchestrators only** —
  fetch data and compose sections; no form logic, no mutations, no
  business rules inline. Section components are co-located with the
  page (`app/(dashboard)/couples/couple-overview.tsx`, etc.).
- **`components/ui/`** — shared primitive components (Button, Input,
  Select, Loading, Empty, ErrorState, ThemeToggle, …).
- **`components/<feature>/`** — shared composite feature components
  (e.g. `components/builders/` — the Quote / Invoice / Contract
  modals reused across `/payments` and the couple profile).
- **`lib/`** — domain modules, pure functions only, no React:
  - `lib/supabase` — client / server / middleware Supabase clients.
  - `lib/auth/entitlements` — **single source of truth** for every
    "is admin?" / "are they paid?" / "have they got Connect?" read,
    and `updateEntitlements()` is the single write path. See
    `.claude/docs/authentication.md`.
  - `lib/api/{cron-auth,validate,rate-limit}` — security
    primitives every API route should reach for.
  - `lib/payments`, `lib/email`, `lib/alerts`, `lib/pdf`,
    `lib/contracts`, `lib/admin`, `lib/branding`, `lib/utils`.
- **`types/`** — shared domain types (`@/types/couple`,
  `@/types/event`, …) + generated `types/database.ts` from
  `supabase gen types`. Import the specific module, not a barrel.

**Import rules:** prefer `@/`-absolute paths over deep relative
imports (`../../`). No React in `lib/` (ratcheted lint warning).

## Component rules

- ~150 lines max per file — split when larger.
- Tailwind only — no inline `style={{}}`, no CSS modules.
- Non-button interactive elements (clickable rows, cards, `role="link"`
  wrappers) need `cursor-pointer`. Real `<button>` elements do not: a
  base rule in `globals.css` covers every one of them.

## THE DESIGN SYSTEM IS MANDATORY

**`/design-system` is the source of truth for every visual decision.**
Run the dev server and open it before writing any UI. It renders every
token, primitive, form pattern and page pattern from its real source,
with the code that produced each one.

**The rule, in order:**

1. **Use the primitive.** If `components/ui/` has it, import it. Never
   hand-write a `<button>`, `<input>`, `<select>`, dropdown, menu,
   modal, card or page title.
2. **Extend the primitive.** If one nearly fits, add the variant or prop
   to the primitive itself, add it to `/design-system`, then use it. A
   one-off `className` override on a call site is drift.
3. **Add a new primitive.** If nothing fits, build it in
   `components/ui/`, give it TSDoc + unit tests, and add an entry to
   `/design-system` **in the same PR**. Only then use it.

**Never** reach for a raw Tailwind value when a token exists. No
`text-sm`, `text-xs`, `rounded-lg`, `rounded-xl`, `text-gray-500`,
`bg-white`, `border-gray-200`. These were swept out of the codebase;
reintroducing them puts two systems on screen at once.

A PR that hand-rolls markup for something already in `/design-system`
is not accepted. If you cannot find what you need there, that is a gap
in the design system to be filled, not a licence to improvise.

## Design tokens (Tailwind 4 `@theme inline`)

Declared in `app/globals.css`; the full tables live in
`.claude/docs/frontend-design.md` and every one is rendered on
`/design-system`. The ESLint rule `zebri/no-off-token-color` warns when
an arbitrary-value colour utility (`bg-[#…]`, `text-[#…]`) appears.

- **Surfaces:** `bg-surface`, `bg-surface-muted`, `bg-surface-emphasis`,
  `bg-card`
- **Text:** `text-text`, `text-text-muted`, `text-text-subtle`,
  `text-text-inverse`
- **Borders:** `border-border`, `border-border-strong`
- **Brand:** `bg-brand-fg`, `text-brand-fg`, `bg-brand-bg`
- **Semantic:** `success`, `danger`, `warning`, `info`
- **Radius:** `rounded-control` (6px, everything with corners) and
  `rounded-pill` (round things). There is no third radius.
- **Type:** `text-display`, `text-section`, `text-body`. Three sizes,
  each carrying its own line-height. There is no caption size:
  secondary text is `text-text-muted` / `text-text-subtle`, not smaller.
- **Icons:** Lucide, `strokeWidth={1.5}`, always.
- **Elevation:** `shadow-sm` resting, `shadow-lg` floating,
  `shadow-xl` modal.
- **Busy / copied states:** a control never changes size when clicked.
  `<Button loading>` overlays the spinner on the label; `CopyButton`
  reserves the wider label. Never write
  `{saving ? 'Saving…' : 'Save'}` inside a button.
- **Control height:** one, 32px (`h-8`). `Button`, `Input`, `Select` and
  `DatePicker` have no `size` prop — they are all the same height so a
  toolbar or form row lines up with no effort. Never hand-set `h-9`,
  `h-10` or `py-2` on a control to make it "match".

Tailwind 4 shifted its default grays, so `text-gray-900` and
`text-text` are **not** the same colour. Always use the token.

## Auth model (post-§7.4 / Phase 0.8b)

The §7.4 privilege-escalation hole is closed. **Never read entitlement
fields directly from `user.user_metadata`**. Always go through the
helper:

```ts
import {
  isAdmin, subscriptionStatus, isSubscribed,
  stripeCustomerId, hasContractsAccess, updateEntitlements,
} from '@/lib/auth/entitlements'

if (isAdmin(user)) { … }
if (subscriptionStatus(user) === 'past_due') { … }
```

Why: `user_metadata` is **user-writable** (`auth.updateUser({ data })`).
Trust-level fields (`account_type`, `subscription_*`, `stripe_*`,
`is_beta_user`) live in `app_metadata` — server-only writable,
JWT-readable. The helper reads from `app_metadata` and ignores
`user_metadata` for any migrated user (sentinel:
`app_metadata.account_type`).

Full details in `.claude/docs/authentication.md` and
`.claude/docs/security.md` §7.4.

## API route conventions (post-0.8a)

Every new API route or server action must:

- Validate input with `@/lib/api/validate` (Zod) — returns a tagged
  `{ ok, data } | { ok: false, response }` result.
- Use `@/lib/api/rate-limit` if it's an auth, money, public, or
  upload route.
- Use `@/lib/api/cron-auth` `isCronAuthorized(request)` if it's
  cron-triggered (constant-time bearer comparison).
- Verify webhook signatures at the boundary (Stripe webhook does
  this already; copy the pattern for any new provider).
- Never reference `SUPABASE_SERVICE_ROLE_KEY` in a file containing
  `'use client'` — CI gate
  (`scripts/check-no-service-role-in-client.mjs`) fails the build.

Legacy routes burn down during their page-hardening phase (the
ratchet pattern — see Lint & Strict-type gates below).

## Database conventions

- Owner column on every table: `user_id uuid not null references
  auth.users(id) on delete cascade`.
- RLS enabled on every owned table. Base policy: `auth.uid() =
  user_id` for SELECT/INSERT/UPDATE/DELETE. The RLS coverage matrix
  + which tables have integration tests is in
  `.claude/docs/security.md`.
- `snake_case` columns. Never rename existing columns (breaks API
  contracts).
- `text` over `varchar`. Foreign keys get an index.
- Migrations are **the source of truth**. Schema changes go through
  the CI deploy workflow (`supabase db push`). Manual SQL-editor
  changes are forbidden (see roadmap §7.9 ledger fix).
- Destructive SQL (`DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, …)
  requires an explicit `-- @ALLOW_DESTRUCTIVE: <reason>` marker, or
  `scripts/check-migrations.sh` rejects the deploy.

## Lint & strict-type gates (the ratchet pattern)

We don't bulk-fix legacy debt — it bleeds risk. New code must be
clean; existing violations burn down per-page during hardening.

- **`npm run typecheck`** — base `tsconfig.json` (strict). **Must
  stay at 0** errors. CI fails the PR otherwise.
- **`npm run typecheck:strict`** — `tsconfig.strict.json` adds
  `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`. Budget
  enforced by `scripts/typecheck-strict-gate.mjs` — must
  monotonically decrease. New code must be clean under strict.
- **`npm run lint:gate`** — `scripts/lint-gate.mjs` enforces the
  ESLint error/warning budget (errors → 0 first, then warnings).
  Only ever decrease the budget.

When a page-hardening PR reduces these numbers, **ratchet them
DOWN** in the gate scripts to lock the gain in.

## Testing rules

- All features must work on **desktop and mobile** (Pixel 5 + iPhone
  12). Use Tailwind responsive prefixes — never raw CSS media
  queries.
- **Three layers**, fully wired up:
  - Unit: `tests/unit/` (Vitest + RTL)
  - Integration: `tests/integration/` (Vitest against **local
    Supabase** — real schema, real RLS)
  - E2E: `tests/e2e/` (Playwright, Pixel 5 + iPhone 12 + desktop)
- **Fix the app, never patch the test.** A test failure = a bug.
- Prefer semantic selectors: `getByRole` > `getByLabel` > `getByText`
  > `data-testid`.
- Full conventions: `.claude/docs/testing.md`.

## Per-page Definition of Done

Every page-hardening PR has to satisfy the full bar in
`.claude/docs/production-readiness.md` §5. Quick summary — but the
roadmap is the canonical list:

- [ ] No `any`; uses generated DB types end to end.
- [ ] TSDoc on every exported function / type / module; why-comments
      on non-obvious logic.
- [ ] Unit + integration + e2e tests green; meaningful coverage.
- [ ] Integration test proves cross-tenant RLS denial for every
      owned table the page touches (tick the matrix in `security.md`).
- [ ] Design-system compliant (tokens + primitives, zero ad-hoc
      styles).
- [ ] Explicit **loading**, **empty**, and **error** UI states.
- [ ] Works on desktop **and** mobile.
- [ ] No console errors; alerts wired up via `sendAlert()`.
- [ ] Components ≤ ~150 lines; page is an orchestrator.
- [ ] Relevant `.claude/docs/*` updated to reflect reality.
- [ ] Ships as its own PR through `staging` → `main`.

Plus the per-page security checklist in `security.md` (Zod on inputs,
rate-limit on money/auth/public, webhook signatures, cron-auth, RLS
test, no service-role-key leak, app_metadata model for new
entitlements).

## Brand assets

Official assets live in `.claude/brand_assets/` — copy to `public/`
when needed. Never recreate the logo or wordmark.

## Document maintenance

When a change touches one of these areas, update the matching doc
in `.claude/docs/` **in the same PR**:

| Change area               | File to update                                   |
|---------------------------|--------------------------------------------------|
| UI / design system        | `frontend-design.md` **and** add/extend the entry on `/design-system` |
| Database schema           | `database-schema.md`                             |
| Page behaviour            | `page-specs.md`                                  |
| Auth / entitlements model | `authentication.md`                              |
| Billing / Stripe          | `payments.md`                                    |
| Slack alerts              | `alerts.md`                                      |
| Tests / selectors         | `testing.md`                                     |
| Security posture          | `security.md`                                    |
| CI/CD                     | `cicd.md`                                        |
| Roadmap status            | `production-readiness.md`                        |

## Specialised agents

Spawn one via the Agent tool when its scope matches the task:

- **`frontend`** — UI specialist. React / TypeScript / Tailwind only.
- **`database`** — SQL migrations + RLS policies. Knows the post-§7.4
  `app_metadata` model and the migration-safety markers.
- **`security-reviewer`** — applies the `security.md` per-page
  checklist. Reads writes / RPCs / route handlers for escalation,
  validation, rate-limit, and webhook-signature gaps.
- **`design-system-auditor`** — token + primitive compliance. Flags
  off-token colours, raw HTML form controls, missing primitives.
- **`test-runner`** — runs the full test pyramid (`npm test`,
  `npm run typecheck`, `npm run typecheck:strict`, `npm run lint:gate`,
  `npx playwright test`) and triages failures by fixing the app.

## Slash commands

- `/new-page` — scaffold a new page (loads `page-specs.md`).
- `/new-component` — create a UI component (loads
  `component-library.md`).
- `/db-migration` — write a schema migration (loads
  `database-schema.md`; enforces the `@ALLOW_DESTRUCTIVE` rule).
- `/fix-ui` — audit/fix for design-system compliance.
- `/add-alert` — add a Slack alert (loads `alerts.md`).
- `/ship-check` — enforce the full per-page Definition of Done.
- `/harden-page` — run a complete page through the page-hardening
  flow (DoD + security checklist).
- `/test` — run Playwright tests (desktop + mobile) and fix issues.

## Always-loaded context

@.claude/docs/frontend-design.md
@.claude/docs/component-library.md
@.claude/docs/database-schema.md
@.claude/docs/product-principles.md
@.claude/docs/production-readiness.md
