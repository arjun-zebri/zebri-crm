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
documents only. Editing them via `auth.updateUser({ data })` is fine,
**except the payment details** (`bank_account_name`, `bank_bsb`,
`bank_account_number`, `abn`): a trigger on `auth.users` refuses any
change to those unless it comes from the 2FA-guarded
`set_my_payment_details` RPC (Task 23c). Use `savePaymentDetails` and
strip them from every `updateUser` spread with `withoutPaymentDetails`
(`lib/branding/payment-details.ts`). See "Two-factor sign-in".

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
4. If the user has a verified TOTP factor, `redirect('/login/mfa?next=…')`
   (see "Two-factor sign-in" below); otherwise `redirect(next ?? '/')`.

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

### OAuth flows: Email and Calendar (Phase 0.8c+)

The OAuth flow now supports multiple purposes, specified via query
parameter. Both email and calendar flows use the same callback
handler; the `purpose` field in the state cookie determines where
to redirect and what to do with the tokens.

**State format** (CSRF protection): `<provider>.<purpose>.<random_32_hex>`

- Legacy two-part states (`<provider>.<random>`) parse as `purpose='email'`
  for backward compatibility.
- Signed httpOnly cookie pins the state on authorize; callback re-checks.
- Callback clears the cookie once verified.

**Purpose: email** (Settings → Public Page → Email)

Connects an MC's Gmail or Outlook mailbox for send-as identity in
outbound emails. Tokens stored in `user_public_settings` via the
OAuth callback. Scopes: Google `openid email gmail.send` (send-only);
Microsoft `openid email Mail.Send` (send-only).

Callback redirects: `/settings?tab=public&oauth=connected` on success,
`/settings?tab=public&oauth=error` on failure.

**Purpose: calendar** (Scheduler Phase A)

Connects an MC's Google Calendar or Outlook calendar for event sync.
Tokens stored in `calendar_connections` table via the OAuth callback.
Scopes: Google `openid email calendar.events calendar.freebusy`
(read+write events, read free-busy); Microsoft `openid email
offline_access Calendars.ReadWrite` (read+write all calendars).

Connecting is offered from two places: Settings → Public Page →
Calendars, and the `/calendar` route (banner above the tabs, plus
per-tab prompts on the grid and the Meeting types tab). Both build the
authorize URL through `calendarConnectUrl()` in
`components/calendar/connect-url.ts`.

**Return destination** (`?return=settings|calendar`)

So a connect started on `/calendar` does not dump the MC back in
Settings, authorize accepts an optional `return`, validated by
`isOAuthReturnTo()` in `lib/oauth/providers.ts` and stashed in a second
short-lived httpOnly cookie, `zebri_oauth_return`.

- The value is an **allowlist** (`settings` | `calendar`), never a
  caller-supplied path. It survives a redirect out to a third-party
  consent screen and back, so echoing arbitrary input would be an open
  redirect. Anything unrecognised, absent, or tampered with falls back
  to `settings`.
- It is kept **out of** the `state` string on purpose, so
  `parseOAuthState()` and the state equality check are untouched: this
  is a UX detail, not part of the CSRF token.
- The callback reads it before the decline branch, so a cancelled
  consent also returns to the page the MC started from.
- Cleared alongside the state cookie once the callback completes.

Callback redirects (calendar): `/settings?tab=public&calendar=<status>`
when `return=settings` (the default), `/calendar?calendar=<status>`
when `return=calendar`, where `<status>` is `connected` or `error`.

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

### Two-factor gate

Runs for every signed-in, non-public request. If the user has a
verified TOTP factor and the session is still `aal1`, pages redirect
to `/login/mfa?next=<path>` and `/api/*` answers `401
{"error":"second_factor_required"}`. The only exception is a verified
shadow grant (see "Two-factor sign-in"). Full design below.

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

## Two-factor sign-in (TOTP, Phase 4 Task 23)

Opt-in per MC from Settings, Account. Supabase Auth provides the
TOTP factor and the `aal1` / `aal2` session levels; Zebri adds the
gate, the recovery codes and the shadow waiver.

