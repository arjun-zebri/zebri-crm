# Zebri Payments

Stripe is used for two distinct purposes:

1. **Subscription billing**  -  MCs subscribe to Zebri (one plan, monthly)
2. **Invoice payments**  -  Couples pay MC invoices by card via Stripe Connect

---

## Philosophy

- Billing should be invisible once subscribed
- Use Stripe Checkout and Customer Portal  -  no custom payment forms
- **Starter (5-couple cap) is the only free tier — no time-limited trial.**
  Phase 1 removed the 14-day trial; paid plans charge from day 1.

---

## Plans

| Plan | Price | Description |
|---|---|---|
| Starter | Free | Up to 5 couples, core CRM features (long-term, not a trial) |
| Pro | $49/mo | Unlimited couples + Couple portal, Song selection, Timeline Builder |
| Max | $89/mo | Everything in Pro + Pulse, Event Mode, Team members, Account manager (some Soon) |

---

## Subscription Fields in app_metadata

These fields live on the Supabase Auth user's `app_metadata` (server-only
writable post §7.4). Read via `@/lib/auth/entitlements`, never directly.
See `authentication.md` for the full schema:

| Field | Type | Description |
|---|---|---|
| is_subscribed | boolean | `true` when subscription is active |
| stripe_customer_id | text | Stripe customer ID |
| subscription_status | text | `active`, `cancelled`, `past_due`, `expired` (`trialing` legacy — admins can still set it for comps) |
| subscription_plan | text | Plan identifier (`pro` or `max`) |
| subscription_end | timestamp | When the subscription expires (set on cancellation) |
| is_beta_user | boolean | Beta user flag  -  uses `STRIPE_BETA_PRICE_ID` for lifetime discount |

`trial_end` still exists as a field but is no longer written at signup —
new signups land on Starter directly. Admins can still set `trial_end`
via the admin panel to comp users.

---

## Subscription Lifecycle

```
sign_up → Starter (free, 5-couple cap)
              ↓ Subscribe
            active → (cancel_at_period_end / past_due) → expired → Starter
```

| Status | Meaning |
|---|---|
| (unset) | Starter — the long-term free tier |
| active | Paying subscriber |
| cancelled | User cancelled  -  access continues until `subscription_end` |
| past_due | Payment failed  -  Stripe is retrying |
| expired | Subscription ended  -  reverts to Starter |
| trialing | Legacy — only set by admin "Extend trial" tool for comps |

---

## Stripe Checkout

Used for initial subscription. No custom payment forms.

**Flow:**

1. User clicks "Subscribe" on `/account`
2. Frontend calls `POST /api/stripe/checkout`
3. API creates a Stripe Checkout Session with the `STRIPE_PRICE_ID` and the user's email
4. API returns the checkout URL
5. Frontend redirects to Stripe Checkout
6. On success, Stripe redirects back to `/account?checkout=success`
7. Webhook updates `user_metadata` with subscription details

---

## Stripe Customer Portal

Used for managing billing, updating payment method, and cancelling.

**Flow:**

1. User clicks "Manage Billing" on `/account`
2. Frontend calls `POST /api/stripe/portal`
3. API creates a Stripe Customer Portal session using the user's `stripe_customer_id`
4. API returns the portal URL
5. Frontend redirects to Stripe Portal
6. On return, user comes back to `/account`

---

## Part 1  -  API Routes

### `POST /api/stripe/checkout`

Creates a Stripe Checkout Session.

- Requires authenticated user
- Sets `client_reference_id` to the user's `auth.uid()`
- Uses `STRIPE_PRICE_ID` for the subscription
- **No `trial_period_days`** — Phase 1 removed the 14-day trial; subscriptions charge from day 1
- If the user is a beta user (`isBetaUser(user)` via the entitlements helper), uses `STRIPE_BETA_PRICE_ID` instead
- Returns `{ url: string }`

### `POST /api/stripe/portal`

Creates a Stripe Customer Portal session.

- Requires authenticated user
- Looks up `stripe_customer_id` from `app_metadata`
- Returns `{ url: string }`

### Plans & Billing tab server actions (Phase 1)

In addition to the legacy `/api/stripe/*` routes, the Plans &
Billing tab uses server actions in
`app/(dashboard)/settings/billing/actions.ts`:

- **`createPlanChangeSessionAction(plan)`** — builds a Stripe
  Customer Portal session deep-linked to the
  `subscription_update_confirm` flow. Returns `{ url }` for the
  client to redirect to. Stripe shows the user a confirmation page
  with the prorated amount, the user accepts, and Stripe redirects
  back to `/settings?tab=billing&change=success`. Used by the
  "Switch to Pro" / "Switch to Max" buttons in the comparison
  modal.
- **`cancelSubscriptionAction()`** — calls
  `stripe.subscriptions.update(... cancel_at_period_end: true)`
  and writes both `cancel_at_period_end: true` and
  `subscription_end` to `app_metadata` synchronously from the
  Stripe response (so the UI shows the end date immediately,
  without waiting on the webhook).
- **`resumeSubscriptionAction()`** — symmetric: clears
  `cancel_at_period_end` and `subscription_end` in `app_metadata`.
- **`paymentMethodPortalAction()`** — Stripe Portal session
  deep-linked to `flow_data.type: 'payment_method_update'` for
  managing the card on Stripe's PCI surface.

### Quote + Invoice builder server actions (Phase 2C.2)

The Quote + Invoice builder modals route all mutations through
typed server actions in
`app/(dashboard)/payments/actions.ts`:

- **`saveQuoteAction(input)`** — Zod-validates the input, RLS-scopes
  the writes via the session Supabase client, and replaces line
  items in a single call (delete + insert). For new quotes, calls
  `generate_quote_number(p_user_id)` first.
- **`saveInvoiceAction(input)`** — same shape with invoice-specific
  fields (payment terms, due date, deposit schedule,
  `stripe_payment_enabled`). **Every inserted `invoice_items` row
  gets `quantity = 1, unit_price = amount`** as a forward-compat
  invariant — the new 2C.2 UI removed the quantity field, but the
  schema columns stay until a Phase 9 follow-up. The
  `get_public_invoice` RPC still returns qty/unit/amount; the
  public invoice page renders them harmlessly.
- **`deleteQuoteAction(quoteId)` / `deleteInvoiceAction(invoiceId)`**
  — RLS-scoped destructive deletes. Cascade handles items.

Status-changing mutations (mark deposit/final/full paid, revert,
cancel) stay inline in the modals as one-line UPDATEs — they're
RLS-protected by the session client and don't justify their own
server actions.

### `invoice_items.quantity` + `unit_price` deprecation

The two columns remain in the schema for forward-compat. New writes
default `quantity = 1` and mirror `amount` into `unit_price`. The
public invoice RPC + PDF generator both still read them. A clean
column drop is scheduled for a Phase 9 (Quotes) follow-up once the
new UI has soaked for a release; it'll need a
`@ALLOW_DESTRUCTIVE` marker + a one-time backfill for any historic
rows where `quantity > 1`.

## Stripe Dashboard configuration (REQUIRED for plan changes)

The `subscription_update_confirm` flow used by
`createPlanChangeSessionAction` requires explicit configuration in
the Stripe Customer Portal settings — without it, Stripe returns
`This subscription cannot be updated because the subscription
update feature in the portal configuration is disabled.`

Both **test** and **live** modes have independent portal configs:

- Test: https://dashboard.stripe.com/test/settings/billing/portal
- Live: https://dashboard.stripe.com/settings/billing/portal

### Required settings

| Section | Setting | Value |
|---|---|---|
| Features → Subscriptions | "Customers can switch plans" | **enabled** |
| Features → Subscriptions | Products list | Pro + Max (add both, with their respective monthly prices) |
| Features → Subscriptions | Proration | **"Create invoice items on next invoice"** — keeps the credit on the next renewal so downgrades don't generate a $0 credit invoice in billing history |
| Features → Subscriptions | "Customers can cancel subscriptions" | enabled (the in-app cancel uses the API directly, but keeping this on is harmless) |
| Features → Payment methods | "Customers can update their payment methods" | **enabled** (the "Update payment method" link uses the `payment_method_update` deep-link flow) |
| Business information | All applicable fields | set (Stripe requires them before any portal session can be created) |

After enabling: save the portal config, then test the "Switch to
Max" / "Switch to Pro" buttons in `/settings?tab=billing` against
a paying test user.

When promoting to production, repeat the same configuration in
live mode — there is no automatic copy.

### `POST /api/stripe/webhook`

Handles Stripe webhook events.

