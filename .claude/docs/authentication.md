# Zebri — Authentication & Entitlements

Authentication uses **Supabase Auth** (email + password). There is no
separate `users` table; user profile fields, entitlements, and Stripe
identity are stored on the auth user row in **two** metadata bags:

- **`user_metadata`** — user-writable via `auth.updateUser({ data })`.
  Holds fields the user legitimately owns (display name, business
  name, phone, avatar, bank details).
- **`app_metadata`** — **server-only writable**, JWT-readable. Holds
  trust-level fields (account type, subscription, Stripe Connect
  identity). The §7.4 / Phase 0.8b fix moved every entitlement field
  here. See `.claude/docs/security.md` for the full rationale.

The two bags coexist because Supabase's `signUp({ data })` and
`updateUser({ data })` APIs can only write to `user_metadata`. The
INSERT trigger described below copies the trust fields across at
signup; everything after is server-only.

---

## Read entitlements through the helper

**Never** read entitlement fields directly from `user.user_metadata`
or `user.app_metadata`. Always go through `@/lib/auth/entitlements`:

```ts
import {
  accountType, isAdmin,
  subscriptionStatus, subscriptionPlan, isSubscribed, isBetaUser,
  trialEnd, subscriptionEnd, currentPlan, isActive,
  hasContractsAccess,
  stripeCustomerId, stripeSubscriptionId,
  stripeConnectAccountId, stripeConnectEnabled,
  updateEntitlements,
} from '@/lib/auth/entitlements'

if (isAdmin(user)) { … }
if (subscriptionStatus(user) === 'past_due') { … redirect to billing … }
```

The helper enforces the rule: once a user has been migrated (sentinel:
`app_metadata.account_type` is set), `user_metadata` is **ignored
entirely** for entitlement reads — a `auth.updateUser({ data: {
account_type: 'admin' } })` self-elevation attempt has no effect.

For users not yet migrated (transient state during the deploy window),
the helper falls back to `user_metadata`. The 0.8b backfill migration
+ the INSERT trigger ensure every existing and future user is
migrated automatically.

## Write entitlements through `updateEntitlements`

The single write path:

```ts
import { updateEntitlements } from '@/lib/auth/entitlements'

await updateEntitlements(admin, userId, {
  subscription_status: 'active',
  subscription_plan: 'zebri_pro',
  trial_end: null,
})
```

`admin` is the **service-role** Supabase admin client
(`createAdminClient()` from `lib/supabase/admin.ts`), never a
user-scoped client. Writes go to `app_metadata`. Call sites:

- Stripe webhook (`app/api/stripe/webhook/route.ts`) — subscription
  state changes, plan changes.
- Stripe Checkout (`app/api/stripe/checkout/route.ts`) — initial
  subscription setup + customer ID link.
- Stripe Connect callback
  (`app/api/stripe/connect/callback/route.ts`) — Connect identity.
- Admin actions (`app/admin/actions.ts`) — extend trial, comp user,
  link Stripe customer.

If you find a write to `user_metadata` for an entitlement field
outside these sites, it's a §7.4 regression — fix it.

---

## `app_metadata` schema (server-only writable)

| Field | Type | Description |
|---|---|---|
| `account_type` | text | `admin` or `vendor`. Migration sentinel: presence indicates the user has been migrated. |
| `subscription_status` | text | `trialing` · `active` · `cancelled` · `past_due` · `expired` |
| `subscription_plan` | text | Plan slug, e.g. `zebri_pro` |
| `is_subscribed` | boolean | Convenience flag (mirrors `status ∈ {trialing, active, cancelled-with-grace}`) |
| `trial_end` | timestamptz | Trial expiry |
| `subscription_end` | timestamptz | Subscription expiry (used for cancelled-with-grace) |
| `is_beta_user` | boolean | Lifetime discount entitlement |
| `stripe_customer_id` | text | Stripe customer (subscription billing) |
| `stripe_subscription_id` | text | Stripe subscription ID |
| `stripe_connect_account_id` | text | Connect Express account ID (`acct_…`) |
| `stripe_connect_enabled` | boolean | Connect onboarding complete |

## `user_metadata` schema (user-writable, ergonomics-only)

