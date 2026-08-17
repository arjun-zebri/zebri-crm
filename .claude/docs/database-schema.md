# Zebri Database Schema

Database: Postgres (Supabase)

The schema is intentionally **simple for the MVP CRM**.

------------------------------------------------------------------------

# User Data

There is no `users` table. User data is stored on the Supabase Auth
user row in **two** metadata bags:

- **`user_metadata`** — user-writable (`auth.updateUser({ data })`).
  Holds user-owned fields (display name, business name, bank details,
  branding, etc.).
- **`app_metadata`** — **server-only writable**, JWT-readable. Holds
  all entitlement fields (`account_type`, `subscription_*`,
  `stripe_*`, `is_beta_user`). The §7.4 / Phase 0.8b fix moved these
  out of `user_metadata` to close the privilege-escalation surface.

Read entitlements via `@/lib/auth/entitlements`, never directly from
either bag. Writes go through `updateEntitlements()` (server-only).
See `.claude/docs/authentication.md` for the full schema of both bags
and the migration mechanics (backfill migration + `sync_signup_app_
metadata_on_insert` trigger).

**Branding fields (stored in `user_metadata`, user-owned):**

Scalars returned by `_user_branding(uuid)` and merged into public RPCs. Migration `20260715000000_branding_editor_redesign.sql` extended the function with typography + layout fields. Migration `20260718100000_branding_colours.sql` replaced the old colour model with a role-based system: six user-set colours (heading, subheading, body, background, primary button, secondary button, plus link for the editor) with derived aliases for backward compatibility.

**user_branding table** (Branding overhaul, Phase 11 onwards). One row per user, RLS-owned, stores the block tree + surface configuration for the branding editor. Columns: `user_id` (PK, FK auth.users cascade), `branding_blocks` (jsonb, keyed by surface: `quote`, `invoice`, `contract`, `vendorTimeline`, `questionnaire`), `enabled_surfaces` (text[], default `{quote,invoice,contract}`), `onboarded_at` (timestamptz, null until first save), `created_at`, `updated_at`.

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

created_at (timestamp)

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
RLS: single owner-isolation policy (auth.uid() = user_id). Public access
is only via the security-definer RPCs get_lead_form / submit_lead, both
granted to anon; the anon client never touches the table directly.

Columns:

id (uuid) user_id (uuid, not null, unique) capture_token (uuid, not null, unique, default gen_random_uuid())

enabled (boolean, not null, default true)

target_status_slug (text, nullable) — couple_statuses.slug the lead lands in; null falls back to the MC's first status by position

created_at (timestamp) updated_at (timestamp)

Website form (block-based, 2026-08): the form is now a `lead` branding
surface designed from blocks. get_lead_form additionally returns
`blocks` = user_branding.branding_blocks->'lead' (the saved form design,
or JSON null when uncustomised); the public /lead/[token] page renders
that block tree. Fields are `formField` blocks whose `role` maps each
answer to a couple column (name/partnerName/email/phone/weddingDate/
venue/message/referral) or, for `role='custom'`, into the couple notes.

Ingest (submit_lead): validates the token, stores a form_submissions row
FIRST (so a lead is never lost), resolves the landing status, and inserts
a couple owned by the token issuer with lead_source='website' and
referral_source from the "how did you hear" field. Custom answers +
message fold into couple notes as "Label: value" lines; the new couple id
is linked back onto the submission. A Starter couple-cap block returns
{error:'plan_limit'} and keeps the stored submission (couple_id null).

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
`decline_contract`, `revoke_contract`, `expire_contracts`, and
`mark_contract_reminder_sent`. The `/api/email/send-contract` route
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

A sent-history log of emails the MC sends a couple from the manual
"Send email" flow (`/api/email/send-template` inserts a row after a
successful send). Powers the **Emails** tab on the couple profile.

Columns: id, user_id (RLS key, FK auth.users cascade), couple_id (FK
couples cascade), template_id (FK email_templates **on delete set
null**, nullable), template_name (text snapshot — survives template
deletion/rename), subject (rendered subject sent), to_email, source
(`manual` today; `automation` can log here later without a schema
change), status (default `sent`), sent_at, created_at.

Indexes: `couple_emails(couple_id)`, `couple_emails(user_id)`.
RLS: owner-only `user_id = auth.uid()`.

Migration: `20260619000000_create_couple_emails.sql`.

## questionnaire_templates / couple_questionnaires (Couple questionnaires)

Couples fill in MC-built questionnaires on a branded public page, either one
question at a time (typeform style) or as a classic all-on-one-page form (per
the template's display mode). Structurally a twin of contracts: a reusable
template plus a per-couple token-gated instance.

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
completed-event trigger).

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

Migration: `20260621000000_create_user_public_settings.sql`.

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
