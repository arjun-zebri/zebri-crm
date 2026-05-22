# Phase 2 — Payments & invoices + Stripe webhooks/Connect

> **Status:** Plan draft. Not started. Branch off `staging` after Phase 1
> merges. Roadmap §4 item 2.

## 1. Context

Phase 1 shipped the auth/account hardening including the entitlements
helper as the sole source of truth for subscription state. Phase 2
takes the next-highest-risk surface — **anywhere money flows** —
through the §5 Definition of Done.

Concretely, the Phase-2 surface is:

- **Stripe API routes** (`app/api/stripe/{checkout,portal,billing-
  history,webhook,connect,connect/callback,invoice-payment}`).
  ~750 LOC across 7 routes.
- **Billing UI** in `/settings?tab=billing` — deferred out of Phase 1
  per the locked decision in [[production_readiness]] §1. Already
  visually polished from the recent iteration; needs the DoD bar
  (tests + TSDoc + RLS proofs + docs).
- **`/payments` page** — the Quotes | Invoices tabs UI surface (851
  LOC page, needs decomposition).
- **Builder modals** in `components/builders/` — Quote (1047 LOC),
  Invoice (1465 LOC). These are the largest files in the repo.
  Contract modal (561 LOC) is coupled here but its hardening lands in
  **Phase 3 (Contracts)**.
- **Stripe Connect** onboarding (`/api/stripe/connect/*`) and the
  **public invoice payment surface** (`/invoice/[token]`,
  `/quote/[token]`, `/invoice/payment-success`).
- **Webhook handler** (414 LOC) — signature verification is already
  in place; needs idempotency keys, dead-letter handling, fixture
  replay test coverage, and tighter Zod-validated event handlers.

Quote-specific feature work (templating, customisation, send-as-
proposal UX) stays scoped to **Phase 9 (Quotes)**. Phase 2's
treatment of quotes is structural only — the modal is rebuilt to
the §5 DoD bar; deeper UX iteration happens in Phase 9.

## 2. PR plan — 4 small PRs, not one big one

The full Phase 2 surface is ~5,400 LOC. One PR would be unreviewable.
The split below keeps each PR under ~1500 LOC of changed code and
lets us promote to staging between increments.

| PR  | Branch                          | Scope                                                                            | Est. LOC |
|-----|---------------------------------|----------------------------------------------------------------------------------|----------|
| 2A  | `phase-2a-stripe-routes`        | Stripe checkout/portal/billing-history/webhook hardening + fixture replay tests  | ~800     |
| 2B  | `phase-2b-billing-ui`           | Settings → Billing tab DoD (tests + docs + RLS proofs + cleanup carry-overs)     | ~600     |
| 2C  | `phase-2c-payments-page`        | `/payments` page decomposition + email-send hardening + RLS proofs + RPC audit   | ~1500    |
| 2C.2 | `phase-2c2-builder-parts`      | Quote + Invoice builder modal decomposition into `components/builders/parts/`    | ~2000    |
| 2D  | `phase-2d-connect-public`       | Stripe Connect routes + public invoice/quote surfaces + payment-success page     | ~900     |

Each PR branches off `staging`, merges back to `staging`, and is
verified on staging only. **No `main` promotion** until every phase
in the production-readiness roadmap (§4) has landed — that's the
current working agreement for the multi-phase batch. `main` gets
one big promotion at the very end. The order respects dependency:
2A's webhook changes land before 2B asserts billing-state UI
behaviour against webhook fixtures; 2C's quotes/invoices surface
depends on 2A's checkout pattern when an invoice triggers a customer
payment; 2D builds on all three.

---

## 3. PR 2A — Stripe API route hardening

**Goal:** every `/api/stripe/*` route is Zod-validated at the
boundary, rate-limited if public/auth/money, idempotent against
webhook replay, and covered by a fixture-replay integration test.

### Files

