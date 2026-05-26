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
| `app/api/stripe/webhook/route.ts` | ✅ Verifies `stripe-signature` via `stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET` (or `STRIPE_CONNECT_WEBHOOK_SECRET` when `stripe-account` header is present). **Phase 2A:** idempotent via `stripe_events` ledger, per-event Zod validation, replay alerting at 3+/60s. |
| `app/api/stripe/connect/callback/route.ts` | **Deleted in Phase 2D.1** — embedded Connect flow has no redirect, so there's no callback to sign. The OAuth-style state-HMAC plan in `phase-2-payments.md` §6 is obsolete. |
| `app/api/stripe/connect/route.ts` | ✅ POST, auth required, rate-limited 5/min/IP. Creates the Express account + seeds mirror row. Idempotent — returns the existing accountId for already-bound users. |
| `app/api/stripe/connect/account-session/route.ts` | ✅ POST, auth required, rate-limited 30/min/IP. Creates a fresh Stripe Account Session for the embedded onboarding component. |
| `app/api/stripe/connect/disconnect/route.ts` | ✅ POST, auth required, rate-limited 5/min/IP. **Replaces the §7.4 client-side `user_metadata` write** — clears `app_metadata.stripe_connect_*` server-side via `updateEntitlements`. |
| `app/api/stripe/connect/status/route.ts` | ✅ GET, auth required. Reads `connect_accounts` for the current user via `readConnectAccount`. RLS-scoped. |
| `app/api/stripe/invoice-payment/route.ts` | n/a — public payment-link route; auth via `share_token` (capability URL). Rate-limit + signed return URLs added in PR 2D.2. |
| `app/api/resend/webhook/route.ts` | **Does not exist** — Resend bounce/delivery webhooks not wired. Tracked in `alerts.md` matrix as a planned alert source. |

### Authenticated Stripe routes — validation + rate-limit audit (Phase 2A)

| Route | Zod | Rate-limit | Notes |
|---|---|---|---|
| `app/api/stripe/checkout/route.ts` | ✅ `z.object({ plan: z.enum(['pro','max']) })` | ✅ 5/min/user via `STRIPE_RATE_LIMITS.checkout`; hit fires `stripe_rate_limit_hit` | Beta users get `STRIPE_BETA_PRICE_ID` via `isBetaUser(user)` |
| `app/api/stripe/portal/route.ts` | n/a — no body | ✅ 10/min/user | 400 when `stripeCustomerId(user)` returns null |
| `app/api/stripe/billing-history/route.ts` | n/a — GET, no params yet | ✅ 30/min/user | Cursor-based pagination deferred to PR 2D |

### Payments server actions — validation audit (Phase 2C.2)

The Quote + Invoice builder modals now route every mutation through
typed server actions in `app/(dashboard)/payments/actions.ts`. RLS
provides cross-tenant denial; the Zod schemas reject malformed
inputs at the boundary. No rate-limit needed (authenticated,
single-user, no public abuse vector — and money paths into Stripe
already carry their own limits in `STRIPE_RATE_LIMITS`).

| Action | Zod | Notes |
|---|---|---|
| `saveQuoteAction` | ✅ `saveQuoteSchema` (quoteId nullable, coupleId uuid, items[]) | Transactional: update quote + replace quote_items |
| `saveInvoiceAction` | ✅ `saveInvoiceSchema` (invoiceId nullable, coupleId uuid, payment schedule, items[]) | Writes `quantity=1, unit_price=amount` for forward-compat with existing invoice_items columns |
| `deleteQuoteAction` | ✅ `z.uuid()` | Cascade handles items |
| `deleteInvoiceAction` | ✅ `z.uuid()` | Cascade handles items |

Status-change mutations (mark paid / revert / cancel) stay inline
in the modals as one-line UPDATEs — they're RLS-protected by the
session client and don't justify their own server actions.

### Email-send routes — validation + rate-limit audit (Phase 2C)

These routes blast a couple's inbox. The risk is loop / spam from a
buggy client or compromised session — Resend will rate-limit us
anyway, but we cap on our side so the alert fires on our schedule.

| Route | Zod | Rate-limit | Notes |
|---|---|---|---|
| `app/api/email/send-quote/route.ts` | ✅ `z.object({ quoteId: z.uuid() })` | ✅ 5/min/user via `EMAIL_RATE_LIMITS.sendQuote`; hit fires `email_rate_limit_hit` | RLS scopes the quote SELECT to the authenticated user |
| `app/api/email/send-invoice/route.ts` | ✅ `z.object({ invoiceId: z.uuid() })` | ✅ 5/min/user via `EMAIL_RATE_LIMITS.sendInvoice` | Same RLS scoping |
| `app/api/email/send-contract/route.ts` | ☐ Phase 3 (Contracts) | ☐ Phase 3 | Not in 2C scope |
| `app/api/email/send-contract-reminders/route.ts` | n/a (cron) | n/a (cron-secret gated) | Already uses `isCronAuthorized` |

### Public RPC audit — `get_public_quote` / `get_public_invoice` (Phase 2C)

These two `security definer` functions back the public-facing
`/quote/[token]` and `/invoice/[token]` pages. Couples aren't
authenticated; the share token IS the capability. Findings:

**Tokens (✅ acceptable):**
- `share_token` column is `uuid` with `gen_random_uuid()` default —
  UUID v4 ≈ 122 bits of entropy, unguessable in practice (10⁹ guesses/s
  would take ~10²¹ years to hit a single token).
