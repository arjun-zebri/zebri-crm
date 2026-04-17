# Zebri Payments

Stripe is used for two distinct purposes:

1. **Subscription billing** — MCs subscribe to Zebri (one plan, monthly)
2. **Invoice payments** — Couples pay MC invoices by card via Stripe Connect

---

## Philosophy

- One plan, one price — no plan comparison pages
- Billing should be invisible once subscribed
- Use Stripe Checkout and Customer Portal — no custom payment forms
- 14-day free trial, no free tier

---

## Plans

| Plan | Price | Description |
|---|---|---|
| Starter | Free | Up to 5 couples, core CRM features |
| Pro | $49/mo | Unlimited couples + Couple portal, Song selection, Timeline Builder |
| Max | $89/mo | Everything in Pro + Pulse, Event Mode, Team members, Account manager (some Soon) |

All paid plans include a 14-day free trial. No credit card required to start trial.

---

## Subscription Fields in user_metadata

These fields live on the Supabase Auth user's `user_metadata` (see `authentication.md` for the full schema):

| Field | Type | Description |
|---|---|---|
| is_subscribed | boolean | `true` when subscription is active or trialing |
| stripe_customer_id | text | Stripe customer ID |
| subscription_status | text | `trialing`, `active`, `cancelled`, `past_due`, `expired` |
| subscription_plan | text | Plan identifier (e.g. `zebri_pro`) |
| trial_end | timestamp | When the trial expires |
| subscription_end | timestamp | When the subscription expires (set on cancellation) |
| is_beta_user | boolean | Beta user flag — uses `STRIPE_BETA_PRICE_ID` for lifetime discount |

---

## Subscription Lifecycle

```
sign_up → trialing → active → (cancelled / past_due) → expired
```

| Status | Meaning |
|---|---|
| trialing | Within 14-day free trial |
| active | Paying subscriber |
| cancelled | User cancelled — access continues until `subscription_end` |
| past_due | Payment failed — Stripe is retrying |
| expired | Trial or subscription ended — no access |

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

## Part 1 — API Routes

### `POST /api/stripe/checkout`

Creates a Stripe Checkout Session.

- Requires authenticated user
- Sets `client_reference_id` to the user's `auth.uid()`
- Uses `STRIPE_PRICE_ID` for the subscription
- Sets `subscription_data.trial_period_days` to 14 (if first subscription)
- If `user_metadata.is_beta_user` is `true`, uses `STRIPE_BETA_PRICE_ID` instead of `STRIPE_PRICE_ID`
- Returns `{ url: string }`

### `POST /api/stripe/portal`

Creates a Stripe Customer Portal session.

- Requires authenticated user
- Looks up `stripe_customer_id` from `user_metadata`
- Returns `{ url: string }`

### `POST /api/stripe/webhook`

Handles Stripe webhook events.

- Verifies webhook signature using `STRIPE_WEBHOOK_SECRET`
- Uses `SUPABASE_SERVICE_ROLE_KEY` to update user metadata via the admin API
- Resolves user via the `stripe_customers` lookup table

---

## Part 1 — Webhook Events

| Event | Action |
|---|---|
| `checkout.session.completed` (no `metadata.invoice_id`) | Create `stripe_customers` row, set `is_subscribed: true`, `subscription_status: 'trialing'` or `'active'`, store `stripe_customer_id` |
| `customer.subscription.updated` | Update `subscription_status`, `subscription_end`, `is_subscribed` based on new status |
| `customer.subscription.deleted` | Set `subscription_status: 'expired'`, `is_subscribed: false` |
| `invoice.payment_failed` | Set `subscription_status: 'past_due'` |
| `invoice.payment_succeeded` | Set `subscription_status: 'active'`, `is_subscribed: true` |

---

## Part 1 — stripe_customers Lookup Table

A minimal Supabase table used to resolve which user a Stripe webhook belongs to.

```sql
CREATE TABLE stripe_customers (
  stripe_customer_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now()
);
```

- Created when `checkout.session.completed` fires
- Queried by webhook handler to find the `user_id` for a given `stripe_customer_id`
- RLS: service role only (no client access)

---

## Part 1 — Paywall Logic

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

## Part 1 — Account Page — Subscription UI

The subscription section on `/account` shows state-specific messaging:

| Status | Message | CTA |
|---|---|---|
| No subscription | "Start your 14-day free trial" | "Start Free Trial" (goes to Checkout) |
| trialing | "Your trial ends on {trial_end}" | "Manage Billing" (goes to Portal) |
| active | "You're subscribed to Zebri Pro" | "Manage Billing" (goes to Portal) |
| cancelled | "Your access ends on {subscription_end}" | "Resubscribe" (goes to Checkout) |
| past_due | "Payment failed — please update your payment method" | "Update Payment" (goes to Portal) |
| expired | "Your subscription has expired" | "Subscribe" (goes to Checkout) |

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
| `NEXT_PUBLIC_APP_URL` | Public | App base URL (e.g. `https://app.zebri.com.au`) — used in redirect URLs |

Note: No publishable key is needed for invoice payments — Stripe Checkout is server-side only.

---

## Stripe Client (`lib/stripe.ts`)

```ts
import Stripe from 'stripe'
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})
```

---

## Part 1 — Subscription Billing (MC → Zebri)

---

## Dependencies

- `stripe` (Node.js Stripe SDK)

---

## Part 2 — Invoice Payments (Couple → MC via Stripe Connect)

Couples can pay MC invoices by credit card. Each MC connects their own Stripe Express account — funds flow directly to the MC. Zebri is the platform.

### Stripe Connect Setup

Uses **Stripe Connect Express accounts** (not the legacy OAuth flow). Express is the recommended approach for platforms — Stripe handles identity verification and onboarding UI.

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
2. Couple opens the public invoice link — sees "Pay with card" button
3. Couple clicks button → `POST /api/stripe/invoice-payment { invoiceId, shareToken }`
4. API creates a Stripe Checkout Session on the MC's connected account
5. Couple is redirected to Stripe Checkout
6. On payment success, Stripe redirects to `/invoice/payment-success?invoice=[id]`
7. Stripe fires `checkout.session.completed` webhook → invoice marked as `paid`

**Scope:** Stripe card payment is for the **full invoice total only**. When a payment schedule (deposit + final) is active, the "Pay with card" button is hidden — installment payments are tracked manually by the MC.

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

- No auth required — called from the public invoice page by an unauthenticated couple
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

No auth required. Shows a simple "Payment received" confirmation with a link back to the invoice. Invoice ID passed via `?invoice=[id]` query param (display only — actual status is confirmed via webhook).

File: `app/invoice/payment-success/page.tsx`

### Middleware

`/api/stripe/invoice-payment` must be exempt from the subscription paywall (couples are not logged in). Add to the exempt routes in `middleware.ts` alongside `/api/stripe/*`.