| File                                          | LOC | Treatment                                                                                                                |
|-----------------------------------------------|-----|--------------------------------------------------------------------------------------------------------------------------|
| `app/api/stripe/checkout/route.ts`            | 107 | Zod on `{ plan }`, rate-limit (5/min/user), TSDoc, error responses use the tagged `{ ok, response }` pattern             |
| `app/api/stripe/portal/route.ts`              | 33  | Zod on `{ flow? }`, rate-limit (10/min/user), TSDoc                                                                      |
| `app/api/stripe/billing-history/route.ts`     | 63  | No body, but add rate-limit (30/min/user) + TSDoc + extract pagination cursor for future scale                           |
| `app/api/stripe/webhook/route.ts`             | 414 | **Biggest target.** Idempotency keys via `stripe_events` ledger table. Per-event-type Zod schemas. Fixture replay tests. |

### Idempotency ledger (new migration)

`stripe_events` table — stores every Stripe event ID we've processed.
The webhook handler INSERTs the event ID at the top; conflict on the
unique index = the event has already been processed, return 200
without re-running side effects.

```sql
-- not the actual migration; just the shape
create table stripe_events (
  id text primary key,           -- Stripe event ID (evt_…)
  type text not null,
  received_at timestamptz default now()
);
```

Migration goes through CI `supabase db push` per the locked flow.

### Per-event Zod schemas

`lib/payments/webhook-events.ts` (new) — one Zod schema per Stripe
event type we handle (`checkout.session.completed`,
`customer.subscription.{created,updated,deleted}`,
`invoice.payment_{succeeded,failed}`, …). The handler walks the
schema list, matches on `event.type`, parses `event.data.object`,
then dispatches. Unknown event types acknowledge with 200 but log a
warning — Stripe sends everything; we only handle what we recognise.

### Fixture-replay integration tests

`tests/integration/stripe/webhook-replay.test.ts` — replays captured
Stripe webhook fixtures (one per event type we handle) against the
local handler. Asserts the resulting `app_metadata` state and the
`stripe_events` ledger row. Re-replaying the same fixture twice
must be a no-op (idempotency proof).

Fixtures captured via `stripe trigger <event>` in dev → committed
to `tests/fixtures/stripe/*.json`.

### Rate-limit additions

Add to `lib/api/rate-limit.ts` (extend the `AUTH_RATE_LIMITS`
pattern):

```ts
export const STRIPE_RATE_LIMITS = {
  checkout: { windowMs: 60_000, max: 5 },
  portal: { windowMs: 60_000, max: 10 },
  billingHistory: { windowMs: 60_000, max: 30 },
  invoicePayment: { windowMs: 60_000, max: 10 },   // public surface
};
```

Hit handler: 429 + `sendAlert({ type: 'stripe_rate_limit_hit', ... })`.
New alert added to [[alerts]] catalog.

### Doc updates (2A)

- `payments.md` — add the idempotency ledger section + webhook
  event catalog + rate-limit table.
- `alerts.md` — add `stripe_rate_limit_hit` + `stripe_webhook_replay`
  (alert when the same event ID hits twice within 60s).
- `security.md` — tick `app/api/stripe/{checkout,portal,billing-
  history}/route.ts` on the webhook-signature-and-validation matrix.

---

## 4. PR 2B — Billing UI DoD

**Goal:** the Settings → Billing tab passes the full §5 DoD. Most of
the visual work is done; this PR adds the **tests + RLS proofs +
docs** layer.

### Files

