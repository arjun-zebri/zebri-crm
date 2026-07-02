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
| `app/api/email/send-template/route.ts` | ✅ `z.object({ coupleId, templateId?, inlineSubject?, inlineBody?, overrides, sendAnyway, attachmentFileIds })` | ✅ 5/min/user via `EMAIL_RATE_LIMITS.sendTemplate`; hit fires `email_rate_limit_hit` (`action: 'sendTemplate'`) | RLS scopes template + couple loads to the caller. **Safety property:** the send is **blocked (422)** when `detectMissingVariables` finds an unresolved variable, unless `sendAnyway` is set — re-checked server-side so the client can't bypass it. Static attachments downloaded via the owner-only `email-template-files` bucket |
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

### Public Portal RPC security model (Phase 8)

The `/portal/[token]` surface is **unauthenticated** — couples and
bridal-party members open the URL without a Supabase session. The
share token IS the capability.

**Per-partner tokens (2026-06-16).** Each couple now has *two* portal
links: the primary partner's `couples.portal_token` and the secondary
partner's `couples.secondary_portal_token`. Both resolve to the same
couple but carry a distinct **viewer** identity. The combined "couple
link" is retired; every link is now partner-scoped.

Every write originates from a `SECURITY DEFINER` RPC keyed by the
token. The canonical guard prologue is now the resolver helper
`_resolve_portal_couple(p_token)` (used by every portal RPC in
`supabase/migrations/…portal…sql`):

```sql
SELECT couple_id, owner_id, viewer
INTO v_couple_id, v_user_id, v_viewer
FROM _resolve_portal_couple(p_token);   -- matches portal_token OR secondary_portal_token
IF v_couple_id IS NULL THEN RAISE EXCEPTION 'Invalid portal token'; END IF;
```

`viewer` is `'primary'` when the token is `portal_token` and `'spouse'`
when it is `secondary_portal_token`.

Consequences:

- **Invalid token** (random UUID, expired, revoked) → RPC raises.
- **Disabled token** (`portal_token_enabled = false`) → RPC raises.
- **Anti-confused-deputy** — even a hostile actor with a valid
  token for couple A cannot make the RPC write into couple B's
  rows. The `v_couple_id` + `v_user_id` are resolved from the
  token, not from caller-supplied params; every INSERT uses
  those resolved values.

**Vows privacy (per-partner).** Vows are the one section scoped *within*
a couple so partners can't read each other's before the day:

- `get_portal_data(token)` returns **only the viewer's own vow**
  (`WHERE who = v_viewer`) — the other partner's content never leaves
  the database, even though both share the same couple payload.
- `save_portal_vow(p_token, p_id, p_content)` derives `who := v_viewer`
  from the token and **ignores any client-supplied `who`** — the
  primary physically cannot write (or overwrite) the spouse's vow.
- `delete_portal_vow` only deletes `WHERE who = v_viewer` — a partner
  cannot delete the other's vow.
- Proven end-to-end in
  `tests/integration/automations/vows-feature.test.ts` (each link sees
  only its own vow; cross-partner delete is a no-op).

**Public token-attempt limiter** (see prior section) sits in front
of `/portal/[token]` and returns `notFound()` after 60 invalid
attempts/hour. Valid-token loads are free.

**Tested guards** — `tests/integration/portal/rpc-security.test.ts`
(Phase 8, 13 tests) — runs against the **anon-key Supabase client**
(no auth headers) to match the production browser path. Covers:

- `get_portal_data` — invalid token returns null, disabled token
  returns null, valid token returns the couple payload.
- `save_portal_contact` — invalid token raises, disabled raises,
  valid inserts to the token-issuer's `contacts`. Cross-couple
  probe verified: token A cannot make the RPC attribute the new
  contact to user B.
- `save_portal_person` — invalid token raises, valid persists
  with the correct `user_id` + `couple_id`.
- `save_portal_song` — invalid raises, valid persists with the
  correct ownership.
- `delete_portal_person` — invalid raises, **cross-portal probe**:
  a request with token A targeting a `portal_people` id owned by
  couple B leaves B's row untouched.