Config: `[auth.mfa.totp] enroll_enabled = true, verify_enabled = true`
in `supabase/config.toml`. The hosted project needs the same switch
(Dashboard, Authentication, Multi-Factor, TOTP); that is an owner step,
not a deploy step.

### Enrolment (`app/(dashboard)/settings/two-factor-*.tsx`)

1. "Turn on two-factor sign-in" opens `TwoFactorEnrolModal`, which
   removes any abandoned unverified TOTP factor, then calls
   `mfa.enroll({ factorType: 'totp' })` in the browser and shows the QR
   code plus the text secret.
2. The MC types a code; `mfa.challengeAndVerify` verifies the factor and
   raises this session to `aal2`.
3. Only then `issueRecoveryCodesAction` (server, requires `aal2` and a
   verified factor, rate-limited) creates ten recovery codes and
   returns them once.

2FA is never left on without recovery codes: closing the modal before
the codes are on screen unenrols the factor, whether it was still
unverified or verified but code issuing failed (the session is `aal2`
by then, which Supabase needs to remove a verified factor). The steps
live in `use-totp-enrolment.ts`; the modal and the scan step are thin.
If that removal fails, the modal stays open and says 2FA is on with no
codes. As a backstop, the Settings card warns whenever 2FA is on with
zero unused recovery codes and makes **New recovery codes** the
primary action.

The card then shows "On since <date>. N of 10 recovery codes left."
with **New recovery codes** (replaces all codes, requires `aal2`) and
**Turn off** (unenrols as the user, which Supabase itself refuses
below `aal2`, then deletes the unused codes). Both sit behind a
`ConfirmDialog`.

### Enforcement (`middleware.ts`, `lib/auth/mfa.ts`)

`needsSecondFactor(user, accessToken)` is true when the user has a
verified factor and the access token's `aal` claim is not `aal2`. The
factor list comes from the `user` that `getUser()` returned (validated
by the Auth server), never from `session.user` in the cookie: that copy
is browser-editable JSON, and deleting its factors would make
`mfa.getAuthenticatorAssuranceLevel()` (no-argument form) report
`nextLevel: aal1`. A missing or unreadable token counts as owing the
factor (fail closed).

`/login/mfa` (under the public `/login` prefix, so the gate never loops)
asks for the 6-digit code, verifies it in the browser with
`challengeAndVerify`, and does a full navigation to `next` so the
middleware sees the upgraded cookie. `next` must pass the hardened
`sameOriginPathSchema` (see below).

Code checks are rate-limited in the app as well as by Supabase:
`beginTotpAttemptAction` (`app/(auth)/login/mfa/totp-attempt.ts`) runs
before every verify on the code screen and in the enrolment modal, and
refuses past 10 tries per user or 30 per IP in 15 minutes. The verify
itself stays in the browser so Supabase's own per-IP limit sees the MC's
IP, not Vercel's shared egress addresses.

**Database-level enforcement (Task 23b, `20261019000000`).** The Next
gate only sees requests that go through Next. A password thief can call
`signInWithPassword` with the publishable key and use the `aal1` token
against PostgREST, Storage and RPCs directly, so the database enforces
the same rule:

- `public.mfa_satisfied()` (definer, stable, `search_path = ''`) is true
  when the JWT `aal` is `aal2`, when the user has no **verified** factor
  in `auth.mfa_factors`, or when the JWT `session_id` is an **open**
  `admin_shadow_sessions` row for that user (`ended_at` null, before
  `expires_at`) whose admin is **still** an admin (`app_metadata`
  `account_type = 'admin'`, as `isAdmin` reads it; `20261019100000`):
  the same shadow waiver as the Next layer, bound to one GoTrue session
  instead of a cookie. Demoting the admin ends it immediately, even
  though the row stays open. An unverified (mid-enrolment) factor does
  not count, so enrolling never locks the MC out. It is also true with no user in
  the JWT (anon, service role, cron, migrations, GoTrue).
