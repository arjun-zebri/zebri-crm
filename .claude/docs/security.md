# Zebri — Security

Source of truth for the production security posture. Updated each
hardening phase. The page-by-page Definition of Done (roadmap §5)
references this doc for the per-page security checklist.

---

## Active findings

### Fixed (Phase 5 whole review, closed in the Phase 5 fix wave): the MC's bcc copy could unsubscribe the couple

`send_email` with `bccSelf` put the MC on the couple's message as a
bcc, so the MC's copy carried the couple's footer link and
`List-Unsubscribe` / `List-Unsubscribe-Post` headers. Gmail and Apple
Mail surface a native Unsubscribe control for those headers; the MC
pressing it on their own copy POSTed the couple's one-click URL and
opted the couple out of every future workflow email (P1). The same
shared message let a Resend event about the MC's mailbox move the
couple's delivery row (I1). The MC's copy is now its own message
(`lib/automations/actions/messaging.ts`, `planRecipients.mcCopy`):
rendered with no unsubscribe link and no `List-Unsubscribe`, its own
idempotency key, tagged `mc_copy`, never logged, and ignored by the
webhook. Tested in `tests/unit/lib/automations/actions/send-email.test.ts`
and `tests/integration/email/automated-send-log.test.ts`.

### Fixed (Phase 5 whole review, M7): a broken mailbox connection silently changed the sender

Any failure to reach the MC's connected Gmail or Outlook (a settings
read error, a token that would not decrypt, a failed refresh) quietly
sent automated email from the shared Zebri address, with the
connection still showing connected and the step envelope naming the
MC's mailbox. `resolveSenderForSend` (`lib/email/sender-identity.ts`)
now tells the cases apart: a transient failure errors the step
(`resolveStepSender`), and a dead connection (`invalid_grant`, an
undecryptable token) is marked `oauth_status = 'failed'` and alerted
once (`mailbox_disconnected`) before the shared address is used.

### Fixed (found in the Task 30 review, closed in Task 30 fix round 1): suppression gated on the display-log write

The Resend webhook wrote the `couple_emails` delivery status first and
answered 500 on any failure before reaching suppression. A persistent
error (the app deployed ahead of its migration gives 42703 on every
event) meant permanent bounces and complaints were never suppressed,
and Svix eventually disables an endpoint that keeps failing, which
would end suppression for good. The failure was also silent (a log
line, no alert).