| File                                                              | Status                                                            |
|-------------------------------------------------------------------|-------------------------------------------------------------------|
| `app/(dashboard)/settings/billing-section.tsx`                    | Already token-clean + TSDoc'd; add tests                          |
| `app/(dashboard)/settings/billing/current-plan-card.tsx`          | Done. Adds: tests for each `CardState` branch                     |
| `app/(dashboard)/settings/billing/plan-comparison.tsx`            | Done. Adds: tests for current-column tint + button state          |
| `app/(dashboard)/settings/billing/billing-history.tsx`            | Done. Adds: loading-skeleton snapshot test                        |
| `app/(dashboard)/settings/billing/cancel-confirm-modal.tsx`       | Done. Adds: tests for confirm-busy lock                           |
| `app/(dashboard)/settings/billing/actions.ts`                     | Add rate-limit (carry-over from previous review's P3)             |
| `components/ui/modal.tsx`                                         | Drop redundant `h-screen`; replace `<table>` `position: relative` |
| `lib/auth/entitlements.ts`                                        | (no changes — already done in Phase 1)                            |

### Carry-overs from the recent review

P3 items left from the post-cb650bb review:

- Rate-limit on the 4 billing server actions
  (`cancelSubscriptionAction`, `resumeSubscriptionAction`,
  `createPlanChangeSessionAction`, `paymentMethodPortalAction`).
- Extract `readPeriodEndIso(subscription)` helper to dedupe the 3
  call sites in `actions.ts` + `webhook/route.ts`.
- Drop redundant `h-screen` on Modal backdrop.
- Use `useLayoutEffect` to measure header height instead of the
  4rem magic number in `flushBottom` mode (or accept the magic +
  add a comment near the header).

### Tests

- **Unit:** Each of the 6 `CardState` branches renders the right
  copy, the right `StatePill`, the right `PrimaryAction`. Verifies
  no console errors. Verifies mobile (Pixel 5) layout via Playwright
  component test.
- **Integration:** Existing Phase-1 billing-scenario matrix (already
  in `tests/integration/billing-states.test.ts`) — extend to assert
  the UI rendering, not just the helper output.
- **E2E:** A single happy-path spec — log in, hit `/settings?tab=
  billing`, click "Change plan", click "Switch" on Pro, get
  redirected to Stripe Portal (mocked). Mobile + desktop projects.

### Doc updates (2B)

- `page-specs.md` — refresh the Settings → Billing entry to match
  the shipped UI (plan card, comparison modal, cancel-confirm).
- `production-readiness.md` — tick PR 2B's items.

---

## 5. PR 2C — `/payments` page decomposition + email-send hardening

**Goal:** the `/payments` page becomes an orchestrator; cross-tenant
RLS proven for every payments table; the email-send routes get the
same Zod + rate-limit treatment as the Stripe routes; public RPCs
get a security audit.

Mid-flight scope decision: **builder-modal decomposition moved to
PR 2C.2** (see §5b). The Quote modal (1047 LOC) + Invoice modal
(1465 LOC) are money paths where a structural refactor wants its
own focused review — bundling it with the page work pushed PR 2C
past the reviewable LOC budget. 2C ships the page + security work;
2C.2 ships the modal decomposition on top.

### The decomposition (shipped)

`app/(dashboard)/payments/page.tsx` (851 LOC) → 262-LOC orchestrator
+ co-located sections:

```
app/(dashboard)/payments/
  page.tsx                       (~262 LOC — state + composition)
  payments-header.tsx            (title + search + tab strip + New)
  payments-table.tsx             (shared desktop-table / mobile-list)
  payments-footer.tsx            (fixed bottom count + total)
  quotes-list.tsx                (quote-specific row mapping)
  invoices-list.tsx              (invoice rows + deriveInvoices)
  contracts-list.tsx             (contract rows — kept light per Phase 3 boundary)
  new-contract-popover.tsx       (inline "pick a couple" popover)
  use-payments-data.ts           (React Query hooks)
  use-payments-shortcut.ts       ("/" focus + Escape clear)
```

Each section ≤ ~270 LOC (payments-table.tsx, the shared primitive).
URL-search-param-backed state is deferred (the current keyed
useState is fine; converting is a follow-up).

### Email-send route hardening (shipped)

`/api/email/send-quote` and `/api/email/send-invoice` now:
- Validate the body via Zod (`{ quoteId | invoiceId: uuid }`)
- Rate-limit to 5/min/user via `EMAIL_RATE_LIMITS`
- Fire `email_rate_limit_hit` on a 429
- Use the structured logger for error paths

These are the highest-risk paths after the Stripe surface — they
blast a couple's inbox. `send-contract` stays Phase 3.

### Public RPC audit (shipped — see security.md)

Findings: token entropy + field selection ✅. Stale `user_metadata`
read of `stripe_connect_enabled` in `get_public_invoice` is a low-
impact §7.4 residual, fix scheduled for PR 2D alongside the Connect
state-param HMAC work.

## 5b. PR 2C.2 — Builder modal decomposition (deferred from 2C)

**Goal:** decompose Quote (1047 LOC) + Invoice (1465 LOC) modals
into shared `components/builders/parts/` subcomponents + move
inline mutations to server actions.

### Extractions (planned)

```
components/builders/parts/
  line-items-table.tsx           (used by both)
  totals-box.tsx                 (used by both)
  couple-picker.tsx              (used by both — wraps existing CouplePicker)
  attachments-panel.tsx          (used by both)
  builder-modal-shell.tsx        (header + footer + close behaviour)

components/builders/
  quote-builder-modal.tsx        (~400 LOC — composition only)
  invoice-builder-modal.tsx      (~500 LOC — composition + payment-schedule)
  contract-builder-modal.tsx     (stays — Phase 3 target)
```

Each `parts/` file: ≤ 200 LOC, primitive-clean, TSDoc'd. No business
rules in the modals themselves — they delegate to existing
`lib/payments/*` modules.

### Server actions (planned)

```ts
// app/(dashboard)/payments/actions.ts
'use server';
export async function saveQuoteAction(input: SaveQuoteInput): ActionResult<{ id: string }>;
export async function saveInvoiceAction(input: SaveInvoiceInput): ActionResult<{ id: string }>;
export async function deleteQuoteAction(quoteId: string): ActionResult<void>;
export async function deleteInvoiceAction(invoiceId: string): ActionResult<void>;
```

Each action: Zod-validate input, RLS-protected SQL (no service-role
escape), TSDoc. The send-via-email path is already a server-side
route (`/api/email/send-{quote,invoice}`) and was hardened in 2C
— it does not need a server action wrapper.

### Why this split

Total Phase 2C+2C.2 surface is ~3500 LOC of change. Bundling it
into one PR would be unreviewable on money-critical code.
Splitting at the page/modal boundary keeps each PR ≤ ~2000 LOC
and lets the reviewer focus on one concern at a time:

- **2C**: page structure + the money-paths-already-on-the-server
  (email-send routes, RLS proofs, RPC audit).
- **2C.2**: pure structural refactor of the two big modals.

### RLS proofs (the matrix tick)

[[security]] §RLS matrix — Phase 2 ticks the following:

| Table                   | Cross-tenant RLS test                                                     |
|-------------------------|---------------------------------------------------------------------------|
| `quotes`                | User A cannot SELECT / UPDATE / DELETE User B's quotes                    |
| `quote_items`           | User A cannot SELECT / INSERT a row referencing User B's quote            |
| `quote_templates`       | User A cannot SELECT User B's templates                                   |
| `quote_template_items`  | Same as above for items                                                   |
| `invoices`              | User A cannot SELECT / UPDATE / DELETE User B's invoices                  |
| `invoice_items`         | Same as quotes                                                            |
| `stripe_customers`      | User A cannot SELECT User B's `stripe_customer_id`                        |

Each tested via real Supabase clients with two distinct anon JWTs.
Pattern matches `tests/integration/rls/entitlements-escalation.test.ts`.

### Public RPC review (the share-token surface)

The `get_public_quote(token)` and `get_public_invoice(token)` RPCs
gate the public-facing quote/invoice pages. These deliberately
expose data without authentication (the token IS the capability).
Phase 2C audit:

- Token format is sufficiently entropic (≥ 128 bits) — verify.
- Token is unguessable / not sequential — verify.
- RPC returns ONLY the fields needed for rendering (no
  `stripe_customer_id`, no internal flags, no other-couple data).
- Rate-limit on the public surface (Phase 2D handles this — the
  API route, not the RPC, takes the limiter).
- Revocation path exists (deleting the quote/invoice invalidates
  the token).

### Tests

- **Unit:** Each section component renders correctly with mock
  data. Each `parts/` subcomponent in isolation. The two builder
  modals' save flow (mocking the action). Total: ~25 new tests.
- **Integration:** RLS proofs above. Each server action's
  validation + rate-limit branches. Send-quote happy path. Total:
  ~15 new tests.
- **E2E:** `tests/e2e/payments.spec.ts` (new) — create quote →
  send → public surface renders → mark accepted → convert to
  invoice → mark paid. Mobile + desktop. Total: ~6 new specs.

### Doc updates (2C)

- `page-specs.md` — refresh `/payments`, Quote modal, Invoice
  modal sections.
- `payments.md` — document the server-action save path and the
  `parts/` subcomponent contract.
- `security.md` — tick the 7 RLS rows above.
- `database-schema.md` — no schema changes; just update the table
  notes if needed.
- `component-library.md` — register the new `parts/` subcomponents.

### Phase 2C scope hard limits

- **No** Quote-templating UX work (Phase 9).
- **No** new Invoice features (no recurring invoices, no
  multi-currency).
- **No** Contract modal changes beyond imports/exports that the
  decomposition requires (Phase 3).
- **No** redesign of the line-items table visually — token + primitive
  port only.

---

## 6. PR 2D — Stripe Connect + public payment surfaces

**Goal:** the OAuth-style Connect flow + the public invoice payment
page are both hardened against tampering, replay, and brute force.

### Files

| File                                               | LOC | Treatment                                                                                       |
|----------------------------------------------------|-----|-------------------------------------------------------------------------------------------------|
| `app/api/stripe/connect/route.ts`                  | 26  | Sign + persist `state` param (HMAC over user_id + nonce + expiry). Add rate-limit               |
| `app/api/stripe/connect/callback/route.ts`         | ~   | Verify state HMAC. Reject replays. Per-user lockout on repeated invalid state                   |
| `app/api/stripe/invoice-payment/route.ts`          | 108 | Zod on body, rate-limit (10/min/IP — public), token lookup, signed return URL                   |
| `app/invoice/[token]/page.tsx`                     | ?   | Server-component, no client mutations. Loading + error states. Mobile-safe                      |
| `app/quote/[token]/page.tsx`                       | ?   | Same as above                                                                                   |
| `app/invoice/payment-success/page.tsx`             | ?   | Verify signed return params; idempotent against repeated visits                                 |

### State-param verification (carry-over from `security.md` §RLS table)

The current Connect callback trusts the `state` param. Phase 2D:

- `/api/stripe/connect` generates `state = base64url(HMAC_SHA256(
  secret, user_id || nonce || expiry))` and stores `{ nonce,
  expiry }` server-side keyed by user.
- `/api/stripe/connect/callback` re-derives the HMAC, asserts
  match, asserts the stored nonce hasn't been consumed (single-
  use), asserts expiry is in the future.