**Deliberately not yet covered** (tracked as follow-up):

- Per-token write rate-limit. A caller holding a valid token can
  spam writes; today the only ceiling is Postgres' connection
  limit and Supabase's anon-key call quota. The most realistic
  abuse vector is `save_portal_contact` because it inserts into
  the MC's addressbook (`contacts`). If observed in production,
  the fix is a `portal_writes` ledger table + per-couple
  windowed cap inside the RPC.
- Server-side input validation (length caps, character whitelists,
  email format checks) beyond the Postgres column constraints. The
  RPCs currently accept whatever the client sends. Adding Zod-shaped
  guards would require API-route wrappers (the current pattern is
  direct RPC calls from the section components). Tracked as a
  follow-up; lower priority than rate-limiting.

### Public Timeline RPC security model (Phase 10)

The `/timeline/[token]` surface is **unauthenticated** — MCs share
the URL with vendors (photographers, caterers, etc.) so they have
the wedding-day run-of-show. Like the portal and quote surfaces,
the share token IS the capability.

The page calls one `SECURITY DEFINER` RPC:

- `get_public_timeline(token uuid) → json` — returns event date,
  venue, couple name, MC contact info, and timeline items.

The guard is the same shape as the other public-surface RPCs:

```sql
WHERE e.share_token = token AND e.share_token_enabled = true
```

Consequences:

- **Invalid token** (random UUID) → returns null.
- **Disabled token** (`share_token_enabled = false`) → returns null.
- **Anti-confused-deputy** — the JSON payload is built from the
  event resolved by the token; the MC contact block (`business_name`,
  `email`, `phone`) joins from `auth.users` via `e.user_id`, so an
  anon caller cannot substitute their own identity into the payload.

**Tested guards** — `tests/integration/timeline/public-timeline-rpc.test.ts`
(Phase 10, 5 tests) runs against the **anon-key Supabase client**
to match the production browser path:

- Random token → null.
- Valid + enabled token → returns payload with correct venue +
  couple + items.
- Valid + disabled → null.
- Cross-event probe: token A returns only event A's items, even
  when event B is enabled simultaneously.
- MC contact block reflects the event owner, not the caller.

Same follow-up as the quote surface: extending the public token-
attempt limiter (currently `/portal/[token]` only) to cover
`/timeline/[token]` is tracked for completeness.

### Public Quote RPC security model (Phase 9)

The `/quote/[token]` surface is the same shape as the portal:
**unauthenticated**, with the share token as the capability. The
public quote page calls three `SECURITY DEFINER` RPCs directly:

- `get_public_quote(token uuid) → jsonb` — read the payload.
- `accept_quote(token uuid) → jsonb` — transition status to `accepted`.
- `decline_quote(token uuid) → jsonb` — transition status to `declined`.

Each RPC's guard is the same WHERE clause inside its body:

```sql
WHERE share_token = token AND share_token_enabled = true
```

Consequences identical to the portal model: invalid token →
no-op / `not_found`; disabled token → no-op / `not_found`;
anti-confused-deputy holds because the affected row is selected
by the token, not by a caller-supplied id.

**Tested guards** — `tests/integration/payments/public-quote-rpcs.test.ts`
(Phase 9, 13 tests) runs against the **anon-key Supabase client**
(no auth headers) to match the production browser path. Covers:

- `get_public_quote` — random token returns null, valid+enabled
  returns the quote payload, valid+disabled returns null.
- `accept_quote` — random → `{error: "not_found"}`, disabled →
  `{error: "not_found"}`, valid transitions to `accepted` +
  populates `accepted_at`, second call → `{error: "already_actioned"}`,
  past `expires_at` → `{error: "expired"}`. Cross-couple probe:
  holding token A and calling `accept_quote(A)` does NOT
  transition couple B's quote.
- `decline_quote` — symmetric coverage. Cross-couple probe also
  verified.

