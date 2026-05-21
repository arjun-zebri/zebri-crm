# Zebri — Security

Source of truth for the production security posture. Updated each
hardening phase. The page-by-page Definition of Done (roadmap §5)
references this doc for the per-page security checklist.

---

## Active findings

### 🟥 P0 — user_metadata privilege escalation (deferred to 0.8b)

`account_type` (incl. `admin`), `subscription_*`, `stripe_connect_*`,
and bank-detail fields live in **user-writable** Supabase
`user_metadata`. They are consumed by:

1. **Middleware** (`middleware.ts`) — `account_type === 'admin'`
   bypass + `subscription_status` paywall check.
2. **`lib/payments/subscription`** — entitlement function reads from
   user_metadata.
3. **~5 Postgres RPCs** (`get_public_quote`, `get_public_invoice`,
   `get_public_contract`, `get_portal_data`, branding/invoice/quote
   formatters) — read `raw_user_meta_data` for bank account name/BSB/
   number, `stripe_connect_enabled`, business_name → surfaced on the
   client-facing public pages.

A user can call `supabase.auth.updateUser({ data: {…} })` and set
their own `account_type` to `admin`, set `subscription_plan` to `pro`,
or alter the bank details displayed on their public invoices.

**Resolved 2026-05-21 in Phase 0.8b.** Migration
`20260521000000_backfill_app_metadata_entitlements.sql`:
- one-shot UPDATE backfilling 11 entitlement fields from
  `raw_user_meta_data` → `raw_app_meta_data` for every existing user
  (idempotent; `app_metadata.account_type` is the migration sentinel);
- INSERT trigger on `auth.users` that mirrors the same fields for every
  new signup (so the existing `supabase.auth.signUp({ data })` flow
  keeps working without code changes);
- re-authored `enforce_starter_couple_limit` to read from
  `raw_app_meta_data` (blocks the cap-bypass).

Code: `@/lib/auth/entitlements` is the single source of truth for
every read; `updateEntitlements()` is the single write path. All
middleware + admin + Stripe write/read paths migrated. 15 unit tests
+ 4 integration tests pin the escalation blocks end-to-end against
the real DB. `lib/payments/subscription` is now a thin re-export of
the helper.

**Residual (per-page, NOT security-critical):**
- 5 public-RPC reads of `raw_user_meta_data` for `business_name` (user
  owns), `bank_*` (user owns), `stripe_connect_enabled` (UX flip on
  public Pay button only — Stripe rejects on charge if no Connect
  account). Tracked for Payments page hardening (Phase 2).
- Sidebar admin-link visibility (display only — middleware enforces).
  Tracked for Admin / Shadow phase (Phase 13).
- ~~`user_metadata` fallback inside the helper~~ — **resolved in
  Phase 1** (2026-05-21). The fallback was removed once the JWT-
  refresh soak completed; `app_metadata` is now the sole source of
  truth in both the helper and the `enforce_starter_couple_limit`
  Postgres function.

---

## Phase 0.8a — security infrastructure (shipped)

### HTTP security headers (`next.config.ts`)

Applied to every route + asset response:

