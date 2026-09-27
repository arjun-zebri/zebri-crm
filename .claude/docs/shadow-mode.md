# Shadow Mode

Shadow mode lets a Zebri admin sign in AS an MC to see exactly what they
see and act on their behalf. It exists for support and debugging.

Because it bypasses the MC's password (and their second factor), it is
**logged end to end for Zebri, and never shown to the MC** (Phase 4,
Task 25; owner ruling 2026-09-27). Task 25 first shipped a Settings
"Support access" card listing each visit to the MC; the owner removed
it, and the `my_support_access()` read behind it was dropped
(`20261024800000`). An earlier version of this doc said shadow mode was
deliberately unlogged, and checked `user_metadata` for the admin role.
Neither is true today.

---

## Who can use it

An admin is a user whose **`app_metadata.account_type` is `"admin"`**,
read only through `isAdmin(user)` in `lib/auth/entitlements`.
`user_metadata` is user-writable (`auth.updateUser({ data })`), so it is
never consulted (security.md §7.4). Admins are granted by the owner in
the Supabase dashboard (Authentication, Users, edit **app_metadata**).
There is no promote/demote UI.

`/admin` is gated twice: middleware redirects non-admins to `/`, and
every server action in `app/admin/actions.ts` starts with
`assertAdmin()`.

### The admin needs two-factor sign-in

Shadowing waives the target's second factor, so the admin's own sign-in
is the only thing in front of every MC account. `enterShadow` refuses
unless the admin has a verified TOTP factor **and** the current session
passed it (`aal2`). The refusal is returned as `{ error }` for the admin
UI to show (Task 23 review, I3).

---

## Entering: `enterShadow(targetUserId)`

1. `assertAdmin()`; refuse shadowing yourself; the 2FA checks above.
2. Fail closed with no grant key (`shadowGrantSecret()`).
3. Set three cookies, all expiring together after **8 hours**
   (`SHADOW_GRANT_TTL_MS`):
   - `zebri_shadow_grant` (httpOnly): the HMAC-signed grant binding the
     admin id, the target id and the expiry (`lib/auth/shadow-grant.ts`).
     This is the only trusted shadow signal.
   - `zebri_shadow_admin_id` (httpOnly): the admin's id. Never trusted
     on its own; it must match the grant.
   - `zebri_is_shadowing` (browser-readable): drives the banner only.
4. Mint a session for the target with a magic-link OTP (`verifyOtp`).
5. **Record the shadow session.** Read the `session_id` claim from the
   access token `verifyOtp` just returned (never from the request) and
   insert a row into `admin_shadow_sessions` with the service role
   (`startShadowSession` in `lib/admin/shadow-sessions.ts`). If the id
   cannot be read or the insert fails, the minted session is signed out
   (`scope: 'local'`), the cookies are cleared, an `app_error` alert
   fires, and entry is refused: an unrecorded session would let the
   admin change the account with no trail.
6. **Mark the session.** Set `zebri_shadow_session` (httpOnly, secure in
   production, `sameSite=lax`) to a **signed** marker,
   `v1.<session_id>.<targetUserId>.<hmac>`: HMAC-SHA256 over
   `v1|session_id|targetUserId`, keyed from `shadowGrantSecret()` under
   its own label (`signShadowMarker` in `lib/auth/shadow-grant.ts`,
   below the hotfix head). Signed because the session id alone is a
   claim in the holder's own access token, so anyone could copy it into
   a cookie. The cookie has a 168h
   `maxAge` (`SHADOW_SESSION_COOKIE_MAX_AGE_S`, the Auth timebox), so it
   outlives the 8 hour grant for as long as the target session can
   live. Middleware uses it to end the session once the grant is gone
   (see "Grant expiry" below) and to bind the Next-layer waiver to this
   session.
7. Write `enter_shadow` to `admin_audit_log` (details: target email and
   `shadowSessionId`), alert Slack `admin_shadow_entered`, redirect `/`.

## While shadowing