- On failure: `sendAlert({ type: 'stripe_connect_state_invalid',
  user_id, ... })` + 400 response.

### Public surface rate-limiting

`/invoice/[token]` and `/quote/[token]` are unauthenticated. Their
underlying RPC (`get_public_invoice(token)`) is gated by the token
itself, but a leaked or guessed token gives an attacker the full
payload of the quote/invoice. Mitigations:

- IP rate-limit on the API routes serving these surfaces
  (`/api/stripe/invoice-payment` already a route; add similar gates
  if any other API touches the token).
- Token-attempt limiter on the RPC (server-side count of invalid
  token attempts per IP per hour; lock at 60).
- Slack alert on `> 10` invalid-token attempts from a single IP
  in 60s.

### Return-URL signing

`/invoice/payment-success?session_id=...` is reached via Stripe
redirect after a successful payment. Phase 2D adds:

- The session_id is verified against Stripe (it's already a
  capability URL but should still be re-validated server-side).
- Idempotent visits — refreshing the success page doesn't double-
  fire any "paid" toast / re-send any thank-you email.

### Tests

- **Unit:** State-HMAC generation + verification. Token-attempt
  limiter.
- **Integration:** Full Connect happy path (mocked Stripe responses)
  + replay attack (re-using the same state) + tampered state
  (single-bit flip rejection).