- Not sequential, not predictable.
- Revocation via `share_token_enabled = false` (RPC `where` clause
  requires it true). The original token stays in the DB so an
  enable/disable toggle works without re-issuing URLs.

**Field selection (✅ minimal):**
- `get_public_quote` returns: id, title, quote_number, status,
  subtotal, tax_rate, discount_*, notes, expires_at, accepted_at,
  couple_name, items. No user_id, no stripe_customer_id, no
  internal flags leaked.
- `get_public_invoice` returns the same shape + due_date / payment
  schedule fields + bank details (account_name, bsb, account_number)
  + `stripe_connect_enabled`. Bank details are intentional — the
  couple needs them to pay via bank transfer. No stripe_customer_id,
  no Stripe account ID, no other-couple data.

**🟨 §7.4 stale read — tracked for PR 2D:**

`get_public_invoice` currently reads `stripe_connect_enabled` and
the bank fields from `auth.users.raw_user_meta_data`. Post §7.4,
trust-level entitlement fields (`stripe_connect_*`) live in
`raw_app_meta_data` — the RPC is reading the old location.

Impact: **low**. The worst case is a user writing
`stripe_connect_enabled=true` to their own `user_metadata` and
seeing the "Pay with card" button render on a public invoice.
Clicking it calls `/api/stripe/invoice-payment` which reads from
`app_metadata` via the entitlements helper — the payment would
fail there. So the misleading UX is real; the security boundary
holds.

**Fix lands in PR 2D** (Stripe Connect + public surfaces): switch
the RPC's `stripe_connect_enabled` read to `raw_app_meta_data`
alongside the Connect state-param HMAC work. Bank-detail reads
stay on `user_metadata` — those are user-owned PII, not
entitlement fields.

### Cron-secret enforcement

Three cron-triggered routes:

| Route | Schedule (`vercel.json`) |
|---|---|
| `/api/cron/expire-contracts` | `0 22 * * *` |
| `/api/email/send-contract-reminders` | `15 22 * * *` |
| `/api/cron/prune-stripe-events` | `0 3 * * *` (Phase 2A) |

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

### Public token-attempt limiter — `@/lib/api/public-token-limiter` (Phase 2D.2)

Sits in front of the unauthenticated share-token surfaces
(`/invoice/[token]`, `/quote/[token]`, `/portal/[token]`). Counts
**invalid** token attempts per IP — successful loads of a valid
token are free. Two cooperating bands:

- **Long window** — 60 invalid attempts / hour. Past that:
  `recordInvalidTokenAttempt` returns `allowed: false`; the caller
  renders `notFound()` instead of the friendly "unavailable" copy.
- **Burst window** — 10 invalid attempts / 60s. Crosses the
  threshold → one Slack alert (`public_token_attempt_burst`) per
  burst (deduped via an internal one-shot bucket — no spam on
  attempts 12, 13, 14, …).

Wired today: `/portal/[token]` (server component, easy hookup).
**Not yet wired** on `/invoice/[token]` / `/quote/[token]` — those
pages are client components that call `get_public_invoice` /
`get_public_quote` directly from the browser, so the limiter would
need a server-fetch refactor (convert to RSC + Client component
child for interactivity). Tracked as a follow-up. The
unique-share-token capability model is the primary defence; the
limiter is defence-in-depth and covers the highest-traffic public
surface (the portal) today.

### Authenticated Stripe routes — Phase 2D.2 additions

| Route | Zod | Rate-limit | Notes |
|---|---|---|---|
| `app/api/stripe/invoice-payment/route.ts` | ✅ `bodySchema` (invoiceId UUID, shareToken min/max, paymentType enum) | ✅ 10/min/IP via `inMemoryLimiter` | Generic 404 on missing-or-mismatched-token (no info leak). `success_url` carries `session_id={CHECKOUT_SESSION_ID}` for the payment-success re-verification. `metadata.connected_account_id` cross-checked on the success page. Stripe-failure path uses `logger.error`; raw error message NOT returned to the couple (returns generic 502). |
| `app/invoice/payment-success/page.tsx` | n/a (server component) | n/a | Server-side `stripe.checkout.sessions.retrieve(session_id, { expand: ['payment_intent'] })`. Five-check verification: invoice exists + MC has Connect account + session.metadata.invoice_id matches + session.metadata.connected_account_id matches + payment_intent.status === 'succeeded'. Any mismatch → notFound() + `payment_success_param_tampered` Slack alert. Idempotent. |

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
| `quotes` | ✅ | `user_id` | ✅ `tests/integration/rls/payments-tables.test.ts` (Phase 2C) | Payments |
| `quote_items` | ✅ | `user_id` | ✅ `tests/integration/rls/payments-tables.test.ts` (Phase 2C) | Payments |
| `quote_templates` | ✅ | `user_id` | ✅ `tests/integration/rls/payments-tables.test.ts` (Phase 2C) | Payments |
| `quote_template_items` | ✅ | `user_id` | ✅ `tests/integration/rls/payments-tables.test.ts` (Phase 2C) | Payments |
| `invoices` | ✅ | `user_id` | ✅ `tests/integration/rls/payments-tables.test.ts` (Phase 2C) | Payments |
| `invoice_items` | ✅ | `user_id` | ✅ `tests/integration/rls/payments-tables.test.ts` (Phase 2C) | Payments |
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
| `stripe_customers` | ✅ (RLS enabled, no policy — service-role only) | `user_id` | ✅ `tests/integration/rls/payments-tables.test.ts` (Phase 2C) | Payments |
| `stripe_events` | ✅ (RLS enabled, no policy — service-role only, Phase 2A) | n/a (system-global) | n/a | Payments |
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