- Every public RLS table carries a RESTRICTIVE policy `require_mfa`,
  `for all to authenticated using ((select public.mfa_satisfied())) with
  check (...)`, ANDed with the table's own policies. An `aal1` session of
  a 2FA MC reads zero rows and has every write refused (42501). The same
  policy sits on `storage.objects`.
- Definer RPCs bypass RLS, so the ones that act for `auth.uid()`
  (`increment_ai_copilot_usage`, `set_my_payment_details`) start with
  `if not public.mfa_satisfied() then raise exception using errcode =
  '42501', message = 'second factor required'`. Every other definer
  function a signed-in caller can execute is token-gated, a trigger, a
  helper, or service-role only; the list and reasons are in
  `tests/integration/rls/require-mfa-coverage.test.ts`.
- `ensure_require_mfa_policies()` attaches the policy to any RLS table
  that lacks it (or whose USING / WITH CHECK is anything other than
  exactly `(select public.mfa_satisfied())`), runs at the end of the migration and after every deploy
  push. Tests: `tests/integration/rls/require-mfa.test.ts` (behaviour)
  and `require-mfa-coverage.test.ts` (ratchet).

What it still does not cover:

- **GoTrue's own endpoints.** Supabase's `/factors/{id}/verify` is
  reachable directly with the `aal1` token, and its rate limits there are
  Supabase's (per IP), not Zebri's per-user limiter. GoTrue itself
  refuses email and password changes and factor removal below `aal2`,
  but **not `user_metadata` updates**: an `aal1` token can still read
  `user_metadata` and rewrite most of it (branding, business name)
  through `PUT /auth/v1/user`.
- **Except the payment details (fixed in Task 23c).** The bank details
  and ABN couples pay into can no longer be changed that way: the
  `lock_payment_details` trigger on `auth.users` refuses any change to
  `bank_account_name`, `bank_bsb`, `bank_account_number` or `abn` that
  does not come from `set_my_payment_details(p_details jsonb)`, and that
  RPC carries the `mfa_satisfied()` guard, so an `aal1` session of a 2FA
  MC is refused on both paths. Details in `security.md` and
  `database-schema.md`.
- Realtime `postgres_changes` applies the same RLS, so it is covered;
  nothing else in Realtime is used.

### Recovery codes (`lib/auth/recovery-codes.ts`)

Supabase has no recovery codes, so Zebri keeps its own in
`mfa_recovery_codes` (service role only: RLS on, no policies, every
client grant revoked; see `database-schema.md`).

- Ten codes, `xxxxx-xxxxx` over a 31-symbol alphabet without 0/o/1/l/i
  (about 49.5 bits each). Shown once; only a per-code-salted scrypt hash
  is stored.
- Matching forgives case, spaces and the hyphen, hashes against every
  unused row (no early exit), and the spend is an atomic
  `update ... where used_at is null` claim so a code cannot be used twice.
- Issuing new codes replaces every earlier code in one transaction
  (`replace_mfa_recovery_codes`, per-user lock): a failure leaves the old
  codes, and two concurrent issues leave ten codes, not twenty.
- Spending is `spend_mfa_recovery_code`, per-user lock, single winner per
  batch: once any code of the current batch is used, every other one is
  refused, so two concurrent redemptions with different codes cannot both
  proceed. If removing the factor then fails, the action clears `used_at`
  on its code so the MC can retry with it.
  Both writers are `security invoker` with EXECUTE for `service_role`
  only: their sole caller already has table DML, so definer rights would
  only add risk.

Redemption is `redeemRecoveryCodeAction` in
`app/(auth)/login/mfa/actions.ts`: Zod-validated, requires the same
user's `aal1` session (the code is only ever checked against that
user's own rows), rate-limited to 5 per 15 minutes per user. On success
it marks the code used, removes every TOTP factor through the admin API
(`auth.admin.mfa.deleteFactor`, which also ends all the user's
sessions), deletes the remaining unused codes, sends
`mfa_recovery_code_used` to Slack (ids only), emails the MC at their own
address (`lib/email/account-security.ts`: whoever did it held the
password, so the owner has to know; best effort), signs the browser out and
redirects to `/login?recovered=1`, which explains that 2FA is now off.
The next password sign-in needs no code.