- **E2E:** A public-surface spec — generate a valid invoice token
  via a logged-in MC, log out, visit the public URL, see the
  invoice render. Replay the URL with a tampered token → 404.
  Mobile + desktop.

### Doc updates (2D)

- `payments.md` — document the state-HMAC scheme + token-attempt
  limiter.
- `security.md` — tick `stripe/connect/callback` on the
  webhook-signature-and-validation matrix (it's not a webhook but
  it's the same threat class).
- `alerts.md` — `stripe_connect_state_invalid` +
  `public_token_brute_force` events.

---

## 7. Out of scope for Phase 2

Explicitly **not** in Phase 2 (so the surface stays bounded):

- **Quote templating UX** — Phase 9.
- **Contract modal hardening** — Phase 3 (Contracts/e-sign). The
  modal stays where it is; only imports/exports change if the
  builder-parts extraction needs to reference it.
- **Stripe Connect rebranding / re-onboarding for existing users**
  — feature work, not hardening.
- **Subscription pause/credit/refund flows** — not currently
  supported in the UI; not adding.
- **Multi-currency invoices** — not in scope.
- **Recurring invoices** — not in scope.

## 8. Rate-limit catalog summary (added across the 4 PRs)

| Action                      | Window | Max | Where                       |
|-----------------------------|--------|-----|-----------------------------|
| `checkout` (session create) | 60s    | 5   | 2A                          |
| `portal`                    | 60s    | 10  | 2A                          |
| `billingHistory`            | 60s    | 30  | 2A                          |
| `cancel/resume/changePlan`  | 60s    | 5   | 2B                          |
| `saveQuote/saveInvoice`     | 60s    | 30  | 2C                          |
| `sendQuote/sendInvoice`     | 60s    | 5   | 2C                          |
| `connect` (OAuth start)     | 60s    | 5   | 2D                          |
| `invoicePayment` (public)   | 60s    | 10  | 2D                          |
| `publicTokenAttempt`        | 3600s  | 60  | 2D — per IP, invalid tokens |

## 9. Verification gates (per PR)

Standard suite before opening each PR:

```bash
npm run typecheck                  # 0 errors
npm run typecheck:strict           # ≤ current budget (ratchet DOWN if reduced)
npm run lint:gate                  # ≤ current budget (ratchet DOWN if reduced)
npm run test:unit                  # all green incl. new tests
supabase start && npm run test:integration   # all green incl. new tests
npm run build                      # exit 0
npx playwright test                # all green on Pixel 5 + iPhone 12 + desktop
```

Then `/ship-check` against the branch — every §5 DoD item must pass.

Per-PR manual smoke:

- **2A:** Trigger each webhook event type locally via `stripe
  trigger` + verify `app_metadata` + ledger row. Re-trigger same
  event → no-op.
- **2B:** Walk every `CardState` by manipulating `app_metadata`
  via the admin client; verify the right UI renders.
- **2C:** Create a quote with line items, save, send. Open the
  share URL. Convert to invoice. Mark paid. Mobile sanity-check
  the line-items table on iPhone 12.
- **2D:** Run the Connect onboarding to a Stripe Express test
  account end-to-end. Replay the callback URL → should fail. Pay
  a test invoice via the public surface → success page idempotent
  on refresh.

## 10. Phase 2 stats target

- LOC reduction: ~5,400 → ~3,500 (decomposition + dead-comment
  removal).
- Test count: +60 unit / +30 integration / +12 e2e specs.
- Lint budget: target -20 errors, -50 warnings.
- Strict budget: target -25.
- RLS matrix ticks: +7 tables (`quotes`, `quote_items`,
  `quote_templates`, `quote_template_items`, `invoices`,
  `invoice_items`, `stripe_customers`).
- New alert types: 4 (`stripe_rate_limit_hit`,
  `stripe_webhook_replay`, `stripe_connect_state_invalid`,
  `public_token_brute_force`).

## 11. Locked decisions

The five originally-open questions, now resolved. Each names the
**decision**, the **why**, and **how to apply** it during the work.

### 11.1 Idempotency ledger retention — **90 days, daily cron prune**

`stripe_events` rows live for 90 days, then a cron job
(`/api/cron/prune-stripe-events`, daily 03:00 UTC) deletes
`received_at < now() - interval '90 days'`.

**Why:** Stripe retries failed webhook deliveries for up to 3 days
and exposes the event API for ~30 days. 90 days gives a 3× safety
margin against legitimate late replays. Beyond that, storage is
pointless — Stripe itself can't redeliver. Rows are tiny
(~80 bytes) so even at 100k events/month this is < 10 MB/year, but
pruning keeps the table indexable and aligns with our existing
"prune what we don't need" hygiene.

**How to apply:** PR 2A includes the prune cron route. Uses
`isCronAuthorized()` like every other cron route. Add an entry to
[[cicd]]'s cron schedule + a Slack alert if prune runs and deletes
> 5,000 rows (suggests something is generating event spam).

### 11.2 Webhook-replay alerting — **warn first, alert on 3+ replays in 60s**

The webhook handler logs `console.warn` on the first replay of any
given event ID. `sendAlert({ type: 'stripe_webhook_replay', ... })`
fires only when a single event ID is replayed **3 or more times
within a 60-second window**.

**Why:** Stripe legitimately retries — connection blips, our
handler timing out before responding 200, deployment restarts. A
single replay is noise. Three or more in a minute is either
infrastructure pathology (our handler is consistently slow
returning 200) or a malicious replay attempt with a stolen
signature, and either case warrants a human look.

**How to apply:** Track replay-counts in a per-event-id in-memory
LRU (capped 1k entries, 5-minute TTL). The ledger INSERT is still
the idempotency guard — this counter is purely for alerting. Live
in `lib/payments/webhook-events.ts`. Add `stripe_webhook_replay` to
[[alerts]].

### 11.3 Public-token attempt limiting — **Postgres-backed, gated by an RPC**

Track invalid-token attempts in a new `public_token_attempts` table
keyed by IP + hour-bucket. The public-surface API route calls
`record_public_token_attempt(ip, token_kind)` which atomically
increments + returns the new count. Lock at 60 attempts per IP per
hour; alert at 30.

**Why:** The in-memory limiter (`inMemoryLimiter`) is per-pod, so a
brute-force attacker can spread attempts across Vercel functions
and effectively get 10× the limit. Postgres gives durable,
cross-pod accounting at the cost of one write per request — still
trivial under load. The RPC also lets us cleanly add IP allowlists
later (e.g. our own monitoring tools shouldn't trip it).

**How to apply:** New migration creates the table + RPC + an
index on `(ip, hour_bucket)`. Bucket rows expire via the same
daily cron in §11.1 (extended to prune `< now() - interval '7
days'`). The API route still uses `inMemoryLimiter` as a cheap
fast guard *before* the RPC, so the database only sees requests
that pass the per-pod gate.

### 11.4 Builder-parts location — **`components/builders/parts/`**

Shared subcomponents from the modal decomposition live at
`components/builders/parts/`, not `components/payments/parts/` or
`components/ui/`.

**Why:** Quote, Invoice, and (eventually, Phase 3) Contract
builders all consume them. The `builders/` directory is the
natural home — it's the only place all three modals coexist. The
`ui/` directory is for primitives (Button, Input, …), which these
aren't; they're domain composites. The `payments/` directory
doesn't exist and creating one for an extraction that the
contract modal will share would be miscategorised.

**How to apply:** Create the directory in PR 2C. Each file gets
TSDoc. Add a one-line note in [[component_library]] under a new
"Builder parts" section listing what's there + which modals
consume each.

### 11.5 Stripe Customer creation timing — **lazy, on first payment attempt**

A Stripe Customer record (on the MC's Connect account) is created
when the couple **first attempts payment** on the public invoice
page — never at quote-send or invoice-send time.

**Why:** Most quotes never get paid (declined, ghosted, replaced).
Creating a Stripe Customer for every quoted couple pollutes the
MC's Stripe dashboard with strangers. Lazy creation matches what
Stripe themselves recommend for marketplace platforms — Customer
objects should map to "people who actually transacted", not "people
the MC thought might transact". The trade-off is the MC can't pre-
populate the couple in Stripe; we don't expose that today and it's
not on the roadmap.

**How to apply:** `/api/stripe/invoice-payment` (PR 2D) does
`stripe.customers.create({ email, name }, { stripeAccount:
mcConnectAccountId })` on first payment if no customer exists for
that `couple_id`. Store the resulting `cus_…` on the
`couples.stripe_customer_id` column (already exists per [[database_schema]]).
Document the lazy-creation rule in [[payments]] under a new
"Customer lifecycle" subsection.

---

All five decisions are now load-bearing for PR 2A onward. Any
change to the above requires a doc update + a note here.
