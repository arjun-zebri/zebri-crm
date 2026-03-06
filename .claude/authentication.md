# Zebri Authentication

Authentication uses **Supabase Auth** with email + password. All user profile and subscription data is stored in `user_metadata` on the Supabase Auth user — there is no separate `users` table.

---

## Account Types

Stored in `user_metadata.account_type`:

- **admin** — platform operator (future use)
- **vendor** — wedding MC (default for self-registration)

---

## user_metadata Schema

| Field | Type | Description |
|---|---|---|
| account_type | text | `admin` or `vendor` |
| display_name | text | User's full name |
| business_name | text | MC business name |
| phone | text | Contact phone number |
| avatar_url | text | Profile image URL |
| is_subscribed | boolean | Active subscription flag |
| stripe_customer_id | text | Stripe customer ID |
| subscription_status | text | `trialing`, `active`, `cancelled`, `past_due`, `expired` |
| subscription_plan | text | Plan identifier (e.g. `zebri_pro`) |
| trial_end | timestamp | Trial expiry date |
| subscription_end | timestamp | Subscription expiry date |

Subscription fields are detailed in `.claude/payments.md`.

---

## Auth Method

**MVP:** Email + password only.

**Future:** Google OAuth as an additional sign-in option.

---

## Auth Flows

### Sign Up (Vendor Self-Registration)

1. User fills in email, password, display_name, business_name
2. `supabase.auth.signUp()` with `data: { account_type: 'vendor', display_name, business_name }`
3. Redirect to dashboard (email confirmation optional — configure in Supabase dashboard)

### Sign In

1. User enters email + password
2. `supabase.auth.signInWithPassword()`
3. Redirect to dashboard

### Sign Out

1. `supabase.auth.signOut()`
2. Redirect to `/login`

### Password Reset

1. User enters email on `/reset-password`
2. `supabase.auth.resetPasswordForEmail()` sends a reset link
3. Link redirects to `/update-password`
4. User enters new password
5. `supabase.auth.updateUser({ password })` saves it

---

## Supabase Client Setup

Uses `@supabase/ssr` for cookie-based session management across server and client.

### Browser Client

`lib/supabase/client.ts` — `createBrowserClient()` for client components.

### Server Client

`lib/supabase/server.ts` — `createServerClient()` for server components, server actions, and route handlers. Reads/writes cookies via `next/headers`.

### Middleware Client

`middleware.ts` — `createServerClient()` with request/response cookie handling. Refreshes the session on every request.

---

## Middleware Route Protection

File: `middleware.ts`

### Public Routes (no auth required)

- `/login`
- `/signup`
- `/reset-password`
- `/update-password`

### Protected Routes (auth required)

Everything else. If no session, redirect to `/login`.

### Subscription Paywall Check

After confirming auth, middleware checks `user_metadata.subscription_status` and date fields:

- If status is `trialing` and `trial_end` is in the future — allow access
- If status is `active` — allow access
- If status is `cancelled` and `subscription_end` is in the future — allow access (grace period)
- Otherwise — redirect to `/account` (where they can subscribe or resubscribe)

Paywall check skips `/account` and `/api/stripe/*` routes so users can manage billing.

---

## Route Groups

### `(auth)` — Authentication Pages

Routes: `/login`, `/signup`, `/reset-password`, `/update-password`

Layout: Centered card, no sidebar. Uses `app/(auth)/layout.tsx`.

### `(dashboard)` — CRM Pages

Routes: `/`, `/couples`, `/vendors`, `/events`, `/tasks`, `/account`

Layout: Sidebar + main content area. Uses `app/(dashboard)/layout.tsx`.

---

## Row-Level Security (RLS)

All CRM tables (`couples`, `vendors`, `events`, `tasks`) have a `user_id` column (uuid, not null) referencing `auth.users.id`.

### Standard Policy (per table)

```sql
-- Users can only see their own rows
CREATE POLICY "Users can view own rows" ON [table]
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rows" ON [table]
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rows" ON [table]
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own rows" ON [table]
  FOR DELETE USING (auth.uid() = user_id);
```

### Admin Override

Admins bypass RLS via a JWT-based check:

```sql
CREATE POLICY "Admins have full access" ON [table]
  FOR ALL USING (
    (auth.jwt() -> 'user_metadata' ->> 'account_type') = 'admin'
  );
```

---

## Session Management

Handled entirely by `@supabase/ssr`:

- Sessions stored in cookies (not localStorage)
- Middleware refreshes the session on every request
- No manual token handling required

---

## Account Page

Route: `/account`

Sections:

- **Profile** — edit display_name, business_name, phone, avatar_url via `supabase.auth.updateUser({ data: {...} })`
- **Password** — change password via `supabase.auth.updateUser({ password })`
- **Subscription** — shows current plan status, trial info, and action buttons (see `payments.md` for details)
- **Sign Out** — calls `supabase.auth.signOut()` and redirects to `/login`

---

## Environment Variables

| Variable | Visibility | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Supabase service role key (for admin operations and webhooks) |

---

## Dependencies

- `@supabase/supabase-js`
- `@supabase/ssr`