- Verifies webhook signature using `STRIPE_WEBHOOK_SECRET`
  (platform events) or `STRIPE_CONNECT_WEBHOOK_SECRET` (when
  `stripe-account` header is present, i.e. Connect events — full
  Connect handling lands in PR 2D).
- **Idempotent via the `stripe_events` ledger** (Phase 2A) — the
  handler INSERTs the event ID first; a primary-key conflict means
  Stripe has retried an event we've already processed, so we
  return 200 without re-running side effects.
- **Per-event Zod schemas** in `lib/payments/webhook-events.ts`
  validate `event.data.object` against only the fields we read,
  so Stripe-side API evolution doesn't silently break us. Schema
  failures fire `stripe_webhook_failed` and ack with 200 (no
  retry on malformed events).
- **Replay alerting** — single retries are normal and silent;
  3+ replays of the same event ID within 60 seconds fires
  `stripe_webhook_replay` exactly once per breach.
- Uses `SUPABASE_SERVICE_ROLE_KEY` to update user metadata via
  the admin API. Resolves user via the `stripe_customers` lookup
  table.

#### `stripe_events` idempotency ledger

Migration: `20260522000000_create_stripe_events_ledger.sql`.

```sql
create table public.stripe_events (
  id text primary key,           -- Stripe event ID (evt_…)
  type text not null,
  received_at timestamptz not null default now()
);
```

- RLS enabled with **no permissive policy** — service-role only.
  The webhook handler is the sole reader/writer.
- Retention: **90 days**, daily prune via
  `/api/cron/prune-stripe-events` at 03:00 UTC. 3× Stripe's
  30-day replay window; beyond that Stripe can't redeliver so
  retaining is pointless. See [[phase_2_payments]] §11.1.
- The cron fires `stripe_events_prune_high` if it deletes
  > 5,000 rows in a single run (signal of either backfill
  recovery or event spam).

---

## Part 1  -  Webhook Events

| Event | Action |
|---|---|
| `checkout.session.completed` (subscription) | Create `stripe_customers` row, set `is_subscribed: true`, `subscription_status`, store `stripe_customer_id` + `stripe_subscription_id` + `subscription_end` |
| `checkout.session.completed` (`metadata.invoice_id` set) | Mark the linked invoice paid (deposit / final / full) + mirror total back to `events.price` |
| `customer.subscription.created` | Mirror lifecycle into `app_metadata` |
| `customer.subscription.updated` | Update `subscription_status`, `subscription_end`, `is_subscribed`, `cancel_at_period_end` based on new status |
| `customer.subscription.deleted` | Set `subscription_status: 'cancelled'`, `is_subscribed: false` |
| `invoice.payment_failed` | Set `subscription_status: 'past_due'` |
| `invoice.payment_succeeded` (recurring cycle only) | Recover past_due → active; surface recurring-payment Slack alert |

The webhook handler validates each event's `data.object` against
the per-event Zod schema in `lib/payments/webhook-events.ts`;
unknown event types are acked with 200 and a structured log line
(Stripe sends a wide spectrum, we only do work for what we've
subscribed to in the Dashboard).

### Rate-limits on the Stripe routes (Phase 2A)

Exported from `lib/api/rate-limit.ts` as `STRIPE_RATE_LIMITS`:

| Route | Window | Max | Key | Hit alert |
|---|---|---|---|---|
| `POST /api/stripe/checkout` | 60s | 5 | per user | `stripe_rate_limit_hit` (action=checkout) |
| `POST /api/stripe/portal` | 60s | 10 | per user | `stripe_rate_limit_hit` (action=portal) |
| `GET /api/stripe/billing-history` | 60s | 30 | per user | `stripe_rate_limit_hit` (action=billingHistory) |
| `POST /api/stripe/invoice-payment` | 60s | 10 | per IP | `stripe_rate_limit_hit` (action=invoicePayment) (added in PR 2D) |

Keyed on `user.id` for authenticated routes, IP for the public
invoice-payment endpoint (which has no session).

### Customer lifecycle (§11.5 lock-in)