### Shadow waiver (`lib/auth/shadow-grant.ts`)

Shadow sessions are minted through a magic-link OTP, so they are `aal1`
and the admin does not hold the MC's phone. `enterShadow` sets an
httpOnly `zebri_shadow_grant` cookie (the production hotfix format,
`v1.<adminId>.<targetUserId>.<expiresAt>.<HMAC-SHA256>`, keyed by a
label-derived key from `SUPABASE_SERVICE_ROLE_KEY`) beside
`zebri_shadow_admin_id` and the banner flag `zebri_is_shadowing`; all
three last 8 hours (`SHADOW_GRANT_TTL_MS`). The middleware waives the
2FA gate only when `evaluateShadowGrant` accepts: the grant verifies
and is in date, names this session's user, its admin equals the
`zebri_shadow_admin_id` cookie, and that admin is still `isAdmin()`
today (a service-role lookup, made only when the gate would otherwise
fire). Refusal reasons are the `admin_shadow_exit_refused` alert's
closed list.

The bare `zebri_shadow_admin_id` cookie authorises nothing on its own:
it is an unsigned user id that anyone knowing an admin's id could set.
The grant is the only trusted shadow signal, everywhere:

- **Past-due paywall skip** (middleware, hotfix rule): only when the
  grant verifies and names this session's user. It used to trust the
  bare cookie, which let a past-due MC skip billing from devtools.
- **2FA gate** (middleware): stricter, the full `evaluateShadowGrant`
  check above (admin cookie must match, admin must still be one).
- **`exitShadow`** (production hotfix, verbatim) mints the admin's
  session only when a signed-in session exists, the grant verifies and
  is in date, its target is that session's user, its admin equals the
  admin-id cookie, and that admin is still `isAdmin()`. Otherwise it
  clears the three shadow cookies, signs this browser out
  (`scope: 'local'`, never global), redirects to `/login` and mints
  nothing; it alerts `admin_shadow_exit_refused` (`warn`, ids only)
  unless the per-IP (5/min) or global (10 per 10 min) cap in
  `SHADOW_RATE_LIMITS` is spent. Before this, a hand-set admin-id cookie
  signed the caller in as whoever it named.
- **`enterShadow`** requires the admin to have a verified TOTP factor
  and this session to be `aal2`, and returns `{ error }` otherwise:
  shadow waives the MC's factor, so one phished admin password must not
  open every 2FA account. The founder must enrol 2FA before shadowing.

`exitShadow`, `clearShadowCookies` and the middleware's stale-shadow
cleanup all clear the grant. A shadow session still cannot issue codes
or turn 2FA off (both need `aal2`). Exiting shadow re-mints the admin's
session at `aal1`, so the admin passes the code screen again.

**Session binding (Phase 4 fix wave, review M1; fix-2, N1).**
`enterShadow` also sets `zebri_shadow_session` (httpOnly, 168h) to a
signed marker, `v1.<session_id>.<targetUserId>.<hmac>` (HMAC-SHA256 over
`v1|session_id|targetUserId`, keyed from `shadowGrantSecret()` under a
label of its own; `signShadowMarker` / `verifyShadowMarker` in
`lib/auth/shadow-grant.ts`, below the hotfix head). The middleware 2FA
waiver additionally requires that marker to verify (constant time) and
to name the request's `session_id` and user. A stolen grant and admin
cookie replayed on another `aal1` sign-in of the MC therefore waive
nothing, even with a hand-set marker holding that sign-in's own session
id: only the server can sign one. The grant format itself is unchanged,
so the hotfix merges cleanly. When the
marker matches and the grant has gone, middleware signs that session
out locally and redirects to `/login`; `exitShadow` revokes the target
session with the service role (`scope: 'local'`) on its genuine path;
and the workflow tick's sweep (`revoke_expired_shadow_sessions()`)
deletes the auth session of every ended or expired shadow visit within
a minute, for browsers that never come back.
See `shadow-mode.md`. The `/login/mfa` sign-out is always `local`, and
the sidebar and Settings sign-outs are local while shadowing
(`lib/auth/sign-out-scope.ts`). Still parked: the waiver's admin lookup
runs per request (Task 38).

