# Zebri Database Schema

Database: Postgres (Supabase)

The schema is intentionally **simple for the MVP CRM**.

------------------------------------------------------------------------

# Conventions

- **Every public table has RLS on and the shadow-mutation trigger**
  (Phase 4 Task 25). End any migration that creates a `public` table
  with:

  ```sql
  select public.ensure_shadow_triggers();
  ```

  It attaches `zz_log_shadow_mutation` (AFTER INSERT OR UPDATE OR DELETE,
  FOR EACH ROW, `WHEN (pg_trigger_depth() = 0)`) to every public base
  table except `admin_audit_log` and `admin_shadow_sessions`, and is
  idempotent. The deploy workflows also run it after `db push`. It is
  what records a write made while an admin is shadowing the MC (see
  `admin_shadow_sessions` below and `shadow-mode.md`). The ratchet
  `tests/integration/admin/shadow-trigger-coverage.test.ts` fails when
  any public table lacks the trigger or has RLS off.

- **Every public RLS table carries the `require_mfa` restrictive policy**
  (Phase 4 Task 23b). End any migration that creates a `public` table
  with RLS on with:

  ```sql
  select public.ensure_require_mfa_policies();
  ```

  It attaches `require_mfa` (`as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check (...)`) to every
  public table with RLS on that lacks a correct one, and is idempotent.
  The deploy workflows also run it after `db push`. Without it, a 2FA
  MC's password-only (`aal1`) session could read and write the new
  table directly. Ratchet: `tests/integration/rls/require-mfa-coverage.test.ts`.

- **Every `SECURITY DEFINER` function that `authenticated` can execute
  is guarded or allowlisted** (Task 23b). Definer functions bypass RLS,
  so `require_mfa` never reaches them. A definer RPC that acts for
  `auth.uid()` starts with:

  ```sql
  if not public.mfa_satisfied() then
    raise exception using errcode = '42501', message = 'second factor required';
  end if;
  ```

  A token-gated public RPC (never acts for the signed-in MC), a trigger
  function, or a service-role-only function (EXECUTE revoked from
  `anon, authenticated`; `grant ... to service_role` alone is not
  enough, because Supabase's default privileges grant EXECUTE on new
  functions to both) goes on the allowlist in
  `require-mfa-coverage.test.ts` with its reason instead. The test fails
  on any definer function that is neither.

------------------------------------------------------------------------

# User Data

There is no `users` table. User data is stored on the Supabase Auth
user row in **two** metadata bags:

- **`user_metadata`** — user-writable (`auth.updateUser({ data })`).
  Holds user-owned fields (display name, business name, bank details,
  branding, etc.). The bank details and ABN are the exception: only
  `set_my_payment_details` may change them (see below).
- **`app_metadata`** — **server-only writable**, JWT-readable. Holds
  all entitlement fields (`account_type`, `subscription_*`,
  `stripe_*`, `is_beta_user`). The §7.4 / Phase 0.8b fix moved these
  out of `user_metadata` to close the privilege-escalation surface.

**Payment details are write-locked (Task 23c,
`20261022000000_lock_payment_details.sql`).** Four `user_metadata`
keys are protected: `bank_account_name`, `bank_bsb`,
`bank_account_number`, `abn`. They stay in `user_metadata` for every
reader, but:

- the `lock_payment_details` BEFORE UPDATE trigger on `auth.users`
  (`WHEN old.raw_user_meta_data is distinct from new.raw_user_meta_data`)
  raises 42501 "payment details can only be changed from Settings" when
  a protected key's value changes and the transaction-local GUC
  `zebri.payment_details_write` is not `on`. Absent, JSON null and `""`
  are the same "not set". Resending the keys unchanged passes.
- `public.set_my_payment_details(p_details jsonb) returns jsonb` is the
  only writer: SECURITY DEFINER, `search_path ''`, EXECUTE for
  `authenticated` only, first statement the `mfa_satisfied()` guard.
  `p_details` is partial (only the keys present change; null or `""`
  removes the key; any other key is 22023). A CHANGED value must match
  its shape once spaces and hyphens are removed (BSB 6 digits, account
  number 4 to 10 digits, ABN 11 digits; account name at most 200
  characters), else 22023. Stored trimmed, as typed. Returns
  `{bank_account_name, bank_bsb, bank_account_number, abn}`.
- `20261022100000` (fix round 1): the RPC trims every kind of
  whitespace (not only spaces); an `abn` change through a shadow session
  is sensitive in `log_shadow_auth_user_change`; the migration fails if
  its role cannot UPDATE `auth.users`; `get_public_invoice` and
  `get_public_proposal` read `stripe_connect_enabled` from
  `raw_app_meta_data` when it carries the `account_type` sentinel (else
  the legacy `raw_user_meta_data` copy), compared as text to `'true'` so
  a non-boolean is false instead of an error.
- No service-role path writes these keys, so there is no service-role
  overload; GoTrue's admin API is refused too. A hand fix sets
  `select set_config('zebri.payment_details_write', 'on', true);` in the
  same transaction as its UPDATE.

Read entitlements via `@/lib/auth/entitlements`, never directly from
either bag. Writes go through `updateEntitlements()` (server-only).
See `.claude/docs/authentication.md` for the full schema of both bags
and the migration mechanics (backfill migration + `sync_signup_app_
metadata_on_insert` trigger).

**Branding fields (stored in `user_metadata`, user-owned):**

Scalars returned by `_user_branding(uuid)` and merged into public RPCs. Migration `20260715000000_branding_editor_redesign.sql` extended the function with typography + layout fields. Migration `20260718100000_branding_colours.sql` replaced the old colour model with a role-based system: six user-set colours (heading, subheading, body, background, primary button, secondary button, plus link for the editor) with derived aliases for backward compatibility.