The session genuinely belongs to the MC, so RLS, queries and UI behave
as if the MC signed in. The banner (`app/components/shadow-banner.tsx`)
shows who is being viewed, with an Exit button. Middleware skips the
past-due paywall, and waives the MC's aal2 requirement, only for a
verified grant naming this session's user (the 2FA waiver also needs
the admin cookie to match, the admin to still be an admin, and the
`zebri_shadow_session` marker to verify (constant-time HMAC check) and
name this request's JWT `session_id` and user, so a stolen grant
replayed on another sign-in of the MC waives nothing, even with a
hand-set marker holding that sign-in's own session id). The
`shadow_request` log is skipped when a marker is present and does not
verify or names another session (`shadowMarkerMatch`: any failure is a
mismatch). Timers, the assistant and bug reporting are hidden
while shadowing.

Every sign-out button reachable while shadowing is **local**: the
sidebar and the Settings danger zone use `signOutScope()`
(`lib/auth/sign-out-scope.ts`, local while `zebri_is_shadowing` is set),
and the `/login/mfa` code screen is always local. A global sign-out
would end the MC's sessions on every device.

### Grant expiry

The grant, admin-id and banner cookies all die at 8 hours; the target
session does not. On any request that carries `zebri_shadow_session`,
middleware reads the session and, when the signed marker verifies and
names this JWT `session_id` and user, and no grant for this user
verifies (missing, expired,
forged or for someone else), it signs this browser out with
`scope: 'local'` (which revokes that session and its refresh tokens),
clears all four shadow cookies and redirects to `/login`. If Auth cannot
revoke it, the Supabase auth cookies are dropped anyway so the browser
still leaves (without that, the browser would carry on as the MC with
no banner), and Slack gets an `app_error` from `middleware.shadowExpiry`
(ids only, once an hour per session). A marker that does not verify, or
names another session, does nothing. Requests without the marker pay
nothing.

### Server-side sweep

Middleware only acts on the shadow browser's next request. A browser
that is closed, or an open tab refreshing its session straight against
Auth, would keep the target session live for up to 72 hours after its
last refresh. So the workflow tick (`/api/cron/automations-tick`, every
minute) calls `revokeExpiredShadowSessions()`, which runs
`public.revoke_expired_shadow_sessions()` (migration `20261021000000`,
definer, `search_path = ''`, service role only). For every
`admin_shadow_sessions` row that has ended or expired and has not been
swept (`revoked_at` null), it deletes the `auth.sessions` row (refresh
tokens and AMR claims cascade), stamps `ended_at = expires_at` where it
was null, and stamps `revoked_at`. It is idempotent, returns the number
of sessions deleted, and a failure alerts `app_error`
(`shadow.revoke_expired`) without stopping the tick. The worst case is
now one tick (about a minute) plus the remaining life of an access
token already issued (up to an hour).

### What is logged, and how exactly

Four mechanisms, each with an honest attribution level:

| What changed | How | Attribution | Where |
|---|---|---|---|
| A row in any public table, written under the shadow JWT (browser to PostgREST, or an RPC the session calls) | `log_shadow_mutation()` row trigger on every public base table | **Exact**: the JWT's `session_id` is a recorded shadow session | `shadow_mutation`, details `{table, op, row_id, shadow_session_id, after_end}` |
| The MC's account in `auth.users` (user_metadata including **bank details**, app_metadata, email, phone, password) and `auth.mfa_factors` (2FA on or off) | Triggers on those GoTrue tables | **By window**: GoTrue writes with no JWT, so the database knows support was signed in as the MC at the time, not who pressed save. `during_session` while a shadow session is open. After exit, `auth.users` changes are still logged as `unrevoked_shadow_session` (`after_end: true`) while any recorded shadow session's `auth.sessions` row for the user is live (not revoked, within the 168h timebox and 72h inactivity limit); exit and grant expiry now revoke that session, so this only fires for a copied token. **app_metadata is never attributed after exit** (`20261020000000`): only the service role can write it, so it is Stripe or an admin tool, never the kept token. 2FA changes: open session only | `shadow_mutation`, details `{table, op, row_id, changed_keys, attribution, sensitive, shadow_session_id}`; **key names only, never values** |
| A server action or API route the shadow browser calls (including ones that write with the service role, such as applying a workflow, completing a step, or a workflow's Turn on / Turn off: since the activation lock (`20261023600000`) the flip and the pause of its couples run as the service role, so they leave no `shadow_mutation` row, only this one) | `middleware.ts` writes one row per non-GET/HEAD/OPTIONS request under a verified grant, before the request runs | **Per request**: which action was posted, not which rows it wrote | `shadow_request`, details `{method, path, next_action, shadow_session_id}` (path only, no query string) |
| File bytes in Storage | not covered | Storage API writes `storage.objects` under service_role claims, so no session is visible. The database rows that point at files are logged, and a post to `/api/portal/upload` is a `shadow_request` | none |

Row-trigger details:

- Attached `WHEN (pg_trigger_depth() = 0)`, so rows other triggers write
  in response (an `automation_events` row a contact insert emits) and FK
  cascades are never even queued: the log is what the admin did. Writes
  inside an RPC the session calls are still depth 0 and are logged.
- The service role and cron carry no `session_id` and skip the lookup.
  Every MC token does carry one, so each normal MC row write pays one
  indexed lookup on `admin_shadow_sessions`.
- The lookup has **no end or expiry filter**. Exit and grant expiry
  revoke the target session, but an access token already issued stays
  valid for up to its 1 hour lifetime, and a copied token could
  otherwise write unlogged after "Exit". A recorded session id is only ever held by the
  admin's browser, so every write from it is attributed. After the
  session has ended or expired the row carries `after_end: true` and
  Slack is told (at most once an hour per session).
- `row_id` is the `id` column, or the primary-key columns as an object
  for tables without one (`user_branding`: `{ "user_id": ... }`).
- A GoTrue change that touches a `bank_*` key or the email also alerts
  Slack (ids and key names only). Key names are chosen by whoever holds
  the session, so the Slack text strips `<`, `>` and `&`, caps each name
  at 40 characters and lists at most 10 (`shadow_slack_key_list`); the
  audit row keeps the full list.
- The auth-table trigger bodies are guarded: any failure inside them
  (a failed audit insert, odd metadata) raises a WARNING and a Slack
  note, and GoTrue's write goes ahead. The writer may be the MC or a
  Stripe entitlement update, so logging must never block it. JSON-null
  or non-object metadata is treated as empty.
- **Kill switch.** On hosted, `postgres` may not be able to drop or
  disable a trigger on `auth.users` (owned by `supabase_auth_admin`),
  but it owns the functions. To stop account-change logging, replace
  the body: `create or replace function public.log_shadow_auth_user_change()
  returns trigger language plpgsql security definer set search_path = ''
  as $$ begin return null; end; $$;` (and the same for
  `log_shadow_mfa_change()`). Re-running migration `20261018000000`'s
  definitions restores it.

Why the database, and not Next, for row writes: most of the app writes to
PostgREST straight from the browser, so only the database sees them.

**Coverage cannot lapse unseen.** `public.ensure_shadow_triggers()`
(idempotent, service role only) attaches the trigger to every public
base table except `admin_audit_log` and `admin_shadow_sessions`. It runs
at the end of migration `20261017000000` and as the first of the three
post-push steps in both deploy workflows (ensure triggers, then ensure
`require_mfa` policies, then check the auth triggers), so an
out-of-order hosted push is covered too. It counts a trigger as attached only if it is
enabled, calls `log_shadow_mutation()`, fires AFTER on insert, update
and delete, and has the WHEN clause; anything else under the name is
replaced. The deploy step prints a GitHub warning when it attaches any
table (drift existed), and a second step warns unless all three auth
triggers are present. The ratchet
`tests/integration/admin/shadow-trigger-coverage.test.ts` fails when any
public table lacks the trigger or has RLS off (see database-schema.md,
Conventions).

## Exiting: `exitShadow()`

Exit mints a session for the admin, and a server action can be posted
from any page, so it proves everything first: a signed-in user; a grant
that verifies and is unexpired; the grant's target is this session; the
grant's admin equals the admin cookie; that user is still an admin
today. **Any failure refuses**: shadow cookies are deleted, this browser
only is signed out (`scope: 'local'`, never global), Slack gets
`admin_shadow_exit_refused` (ids and a reason, rate limited per IP and
globally), and the browser goes to `/login`. That refusal path is the
production hotfix (`fix/exit-shadow-takeover`) verbatim.

On the genuine path it reads the shadow session's `session_id` before
switching, **revokes the target session** with the service role
(`revokeShadowTargetSession`: `auth.admin.signOut(<target access
token>, 'local')`, so its refresh tokens stop working and the MC's own
sessions on other devices are untouched; a failure alerts `app_error`
with ids only and the exit still completes), deletes the four shadow
cookies including the marker, signs the admin back in, stamps
`ended_at` on the record (`endShadowSession`; a failure alerts but does
not block the exit), writes `exit_shadow` with `shadowSessionId`, and
redirects to `/admin`. These are added lines only; the refusal path is
unchanged. It does not delete the marker, which is harmless: the
refusal signs that session out, so the marker names a dead session.

A copied access token keeps working for up to an hour after the
revoke (Auth does not recall issued JWTs); its row writes stay
attributed, flagged `after_end`. A session nobody exits counts as ended
at `expires_at` (8 hours, the grant's lifetime); middleware revokes it
on the browser's next request (see "Grant expiry"), and the tick's
sweep revokes it within a minute either way (see "Server-side sweep"). If the admin signs in
as themselves without exiting, middleware clears the shadow cookies; the
record then stays open until it expires.

---

## What the MC sees

Nothing. Support visits are internal (owner ruling 2026-09-27). The MC
has no grant on `admin_shadow_sessions` (RLS on, no permissive policy)
and cannot read `admin_audit_log` (admins only), and the one read that
exposed their own visits, `my_support_access()`, was dropped in
`20261024800000` along with the Settings card. The full record stays in
`admin_shadow_sessions` and `admin_audit_log`, and the Slack alerts are
unchanged; admins read it from there.

## Data

| Table | Who writes | Who reads |
|---|---|---|
| `admin_shadow_sessions` | service role only (enter / exit) | service role only; never the MC |
| `admin_audit_log` | service role (`recordAdminAction`, middleware's `shadow_request`) and the definer triggers | admins (SELECT policy on `app_metadata`) |

Task 23b reuses the open-session lookup (partial index on open rows by
`session_id`): `mfa_satisfied()` waives database-level `aal2` for a JWT
whose `session_id` is an open row targeting that user and whose admin
is still an admin today (`app_metadata.account_type = 'admin'`,
`20261019100000`; demotion ends the waiver at once), so a 2FA MC's
data stays reachable while shadowing and stops being reachable through
that token at Exit or expiry (see `authentication.md`).

## Deploying shadow-mode changes

Deploy when no admin is shadowing (ask admins to Exit first). A shadow
session that was open before the fix-2 deploy has no signed marker, so:
a 2FA-target shadow is sent to the code screen; after its 8 hour grant
the browser is bannerless until the tick sweep revokes the session; and
a sidebar sign-out from it once the banner flag has died is global,
signing the MC out on every device. None of this applies to sessions
started after the deploy.

## Out of scope

- Read-only shadow mode, admin tiers, a promote/demote UI.
- Telling the MC when support signs in, by any surface: email or a
  Settings card (owner ruling 2026-09-27; the card was removed).
- Shadowing public, token-gated pages (portal, public documents).

## Verification

- Unit: `tests/unit/app/admin/exit-shadow.test.ts`,
  `enter-shadow-2fa.test.ts`, `tests/unit/lib/admin/shadow-sessions.test.ts`.
- Unit: `tests/unit/middleware-shadow-request.test.ts` (request log).
- Integration: `tests/integration/admin/shadow-mutation-log.test.ts`
  (row writes, knock-on rows skipped, RPC writes, primary-key row ids,
  after-exit and after-expiry writes flagged, account and 2FA changes by
  key name, no rows for normal sessions or other MCs, the MC cannot read
  or plant sessions or call the internals, the RPC returns only their own
  history) and `shadow-trigger-coverage.test.ts` (every table, RLS on,
  scratch table caught and fixed, auth triggers, function ACLs).