### Safe `next` paths

`sameOriginPathSchema` (`lib/auth/schemas.ts`, used by `loginAction`,
the login and code pages, and middleware) accepts a path only when it
starts with a single `/` not followed by `/` or `\`, contains no
backslash and no control character (tab, CR, LF, any C0, DEL), passes
the same checks after percent-decoding, resolves to the origin it
started from, and does not resolve to a path starting with `//` (dot
segments such as `/..//evil.com` collapse to one). A WHATWG URL parser
treats `\` as `/` and strips tab and newlines, so `/\evil.com` and
`/<tab>/evil.com` both used to navigate to `//evil.com` after sign-in.

### Password change with 2FA

`changePasswordAction` re-checks the current password on a throwaway,
non-persisting client. Signing in on the cookie-bound client (the old
behaviour) replaced an `aal2` session with an `aal1` one, after which
Supabase refused the update ("AAL2 session is required to update email
or password when MFA is enabled").

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

### Session timebox and inactivity timeout

`supabase/config.toml` sets `[auth.sessions]`:

```toml
[auth.sessions]
timebox = "168h"
inactivity_timeout = "72h"
```

- **`timebox = "168h"` (7 days)**: a hard session lifetime, independent
  of activity. This is the owner's August 2026 choice (see the
  `last_sign_in_at` fix below) and is already live on the hosted
  project. Without it, middleware's per-request refresh-token rotation
  kept sessions alive forever, which had a side effect: GoTrue only
  stamps `auth.users.last_sign_in_at` on a real credential exchange, so
  with no expiry the "Last sign-in" column froze at first login. The
  fix was the timebox, not a derived "Last active" column (that
  alternative was explicitly rejected: the owner wants the real
  sign-in date).
- **`inactivity_timeout = "72h"` (3 days)**: logs an MC out after 3
  days of no activity, even inside the 7-day timebox window. Chosen so
  a normal weekend away does not force a re-login, but a session left
  idle for the better part of a week does. If this value turns out to
  be wrong in practice, it is a one-line config change.

**Change the SQL copy in the same PR.** Both intervals are hard-coded
in `public.live_shadow_session_for()` (migration `20261018000000`,
`interval '168 hours'` and `interval '72 hours'`), which decides whether
a shadow session's auth session is still live. A new timebox or
inactivity value, here or in the dashboard, needs a migration that
updates that function too, or the after-exit shadow logging drifts.

Local (`supabase/config.toml`) takes effect on the next `supabase
start`. No stack restart is required to land the file change, but the
running local GoTrue container does not pick it up until it is next
restarted. The hosted projects are configured separately in the
Supabase Dashboard (Sessions is a Pro-plan feature, not driven by
`config.toml`):

1. Dashboard, the project (zebri-crm-dev or the production project),
   then **Authentication** then **Sessions**.
2. Confirm **Time-box user sessions** is 7 days (168h) on both
   projects. The August 2026 fix set this on production to stop
   `last_sign_in_at` from freezing; that fix was never confirmed as
   applied to zebri-crm-dev specifically, so check it there too and set
   it to 168h if it isn't already.
3. Set **Inactivity timeout** to 3 days (72h) on both the dev project
   and the production project, and save.

---

## Settings page

Route: `/settings` — tabs Personal Info, Account, Plans & Billing,
Payments, Packages, Notifications. See `page-specs.md` for the full
behaviour spec.

- **Personal Info** writes to `user_metadata` (display_name,
  business_name, phone, avatar_url). Safe — these are user-owned.
- **Account** changes password via
  `supabase.auth.updateUser({ password })`, and turns two-factor
  sign-in on or off (see "Two-factor sign-in").
- **Plans & Billing** is read-only in the UI; subscription state
  changes via Stripe webhook → `updateEntitlements()`.
- **Payments** writes bank details to `user_metadata` (user-owned)
  through the 2FA-guarded `set_my_payment_details` RPC, never
  `auth.updateUser` (Task 23c).
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