**user_branding table** (Branding overhaul, Phase 11 onwards). One row per user, RLS-owned, stores the block tree + surface configuration for the branding editor. Columns: `user_id` (PK, FK auth.users cascade), `branding_blocks` (jsonb, keyed by surface: `invoice`, `contract`, `portal`, `vendorTimeline`, `questionnaire`, `lead`, `proposal`), `enabled_surfaces` (jsonb, default now includes `proposal` as of `20260924000000_proposal_surface.sql`  -  see Proposals Phase B below), `proposal_role` (text, null; check `mc | celebrant | both`; set by the proposal branding tab's first-open role chooser, Phase B), `onboarded_at` (timestamptz, null until first save), `created_at`, `updated_at`.

Surface-level reset: setting a surface's block tree to an empty array disables public render (the get_public_* RPCs treat it as null). `enabled_surfaces` tracks which surfaces the MC has opted into. The stored value has held three shapes over time (jsonb array column default, legacy true-only map, current explicit-boolean map); `lib/branding/enabled-surfaces.ts` (`resolveEnabledSurfaces` / `buildEnabledSurfacesMap`) is the single read/write path. A missing `lead` key resolves to enabled (the surface postdates the older shapes), so existing rows show the Website form tab by default; saves write an explicit boolean for every surface so a deliberate disable persists.

| Field | Type | Default | Notes |
|---|---|---|---|
| `logo_url` | text | null | Supabase Storage URL for MC logo |
| `favicon_url` | text | null | Favicon URL |
| `header_image_url` | text | null | Header banner background image |
| `heading_color` | text | `#111827` | Role-based: headings on all surfaces (h1, h2, etc) |
| `subheading_color` | text | `#111827` | Role-based: secondary headings and section titles |
| `text_color` | text | `#6B7280` | Role-based: body copy and regular text |
| `surface_color` | text | `#FFFFFF` | Role-based: page background and surface fills |
| `brand_color` | text | `#111827` | Role-based: primary CTAs (main buttons) |
| `secondary_color` | text | `#6B7280` | Role-based: secondary CTAs (supporting buttons) |
| `link_color` | text | `#111827` | Hyperlink colour (editor-only control; defaults to brand_color) |
| `accent_color` | text | (derived) | DERIVED ALIAS: `accent_color ≡ brand_color`. No longer user-set; remove from onboarding. |
| `muted_color` | text | (derived) | DERIVED ALIAS: `muted_color ≡ text_color`. No longer user-set; used for metadata/labels/column headers. |
| `secondary_text_color` | text | (derived) | DERIVED ALIAS: computed via `getTextColor(secondary_color)` at render sites. Kept in payload for back-compat. |
| `page_background` | text | (derived) | DERIVED ALIAS: `page_background ≡ surface_color`. No longer user-set. |
| `tagline` | text | null | Business tagline, max 80 chars |
| `abn` | text | null | Australian Business Number |
| `show_contact_on_documents` | boolean | true | Show phone/website/socials on public pages |
| `font_heading` | text | `inter` | Heading font ID (from FONT_IDS catalogue) |
| `font_body` | text | `inter` | Body font ID |
| `font_weight` | int | 600 | Heading font weight |
| `font_body_weight` | int | 400 | Body font weight |
| `font_scale` | numeric | 1 | Global font multiplier (deprecated in favour of explicit px sizes) |
| `heading_size` | int | 32 | Heading base size in px |
| `body_size` | int | 15 | Body base size in px |
| `heading_case` | text | `none` | Heading text transform (none, uppercase, capitalize) |
| `body_case` | text | `none` | Body text transform |
| `heading_letter_spacing` | int | 0 | Heading letter spacing in px |
| `body_line_height` | numeric | 1.5 | Body line height multiplier |
| `button_variant` | text | `fill` | Default button style (fill, outline) |
| `button_size` | text | `md` | Default button size (sm, md, lg) |
| `button_radius` | int | 8 | Button corner radius in px |
| `corner_radius` | int | 12 | Global corner radius in px (applied to blocks) |
| `section_spacing` | int | 32 | Space between blocks in px |
| `doc_padding` | int | 0 | Extra horizontal inset on documents |
| `density` | text | `cozy` | Vertical spacing preset (cozy/compact) — read-only (frozen to baseline) |
| `theme_preset` | text | `minimal` | Theme key (for legacy compatibility) |

These extend the existing fields `business_name`, `phone`, `website`, `instagram_url`, `facebook_url`, and new social fields `twitter_url`, `pinterest_url` (read from `auth.users.raw_user_meta_data` at render time by `_user_branding()` RPC; users edit them in Settings). Added migration `20260723000000_branding_social_urls.sql` extended the function to expose these three URLs for footer social-link rendering.

**Email fields (stored in `user_metadata`, user-owned):**

| Field | Type | Default | Notes |
|---|---|---|---|
| `mc_signature_name` | text | null | Typed signature name rendered on contracts |
| `email_signature` | TipTap JSON | null | Reusable email signature (rich text, Gmail/Outlook-style, no variables inside it), edited in Settings → Signature. Surfaced to templates via the `{{mc.signature}}` variable: rich HTML in a body, flattened text in a subject. |

**Address fields (stored in `user_metadata`, user-owned):**

| Field | Type | Notes |
|---|---|---|
| `address_text` | text | Full address string selected via Google Places autocomplete |
| `address_lat` | number | Latitude of MC's home address |
| `address_lng` | number | Longitude of MC's home address |

Used to calculate `drive_time_from_home_seconds` on events.

All CRM tables include a `user_id` column (uuid, not null) referencing `auth.users.id` for row-level security.

------------------------------------------------------------------------

# couples

Incoming enquiries from couples.

Columns:

id (uuid) user_id (uuid, not null) name (text) email (text) phone (text) event_date (date) venue
(text) notes (text) status (text)

Partner contact triples (added 2026-06-03, `add_couple_partner_contacts`):

primary_name (text) primary_email (text) primary_phone (text)
secondary_name (text) secondary_email (text) secondary_phone (text)

**The couple modal writes only the `primary_*` / `secondary_*` triples** — the
legacy `name`-level `email` / `phone` columns are kept for old API contracts
(pre-migration rows were backfilled into `primary_*`) but stay **empty** for
couples created through the new flow. Anything that emails a couple must
resolve the address via `resolveCoupleEmail()` in `lib/couples/email.ts`
(primary_email first, legacy email fallback) — never read `couples.email`
directly. The automations couple snapshot (`loadCoupleSnapshot`) applies the
same precedence for phone and partner names.

Status values: stored as custom couple status slug (e.g. 'new', 'contacted', 'confirmed', 'paid', 'complete'). See couple_statuses table for user-defined statuses.

lead_source (text, nullable)

Lead source values: referral website social_media word_of_mouth wedding_expo venue_partner. Set automatically to 'website' for couples created by the lead-capture form (ZEB-2).

referral_source (text, nullable)

"How did you hear about me" answer. Free text captured by the lead-capture form (ZEB-2) and editable on the couple modal; distinct from lead_source.

source_origin (text, nullable), added by the Lead Capture API migration (2026-09-03, `20260903100000_lead_capture_api.sql`). The browser origin (scheme://host[:port]) the enquiry was posted from. Server-computed by `POST /api/lead/submit`: the request's `Origin` header for a third-party site's post, or the embed's own referrer reduced to an origin when the post is same-origin (hosted page, iframe embed). Null for server-side posts. Read-only in the app; the couple Overview shows it as an "Enquiry from" row (`couple-source-origin-row.tsx`) only when set.

created_at (timestamp)

do_not_email (boolean, not null, default false) do_not_email_at (timestamptz, nullable), added by the email legal-floor migration (Phase 2 Task 10, 2026-09-23, `20261004000000_email_optout_and_suppression.sql`). Denormalised opt-out flag mirroring this couple's stored email against `email_suppression` (below), so the couple UI and the send path can check one boolean without a join. Not the source of truth: `email_suppression` is. Flipped true by the two unsubscribe routes (the page's confirm form and the RFC 8058 one-click `POST /api/unsubscribe/[token]`, both through `lib/email/record-unsubscribe.ts`), on every couple of the owner whose stored `email` is the unsubscribed address (compared ignoring case and surrounding whitespace, never as an ILIKE pattern). The Resend bounce/complaint webhook writes `email_suppression` only and does NOT flip this flag; the send path checks both, so a bounced address is still never mailed. The flag stops automated mail to the couple's own addresses (primary and spouse) only; their vendors' copies are governed by address-level suppression alone. The column comment in `20261004000000` still says the webhook keeps it in sync; `20261006100000` corrects it.

------------------------------------------------------------------------

# email_suppression

Addresses an MC must never email again, and why. The source of truth for
the "don't send" decision; `couples.do_not_email` (above) is a fast,
denormalised mirror of this table for the couple's current address, not
the other way around.

Keyed on `(user_id, email)`, not `couple_id`, and carries no couple_id
column at all; see the migration's own comment for the full reasoning.
Short version: the same address can belong to more than one couple, and a
couple can change their stored address, so a couple-keyed suppression
would stop protecting an address the moment the couple record changed, or
miss the same address recurring under a different couple. Suppression is
a property of the address as the MC's mailing list sees it.

RLS: owner-isolation (`auth.uid() = user_id`) on SELECT/INSERT/DELETE, no
UPDATE policy, since a suppression row is a record of something that
happened, not a draft to edit; clearing one means deleting it. Expected writers
(the public unsubscribe endpoint and the provider bounce/complaint
webhook, both later tasks) run as the service role and bypass RLS.

Columns:

id (uuid) user_id (uuid, not null, FK auth.users on delete cascade)
email (text, not null) reason (text, not null, check in
`unsubscribed` / `bounced` / `complained`) created_at (timestamptz, not
null, default now())

Unique index `email_suppression_user_email_reason_idx` on
`(user_id, lower(email), reason)`, case-insensitive on the address, and
one row per reason so an MC can clear a stale `bounced` row without
clearing a `complained` one for the same address, and a duplicate
webhook delivery collides into the same row instead of creating a second
one. Added by Phase 2 Task 10
(`20261004000000_email_optout_and_suppression.sql`).

The address is stored AS TYPED, not lower-cased, so the row shows the MC
exactly what the provider or the unsubscribe click reported. That means
the index is the only thing normalising case, and an index constrains
what can be inserted, it does not change how a `SELECT` compares. Read
the suppression list through
`public.is_email_suppressed(p_user_id uuid, p_email text) returns
boolean` (`20261006000000_is_email_suppressed_function.sql`), never
through a PostgREST `.eq('email', ...)` filter, which is case-sensitive
and will miss `Sarah@Example.com` against a stored `sarah@example.com`.
The function compares case-insensitively and ignoring surrounding
whitespace (`lower(btrim(email, ' \t\r\n'))` on both sides, since
`20261006100000_is_email_suppressed_trim_search_path.sql`; before that it
folded case only), scoped to `user_id`, so the index's leading `user_id`
column narrows the scan to one tenant's list. It is `security invoker`
(RLS still applies to an authenticated caller), has
`set search_path = public` (also since `20261006100000`), and `execute`
is revoked from `public` and `anon`.

------------------------------------------------------------------------

# mfa_recovery_codes

One-time recovery codes for two-factor sign-in (Phase 4 Task 23,
`20261013000000_mfa_recovery_codes.sql`). Supabase Auth has TOTP factors
but no recovery codes, so Zebri keeps its own: ten per MC, issued when
they turn 2FA on (and again from "New recovery codes", which deletes every
earlier row), shown once, stored only as a salted hash.

Service role only. RLS is on with **no policies**, and every grant to
`anon` and `authenticated` is revoked, so not even the owner can read or
write their rows through the client: a readable hash could be brute
forced offline, and a client insert would let someone holding only the
password mint a code they know. The only reader and writer is
`lib/auth/recovery-codes.ts`, called from the Settings two-factor actions
and the recovery-code server action.

Columns:

id (uuid, pk, default gen_random_uuid()) user_id (uuid, not null, FK
auth.users on delete cascade) salt (text, not null; hex, 16 random bytes,
unique per code) code_hash (text, not null; hex scrypt output of the
normalised code) created_at (timestamptz, not null, default now())
used_at (timestamptz, nullable; set once when the code is redeemed)

Index `mfa_recovery_codes_user_id_idx` on `(user_id)`.

Writers (service role only, `security invoker`, `set search_path = ''`,
EXECUTE revoked from `public`, `anon` and `authenticated`; invoker because
the only caller already has table DML, so a stray EXECUTE grant would still
meet the table's revoked grants; both take a per-user transaction advisory
lock, since a user with no rows yet has nothing to row-lock):

- `replace_mfa_recovery_codes(p_user_id uuid, p_codes jsonb) returns
  integer`: deletes the user's rows and inserts the given
  `[{salt, code_hash}]` batch in one transaction; returns the count.
- `spend_mfa_recovery_code(p_user_id uuid, p_code_id uuid) returns
  boolean`: false if any row of the user is already used (one winner per
  batch, so two concurrent redemptions with different codes cannot both
  proceed), else marks `p_code_id` used if it is unused.

After a successful redemption the TOTP factor is removed and the
remaining unused rows are deleted; the spent row stays as a record. If
removing the factor fails, the app clears that row's `used_at` so the
MC can retry with the same code.

------------------------------------------------------------------------

# admin_shadow_sessions

One row per admin shadow session (Phase 4 Task 25,
`20261015000000_admin_shadow_sessions.sql`), keyed by the Supabase JWT
`session_id` claim of the session `enterShadow` minted for the target.

Columns:

id (uuid, pk) session_id (uuid, not null, unique; the target session's
JWT `session_id`, deliberately no FK since `auth.sessions` rows vanish on
sign-out) admin_id (uuid, not null, FK auth.users on delete cascade,
matching `admin_audit_log.actor_id`) target_user_id (uuid, not null, FK
auth.users on delete cascade) started_at (timestamptz, default now())
expires_at (timestamptz, default now() + 8 hours, the shadow grant's TTL)
ended_at (timestamptz, nullable; stamped by a genuine `exitShadow`)
after_end_alerted_at (timestamptz, nullable; last Slack alert for a write
after end or expiry, throttles it to hourly; `20261017000000`).
Checks: `admin_id <> target_user_id`, `expires_at > started_at`.

Indexes: partial `admin_shadow_sessions_open_idx` on `(session_id)
include (admin_id, target_user_id, expires_at) where ended_at is null`
(the "is this JWT an open shadow session" lookup, for the trigger and
Task 23b's aal2 waiver); `(target_user_id, started_at desc)`;
`(admin_id)`. Plus `admin_audit_log_shadow_activity_idx` on
`admin_audit_log (target_user_id, (details->>'shadow_session_id')) where
action in ('shadow_mutation', 'shadow_request')` (`20261018000000`; it
replaced `admin_audit_log_shadow_session_idx`). It served the MC card's
count, dropped with `my_support_access()` in `20261024800000`; the index
is kept for admin reads of one visit's activity.

Access: RLS on, **no policies**, every `anon`/`authenticated` grant
revoked. Written only by the service role (`lib/admin/shadow-sessions.ts`
from `enterShadow` / `exitShadow`).

Functions:

All below are `security definer`, `search_path = ''`, EXECUTE revoked
from `public`/`anon`/`authenticated` unless stated.

- `log_shadow_mutation()` returns trigger. Attached as
  `zz_log_shadow_mutation` (AFTER INSERT OR UPDATE OR DELETE, FOR EACH
  ROW, `WHEN (pg_trigger_depth() = 0)`) to every public base table
  except the two above. Skips JWTs with no `session_id`; otherwise, for
  a recorded session (target = `auth.uid()`, **no** end/expiry filter),
  inserts `admin_audit_log` (`actor_id` = admin, `target_user_id` = MC,
  `action = 'shadow_mutation'`, details `{table, op, row_id,
  shadow_session_id, after_end}`, ids only; `row_id` is `id` or the
  primary-key columns as an object). An `after_end` write alerts Slack
  hourly per session. Not on `storage.objects`: Storage API writes there
  under service_role claims.
- `mfa_satisfied()` returns boolean (Task 23b, `20261019000000`). STABLE,
  EXECUTE for `authenticated` and `service_role` (not `anon`). True when
  the JWT `aal` is `aal2`, the user has no verified row in
  `auth.mfa_factors`, the JWT `session_id` is an open row here (`ended_at`
  null, `now() < expires_at`, `target_user_id = auth.uid()`, and the
  `admin_id` user still has `raw_app_meta_data ->> 'account_type' =
  'admin'`, since `20261019100000`), or there is no user in the JWT. Used by the `require_mfa` restrictive policies
  and the guards in definer RPCs; see `authentication.md`.
- `ensure_require_mfa_policies()` returns integer (tables attached).
  Idempotent; EXECUTE for `service_role`. A policy counts as attached
  only if it is restrictive, `for all`, `to authenticated` alone, and
  its USING and WITH CHECK are each exactly `(select
  public.mfa_satisfied())` (compared as `pg_get_expr` prints it, with
  the `public.` prefix on the call ignored; `20261019100000`); otherwise
  it is replaced. Run at the end of `20261019000000` and
  `20261019100000` and by both deploy workflows. `storage.objects` gets the same policy once, from the
  migration.
- `ensure_shadow_triggers()` returns integer (tables attached).
  Idempotent; EXECUTE for `service_role`. A trigger counts as attached
  only if it is enabled, calls `log_shadow_mutation()`, is row-level
  AFTER on insert, update and delete, and has a WHEN clause; otherwise
  it is replaced (`20261018000000`). Run at the end of `20261017000000`
  and `20261018000000` and by both deploy workflows.
- `log_shadow_auth_user_change()` on `auth.users` (trigger
  `zz_log_shadow_auth_user`, AFTER UPDATE, WHEN metadata, email, phone
  or password changed) and `log_shadow_mfa_change()` on
  `auth.mfa_factors` (`zz_log_shadow_mfa` insert/delete,
  `zz_log_shadow_mfa_status` status updates). While the user has an
  open session, log `changed_keys` (names only) or the factor id,
  `attribution: 'during_session'`. With no open session, `auth.users`
  changes fall back to `live_shadow_session_for()` and log
  `attribution: 'unrevoked_shadow_session'`, `after_end: true`. A
  `bank_*` or email change alerts. Both bodies are wrapped in an
  exception block: a failure raises a WARNING (plus a Slack note) and
  never aborts GoTrue's write; JSON-null metadata counts as empty.
  Kill switch: replace the function body with `return null`
  (`shadow-mode.md`).
- `open_shadow_session_for(uuid)`: the open (not ended, not expired)
  session on a user. `live_shadow_session_for(uuid)`: the newest
  recorded session whose `auth.sessions` row still exists, has not
  passed `not_after`, and is inside the 168h timebox and 72h inactivity
  limit (mirrors `supabase/config.toml`; change together).
  `shadow_alert_slack(text)`: posts via pg_net to the Vault
  `slack_webhook_url`, silent without it, never raises.
- `shadow_slack_key_list(jsonb)` returns text: `immutable`, security
  invoker, EXECUTE revoked from client roles. Strips `<`, `>`, `&`,
  caps each key at 40 characters and the list at 10 ("and N more").
- `my_support_access()` was dropped in `20261024800000` (owner ruling
  2026-09-27: MCs are not shown shadow sessions). It had fed the
  Settings "Support access" card, also removed.
- `admin_shadow_sessions.revoked_at` (`20261021000000`): when
  `revoke_expired_shadow_sessions()` swept the row. That function
  (definer, `search_path = ''`, EXECUTE for `service_role` only) deletes
  the `auth.sessions` row of every unswept ended or expired shadow
  session (refresh tokens and `mfa_amr_claims` cascade), stamps
  `ended_at = coalesce(ended_at, expires_at)` and `revoked_at = now()`,
  and returns the number deleted. Called every minute by the workflow
  tick. Partial index `admin_shadow_sessions_unswept_idx` on unswept rows.

------------------------------------------------------------------------

# couple_statuses

User-defined statuses for couples, allowing customization beyond the defaults.

Columns:

id (uuid) user_id (uuid, not null) name (text) slug (text, not null)

color (text, default 'gray')

Supported colors: amber, blue, purple, emerald, gray, green, red, orange, pink, indigo

position (integer) created_at (timestamp)

Each user has their own set of custom statuses. The slug is stored in couples.status. Defaults include: new, contacted, confirmed, paid, complete.

------------------------------------------------------------------------

# lead_capture_forms (ZEB-2)

One embeddable lead-capture form per MC. The capture_token is the public
capability for the /lead/[token] surface (mirrors couples.portal_token).
RLS: single owner-isolation policy (auth.uid() = user_id). The hosted
/lead/[token] page reads via the security-definer get_lead_form RPC
(anon-granted); submissions write through the security-definer
submit_lead RPC (also anon-granted). The public Lead Capture API routes
(`POST /api/lead/submit`, `GET /api/lead/config`, 2026-09-03) instead
read this table directly with the service-role admin client
(`lib/lead-capture/load-config.ts`) to reach `enabled`, `allowed_origins`
and the block tree without granting any of that to anon; the anon client
itself still never touches this table directly, and the mutation still
goes through submit_lead.

Columns:

id (uuid) user_id (uuid, not null, unique) capture_token (uuid, not null, unique, default gen_random_uuid())

enabled (boolean, not null, default true)

target_status_slug (text, nullable) — couple_statuses.slug the lead lands in; null falls back to the MC's first status by position

allowed_origins (text[], not null, default '{}'), added 2026-09-03 (`20260903100000_lead_capture_api.sql`). Per-form CORS allowlist for browser posts to `POST /api/lead/submit`, stored exactly as a browser sends an `Origin` header (scheme://host[:port], lowercase host, no path). GIN index `lead_capture_forms_allowed_origins_idx` backs both the per-form `contains` check and the token-less CORS preflight lookup (`isOriginRegistered`, "is this origin registered on any form"). Same-origin posts (the hosted page, the iframe embed) need no entry here; posts with no `Origin` header at all skip CORS logic entirely. MC-edited from Settings > Lead Capture (`allowed-domains.tsx`), capped at 20 origins.

created_at (timestamp) updated_at (timestamp)

Website form (block-based, 2026-08): the form is now a `lead` branding
surface designed from blocks. get_lead_form additionally returns
`blocks` = user_branding.branding_blocks->'lead' (the saved form design,
or JSON null when uncustomised); the public /lead/[token] page renders
that block tree. Fields are `formField` blocks whose `role` maps each
answer to a couple column (name/partnerName/email/phone/weddingDate/
venue/message/referral) or, for `role='custom'`, into the couple notes.

Ingest: `submit_lead(token uuid, p_payload jsonb, p_source_origin text
default null)`. The two-argument overload (`submit_lead(uuid, jsonb)`)
was dropped 2026-09-03 rather than kept alongside it, because a
defaulted third argument would make the two-argument call ambiguous for
PostgREST. The function validates the token, stores a form_submissions
row FIRST (so a lead is never lost), resolves the landing status, and
inserts a couple owned by the token issuer with lead_source='website',
referral_source from the "how did you hear" field, and source_origin
from the third argument (capped to 200 characters; null when omitted).
Custom answers + message fold into couple notes as "Label: value" lines;
the new couple id is linked back onto the submission. A Starter
couple-cap block returns {error:'plan_limit'} and keeps the stored
submission (couple_id null).

------------------------------------------------------------------------

# form_submissions (Website form)

Durable record of every website-form submission, including custom-field
answers that map to no couple column. Written only inside the
security-definer submit_lead RPC (no anon grant); the anon client never
touches the table directly.

RLS: single owner-isolation policy (auth.uid() = user_id).

Columns:

id (uuid) user_id (uuid, not null, FK auth.users on delete cascade)

couple_id (uuid, nullable, FK couples on delete set null) — the couple
created from this submission; null when the plan cap blocked creation

payload (jsonb, not null) — the full submitted payload (canonical fields
+ custom array)

source_origin (text, nullable), added 2026-09-03
(`20260903100000_lead_capture_api.sql`), mirrors couples.source_origin.
Recorded even when the plan cap blocked couple creation (couple_id
null), so the site a blocked lead came from is not lost.

created_at (timestamp)

Indexes: user_id; created_at desc.

------------------------------------------------------------------------

# contacts

Other wedding contacts the MC liaises with.

Columns:

id (uuid) user_id (uuid, not null) name (text) contact_name (text) email (text) phone
(text) category (text) notes (text) status (text)

Category values: venue celebrant photographer videographer dj florist hair_makeup caterer photo_booth lighting_av planner other

Status values: active inactive

created_at (timestamp)

------------------------------------------------------------------------

# events

Actual weddings being managed.

Columns:

id (uuid) user_id (uuid, not null) couple_id (uuid, foreign key) date (date) venue (text)
timeline_notes (text) price (numeric(10,2), nullable) status (text)

Status values: upcoming completed cancelled

venue_phone (text, nullable) venue_website (text, nullable) venue_lat (double precision, nullable) venue_lng (double precision, nullable)  -  populated from Google Places when venue is selected.

drive_time_from_home_seconds (integer, nullable)  -  drive time in seconds from MC's home address to this event's venue; recalculated automatically on event create/update/delete.

drive_time_to_next_event_seconds (integer, nullable)  -  drive time in seconds from this event's venue to the next event's venue (same couple, same date, ordered by created_at); recalculated automatically on event create/update/delete.

drive_distance_from_home_meters (integer, nullable)  -  driving distance in meters from MC's home address to this event's venue; recalculated alongside drive_time_from_home_seconds.

drive_distance_to_next_event_meters (integer, nullable)  -  driving distance in meters from this event's venue to the next event's venue; recalculated alongside drive_time_to_next_event_seconds.

share_token (uuid, nullable, default gen_random_uuid())  -  generated on row creation; used as the public share URL key.

share_token_enabled (boolean, not null, default false)  -  link is inactive until the MC explicitly enables it. Disabling preserves the token. Regenerating updates share_token to a new gen_random_uuid(), permanently invalidating the old URL.

created_at (timestamp)

------------------------------------------------------------------------

# timeline_items

Ordered run-sheet items for an event's wedding timeline.

Columns:

id (uuid, primary key, default gen_random_uuid()) event_id (uuid, not null, FK to events.id, on delete cascade) user_id (uuid, not null)

start_time (time, nullable)  -  stored as HH:MM, displayed as "5:30 PM". Nullable  -  MC can add untimed items. Items are sorted by start_time ascending when set; untimed items fall below by position.

title (text, not null)  -  e.g. "Bridal party entrance"

description (text, nullable)  -  MC's internal notes or cues

duration_min (integer, nullable)  -  estimated duration in minutes

contact_id (uuid, nullable, FK to contacts.id, on delete set null)  -  the contact assigned to this item; scoped to contacts already linked to the event via event_contacts

position (integer, not null)  -  ordering; stored as multiples of 1000 on creation to allow insertion between items without a full renumber

internal (boolean, not null, default false)  -  MC-only item. When true the row is hidden from every public surface (couple portal, vendor run sheet, public timeline link) and renders only on the MC dashboard. Set on the auto-inserted "Sunset" planning cue (golden-hour photos). Added 2026-06-25; the three public RPCs filter `internal = false`.

created_at (timestamp)

RLS: Standard user_id = auth.uid() policy for authenticated CRUD. Anon SELECT is granted via a SECURITY DEFINER Supabase function get_public_timeline(token uuid)  -  returns event + items only when share_token_enabled = true; returns null otherwise. This avoids complex anon policy joins. Public RPCs exclude `internal = true` rows.

------------------------------------------------------------------------

# tasks

> **RETIRED 2026-09 and frozen.** Replaced by `workflow_steps`. The
> write policies were dropped in `20260907000000`; SELECT stays open so
> a support question about an old row is still answerable. Same for
> `task_groups`, `task_statuses`, `task_priorities` and `task_types`,
> which retired with the checklist simplification. See the Workflows
> section at the end of this file.

Follow-ups and reminders.

Columns:

id (uuid) title (text) description (text) due_date (date) status (text)
user_id (uuid) related_event_id (uuid) related_couple_id (uuid) related_contact_id (uuid, nullable, FK to contacts.id)
group_id (uuid, nullable, FK to task_groups.id, set null on group delete)
position (integer, not null, default 0)  -  ordering within a custom group / flat list
priority (text, nullable)  -  values: low | medium | high
task_type (text, nullable)  -  free-form tag (e.g. "Music", "Logistics"); colour assigned deterministically from a 6-colour palette via name hash

Status values: todo in_progress done (displayed as "Not started" / "In progress" / "Done")

created_at (timestamp)

------------------------------------------------------------------------

# task_groups

User-defined sections for organising tasks (custom Group-by mode on the tasks page).

Columns:

id (uuid) user_id (uuid, not null, FK to auth.users)
name (text, not null) color (text, not null, default 'gray')  -  gray | green | blue | amber | red | purple
position (integer, not null, default 0)  -  ordering of groups
created_at (timestamp)

RLS: Standard user_id = auth.uid() policy for full CRUD.

------------------------------------------------------------------------

# event_contacts

Join table linking contacts to events.

Columns:

id (uuid) event_id (uuid, not null, FK to events.id) contact_id (uuid, not null, FK to contacts.id) user_id (uuid, not null) role_notes (text) created_at (timestamp)

Unique constraint on (event_id, contact_id).

------------------------------------------------------------------------

# couple_contacts

Join table linking contacts to couples.

Columns:

id (uuid) couple_id (uuid, not null, FK to couples.id) contact_id (uuid, not null, FK to contacts.id) user_id (uuid, not null) created_at (timestamp)

Unique constraint on (couple_id, contact_id).

------------------------------------------------------------------------

# Relationships

couples -> have events

couples -> linked to contacts via couple_contacts join table

contacts -> linked to couples via couple_contacts join table

contacts -> linked to events via event_contacts join table

events -> have timeline_items (one-to-many, cascade delete)

timeline_items -> contact (many-to-one, nullable, set null on contact delete)

tasks -> can relate to couple (via tasks.related_couple_id), event (via tasks.related_event_id), or contact (via tasks.related_contact_id); optionally belong to a custom task_group (FK group_id, set null on group delete)

task_groups -> have many tasks (one-to-many, set null on delete)

invoices -> belong to a couple (FK couple_id); optionally linked to an event (FK event_id, set null on delete); have many invoice_items (cascade delete)

invoice_items -> belong to an invoice (FK invoice_id, cascade delete)

All tables -> scoped to user via user_id (RLS)

------------------------------------------------------------------------

# invoices

Invoices sent to couples for payment.

Columns:

id (uuid) user_id (uuid, not null) couple_id (uuid, not null, FK to couples.id, on delete cascade)

event_id (uuid, nullable, FK to events.id, on delete set null)  -  links invoice to a specific wedding; used to update events.price when marked paid

invoice_number (text, not null)  -  auto-generated on insert as "INV-001" format (sequential count per user)

title (text, not null)  -  e.g. "Wedding MC Services  -  Smith Wedding"

status (text, not null, default 'draft')

Status values: draft sent paid overdue cancelled

subtotal (numeric(10,2), not null, default 0)  -  sum of invoice_items.amount; updated on item save

due_date (date, nullable)  -  optional payment due date, set manually by the MC (invoices are built by hand)

payment_terms (text, nullable)  -  one of: `net_7`, `net_14`, `net_30`, `due_on_receipt`, `custom`. When set to a net term, due_date is auto-calculated. `due_on_receipt` clears due_date. `custom` keeps due_date freely editable.

tax_rate (numeric(5,2), not null, default 0)  -  GST percentage (e.g. 10 for 10%). 0 means no GST. Currently only 0 and 10 are used.

gst_inclusive (boolean, not null, default false)  -  display-only flag (added `20260730150000_add_gst_inclusive_to_invoices.sql`). When true, every couple-facing surface renders a "Prices include GST" note under the total: the builder's totals panel, the shared `totals` branding block (public page + Link preview), the PDF, and the fallback card. It NEVER participates in any amount, so subtotal / tax_rate / total and every money path (Stripe charge amounts, payment-stage totals) are unaffected, and `false` renders exactly as before the column existed. Independent of `tax_rate`: setting a rate AND ticking the flag is allowed, and produces a document that adds GST on top while also disclosing inclusive pricing. Carried over automatically when an invoice is built from a GST-inclusive package. Returned by `get_public_invoice`.

notes (text, nullable)  -  payment instructions, bank details, reference number request. Auto-populated from MC's saved bank details when creating a new invoice.

deposit_percent (numeric(5,2), nullable)  -  deposit as a percentage of total (e.g. 50 for 50%). NULL means no payment schedule is active.

deposit_due_date (date, nullable)  -  due date for the deposit installment

deposit_paid_at (timestamptz, nullable)  -  set when the MC manually marks the deposit as paid

final_due_date (date, nullable)  -  due date for the final balance installment

final_paid_at (timestamptz, nullable)  -  set when the MC manually marks the final balance as paid; also sets invoice status to `paid`

stripe_payment_enabled (boolean, not null, default false)  -  when true and MC has Stripe Connect configured, couples see a "Pay with card" button on the public invoice page. Only applicable when no payment schedule is active.

stripe_payment_intent_id (text, nullable)  -  Stripe payment intent ID, set when a couple pays via Stripe Checkout

share_token (uuid, not null, default gen_random_uuid())  -  unique URL key; generated on row creation

share_token_enabled (boolean, not null, default true)  -  link is live from creation so the MC can copy/share it out-of-band (default flipped false→true + all rows back-filled by `20260527000000_share_token_enabled_by_default`). Disabling (e.g. cancelling an invoice) preserves the token; the public RPC 404s while it is false

paid_at (timestamp with time zone, nullable)

created_at (timestamp)

RLS: Standard user_id = auth.uid() CRUD for authenticated users. Anon access via SECURITY DEFINER function get_public_invoice (read-only; no couple-side writes on invoices). The function also returns tax_rate, payment schedule fields, stripe_payment_enabled, and stripe_connect_enabled. The Connect flag is currently read from `raw_user_meta_data` (residual reads documented in `.claude/docs/security.md` §7.4 — UX flip only; Stripe rejects the actual charge if Connect isn't completed). Migration to `raw_app_meta_data` is tracked for the Payments page-hardening phase.

------------------------------------------------------------------------

# invoice_items

Line items for an invoice.

Columns:

id (uuid) invoice_id (uuid, not null, FK to invoices.id, on delete cascade) user_id (uuid, not null)

description (text, not null)

quantity (numeric(8,2), not null, default 1.00)

unit_price (numeric(10,2), not null)

amount (numeric(10,2), not null)  -  stored as quantity × unit_price; recalculated on save

position (integer, not null)  -  ordering, multiples of 1000

created_at (timestamp)

------------------------------------------------------------------------

# stripe_customers

Lookup table for resolving Stripe webhooks to Supabase users. See `.claude/payments.md` for details.

Columns:

stripe_customer_id (text, primary key) user_id (uuid, not null, references auth.users.id) created_at (timestamp)

RLS: service role only (no client access).


------------------------------------------------------------------------

# Couple Portal (added 2026-04-09; per-partner tokens 2026-06-16)

## couples table additions

portal_token (uuid, not null, default gen_random_uuid())  -  unique token for the **primary partner**'s portal link
secondary_portal_token (uuid, not null, default gen_random_uuid(), unique)  -  unique token for the **spouse/secondary partner**'s portal link (added 2026-06-16; allows per-partner access with privacy-filtered vow content)
portal_token_enabled (boolean, not null, default true)  -  gates both primary and secondary partner portal access; MCs can rotate portal_token to invalidate old primary links
selected_package_id (uuid, nullable, FK packages **on delete set null**, indexed)  -  the package this couple has chosen. Set from the portal (couple picks via `save_portal_package`), on the Add/Edit Couple modal at creation, or inline on the couple profile Overview (plain RLS update). Null until a choice is made. (added 2026-08-19)

**The couples INSERT/UPDATE policies carry a package-ownership guard.** Foreign keys are checked with elevated privileges and ignore RLS, so the plain `auth.uid() = user_id` policy still accepted a `selected_package_id` belonging to another MC: the FK found a row the writer could never read, linking across tenants and confirming that package id exists. Both policies therefore add `with check (... and _owns_package_or_null(selected_package_id))`. Same class of hole as the `couple_time_entries` couple_id guard below; found by `tests/integration/rls/couple-selected-package.test.ts`. Migration: `20260820010000_couple_package_ownership_guard.sql`.

## timeline_items table additions

pending_review (boolean, not null, default false)  -  true for items submitted via couple portal, awaiting MC approval

------------------------------------------------------------------------

# portal_people

Names and pronunciation data submitted by the couple via portal.

Columns:
id (uuid, primary key)
couple_id (uuid, not null, FK to couples.id, on delete cascade)
user_id (uuid, not null)  -  MC's user_id (set by SECURITY DEFINER RPC)
category (text, not null)  -  'partner' | 'bridal_party' | 'family'
full_name (text, not null)
phonetic (text, nullable)  -  phonetic spelling of name
role (text, nullable)  -  e.g. 'Bride', 'Best Man', 'Mother of Bride'
audio_url (text, nullable)  -  Supabase Storage URL for audio pronunciation
position (integer, default 0)  -  ordering within category
created_at (timestamptz, default now())

RLS: Standard user_id = auth.uid() for authenticated users. Anon access via SECURITY DEFINER RPCs: save_portal_person, delete_portal_person.

------------------------------------------------------------------------

# portal_songs

Song requests submitted by the couple via portal.

Columns:
id (uuid, primary key)
couple_id (uuid, not null, FK to couples.id, on delete cascade)
user_id (uuid, not null)  -  MC's user_id
category (text, not null)  -  'entry_partner1' | 'entry_partner2' | 'first_dance' | 'bridal_party_entry' | 'ceremony' | 'reception' | 'avoid'
title (text, not null)
artist (text, nullable)
notes (text, nullable)
position (integer, default 0)
created_at (timestamptz, default now())

RLS: Standard user_id = auth.uid(). Anon access via: save_portal_song, delete_portal_song.

------------------------------------------------------------------------

# portal_files

Files uploaded by the couple via portal.

Columns:
id (uuid, primary key)
couple_id (uuid, not null, FK to couples.id, on delete cascade)
user_id (uuid, not null)  -  MC's user_id
name (text, not null)  -  original filename
file_url (text, not null)  -  Supabase Storage public URL
file_size (integer, nullable)  -  bytes
created_at (timestamptz, default now())

Storage bucket: portal-files (public read, max 20MB per file)
Storage bucket: portal-audio (public read, max 10MB per file)

RLS: Standard user_id = auth.uid(). MC dashboard uploads run client-side with the publishable key (path = "<couple_id>/..."), anon portal uploads run through /api/portal/upload (path = "<portal_token>/..."). Storage INSERT/UPDATE/DELETE policies on storage.objects authorize an upload when (storage.foldername(name))[1] is either a couple_id owned by auth.uid() (is_own_couple) or an active portal_token (is_valid_portal_token) — both SECURITY DEFINER. Don't depend on service_role bypass; the new publishable/secret key model makes that unreliable. Anon deletes via: delete_portal_file RPC.

------------------------------------------------------------------------

## Admin RPC (SECURITY DEFINER, service_role only)

### admin_user_last_seen() -> table (user_id uuid, last_seen timestamptz)

Per-user last activity: the newest `created_at` / `refreshed_at` across that
user's `auth.sessions` rows. Feeds the **Last seen** column on the admin Users
table (`AdminUser.last_seen_at`).

Why it exists: `auth.users.last_sign_in_at` is an authentication-event
timestamp. GoTrue stamps it only on a real credential exchange; a
refresh-token rotation leaves it untouched. Zebri sets no `[auth.sessions]`
`timebox` or `inactivity_timeout`, and `login/page.tsx` redirects anyone with
a live session away from the form, so a returning user never re-authenticates
and the value freezes at their last password entry. `auth.sessions.refreshed_at`
moves on every hourly token rotation, so it tracks real use to within the
1-hour `jwt_expiry` window.

Notes:

- `auth.audit_log_entries` would be richer (it logs `login` / `token_refreshed`
  per event) but is **pruned on hosted Supabase**  -  it returned zero rows for
  a production user with active sessions. Do not build on it.
- `greatest()` ignores NULLs in Postgres, so a session that has never been
  refreshed correctly falls back to its `created_at`.
- `refreshed_at` is `timestamp WITHOUT time zone` holding UTC while everything
  around it is `timestamptz`; the function casts it `at time zone 'utc'` so the
  result is not shifted by the server's offset.
- **Access:** `EXECUTE` revoked from `public` / `anon` / `authenticated`,
  granted to `service_role` only. It reads session activity across every
  tenant, so an authenticated MC must never be able to call it (verified:
  authenticated callers get `permission denied for function`).
- `search_path = ''` with fully-qualified objects, per definer-function
  hardening.


## Portal RPC Functions (SECURITY DEFINER, anon-accessible)

**Helper (internal):**
_resolve_portal_couple(p_token uuid)  -  maps either portal_token (primary) or secondary_portal_token (spouse) to (couple_id, owner_id, viewer) where viewer is 'primary' or 'spouse'. All other RPCs use this to derive authorization and viewer context.

**Data retrieval:**
get_portal_data(token uuid)  -  returns couple name + event + people + songs + files + timeline_items + payments + contracts + **vows (privacy-filtered: only the calling partner's vow)** + `branding` key (MC's branded theme). Adds 'viewer', 'primary_name', 'primary_email', 'primary_phone', 'secondary_name', 'secondary_email', 'secondary_phone' to result (the email/phone fields hydrate the editable Overview contact cards, added 2026-06-17). Each partner sees only their own vow content. As of 2026-06-25 `timeline_items` spans **all** of the couple's events (not just the soonest) and each item carries `event_id`, so the portal can group moments by day; `internal = true` items are excluded.
get_vendor_timeline(token uuid)  -  returns the couple's `events` list (id/date/venue) + `timeline_items` across all events (each tagged with `event_id`), no PII. Uses portal_token only. As of 2026-06-25 it returns the full event list (was a single event) so the run sheet can offer a per-day selector; `internal = true` items are excluded. Includes `branding` key (via `_user_branding` merge) for branded run-sheet display.

**Timeline & people:**
save_portal_timeline_item(p_token, p_id, p_start_time, p_title, p_description, p_duration_min, p_event_id?)  -  insert with pending_review=true. As of 2026-06-25 takes an optional `p_event_id` so a suggestion lands on the day the couple is viewing; when omitted (or not owned by the couple) it falls back to the soonest event. Couple suggestions are always `internal = false`.
delete_portal_timeline_item(p_token, p_id)
save_portal_person(p_token, p_id, p_category, p_full_name, p_phonetic, p_role, p_audio_url, p_position, p_notes?, p_email?, p_phone?)  -  upsert
delete_portal_person(p_token, p_id)

**Songs & contacts:**
save_portal_song(p_token, p_id, p_category, p_title, p_artist, p_notes, p_position)  -  upsert
delete_portal_song(p_token, p_id)
save_portal_contact(p_token, p_name, p_email, p_phone, p_category, p_notes)  -  creates contact + links to couple

**Couple contact details (Overview tab):**
save_portal_couple_details(p_token, p_primary_name, p_primary_email, p_primary_phone, p_secondary_name, p_secondary_email, p_secondary_phone)  -  updates the couple's primary/secondary contact triples. Either partner token may edit **both** triples (no privacy gate on contact info). Fields are trimmed + length-capped; empty strings store as NULL. (added 2026-06-17)

**Events (Overview tab):**
save_portal_event(p_token, p_id, p_date, p_venue)  -  add or edit a couple's event (date + venue) from the portal. Upserts on p_id; the `ON CONFLICT ... WHERE couple_id = <resolved>` clause is the cross-couple guard (a token can only touch its own couple's events). New rows default to status='upcoming'; status is preserved on edit. No delete path. (added 2026-06-17)

**Package selection (Overview tab, added 2026-08-19):**
get_portal_packages(p_token)  -  returns `{ selected_package_id, packages: [{ id, name, description, gst_inclusive, total_amount }] }` for the owning MC's non-archived packages, ordered by position. `total_amount` sums required items only (amount x quantity); optional add-ons don't inflate the headline price. Null on a bad token.
save_portal_package(p_token, p_package_id)  -  sets (or clears, with null) `couples.selected_package_id`. Cross-tenant guard: the package must belong to the couple's MC and be non-archived, otherwise raises.

**Files:**
delete_portal_file(p_token, p_id)
save_portal_file(p_token, p_id, p_name, p_file_url, p_file_size)  -  (called post-upload by /api/portal/upload)

**Vows (privacy-gated per partner):**
save_portal_vow(p_token, p_id, p_content)  -  insert/upsert vow; **who is automatically derived from viewer (cannot be overridden by client)**. Logs a 'couple' revision.
delete_portal_vow(p_token, p_id)  -  **only allows deletion of the caller's own vow**

All RPCs validate portal_token_enabled=true before proceeding (via _resolve_portal_couple).

------------------------------------------------------------------------

## connect_accounts (Phase 2D.1)

Per-user mirror of Stripe Connect account state — capabilities,
requirements, disabled_reason. Populated by `account.updated` /
`capability.updated` / `account.application.deauthorized` webhooks
in `lib/payments/connect-events.ts`. Read by the settings page's
status panel + the entitlements helpers.

Columns:
user_id (uuid, primary key, FK to auth.users.id, on delete cascade)
account_id (text, unique, nullable)  -  Stripe Express account ID; null after disconnect
charges_enabled (boolean, default false)
payouts_enabled (boolean, default false)
details_submitted (boolean, default false)
requirements_currently_due (jsonb, default '[]')
requirements_past_due (jsonb, default '[]')
disabled_reason (text, nullable)
default_currency (text, nullable)
country (text, nullable)
business_type (text, nullable)
last_account_id (text, nullable)  -  preserved on server-initiated disconnect for rebind; cleared on Stripe-initiated deauth
created_at, updated_at (timestamptz, auto-managed)

RLS: SELECT-only for the owner. No INSERT/UPDATE/DELETE policies —
writes only via service-role webhook handler + disconnect server
action. Migration: `20260524000000_create_connect_accounts.sql`.

## contract_signers

One row per party who must sign a contract, so a couple can each sign
their own copy. Added by
`20260828003000_create_contract_signers.sql`.

Columns: `id`, `contract_id` (FK contracts, cascade), `user_id` (FK
auth.users, cascade, the RLS owner), `role` (`'client' | 'vendor'`),
`name`, `email`, `signing_order`, `required`, `sign_token` (uuid,
unique, the per-signer capability URL), `signed_at`,
`signer_name_typed`, `signer_ip`, `signer_user_agent`, `declined_at`,
`declined_reason`, `created_at`, `updated_at`.

- **Seeded automatically** by the `contracts_seed_signers` AFTER INSERT
  trigger on `contracts`, from the couple's `primary_name`/`primary_email`
  and `secondary_name`/`secondary_email`. Seeding in the DB rather than
  the app guarantees the invariant the signing RPCs rely on.
- **RLS:** `contract_signers_user_isolation`, `using (auth.uid() =
  user_id)` **and** `with check (auth.uid() = user_id and
  _owns_contract(contract_id))`. The parent-ownership half is required,
  not belt-and-braces: foreign keys are validated with elevated
  privileges and ignore RLS, so an owner-only `with check` still lets a
  user file a signer row against another tenant's contract. That is the same
  class closed for `bookings.couple_id` in `20260821040000`. Covered by
  `tests/integration/rls/contract-signers.test.ts`, which fails if the
  predicate is removed.
- `contracts.signer_*` columns are **kept** as a denormalised fast path
  (the PDF generator and public status banner read them) and take the
  most recent client signature.
- `sign_token` is a bearer credential and is never returned by
  `get_public_contract`.

## contract_audit_log (Phase 3.2)

Durable trail of every state change on a contract. The existing
inline columns on `contracts` (`signer_name`, `signer_ip`,
`signer_user_agent`, `signed_at`, `declined_at`, `declined_reason`)
are the fast-path "current state" snapshot. This table is the
forensic record behind that — survives `revoke_contract` clearing
the inline columns; persists per-event IP/UA so we can reconstruct
"this contract was sent then signed then revoked" from the row
sequence.

Columns:
id (uuid, primary key)
contract_id (uuid, FK to contracts.id, on delete cascade)
user_id (uuid, FK to auth.users.id, on delete cascade)  -  denormalised owner; RLS key
event_type (text, check in: sent | viewed | signed | declined | expired | revoked | reminder_sent)
actor (text, check in: mc | couple | system)
actor_ip (text, nullable)  -  text for parity with contracts.signer_ip
actor_user_agent (text, nullable)
signer_name_typed (text, nullable)  -  only set on 'signed' rows
decline_reason (text, nullable)  -  only set on 'declined' rows
reminder_number (integer, nullable)  -  only set on 'reminder_sent' rows (1, 2 per cron cap)
revoked_from_status (text, nullable)  -  only set on 'revoked' rows; captures the pre-revocation status
event_at (timestamptz, default now())

Indexes: `(contract_id, event_at desc)` for per-contract reads,
`(user_id, event_at desc)` for owner-scoped dashboard timelines.

RLS: SELECT-only for the owner. No INSERT/UPDATE/DELETE policies —
the only sanctioned writer is `emit_contract_audit_event(...)`
(SECURITY DEFINER), called from inside `sign_contract`,
`decline_contract`, `revoke_contract` and `expire_contracts`. The
`/api/email/send-contract` route
also calls `emit_contract_audit_event` directly to log the 'sent'
event when the contract locks.

Migration: `20260528000000_create_contract_audit_log.sql`. Includes
a back-fill that synthesises one audit row per pre-existing
contract from its current status + denormalised inline columns.

## email_templates / email_template_files (Email Templates feature)

Reusable, per-MC email templates used in both the automation
`send_email` action and the manual "Send email" compose flow. The
defining rule: an email never sends with an unfilled variable — the
shared renderer (`lib/email/templates.ts`) detects unresolved
variables so the caller can block (automations) or gate behind an
explicit "Send anyway" (manual).

`email_templates` columns:
id (uuid, primary key)
user_id (uuid, FK auth.users.id, on delete cascade)  -  RLS key
name (text, not null)
description (text, nullable)
subject (text, not null, default '')  -  mustache string, e.g. `Invoice for {{couple.name}}`
content (jsonb, not null, default '{}')  -  TipTap JSON body; mention nodes carry a namespaced variable key in `attrs.id` (e.g. `couple.primary_name`, `event.date | friendly`)
lifecycle_stage (text, nullable, check in: enquiry | quote | booking | planning | wedding_week | follow_up)  -  **LEGACY**: grouping moved to `category_id`; kept for starter provenance, never dropped
category_id (uuid, nullable, FK email_template_categories.id, **on delete set null**)  -  the user category this template is grouped under
is_starter (boolean, not null, default false)  -  provenance badge for seeded library rows; starters stay fully editable
position (integer, not null, default 0)
archived_at (timestamptz, nullable)  -  soft retirement; archived templates keep history (and automation references) but leave the Emails library list and the template pickers. Added in `20260709120000_email_templates_archive.sql`
created_at / updated_at (timestamptz; updated_at kept fresh by trigger `email_templates_set_updated_at`)

`email_template_categories` (user-editable grouping, Notion-style —
replaces the fixed lifecycle stages in the Emails-tab UI):
id (uuid, primary key)
user_id (uuid, FK auth.users.id, on delete cascade)  -  RLS key
name (text, not null)
color (text, not null, default 'slate')  -  named palette key (slate | rose | amber | emerald | sky | violet | pink | stone); UI maps keys to token-safe classes in `app/(dashboard)/templates/category-colors.ts`
position (integer, not null, default 0)  -  drag order
created_at / updated_at (timestamptz; trigger `email_template_categories_set_updated_at`)

Category seeding: migration `20260709000000_email_template_categories.sql`
backfills the six historical stages as categories for every user who
owned templates (and points their templates at the match). New users are
seeded lazily by `ensureDefaultCategories()`
(`lib/email/template-categories.ts`), guarded by
`user_metadata.email_categories_initialized` so deleting every category
never respawns the defaults.

`email_template_files` columns (metadata for static attachment uploads;
the binary lives in the private `email-template-files` storage bucket
at `{user_id}/{template_id}/{id}`):
id (uuid, primary key)
user_id (uuid, FK auth.users.id, on delete cascade)  -  RLS key
template_id (uuid, FK email_templates.id, on delete cascade)
file_name / mime_type / storage_path (text, not null)
file_size (integer, not null)
created_at (timestamptz)

Indexes: `email_templates(user_id)`, partial
`email_templates(user_id, lifecycle_stage)`, `email_templates(category_id)`,
`email_template_files(user_id)`, `email_template_files(template_id)`,
`email_template_categories(user_id)`.

RLS: base owner policy `user_id = auth.uid()` (USING + WITH CHECK) on
all three tables. The `email-template-files` storage bucket is **private**
(25 MB cap, PDF/DOCX/PNG/JPEG MIME whitelist) with owner-only
insert/select/update/delete policies keyed on the first path segment
(`auth.uid()::text = split_part(name, '/', 1)`).

Variable resolution reuses the automation namespace via
`resolveVariable()` in `lib/automations/variables.ts`, so a template
renders identically whether fired by an automation or sent manually.

Migration: `20260618000000_create_email_templates_feature.sql`. Starter
templates are **not** auto-seeded — an MC adds them on demand from the
in-app "Browse starter templates" catalog (canonical set in
`lib/email/starter-templates.ts`; `is_starter` flags catalog-sourced
rows). `20260618000200_clear_seeded_starter_templates.sql` removes rows
from the previous auto-seed model. The `automation_waits.reason`
+ `automation_audit_log.event` CHECKs are widened to include
`missing_variables` / `missing_variables_detected` in
`20260618000100_automation_missing_variables_wait.sql` (the send_email
template path pauses a run on an unresolved variable; see `alerts.md`).

## packages / package_items (Templates page — Packages tab)

Reusable, per-MC service bundles surfaced on the **Packages** tab of
`/templates`. A package is a named set of priced line items the MC can
drop into invoices.

`packages` columns:
id (uuid, primary key)
user_id (uuid, FK auth.users.id, on delete cascade)  -  RLS key
name (text, not null)
description (text, nullable)  -  "what's included" prose shown on the preview and prepended to the applied invoice notes
notes (text, nullable)  -  short subtitle shown on the list row
category_id (uuid, nullable, FK package_categories.id, **on delete set null**)  -  the user category this package is grouped under
position (integer, not null, default 0)  -  list order (creation order; the Packages list is not drag-reorderable)
is_starter (boolean, not null, default false)  -  provenance badge for catalog-added rows; starters stay fully editable
deposit_percent (numeric(5,2), nullable)  -  booking-fee rule (e.g. 30 for "30% to secure the date"); pre-fills the invoice builder's payment schedule on apply. NULL = no default schedule
gst_inclusive (boolean, not null, default true)  -  whether prices already include GST. Applying an inclusive package turns the builder's GST line off; an exclusive one keeps GST 10% on top
archived_at (timestamptz, nullable)  -  soft retirement; archived packages keep history but leave the default list and the builders' apply pickers
weekend_loading_percent (numeric(5,2), nullable)  -  peak-rate loading (e.g. 15 for "Saturday +15%"); applying appends a transparent loading line item the MC deletes off-peak
is_popular (boolean, not null, default false)  -  marketing "most popular" flag on the package. Added `20260712000000_proposal_popular_flag.sql`
created_at / updated_at (timestamptz)

`package_items` columns:
id (uuid, primary key)
package_id (uuid, FK packages.id, on delete cascade)
user_id (uuid, not null)  -  RLS key (denormalised)
description (text, not null)
amount (numeric(10,2), not null)  -  PER-UNIT price (line total = quantity × amount; flattened to "N × description" on apply since invoice builder items carry no qty)
quantity (numeric(8,2), not null, default 1.00)
optional (boolean, not null, default false)  -  an add-on offered alongside the base package; the builders let the MC tick which add-ons to include on apply
position (integer, not null)
created_at (timestamptz)

`package_categories` (user-editable grouping, Notion-style — same
pattern as `email_template_categories` but an independent taxonomy;
**no default seeding or backfill**, every account starts empty):
id (uuid, primary key)
user_id (uuid, FK auth.users.id, on delete cascade)  -  RLS key
name (text, not null)
color (text, not null, default 'slate')  -  same named palette keys as email categories
position (integer, not null, default 0)  -  drag order
created_at / updated_at (timestamptz; trigger `package_categories_set_updated_at`)

Indexes: `packages(user_id)`, `packages(category_id)`,
`package_items(package_id)`, `package_categories(user_id)`.

RLS: base owner policy `user_id = auth.uid()` on all three tables
(`for all using (...)`, which Postgres reuses as the INSERT WITH CHECK).

Migrations: `20260618000300_create_packages.sql`; `is_starter` added in
`20260619000100_add_is_starter_to_templates.sql`; commercial fields
(deposit/GST/archive/weekend loading) and item `quantity`/`optional`
added in `20260702000000_packages_v2.sql`;
`package_categories` + `packages.category_id` added in
`20260709130000_package_categories.sql`.
Starter packages are an opt-in catalog
(`lib/payments/starter-line-item-templates.ts`), added via the
`addStarterPackagesAction` server action; nothing is auto-seeded.
Pure package money math (line totals, base vs add-on totals, weekend
loading line) lives in `lib/payments/package-math.ts`.

## invoice_templates / invoice_template_items (Templates page — Invoices tab)

Reusable invoice skeletons on the **Invoices** tab of `/templates`.
Built from scratch or seeded from a package via the
editor's "Add from…" picker, which **snapshots** the source's line items
in (no live FK — a later package price edit never silently changes a
saved invoice template). Mirrors `packages` structurally.

`invoice_templates` columns: id, user_id (RLS key, FK auth.users on
delete cascade), name (not null), description (nullable), notes
(nullable subtitle), position (default 0), is_starter (boolean, not null,
default false  -  catalog provenance badge), created_at / updated_at.

`invoice_template_items` columns: id, invoice_template_id (FK
invoice_templates on delete cascade), user_id (RLS key), description
(not null), amount (numeric(10,2), not null), position (not null),
created_at.

Indexes: `invoice_templates(user_id)`,
`invoice_template_items(invoice_template_id)`.

RLS: owner-only `user_id = auth.uid()` on both (USING doubles as INSERT
WITH CHECK).

Migrations: `20260618000400_create_invoice_templates.sql`; `is_starter`
added in `20260619000100_add_is_starter_to_templates.sql`. Starter invoice
templates are an opt-in catalog
(`lib/payments/starter-line-item-templates.ts`) added via
`addStarterInvoiceTemplatesAction`.

## couple_emails (Couple profile — Emails tab)

A sent-history log of every email sent to a couple. Powers the
**Emails** tab on the couple profile.

- **Manual** (`source = 'manual'`): the MC's own sends
  (`/api/email/send-template`, `/api/email/send-proposal`) insert a
  `sent` row after a successful send, as the MC.
- **Automated** (`source = 'automation'`, Task 30): every workflow
  message writes one row once the transport has answered, `sent` with
  its provider message id or `failed` with the error
  (`logAutomatedSend` in `lib/email/send-log.ts`, called from the send
  gate in `lib/email/automation-send.ts` and from `send_email` in
  `lib/automations/actions/messaging.ts`). One row per recipient
  message, so a cc/bcc split address gets its own. Written with the
  service role through `log_automated_send(...)` after the send; a
  failed write never fails the send and raises
  `automated_send_log_failed`. The Resend webhook then advances the row
  by `provider_message_id`.
- **One row per message, not per attempt** (fix round 1): the row's
  `attempt_key` is the send's per-recipient idempotency key
  (`step:recipient:fingerprint`), and `log_automated_send` upserts on
  it. A retry updates its own row; a later success replaces a `failed`
  row; a row already `sent` or advanced by the webhook is left alone,
  unless the new answer is a different message (Phase 5 fix wave, N1): a
  different Resend id (a retry after Resend's 24 hour window), or any
  success on the MC's own mailbox (Gmail and Graph deduplicate nothing),
  is inserted as its own row under `attempt_key || ':' || provider id`
  (a random uuid when there is none). Any other unique violation reaches
  the caller and is alerted.
- **A later send supersedes the failure it replaced** (M4): when a
  success is written for a step, that step's earlier `failed` rows to the
  same address (case-insensitive) under other keys get `superseded_at`.
  Their status stays `failed`; the Emails tab reads them as replaced.
- **A deleted couple's rows are scrubbed, not removed** (Phase 5
  residual pass R2, `20261023300000`): the `before update of couple_id`
  trigger `couple_emails_scrub_on_couple_delete` fires when the FK's set
  null runs and rewrites the row's personal details: `to_email` becomes
  `'(couple deleted)'`, `subject` becomes `''`, and `template_name`,
  `error`, `provider_message_id` and `attempt_key` (which embeds the
  address) become null. The row stays, because it is the tenant's
  daily-cap count (the cap reads only user_id, source, transport, status
  and sent_at). Security invoker, empty search_path, no client execute.

Columns: id, user_id (RLS key, FK auth.users cascade), couple_id
(nullable, FK couples **on delete set null**, Phase 5 fix wave M2), template_id (FK email_templates **on delete set
null**, nullable), template_name (text snapshot, survives template
deletion/rename), subject (rendered subject sent), to_email, source
(`manual` | `automation`), status, sent_at, created_at, and (Task 30)
step_id (FK workflow_steps on delete set null), instance_id (FK
workflow_instances on delete set null), provider_message_id (text,
unique when set), error (why a `failed` send failed), delivered_at,
bounced_at, complained_at, and (fix round 1) attempt_key (text, unique)
and transport (`resend` | `gmail` | `graph`, null on manual rows;
existing automated rows backfilled `resend`), and (Phase 5 fix wave)
superseded_at (timestamptz, set by `log_automated_send`, null on manual
rows).

**Deleting a couple keeps its rows** (M2). `couple_id` is set null, not
cascaded, for every row (one FK, one rule): the rows are the tenant's
daily-cap count and delivery record, and a cascade let a tenant reset
their own cap by deleting a couple. An orphaned row is readable by its
owner only (every read policy scopes by `user_id`) and listed by no
surface (the Emails tab reads by couple). Deleting the account still
cascades through `user_id`. The row keeps the recipient address and
subject after the couple is gone.

**Status** is CHECK-constrained to `sent | failed | delivered | bounced
| complained | deferred`, and the webhook only moves it forward: sent <
deferred < delivered < bounced < complained. A delivered event after a
bounce leaves it bounced (but still stamps `delivered_at` if unset); a
replay changes nothing (each timestamp keeps its first value). Legacy
rows were all `sent`; the migration folds any other value to `sent`
before the CHECK.

**Daily send cap.** `WORKFLOW_SEND_DAILY_CAP` counts this table:
`source = 'automation'` and `transport = 'resend'` rows for the tenant
with `sent_at` in the last 24 hours whose status is `sent`, `delivered`,
`bounced`, `complained` or `deferred`: messages that left. Not `failed`
(Phase 5 fix wave, M1: a retry used to count its own earlier failures
against its admission; a failing loop is bounded by retries and backoff
instead). `readAutomatedSendWindow` in `lib/email/send-log.ts`, shared by the
cron tick and approve-and-send. MC-mailbox sends are not on the shared
domain and do not count. A capped step wakes when the row that has to
age out for it to fit does (`automatedSendWindowReopensAt`).

Indexes: `couple_emails(couple_id)`, `couple_emails(user_id)`,
`couple_emails_cap_idx (user_id, source, transport, sent_at) include
(status)` (the cap count; not partial, so a generic parameterised plan
can use it too, Phase 5 fix wave N2), unique `(attempt_key)`, unique
`(user_id, transport, provider_message_id) where provider_message_id is
not null` (Gmail ids are per mailbox, so uniqueness is per tenant, M5),
`(provider_message_id, transport)` (the webhook's lookup by Resend id),
`couple_emails(step_id)`, `couple_emails(instance_id)`.

RLS: the owner reads every row (`user_id = auth.uid()`); inserts only
`source = 'manual'`, status `sent` rows naming their own couple with
every engine-only column (superseded_at included) null; deletes only manual rows; no update.
TRUNCATE, REFERENCES and TRIGGER revoked from `authenticated`; `anon`
holds SELECT only. Automated rows are the delivery record and the daily
cap, so the tenant cannot rewrite or delete them (deleting would reset
their own cap). Plus the restrictive `require_mfa` policy and the
shadow-mutation trigger every owned table carries.

Migrations: `20260619000000_create_couple_emails.sql`,
`20261023000000_couple_emails_delivery.sql`,
`20261023100000_couple_emails_delivery_fixes.sql`,
`20261023200000_couple_emails_send_fidelity_fixes.sql`.

## questionnaire_templates / couple_questionnaires (Couple questionnaires)

Couples fill in MC-built questionnaires on a branded public page, either one
question at a time (typeform style) or as a classic all-on-one-page form. The
answer style is derived at render time from the MC's branding blocks
(`questionnaireOneAtATime` / `questionnaireAllOnePage` markers), not from the
stored display_mode columns, which remain as legacy snapshots (the template
builder links to Branding to change the style, 2026-08-19). Structurally a
twin of contracts: a reusable template plus a per-couple token-gated instance.

**questionnaire_templates** (Templates page — Questionnaires tab). The MC's
reusable forms. Columns: id, user_id (RLS key, FK auth.users cascade), name,
description (nullable), display_mode (`typeform | form`, default `typeform`,
enforced in code like statuses), `questions` (jsonb — ordered array of
`{ id, type, label, help_text?, required, options? }`; types live in
`lib/questionnaires/question-schema.ts`), is_starter (provenance for cloned
starters), position, created_at, updated_at. Index: `(user_id)`. RLS:
owner-only `user_id = auth.uid()`.

**couple_questionnaires** (Couple profile — Questionnaires tab). One per send.
Columns: id, user_id (RLS key), couple_id (FK couples cascade), template_id (FK
questionnaire_templates **on delete set null**), title, `questions` (jsonb
**snapshot** taken at send time so later template edits never change a sent
questionnaire — same principle as the contract content lock), display_mode
(snapshotted with the questions), `responses` (jsonb, answers keyed by
question id), status (`draft | sent | completed`), share_token (uuid),
share_token_enabled (default false), sent_at, viewed_at (stamped by
`get_public_questionnaire` on the couple's first open, null until then),
completed_at, created_at, updated_at. Indexes: `(user_id)`, `(couple_id)`,
`(template_id)`, `(share_token)`. RLS: owner-only.

Anon access via SECURITY DEFINER RPCs (all token-gated, granted to `anon`):
- `get_public_questionnaire(token)` — returns the questionnaire (incl.
  display_mode) + current responses + status + `branding` key with merged MC branding
  (via `_user_branding`, surfaces `questionnaire` block tree); null when the token is missing or
  `share_token_enabled = false`. Side effect: stamps `viewed_at` on the first
  successful call. MC branding enables branded welcome/thank-you fill-page messaging.
- `save_questionnaire_progress(token, p_responses)` — autosave of partial
  answers; refuses once completed.
- `submit_questionnaire(token, p_responses)` — stores answers, stamps
  `completed_at`, flips status to `completed`, and spawns a follow-up task for
  the MC; refuses a second submission.
- `couple_questionnaires.description` (text, nullable, added 2026-08-19) is
  snapshotted from the template at send time and returned by
  `get_public_questionnaire` so the fill page can show intro text under the
  title (both answer styles).
- `get_portal_questionnaires(token)` — lists a couple's sent/completed
  questionnaires for the client portal, gated by the portal token via
  `_resolve_portal_couple`.

Automation event: `tg_couple_questionnaires_emit_completed` (AFTER UPDATE)
emits a `questionnaire_completed` event via `emit_automation_event` whenever
status transitions to `completed` (public submit or the MC marking it done),
with payload `{ questionnaire_id, couple_id, template_id, title, share_token,
sent_at, completed_at }`.

Migrations: `20260626000000_create_questionnaires_feature.sql`,
`20260626000100_portal_questionnaires.sql`,
`20260705000000_questionnaires_v2.sql` (display_mode, viewed_at,
completed-event trigger),
`20260819100000_questionnaire_description_public.sql` (description snapshot
column + public RPC exposure).

## user_public_settings (Settings — Public Page)

One RLS-owned row per MC backing the Public Page settings: the branded
Zebri subdomain and a connected email mailbox (OAuth — Gmail/Outlook).
Kept out of `user_metadata` (JWT-bloat + it's user-writable) in its own
table, same ownership shape as `user_branding`.

Columns: user_id (PK, FK auth.users cascade), subdomain (nullable branded
slug), email_mode (`zebri` | `oauth`, default `zebri`), oauth_provider
(`google` | `microsoft`), oauth_email (connected address; the `from`),
oauth_from_name, **oauth_refresh_token_encrypted** + **oauth_access_token_encrypted**
(AES-256-GCM ciphertext, `v1:<iv>.<tag>.<data>` — never plaintext, never
sent to the client), oauth_token_expires_at, oauth_status (`none` |
`connected` | `failed`, default `none`), oauth_last_error,
oauth_connected_at, created_at, updated_at,
**couple_profile_tabs_config** (jsonb, not null, default
`{"hidden_tabs":[],"tab_order":[]}`).

**time_categories_seeded** (boolean, not null, default false) marks that
the six starter time categories have been created for this user. Keying
off an empty `time_categories` table instead would resurrect them for a
user who deliberately deleted all six. Migration:
`20260730120000_create_couple_time_tracking.sql`.

`couple_profile_tabs_config` is the MC's per-user, global-across-couples layout
for the couple profile tab nav: `hidden_tabs` (tab keys hidden everywhere,
never includes `overview`) and `tab_order` (ordered tab keys; empty means the
code default order). Read/written by
`app/(dashboard)/couples/profile-settings-actions.ts`
(`read`/`updateCoupleProfileTabsConfigAction`) behind the couple-profile gear
"settings mode"; saved when the modal closes. Migration:
`20260627000000_add_couple_profile_tabs_config.sql`.

Subdomain uniqueness: partial unique index on `lower(subdomain) where
subdomain is not null` — global, enforced at the DB level (RLS hides
other tenants' rows, so the server action relies on the 23505 to detect
a clash). RLS: four owner-only policies (`auth.uid() = user_id`). The
encrypted tokens are additionally never selected back to the client by
the loaders/actions.

Read at send time by `resolveSender` (`lib/email/sender-identity`) to
pick each MC's transport (their OAuth mailbox or the shared Zebri/Resend
address), refreshing the access token when expired. Written by the OAuth
callback route + the Public Page server actions
(`app/(dashboard)/settings/public/actions.ts`).

Migrations: `20260621000000_create_user_public_settings.sql`;
`20260817000000_repair_user_public_settings_oauth_columns.sql`. The
repair exists because the prod table pre-dated the create-table
migration (SQL-editor era), so its `create table if not exists` silently
no-opped on prod and the email/OAuth columns never landed there (found
via PGRST204 when the first real mailbox connect tried to save). The
repair re-adds every declared column/index/policy idempotently; it
no-ops on a from-zero database.

------------------------------------------------------------------------

## couple_time_entries / time_categories (Couple profile Time tab)

Per-couple work sessions so an MC can see how much time a couple has
absorbed and charge accordingly. No rates or amounts live here: the
feature reports hours only.

### couple_time_entries

Columns: id (uuid pk), user_id (uuid, not null, fk auth.users, cascade),
couple_id (uuid, not null, fk couples, cascade), started_at (timestamptz,
not null), **ended_at (timestamptz, nullable; null means the timer is
RUNNING)**, category_id (uuid, nullable, fk time_categories, `on delete
set null`), note (text, nullable, max 2000 chars), auto_stopped (boolean,
not null, default false), created_at (timestamptz).

Duration is never stored. It is always `ended_at - started_at`, so
"editing a duration" moves `ended_at`. A manual back-fill is simply a row
created with both timestamps.

Constraint `couple_time_entries_ends_after_start`: `ended_at is null or
ended_at > started_at`.

Indexes:
- `couple_time_entries_user_couple_started_idx (user_id, couple_id,
  started_at desc)`: the Time tab read.
- `couple_time_entries_category_idx (category_id)`: the FK index.
- **`couple_time_entries_one_running_per_user`: unique on `(user_id)
  where ended_at is null`.** This makes "one running timer per user" a
  database invariant: two tabs racing on Start makes the second insert
  fail loudly instead of silently producing two live timers.

RLS: one `for all` policy. `using (auth.uid() = user_id)`, and
`with check (auth.uid() = user_id and exists (select 1 from couples c
where c.id = couple_id and c.user_id = auth.uid()))`. The EXISTS clause
matters because foreign keys ignore RLS: without it a user could log time
against another MC's couple id. Proven by
`tests/integration/couples/time-actions.test.ts`.

`auto_stopped` is set by the 8-hour cap. `getRunningTimerAction` clamps a
session older than 8h to `started_at + 8h` on read and flags it, so a
timer left on overnight logs 8h and is visibly marked for correction. No
cron is involved.

### time_categories

Columns: id (uuid pk), user_id (uuid, not null, fk auth.users, cascade),
name (text, not null, max 40 chars), position (integer, not null, default 0),
**color (text, nullable)**, created_at (timestamptz).

Unique index `time_categories_user_lower_name_key (user_id, lower(name))`
so "Travel" and "travel" cannot both exist and the type-to-create picker
can resolve a typed name to an existing row.

`color` is a user-chosen uppercase `#RRGGBB`, constrained by
`time_categories_color_hex` (`color is null or color ~ '^#[0-9A-F]{6}$'`).
Note this is a **raw hex, not a named palette key** like
`couple_statuses.color` or `task_groups.color`: categories follow the
branding model, where the MC picks any colour through the shared
`ColorPopover`. The original "plain text only" rule was about not adding
a second *fixed* palette beside the couple statuses; a colour the MC
chooses is their own vocabulary, and the Time tab's breakdown bar needs
segments a reader can tell apart.

New categories are assigned the first unused slot of
`DEFAULT_CATEGORY_COLORS` (`lib/time-tracking/colors.ts`) server-side, so
a chart is readable before anyone opens a picker. That order is the
validated categorical order from the dataviz palette and must not be
re-sorted — adjacent pairs are what clear the colour-blind separation
floor. Nullable rather than defaulted, because a row written before the
column existed genuinely has no colour and renders in the neutral fill.

Migration: `20260730140000_time_category_colors.sql`, which also
back-fills existing rows by position.

Deleting a category keeps its sessions and leaves them uncategorised
(`on delete set null`). Deleting a label must never destroy tracked time.

Seeded once per user with Meeting / Call / Admin / Travel / Rehearsal /
Ceremony, gated on `user_public_settings.time_categories_seeded` so a user
who deletes all six does not get them resurrected.

Written by `app/(dashboard)/couples/time-actions.ts`. Migration:
`20260730120000_create_couple_time_tracking.sql`.

------------------------------------------------------------------------

## scripts (Couple profile, Scripts tab)

Per-couple ceremony / reception scripts: the words an MC or celebrant
reads on the day, written as a rich document. Several named scripts per
couple. MC-only: no portal RPC exposes them, the couple never sees them.

Columns: id (uuid pk), user_id (uuid, not null, fk auth.users, cascade),
couple_id (uuid, not null, fk couples, cascade), title (text, not null,
default 'Untitled script', 1..120 chars via Zod), **content (jsonb, not
null; a TipTap document, default an empty paragraph)**, font (text, not
null, default 'noto_serif'; a `ScriptFontId` from
`lib/documents/script-fonts.ts`, validated by Zod so a new face never
needs a migration; always the default today, the toolbar applies
per-selection faces as marks instead), sort_order (integer, not null,
default 0),
created_at, updated_at (trigger `scripts_set_updated_at`).

`content` is stored as UTF-8 JSON, so names with diacritics and CJK text
round-trip untouched; rendering goes through
`lib/documents/script-extensions.ts` (`generateHTML` with the controlled
extension set, then `sanitizeRichHtml`, then variable resolution).

Indexes: `scripts_couple_id_idx (couple_id)`, `scripts_user_id_idx (user_id)`.

RLS: owner-only on every verb (`auth.uid() = user_id`). The insert and
update `with check` clauses also require `exists (select 1 from couples c
where c.id = couple_id and c.user_id = auth.uid())`: a foreign key ignores
RLS, so without it a user could attach a script to another MC's couple.
Proven by `tests/integration/rls/scripts.test.ts` (10 tests).

Migration: `20260830000000_add_scripts_feature.sql`.

## ai_copilot_usage (AI copilot Phase A)

Per-user daily message counter backing the automations AI copilot's
daily cap. DB-backed (not the in-memory limiter) because the cap is a
spend control on a paid third-party API and must survive serverless
cold starts.

Columns: id (uuid pk), user_id (uuid, not null, fk auth.users cascade),
day (date, not null, default UTC today), message_count (integer, not
null, default 0, check >= 0), created_at / updated_at (timestamptz).
Unique (user_id, day).

RLS: **SELECT-only** owner policy (`auth.uid() = user_id`). There are
deliberately no INSERT/UPDATE/DELETE policies — a user must not be able
to reset their own counter through PostgREST. The only write path is
`increment_ai_copilot_usage()` (SECURITY DEFINER, granted to
`authenticated`), which upserts today's row for `auth.uid()` and
returns the new count; the copilot route compares that against the
app-side cap.

Migration: `20260807000000_create_ai_copilot_usage.sql`.

------------------------------------------------------------------------

## calendar_connections (Scheduler Phase A)

Per-user OAuth calendar connections for syncing events with Google
Calendar and Microsoft Outlook. Stores encrypted tokens, provider
identity, and connection status.

Columns:
id (uuid, primary key, default gen_random_uuid())
user_id (uuid, not null, FK auth.users cascade)  -  RLS key
provider (text, not null, check in: google | microsoft)  -  OAuth provider
account_email (text, not null)  -  connected email address (from OAuth userinfo)
access_token_encrypted (text, not null)  -  AES-256-GCM ciphertext (`v1:<iv>.<tag>.<data>`) via `lib/crypto/secret-box`, key `EMAIL_CRED_KEY`
refresh_token_encrypted (text, not null)  -  AES-256-GCM ciphertext, server-only decryption
token_expires_at (timestamptz, not null)  -  access token expiry; used to refresh before callback
status (text, not null, default 'connected', check in: connected | error)  -  connection health
last_error (text, nullable)  -  most recent error message when status = error
calendar_id (text, nullable)  -  provider primary calendar ID (Google: 'primary' by default; Microsoft: Outlook folder id)
connected_at (timestamptz, default now())  -  when the connection was first established
created_at (timestamptz, default now())
updated_at (timestamptz, default now())

Unique constraint (user_id, provider): one per provider per user.
Index on (user_id) for fast owner lookups.

RLS: Standard owner-only policy `auth.uid() = user_id` (SELECT/INSERT/UPDATE/DELETE). Encrypted token columns are safe for client SELECT because the ciphertext is never decrypted client-side; decryption happens only in server-side token-refresh flows.

Migration: `20260818000000_create_calendar_connections.sql`.

## meeting_types (Scheduler Phase B)

Bookable meeting types (Calendly-style) with duration, location, buffers, and notice windows. Each meeting type has a share_token for the Phase C public booking page.

Columns:
id (uuid, primary key)
user_id (uuid, not null, FK auth.users cascade)  -  RLS key
name (text, not null)
description (text, nullable)
duration_minutes (integer, not null, check 5-480)  -  slot duration
location_type (text, not null, default 'video', check in: video | phone | in_person)
address (text, nullable)  -  physical address for in_person meetings
buffer_before_minutes (integer, not null, default 0, check 0-240)  -  buffer before slot
buffer_after_minutes (integer, not null, default 0, check 0-240)  -  buffer after slot
min_notice_hours (integer, not null, default 24, check 0-720)  -  minimum advance booking notice
max_advance_days (integer, not null, default 60, check 1-365)  -  maximum days in advance to allow bookings
reminder_enabled (boolean, not null, default true)
active (boolean, not null, default true)
uses_custom_availability (boolean, not null, default false)  -  when true the slot engine reads meeting_type_availability_rules for this type instead of the MC's availability_rules
share_token (uuid, not null, unique, default gen_random_uuid())  -  capability token for Phase C public /book page
created_at, updated_at (timestamptz)

Index: (user_id) for fast owner lookups.

RLS: Standard owner-only policy `auth.uid() = user_id` (SELECT/INSERT/UPDATE/DELETE).

Migrations: `20260819000000_create_scheduling_tables.sql`, `20260821010000_meeting_type_availability.sql` (uses_custom_availability).

## availability_rules (Scheduler Phase B)

The MC's weekly repeating availability window(s). One row per (weekday, time-window) pair. Times are stored as wall-clock (HH:MM) and interpreted in the MC's timezone (user_public_settings.timezone).

Columns:
id (uuid, primary key)
user_id (uuid, not null, FK auth.users cascade)  -  RLS key
weekday (smallint, not null, check 0-6)  -  0=Sunday, 6=Saturday
start_time (time, not null)  -  window start as HH:MM
end_time (time, not null)  -  window end as HH:MM; constraint enforces start_time < end_time
created_at (timestamptz, default now())

An MC can define multiple windows per weekday (e.g. 9am-12pm and 2pm-5pm). The table has no uniqueness constraint on (user_id, weekday): multiple rows with the same weekday are allowed.

These are the MC's standard hours, used by every meeting type except those with `uses_custom_availability` set (see meeting_type_availability_rules).

Index: (user_id) for owner lookups.

RLS: Standard owner-only policy `auth.uid() = user_id`.

Migration: `20260819000000_create_scheduling_tables.sql`.

## meeting_type_availability_rules

One meeting type's own weekly windows, same shape as availability_rules but scoped to a type rather than the MC. Read only when `meeting_types.uses_custom_availability` is true, and they REPLACE the standard hours for that type rather than narrowing them, which is what makes "Saturdays only" or "weeknights after six" expressible.

Columns:
id (uuid, primary key)
user_id (uuid, not null, FK auth.users cascade)  -  RLS key
meeting_type_id (uuid, not null, FK meeting_types cascade)  -  the type these hours belong to
weekday (smallint, not null, check 0-6)  -  0=Sunday, 6=Saturday
start_time (time, not null)
end_time (time, not null)  -  constraint enforces start_time < end_time
created_at (timestamptz, default now())

A custom schedule with no rows is legal and means the type is never bookable. That is why `uses_custom_availability` is a column rather than being inferred from row count.

Date overrides are NOT per-type: `availability_overrides` stays user-level, so a blocked wedding day blocks every meeting type.

Indexes: (user_id), (meeting_type_id).

RLS: owner-only `auth.uid() = user_id` on all four verbs, plus `_owns_meeting_type(meeting_type_id)` in the INSERT and UPDATE `with check`. Foreign keys are checked with elevated privileges and ignore RLS, so without that clause an MC could attach hours to another MC's meeting type.

Written by `updateMeetingTypeAction` / `createMeetingTypeAction` (replace-all) when the payload carries an `availability` object; an absent `availability` leaves the rows alone.

Migration: `20260821010000_meeting_type_availability.sql`.

## availability_overrides (Scheduler Phase B)

Per-date availability exceptions. One row per date, either blocking the entire day (available=false, times null) or opening a custom window (available=true, start_time+end_time set). Unique (user_id, date) constraint prevents duplicate entries.

Columns:
id (uuid, primary key)
user_id (uuid, not null, FK auth.users cascade)  -  RLS key
date (date, not null)
available (boolean, not null)  -  true=custom window, false=blocked day
start_time (time, nullable)  -  custom window start; required when available=true
end_time (time, nullable)  -  custom window end; required when available=true
check enforces XOR: (available and times set) or (not available and times null)
created_at (timestamptz, default now())

Unique (user_id, date): one entry per MC per date.

Index: (user_id) for owner lookups.

RLS: Standard owner-only policy `auth.uid() = user_id`.

Migration: `20260819000000_create_scheduling_tables.sql`.

## user_public_settings.timezone (Scheduler Phase B)

Column added to the existing user_public_settings table:

timezone (text, nullable)  -  IANA timezone (e.g. 'Australia/Sydney', 'America/New_York'). Null until the MC first saves availability. The availability editor seeds it from the browser's local timezone.

Times in availability_rules and availability_overrides are wall-clock in this timezone. Migration: `20260819000000_create_scheduling_tables.sql`.

## bug_reports (in-app feedback)

Feedback submitted from the assistant dock on every dashboard page. This table is the source of truth, not Notion: the row is written before the Notion push runs, so an outage, a revoked token or a rate-limit never loses a report. The Notion task in Tasks Tracker is a mirror.

Columns:
id (uuid, primary key)
user_id (uuid, not null, FK auth.users cascade)  -  RLS key (the MC who filed it)
title (text, not null)  -  the MC's one-line summary; becomes the Notion Task name
description (text, not null)  -  the MC's own words; becomes "Concern (as raised)" in the page body
report_type (text, not null, check in: Bug | Feature | Improvement)  -  maps to the Notion Type select
screenshot_filename (text, nullable)  -  filename only; the image is relayed straight into Notion and never stored by us
page_url (text, not null)  -  absolute URL they were on
route_path (text, not null)  -  pathname, for grouping reports by surface
user_agent (text, nullable)  -  raw header, read server-side so it cannot be forged
viewport_width, viewport_height (integer, nullable)  -  browser-reported
build_sha (text, nullable)  -  VERCEL_GIT_COMMIT_SHA, or 'local'
notion_page_id (text, nullable)  -  set once the Notion task exists
notion_page_url (text, nullable)  -  deep link to the task
notion_ticket_ref (text, nullable)  -  human reference, e.g. 'ZEB-42'; echoed back to the MC in the success toast
notion_sync_status (text, not null, default 'pending', check in: pending | synced | failed)
notion_sync_error (text, nullable)  -  why Notion refused it; there is no retry, the Slack alert carries the full text for manual re-filing
created_at, updated_at (timestamptz)

Indices:
- (user_id) for owner lookups
- (created_at) partial, where notion_sync_status <> 'synced'  -  the only query that scans across owners

RLS: owner-scoped SELECT, INSERT and UPDATE (auth.uid() = user_id). Deliberately no DELETE policy: a filed report is a record, not a draft the reporter can withdraw.

Migration: `20260828007000_create_bug_reports.sql`

## bookings (Scheduler Phase C)

Public booking records created by the submit_booking RPC (never inserted via normal SQL). Stores the booker's details, slot timing, and manage/external event tokens.

Columns:
id (uuid, primary key)
user_id (uuid, not null, FK auth.users cascade)  -  RLS key (the MC who owns the slot)
meeting_type_id (uuid, not null, FK meeting_types cascade)  -  the booked meeting type
couple_id (uuid, nullable, FK couples set null)  -  matched or created couple; null if plan-limited
name (text, not null)  -  booker's primary name
partner_name (text, nullable)  -  booker's partner name
email (text, not null)  -  booker's email
phone (text, nullable)  -  booker's phone
notes (text, nullable)  -  booker's free-text notes
starts_at (timestamptz, not null)  -  slot start time (UTC)
ends_at (timestamptz, not null)  -  slot end time (UTC); constraint enforces starts_at < ends_at
timezone (text, not null)  -  booker's IANA timezone for rendering times in email/manage
status (text, not null, default 'confirmed', check in: confirmed | cancelled | completed)
manage_token (uuid, not null, unique)  -  capability token for Phase D manage (reschedule/cancel) page
video_join_url (text, nullable)  -  Zoom/Teams/Meet URL for video meetings, populated by event-push automation
external_event_ids (jsonb, not null, default '{}')  -  per-provider event ids e.g. {"google": "event-id-123"}; used by reschedule/cancel (Phase D)
cancelled_at (timestamptz, nullable)  -  when the booking was cancelled
reminder_sent_at (timestamptz, nullable, Phase D)  -  tracks when the reminder email was sent; cleared on reschedule so new time gets its own reminder
created_at, updated_at (timestamptz)

Indices:
- (user_id) for owner lookups
- (meeting_type_id) for type lookups
- (couple_id) for couple lookups
- (starts_at) for chronological sorting
- (share_token) on meeting_types for public page lookups

Constraint: bookings_no_confirmed_overlap (exclusion, using gist)
Enforces that no two confirmed bookings for the same user (user_id) can overlap in time (tstzrange). The constraint uses:
- EXCLUDE USING gist (user_id WITH =, tstzrange(starts_at, ends_at) WITH &&) WHERE (status = 'confirmed')
This is the final arbiter of double-booking prevention. Requires the btree_gist extension (created in migration).

RLS: owner-only `auth.uid() = user_id` on all four verbs, plus a parent-ownership guard on writes: `with check (... and _owns_couple_or_null(couple_id) and _owns_meeting_type(meeting_type_id))`. Foreign keys are checked with elevated privileges and ignore RLS, so the plain owner check still accepted a booking referencing another MC's couple or meeting type, which links across tenants and confirms the id exists. `couple_id` is nullable so null stays allowed; `meeting_type_id` is not null so it is always checked. Same class of hole as the `couples.selected_package_id` and `couple_time_entries.couple_id` guards. The submit_booking RPC is SECURITY DEFINER and resolves both parents from the share token itself, so it bypasses RLS on insert and is unaffected. Proved by `tests/integration/rls/bookings.test.ts`. Migration: `20260821040000_bookings_parent_ownership_guard.sql`.

Trigger: tg_bookings_emit_consultation_booked
On INSERT, if status='confirmed', emits a consultation_booked automation event (feeds the automation trigger bus). See automations documentation.

Migrations: `20260820000000_create_bookings.sql`, `20260821040000_bookings_parent_ownership_guard.sql`.

## Public Booking RPCs (Scheduler Phase C)

Two SECURITY DEFINER functions (anon-callable) gate the public booking flow:

### get_public_booking_page(token uuid) -> jsonb

Fetches page data for the share-token public booking form. Returns null for a missing/disabled token (no existence leak).

Returns jsonb object:
{
  "name": "Consultation",  -  meeting type name
  "description": "30-minute consultation",  -  nullable
  "duration_minutes": 30,
  "location_type": "video",
  "address": null,  -  only meaningful for in_person
  "business_name": "MC Business Name",
  ...branding scalars (surface_color, text_color, etc., merged from _user_branding)
}

Joins meeting_types, auth.users, and calls _user_branding(mc_user_id) to merge MC branding.

Behavior:
- Returns null if token not found or meeting_type.active=false
- Merges MC's branding scalars (surface_color, heading_color, fonts, etc.) via _user_branding()
- Uses coalesce on business_name (raw_user_meta_data->>'business_name' or display_name or '')

Error handling:
- Missing token: returns null (no existence leak)

Rate limiting: none at the RPC boundary (route-level rate-limit applies).

Migration: `20260820001000_booking_rpcs.sql`.

### submit_booking(token, p_starts_at, p_ends_at, p_timezone, p_name, p_email, p_partner_name?, p_phone?, p_notes?) -> jsonb

Validates the token, timing, and duration, then creates a booking. Couple match by email (case-insensitive), with exception handling for plan limits.

Parameters:
- token (uuid): meeting type share_token
- p_starts_at (timestamptz): requested slot start (UTC)
- p_ends_at (timestamptz): requested slot end (UTC)
- p_timezone (text): booker's IANA timezone
- p_name (text): booker's primary name
- p_email (text): booker's email (case-insensitive couple match)
- p_partner_name (text, optional): booker's partner name
- p_phone (text, optional): booker's phone
- p_notes (text, optional): free-text notes

Response (success):
{
  "ok": true,
  "booking_id": "uuid",
  "manage_token": "uuid",  -  capability token for Phase D manage page
  "user_id": "mc's user_id",  -  for alerting/logging
  "couple_id": "uuid or null",  -  null if plan-limit exception
  "couple_created": boolean,  -  true if new couple was created
  "couple_linked": boolean,  -  true if couple was matched or created
  "business_name": "MC Business Name"  -  for confirmation email
}

Response (error):
{
  "error": "<type>"
}

Error results:
- "not_found": token not found or inactive
- "invalid": p_starts_at >= p_ends_at, starts_at in past, or duration mismatch (>60sec off expected)
- "rate_limited": >6 confirmed bookings for this meeting type in the last hour
- "slot_taken": exclusion constraint violation (double-booking guard); booker should retry with different time

Rate limiting (in-RPC):
- Counts confirmed bookings for meeting_type_id created in last hour
- Returns "rate_limited" if >= 6 (per-type hourly cap)
- Note: route-level IP rate-limit (5/min) is also enforced by the API layer

Validation:
1. Token and active meeting type resolution; return not_found if missing
2. Range validation: p_starts_at < p_ends_at, p_starts_at > now()
3. Duration validation: |actual - expected| <= 60 seconds (tolerates rounding)
4. Couple match by email (case-insensitive, primary_email or legacy email, ordered by created_at)
5. If no couple match, attempt insert (wrapped in exception handler for plan-limit)
   - Plan limit exception (STARTER_COUPLE_LIMIT) leaves couple_id null and couple_linked false; booking still inserts
   - Other exceptions re-raise
6. Booking insert (status='confirmed'); wrapped in exception handler for exclusion_violation (double-booking)
   - Exclusion violation returns {"error": "slot_taken"}
   - consultation_booked trigger fires on successful insert

Couple creation (if no match):
- Resolves landing status: first couple_statuses row by position, else 'new'
- Inserts couple with lead_source='booking', status=resolved
- Nullifies empty strings (partner_name, phone, notes)

Security:
- SECURITY DEFINER: bypasses RLS on insert
- MC email is NOT returned to anon (harvesting risk via share tokens)
- Route fetches mc_email server-side for alert/email headers

Migration: `20260820001000_booking_rpcs.sql`.

## Booking Lifecycle RPCs (Scheduler Phase D)

Four SECURITY DEFINER functions manage the booking lifecycle on the public manage page (anon-callable, capability-token-gated), plus one service-role-only function for the reminder cron:

### get_booking_by_manage_token(token uuid) -> jsonb

Fetches booking details for the manage page. Returns null for a missing token (no existence leak).

Returns jsonb object:
{
  "booking_id": "uuid",
  "status": "confirmed|cancelled|completed",
  "starts_at": "2026-09-15T10:00:00Z",
  "ends_at": "2026-09-15T10:30:00Z",
  "timezone": "Australia/Sydney",
  "name": "Booker Name",
  "email": "booker@example.com",
  "video_join_url": "https://zoom.us/...",
  "business_name": "MC Business Name",
  "meeting_type": {
    "id": "uuid",
    "name": "Consultation",
    "description": "30-minute consultation",
    "duration_minutes": 30,
    "location_type": "video",
    "address": null
  },
  "share_token": "uuid",
  ...branding scalars
}

Critical: never returns user_id or MC's email (auth.users.email is server-secret).
Merges meeting_type fields and MC branding via _user_branding().

Error: returns null for unknown token (no existence leak).

Grant: anon (callable from public manage page).

Migration: `20260821000000_booking_lifecycle.sql`.

### cancel_booking(p_manage_token uuid) -> jsonb

Anon-callable. Flips a booking to cancelled and emits booking_cancelled automation event.

Parameters:
- p_manage_token (uuid): manage page capability token

Response (success):
{
  "ok": true,
  "booking_id": "uuid",
  "user_id": "mc's user_id",
  "starts_at": "2026-09-15T10:00:00Z",
  "ends_at": "2026-09-15T10:30:00Z",
  "timezone": "Australia/Sydney",
  "name": "Booker Name",
  "email": "booker@example.com",
  "business_name": "MC Business Name",
  "external_event_ids": {...},
  "meeting_type_id": "uuid",
  "video_join_url": "https://meet.google.com/...",
  "meeting_type_name": "Consultation"
}

`meeting_type_id` is what callers resolve the meeting type on. `lib/booking/lifecycle.ts` needed the location fields for the cancel email and only had the NAME, so it read `meeting_types where name = <name>` on the service-role client: `meeting_types.name` has no uniqueness constraint and "Consultation" is the default template name, so that either matched several tenants (silently falling back to "in person" with no address) or matched one other MC and put their venue address in a booker's inbox. Added by `20260821030000_booking_lifecycle_meeting_type_id.sql`.

Response (error):
{
  "error": "not_found|already_cancelled|past"
}

Error conditions:
- "not_found": token not found
- "already_cancelled": booking status is already cancelled
- "past": ends_at is in the past (cannot cancel past meetings)

Payload emitted (booking_cancelled):
{
  "booking_id": "uuid",
  "couple_id": "uuid|null",
  "meeting_type_id": "uuid",
  "booker_name": "text",
  "booker_email": "text",
  "starts_at": "timestamptz",
  "ends_at": "timestamptz",
  "timezone": "text"
}

Grant: anon (callable from public manage page).

Migration: `20260821000000_booking_lifecycle.sql`.

### reschedule_booking(p_manage_token uuid, p_starts_at timestamptz, p_ends_at timestamptz) -> jsonb

Anon-callable. Moves a booking's time in place and clears reminder_sent_at so the new time gets its own reminder.

Parameters:
- p_manage_token (uuid): manage page capability token
- p_starts_at (timestamptz): new slot start (UTC)
- p_ends_at (timestamptz): new slot end (UTC)

Response (success):
{
  "ok": true,
  "booking_id": "uuid",
  "user_id": "mc's user_id",
  "previous_starts_at": "2026-09-15T10:00:00Z",
  "starts_at": "2026-09-16T14:00:00Z",
  "ends_at": "2026-09-16T14:30:00Z",
  "timezone": "Australia/Sydney",
  "name": "Booker Name",
  "email": "booker@example.com",
  "business_name": "MC Business Name",
  "external_event_ids": {...},
  "meeting_type_id": "uuid",
  "video_join_url": "https://meet.google.com/...",
  "meeting_type_name": "Consultation"
}

`meeting_type_id` scopes the caller's meeting-type read (see cancel_booking
above). `video_join_url` rides along because rescheduling moves the times in
place and the meeting keeps its link: the reschedule email hard-coded null and
told a couple whose Meet link had not changed that a link was "to follow".
Both added by `20260821030000_booking_lifecycle_meeting_type_id.sql`.

Response (error):
{
  "error": "not_found|cancelled|past|slot_taken|invalid"
}

Error conditions:
- "not_found": token not found
- "cancelled": booking status is cancelled
- "past": ends_at is in the past (cannot reschedule past meetings)
- "invalid": p_starts_at >= p_ends_at, p_starts_at in past, or duration mismatch (>60sec off expected)
- "slot_taken": exclusion constraint violation (another confirmed booking occupies this range)

Validation:
1. Token and booking resolution
2. Guard against cancelled/past bookings
3. Range validation: p_starts_at < p_ends_at, p_starts_at > now()
4. Duration validation: |actual - expected| <= 60 seconds
5. Update with exclusion constraint handling (returns slot_taken on violation)

The partial exclusion constraint only checks OTHER confirmed rows, so a booking can reschedule onto its own current range.

Grant: anon (callable from public manage page).

Migration: `20260821000000_booking_lifecycle.sql`.

### bookings_due_for_reminder() -> setof jsonb

Service-role only (cron). Returns confirmed bookings due for reminder notification.

Returns array of jsonb objects (one per booking):
{
  "booking_id": "uuid",
  "manage_token": "uuid",
  "user_id": "mc's user_id",
  "name": "Booker Name",
  "email": "booker@example.com",
  "starts_at": "2026-09-15T10:00:00Z",
  "ends_at": "2026-09-15T10:30:00Z",
  "timezone": "Australia/Sydney",
  "video_join_url": "https://zoom.us/...",
  "business_name": "MC Business Name",
  "meeting_type_name": "Consultation",
  "location_type": "video",
  "address": null
}

`manage_token` (added by `20260821030000`) is what the reminder email's
reschedule link is built from. `/book/manage/[manage_token]` resolves through
`get_booking_by_manage_token`, so the cron's earlier `/book/manage/<booking_id>`
404d into the unavailable state and every reminder shipped a dead link.

Selection criteria (all must match):
- status = 'confirmed'
- meeting_type.reminder_enabled = true
- starts_at > now()
- starts_at <= now() + 36 hours
- reminder_sent_at is null

Grant: service_role (cron only).

Migration: `20260821000000_booking_lifecycle.sql`.

### mark_booking_reminder_sent(p_booking_id uuid) -> void

Service-role only (cron). Sets reminder_sent_at = now() to mark a booking as having been reminded.

Parameters:
- p_booking_id (uuid): booking to mark

Grant: service_role (cron only).

Migration: `20260821000000_booking_lifecycle.sql`.

## Contract signing + money-surface columns (2026-09-03)

Six migrations, `20260903000000` through `20260903005000`. Every column
added defaults to the behaviour that existed before it, so no existing
row changes meaning.

### `contracts`
| Column | Type | Default | Purpose |
|---|---|---|---|
| `signing_mode` | text | `'parallel'` | `'sequential'` holds each client signer until lower `signing_order` clients have signed |
| `require_signer_otp` | boolean | false | Gate signing behind an emailed 6-digit code |
| `document_hash` | text | null | Hex SHA-256 over the executed facts, set once at completion |
| `document_hash_algo` | text | null | Recipe version (`zebri-sha256-v1`) so a v2 can coexist |
| `document_hash_at` | timestamptz | null | When the hash was taken |

### `contract_signers`
| Column | Type | Default | Purpose |
|---|---|---|---|
| `signature_mode` | text | `'typed'` | `'drawn'` means `signature_image` holds the mark |
| `signature_image` | text | null | Base64 PNG data URL, CHECK-capped at 128KB |
| `otp_verified_at` | timestamptz | null | Last successful code verification; `sign_contract_v2` requires it within 30 minutes |

### `contract_signer_otps` (new)
One-time codes. Stores `code_hash` + `code_salt` only, never the code.
RLS: owner SELECT only (an MC asking "did their code go out?" is a real
support need, and the row exposes only a hash). **No insert/update/delete
policy** — the only writers are the definer RPCs, granted to
`service_role` alone. See `security.md`.

### `user_public_settings`
| Column | Type | Purpose |
|---|---|---|
| `mc_signature_image` | text | The MC's drawn signature, snapshotted onto `contract_signers` at send |

Deliberately **not** on `user_metadata`: `_user_branding` reads
`raw_user_meta_data` onto every public surface, and `user_metadata` is
serialised into the JWT and is user-writable. A 100KB access token is
not acceptable.

### `invoice_items` / `invoice_template_items`
| Column | Type | Purpose |
|---|---|---|
| `note` | text | Optional per-line note, rendered under the description on the public invoice and PDF |

### `packages`
| Column | Type | Default | Purpose |
|---|---|---|---|
| `pricing_mode` | text | `'itemised'` | `'single'` makes line items unpriced inclusions |
| `fixed_price` | numeric(10,2) | null | The whole base price in `single` mode |

### `contract_audit_log`
`event_type` CHECK gained `'invite_sent'` and `'identity_verified'`.

### Functions
- `sign_contract_v2(uuid, jsonb)` / `decline_contract_v2(uuid, jsonb)` —
  the canonical entry points. The old positional names are forwarders.
  **Add payload keys, never parameters** (see `contracts.md`).
- `issue_signer_otp` / `peek_signer_otp` / `fail_signer_otp` /
  `consume_signer_otp` — `service_role` ONLY, anon and authenticated
  explicitly revoked.
- `_ip_prefix(text)` — /24 or /48 redaction for the public audit trail.
  No anon grant; called only inside the definer function.
- `_contract_canonical_payload(uuid)` — the deterministic string the
  document hash is taken over.
- `verify_contract_hash(text)` — public fingerprint lookup, by hash only,
  returning no document content.
- Dropped: the stale `decline_contract(uuid, text)` overload.


------------------------------------------------------------------------

# Workflows (2026-09)

Full feature doc: `.claude/docs/workflows.md`. Migrations
`20260905000000` (foundation), `20260905000100` (apply-rule triggers),
`20260905000200` (helper RPCs), `20260906000000` (converter),
`20260907000000` (freeze).

An applied workflow instance IS the run. Templates are authored once;
applying one **snapshots** its steps into rows the couple owns, so
editing a template never disturbs live work.

## `workflow_tags`

`id`, `user_id`, `name`, `color`, `position`. Case-insensitive unique
index on `(user_id, lower(name))`.

## `workflow_templates`

`id`, `user_id`, `name`, `description`, `status` (`draft` | `active` |
`archived`), `apply_rule_type` (`manual` | `on_couple_created` |
`on_stage_changed` | `on_package_applied` | `on_event`),
`apply_rule_config` jsonb, `allow_reapply`, `quiet_hours_start/end`,
`branch_depth_limit`, `canvas_viewport` jsonb, `version`, and
`exit_statuses` (`text[] not null default '{}'`, added
`20261012000000`).

`exit_statuses` lists the stages (`couple_statuses.slug`, lower-cased)
that stop the workflow for a couple who moves into one. The dispatcher
applies it through `exit_workflow_instances_for_stage(p_user_id,
p_couple_id, p_to_status)` (`security invoker`, execute granted to
`service_role` only): it locks the owner's matching templates `for
share`, then cancels the couple's `active` and `paused`, non-default,
non-personal instances of them with `cancelled_reason = 'exit_rule'`,
returning `(instance_id, couple_id, workflow, stage)` for the audit rows.
The app refuses an exit stage the template's own stage-changed rule
starts on.

Converter columns: `legacy_automation_id` (unique where not null),
`template_slug` (starter-library provenance).

There is no `paused` status. Draft and active cover what three did.

## `workflow_template_tags`

Join table. Its RLS checks **both** sides: a foreign key does not
enforce ownership, so an owner-only `with check` would still let a user
tag their template with another tenant's tag.

## `workflow_template_steps`

`id`, `template_id`, `position`, `type` (`todo` | `appointment` |
`action` | `wait` | `branch`), `config` jsonb, `title`, `description`,
`timing` jsonb, `parent_step_id`, `branch_path` (`yes` | `no`),
`requires_approval`, `visible_to_couple`, `disabled`, `canvas_x`,
`canvas_y`, plus `legacy_action_id`.

`canvas_x` / `canvas_y` are **nullable** (migration `20260910000000`).
They shipped `not null default 0`, which meant every step carried a
position and the builder's auto-layout, which only places a step
*without* one, never ran: whole workflows rendered stacked at a single
point. Null means "lay me out"; a number means "the MC dragged me
here". Presentation only, so run order is untouched by either.

`canvas_x` / `canvas_y` are **nullable** (migration `20260910000000`).
They shipped `not null default 0`, which meant every step carried a
position and the builder's auto-layout, which only places a step
*without* one, never ran: whole workflows rendered stacked at a single
point. Null means "lay me out"; a number means "the MC dragged me
here". Presentation only, so run order is untouched by either.

CHECK `workflow_template_steps_branch_consistency`: `parent_step_id`
and `branch_path` are both null or both set.

An `action` step stores the old action slug in `config.actionType`.

## `workflow_instances`

`id`, `user_id`, `couple_id` (nullable — a personal instance has none),
`template_id` (nullable, ad-hoc instances have none), `name`,
`template_version`, `status` (`active` | `paused` | `completed` |
`cancelled`; `paused` added `20261007000000`),
`is_default`, `is_personal`, `trigger_event_id`, `context` jsonb,
`applied_at`, `completed_at`, `error_message`, `dedupe_key` (uuid,
nullable, added `20261003000000`), `paused_reason` (text, nullable,
CHECK `template_off` | `manual`, added `20261008000000`),
`cancelled_reason` (text, nullable, CHECK `manual` | `template_deleted`
| `setup_interrupted` | `exit_rule`, added `20261011000000`).
`needs_recompute_at` (timestamptz, nullable, added `20261023500000`):
stamped when the bookkeeping after one of the instance's finished steps
failed (output merge, branch skip, re-dating, completion); the tick's
heal pass redoes it and clears the stamp. Partial index
`workflow_instances_needs_recompute_idx` on `(id)` where it is not null.
Since `20261024000000` the BEFORE UPDATE OF status trigger
`workflow_instances_clear_marker` nulls it when the instance becomes
`completed` or `cancelled` (the heal can do nothing for one), and a heal
that fails pushes it five minutes into the future
(`HEAL_RETRY_BACKOFF_MS`), so the finder, which names only markers
`<= now()`, does not retry it every minute.

`workflow_merge_step_outputs(p_instance_id, p_outputs jsonb,
p_keep_existing default false) → void` (`20261023900000`, `security
invoker`, service role only) merges step outputs into
`context.step_outputs` in one UPDATE (`jsonb_set` with `||`), so two
writers merging into the same instance keep both keys. With
`p_keep_existing` (the heal) an existing key is never replaced. A
non-object `p_outputs` raises `22023`.

`cancelled_reason` says why a cancelled instance was stopped. Every
cancel path sets it; resume clears it; rows stopped before it existed
are null. Resume refuses `setup_interrupted`, any instance with a null
`template_id`, and any whose template is not `active`. The flip is
`resume_workflow_instance(p_instance_id, p_from)` (`20261011100000`,
`security invoker`, execute granted to `authenticated` and
`service_role`): it locks the instance in `p_from`, reads its template
`for share`, and sets `active` (clearing both reasons and
`completed_at`) only while the template is `active`. Returns `active`,
`template_off`, `template_missing`, or null. The AFTER UPDATE OF status trigger
`workflow_instances_cancel_steps` (`_workflow_instance_cancel_steps()`,
`security invoker`) marks the instance's `pending` and `waiting` steps
`cancelled` in the same statement that flips it to `cancelled`.

`dedupe_key` holds the template id when an automatic apply must be
unique for the couple, else null; null never collides, so a personal
instance, an ad-hoc apply, or a template with `allow_reapply` set are
all free to repeat. Backing this is a partial unique index on
`(couple_id, dedupe_key) where dedupe_key is not null and status <>
'cancelled'`, which replaced a check-then-insert race that let two bus
events in the same tick open two instances (and send every email
twice) for the same couple.

Partial unique indexes: one default per couple, one personal per user,
one instance per trigger event (so a re-delivered bus event cannot open
a duplicate), one per `(couple_id, dedupe_key)` as above.

A DB trigger creates the default ("General") instance in the same
transaction as the couple INSERT, so there is never a couple with
nowhere to put a to-do.

`paused` is the per-instance reversible stop. The executor only runs
steps on `active` instances, so nothing on a paused one fires; the
dedupe index still counts it (it is `status <> 'cancelled'`), so a
paused enrolment blocks a duplicate apply. It is not the account-wide
pause, which is a separate switch.

`paused_reason` says why a paused instance is paused: `template_off`
when the MC turned the workflow off, `manual` when they paused the
couple by hand. Turning the workflow back on offers to resume only
`template_off` rows. Resume clears it; a row cancelled while paused
keeps it, which is inert because the offer reads `status = 'paused'`.

Template on/off and delete go through two `security invoker` functions
(`20261008100000`; `delete_workflow_template` is granted to
`authenticated` and `service_role`, revoked from `anon`):
`set_workflow_template_status(p_template_id, p_status,
p_expected_steps_revision default null)` (replaced in `20261023600000`,
then in `20261024200000`, **service role only**) takes the template row
lock `for update`, and for a Turn on requires the `steps_revision` the
caller's pre-flight read, refusing with SQLSTATE `WF002` when it moved
(`22023` when it is not passed, `P0002` when the template is gone); it
then flips the status and, whenever the
target is not `active`, pauses the template OWNER's `active` instances
(`template_off`) in the same transaction (`i.user_id` = the template's
owner, since the service role is not RLS-scoped);
`delete_workflow_template(p_template_id)` cancels its `active` and
`paused` instances (reason `template_deleted` since `20261011000000`),
then deletes it. Both return the rows they changed
(`instance_id`, `user_id`, `couple_id`). The BEFORE INSERT trigger
`workflow_instances_refuse_off_template` refuses an insert with a
`trigger_event_id` whose template is not `active` (SQLSTATE `WF001`).

`workflow_templates.steps_revision` (bigint, not null, default 0,
added `20261024200000`) is bumped by the AFTER ROW trigger
`workflow_template_steps_bump_revision` (security definer, empty
search_path, since `20261024400000`: a cascade from `auth.users` fires
it as `supabase_auth_admin`, which cannot update `workflow_templates`,
and a user delete failed; it also skips a template that is gone) in the
same transaction as every
insert, update or delete of one of the template's steps. The Turn on
pre-flight and the hand apply read it first; the flip and `applyTemplate`
refuse when it moved. A side effect: every step edit also bumps the
template's `updated_at` through its own update trigger. Only that
trigger writes the column: the BEFORE INSERT OR UPDATE trigger
`workflow_templates_guard_steps_revision` (`20261024300000`) refuses
(`42501`) an insert with a non-zero revision and any update that changes
it, from every role, unless the write comes from inside another trigger
(`pg_trigger_depth() > 1`, which only the bump reaches).

The BEFORE INSERT OR UPDATE OF status trigger
`workflow_templates_activation_lock` (`20261023600000`, Task 34; an
allowlist since `20261024200000`) refuses a template's `status` becoming
`active` unless `current_user` is `service_role`, `postgres` or
`supabase_admin` (SQLSTATE `42501`). Turn on goes only through
`setTemplateStatusAction`, which runs the pre-flight and flips with the
service role. Draft inserts, moves to draft or archived, and edits of a
template already on are unaffected, as are the service role and
migrations.

`activate_applied_workflow_instance(p_instance_id, p_require_active)`
(`20261010000000`, `security invoker`, execute granted to
`service_role` only) is the last step of `applyTemplate`: a new
instance is inserted `paused` with a null `paused_reason` and flipped
live here once its past-dated steps are skipped. It touches only an
instance still `paused` with a null reason. With `p_require_active`, it
locks the template `for share` (serialising with
`set_workflow_template_status`) and, if the template is no longer
`active`, sets `paused_reason = 'template_off'` instead of flipping.
Returns `active`, `paused`, or null.

## `workflow_steps`

The snapshot the MC works. Same shape as a template step plus `due_at`,
`status` (`pending` | `running` | `waiting` | `done` | `skipped` |
`errored` | `cancelled`; `cancelled` added `20261011000000`: an
unstarted step whose workflow was stopped, never run, never re-dated,
restored to `pending` on resume), `approval_token`, `approval_expires_at`, `completed_at`,
`error_message`, `output` jsonb, `legacy_task_id`, and `attempt_count`
(int, default 0, added `20261003100000`), and `due_held_at`
(timestamptz, nullable, added `20261023700000`).

`skip_reason` (text, nullable, CHECK `'branch'`, added `20261024300000`)
is `'branch'` when the branch logic skipped the step (a lane not taken,
or everything under a skipped branch, `lib/workflows/branch-skip.ts`).
Reopening a branch restores only those; a step skipped by the MC, a
resume or an apply carries null and stays skipped. The BEFORE INSERT OR
UPDATE trigger `workflow_steps_skip_and_hold_rules`
(`_workflow_steps_skip_and_hold_rules()`, `security invoker`) nulls it
on any step that is not `skipped`, and nulls `due_held_at` on a step
that becomes `done` or is skipped for any reason but a branch.

`due_held_at` is the MC's hold: set when they take a step's date off
(`rescheduleStepAction` with a null date, or an undated ad-hoc to-do),
cleared when they set a date. Every recompute leaves a held step
undated (`recomputeDueDates` in `lib/workflows/timing.ts` and
`_workflow_recompute_wedding_steps`), and the engine's claim refuses it;
only a manual claim (Send now) takes it and clears the hold.

The executor claims a step through `workflow_claim_step(p_step_id,
p_manual default false) → boolean` and finishes or holds a sleeping
wait through `workflow_finish_wait(p_step_id) → boolean` and
`workflow_hold_wait(p_step_id, p_expected_due_at, p_until) → boolean`
(`20261023800000`, `security invoker`, service role only). Each first
calls `_workflow_lock_live_instance(p_step_id)`, which takes the
template row `for share` then the instance row `for share` (the order
Turn off, delete and resume use) and requires the instance `active`, so
a pause or Turn off that committed after the pass read its instance
stops the write. The claim also requires `pending` or `waiting` and,
unless manual, no hold.

`attempt_count` is how many times the executor has tried an automated
step. A transient failure reschedules it under a three-attempt cap
(1, 5, then 15-minute backoff) before it is buried `errored`; a manual
"Try again" resets the count to 0, since a retry the MC asked for by
hand is a fresh start, not the next attempt of the same run. See
`workflows.md` "When a step fails".

`requires_approval` is the review gate: an automated step that is
pending, due and still flagged does not run, and surfaces on the Today
view for the MC to read and send. `isExecutable` already refuses to run
past it, so no separate "held" status exists.

`visible_to_couple` (default false) puts the step on the couple's portal
as a milestone. Opt-in by design: a workflow is the MC's internal list.
Partial index `workflow_steps_visible_idx` on `(instance_id)` where
`visible_to_couple` — on a table where nearly every row is invisible, a
full index would be mostly dead weight.

`template_step_id` is `ON DELETE SET NULL`: deleting a template step
must never delete a couple's progress.

`due_at` null means "not schedulable yet" — an `after_previous` step
whose predecessor has not finished. **That is the gating mechanism**
that lets a manual to-do hold up an automated email.

Partial index `workflow_steps_due_idx` on `(due_at)` where status is
pending or waiting is the executor's hot query.

`workflow_stranded_instances(p_limit, p_after default null) → table
(instance_id uuid)` (`20261023400000`, body replaced `20261023500000`,
`security invoker`, `search_path = ''`, execute revoked from public,
anon and authenticated) names the active instances carrying
`needs_recompute_at` at or before now (since `20261024000000`, so a
backed-off marker waits), keyset paged on instance id, for the tick's
heal pass (`lib/workflows/heal.ts`). The first version inferred strands from
the shape of the steps, which could not tell a strand from a step the
MC had held by taking its date off; the marker replaced it.

`workflow_due_steps(p_now, p_types, p_limit, p_user_id default null)
→ setof workflow_steps` (`20261014000000`, `security invoker`) is that
query: steps of active instances, `pending` or `waiting`, type in
`p_types` (the executor passes `AUTOMATED_STEP_TYPES`), no approval
gate, `due_at` set and not after `p_now`, optionally one owner, ordered
`due_at, instance_id, position`, at most `p_limit` rows. It leaves out
every account under the account-wide stop with a `not exists` on
`user_public_settings` (`workflows_paused_at is not null and
workflows_resumed_at is null`). It replaced a PostgREST query that
listed every stopped MC's id in the request URL, which failed past
about two hundred stopped accounts and, with the error dropped,
reported a clean tick while running nothing. Execute is revoked from
`public`, `anon` and `authenticated` and granted to `service_role`.
Called only through `loadDueSteps` (`lib/workflows/due-steps.ts`), which
throws on a failed read.

## `workflow_audit_log`

SELECT-only policy; the engine writes with the service role.

## `workflow_conversion_ledger`

One row per one-time data conversion (`tasks_and_automations_v1`), so a
migration replay is a no-op. No RLS: migrations and service role only.

## `workflow_dispatched_events`

The retired dual-run guard. The dispatcher now owns
`automation_events.processed_at` again; this table is kept until the
legacy tables drop so a rollback has somewhere to look. No RLS.

## Helper functions

- `ensure_default_workflow(uuid)` — the couple's default instance,
  created if absent. `security invoker`, deliberately NOT definer, so
  RLS still gates a cross-tenant call.
- `_workflow_wedding_due_at(jsonb, date, text)`,
  `_workflow_couple_wedding_date(uuid)`,
  `_workflow_recompute_wedding_steps(uuid)` — recompute
  `wedding_relative` due dates when the couple's date moves. Triggered
  from `events` INSERT/DELETE/UPDATE OF date and `couples` UPDATE OF
  `event_date`, because the wedding date resolves as
  `primary event date ?? couples.event_date`. Only `active` and
  `paused` instances are reshuffled (`paused` since `20261007000000`, so
  a wedding moved during a pause is not read as overdue on resume).
  Terminal steps are left
  alone, and so is a `pending` step with `attempt_count > 0`
  (`20261003300000`): its `due_at` is the executor's retry backoff, not
  a schedule, and rewriting it retries the step immediately. No
  `waiting` step is re-derived from its timing (`20261007000000`): its
  `due_at` is an engine park or a sleeping wait's wake time. The one
  exception is a sleeping `relative_to_event` wait, whose wake is
  re-derived from its own config by `_workflow_wait_relative_wake(jsonb,
  date)` (null, so untouched, when there is no wedding date or the
  config does not parse, or the arithmetic overflows; the helper traps
  every error and returns null, so it can never fail the edit). The
  executor re-checks quiet hours when a sleeping wait wakes, since this
  wake is unshifted. `_workflow_repair_stranded_waits()` (same migration,
  service role only, idempotent) repairs waits the old rewrite left with
  a null `due_at`. The TypeScript recompute in
  `lib/workflows/executor.ts` carries the same exclusions; keep them in
  sync.
- `_owns_workflow_template_or_null(uuid)` and siblings — the ownership
  guards the foreign keys do not give you.
- `get_portal_milestones(uuid)` — the couple-facing read, granted to
  `anon` and `authenticated`. `security definer`, token-gated through
  `_resolve_portal_couple`, and returns `[]` (never an error) for an
  unknown, disabled or wrong-couple token. Returns only
  `visible_to_couple` steps on `active` instances, collapsing status to
  `done` | `upcoming`: a couple never sees `errored`, and never sees
  `skipped` as distinct from done.

### `user_public_settings` (workflow digest)
| Column | Type | Purpose |
|---|---|---|
| `daily_digest_enabled` | boolean | Opt-out for the 7am morning digest |
| `daily_digest_last_sent_on` | date | The MC's **local** date of the last send, so the repeated hour daylight saving creates cannot produce a second one |
| `workflows_paused_at` | timestamptz null | Account-wide stop for workflow automation: when it went on. Null means running. Never touches instance status (`20261009000000`) |
| `workflows_resumed_at` | timestamptz null | When the stop lifted; null while it is on. `[paused_at, resumed_at]` is the window whose due steps are skipped, not sent late. CHECK: set only after `paused_at`, never before it. Partial index on `user_id where workflows_paused_at is not null` for the per-tick read. The due read `workflow_due_steps` (`20261014000000`) applies the active stop in SQL |

Migrations: `20260908000000_workflow_digest_settings.sql`,
`20260909000000_workflow_portal_milestones.sql`.

------------------------------------------------------------------------

# Proposals (2026-09-13, Phase A)

Full feature doc: `.claude/docs/proposals.md`. Migration
`20260923000000_create_proposals_engine.sql`. Later phases (B-E: page
mode, acceptance, engagement, workflow triggers) add their own
migrations.

## `proposals`
| Column | Type | Default | Purpose |
|---|---|---|---|
| `user_id` | uuid | | Owner, cascade delete |
| `couple_id` | uuid | | -> `couples`, cascade delete |
| `event_id` | uuid | null | -> `events`, optional |
| `proposal_number` | text | | `generate_proposal_number` |
| `title` | text | | |
| `status` | text | `'draft'` | check in `draft`, `sent`, `viewed`, `accepted`, `declined`, `expired` |
| `intro_note` | jsonb | null | TipTap JSON, normalised with `toPlainJSON` before the save action |
| `hero_override` | jsonb | null | `{ imagePath?, videoPath?, embedUrl? }`, rendered from Phase B |
| `expires_at` | date | null | |
| `deposit_percent` | numeric(5,2) | null | Used when no payment schedule is chosen |
| `payment_schedule_id` | uuid | null | -> `payment_schedules`, set null |
| `contract_template_id` | uuid | null | -> `contract_templates`, set null; required to send |
| `version` | integer | 1 | Bumped when a sent/viewed proposal is saved again |
| `share_token` | uuid | random | Unique. Public-page identity |
| `share_token_enabled` | boolean | false | Off until the send route flips it |
| `email_sent_at` | timestamptz | null | |
| `first_viewed_at`, `view_count`, `last_viewed_at` | timestamptz / integer | null / 0 / null | Stamped by `get_public_proposal` |
| `accepted_option_id` | uuid | null | -> `proposal_options`, set null (added via a second `alter table`, the two tables reference each other) |
| `accepted_addon_selection` | jsonb | null | Array of item ids, Phase C |
| `accepted_at`, `declined_at`, `declined_reason`, `declined_message` | timestamptz / text | null | Phase C |
| `contract_id` | uuid | null | -> `contracts`, set null |
| `invoice_id` | uuid | null | -> `invoices`, set null |
| `created_at`, `updated_at` | timestamptz | now() | `updated_at` trigger |

## `proposal_options`
Snapshot of a package at save time (1-3 per proposal); later package
edits never change a saved proposal.

| Column | Type | Default | Purpose |
|---|---|---|---|
| `proposal_id` | uuid | | -> `proposals`, cascade delete |
| `user_id` | uuid | | |
| `position` | integer | | |
| `title`, `description` | text | | |
| `source_package_id` | uuid | null | -> `packages`, set null; provenance only, never feeds rendering |
| `pricing_mode` | text | `'itemised'` | check in `itemised`, `single` |
| `fixed_price` | numeric(10,2) | null | |
| `gst_inclusive` | boolean | true | |
| `weekend_loading_percent` | numeric(5,2) | null | |
| `is_popular` | boolean | false | |
| `subtotal` | numeric(10,2) | 0 | Base (non add-on) total, denormalised for the list and chooser cards |

## `proposal_option_items`
| Column | Type | Default | Purpose |
|---|---|---|---|
| `option_id` | uuid | | -> `proposal_options`, cascade delete |
| `user_id` | uuid | | |
| `description`, `note` | text | | `note` optional |
| `amount` | numeric(10,2) | | |
| `quantity` | numeric(8,2) | 1 | |
| `is_addon` | boolean | false | |
| `default_included` | boolean | true | |
| `position` | integer | | |

## Columns added to existing tables
| Table | Column | Purpose |
|---|---|---|
| `contracts` | `proposal_id` (uuid, null, -> `proposals` set null, indexed) | Provenance on the contract a proposal generates (Phase C) |
| `invoices` | `proposal_id` (uuid, null, -> `proposals` set null, indexed) | Provenance on the invoice a proposal generates (Phase C) |

## RLS
Owner-only (`auth.uid() = user_id`) for every verb on all three tables.
`proposal_options` and `proposal_option_items` also carry a
parent-ownership `exists` check (`_owns_proposal`, `_owns_proposal_option`)
in `with check`, since a foreign key is validated with elevated
privileges and does not consult RLS: without it a user could attach rows
to another MC's proposal. Anonymous access is only through the
`security definer` RPC below, never a table grant. See `security.md` for
the coverage matrix and the integration test path.

## Functions (Phase A)
- `generate_proposal_number(p_user_id uuid)`  -  same shape as
  `generate_invoice_number`: `PR-001`, sequential per user, guarded with
  `nullif` so a malformed existing number cannot throw the cast.
- `get_public_proposal(token uuid)`  -  `security definer`, granted to
  `anon`. Returns `null` unless `share_token_enabled` is set. Merges
  `_user_branding(user_id)` at the top level and `branding_blocks` from
  `_user_branding_blocks(user_id, 'proposal')` (empty array until Phase B
  registers the surface). Derives `expired` from `expires_at` rather than
  trusting the `status` column. On a `sent` proposal's first read, bumps
  `view_count`/`last_viewed_at`, stamps `first_viewed_at`, and flips
  status to `viewed`.

Two FK paths now exist between `proposals` and `proposal_options`
(`proposal_options.proposal_id` and `proposals.accepted_option_id`), so
PostgREST cannot infer which one an embed means: every embed of
`proposal_options` from `proposals` must hint the relationship, e.g.
`proposal_options!proposal_options_proposal_id_fkey(...)`.

Phase C adds `accept_proposal`, `finalize_proposal_acceptance`,
`decline_proposal`; Phase D adds `proposal_events` +
`record_proposal_events`; Phase E adds the lifecycle trigger and the
expiry cron. None of these exist yet.

## Proposals Phase B additions (2026-09-14)

Migration `20260924000000_proposal_surface.sql`. Full feature doc:
`.claude/docs/proposals.md`.

### Analytics functions (R4)

`proposal_template_performance()` and `proposal_account_summary()` (plus
helpers `_proposal_open_gaps()`, `_proposal_revenue()`) are `security
invoker`, so RLS scopes them to the caller; anon is revoked. Sent is
`status <> 'draft'`, accepted is `accepted_at is not null`, revenue is
`coalesce(invoice subtotal, accepted option subtotal)`, and time to open
is the first `opened` event minus `email_sent_at` (never
`first_viewed_at`). Migration `20261025000000_proposal_analytics_rpcs.sql`.

- `user_branding.enabled_surfaces` default gains `proposal`:
  `'["invoice", "contract", "portal", "vendorTimeline", "questionnaire",
  "lead", "proposal"]'::jsonb`. Existing rows are not rewritten;
  `resolveEnabledSurfaces` (`lib/branding/enabled-surfaces.ts`) treats a
  missing `proposal` key as enabled, the same rule `lead` uses (R8), so
  no backfill is needed.
- `user_branding.proposal_role` (text, null, check in `mc`,
  `celebrant`, `both`) remembers the role chosen on first open of the
  Proposal branding tab.
- **`proposal-media` storage bucket**: public read, 50MB file size
  limit, `allowed_mime_types` originally restricted to `video/mp4` and
  `video/webm`, for uploaded hero/video block sources. Owner-write
  storage policies (insert/update/delete require
  `auth.uid()::text = split_part(name, '/', 1)`, i.e. the first path
  segment is the uploader's own user id), select open to anyone  -  the
  same shape as the existing `branding` bucket. See `security.md` for
  the policy listing.
  **Widened in `20260928000000_proposal_media_mime_types.sql`** (Layout
  v2 Phase 2) to also accept the image and audio kinds the template
  editor uploads (`features/proposals/data/media.ts` `MEDIA_LIMITS`):
  `allowed_mime_types` is now `video/mp4`, `video/webm`, `image/jpeg`,
  `image/png`, `image/webp`, `image/gif`, `audio/mpeg`, `audio/mp4`,
  `audio/x-m4a`, `audio/wav`. `file_size_limit` stays 52428800 (50MB) -
  that's the bucket-level ceiling, sized for the largest kind
  (video/background); the smaller per-kind caps (image 10MB, audio
  25MB) are enforced client-side in `MEDIA_LIMITS` before upload, not
  at the bucket.

## Proposals Phase D additions (2026-09-15)

Migration `20260926000000_proposal_events.sql`. Full feature doc:
`.claude/docs/proposals.md` (Phase D section).

### `proposal_events`
Raw engagement events from the public proposal page; aggregated
client-side on the detail page, never queried per-column.

| Column | Type | Default | Purpose |
|---|---|---|---|
| `proposal_id` | uuid | | -> `proposals`, cascade delete |
| `user_id` | uuid | | Owner, cascade delete |
| `session_id` | text | | One browser session's id, from the tracker |
| `type` | text | | One of the eight event types in `lib/proposals/engagement-events.ts` |
| `payload` | jsonb | `'{}'` | Shape depends on `type`; see the vocabulary table in `proposals.md` |
| `created_at` | timestamptz | now() | |
| `client_event_id` | text | `gen_random_uuid()::text` | Client-generated idempotency key, stamped once when the tracker queues the event (not on flush); a replayed batch conflicts on this and inserts nothing. Defaults to a random value so a directly-seeded row (owner tooling, tests) never needs to supply one. |

Indexes: `(proposal_id, created_at)` (the aggregation read pattern),
`user_id` (every FK gets one), and a unique `(proposal_id,
client_event_id)` (the idempotency constraint `record_proposal_events`
inserts against with `on conflict do nothing`; scoped to `proposal_id`
rather than a bare index on `client_event_id` since every other read
and write on this table is already partitioned that way). See
`proposals.md` (Phase D) for the full idempotency rationale.

### RLS
Owner-only `select`/`delete`; `insert` requires `auth.uid() = user_id`
**and** a parent-ownership `exists` check that the target `proposal_id`
belongs to the caller (same shape as `proposal_options`), since a
foreign key is validated with elevated privileges and does not consult
RLS. Anonymous access is only through `record_proposal_events` below,
never a table grant. See `security.md` for the coverage matrix.

### Functions (Phase D)
- `record_proposal_events(p_token uuid, p_session_id text, p_events jsonb)`
  -  `security definer`, granted to `anon`. Resolves the proposal by
  `share_token` + `share_token_enabled = true`, locking the row (`for
  update`) before reading whether an `opened` event already exists, so
  two tabs flushing in the same second can never both report a first
  open. Inserts every event whose `type` is recognised and whose `id`
  is present and well-formed, `on conflict (proposal_id,
  client_event_id) do nothing` (others silently dropped), and returns
  `{ ok: true, inserted, first_open }` where `inserted` counts only
  rows actually written, so a replayed batch reports 0; `first_open`
  requires this call to have actually inserted an `opened` row, not
  merely to have received one.

## Proposal Layout v2, Phase 1 (2026-09-16)

Migration `20260927000000_proposal_layout_v2.sql`. Full feature doc:
`.claude/docs/proposals.md` (Layout v2 section). Adds v2 storage
alongside the v1 tables above; nothing here drops or rewrites v1 data.

### `proposal_templates`
Named layouts per user.

| Column | Type | Default | Purpose |
|---|---|---|---|
| `id` | uuid | `gen_random_uuid()` | |
| `user_id` | uuid | | Owner, cascade delete |
| `name` | text | | |
| `layout` | jsonb | | A `ProposalLayout` v2 document |
| `is_default` | boolean | false | One default per user, enforced by the partial unique index `proposal_templates_one_default_idx on (user_id) where is_default` |
| `settings` | jsonb | null | The template's own proposal-settings snapshot, same shape as a `proposal_settings` row (`password_enabled`, `allow_download`, `expiry_days`, `deposit_percent`, `link_preview`). Always a full snapshot (validated with `updateProposalSettingsSchema`), never a partial diff. `null` = follow the account defaults. Added `20260929000000_proposal_template_settings.sql` |
| `revision` | integer | 0 | Optimistic-concurrency counter for layout writes. `updateTemplateLayoutAction` matches `revision = baseRevision` and sets `baseRevision + 1`; a miss is returned as a conflict carrying the current row, never written over. The unload beacon route matches on the same guard but does not bump (see `proposals.md`, "Nothing the MC types is ever held only in React state"). Added `20260930000000_proposal_template_revision.sql` |
| `created_at`, `updated_at` | timestamptz | now() | |

Index: `user_id`.

### `proposal_settings`
One row per user; account-level defaults for the public proposal page.

| Column | Type | Default | Purpose |
|---|---|---|---|
| `user_id` | uuid (PK) | | Owner, cascade delete |
| `password_enabled` | boolean | false | |
| `allow_download` | boolean | true | |
| `section_nav` | boolean | false | |
| `expiry_days` | integer | 14 | Check `between 1 and 365` |
| `deposit_percent` | integer | 30 | Check `between 0 and 100` |
| `link_preview` | jsonb | null | |
| `updated_at` | timestamptz | now() | |

### New columns
| Table | Column | Purpose |
|---|---|---|
| `proposals` | `layout` (jsonb, null) | The proposal's own v2 layout copy, snapshotted from the template by `createProposalFromTemplateAction` with fresh section ids. Null for a proposal created by the legacy v1 builder, and `get_public_proposal_layout` returns null for those |
| `proposals` | `template_id` (uuid, null, -> `proposal_templates` set null, indexed) | Which template the proposal was created from, written at create time by `createProposalFromTemplateAction` |
| `proposals` | `layout_revision` (integer, 0) | Optimistic-concurrency counter for per-proposal layout writes, the `proposal_templates.revision` equivalent: `updateProposalLayoutAction` matches `layout_revision = baseRevision` and sets `baseRevision + 1`, and a miss comes back as a conflict carrying the current row. Separate from `version`, which counts resends. Added `20261005000000_proposal_layout_revision.sql` |
| `user_branding` | `blocks_proposal_v1_backup` (jsonb, null) | The v1 `branding_blocks.proposal` tree, backed up once when an account is first migrated to v2 templates |
| `user_branding` | `blocks_proposal_v1_backup_at` (timestamptz, null) | When the backup was taken |

### RLS
`proposal_templates` and `proposal_settings` are owner-only
(`auth.uid() = user_id`) on all four verbs, no parent-ownership checks
needed (neither table points at another owned row). See `security.md`
for the coverage matrix and integration tests.

### Functions (Phase 1)
- `get_public_proposal_layout(token uuid)` - `sql`, `stable`,
  `security definer`, `search_path public`, granted to `anon` and
  `authenticated`. Share-token gated (`share_token_enabled = true`),
  no side effects (unlike `get_public_proposal`, it never bumps
  `view_count`). Returns the proposal's own `layout`, else null - no
  fallback to a `proposal_templates` row, so a template never renders on
  a couple's link; strips `page.passwordHash` from the returned jsonb
  before it leaves the function, since the password gate is checked
  server-side and the hash is never a public field.

------------------------------------------------------------------------

# Scheduler (R1, 2026-09-20)

Migration `20261001000000_pg_cron_scheduler.sql`. Full context:
`.claude/docs/cicd.md` (Scheduled jobs) and `workflows.md` (cron sweep).

### system_heartbeats

| column | type | notes |
|---|---|---|
| name | text pk | job name, e.g. `automations-tick` |
| last_run_at | timestamptz | stamped by the job at the end of a run |
| detail | jsonb | `{ truncated, durationMs }` for the tick |

RLS on, no policies: service-role only. Written by `lib/workflows/heartbeat.ts`.

### Scheduler functions (`20261001000000`)

- `cron_call(p_path text) → bigint`: POSTs `<app_base_url><path>` via pg_net with the Vault bearer secret; returns the request id or null when unconfigured. Execute revoked from public, anon, authenticated.
- `set_scheduler_secrets(p_base_url, p_secret)`: upserts the two Vault secrets. Service-role only.
- `scheduler_status() → jsonb`: `{ configured, base_url, jobs[], heartbeats{} }`. Service-role only.

### scheduler_leases (`20261003200000`)

| column | type | notes |
|---|---|---|
| name | text pk | lease name, e.g. `automations-tick` |
| held_until | timestamptz | the lease is free once `now()` passes this |
| holder | uuid | the run that holds it, or null once released |

RLS on, no policies: service-role only, same shape as `system_heartbeats`.
Stops two overlapping tick runs from racing for the same due steps,
using a row with an expiry rather than a session advisory lock, because
pooled connections do not keep a session for a lock to live on.

`acquire_scheduler_lease(p_name, p_ttl_seconds, p_token) → boolean`
(`security definer`) does the insert-or-steal-if-expired in one
statement, stamping `p_token` as the holder.
`release_scheduler_lease(p_name, p_token) → boolean` deletes the row,
but only when `p_token` still holds it. Both halves matter: the TTL has
to outlast the longest tick, which makes it longer than the gap between
two ticks, so a lease left to expire refuses the next minute's run on a
healthy system; and the token stops a run whose lease expired
mid-flight from releasing its successor's hold. Execute is revoked from
`public`, `anon` and `authenticated` explicitly (Supabase's default
privileges grant new functions to those roles otherwise) and granted to
`service_role` alone. See `workflows.md` "The cron sweep".