Stripe **Customer** records for the COUPLE side (Connect — paying
the MC's invoice) are created **lazily, on first payment attempt**
— never at quote-send or invoice-send time. Rationale: most quotes
never get paid (declined / ghosted / replaced); pre-creating
customers pollutes the MC's Stripe dashboard with strangers. The
trade-off is the MC can't pre-populate the couple in Stripe; we
don't expose that workflow today.

MC-side Customer records (for paying Zebri the subscription) are
created up-front in `/api/stripe/checkout`, since we need the
`customer` ID to attach the subscription to.

---

## Part 1  -  stripe_customers Lookup Table

A minimal Supabase table used to resolve which user a Stripe webhook belongs to.

```sql
CREATE TABLE stripe_customers (
  stripe_customer_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now()
);
```

- Inserted up-front in `/api/stripe/checkout` when the Stripe customer is created (so the lookup row exists before any webhook fires).
- Webhook handler (`checkout.session.completed`) also upserts as a safety net.
- Queried by webhook handlers as a fallback when Stripe event metadata is missing `supabase_user_id`  -  covers `customer.subscription.updated/deleted`, `invoice.payment_failed`, `invoice.payment_succeeded`.
- RLS: service role only (no client access).

---

## Part 1  -  Paywall Logic

Handled in `middleware.ts` (see `authentication.md` for details).

**Access is allowed when:**

- `subscription_status` is `trialing` AND `trial_end` is in the future
- `subscription_status` is `active`
- `subscription_status` is `cancelled` AND `subscription_end` is in the future

**Access is denied when:**

- `subscription_status` is `expired`
- `subscription_status` is `past_due` (redirect to `/account` to update payment)
- No subscription fields exist (new user who hasn't started checkout)

Denied users are redirected to `/account` where they can subscribe or manage billing.

The `/account` page and `/api/stripe/*` routes are always accessible (exempt from paywall).

---

## Part 1  -  Account Page  -  Subscription UI

The subscription section on `/account` shows state-specific messaging:

| Status | Message | CTA |
|---|---|---|
| Starter (no subscription) | "Free plan · X of 5 couples used" | "Upgrade to Pro" (Checkout) |
| active | "Active · Renews {date}" | "Manage subscription" (Portal) · "Cancel" (Portal) |
| active + cancel_at_period_end | "Cancels {subscription_end}" | "Resubscribe" (Portal) |
| past_due | "Payment failed" + inline danger banner | "Update payment" (Portal) |
| expired | "Subscription ended" | "Upgrade to Pro" (Checkout) |
| comped (admin-set) | "Comped account" | No action row |

---

## Environment Variables

| Variable | Visibility | Description |
|---|---|---|
| `STRIPE_SECRET_KEY` | Server only | Stripe secret API key |
| `STRIPE_WEBHOOK_SECRET` | Server only | Webhook signing secret for platform events (subscriptions) |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Server only | Webhook signing secret for Connect events (invoice payments) |
| `STRIPE_PRO_PRICE_ID` | Server only | Price ID for Zebri Pro plan ($49/mo) |
| `STRIPE_MAX_PRICE_ID` | Server only | Price ID for Zebri Max plan ($89/mo) |
| `STRIPE_BETA_PRICE_ID` | Server only | Price ID for beta user lifetime discount plan |
| `NEXT_PUBLIC_APP_URL` | Public | App base URL (e.g. `https://app.zebri.com.au`)  -  used in redirect URLs |

Note: No publishable key is needed for invoice payments  -  Stripe Checkout is server-side only.

---

## Stripe Client (`lib/stripe.ts`)

```ts
import Stripe from 'stripe'
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})
```

---

## Part 1  -  Subscription Billing (MC → Zebri)

---

## Dependencies

- `stripe` (Node.js Stripe SDK)

---

## Part 2  -  Invoice Payments (Couple → MC via Stripe Connect)

Couples can pay MC invoices by credit card. Each MC connects their own Stripe Express account  -  funds flow directly to the MC. Zebri is the platform.

### Stripe Connect Setup (Phase 2D.1 — embedded onboarding)

Uses **Stripe Connect Express accounts** + Stripe's **embedded
Connect components** (`<ConnectAccountOnboarding>` +
`<ConnectAccountManagement>` + `<ConnectNotificationBanner>` via
`@stripe/react-connect-js`). MC never leaves Zebri — Stripe-hosted
iframes render inline at `/settings?tab=payments`. Stripe still
owns KYC verification + document collection; we just host the UI.

Replaces the prior hosted-AccountLink redirect flow (Phase 2D.1
2026-05-24). Full plan: `.claude/docs/phase-2d-stripe-connect-embedded.md`.

**MC onboarding flow:**
1. MC clicks "Set up card payments" in Settings → Payments tab
2. Client POSTs to `/api/stripe/connect` — server creates the
   Express account (or rebinds `last_account_id` if one exists),
   writes `app_metadata.stripe_connect_account_id`, seeds the
   `connect_accounts` mirror row with capability flags = false.
3. Client mounts `<ConnectAccountOnboarding>` inline. The component
   calls back to `/api/stripe/connect/account-session` for a fresh
   `client_secret` on each render. Stripe handles identity
   verification + document upload + bank-account verification
   inside the embedded iframe.
4. Stripe fires `account.updated` webhook → handler in
   `lib/payments/connect-events.ts` mirrors the snapshot into
   `connect_accounts` and flips `app_metadata.stripe_connect_enabled`
   based on `charges_enabled`.
5. Once `charges_enabled = true`, the client swaps to
   `<ConnectAccountManagement>` for ongoing account changes.

**MC disconnect:**
- Client POSTs to `/api/stripe/connect/disconnect` (auth-route
  rate-limited, 5/min/IP). Server-side `updateEntitlements()`
  clears `app_metadata.stripe_connect_*` and moves the live
  `account_id` to `last_account_id` in `connect_accounts` (so a
  future re-connect can rebind without creating a new Stripe
  account). Closes the §7.4 hole where the previous flow wrote
  to `user_metadata` from the client.

### Stripe Connect — durable state

Two-tier:

- **`app_metadata`** (fast-path entitlement read):
  | Field | Type | Description |
  |---|---|---|
  | `stripe_connect_account_id` | text | Stripe Express account ID (e.g. `acct_1Q...`) |
  | `stripe_connect_enabled` | boolean | Mirror of `charges_enabled`; flipped by the `account.updated` webhook handler |

- **`connect_accounts` table** (detail, populated by webhooks):
  account_id, charges_enabled, payouts_enabled, details_submitted,
  requirements_currently_due, requirements_past_due, disabled_reason,
  default_currency, country, business_type, last_account_id.
  See migration `20260524000000_create_connect_accounts.sql` +
  `lib/payments/connect-account.ts` for the schema + reader/writer.

### Connect webhook handlers (Phase 2D.1)

| Event | Action |
|---|---|
| `account.updated` | Mirror snapshot into `connect_accounts`; flip `app_metadata.stripe_connect_enabled` based on `charges_enabled`; Slack alert (`stripe_connect_disabled`) if `requirements.disabled_reason` is non-null. |
| `capability.updated` | Re-fetch the account from Stripe (the event payload doesn't carry the full requirements list) and run the same handler as `account.updated`. |
| `account.application.deauthorized` | Clear `app_metadata.stripe_connect_*` + `connect_accounts.account_id` *and* `last_account_id` (vendor explicitly cut us off — no silent rebind). Slack alert (`stripe_connect_deauthorized`). |

All three dispatch from the Connect branch of `app/api/stripe/webhook/route.ts`
through `applyConnectEvent()` in `lib/payments/connect-events.ts`.
Idempotency is enforced by the `stripe_events` ledger from Phase 2A —
same retry semantics as platform events.

### Invoice payment flow

1. MC enables "Accept card payments" toggle on an invoice (only visible if `stripe_connect_enabled = true`)
2. Couple opens the public invoice link  -  sees "Pay with card" button
3. Couple clicks button → `POST /api/stripe/invoice-payment { invoiceId, shareToken }`
4. API creates a Stripe Checkout Session on the MC's connected account
5. Couple is redirected to Stripe Checkout
6. On payment success, Stripe redirects to `/invoice/payment-success?invoice=[id]`
7. Stripe fires `checkout.session.completed` webhook → invoice marked as `paid`

**Scope:** Stripe card payment is for the **full invoice total only**. When a payment schedule (deposit + final) is active, the "Pay with card" button is hidden  -  installment payments are tracked manually by the MC.

### Invoice Payment API routes

#### `POST /api/stripe/connect`

Create-or-bind the MC's Connect account (Phase 2D.1).

- Auth required; rate-limited 5/min/IP.
- First call: `stripe.accounts.create({ type: 'express' })` + seeds mirror row + writes `app_metadata.stripe_connect_account_id`.
- Repeat call when already bound: idempotent, returns existing `accountId`.
- Repeat call after server-initiated disconnect: rebinds `last_account_id` instead of creating a new Stripe account.
- Returns `{ accountId }` — client mounts `<ConnectAccountOnboarding>` next.

#### `POST /api/stripe/connect/account-session`

Mints a fresh Account Session `client_secret` for the embedded
components (Phase 2D.1).

- Auth required; rate-limited 30/min/IP (embedded SDK re-fetches on each render).
- 400 if no Connect account bound yet (caller should kick off via `/api/stripe/connect` first).
- Components enabled: `account_onboarding`, `account_management`, `notification_banner`.

#### `POST /api/stripe/connect/disconnect`

Server-side disconnect — closes the §7.4 client-write hole.

- Auth required; rate-limited 5/min/IP.
- Moves `account_id` → `last_account_id` in `connect_accounts` (so a future re-connect can rebind).
- `updateEntitlements()` clears `app_metadata.stripe_connect_*`.
- The Stripe account itself is NOT deleted (Express accounts don't support programmatic deletion).

#### `GET /api/stripe/connect/status`

Reads the current user's `connect_accounts` mirror row.

- Auth required.
- Returns `{ state: ConnectAccountState | null }`.
- Used by the settings page to render the Zebri-side status panel
  (capabilities, requirements, disabled_reason) above the embedded
  Stripe components.

#### ~~`GET /api/stripe/connect/callback`~~ — deleted in Phase 2D.1

Embedded onboarding has no redirect. The route file is removed.

#### `POST /api/stripe/invoice-payment`

Creates a Stripe Checkout Session for couple to pay an invoice.

Request body: `{ invoiceId: string, shareToken: string }`

- No auth required  -  called from the public invoice page by an unauthenticated couple
- Fetches invoice via service role client (bypasses RLS)
- Validates: `stripe_payment_enabled = true`, status not `paid` or `cancelled`
- Fetches MC's `stripe_connect_account_id` from user_metadata via Admin client
- Validates Stripe card payment is appropriate: payment schedule must NOT be active (i.e. `deposit_percent IS NULL`)
- Computes `amountCents = Math.round((subtotal + subtotal * tax_rate / 100) * 100)`
- Creates Checkout Session routed to connected account:
  ```ts
  stripe.checkout.sessions.create(
    { mode: 'payment', line_items: [...], metadata: { invoice_id }, success_url, cancel_url },
    { stripeAccount: connectedAccountId }
  )
  ```
- Returns `{ url: session.url }`

### Connect Webhook events

Connect webhook events arrive with a `stripe-account` header. They use a **separate signing secret** (`STRIPE_CONNECT_WEBHOOK_SECRET`) from platform events.

| Event | Action |
|---|---|
| `checkout.session.completed` (with `metadata.invoice_id`) | Mark invoice `paid`, set `paid_at`, set `stripe_payment_intent_id`. If `event_id` linked, update `events.price`. |

### Webhook differentiation

In `app/api/stripe/webhook/route.ts`, detect connect events by checking for the `stripe-account` header:

```ts
const stripeAccount = request.headers.get('stripe-account')
const secret = stripeAccount
  ? process.env.STRIPE_CONNECT_WEBHOOK_SECRET!
  : process.env.STRIPE_WEBHOOK_SECRET!
const event = stripe.webhooks.constructEvent(body, sig, secret)
```

If `metadata.invoice_id` is present on a `checkout.session.completed` event, it's an invoice payment. Otherwise it's a subscription checkout.

### Stripe dashboard configuration

Register **two webhook endpoints**:
1. Platform webhook → handles subscription events → uses `STRIPE_WEBHOOK_SECRET`
2. Connect webhook → check "Listen to events on Connected accounts" → handles `checkout.session.completed` → uses `STRIPE_CONNECT_WEBHOOK_SECRET`

Both endpoints can point to the same route handler (`/api/stripe/webhook`).

### Payment success page

Route: `/invoice/payment-success`

No auth required. Shows a simple "Payment received" confirmation with a link back to the invoice. Invoice ID passed via `?invoice=[id]` query param (display only  -  actual status is confirmed via webhook).

File: `app/invoice/payment-success/page.tsx`

### Middleware

`/api/stripe/invoice-payment` must be exempt from the subscription paywall (couples are not logged in). Add to the exempt routes in `middleware.ts` alongside `/api/stripe/*`.