| Field | Type | Description |
|---|---|---|
| `display_name` | text | User's name |
| `business_name` | text | MC business name (shown on public quotes/invoices) |
| `phone` | text | Contact phone |
| `avatar_url` | text | Profile image URL |
| `website` | text | MC website |
| `instagram_url` | text | Instagram profile |
| `facebook_url` | text | Facebook page |
| `business_type` | text | `mc` or `celebrant` |
| `email_preferences` | object | `{ product_updates, booking_reminders, tips }` |
| `bank_account_name` | text | Bank details for invoice auto-fill |
| `bank_bsb` | text | BSB number |
| `bank_account_number` | text | Account number |
| Branding fields (`logo_url`, `brand_color`, `tagline`, `abn`, `show_contact_on_documents`, address) | various | See `branding.md` |

Bank / business / branding fields are **user-owned** — the user is
allowed to set them. They appear on the user's own public-surface
documents only. Editing them via `auth.updateUser({ data })` is fine.

---

## Auth flows

### Sign up (Phase 1 — server action)

The signup form posts to the **`signupAction`** server action in
`app/(auth)/actions.ts`. The action:

1. Parses + validates the FormData via `signupSchema`
   (`@/lib/auth/schemas`) — Zod, with a strong password rule.
2. Applies rate-limit (3 signups / hour / IP, in-memory).
3. Calls `supabase.auth.signUp({ email, password, options: {
   data: { display_name, business_name } } })`. **Only the user-
   owned fields go into `user_metadata`** — no trust fields.
4. Uses the admin client + `updateEntitlements()` to write
   `account_type: 'vendor'` directly to `app_metadata`. **No
   trial fields** — new signups land on Starter (5-couple cap is
   the only free tier).
5. Fires a `signup_completed` Slack alert via `sendAlert`
   (server-side; the prior client-side `/api/alerts/slack` POST is
   gone — closes that open POST surface).
6. `redirect('/')`.

Defence in depth: the **`sync_signup_app_metadata_on_insert`
trigger** (migration `20260521000000`) still fires on
`auth.users` INSERT, mirroring fields from `raw_user_meta_data` →
`raw_app_meta_data`. Since the signup action sends an empty
trust-field set into `user_metadata`, the trigger has nothing
trust-relevant to copy — but it stays as a safety net for any
future signup path (OAuth, magic link, federated) that bypasses
the server action.

The trigger fires on **insert only**, never on update — so
subsequent `auth.updateUser({ data })` calls cannot poison
`app_metadata`.

### Sign in / sign out (Phase 1 — server action)

Login posts to **`loginAction`** in `app/(auth)/actions.ts`:

1. Validates form data via `loginSchema` (Zod). The `next` field
   is restricted to same-origin relative paths
   (`sameOriginPathSchema` — blocks open-redirect attempts like
   `?next=//evil.com`; middleware also re-checks).
2. Rate-limits per IP (10 / minute).
3. Calls `supabase.auth.signInWithPassword`. On error returns the
   raw Supabase message — Supabase returns the same string for
   "wrong password" and "unknown email" so we don't leak which
   accounts exist.
4. `redirect(next ?? '/')` on success.

Logout calls `supabase.auth.signOut()` from the sidebar; no server
action needed.

### Already-logged-in redirect

Each auth page (login, signup, reset-password, update-password)
is a server component that checks for an existing session at the
top and `redirect('/')` away if found (except update-password,
which **requires** the session set by the password-reset magic
link).

### `?next=…` redirect-after-login

Middleware preserves the requested path on the unauth redirect:
`/couples` → `/login?next=/couples`. The `loginAction` reads
`next` from the form, re-validates against `sameOriginPathSchema`,
and bounces the user to that path on success. Defence in depth:
middleware also whitelists the path before setting it in the URL.

### Password reset

`/reset-password` → `supabase.auth.resetPasswordForEmail()` → email
link → `/update-password` → `supabase.auth.updateUser({ password })`.

---

## Supabase client setup

`@supabase/ssr` for cookie-based sessions across server and client.
All clients are generic-typed against `types/database.ts`:

- **Browser** — `lib/supabase/client.ts` →
  `createBrowserClient<Database>()`.
- **Server** — `lib/supabase/server.ts` →
  `createServerClient<Database>()`. Reads/writes cookies via
  `next/headers`.
- **Middleware** — `middleware.ts` → `createServerClient<Database>()`
  with request/response cookie handling. Refreshes the session on
  every request.