| Header | Value |
|---|---|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=()` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` *(prod only — dev http://localhost stays plain)* |

**`Content-Security-Policy` deferred.** CSP needs per-page testing
against Stripe (`js.stripe.com`), Supabase (`<project>.supabase.co`),
the inline theme-bootstrap script from 0.5b, and Radix portals.
Starting with a `Content-Security-Policy-Report-Only` rollout will
happen in a later tightening phase.

### Webhook signature verification — audit

| Route | Status | Notes |
|---|---|---|
| `app/api/stripe/webhook/route.ts` | ✅ Verifies `stripe-signature` via `stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET`. |
| `app/api/stripe/connect/callback/route.ts` | n/a — Stripe Connect OAuth callback (user-initiated redirect, not server-signed webhook). State-param verification belongs to the Payments page-hardening phase. |
| `app/api/stripe/invoice-payment/route.ts` | n/a — public payment-link route; auth via `share_token` (capability URL). Rate-limit added per-page in Payments hardening. |
| `app/api/resend/webhook/route.ts` | **Does not exist** — Resend bounce/delivery webhooks not wired. Tracked in `alerts.md` matrix as a planned alert source. |

### Cron-secret enforcement

Two cron-triggered routes:

| Route | Schedule (`vercel.json`) |
|---|---|
| `/api/cron/expire-contracts` | `0 22 * * *` |
| `/api/email/send-contract-reminders` | `15 22 * * *` |

Both now use the shared helper **`@/lib/api/cron-auth`** —
`isCronAuthorized(request)` — which:

- Reads `CRON_SECRET` from env, fails closed if unset.
- **Constant-time** comparison of the `Authorization: Bearer …`
  header against the secret (no timing-attack surface).
- Pure-JS impl, works in node + edge + middleware runtimes.

Unit tests: `tests/unit/lib/api/cron-auth.test.ts`.

### Service-role-key leak guard

`scripts/check-no-service-role-in-client.mjs` scans every file in
`app/`, `components/`, `lib/` and **fails CI** if any file containing
`'use client'` references `SUPABASE_SERVICE_ROLE_KEY` or the new-style
`sb_secret_` prefix. Wired into `ci.yml` as a required step.

Today's state: zero offenders. The service-role key is exclusively
used in server routes / server actions / server-side lib modules:

- `app/admin/actions.ts`
- `app/api/portal/upload/route.ts`
- `app/api/stripe/{checkout,webhook,invoice-payment,connect/callback}/route.ts`
- `lib/admin/admin-analytics.ts`

### Input validation — `@/lib/api/validate`

Zod-backed helpers (`parseJsonBody`, `parseSearchParams`) that return
a tagged `{ ok, data } | { ok: false, response }` so route handlers
don't reinvent the `try { JSON.parse } catch → 400` boilerplate.
Issues are sanitised to `{ path, code, message }` — never the
offending value.

**Per-page adoption:** every API route added or hardened from 0.8a
onward must validate its body / query params with Zod. Existing
routes burn down during their hardening phases.

### Rate-limit infrastructure — `@/lib/api/rate-limit`

`inMemoryLimiter({ windowMs, max })` returns a `Limiter` with
`.check(key)`. Process-local (best-effort on serverless) — sufficient
for blocking accidental loops, scraping, naive enumeration. Upgrade
to Upstash Redis before public launch / when traffic warrants. The
interface stays stable so call sites don't change.

`ipOf(request)` extracts a client IP from `x-forwarded-for` /
`x-real-ip` to use as the limiter key.

**Per-page adoption** during hardening of: `/api/stripe/invoice-payment`,
`/api/contract/{sign,decline}`, `/api/portal/upload`, auth routes
(login/signup/reset).

---

## RLS coverage matrix

All app tables enable RLS. The owner column is `user_id uuid` on each.
The base policy is `auth.uid() = user_id` for SELECT/INSERT/UPDATE/
DELETE (sampled clean across the migrations).

| Table | RLS enabled | Owner column | Integration test | Per-page phase |
|---|---|---|---|---|
| `couples` | ✅ | `user_id` | ✅ `tests/integration/rls/couples.test.ts` (5 tests) + `tests/integration/billing/couple-cap.test.ts` (10 tests — Starter cap enforcement) | Couples & Events |
| `events` | ✅ | `user_id` | ☐ | Couples & Events |
| `contacts` | ✅ | `user_id` | ☐ | Contacts |
| `tasks` | ✅ | `user_id` | ☐ | Tasks |
| `quotes` | ✅ | `user_id` | ☐ | Payments |
| `quote_items` | ✅ | `user_id` | ☐ | Payments |
| `quote_templates` | ✅ | `user_id` | ☐ | Payments |
| `quote_template_items` | ✅ | `user_id` | ☐ | Payments |
| `invoices` | ✅ | `user_id` | ☐ | Payments |
| `invoice_items` | ✅ | `user_id` | ☐ | Payments |
| `contracts` | ✅ | `user_id` | ☐ | Contracts |
| `contract_templates` | ✅ | `user_id` | ☐ | Contracts |
| `couple_statuses` | ✅ | `user_id` | ☐ | Couples & Events |
| `couple_contacts` | ✅ | (join via `couple_id`) | ☐ | Couples & Events |
| `event_contacts` | ✅ | (join via `event_id`) | ☐ | Couples & Events |
| `vendors` (legacy alias of contacts) | ✅ | `user_id` | ☐ | Contacts |
| `event_vendors` (legacy) | ✅ | (join) | ☐ | Contacts |
| `task_groups` | ✅ | `user_id` | ☐ | Tasks |
| `timeline_items` | ✅ | `user_id` | ☐ | Timeline |
| `timeline_templates` | ✅ | `user_id` | ☐ | Timeline |
| `timeline_template_items` | ✅ | `user_id` | ☐ | Timeline |
| `portal_files` | ✅ | `user_id` | ☐ | Client Portal |
| `portal_people` | ✅ | `user_id` | ☐ | Client Portal |
| `portal_songs` | ✅ | `user_id` | ☐ | Client Portal |
| `portal_song_categories` | ✅ | `user_id` | ☐ | Client Portal |
| `stripe_customers` | ✅ | `user_id` | ☐ | Payments |
| `user_branding` | ✅ | `user_id` | ☐ | Branding |

**Per-page DoD requires** an integration test of the
`couples.test.ts` shape (owner reads ok / other tenant cannot
SELECT|UPDATE|DELETE / anon cannot read) for every owned table the
phase touches. Tick the matrix box when a test lands.

---

## Per-page security checklist (DoD addendum)

When hardening any page, the per-page Definition of Done already
covers most things. The security-specific items:

- [ ] Every API route + server action validates inputs with `@/lib/api/validate` (Zod).
- [ ] Money / auth / public routes apply `@/lib/api/rate-limit`.
- [ ] Webhook handlers verify signatures.
- [ ] Cron routes use `@/lib/api/cron-auth`.
- [ ] Owned tables touched by the phase get an integration RLS test (tick the matrix above).
- [ ] No `SUPABASE_SERVICE_ROLE_KEY` reference outside server-only modules (CI gate enforces).
- [ ] Any new `app_metadata` / `profiles` field follows the §7.4 / 0.8b model (server-only writable, JWT-readable or RLS-restricted).
- [ ] No new `dangerouslySetInnerHTML` / `eval` / `Function(...)` without explicit review note in the PR.
