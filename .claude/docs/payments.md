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
- Uses `SUPABASE_SERVICE_ROLE_KEY` to update user metadata via the admin API
- Resolves user via the `stripe_customers` lookup table

---

## Part 1  -  Webhook Events

| Event | Action |
|---|---|
| `checkout.session.completed` (no `metadata.invoice_id`) | Create `stripe_customers` row, set `is_subscribed: true`, `subscription_status: 'trialing'` or `'active'`, store `stripe_customer_id` |
| `customer.subscription.updated` | Update `subscription_status`, `subscription_end`, `is_subscribed` based on new status |
| `customer.subscription.deleted` | Set `subscription_status: 'expired'`, `is_subscribed: false` |
| `invoice.payment_failed` | Set `subscription_status: 'past_due'` |
| `invoice.payment_succeeded` | Set `subscription_status: 'active'`, `is_subscribed: true` |

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

### Stripe Connect Setup

Uses **Stripe Connect Express accounts** (not the legacy OAuth flow). Express is the recommended approach for platforms  -  Stripe handles identity verification and onboarding UI.

**MC onboarding flow:**
1. MC clicks "Connect Stripe" in Settings → Payments tab
2. Frontend hits `GET /api/stripe/connect`
3. API creates a Stripe Express account: `stripe.accounts.create({ type: 'express' })`
4. API creates an Account Link: `stripe.accountLinks.create({ account, refresh_url, return_url, type: 'account_onboarding' })`
   - `return_url` includes `?account_id=${account.id}` so the callback knows which account was connected
   - `refresh_url` points back to the initiation route to restart if the link expires
5. MC is redirected to Stripe's hosted onboarding UI
6. On completion, Stripe redirects to `return_url` → `/api/stripe/connect/callback?account_id=xxx`
7. Callback reads `account_id` from query params, updates MC's `user_metadata` with `stripe_connect_account_id` and `stripe_connect_enabled: true`
8. MC is redirected to `/settings?tab=payments&connected=true`

**MC disconnect:**
- Client-side only. `supabase.auth.updateUser({ data: { stripe_connect_account_id: null, stripe_connect_enabled: false } })`

### Stripe Connect user_metadata fields

| Field | Type | Description |
|---|---|---|
| `stripe_connect_account_id` | text | Stripe Express account ID (e.g. `acct_1PxXXX`) |
| `stripe_connect_enabled` | boolean | `true` once MC has completed Stripe onboarding |

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

#### `GET /api/stripe/connect`

Initiates Stripe Connect onboarding for the authenticated MC.

- Requires authenticated user
- Creates Stripe Express account
- Creates Account Link with `return_url` containing `account_id`
- Redirects to Stripe onboarding URL

#### `GET /api/stripe/connect/callback`

Handles return from Stripe onboarding.

- Reads `account_id` from query string
- Updates MC's `user_metadata`: `stripe_connect_account_id`, `stripe_connect_enabled: true`
- Uses Supabase Admin client (service role) to update auth user
- Redirects to `/settings?tab=payments&connected=true`
- On error: redirects to `/settings?tab=payments&error=connect_failed`

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