The fix (`app/api/resend/webhook/route.ts`): the delivery write's
outcome is held while suppression runs; a failed write raises a deduped
`app_error` (`source: 'resend_webhook_delivery'`, one per ten minutes);
only a transient failure then answers 500 (both halves are idempotent,
so Resend's retry only finishes the record); a schema-shaped failure
(42703, 42P01, 42501, PGRST204, PGRST205) answers 200 plus the alert.
Tested in `tests/integration/email/automated-send-log.test.ts` with an
injected update failure: the suppression row is written and alerted
either way.

### Fixed (found in Task 23b, closed in Task 23c, migration 20261022000000): an aal1 token could rewrite the MC's bank details

GoTrue refuses email and password changes and factor removal below
`aal2`, but not `user_metadata` updates: `auth.updateUser({ data: {
bank_bsb } })` on an `aal1` session of a 2FA MC succeeded (probed
2026-09-25). `user_metadata` holds the bank details and ABN that
`get_public_invoice`, `get_public_proposal` and the branding blocks show
to couples, so a password thief could redirect couple payments. GoTrue
writes as `supabase_auth_admin` with no JWT, so `require_mfa` never saw
it.

The fix is a write-path lock; every reader is unchanged:

- **Protected keys:** `bank_account_name`, `bank_bsb`,
  `bank_account_number`, `abn` (in `raw_user_meta_data`).
- **`lock_payment_details`**, a BEFORE UPDATE trigger on `auth.users`
  (`WHEN old.raw_user_meta_data is distinct from new...`), raises 42501
  "payment details can only be changed from Settings" when any protected
  key's value changes and the transaction-local GUC
  `zebri.payment_details_write` is not `on`. Absent, JSON null and `""`
  count as the same "not set". A save that resends the keys unchanged
  passes, so every profile save that spreads the whole metadata keeps
  working. GoTrue's user API, its admin API (service role) and raw SQL
  are all refused.
- **`set_my_payment_details(p_details jsonb)`** is the only writer:
  SECURITY DEFINER, `search_path ''`, EXECUTE for `authenticated` only,
  first statement the `mfa_satisfied()` guard (so an `aal1` session of a
  2FA MC gets 42501; the shadow waiver applies as everywhere else). It
  validates each CHANGED value (BSB 6 digits, account number 4 to 10
  digits, ABN 11 digits, spaces and hyphens allowed as separators;
  account name at most 200 characters; 22023 otherwise), sets the GUC for
  its one UPDATE, merges only the keys sent (null or `""` clears) and
  returns all four values.
- **No service-role writer exists** (Stripe and `updateEntitlements`
  write `app_metadata`; the admin profile edit writes `display_name` and
  `business_name`), so there is no service-role overload. A support fix
  by hand runs `select set_config('zebri.payment_details_write', 'on',
  true);` in the same transaction as its UPDATE.
- **Shadow mode:** the RPC's UPDATE fires the existing
  `zz_log_shadow_auth_user` trigger, so a change made through a shadow
  session is logged (key names only) and alerted as before. Since fix
  round 1 (`20261022100000`) an `abn` change counts as sensitive too, so
  it pages Slack like a `bank_*` or email change.
- **App:** Settings → Payments and the Branding editor's ABN save through
  `savePaymentDetails` (`lib/branding/payment-details.ts`). Every
  whole-metadata spread on this branch strips the keys with
  `withoutPaymentDetails`, so a stale copy can neither revert them nor
  fail the save: the Settings sections, the welcome gate, the Branding
  editor and its first-run wizard (`branding/page.tsx`), and the admin
  profile edit (`patchUserDisplay` in `app/admin/actions.ts`). **Not yet
  on this branch:** the two onboarding writers on `feature/onboarding`
  (`couples/setup/actions.ts`, `load-setup.ts`) spread a fresh
  `getUser()` copy unstripped; they pass (an unchanged resend is
  allowed) but can fail on a bank save racing them. Wrap them in
  `withoutPaymentDetails` when that branch merges.
- **Public RPCs read `stripe_connect_enabled` from `app_metadata`**
  (fix round 1, `20261022100000`). `get_public_invoice` read the
  `user_metadata` copy, and `get_public_proposal` fell back to it, so an
  `aal1` token could hide card payment (set it false) or break every
  public invoice of the MC (a non-boolean made the `::boolean` cast
  raise). Both now follow the §7.4 rule: `app_metadata` only when it
  carries the `account_type` sentinel (every user since Phase 0.8b),
  the legacy `user_metadata` copy only without it; the value is compared
  as text to `'true'`, so anything else is false and never raises.
- **Deploy guard:** `20261022100000` fails the push when the migration
  role cannot UPDATE `auth.users` (without it every bank save would fail
  at runtime).
- **Tests:** `tests/integration/rls/payment-details-lock.test.ts` (aal1
  refused on both paths with the value unchanged, aal2 and no-2FA
  succeed, unchanged resend succeeds, service role refused, shadow
  logging including the ABN alert, public invoice shows the new values,
  a `user_metadata` `stripe_connect_enabled` flip or garbage value leaves
  the public invoice and proposal unchanged and working);
  `require-mfa-coverage.test.ts` lists the RPC as guarded.

**Residual:** an `aal1` token can still READ the values through `GET
/auth/v1/user` (they are printed on every public invoice anyway). The
rest of `user_metadata` stays writable at `aal1`: see the open P1 below.
Deploy check: the migration creates a trigger
on `auth.users` as the migration role; it works locally (postgres is
not a superuser there either, and the shadow triggers prove it), and if
a hosted project refused it the push fails loudly rather than shipping
without the lock.

### P1 (open, found in the Task 23c review): an aal1 token can still put payment instructions in front of couples through free-text metadata

Task 23c locked the structured payment details, so the couple always
sees the MC's real BSB, account and ABN. But a password thief with only
an `aal1` session of a 2FA MC can still rewrite, through
`auth.updateUser({ data })`, the free text couples read:

- `email_signature`: appended to every automated workflow email and
  manual email to every couple (`lib/automations/context.ts`,
  `lib/email/send-context.ts`). The worst vector: "Our bank details
  have changed, please pay BSB 999-999 / 12345678" reaches every couple
  with no action from the MC.
- `business_name`, `tagline`, `postal_address` (and `phone`): printed on
  public invoices and proposals via `_user_branding` /
  `buildPublicBranding`.

Rated P1, below the 23b P0: the couple has to act on text rather than a
silently swapped field, and the genuine bank details are printed beside
it. (The related `stripe_connect_enabled` mirror, P2, is fixed: see the
23c entry above.)

**Owner decision needed:** which of these to build.

1. **Notify on change (recommended first, medium):** an AFTER UPDATE
   trigger on `auth.users` that enqueues an email to the MC's own
   address whenever `email_signature`, `business_name`, `tagline` or
   `postal_address` changes. It gives the victim a signal within
   minutes and moves no writer.
2. **Generalise the 23c lock (structural):** refuse ANY `user_metadata`
   change for a user with a verified factor unless a guarded GUC is on,
   and move the profile and branding saves behind one guarded
   `set_my_profile(patch)` RPC. Closes the class, but touches about
   eight writers (Settings sections, Branding editor and wizard, welcome
   gate, email appearance, template categories, onboarding) and is its
   own task.

Until decided, 2FA protects tables, Storage, RPCs and the payment
details, but not the free text around them.

### Fixed (found in Task 23b, closed 2026-09-25 by the fix/exit-shadow-takeover hotfix, migration 20261001310000): definer RPCs callable by any client with no revoke

Supabase's default privileges grant EXECUTE on every new `public`
function to `anon` and `authenticated`, so `grant ... to service_role`
alone does not make a function service-role only; it needs an explicit
`revoke execute ... from anon, authenticated`. These `SECURITY DEFINER`
functions had none in any migration:

- `bookings_due_for_reminder()`: returned every tenant's upcoming
  bookings with couple names, emails and `manage_token` (which cancels or
  reschedules the booking). Called only by the cron route's service-role
  client. The "Service-role-only reminder RPCs" section below assumed
  otherwise.
- `mark_booking_reminder_sent(p_booking_id)`: let anyone suppress a
  reminder by booking id.
- `seed_default_contract_template(p_user_id)`: seeded a template into any
  user's account.
- `emit_contract_audit_event(...)`: explicitly granted to
  `authenticated`; any signed-in user could append audit rows to any
  contract by id.
- `expire_contracts()`: granted to `anon` on purpose (the cron route
  called it through an anon server client).

Not a two-factor issue (anon could call them), so Task 23b did not guard
them; they were allowlisted with a "pre-existing exposure" reason in
`tests/integration/rls/require-mfa-coverage.test.ts`. Fixed: migration
`20261001310000_revoke_client_execute_internal_functions` revokes
EXECUTE from `anon, authenticated` on all five and grants `service_role`
(full writeup below, under "P0 - internal SECURITY DEFINER functions
executable by clients"). The require-mfa ratchet's allowlist entries for
these five now read `SERVICE_ONLY`, matching the reason already used for
the other service-role-only definer functions, since the local
grant-repair script still re-opens `authenticated` EXECUTE on this dev
machine.

### Fixed in Task 23b (2026-09-25): aal1 tokens reached data directly for 2FA users (Task 23 review C2)

Two-factor sign-in (Task 23) was enforced only in `middleware.ts`. A
password thief could call `signInWithPassword` with the publishable key
and use the `aal1` JWT against PostgREST, Storage and definer RPCs. Now
(`20261019000000_require_mfa_at_database.sql`):

- `public.mfa_satisfied()` is true at `aal2`, for a user with no
  verified factor, for an open `admin_shadow_sessions` row matching the
  JWT `session_id` and user whose admin is still an admin (the shadow
  waiver; demotion ends it, fix round 1), and with no user JWT.
- A RESTRICTIVE `require_mfa` policy for `authenticated` on every public
  RLS table and on `storage.objects`. `ensure_require_mfa_policies()`
  re-attaches after every deploy push, replacing any policy whose
  expression is not exactly `(select public.mfa_satisfied())`; the
  deploy fails if `storage.objects` lacks it.
- The definer RPCs that act for `auth.uid()` (`increment_ai_copilot_usage`,
  `set_my_payment_details`) raise 42501 `second factor required` first. Every
  other client-executable definer function is guarded or allowlisted
  with a reason by the ratchet test.
- Tests: `tests/integration/rls/require-mfa.test.ts` (aal1 reads nothing,
  writes refused, guarded RPC 42501, Storage refused; aal2 normal; no
  factor unaffected; open shadow waived, ended or expired not; token RPCs
  and service role unaffected) and `require-mfa-coverage.test.ts`.

Still open: Supabase's own `/factors/{id}/verify` endpoint is reachable
directly with the `aal1` token and limited only by Supabase's per-IP
rate limit; and the `user_metadata` gap above.

### Fixed in Task 25 (2026-09-25): shadow mode was unlogged

Shadow mode bypasses the MC's password and second factor, yet only the
entry left a trace, nothing an admin changed inside was attributable,
and the MC could not tell support had been in. Now:

- `enterShadow` records the minted session in `admin_shadow_sessions`
  (session id read from the token Auth returned, never the request) and
  **refuses entry if it cannot**, signing that session out locally.
- Coverage, exactly (fix round 1 corrected an overclaim; full table in
  `shadow-mode.md`):
  - **Row writes under the shadow JWT, exact.** A definer trigger,
    `log_shadow_mutation()`, on every public base table (minus
    `admin_audit_log` / `admin_shadow_sessions`) writes a
    `shadow_mutation` row naming the admin (actor) and the MC (target).
    Ids only. Attributed for the life of the session id, not just until
    exit: writes after exit or expiry are flagged `after_end` and alert
    Slack. Exit and expiry revoke the target session, but an access
    token already issued stays valid for up to an hour.
  - **Account changes, by session window.** Triggers on `auth.users`
    and `auth.mfa_factors` log changed key names (never values) while
    the MC has an open shadow session, labelled `during_session`
    (GoTrue writes carry no JWT). After exit, an `auth.users` change is
    still logged, labelled `unrevoked_shadow_session` with `after_end`,
    while any recorded shadow session's `auth.sessions` row for that
    user is live (fix round 2, N1), except `app_metadata` keys, which
    only the service role can write and are never attributed after exit
    (Phase 4 fix wave, I2, `20261020000000`). A `bank_*` or email change alerts
    Slack (key names sanitised). The trigger bodies are guarded: a
    logging failure warns and never aborts GoTrue's write.
  - **Server actions and API routes, per request.** Middleware writes
    one `shadow_request` row per non-GET request under a verified grant,
    which is the only trail for service-role writes.
  - **Storage bytes, not covered.** Storage API writes `storage.objects`
    under service_role claims; the rows pointing at files are logged.
- Coverage cannot lapse: `ensure_shadow_triggers()` runs at the end of
  the migration and after every deploy's `db push`; the ratchet
  `tests/integration/admin/shadow-trigger-coverage.test.ts` fails if any
  public table lacks the trigger or has RLS off.
- `exitShadow` (genuine path only; the refusal path is unchanged) closes
  the record and logs `exit_shadow` with the session id; a close that
  matches no row alerts.
- **Revoked on exit and at grant expiry (Phase 4 fix wave, ruling on
  review I1 and I2).** `exitShadow`'s genuine path revokes the target
  session (`auth.admin.signOut(<target access token>, 'local')`, added
  lines only; the hotfix refusal path is byte-identical) and alerts
  `app_error` (ids only) if that fails, still completing the exit.
  `enterShadow` sets the httpOnly `zebri_shadow_session` marker (168h),
  HMAC-signed over the session id and target with a key of its own label
  (fix-2, N1): the session id alone is readable by its holder, so an
  unsigned marker proved nothing. When the marker verifies and names the
  request's session and no grant verifies, middleware signs it out
  locally and redirects to `/login`; a failed revoke there alerts Slack
  (ids only, once an hour per session). The verified marker also binds
  the Next 2FA waiver and the `shadow_request` log to the session
  (review M1). The workflow tick sweeps every ended or expired shadow
  session server side (`revoke_expired_shadow_sessions()`, service role
  only, fix-2 N2), so a closed or idle browser is revoked within a
  minute too. Residual: a copied access token works until its own expiry
  (up to 1 hour); its row writes are logged `after_end`. Every sign-out reachable while shadowing is
  `local`. Hosted caveat: the sweep deletes `auth.sessions` rows as
  `postgres`; if a project refuses that, the tick alerts
  `shadow.revoke_expired` every run.
- The MC is never shown a visit (owner ruling 2026-09-27): the
  Settings "Support access" card and its `my_support_access()` read were
  removed (`20261024800000`). The record and the Slack alerts are
  internal to Zebri.

### Fixed in Task 31 (2026-09-25): header injection on the Gmail transport (audit M5)

The Gmail transport is the one place the app writes raw RFC 822 header
lines, and `encodeHeaderWord` only encoded non-ASCII, so an ASCII `\r\n`
in a rendered subject (a couple name from a lead form interpolated through
a variable), a contact's address in `To:`, or the MC's display name in
`From:` became an extra header, a hidden `Bcc:` included. Resend and
Microsoft Graph take JSON and were never affected.

- **Transport backstop.** `buildMime` (`lib/email/mime.ts`, split out of
  `lib/email/dispatch.ts`) passes every header value (From and its display
  name, To, Cc, Bcc, Reply-To, Subject, each attachment filename) through
  `headerValue`, which turns CR, LF and every other C0 control character or
  DEL into a space (tab is kept). A filename also loses `"` and `\` so it
  cannot close its quoted parameter. The `List-Unsubscribe` URL was already
  refused on CR or LF (`validateHeaderUrl`). Tested in
  `tests/unit/lib/email/dispatch.test.ts` ("header hardening").
- **Zod boundary.** A line break in a couple's or contact's name or email is
  refused where it enters, with the message "Names and email addresses must
  be on one line." (`singleLineText` / `SINGLE_LINE_MESSAGE` in
  `lib/utils/single-line.ts`; values are trimmed first, so only a break
  inside the value is an error):

  | Schema | Fields |
  |---|---|
  | `coupleInputSchema` (`app/(dashboard)/couples/actions.ts`: create, update, and the CSV import, which reports the row in `invalidRows` rather than failing the import) | `name`, `email`, `primary_name`, `primary_email`, `secondary_name`, `secondary_email` |
  | `contactInputSchema` (`app/(dashboard)/contacts/actions.ts`: create, update) | `name`, `contact_name`, `email` |
  | `updateContactSchema` (`app/(dashboard)/couples/portal-actions.ts`) | `name`, `contact_name`, `email` |
  | `leadSubmitSchema` (`lib/lead-capture/schema.ts`: the public form and the lead-capture API) | `name`, `partner_name` (`email` was already `z.email()`) |
  | `bookingSubmitSchema` (`app/api/booking/submit-schema.ts`) | `name`, `partnerName` (`email` was already `z.email()`) |

  The couple and contact actions (the portal contact patch included)
  return that message rather than their generic "Invalid couple data." so
  the MC knows what to fix. Tested in the couples, contacts and portal
  action tests and `tests/unit/lib/lead-capture/single-line.test.ts`.

- **Not covered at the boundary (the transport backstop only).** These
  write the same name and email columns that feed `To:` and subject
  variables, with no line-break check. `headerValue` in `buildMime` is the
  control for all of them; no SQL guard was added (Task 31 fix round 1
  ruling). Listed so nobody reads the table above as complete:

  | Writer | What it writes | Why it matters |
  |---|---|---|
  | `save_portal_couple_details` RPC (`supabase/migrations/20260617000000_portal_couple_details.sql`) | `couples.primary_name`, `primary_email`, `secondary_name`, `secondary_email`, only trimmed and cut to 200 | The public, token-gated couple portal: the one surface an outsider types into, the same threat class as the lead form |
  | `save_portal_contact` RPC (`supabase/migrations/20260616000000_per_partner_portal_tokens.sql`) | vendor `contacts.name` and `email` | Same portal |
  | `app/(dashboard)/couples/contact-popover.tsx` (client-direct `contacts` insert) | `name`, `contact_name`, `email` | MC-side, straight from the browser under RLS with no server Zod |
  | `app/(dashboard)/couples/mc-portal-contacts.tsx` (client-direct `contacts` insert) | `name`, `contact_name`, `email` | Same |
  | `app/(dashboard)/couples/couple-events.tsx` (client-direct venue `contacts` insert) | `name` (the venue) | Same |
  | The `create_couple` workflow action | `name` from MC-authored config rendered at run time | Not a Zod-validated user input |
  | Rows written before Task 31 | any of the above | Written before the rule existed |

### Fixed in Task 27 (2026-09-25): Slack alerts leaked couple PII

Several `AlertEvent` payloads carried a couple's name or a couple/
contact/vendor's email address straight into Slack: `booking_created`
(`bookerName`), `workflow_email_sent` (`to`, `coupleName`, and a
rendered `subject` that can interpolate a couple's name),
`automation_paused_missing_variables` (`coupleName`),
`proposal_accepted` / `proposal_opened` / `proposal_declined`
(`coupleName`), and `resend_bounced` / `resend_send_failed` (`to`, and
the same rendered-subject risk). A Slack workspace is a much wider
trust boundary than the app's own RLS: every teammate with channel
access could read a couple's details for every alert that happened to
mention one. Now:

- Every one of those fields is gone. Where the alert used to name who
  it was about, it carries the id instead (`coupleId`, `contactId`,
  `bookingId`, the tenant's own `userId`); see the field-by-field table
  in `alerts.md`'s [PII policy](./alerts.md#pii-policy-phase-4-task-27).
  `workflow_email_sent.subject` was replaced with `stepTitle` (fix
  round 1, I2, Q2): the step's own display title
  (`stepDisplayTitle()` in `lib/workflows/step-label.ts`), written once
  in the builder and never per-couple. `resend_send_failed.subject` and
  `resend_bounced.subject` carried the identical risk and were simply
  dropped (fix round 1, I2): `userId` plus `reason` are enough to find
  the suppression row and the original message in the app.
- **MC account emails stay.** `email` (signup, subscription, payment,
  lead-notification and booking-notification alerts), `targetEmail`
  (every `admin_*` event, the target `auth.users` row is always an MC)
  and `reporter` (the in-app bug-report alerts, "Name (email)" built
  from the logged-in MC's own account) are the allowlisted exception:
  the MC is Zebri's own paying customer, not the person this policy
  protects, and the founder's signup/billing alerts depend on reading
  them. The allowlist is keyed by `${event.type}:${field}`, not the
  field name alone (fix round 1, I1): a future event that happens to
  reuse the name `email` for a couple/contact/vendor address is not
  waved through just because `email` is safe on a different event.
- **Compile-time guard:** `lib/alerts/events.ts` exports two type-level
  assertions built from a `KeysOf<AlertEvent>` union distribution; the
  file fails to typecheck if `coupleName` or `bookerName` ever
  reappears on any `AlertEvent` member.
- **Runtime guard:** `assertNoCouplePii()` in `lib/alerts/send-alert.ts`
  runs on every event before the log record and the Slack line are
  built. It scans every field, recursively into arrays and plain
  objects up to a small depth cap (fix round 1, M1: no current field
  nests that deep, but the guard exists to catch the next regression,
  not just today's shapes). A field not allowlisted for its exact
  `type:field` pair that looks like an email address throws in the
  test environment (fails the suite that introduced the regression)
  and redacts to `[redacted]` everywhere else, so a still-unknown
  regression degrades to a masked field instead of a leaked address.
- Covered by `tests/unit/lib/alerts/no-couple-pii.test.ts`: one
  fixture per `AlertEvent` type (a mapped type over `AlertEvent['type']`
  makes a missing fixture a compile error), asserting none carries
  couple-side PII and that the guard passes every one through
  untouched, plus direct tests for the type+field keying and the
  nested-array/object recursion.
- **Known residual risk, not fixed here:** a free-text field rendered
  from the MC's own template could still contain a couple's name if
  the template interpolates one into a field the guard cannot
  recognise as an address. The guard only catches an email-*shaped*
  string, not a name inside prose, so reliably closing this would need
  more than a "last line of defence" function; the three fields where
  this was concretely true (`workflow_email_sent.subject` and both
  `resend_*.subject` fields) were fixed directly above instead of left
  as a residual.
- Changed formatters give an id but no clickable app link (checked
  during fix round 1, M2: no app-URL-building helper exists in
  `lib/alerts/send-alert.ts` today to hang one off), so restoring the
  "act on it from Slack" glanceability the removed names had is a
  follow-up, not attempted here.
- `admin_shadow_exit_refused` is unchanged: it already carried ids
  only (see the entry above) and is byte-identical with a live
  production hotfix, so this task left it alone on purpose.

### Fixed in Task 23 fix round 1 (2026-09-24)

- **P0 `exitShadow` account takeover (C1).** It minted a session for
  whatever id the unsigned `zebri_shadow_admin_id` cookie named. It now
  requires the signed shadow grant (8 h), bound to the session's own user
  and the admin-id cookie, from a current admin. A refusal signs the
  browser out (`scope: 'local'`) and alerts `admin_shadow_exit_refused`,
  capped at 5 per minute per IP and 10 per 10 minutes overall
  (`SHADOW_RATE_LIMITS`). This branch carries the production hotfix
  (`fix/exit-shadow-takeover`) verbatim for this path.
- **P1 past-due paywall skip on the bare shadow cookie (I2).** Now skipped
  only when the signed grant verifies and names the session's user (the
  hotfix rule). The 2FA waiver is stricter: it also needs the admin
  cookie to match and the admin to still be one.
- **P2 open redirect via `next` (I1).** `sameOriginPathSchema` now
  rejects backslashes, control characters (including an encoded tab),
  protocol-relative and encoded forms, anything resolving off-origin, and
  (round 2) anything whose resolved path starts with `//`, such as
  `/..//evil.com`.
- **Admin password as the single factor for every 2FA MC (I3).**
  `enterShadow` requires the admin to have a verified factor and an
  `aal2` session.

**Shadow mode rule:** the signed `zebri_shadow_grant` cookie
(`lib/auth/shadow-grant.ts`) is the only trusted shadow signal. The bare
`zebri_shadow_admin_id` cookie must never authorise anything on its own.
Every shadow session is recorded in `admin_shadow_sessions` and every
write through it is logged (Task 25, above); a new owned table must
attach the `zz_log_shadow_mutation` trigger.

### P0 - internal SECURITY DEFINER functions executable by clients (fixed 2026-09-25, same hotfix)

Five SECURITY DEFINER functions kept Postgres's default PUBLIC EXECUTE,
so anyone with the anon key could call them through `/rest/v1/rpc`:
`bookings_due_for_reminder()` returned every tenant's confirmed bookings
with booker name, email and `manage_token`; `mark_booking_reminder_sent(uuid)`
suppressed any booking's reminder; `seed_default_contract_template(uuid)`
wrote into any account; `emit_contract_audit_event(...)` (also granted to
`authenticated`) could forge rows such as 'signed' in any tenant's
contract audit log; `expire_contracts()` (granted to `anon`) expired every
tenant's overdue contracts. Migration
`20261001310000_revoke_client_execute_internal_functions` revokes
EXECUTE from `public, anon, authenticated` and grants `service_role`,
and does the same for `revoke_contract(uuid)` (SECURITY INVOKER, now
called only by the service role; a direct client call returns 42501).
App callers moved to the service role: the expire-contracts cron (still
gated by `isCronAuthorized`), send-contract's 'sent' audit row, and
`revokeContractAction` (which now proves ownership with the user's
client first, because `revoke_contract` is SECURITY INVOKER and calls the
audit writer). All other SQL callers are SECURITY DEFINER. Signup
seeding still works (the trigger function is SECURITY DEFINER), checked
in a rolled-back transaction on local Postgres. Tests:
`tests/unit/app/api/cron/expire-contracts.test.ts`,
`tests/unit/app/api/email/send-contract-audit.test.ts`,
`tests/unit/app/(dashboard)/payments/contract-actions.test.ts`.
Follow-up: an integration test that asserts `anon` and `authenticated`
get permission denied on all five, and a sweep of every other public
SECURITY DEFINER function for the same missing revoke. Owner to check
`bookings`/`contract_audit_log` access logs for the exposure window.

### 🟥 P0 — user_metadata privilege escalation (deferred to 0.8b)

`account_type` (incl. `admin`), `subscription_*`, `stripe_connect_*`,
and bank-detail fields live in **user-writable** Supabase
`user_metadata`. They are consumed by:

1. **Middleware** (`middleware.ts`) — `account_type === 'admin'`
   bypass + `subscription_status` paywall check.
2. **`lib/payments/subscription`** — entitlement function reads from
   user_metadata.
3. **~4 Postgres RPCs** (`get_public_invoice`,
   `get_public_contract`, `get_portal_data`, branding/invoice
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
  `get_public_proposal` (Proposals Phase C) reads the same `bank_*`
  fields from `raw_user_meta_data` and `stripe_connect_enabled` from
  `raw_app_meta_data` with a `raw_user_meta_data` fallback; same
  low-impact class as the invoice entry, same fix when the bank fields
  move.
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
| `X-Frame-Options` | `DENY` — **except `/lead/*`** (see below) |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(self), geolocation=(), interest-cohort=()` *(`microphone=(self)` so the couple-portal AudioRecorder works on first-party frames)* |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` *(prod only — dev http://localhost stays plain)* |

**Frame policy is split per-route.** The app proper carries
`X-Frame-Options: DENY` (clickjacking guard). The public lead-capture
embed at `/lead/*` is *meant* to render inside an iframe on an arbitrary
MC marketing site, so it can't. `X-Frame-Options` has no
allowlist-any-origin value (`ALLOW-FROM` is dead in modern browsers), so
`/lead/*` drops `X-Frame-Options` and opens framing via
`Content-Security-Policy: frame-ancestors *` instead. Implemented as two
`headers()` rules: `source: '/lead/:path*'` (frame-ancestors) and
`source: '/((?!lead/).*)'` (DENY), the negative lookahead keeping the two
policies from both applying to the embed. The lead form is a public,
token-gated enquiry surface with no session to hijack, so the residual
clickjacking surface is limited to "trick a visitor into submitting an
enquiry". `/lead-embed.js` (the loader asset) is *not* framed and keeps
`DENY`. Note `/lead` + `/api/lead` are also in the middleware
`PUBLIC_ROUTES` allowlist — without that, an unauthenticated (hence any
cross-site iframe) request to `/lead/<token>` 307s to `/login`, and
`/login` itself is `DENY`, so the embed showed "refused to connect".

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
| `app/api/resend/webhook/route.ts` | ✅ Verifies the Svix signature (`svix-id`, `svix-timestamp`, `svix-signature`) over the raw body with `RESEND_WEBHOOK_SECRET`, constant-time, five minute timestamp tolerance; 500 when the secret is unset, 400 on any failure. Implemented directly; the integration test signs with the real `svix` library. Phase 2, Task 14: see the section below. |

### Authenticated Stripe routes — validation + rate-limit audit (Phase 2A)

| Route | Zod | Rate-limit | Notes |
|---|---|---|---|
| `app/api/stripe/checkout/route.ts` | ✅ `z.object({ plan: z.enum(['pro','max']) })` | ✅ 5/min/user via `STRIPE_RATE_LIMITS.checkout`; hit fires `stripe_rate_limit_hit` | Beta users get `STRIPE_BETA_PRICE_ID` via `isBetaUser(user)` |
| `app/api/stripe/portal/route.ts` | n/a — no body | ✅ 10/min/user | 400 when `stripeCustomerId(user)` returns null |
| `app/api/stripe/billing-history/route.ts` | n/a — GET, no params yet | ✅ 30/min/user | Cursor-based pagination deferred to PR 2D |

### Payments server actions — validation audit (Phase 2C.2)

The Invoice builder modal now routes every mutation through
typed server actions in `app/(dashboard)/payments/actions.ts`. RLS
provides cross-tenant denial; the Zod schemas reject malformed
inputs at the boundary. No rate-limit needed (authenticated,
single-user, no public abuse vector — and money paths into Stripe
already carry their own limits in `STRIPE_RATE_LIMITS`).

| Action | Zod | Notes |
|---|---|---|
| `saveInvoiceAction` | ✅ `saveInvoiceSchema` (invoiceId nullable, coupleId uuid, payment schedule, items[]) | Writes `quantity=1, unit_price=amount` for forward-compat with existing invoice_items columns |
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
| `app/api/email/send-invoice/route.ts` | ✅ `z.object({ invoiceId: z.uuid() })` | ✅ 5/min/user via `EMAIL_RATE_LIMITS.sendInvoice` | Same RLS scoping |
| `app/api/email/send-contract/route.ts` | ☐ Phase 3 (Contracts) | ☐ Phase 3 | Not in 2C scope |
| `app/api/email/send-template/route.ts` | ✅ `z.object({ coupleId, templateId?, inlineSubject?, inlineBody?, overrides, sendAnyway, attachmentFileIds })` | ✅ 5/min/user via `EMAIL_RATE_LIMITS.sendTemplate`; hit fires `email_rate_limit_hit` (`action: 'sendTemplate'`) | RLS scopes template + couple loads to the caller. **Safety property:** the send is **blocked (422)** when `detectMissingVariables` finds an unresolved variable, unless `sendAnyway` is set — re-checked server-side so the client can't bypass it. Static attachments downloaded via the owner-only `email-template-files` bucket |

### Public lead-capture ingest — `get_lead_form` / `submit_lead` (ZEB-2)

Backs the public `/lead/[token]` form and the `POST /api/lead/submit`
endpoint. Unauthenticated: the `lead_capture_forms.capture_token`
(`uuid`, `gen_random_uuid()` default) IS the capability. Both RPCs are
`security definer`, `set search_path = public, auth`, granted to `anon`,
and return `null`/`{error}` (never raise) for a missing/disabled token
so token existence never leaks.

- **Scoping:** `submit_lead` derives the owning `user_id` from the token
  and inserts the couple under it — a confused-deputy write into another
  MC's account is impossible (proved by the cross-tenant test in
  `tests/integration/lead-capture/rpc.test.ts`).
- **Field selection:** `get_lead_form` returns only `enabled`,
  `business_name`, and the MC branding scalars — no `user_id`, no token,
  no internal flags.
- **Route hardening (`app/api/lead/submit/route.ts`):** Zod-validated
  (`leadSubmitSchema`), `inMemoryLimiter` 5/min/IP, honeypot + min-fill
  timing (silent success so bots learn nothing), and
  `recordInvalidTokenAttempt({ surface: 'lead' })` on a bad token. The
  mutation itself still goes through the anon-granted `submit_lead` RPC,
  scoped by token. The config lookup ahead of it (form existence,
  enabled state, allowed origins, block tree) now uses the service-role
  admin client instead (see Config read below), so the earlier "no
  service-role key on this path" note no longer holds.
- **Plan limit:** a Starter couple-cap block returns a generic success
  to the visitor and fires `lead_blocked_plan_limit` + an upgrade email
  to the MC, so inbound leads are never silently dropped.
- **CORS (2026-09-03):** per-form `allowed_origins`. `OPTIONS` echoes an
  origin registered on any form (a preflight has no token to scope by);
  `POST` enforces this form's list and returns `403 origin_not_allowed`
  with no CORS headers otherwise. Same-origin requests are always allowed
  (hosted page, iframe embed, preview hosts). No `Origin` header means no
  CORS logic at all. Never a wildcard on submit, never
  `allow-credentials`, always `vary: origin`.
- **Error contract:** 400 `validation_failed` (+`fields`), 403, 404
  `form_not_found`, 409 `form_disabled` (deliberately reveals that a
  disabled form exists; the token is public), 429 `rate_limited`, 500.
  Bot hits stay a silent 200.
- **Config read:** the route reads `enabled`, `allowed_origins` and the
  block tree with the service-role client (`lib/lead-capture/load-config`),
  so nothing new is granted to anon. Required fields are enforced from
  the block tree server-side (`missingRequiredFields`).
- **`GET /api/lead/config`:** public, wildcard CORS, returns exactly
  `{ enabled, fields }`; an integration test asserts the key set.
- **`source_origin`:** server-computed (request `Origin`, or the embed's
  referrer reduced to an origin and trusted only on same-origin
  requests). Never visitor-settable.

### Public booking ingest: `get_public_booking_page` / `submit_booking` (Scheduler Phase C)

Backs the public `/book/[token]` page and the booking form submission. Unauthenticated: the `meeting_types.share_token` (`uuid`) IS the capability. Both RPCs are `security definer`, `set search_path = public, auth`, granted to `anon`, and return `null`/`{error}` (never raise) for a missing/disabled token so token existence never leaks.

- **Scoping:** `submit_booking` derives the owning `user_id` from the token and creates the booking under it, plus matches/creates the couple under the same user. Cross-tenant write is impossible.
- **Field selection:** `get_public_booking_page` returns meeting type fields (name, description, duration, location_type, address), business_name, and branding scalars via `_user_branding()`, so no user_id, no share_token, no internal flags, no mc_email (harvesting risk).
- **Route hardening (`app/api/booking/slots/route.ts` and `app/api/booking/submit/route.ts`):**
  - `GET /api/booking/slots`: rate-limited 30/min/IP; serves available slots for a date range. No validation issues (read-only).
  - `POST /api/booking/submit`: Zod-validated form fields, rate-limited 5/min/IP; honeypot + min-fill timing (silent success). No service-role key.
- **In-RPC rate limit (submit_booking):** Counts confirmed bookings for the meeting type in the last hour; returns `rate_limited` if >= 6 per hour. Complements the route-level IP limit.
- **Couple matching:** Case-insensitive search by primary_email or legacy email (first by created_at). If no match, inserts a new couple with lead_source='booking'.
- **Plan limit:** Starter couple-cap exception is caught; booking still inserts (couple_id null, couple_linked false); fires `booking_created` alert and potential upgrade email.
- **Double-booking guard:** Exclusion constraint `bookings_no_confirmed_overlap` on (user_id, tstzrange) prevents overlapping confirmed bookings. Returns `slot_taken` if violated.

### Booking management: `cancel_booking` / `reschedule_booking` (Scheduler Phase D)

Backs the public `/book/manage/[manage_token]` page for booker self-service control. Unauthenticated: the `bookings.manage_token` (`uuid`) IS the capability. Both RPCs are `security definer`, granted to `anon`, and return `null`/`{error}` (never raise) so token existence never leaks.

- **Capability model:** Each booking is issued a unique, non-sequential `manage_token` (uuid v4) at creation. The token is the sole key for booker access to their booking; no user_id or coupling to the couple is exposed.
- **Route hardening (`app/api/booking/cancel/route.ts` and `app/api/booking/reschedule/route.ts`):**
  - Both routes: Zod-validated input, rate-limited 5/min/IP. No service-role key.
  - `cancel_booking(manage_token)`: Returns `{ok: true, ...}` or `{error: "not_found"|"already_cancelled"|"past"}`. On cancel, emits `booking_cancelled` automation event (payload: booking_id, couple_id, meeting_type_id, booker_name, booker_email, starts_at, ends_at, timezone).
  - `reschedule_booking(manage_token, starts_at, ends_at)`: Returns `{ok: true, ...}` or `{error: "not_found"|"cancelled"|"past"|"slot_taken"|"invalid"}`. On reschedule, clears `reminder_sent_at` so the new time gets its own reminder; no automation event emitted.
- **Token leakage protection:** `recordInvalidTokenAttempt` logs failed attempts (invalid token for either operation) without exposing booking existence; rate-limit responds uniformly for invalid tokens and valid-but-cancelled/past bookings.
- **Scoping:** The RPC resolves the booking by manage_token alone; the owning `user_id` is never passed, derived, or returned to anon.
- **Field selection:** Response includes booking_id, starts_at, ends_at, timezone, name, email, business_name (for confirmation UX). No user_id, no couple details beyond what's needed for the email.
- **Slot-taken recovery:** If two bookers race to reschedule into the same slot, the first succeeds and the second receives `{error: "slot_taken"}`. The page re-displays the slot picker so the second booker can choose another time.

### Service-role-only reminder RPCs (Scheduler Phase D)

Two RPCs for the `/api/cron/booking-reminders` endpoint. Service-role only: client EXECUTE was left in place until migration `20261001310000` revoked it from `public`, `anon` and `authenticated` (see the Task 23b finding under Fixed):

- **`bookings_due_for_reminder()`**: service_role only. Returns all confirmed bookings whose meeting type has `reminder_enabled = true`, whose `starts_at` is 0 to 36 hours away, and whose `reminder_sent_at` is null. Used by cron to batch-fetch remindable bookings. Returns `manage_token` alongside `booking_id`: the reminder email's reschedule link is `/book/manage/<manage_token>`, and building it from the booking id instead shipped a dead link in every reminder (fixed 20260821030000).
- **`mark_booking_reminder_sent(p_booking_id uuid)`**: service_role only. Sets `reminder_sent_at = now()`. Called after sending the reminder email so the booking is not re-sent on the next tick.

### Scheduler functions (pg_cron, R1)

`system_heartbeats` deliberately carries no `user_id`: it is a system table, not tenant data, so the RLS matrix row above has no owner column, and RLS is on with no policies at all, service-role only.

Three functions in `20261001000000_pg_cron_scheduler.sql`, all `security definer`, `set search_path = public`, and all revoked from public/anon/authenticated; service_role keeps the default grant:

- **`cron_call(p_path text)`**: reads the Vault-stored `app_base_url` and `cron_secret`, then POSTs to `<app_base_url><path>` via pg_net. Never exposes the secret: it is read into a local variable and used only as an outbound header, never returned.
- **`set_scheduler_secrets(p_base_url, p_secret)`**: upserts the two Vault secrets. Called only from the Admin "Sync scheduler" server action, which supplies the app's own `NEXT_PUBLIC_APP_URL` and `CRON_SECRET`.
- **`scheduler_status()`**: returns `{ configured, base_url, jobs[], heartbeats{} }` for the Admin Scheduler card. Returns the base URL only, never the secret.

pg_net's `net.http_request_queue` / `net._http_response` are granted to PUBLIC by `supabase_admin` and `postgres` cannot revoke that on a hosted project; the queue row briefly holds the bearer header. The protection is that `net` is not a PostgREST-exposed schema and no `public` security-invoker function reads it.

**`acquire_scheduler_lease(p_name text, p_ttl_seconds int, p_token uuid)`**
and **`release_scheduler_lease(p_name text, p_token uuid)`**
(`20261003200000_scheduler_lease.sql`), the lease the tick takes before
touching a single row and hands back when it is done: `security
definer`, `set search_path = public`, and granted to `service_role`
alone. Releasing somebody else's lease is as damaging as taking theirs,
so the release is locked down exactly like the acquire and only matches
on the caller's own token. `revoke ... from public, anon,
authenticated` is explicit rather than left to the `public` revoke,
because Supabase's local and hosted projects both run `alter default
privileges` for `public` that grants EXECUTE on every new function to
`anon` and `authenticated` on creation, the same shape as the audit
finding that `emit_automation_event` was reachable by `authenticated`
(see Phase 2's release step, `docs/superpowers/plans/2026-09-23-workflows-trust-remediation.md`).
Backs the `scheduler_leases` table in the RLS matrix below.

Vercel Deployment Protection must stay off on any deployment pg_cron calls: `pg_net`'s request carries only the `cron_secret` bearer, never Vercel's own cron-bypass header, so a protected deployment silently 401s every job behind Vercel's own auth page while `cron.job_run_details` still reads `succeeded` (see `.claude/docs/cicd.md` "First deploy on a project").

### Workflow stop-control RPCs (workflows trust remediation, Phase 3)

All `security invoker` unless noted, and all take the template row lock
before the instance row lock (one global order, so none can deadlock
against `delete_workflow_template` or `set_workflow_template_status`).

**Turn on is server-only (Task 34, `20261023600000`).** A client cannot
set a workflow template's `status` to `active`: the
`workflow_templates_activation_lock` trigger refuses it for the
`authenticated` and `anon` roles, and `set_workflow_template_status` is
service role only. `setTemplateStatusAction` does the RLS ownership
read, the pre-flight, then the flip with the admin client; the function
scopes its pause sweep to the template owner's instances. Since
`20261024200000` the trigger is an **allowlist** (`service_role`,
`postgres`, `supabase_admin`), so a role nobody planned for is refused
rather than let through, and the flip checks `steps_revision` (bumped
by a trigger inside every step write) instead of a step count and
timestamp. Nothing else can write that counter: a guard trigger
(`20261024300000`) refuses any insert or update that sets it, from every
role including the service role, unless it comes from the bump trigger
itself, so a client cannot reset it under an in-flight step edit and
pass the check (re-review F1; `steps-revision-guard.test.ts` runs it as
the signed-in client). The bump itself is `security definer` with an
empty search_path (`20261024400000`): a user delete cascades through it
as `supabase_auth_admin`, which has no grant on `workflow_templates`. It
only increments the counter of the template the changed step belongs
to, and a client can only write steps under its own templates, so it
cannot be aimed at another tenant (`user-delete-cascade.test.ts`). A `SECURITY DEFINER` function owned by `postgres` passes the
lock, so one that switches a workflow on must run the pre-flight
itself. Integration: `tests/integration/workflows/activation-lock.test.ts`
(including the allowlist, probed with a throwaway role in a rolled-back
transaction).

**Engine-only step RPCs (Phase 6 fix wave).** `workflow_claim_step`,
`workflow_finish_wait`, `workflow_hold_wait`, `_workflow_lock_live_instance`
(`20261023800000`) and `workflow_merge_step_outputs` (`20261023900000`)
are `security invoker` and executable by `service_role` only (revoked
from public, anon and authenticated), because they bypass the MC's own
edit paths. A signed-in user calling one gets a permission error
(`claim-requires-active.test.ts`).

- **`resume_workflow_instance(uuid, text)`** (`20261011100000`):
  `authenticated` + `service_role`, RLS applies. Refuses, in SQL, a
  paused instance with no reason and a `setup_interrupted` stop, so a
  direct call cannot bring one live without the app's settle.
- **`reopen_completed_workflow_instance(uuid, boolean)`**
  (`20261011100000`): `service_role` only; the un-tick action checks
  ownership first. Never makes a finished instance live on an off or
  deleted workflow.
- **`activate_applied_workflow_instance(uuid, boolean, text)`**
  (`20261010000000`): `service_role` only.
- **`_workflow_recompute_wedding_steps(uuid)`** and
  **`_workflow_wait_relative_wake(jsonb, date)`** (`20261007000000`):
  revoked from `public`, `anon` and `authenticated`. The recompute is
  `security definer` and takes any couple id: callable over PostgREST, it
  let anyone holding another tenant's couple id re-date that tenant's
  steps, undoing a manual reschedule so a snoozed send went out on its
  past date. Only the `couples` and `events` recompute triggers (definer,
  run as the owner) call it. `create or replace` keeps the default
  grants, so the revoke has to be explicit. Covered by
  `tests/integration/workflows/recompute-grants.test.ts`.

### Cron auth gate: `/api/cron/booking-reminders` (Scheduler Phase D)

Uses the shared `isCronAuthorized(request)` helper (constant-time comparison of `Authorization: Bearer CRON_SECRET`). Invoked on a 22:30 UTC schedule via pg_cron (`zebri:booking-reminders`). See "Cron-secret enforcement" section above for full details.

### MC Calendar Busy Route: `GET /api/calendar/busy` (Scheduler Phase E)

Backs the authenticated MC's `/calendar` page Day and Week views. Authenticated session required; RLS scopes access.

**Fail-soft posture (inverse of public surfaces):**
- Returns HTTP 200 with an empty busy list plus `unavailable: true` flag when Google/Outlook providers are unreachable
- Public booking surfaces (in `lib/booking/availability.ts` and `app/api/booking/slots/route.ts`) deliberately use `getBusyIntervals` (free/busy only, anonymous)
- Dashboard-only surfaces use `getBusyEvents` (event titles visible) in `app/api/calendar/busy/route.ts` only
- Why: the MC is viewing their own calendar, so an outage must not blank the page (fail-soft). A couple should never learn what is in an MC's private calendar (fail-closed on public surfaces). Both calls carry why-comments forbidding the inverse pattern.

**Returns:** `{ busy: BusyBlock[], unavailable?: boolean }`
- `BusyBlock`: `{ starts_at, ends_at, title?, color? }`
- Title and color present only when provider succeeded; absent when `unavailable: true`
- Covers both external calendar (Google Calendar, Outlook) and Zebri bookings

**Security considerations:**
- Session-authenticated (middleware + RLS client)
- No public token, no IP rate-limit (authenticated, per-user query)
- No existence oracle (any retrieval failure treated as "no busy blocks for that range")

### MC Booking Actions (Scheduler Phase E)

Backs the dashboard `/calendar` booking detail panel (cancel and reschedule from the MC's view). Authenticated and RLS-scoped; server action calling the same SECURITY DEFINER RPCs as the public manage page.

**Server action:** `app/(dashboard)/calendar/booking-actions.ts`
- `cancelBookingAction(bookingId)`: Proves RLS ownership (loads row via session client), then calls the public `cancel_booking` RPC using the booking's `manage_token`. No existence oracle (404 response for not-found vs not-owned is identical). No token ever sent to client.
- `rescheduleBookingAction(bookingId, startsAt, endsAt)`: Same ownership proof, then calls `reschedule_booking` RPC with the new times. Handles slot-taken conflict by returning `{ error: "slot_taken" }` for UI display (booker sees same recovery UX as the public manage page).
- Both compose `lib/booking/lifecycle.ts` post-RPC orchestration (calendar sync, emails, alerts) so the dashboard and public manage page cannot drift.

**Field selection:** No manage_token in any SELECT; token is stored and used server-side only.

### Public RPC audit — `get_public_invoice`

This `security definer` function backs the public-facing
`/invoice/[token]` page. (This audit was originally run against
`get_public_quote` in Phase 2C; the quote RPCs were dropped with the
quotes feature and the model carried over to the invoice RPC.)
Couples aren't authenticated; the share token IS the capability.
Findings:

**Tokens (✅ acceptable):**
- `share_token` column is `uuid` with `gen_random_uuid()` default —
  UUID v4 ≈ 122 bits of entropy, unguessable in practice (10⁹ guesses/s
  would take ~10²¹ years to hit a single token).
- Not sequential, not predictable.
- Revocation via `share_token_enabled = false` (RPC `where` clause
  requires it true). The original token stays in the DB so an
  enable/disable toggle works without re-issuing URLs.

**Field selection (✅ minimal):**
- `get_public_invoice` returns: id, title, invoice_number, status,
  notes, due_date / payment schedule fields, couple_name, items,
  branding, plus bank details (account_name, bsb, account_number)
  and `stripe_connect_enabled`. Bank details are intentional (the
  couple needs them to pay via bank transfer). No user_id, no
  share_token, no stripe_customer_id, no Stripe account ID, no
  internal flags, no other-couple data.

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

Five cron-triggered routes, scheduled by pg_cron rather than
`vercel.json` (see `.claude/docs/cicd.md` "Scheduled jobs (pg_cron)"
for the full job table and secret-sync flow):

| Route | Schedule (UTC) |
|---|---|
| `/api/cron/expire-contracts` | `0 22 * * *` |
| `/api/cron/booking-reminders` | `30 22 * * *` (Scheduler Phase D) |
| `/api/cron/prune-stripe-events` | `0 3 * * *` (Phase 2A) |
| `/api/cron/automations-tick` | `* * * * *` (the workflow tick; keeps its legacy path because renaming a live cron endpoint is a needless outage risk) |
| `/api/cron/workflow-digest` | `0 * * * *` (Workflows) |

pg_cron is not capped the way Vercel's Hobby scheduler was, so the tick
runs every minute and the digest runs hourly, gating on each MC's
local 7am: see `.claude/docs/workflows.md`. A per-user local-date
stamp (`user_public_settings.daily_digest_last_sent_on`) keeps that to
one send per MC per day, including through the repeated hour daylight
saving creates.

All of them use the shared helper **`@/lib/api/cron-auth`** —
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
- `app/api/contract/otp/{request,verify}/route.ts`
- `app/api/stripe/{checkout,webhook,invoice-payment,connect/callback}/route.ts`
- `lib/admin/admin-analytics.ts`
- `lib/contracts/notify.ts`

**Why the two contract OTP routes need it** (2026-09-03). The signer
verification RPCs (`issue_signer_otp`, `peek_signer_otp`,
`fail_signer_otp`, `consume_signer_otp`) are granted to `service_role`
ONLY, with `anon` and `authenticated` explicitly revoked. That is
load-bearing, not incidental:

- `issue_signer_otp` accepts a caller-supplied **hash**. If `anon`
  could reach it, whoever holds a sign link would POST the hash of a
  code they chose and then "verify" that code, defeating the entire
  check. The point of the OTP is to distinguish the link holder from
  the mailbox owner.
- `peek_signer_otp` returns the stored `code_hash` and salt, which
  must never be reachable through an anon-granted path.
- The obvious alternative (SQL generates the code and returns the
  plaintext to an anon caller) is strictly worse: it hands the code
  straight to the link holder.

The plaintext code is never stored. Only a salted SHA-256 is, and the
comparison happens in Node with `timingSafeEqual`, so Postgres never
sees the code at all. SHA-256 rather than a slow KDF is deliberate:
the secret is a 6-digit code with a 10-minute TTL and a 5-attempt
lockout, so the offline-cracking threat a KDF defends against does not
exist, and the attempt cap is the real control. See `lib/contracts/otp.ts`.

`lib/contracts/notify.ts` uses it because the caller is an anonymous
signer who cannot read the contract roster under RLS.

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

**Two-factor (Phase 4 Task 23):** `AUTH_RATE_LIMITS.redeemRecoveryCode`
(5 per 15 minutes, keyed per user: the caller already holds the
password, so every guess is against the last line of defence),
`AUTH_RATE_LIMITS.issueRecoveryCodes` (5 a minute per user; each call
runs ten scrypt hashes), and `verifyTotpUser` / `verifyTotpIp` (10 per
user and 30 per IP per 15 minutes, both checked by
`beginTotpAttemptAction` before every authenticator code check in the
app). Hits raise `auth_rate_limit_hit`. Supabase applies its own per-IP
limit to the verify call; a caller going to Supabase directly meets only
that one. Task 23b's database enforcement does not change that (the
endpoint is GoTrue's); see "Fixed in Task 23b" above.
Design and threat notes: `authentication.md`, "Two-factor sign-in".

### Public token-attempt limiter — `@/lib/api/public-token-limiter` (Phase 2D.2)

Sits in front of the unauthenticated share-token surfaces
(`/invoice/[token]`, `/portal/[token]`, `/proposal/[token]`). Counts
**invalid** token attempts per IP — successful loads of a valid
token are free. Two cooperating bands:

- **Long window** — 60 invalid attempts / hour. Past that:
  `recordInvalidTokenAttempt` returns `allowed: false`; the caller
  renders `notFound()` instead of the friendly "unavailable" copy.
- **Burst window** — 10 invalid attempts / 60s. Crosses the
  threshold → one Slack alert (`public_token_attempt_burst`) per
  burst (deduped via an internal one-shot bucket — no spam on
  attempts 12, 13, 14, …).

Wired today: `/portal/[token]` and `/proposal/[token]` (both server
components, easy hookup). **Not yet wired** on `/invoice/[token]`. That page is a client
component that calls `get_public_invoice` directly from the browser,
so the limiter would need a server-fetch refactor (convert to RSC +
Client component child for interactivity). Tracked as a follow-up. The
unique-share-token capability model is the primary defence; the
limiter is defence-in-depth and covers the highest-traffic public
surface (the portal) today.

### Proposal media storage, embed allowlist, and the role action (Phase B)

- **`proposal-media` storage bucket**
  (`supabase/migrations/20260924000000_proposal_surface.sql`): public
  read, 50MB / MP4-or-WebM enforced at the bucket. Owner-write path
  rule on insert/update/delete  -  `auth.uid()::text = split_part(name,
  '/', 1)`, i.e. the object's first path segment must be the caller's
  own user id  -  the same shape as the existing `branding` bucket's
  policies. `uploadProposalMedia` (`app/(dashboard)/branding/upload-proposal-media.ts`)
  validates type and size client-side before the request even opens
  (a bad file never starts a doomed upload), but the bucket's own MIME
  and size limits are the real enforcement boundary; the client check
  is only a fast-fail UX improvement.
- **`uploadProposalMediaFile`** (`features/proposals/data/media.ts`,
  Proposal Layout v2 Phase 2): the template editor's own upload path to
  the same `proposal-media` bucket (image nodes, audio nodes, and
  section background images/video via the node bars in
  `features/proposals/editor/bars/`), duplicating
  `uploadProposalMedia`'s client-side-caps-before-network-call pattern
  rather than importing it (the feature-module boundary forbids
  `features/proposals/` reaching into `app/`). `MEDIA_LIMITS` caps:
  image 10MB (`jpeg`/`png`/`webp`/`gif`), audio 25MB
  (`mpeg`/`mp4`/`x-m4a`/`wav`), video and hero `background` 50MB
  (`mp4`/`webm`). **Gap closed**: `20260928000000_proposal_media_mime_types.sql`
  widened the bucket's `allowed_mime_types` from `['video/mp4',
  'video/webm']` to the full union `MEDIA_LIMITS` allows (video, then
  image, then audio types); `file_size_limit` stays 52428800 (50MB),
  the ceiling sized for the largest kind - the smaller per-kind caps
  (image 10MB, audio 25MB) remain client-side-only in `MEDIA_LIMITS`,
  enforced before the upload request opens, not by the bucket itself.
  Image and audio uploads in the template editor now succeed
  end-to-end. Still not covered by any test (`media.test.ts` only
  exercises the client-side validation branch, never a real bucket
  write) - an integration test writing an image/audio object to the
  local bucket would close that gap.
- **Embed host allowlist**: `parseEmbedUrl` (`lib/proposals/embed-url.ts`)
  only recognises YouTube and Vimeo hostnames (`YOUTUBE_HOSTS` /
  `VIMEO_HOSTS`, exact `Set` membership, not a substring or regex
  match); every other host returns `null` and the caller never embeds
  it. This is the only thing standing between a pasted URL and an
  arbitrary iframe `src` on a public page, so a new video provider
  must be added to one of those two sets deliberately, never inferred
  from the URL shape.
- **`chooseProposalRoleAction`** (`app/(dashboard)/branding/proposal-role-actions.ts`):
  a `'use server'` action, Zod-validated (`z.enum(PROPOSAL_ROLES)`
  rejects anything but `mc` / `celebrant` / `both`), using the
  RLS-scoped server client (`createClient()` from
  `lib/supabase/server`, session-derived  -  never the service role) for
  every read/write, so the `user_branding` upsert and the starter
  `packages`/`package_items` inserts are all scoped to the caller by
  RLS, not by an application-level `user_id` check. Idempotent: it
  only seeds starter packages when the MC owns zero packages, so
  calling it again (a different role, or a retry) never duplicates
  them.

### Proposal close RPCs and routes (Proposals Phase C)

`supabase/migrations/20260925000000_proposal_close.sql`. Every RPC is
`security definer`, `set search_path = public`, and resolves its subject
through a token the couple already holds (never an id from the body).

**SECURITY DEFINER inventory:**

| RPC | Grant | Notes |
|---|---|---|
| `accept_proposal(p_token, p_option_id, p_addon_selection)` | `anon`, `authenticated` | Share-token gated; validates option/add-on parentage before touching any pending contract; owner-matches the template read and the draft delete; refuses `already_accepted` once the contract is signed. Add-on ids stored de-duplicated. Returns `contract_id`, `sign_token`, `user_id`, `proposal_id`. |
| `decline_proposal(p_token, p_reason, p_message)` | `anon`, `authenticated` | Share-token gated; deletes an unsigned draft contract (owner-matched) and nulls `contract_id`; refuses once the contract is signed. |
| `get_public_proposal(token)` | `anon` | Returns `pending_contract.sign_token` (the couple's own signer credential), `invoice.share_token`, the MC's `bank_*` and `stripe_connect_enabled`; `deposit_percent` is null whenever `payment_schedule_id` is set. `pending_contract` and `invoice` are owner-matched (`user_id = p.user_id`). |
| `finalize_proposal_acceptance(p_token, p_invoice)` | service role only (`revoke ... from public, anon, authenticated`) | Signer-token gated; the invoice payload is computed server-side in `lib/proposals/finalize.ts`. Refuses `declined`, `not_signed`; owner-matches the existing-invoice read. |
| `expire_proposals()` | service role only (`revoke ... from public, anon, authenticated`) | Daily cron stamp; the cron route is pending (Task 6). |
| `record_proposal_events(p_token, p_session_id, p_events)` | `anon`, `authenticated` | Share-token gated (`for update` lock on the proposal row before computing `first_open`, closing a two-tabs-same-second race). Validates `p_session_id` and caps the batch at 50 events; unknown event types are silently dropped, not counted in `inserted`. Returns `{ ok, inserted, first_open }`. Proposals Phase D. |
| `get_public_proposal_layout(token)` | `anon`, `authenticated` | Share-token gated (`share_token_enabled = true`), `stable`, no side effects (no view-count bump, unlike `get_public_proposal`). Returns the proposal's own `layout`, else `null`; `null` for a disabled or unknown token; no `proposal_templates` fallback at all (a template never renders on a couple's link, cross-tenant or not). Strips `page.passwordHash` from the returned jsonb with `#-` before it leaves the function, since the password gate runs server-side and the hash is never a public field. Proposal Layout v2 Phase 1 (`supabase/migrations/20260927000000_proposal_layout_v2.sql`). |

**Rule: any `proposals.*_id` pointer read by a public RPC must be
owner-matched in the RPC itself (`... and x.user_id = p.user_id`), not
only in the table's `with check`.** The `with check` stops an RLS
client writing a foreign pointer; the RPC clause stops a pointer that
arrived any other way (a service-role write, a future migration) from
leaking another MC's row through this MC's share link. Both layers
exist today; `tests/integration/proposals/accept-proposal.test.ts`
seeds a spoofed `contract_id` with the service client and asserts
`get_public_proposal` returns `pending_contract: null` and
`accept_proposal` never deletes the foreign draft.

**Routes:** `POST /api/proposal/accept` and `/decline` are Zod-validated
(`lib/proposals/accept-schemas.ts`), rate-limited 5/min/IP, never log
the share token, and count an RPC `not_found` against
`recordInvalidTokenAttempt({ surface: 'proposal' })` so enumeration
through the routes trips the same alert as the page. `POST
/api/contract/sign` runs `runAfterSignEffects`, which alerts
`proposal_close_failed` (stage `finalize`, with the MC and proposal ids
once known) on every finalize failure, thrown or returned. The public
page self-heals a signed-but-unfinalized contract by re-running the
idempotent finalize before render (`app/proposal/[token]/_lib/self-heal.ts`).
`saveProposalAction` deletes an unsigned pending draft (killing the stale
sign token) and refuses once it is signed. `publishContractSnapshot` only
ever rewrites a `status = 'draft'` contract.

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

**Workflow milestones (opt-in leak surface).** `get_portal_milestones`
is the only route by which a couple can read anything from a workflow,
and a workflow is the MC's internal list ("chase the outstanding
balance" is a step on it). Three properties hold it shut:

- `workflow_steps.visible_to_couple` defaults to **false**. Nothing
  reaches the portal unless the MC deliberately toggled that step.
- The function is `security definer` and token-gated through
  `_resolve_portal_couple`, filtered to the resolved couple's `active`
  instances. An unknown, disabled or wrong-couple token returns `[]`.
- Status collapses to `done` | `upcoming`. `error_message` is never
  selected, so an internal failure cannot reach the couple's page.

Proven in `tests/integration/portal/milestones.test.ts` through the
anon client: invisible steps, a cancelled instance, another couple's
token, a revoked token, and a signed-in MC querying the table directly.

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
the wedding-day run-of-show. Like the portal and invoice surfaces,
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

Same follow-up as the other public surfaces: extending the public
token-attempt limiter (currently `/portal/[token]` only) to cover
`/timeline/[token]` is tracked for completeness.

### Authenticated Stripe routes — Phase 2D.2 additions

| Route | Zod | Rate-limit | Notes |
|---|---|---|---|
| `app/api/stripe/invoice-payment/route.ts` | ✅ `bodySchema` (invoiceId UUID, shareToken min/max, paymentType enum) | ✅ 10/min/IP via `inMemoryLimiter` | Generic 404 on missing-or-mismatched-token (no info leak). `success_url` carries `session_id={CHECKOUT_SESSION_ID}` for the payment-success re-verification. `metadata.connected_account_id` cross-checked on the success page. Stripe-failure path uses `logger.error`; raw error message NOT returned to the couple (returns generic 502). |
| `app/invoice/payment-success/page.tsx` | n/a (server component) | n/a | Server-side `stripe.checkout.sessions.retrieve(session_id, { expand: ['payment_intent'] })`. Five-check verification: invoice exists + MC has Connect account + session.metadata.invoice_id matches + session.metadata.connected_account_id matches + payment_intent.status === 'succeeded'. Any mismatch → notFound() + `payment_success_param_tampered` Slack alert. Idempotent. |

### Proposal template autosave beacon

| Route | Zod | Rate-limit | Notes |
|---|---|---|---|
| `app/api/proposals/templates/layout-beacon/route.ts` | ✅ `updateTemplateLayoutSchema` (same schema `updateTemplateLayoutAction` uses) | n/a — authenticated same-origin write, not a public/money surface | Exists only so `navigator.sendBeacon` (fired from a `beforeunload` handler, see `proposals.md`) has a plain endpoint to call, since a Server Action can't be a beacon target. Same auth (`supabase.auth.getUser()`) and ownership check (RLS via the user-context client, `.eq('id', ...)` + `count: 'exact'` returns 404 on a foreign or unknown id) as the action. Cross-tenant denial covered by `tests/integration/proposals/layout-beacon-route.test.ts`. Best-effort: the response is never read (the page is unloading). |

### Public questionnaire routes — Couple questionnaires

| Route | Zod | Rate-limit | Notes |
|---|---|---|---|
| `app/api/questionnaire/save/route.ts` | ✅ `questionnaireWriteSchema` (token UUID + `responses` record) | ✅ 30/min/IP via `inMemoryLimiter` (autosave fires often) | Calls `save_questionnaire_progress` (SECURITY DEFINER, token-gated). Generic error on RPC failure; detail logged. Refuses once completed. |
| `app/api/questionnaire/submit/route.ts` | ✅ `questionnaireWriteSchema` | ✅ 5/min/IP via `inMemoryLimiter` (one-shot) | Calls `submit_questionnaire` (SECURITY DEFINER). Typed RPC errors (`already_completed`) surfaced as 400; transport failures return generic 500 with `logger.error`. |

Both are unauthenticated — the share token IS the capability, validated DB-side
against `share_token_enabled = true`. The public page (`/questionnaire/[token]`)
loads via the `get_public_questionnaire` RPC (anon, branding-merged).
`/questionnaire` and `/api/questionnaire` are on the middleware
`PUBLIC_ROUTES` allowlist (added 2026-07-05 — before that the middleware
bounced logged-out couples to `/login`). The MC can revoke access per
questionnaire via the "Turn link off" row action (`share_token_enabled`).

### Public unsubscribe endpoint + page (Phase 2, Task 11)

| Route | Zod | Rate-limit | Notes |
|---|---|---|---|
| `app/api/unsubscribe/route.ts` (`POST`) | ✅ `bodySchema` (`token`, from a form body via `parseFormDataBody`) | ✅ `UNSUBSCRIBE_RATE_LIMITS.confirm`, 20/min/IP, applied only to invalid tokens after verification (a valid token is never limited: the write is idempotent, and one-click POSTs arrive from shared provider IPs; Task 15c) | Public, unauthenticated by design: the Spam Act Regulations forbid requiring a login to opt out. Token is a signed, stateless HMAC-SHA256 capability (`lib/email/unsubscribe-token.ts`), not a DB-stored one, so verification needs no lookup. Writes through `recordUnsubscribe` (`lib/email/record-unsubscribe.ts`, shared with the one-click route): `email_suppression` (reason `unsubscribed`, admin client, unique-violation on a repeat treated as success) and `couples.do_not_email` for every couple of that owner whose stored address IS the address (case and surrounding whitespace folded, compared in TypeScript; ILIKE only narrows candidates, with `_`, `%` and `\` escaped, because as a pattern `john_smith@` matched `johnXsmith@`). A failed suppression write alerts `app_error` (`source: 'unsubscribe'`) and redirects with `?error=write_failed`, which the page renders. Invalid tokens count toward `recordInvalidTokenAttempt` (`surface: 'unsubscribe'`, new value added to `PublicSurface` and the `public_token_attempt_burst` alert union). |
| `app/api/unsubscribe/[token]/route.ts` (`POST`, `GET`) | n/a: the token is the path segment and the RFC 8058 body (`List-Unsubscribe=One-Click`) carries nothing to validate; it is deliberately not required, since the signed token is the capability and a strict body check could only lose an opt-out | ✅ `UNSUBSCRIBE_RATE_LIMITS.confirm`, 20/min/IP, applied only to invalid tokens after verification (a valid token is never limited: the write is idempotent, and one-click POSTs arrive from shared provider IPs; Task 15c) | The URL every commercial automated email advertises in `List-Unsubscribe`. `POST` is the mailbox provider's one-click unsubscribe (no cookie, no person): verifies the token, records through `recordUnsubscribe`, answers 200, 400 (invalid token, counted by `recordInvalidTokenAttempt`), 429 or 500 (write failed, alerted, so the provider can retry). `GET` never writes: 303 to the page. Proven end to end in `tests/integration/email/legal-floor.test.ts`, which POSTs exactly what Gmail sends to exactly the URL a real step's header carried. |
| `app/unsubscribe/[token]/page.tsx` (`GET`) | n/a, read-only | n/a | Never mutates: mailbox providers and link scanners pre-fetch `GET` links, so the page only decodes the token and reads current suppression state, rendering invalid / already-unsubscribed / confirm-form. The confirm form is a plain HTML `POST` to the route above (`action="/api/unsubscribe"`), needing no client JS, so a scanner following the `GET` link can never trigger the write, and a real confirming click is the one action that does. A second visit after confirming reads the row back and renders the done state instead of the form, which is what makes a repeat visit or a second partner clicking harmless. |

Both routes are on the middleware `PUBLIC_ROUTES` allowlist (`/unsubscribe`,
`/api/unsubscribe`), added in the same change as the routes themselves. RLS
coverage for the tables this writes (`email_suppression`, `couples`) is
unchanged from Task 10; this endpoint writes through the service-role admin
client, same as every other public-surface write in this codebase, and does
not depend on RLS to scope the write, the token payload does. Cross-tenant
behaviour (an owner's suppression and `do_not_email` writes never touch
another owner's rows) follows from scoping every write by `payload.uid` taken
from the verified token, never from client input. Tested end to end in
`tests/integration/email/unsubscribe.test.ts`: valid token suppresses and
flips every same-address couple, tampered token writes nothing, repeat
confirm is a no-op, and a burst from one IP trips the rate limit.

### Resend bounce and complaint webhook (Phase 2, Task 14)

| Route | Zod | Rate-limit | Notes |
|---|---|---|---|
| `app/api/resend/webhook/route.ts` (`POST`) | ✅ `resendEventSchema`, applied after signature verification (the body is read as text for the signature, so `@/lib/api/validate` is not used) | ✅ `inMemoryLimiter`, 1000/min/IP (Resend delivers a campaign's bounces from a small address pool) | Public, unauthenticated by design: Resend sends no session, and the Svix signature is the capability. On the middleware `PUBLIC_ROUTES` allowlist as the full path `/api/resend/webhook`, not the `/api/resend` prefix; `tests/unit/middleware.test.ts` proves a sessionless request reaches it and private paths still redirect. Writes `email_suppression` (reason `bounced` / `complained`) through the service-role admin client, owner taken only from the `tenant` tag the send path sets, and only when that tag is a uuid. Never guesses an owner from the recipient address. Suppresses a bounce only when `data.bounce.type` is `Permanent`; a transient, undetermined or untyped bounce alerts `app_error` and writes nothing, since a suppression row is permanent. Refuses to suppress on a message tagged `copies` (sent with cc or bcc, tag added in `lib/email/dispatch.ts`), because the event lists only `to` and the dead mailbox may be a copy's. Ignores every event on a message tagged `mc_copy` (the MC's own paper-trail copy of a `send_email` step, Phase 5 fix wave): it suppresses nobody and moves no delivery row. An automated message (`src=auto`) whose `couple_emails` row does not exist yet answers 500 while the event is under ten minutes old so Resend retries it, then 200 (M3); a forged event cannot use this to do more than ask for a retry, since the request is signature-verified first. Untagged, malformed-tag, copies and multi-recipient events all alert `app_error` and write nothing. Replays are no-ops through the `(user_id, lower(email), reason)` unique index. Tested in `tests/integration/email/resend-webhook.test.ts`, including cross-tenant denial. |

### Send-path suppression check (Phase 2, Task 12; whole-phase fix wave)

Every automated send checks suppression before dispatch: the actions that go
through the gate in `lib/email/automation-send.ts` (`sendAutomationEmail` for
one recipient, `openAutomationSend` for a step with several: the six
post-event emails, the portal link, request information, the run sheet to
vendors and couple, the run-sheet link to the couple, the questionnaire), and
the `send_email` action, which runs the same checks inline. If the recipient's
address is in `email_suppression` for that tenant (case- and
whitespace-insensitive), or the recipient is the couple's own address and the
couple has `do_not_email` set, the send is skipped and reported as
deliberately skipped (ok:true with a skipped reason, counted apart from sends),
not as a failure to retry. A couple's `do_not_email` never drops mail to their
vendors. Emails an MC composes and sends by hand in the app
(`/api/email/send-template`, send-proposal) are deliberately not checked, as
those are human-deliberate actions; the `send_email` workflow action is
automated and is checked.

The gate also decides whether a send is commercial, from the action type,
through `isTransactionalSend` (`lib/email/commercial-classification.ts`), and
for a commercial send mints a token per recipient (so every copy's link
unsubscribes the person it was sent to), puts the page link in the body
(appending the identity and unsubscribe block when the renderer did not),
and advertises the one-click route in `List-Unsubscribe`. It then charges the
tenant's shared-domain send-rate limit once per step, after the opt-out check,
and turns a breach into a `send_rate_limited` sleep.

Transactional sends are also deliberately not checked, and this is worth
stating because it looks like an omission. `send_invoice` and
`send_contract` live in `lib/automations/actions/documents.ts` and call
`dispatchEmail` themselves rather than going through `sendAutomationEmail`,
so an unsubscribed couple still receives their invoice and their contract.
That is the intended behaviour: the Spam Act's unsubscribe requirement
covers commercial messages, and withholding somebody's bill because they
opted out of marketing would be a worse outcome than the one the opt-out
exists to prevent. The same structure is what keeps the List-Unsubscribe
headers off those messages: `documents.ts` never sets `listUnsubscribeUrl`,
so no invoice carries an unsubscribe header without anyone having to
remember to suppress one. Everything else is commercial, and
`isTransactionalSend` (`lib/email/commercial-classification.ts`) is the
single place that says so: the gate consults it on every send, so the
lawyer's eventual answer edits only that allow-list.

**Case-insensitivity is enforced in Postgres, not in TypeScript.** The
`email_suppression.email` column stores the address exactly as the provider or
the unsubscribe click reported it, so either side of a comparison can carry
mixed case and lower-casing the search term in application code fixes only half
the problem. PostgREST cannot express `lower(email) = lower($1)` as a filter, so
the lookup goes through `public.is_email_suppressed(p_user_id uuid, p_email
text) returns boolean` (`20261006000000_is_email_suppressed_function.sql`),
whose predicate matches the `(user_id, lower(email), reason)` functional index
and therefore stays an index lookup. The function is `security invoker`, not
definer: the send path calls it with the service-role client, which bypasses RLS
anyway, so definer would buy nothing and would hand a future authenticated
caller a read across every tenant's suppression list. `execute` is revoked from
`public` and from `anon` explicitly, because Supabase's default grants hand it
to `anon` and `authenticated` directly rather than by inheritance.

**The check has three outcomes, and failing to determine one never sends.**
`isEmailSuppressed` and `isCoupleOptedOut` return a tagged
`{ status: 'blocked' | 'clear' | 'unknown' }` rather than a boolean. A boolean
forced a failed lookup to be reported as one of the other two and both are
wrong: reporting "not suppressed" mails somebody who unsubscribed, and reporting
"suppressed" writes a permanent, never-retried skip for a couple who never
opted out. `unknown` is turned by both call sites into an action error with
`recoverable: true`, so the executor defers the step onto its existing backoff
and tries again rather than sending or skipping.

`lib/email/suppression.ts`: `isEmailSuppressed`, `isCoupleOptedOut` helpers and
the `SendGateResult` type.
`lib/email/automation-send.ts`: `sendAutomationEmail` obtains its own admin
client and checks both gates before dispatch.
`lib/automations/actions/messaging.ts` (send_email): resolves both gates for
every recipient BEFORE the first dispatch, so an indeterminate lookup on the
second recipient cannot arrive after the first has already been mailed. The
couple's `do_not_email` flag drops the `primary` and `spouse` recipients only:
it records that the couple asked to stop hearing from the MC and says nothing
about the family contacts or vendors a step may also address.
`tests/unit/lib/email/automation-send-suppression.test.ts` (6 tests): all three
outcomes on both gates at the shared-address chokepoint, asserting on the
transport.
`tests/integration/automations/messaging-send-email.test.ts` (8 tests, 6 of them
the gate): suppressed address blocks dispatch, couple `do_not_email` blocks
dispatch, case-insensitive matching proven in BOTH directions against the real
index (a mixed-case stored row against a lowercase send and the reverse, since a
naive `toLowerCase()` passes only one of them), an indeterminate lookup leaves
the step `pending` with `attempt_count` 1 and a future `due_at` rather than
sending or marking it skipped, and a two-recipient step with one suppressed
sends to exactly one.

---

## RLS coverage matrix

All app tables enable RLS. The owner column is `user_id uuid` on each.
The base policy is `auth.uid() = user_id` for SELECT/INSERT/UPDATE/
DELETE (sampled clean across the migrations).

On top of each table's own policies, every public RLS table (and
`storage.objects`) carries the RESTRICTIVE `require_mfa` policy for
`authenticated` (Task 23b): an `aal1` session of an MC with a verified
factor gets nothing unless it is an open shadow session. The last two
rows below cover it.

| Table | RLS enabled | Owner column | Integration test | Per-page phase |
|---|---|---|---|---|
| `couples` | ✅ | `user_id` | ✅ `tests/integration/rls/couples.test.ts` (5 tests) + `tests/integration/billing/couple-cap.test.ts` (10 tests — Starter cap enforcement) | Couples & Events |
| `events` | ✅ | `user_id` | ✅ `tests/integration/rls/events.test.ts` (Phase 4A, 5 tests) | Couples & Events |
| `contacts` | ✅ | `user_id` | ✅ `tests/integration/rls/contacts.test.ts` (Phase 5, 5 tests) | Contacts |
| `tasks` | ✅ SELECT only (frozen 2026-09) | `user_id` | ✅ `tests/integration/workflows/legacy-frozen.test.ts` (10 tests — reads still work, every write path refused) | Retired → Workflows |
| `invoices` | ✅ | `user_id` | ✅ `tests/integration/rls/payments-tables.test.ts` (Phase 2C) | Payments |
| `invoice_items` | ✅ | `user_id` | ✅ `tests/integration/rls/payments-tables.test.ts` (Phase 2C) | Payments |
| `bookings` | ✅ | `user_id` + `_owns_couple_or_null(couple_id)` + `_owns_meeting_type(meeting_type_id)` on write | ✅ `tests/integration/rls/bookings.test.ts` (Phase C: cross-tenant read/insert/update/delete denial, manage_token uniqueness, couple-delete set-null; parent-ownership: cross-tenant couple/meeting-type insert denial, repoint-on-update denial, null-couple allowed) | Public Booking (Phase C); parent guard 20260821040000 |
| `contracts` | ✅ | `user_id` | ✅ `tests/integration/contracts/contract-audit-log.test.ts` (Phase 3.2 — exercises owner-only RPC paths) | Contracts |
| `contract_templates` | ✅ | `user_id` | ✅ `tests/integration/rls/contract-templates.test.ts` (Phase 12, 6 tests) | Contracts |
| `contract_audit_log` | ✅ (SELECT-only for owner; no write policies — Phase 3.2) | `user_id` | ✅ `tests/integration/contracts/contract-audit-log.test.ts` (5 tests) | Contracts |
| `contract_signers` | ✅ (+ parent-ownership `with check` via `_owns_contract`) | `user_id` | ✅ `tests/integration/rls/contract-signers.test.ts` (6 tests, incl. cross-tenant parent write) | Contracts |
| `email_templates` | ✅ | `user_id` | ✅ `tests/integration/rls/email-templates.test.ts` (7 tests — incl. starter seeding) | Email Templates |
| `email_template_files` | ✅ | `user_id` | ☐ (added with static-upload flow) | Email Templates |
| `email_template_categories` | ✅ | `user_id` | ✅ `tests/integration/rls/email-template-categories.test.ts` (6 tests — cross-tenant read/rename/delete/insert denial + category-delete set-null keeps templates) | Email Templates |
| `packages` | ✅ | `user_id` | ✅ `tests/integration/rls/packages.test.ts` (6 tests) + `tests/integration/portal/package-selection.test.ts` (10 tests: `get_portal_packages`/`save_portal_package` token gating, cross-tenant package rejection, archived rejection, clear) + `tests/integration/rls/couple-selected-package.test.ts` (6 tests: MC-side set/clear, FK-set-null on package delete, cross-tenant denial both directions) | Templates |
| `package_items` | ✅ | `user_id` | ✅ `tests/integration/rls/packages.test.ts` (covered via parent) | Templates |
| `invoice_templates` | ✅ | `user_id` | ✅ `tests/integration/rls/invoice-templates.test.ts` (6 tests) | Templates |
| `invoice_template_items` | ✅ | `user_id` | ✅ `tests/integration/rls/invoice-templates.test.ts` (covered via parent) | Templates |
| `couple_emails` | ✅ | `user_id` | ✅ `tests/integration/rls/couple-emails.test.ts` (6 tests) + `tests/integration/email/automated-send-log.test.ts` (Task 30). Policies: owner SELECT; INSERT `source = 'manual'` only, parent couple owned (EXISTS, so a null `couple_id` is refused), engine-only columns null or default (status `sent`, no provider id, attempt key, transport, step, instance, error, delivery timestamps or `superseded_at`); DELETE manual rows only; no UPDATE policy. `couple_id` is `on delete set null` (Phase 5 fix wave M2), so deleting a couple no longer erases automated rows and cannot reset the tenant's daily cap; orphaned rows stay owner-only by `user_id`, and (residual pass R2, `20261023300000`) are scrubbed of the couple's personal details by the `couple_emails_scrub_on_couple_delete` trigger as the set null runs: address to a placeholder, subject blank, template name, error, provider id and attempt key (which embeds the address) null, so nothing identifying outlives the MC's deletion (APP 11.2) while the cap still counts the row; tested in `automated-send-log.test.ts`. Any future UPDATE policy must restrict the writable columns or use column grants. `require_mfa` restrictive policy and the shadow-mutation trigger attached. TRUNCATE, REFERENCES and TRIGGER revoked from `authenticated`; `anon` holds SELECT only. Automated rows are written only by the service-role `log_automated_send` function and the webhook | Couples & Events |
| `questionnaire_templates` | ✅ | `user_id` | ✅ `tests/integration/rls/questionnaire-templates.test.ts` (6 tests) | Questionnaires |
| `couple_questionnaires` | ✅ | `user_id` | ✅ `tests/integration/rls/couple-questionnaires.test.ts` (8 tests — RLS + public RPC token gating + submit/double-submit) + `tests/integration/rls/portal-questionnaires.test.ts` (3 tests — portal RPC) | Questionnaires |
| `admin_audit_log` | ✅ (SELECT-only for admins via app_metadata; no write policies — Phase 13) | `actor_id` | ✅ `tests/integration/rls/admin-audit-log.test.ts` (8 tests) + `tests/integration/admin/audit-log-flow.test.ts` (3 tests — helper round-trip) | Admin |
| `couple_time_entries` | ✅ (owner, and the couple must be the writer's own; see the note below) | `user_id` | ✅ `tests/integration/couples/time-actions.test.ts` (10 tests: cross-tenant read/insert/update/delete denial, one-running-timer index, couple-delete cascade, category-delete set-null) | Couples & Events |
| `time_categories` | ✅ | `user_id` | ✅ `tests/integration/couples/time-actions.test.ts` (case-insensitive uniqueness plus cross-tenant denial) | Couples & Events |
| `bug_reports` | ✅ (owner SELECT/INSERT/UPDATE; no DELETE policy) | `user_id` | ✅ `tests/integration/rls/bug-reports.test.ts` (6 tests — cross-tenant read/update denial, forged `user_id` insert rejected, delete is a no-op, anon locked out) | Feedback |
| `couple_statuses` | ✅ | `user_id` | ✅ `tests/integration/rls/couple-statuses.test.ts` (Phase 4A, 5 tests) | Couples & Events |
| `lead_capture_forms` | ✅ | `user_id` | ✅ `tests/integration/lead-capture/rpc.test.ts` (12 tests, RLS isolation + `get_lead_form`/`submit_lead` token gating, cross-tenant ingest, status resolution, plan-limit, `p_source_origin` storage) + `tests/integration/lead-capture/route.test.ts` (16 tests, full `POST /api/lead/submit` error contract and per-form CORS allowlist, `OPTIONS` preflight) + `tests/integration/lead-capture/config-route.test.ts` (5 tests, `GET /api/lead/config` exact key set, disabled form, unknown/malformed token, wildcard CORS) + `tests/integration/lead-capture/load-config.test.ts` (4 tests, `loadLeadFormConfig` + `isOriginRegistered`; these two run against the service-role admin client, not the RLS-scoped anon client, so they exercise the config-read path rather than an RLS boundary) | Lead capture (ZEB-2 + Public API 2026-09-03) |
| `form_submissions` | ✅ | `user_id` | ✅ `tests/integration/lead-capture/form-submissions.test.ts` (3 tests, cross-tenant read denial, submission-to-couple link, custom-field folding + `get_lead_form` block tree). `source_origin` (added 2026-09-03) is exercised by the `p_source_origin` tests in `rpc.test.ts` above rather than a dedicated test in this file | Website form (block-based) |
| `couple_contacts` | ✅ | (join via `couple_id`, denorm `user_id`) | ✅ `tests/integration/rls/couple-contacts.test.ts` (Phase 4B, 4 tests) | Couples & Events |
| `event_contacts` | ✅ | (join via `event_id`, denorm `user_id`) | ✅ `tests/integration/rls/event-contacts.test.ts` (Phase 4C, 4 tests) | Couples & Events |
| `vendors` (legacy alias of contacts) | ✅ | `user_id` | ☐ | Contacts |
| `event_vendors` (legacy) | ✅ | (join) | ☐ | Contacts |
| `task_groups` | ✅ SELECT only (frozen 2026-09) | `user_id` | ✅ `tests/integration/workflows/legacy-frozen.test.ts` | Retired → Workflows |
| `task_statuses` / `task_priorities` / `task_types` | ✅ SELECT only (frozen 2026-09) | `user_id` | ✅ `tests/integration/workflows/legacy-frozen.test.ts` | Retired → Workflows |
| `automations` / `automation_actions` / `automation_runs` | ✅ SELECT only (frozen 2026-09) | `user_id` | ✅ `tests/integration/workflows/legacy-frozen.test.ts` | Retired → Workflows |
| `workflow_tags` | ✅ | `user_id` | ✅ `tests/integration/rls/workflows.test.ts` (10 tests, all seven tables) | Workflows |
| `workflow_templates` | ✅ | `user_id` | ✅ `tests/integration/rls/workflows.test.ts`; exit stages (save refused for another tenant, exits never cross tenants): `tests/integration/workflows/exit-rules.test.ts` | Workflows |
| `workflow_template_tags` | ✅ (checks **both** sides: template and tag ownership) | (join) | ✅ `tests/integration/rls/workflows.test.ts` | Workflows |
| `workflow_template_steps` | ✅ (+ parent-ownership via `_owns_workflow_template_or_null`) | (via template) | ✅ `tests/integration/rls/workflows.test.ts` | Workflows |
| `workflow_instances` | ✅ (+ parent-ownership on `couple_id` and `template_id`) | `user_id` | ✅ `tests/integration/rls/workflows.test.ts`; cancel, pause and resume actions: `tests/integration/workflows/instance-cancel.test.ts` | Workflows |
| `workflow_steps` | ✅ (via instance ownership) | (via instance) | ✅ `tests/integration/rls/workflows.test.ts` + `tests/integration/portal/milestones.test.ts` (a `visible_to_couple` step is still owner-only to a signed-in MC; the RPC is the only door) + `tests/integration/workflows/done-list.test.ts` (the Done list and its count are both scoped to the caller) | Workflows |
| `workflow_audit_log` | ✅ (SELECT-only for owner; service-role writes) | `user_id` | ✅ `tests/integration/rls/workflows.test.ts` | Workflows |
| `workflow_conversion_ledger` | ✅ RLS enabled, no policy — migrations + service role only | — | ✅ `tests/integration/workflows/converter.test.ts` (16 tests) | Workflows |
| `workflow_dispatched_events` | ✅ RLS enabled, no policy — service role only | — | ☐ (retired dual-run guard, kept for rollback) | Workflows |
| `timeline_items` | ✅ | `user_id` | ✅ `tests/integration/rls/timeline-items.test.ts` (Phase 4C, 5 tests) + `tests/integration/timeline/public-timeline-rpc.test.ts` (Phase 10 — public RPC guards) | Timeline |
| `portal_files` | ✅ | `user_id` | ✅ `tests/integration/rls/portal-files.test.ts` (Phase 4D, 4 tests) | Client Portal |
| `portal_people` | ✅ | `user_id` | ✅ `tests/integration/rls/portal-people.test.ts` (Phase 4D, 5 tests) | Client Portal |
| `portal_songs` | ✅ | `user_id` | ✅ `tests/integration/rls/portal-songs.test.ts` (Phase 4D, 7 tests — also covers `portal_song_categories`) | Client Portal |
| `portal_song_categories` | ✅ | `user_id` | ✅ `tests/integration/rls/portal-songs.test.ts` (Phase 4D) | Client Portal |
| `scripts` | ✅ (owner on every verb; insert/update also require the couple to be the writer's own) | `user_id` | ✅ `tests/integration/rls/scripts.test.ts` (10 tests: cross-tenant read/update/delete denial, foreign-couple insert and re-parent rejected, forged `user_id` rejected, anon locked out, couple-delete cascade) | Couples & Events |
| `stripe_customers` | ✅ (RLS enabled, no policy — service-role only) | `user_id` | ✅ `tests/integration/rls/payments-tables.test.ts` (Phase 2C) | Payments |
| `stripe_events` | ✅ (RLS enabled, no policy — service-role only, Phase 2A) | n/a (system-global) | n/a | Payments |
| `user_branding` | ✅ | `user_id` | ✅ `tests/integration/rls/user-branding.test.ts` (Phase 11, 5 tests) + `tests/integration/branding/user-branding-helper.test.ts` (Phase 11, 4 tests — `_user_branding` helper) + `tests/integration/branding/user-branding-rls.test.ts` (cross-tenant denial + RPC scoping, 4 tests) | Branding |
| `storage.objects` (`proposal-media` bucket) | ✅ (public read; insert/update/delete require the object's first path segment `= auth.uid()`) | path prefix (`<user_id>/…`) | ✅ `tests/integration/rls/proposal-media-storage.test.ts` (5 tests: owner upload, cross-tenant upload denial, anon public read, cross-tenant delete denial, owner delete) | Proposals Engine Phase B |
| `user_public_settings` | ✅ | `user_id` | ✅ `tests/integration/rls/user-public-settings.test.ts` (5 tests — cross-tenant read/update/insert denial incl. encrypted OAuth tokens + global subdomain uniqueness) + `tests/integration/workflows/account-pause.test.ts` (the account-wide workflow stop columns: another MC can neither read, update nor upsert them) | Settings — Public Page |
| `calendar_connections` | ✅ | `user_id` | ✅ `tests/integration/rls/calendar-connections.test.ts` (cross-tenant read/update/delete denial incl. encrypted tokens) | Scheduler Phase A |
| `meeting_types` | ✅ | `user_id` | ✅ `tests/integration/rls/scheduling-tables.test.ts` (Scheduler Phase B: cross-tenant read/insert/update/delete denial) | Scheduler Phase B |
| `availability_rules` | ✅ | `user_id` | ✅ `tests/integration/rls/scheduling-tables.test.ts` (Scheduler Phase B) | Scheduler Phase B |
| `availability_overrides` | ✅ | `user_id` | ✅ `tests/integration/rls/scheduling-tables.test.ts` (Scheduler Phase B) | Scheduler Phase B |
| `meeting_type_availability_rules` | ✅ | `user_id` + `_owns_meeting_type(meeting_type_id)` on write | ✅ `tests/integration/rls/scheduling-tables.test.ts` (cross-tenant read/insert/update/delete denial, cross-parent insert denial, cascade on parent delete) | Per-type availability |
| `automations` | ✅ | `user_id` | ✅ `tests/integration/automations/run-now.test.ts` (cross-tenant: cannot manually run another MC's automation) | Automations |
| `automation_events` | ✅ (SELECT-only; writes via SECURITY DEFINER RPC + service-role) | `user_id` | ✅ exercised by `run-now.test.ts` (manual-fire event opens only the owner's run) | Automations |
| `automation_actions` | ✅ | `automation_id` (→ `automations.user_id`) | ✅ exercised by `run-now.test.ts` | Automations |
| `automation_runs` | ✅ | `user_id` | ✅ `tests/integration/automations/run-controls.test.ts` (cross-tenant retry/cancel/pause/resume are no-ops) | Automations |
| `automation_waits` | ✅ | `user_id` | ✅ `tests/integration/automations/run-controls.test.ts` (cancel consumes; resume reads — exercised via the control actions) | Automations |
| `automation_audit_log` | ✅ (SELECT-only for owner; writes service-role) | `user_id` | ☐ (read RLS-scoped by the couple Automations feed) | Automations |
| `proposals` | ✅ (+ owner `exists` checks in `with check` on every pointer: `couple_id`, `event_id`, `contract_id`, `invoice_id`, `contract_template_id`, `payment_schedule_id`) | `user_id` | ✅ `tests/integration/rls/proposals.test.ts` (8 tests: owner read with options/items, cross-tenant SELECT/UPDATE/DELETE denial, forged `user_id` insert rejected, insert and update spoofing another MC's `couple_id` rejected) + `tests/integration/rls/proposals-pointers.test.ts` (update pointing `contract_id` / `invoice_id` / `contract_template_id` / `payment_schedule_id` at another MC's row rejected; own rows accepted) | Proposals |
| `proposal_options` | ✅ (+ parent-ownership via `_owns_proposal` in `with check`) | `user_id` | ✅ `tests/integration/rls/proposals.test.ts` (cross-tenant option-to-proposal attach rejected) | Proposals |
| `proposal_option_items` | ✅ (+ parent-ownership via `_owns_proposal_option` in `with check`) | `user_id` | ✅ `tests/integration/rls/proposals.test.ts` (cross-tenant item-to-option attach rejected) | Proposals |
| `proposal_events` | ✅ (+ parent-ownership `exists` check on `proposal_id` in `with check`) | `user_id` | ✅ `tests/integration/rls/proposal-events.test.ts` (4 tests: owner read / cross-tenant read denial, cross-tenant insert spoofing `proposal_id` rejected, anon direct read/insert denial, owner delete cascades with the proposal) | Proposals Phase D |
| `proposal_templates` | ✅ | `user_id` | ✅ `tests/integration/rls/proposal-templates.test.ts` (5 tests: owner read/update, owner delete, cross-tenant SELECT/UPDATE/DELETE denial, cross-tenant forged-`user_id` insert rejected, anon locked out, one-default-per-user unique-index refusal) | Proposal Layout v2 Phase 1 |
| `proposal_settings` | ✅ | `user_id` | ✅ `tests/integration/rls/proposal-settings.test.ts` (1 test: owner read/update, cross-tenant read/update/delete denial, cross-tenant forged-`user_id` insert rejected, anon locked out) | Proposal Layout v2 Phase 1 |
| `system_heartbeats` | RLS on, no policies (service only) | n/a | `tests/integration/cron/scheduler.test.ts` | Scheduler (R1) |
| `scheduler_leases` | RLS on, no policies (service only) | n/a | `tests/integration/workflows/tick-lease.test.ts` (6 tests: grants to the first caller and refuses the second; lets the next minute's tick in once the previous run released; refuses a release from a run that does not hold it; grants again once expired; an expired run cannot release its successor; `anon` and `authenticated` are refused EXECUTE on both functions) | Workflows trust remediation |
| `mfa_recovery_codes` | ✅ RLS on, no policies, every `anon`/`authenticated` grant revoked (service role only; not even the owner can read the hashes); writers `replace_mfa_recovery_codes` / `spend_mfa_recovery_code` are service-role-only `security invoker` functions | `user_id` | ✅ `tests/integration/rls/mfa-recovery-codes.test.ts` (22 tests: owner, other tenant and anon each refused SELECT/INSERT/UPDATE/DELETE; client roles refused both functions with 42501; plain codes never stored; a code spends once, only for its owner; one winner per batch, including two concurrent redemptions of the same code and of different codes; a released code works again; re-issue voids earlier codes; two concurrent issues leave ten codes; a real verified TOTP factor removed via the admin API) | Account security floor (Phase 4 Task 23) |
| `admin_shadow_sessions` | ✅ RLS on, no policies, every `anon`/`authenticated` grant revoked (service role only); the MC has no read path at all (`my_support_access()` dropped in `20261024800000`, owner ruling 2026-09-27) | `target_user_id` (and `admin_id`) | ✅ `tests/integration/admin/shadow-mutation-log.test.ts` (21 tests: a real shadow session's insert/update/delete each write a `shadow_mutation` row naming admin and MC with ids only; knock-on trigger rows not logged (knock-on row asserted to exist); RPC writes logged; primary-key `row_id` for id-less tables; writes after exit or expiry logged with `after_end` and the alert throttle stamped; `auth.users` metadata change logged by key name with `sensitive`, values never stored; 2FA enrolment logged; no rows for normal sessions, other tenants, a mismatched target, or account changes with no open session; the MC is refused SELECT/INSERT/UPDATE on the table, sees no `admin_audit_log` rows, and cannot call the internal functions; a shadowed MC cannot read their own visits by any route while the internal record holds them; after exit an `app_metadata` change is never attributed; during a session a service-role `app_metadata` change is logged) + `tests/integration/admin/shadow-session-revoke.test.ts` (10 tests: the revoked target refresh token no longer refreshes while the MC's other session does; a global sign-out with the revoked token cannot end other sessions; the tick sweep deletes an expired or unrevoked-ended shadow session's auth session, stamps it, stops attributing the MC's later edits, leaves open sessions and the MC's other session alone, and is refused to an MC; middleware with a signed matching marker and no grant revokes the session and redirects to /login; an unsigned marker equal to the session id, or a marker for another session, does nothing) + `tests/integration/admin/shadow-trigger-coverage.test.ts` (6 tests: trigger on every public base table minus an allowlist, every public table has RLS on, a scratch non-RLS table is caught and fixed by `ensure_shadow_triggers()`, auth triggers present, function ACLs) | Account security floor (Phase 4 Task 25) |
| `email_suppression` | ✅ (SELECT/INSERT/DELETE owner-isolated; no UPDATE policy, since a suppression row is a fact, cleared by deleting it) | `user_id` (keyed with `email`, not `couple_id`; see `database-schema.md`) | ✅ `tests/integration/email/suppression.test.ts` (10 tests: owner read-back, cross-tenant SELECT/DELETE denial, forged `user_id` insert rejected, anon locked out, owner can clear their own row, case-insensitive unique index rejects a case-variant duplicate, distinct reasons for the same address are separate rows clearable independently, plus `couples.do_not_email` default + owner round-trip) | Email legal floor (Phase 2 Task 10) |
| *every public RLS table*: `require_mfa` | ✅ RESTRICTIVE, `for all to authenticated`, `using`/`with check ((select public.mfa_satisfied()))`; attached by `ensure_require_mfa_policies()` | n/a (checks the session, not the row) | ✅ `tests/integration/rls/require-mfa.test.ts` (19 tests: a 2FA MC at `aal1` reads zero rows, insert refused 42501, update/delete touch nothing, guarded RPCs raise 42501, Storage upload refused, a private-bucket object can be neither downloaded nor listed, token RPC still works; the same MC at `aal2` reads, writes, calls RPCs and uploads; a no-factor MC, and an MC with only an unverified (mid-enrolment) factor, are unaffected at `aal1`; an open shadow session is waived and loses it at Exit and at the admin's demotion; an expired one, a row for another session, and a row for this session with another target are not waived; anon token RPC and service role unaffected) + `tests/integration/rls/require-mfa-coverage.test.ts` (13 tests: policy on every RLS table and `storage.objects` with the exact expression, a scratch table caught and fixed idempotently, a permissive or loosened (`... or true`) same-named policy replaced, function ACLs, every client-executable definer function guarded as its first statement or allowlisted with a reason, and only known allowlisted functions read the caller identity) | Account security floor (Phase 4 Task 23b) |
| `storage.objects`: `require_mfa` | ✅ same restrictive policy, attached once by `20261019000000`; the deploy step warns if it is missing | n/a | ✅ `require-mfa.test.ts` (upload refused at `aal1` for a 2FA MC, allowed at `aal2` and for a no-factor MC; private `email-template-files` object unreadable and unlisted at `aal1`, readable at `aal2`) | Account security floor (Phase 4 Task 23b) |

**Four tables need more than `auth.uid() = user_id` in WITH CHECK.**
Foreign keys are checked with elevated privileges and ignore RLS, so an
owner-only policy still lets a user write a row that *references* another
tenant's row. That both links across tenants and confirms the referenced id
exists. Any new table with an FK to an owned parent has to carry the parent
check too:

| Table | Extra WITH CHECK | Migration |
|---|---|---|
| `couple_time_entries` | inline `exists` on `couples` | `20260730120000` |
| `couples` | `_owns_package_or_null(selected_package_id)` | `20260820010000` |
| `meeting_type_availability_rules` | `_owns_meeting_type(meeting_type_id)` | `20260821010000` |
| `bookings` | `_owns_couple_or_null(couple_id)` and `_owns_meeting_type(meeting_type_id)` | `20260821040000` |

`bookings` was missed when the table was created: the public booking RPCs are
`security definer` and resolve both parents from the share token themselves,
so nothing in the couple-facing flow depended on the policy and the gap only
showed on a direct authenticated write. The original instance follows.

**`couple_time_entries` WITH CHECK is not just `auth.uid() = user_id`.**
Foreign keys ignore RLS, so an owner-only check still let a user insert a
row pointing at *another* MC's `couple_id`, meaning their own timesheet
referencing someone else's couple. The policy therefore also requires `exists (select 1 from
couples c where c.id = couple_id and c.user_id = auth.uid())`. The
integration test above asserts the denial; it was found by that test, not
by review.

**Connect-your-own-mailbox (OAuth) controls** (Settings → Public Page →
Email; routes `app/api/oauth/{authorize,callback}`): the Gmail/Outlook
OAuth refresh + access tokens are encrypted at rest with AES-256-GCM
(`lib/crypto/secret-box`, key `EMAIL_CRED_KEY`), never selected back to
the client, and decrypted only server-side at send/refresh time. The
authorize→callback flow is CSRF-protected by a random `state` pinned in a
signed httpOnly cookie and re-checked on callback; the callback binds the
tokens to the MC via their existing Supabase session. Both routes are
per-user rate-limited; `disconnectMailboxAction` best-effort revokes at
the provider. At send time a connection that is dead for good (a refresh
answering `invalid_grant`, or a stored token that no longer decrypts) is
flipped to `oauth_status = 'failed'` and alerted (`mailbox_disconnected`);
a transient failure errors an automated step rather than switching it to
the shared address (Phase 5 fix wave, M7). Scopes are minimal (Google `gmail.send` send-only; Microsoft
`Mail.Send`).

The Templates starter-add server actions (`addStarterPackagesAction`,
`addStarterInvoiceTemplatesAction`, `addStarterContractsAction`) are Zod-validated, run through the
RLS-scoped server client, resolve content server-side by name (the client
never sends body/amount data), skip names the MC already owns, and flag
inserted rows `is_starter`. Behaviour covered by
`tests/integration/templates/starter-actions.test.ts` (6 tests).

**Email-template editor surfaces** (Templates → Emails, 2026-07):

- Category CRUD (`category-actions.ts`) — Zod-validated, RLS-scoped;
  `createTemplateAction` / `updateTemplateAction` verify `category_id`
  ownership with an RLS read (`ownCategoryId`) before writing, since the
  FK alone proves existence, not ownership. Foreign ids degrade to null.
- Test send (`test-send-action.ts`) — the recipient is **always the
  session user's own email** (never client-supplied, so the action can't
  relay), rate-limited 5/min per user, Zod on input, `[Test]` subject
  prefix, never logged to `couple_emails`.
- Attachments (`attachment-actions.ts`) — the binary uploads browser →
  private bucket (RLS path policies + 25 MB / MIME enforcement at the
  bucket); the metadata action derives the storage path server-side from
  the session user + validated ids and gates on template ownership.
  Draft uploads (unsaved template) register with `template_id` null
  under `{user}/drafts/`; `linkTemplateFilesAction` re-parents only
  **unlinked** rows after re-checking target-template ownership, and
  the editor deletes drafts on discard. Deleting removes object then
  row. A failed register rolls the orphaned object back client-side.

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