- **Admin** — `lib/supabase/admin.ts` → service-role client. Used
  only for `updateEntitlements()` and other server-only writes.
  Never imported into a `'use client'` file (CI gate enforces).

---

## Middleware route protection

File: `middleware.ts`.

### Public routes (no auth required)

`/login`, `/signup`, `/reset-password`, `/update-password`, plus the
public-surface prefixes `/quote`, `/invoice`, `/contract`, `/portal`,
`/timeline`, and a handful of webhook / cron API paths. See
`PUBLIC_ROUTES` in `middleware.ts:7`.

### Auth check

If no session and the path is not public → redirect to `/login`.

### Admin gate

If path starts with `/admin`, requires `isAdmin(user)` (entitlement
helper, reads `app_metadata.account_type === 'admin'`). Wrong
account type → redirect to `/`. **Never** reads
`user.user_metadata.account_type`.

### Subscription paywall

Skipped for `/settings`, `/admin`, `/api/stripe/*`, `/api/alerts/*`,
and any shadow-mode session.

Logic (`middleware.ts:107`): if `subscriptionStatus(user) ===
'past_due'`, redirect to `/settings?tab=billing`. Starter (free) is
a real long-term state, not a paywall block — feature limits (e.g.
the 5-couple cap) are enforced at the data layer via the
`enforce_starter_couple_limit` Postgres function, which also reads
from `app_metadata`.

---

## Row-Level Security (RLS)

All owned tables have a `user_id uuid not null` column referencing
`auth.users.id`. The base policy on every table is:

```sql
create policy "<table>_user_isolation" on <table>
  for all using (auth.uid() = user_id);
```

For the per-CRUD pattern (preferred when finer control is needed):

```sql
create policy "users can view own" on <table>
  for select using (auth.uid() = user_id);
-- … insert / update / delete each with their own policy.
```

The RLS coverage matrix (which tables exist, owner column, which have
integration tests, which page-phase each is tracked under) lives in
`.claude/docs/security.md`.

### Admin override — DO NOT use the `user_metadata` pattern

The legacy pattern below is **unsafe** and is gone from the
codebase. Do not re-introduce it:

```sql
-- DO NOT WRITE THIS:
create policy "admins have full access" on <table>
  for all using (
    (auth.jwt() -> 'user_metadata' ->> 'account_type') = 'admin'
  );
```

`user_metadata` is user-writable; a user could self-elevate to
admin and bypass tenant isolation. If admin override is genuinely
needed in a future migration, read from `app_metadata` instead:

```sql
(auth.jwt() -> 'app_metadata' ->> 'account_type') = 'admin'
```

In practice, Zebri does not use admin override at the RLS layer.
Admin operations go through server-only routes that use the
service-role client (which bypasses RLS), gated by middleware's
`isAdmin()` check.

---

## Session management

Handled entirely by `@supabase/ssr`:

- Sessions stored in cookies (not localStorage).
- Middleware refreshes the session on every request.
- No manual token handling required.

JWT refresh after an `app_metadata` write takes up to one auth
session refresh cycle (typically <1 minute). During the 0.8b deploy
window the entitlement helper's fallback to `user_metadata` smooths
this; in steady state, post-migration, app_metadata is always
authoritative.

---

## Settings page

Route: `/settings` — tabs Personal Info, Account, Plans & Billing,
Payments, Packages, Notifications. See `page-specs.md` for the full
behaviour spec.

- **Personal Info** writes to `user_metadata` (display_name,
  business_name, phone, avatar_url). Safe — these are user-owned.
- **Account** changes password via
  `supabase.auth.updateUser({ password })`.
- **Plans & Billing** is read-only in the UI; subscription state
  changes via Stripe webhook → `updateEntitlements()`.
- **Payments** writes bank details to `user_metadata` (user-owned).
  Stripe Connect onboarding redirects to Stripe; the callback
  writes `stripe_connect_*` to `app_metadata` via
  `updateEntitlements()`.

---

## Environment variables

| Variable | Visibility | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Publishable (anon) key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** | Service role key — bypasses RLS. Used by admin client only. **Never** referenced from any `'use client'` file (CI gate enforces). |

See `.env.example` for the complete list.

---

## Dependencies

- `@supabase/supabase-js`
- `@supabase/ssr`