The public token-attempt limiter currently fronts `/portal/[token]`
only (see prior section). Extending it to `/quote/[token]` and
`/invoice/[token]` is tracked as a follow-up — quote tokens are
also UUIDs, so brute-force probability is identical to the
portal's, but for completeness the limiter should cover them too.

### Authenticated Stripe routes — Phase 2D.2 additions

| Route | Zod | Rate-limit | Notes |
|---|---|---|---|
| `app/api/stripe/invoice-payment/route.ts` | ✅ `bodySchema` (invoiceId UUID, shareToken min/max, paymentType enum) | ✅ 10/min/IP via `inMemoryLimiter` | Generic 404 on missing-or-mismatched-token (no info leak). `success_url` carries `session_id={CHECKOUT_SESSION_ID}` for the payment-success re-verification. `metadata.connected_account_id` cross-checked on the success page. Stripe-failure path uses `logger.error`; raw error message NOT returned to the couple (returns generic 502). |
| `app/invoice/payment-success/page.tsx` | n/a (server component) | n/a | Server-side `stripe.checkout.sessions.retrieve(session_id, { expand: ['payment_intent'] })`. Five-check verification: invoice exists + MC has Connect account + session.metadata.invoice_id matches + session.metadata.connected_account_id matches + payment_intent.status === 'succeeded'. Any mismatch → notFound() + `payment_success_param_tampered` Slack alert. Idempotent. |

### Public questionnaire routes — Couple questionnaires

| Route | Zod | Rate-limit | Notes |
|---|---|---|---|
| `app/api/questionnaire/save/route.ts` | ✅ `questionnaireWriteSchema` (token UUID + `responses` record) | ✅ 30/min/IP via `inMemoryLimiter` (autosave fires often) | Calls `save_questionnaire_progress` (SECURITY DEFINER, token-gated). Generic error on RPC failure; detail logged. Refuses once completed. |
| `app/api/questionnaire/submit/route.ts` | ✅ `questionnaireWriteSchema` | ✅ 5/min/IP via `inMemoryLimiter` (one-shot) | Calls `submit_questionnaire` (SECURITY DEFINER). Typed RPC errors (`already_completed`) surfaced as 400; transport failures return generic 500 with `logger.error`. |

Both are unauthenticated — the share token IS the capability, validated DB-side
against `share_token_enabled = true`. The public page (`/questionnaire/[token]`)
loads via the `get_public_questionnaire` RPC (anon, branding-merged).

---

## RLS coverage matrix

All app tables enable RLS. The owner column is `user_id uuid` on each.
The base policy is `auth.uid() = user_id` for SELECT/INSERT/UPDATE/
DELETE (sampled clean across the migrations).

