# Zebri Payments

Payments use **Stripe** for subscription billing. The philosophy is: one plan, one price, invisible billing.

---

## Philosophy

- One plan, one price — no plan comparison pages
- Billing should be invisible once subscribed
- Use Stripe Checkout and Customer Portal — no custom payment forms
- 14-day free trial, no free tier

---

## Plan

| | |
|---|---|
| Name | Zebri Pro |
| Billing | Monthly |
| Trial | 14-day free trial |
| Free tier | None — after trial, subscription is required |

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

## API Routes

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

## Webhook Events

| Event | Action |
|---|---|
| `checkout.session.completed` | Create `stripe_customers` row, set `is_subscribed: true`, `subscription_status: 'trialing'` or `'active'`, store `stripe_customer_id` |
| `customer.subscription.updated` | Update `subscription_status`, `subscription_end`, `is_subscribed` based on new status |
| `customer.subscription.deleted` | Set `subscription_status: 'expired'`, `is_subscribed: false` |
| `invoice.payment_failed` | Set `subscription_status: 'past_due'` |
| `invoice.payment_succeeded` | Set `subscription_status: 'active'`, `is_subscribed: true` |

---

## stripe_customers Lookup Table

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

## Paywall Logic

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

## Account Page — Subscription UI

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
| `STRIPE_PUBLISHABLE_KEY` | Public | Stripe publishable key (if needed client-side) |
| `STRIPE_WEBHOOK_SECRET` | Server only | Webhook signing secret |
| `STRIPE_PRICE_ID` | Server only | Price ID for Zebri Pro plan |
| `STRIPE_BETA_PRICE_ID` | Server only | Price ID for beta user lifetime discount plan |

---

## Dependencies

- `stripe` (Node.js Stripe SDK)