| Table | RLS enabled | Owner column | Integration test | Per-page phase |
|---|---|---|---|---|
| `couples` | ✅ | `user_id` | ✅ `tests/integration/rls/couples.test.ts` (5 tests) + `tests/integration/billing/couple-cap.test.ts` (10 tests — Starter cap enforcement) | Couples & Events |
| `events` | ✅ | `user_id` | ✅ `tests/integration/rls/events.test.ts` (Phase 4A, 5 tests) | Couples & Events |
| `contacts` | ✅ | `user_id` | ✅ `tests/integration/rls/contacts.test.ts` (Phase 5, 5 tests) | Contacts |
| `tasks` | ✅ | `user_id` | ✅ `tests/integration/rls/tasks.test.ts` (Phase 4B, 5 tests) | Tasks |
| `quotes` | ✅ | `user_id` | ✅ `tests/integration/rls/payments-tables.test.ts` (Phase 2C) + `tests/integration/payments/public-quote-rpcs.test.ts` (Phase 9 — public RPC guards) | Payments / Quotes |
| `quote_items` | ✅ | `user_id` | ✅ `tests/integration/rls/payments-tables.test.ts` (Phase 2C) | Payments / Quotes |
| `quote_templates` | ✅ | `user_id` | ✅ `tests/integration/rls/payments-tables.test.ts` (Phase 2C) | Payments |
| `quote_template_items` | ✅ | `user_id` | ✅ `tests/integration/rls/payments-tables.test.ts` (Phase 2C) | Payments |
| `invoices` | ✅ | `user_id` | ✅ `tests/integration/rls/payments-tables.test.ts` (Phase 2C) | Payments |
| `invoice_items` | ✅ | `user_id` | ✅ `tests/integration/rls/payments-tables.test.ts` (Phase 2C) | Payments |
| `contracts` | ✅ | `user_id` | ✅ `tests/integration/contracts/contract-audit-log.test.ts` (Phase 3.2 — exercises owner-only RPC paths) | Contracts |
| `contract_templates` | ✅ | `user_id` | ✅ `tests/integration/rls/contract-templates.test.ts` (Phase 12, 6 tests) | Contracts |
| `contract_audit_log` | ✅ (SELECT-only for owner; no write policies — Phase 3.2) | `user_id` | ✅ `tests/integration/contracts/contract-audit-log.test.ts` (5 tests) | Contracts |
| `email_templates` | ✅ | `user_id` | ✅ `tests/integration/rls/email-templates.test.ts` (7 tests — incl. starter seeding) | Email Templates |
| `email_template_files` | ✅ | `user_id` | ☐ (added with static-upload flow) | Email Templates |
| `packages` | ✅ | `user_id` | ✅ `tests/integration/rls/packages.test.ts` (6 tests) | Templates |
| `package_items` | ✅ | `user_id` | ✅ `tests/integration/rls/packages.test.ts` (covered via parent) | Templates |
| `invoice_templates` | ✅ | `user_id` | ✅ `tests/integration/rls/invoice-templates.test.ts` (6 tests) | Templates |
| `invoice_template_items` | ✅ | `user_id` | ✅ `tests/integration/rls/invoice-templates.test.ts` (covered via parent) | Templates |
| `couple_emails` | ✅ | `user_id` | ✅ `tests/integration/rls/couple-emails.test.ts` (6 tests) | Couples & Events |
| `questionnaire_templates` | ✅ | `user_id` | ✅ `tests/integration/rls/questionnaire-templates.test.ts` (6 tests) | Questionnaires |
| `couple_questionnaires` | ✅ | `user_id` | ✅ `tests/integration/rls/couple-questionnaires.test.ts` (8 tests — RLS + public RPC token gating + submit/double-submit) + `tests/integration/rls/portal-questionnaires.test.ts` (3 tests — portal RPC) | Questionnaires |
| `admin_audit_log` | ✅ (SELECT-only for admins via app_metadata; no write policies — Phase 13) | `actor_id` | ✅ `tests/integration/rls/admin-audit-log.test.ts` (8 tests) + `tests/integration/admin/audit-log-flow.test.ts` (3 tests — helper round-trip) | Admin |
| `couple_statuses` | ✅ | `user_id` | ✅ `tests/integration/rls/couple-statuses.test.ts` (Phase 4A, 5 tests) | Couples & Events |
| `couple_contacts` | ✅ | (join via `couple_id`, denorm `user_id`) | ✅ `tests/integration/rls/couple-contacts.test.ts` (Phase 4B, 4 tests) | Couples & Events |
| `event_contacts` | ✅ | (join via `event_id`, denorm `user_id`) | ✅ `tests/integration/rls/event-contacts.test.ts` (Phase 4C, 4 tests) | Couples & Events |
| `vendors` (legacy alias of contacts) | ✅ | `user_id` | ☐ | Contacts |
| `event_vendors` (legacy) | ✅ | (join) | ☐ | Contacts |
| `task_groups` | ✅ | `user_id` | ✅ `tests/integration/rls/task-groups.test.ts` (Phase 6, 5 tests) | Tasks |
| `timeline_items` | ✅ | `user_id` | ✅ `tests/integration/rls/timeline-items.test.ts` (Phase 4C, 5 tests) + `tests/integration/timeline/public-timeline-rpc.test.ts` (Phase 10 — public RPC guards) | Timeline |
| `timeline_templates` | ✅ | `user_id` | ✅ `tests/integration/rls/timeline-templates.test.ts` (Phase 12, 11 tests — both tables) | Timeline |
| `timeline_template_items` | ✅ | `user_id` | ✅ `tests/integration/rls/timeline-templates.test.ts` (Phase 12, 11 tests — both tables) | Timeline |
| `portal_files` | ✅ | `user_id` | ✅ `tests/integration/rls/portal-files.test.ts` (Phase 4D, 4 tests) | Client Portal |
| `portal_people` | ✅ | `user_id` | ✅ `tests/integration/rls/portal-people.test.ts` (Phase 4D, 5 tests) | Client Portal |
| `portal_songs` | ✅ | `user_id` | ✅ `tests/integration/rls/portal-songs.test.ts` (Phase 4D, 7 tests — also covers `portal_song_categories`) | Client Portal |
| `portal_song_categories` | ✅ | `user_id` | ✅ `tests/integration/rls/portal-songs.test.ts` (Phase 4D) | Client Portal |
| `stripe_customers` | ✅ (RLS enabled, no policy — service-role only) | `user_id` | ✅ `tests/integration/rls/payments-tables.test.ts` (Phase 2C) | Payments |
| `stripe_events` | ✅ (RLS enabled, no policy — service-role only, Phase 2A) | n/a (system-global) | n/a | Payments |
| `user_branding` | ✅ | `user_id` | ✅ `tests/integration/rls/user-branding.test.ts` (Phase 11, 5 tests) + `tests/integration/branding/user-branding-helper.test.ts` (Phase 11, 4 tests — `_user_branding` helper) | Branding |
| `user_public_settings` | ✅ | `user_id` | ✅ `tests/integration/rls/user-public-settings.test.ts` (5 tests — cross-tenant read/update/insert denial incl. encrypted OAuth tokens + global subdomain uniqueness) | Settings — Public Page |
| `automations` | ✅ | `user_id` | ✅ `tests/integration/automations/run-now.test.ts` (cross-tenant: cannot manually run another MC's automation) | Automations |
| `automation_events` | ✅ (SELECT-only; writes via SECURITY DEFINER RPC + service-role) | `user_id` | ✅ exercised by `run-now.test.ts` (manual-fire event opens only the owner's run) | Automations |
| `automation_actions` | ✅ | `automation_id` (→ `automations.user_id`) | ✅ exercised by `run-now.test.ts` | Automations |
| `automation_runs` | ✅ | `user_id` | ✅ `tests/integration/automations/run-controls.test.ts` (cross-tenant retry/cancel/pause/resume are no-ops) | Automations |
| `automation_waits` | ✅ | `user_id` | ✅ `tests/integration/automations/run-controls.test.ts` (cancel consumes; resume reads — exercised via the control actions) | Automations |
| `automation_audit_log` | ✅ (SELECT-only for owner; writes service-role) | `user_id` | ☐ (read RLS-scoped by the couple Automations feed) | Automations |

**Connect-your-own-mailbox (OAuth) controls** (Settings → Public Page →
Email; routes `app/api/oauth/{authorize,callback}`): the Gmail/Outlook
OAuth refresh + access tokens are encrypted at rest with AES-256-GCM
(`lib/crypto/secret-box`, key `EMAIL_CRED_KEY`), never selected back to
the client, and decrypted only server-side at send/refresh time. The
authorize→callback flow is CSRF-protected by a random `state` pinned in a
signed httpOnly cookie and re-checked on callback; the callback binds the
tokens to the MC via their existing Supabase session. Both routes are
per-user rate-limited; `disconnectMailboxAction` best-effort revokes at
the provider. Scopes are minimal (Google `gmail.send` send-only; Microsoft
`Mail.Send`).

The Templates starter-add server actions (`addStarterPackagesAction`,
`addStarterQuoteTemplatesAction`, `addStarterInvoiceTemplatesAction`,
`addStarterContractsAction`) are Zod-validated, run through the
RLS-scoped server client, resolve content server-side by name (the client
never sends body/amount data), skip names the MC already owns, and flag
inserted rows `is_starter`. Behaviour covered by
`tests/integration/templates/starter-actions.test.ts` (6 tests).

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
