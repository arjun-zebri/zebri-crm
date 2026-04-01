# Zebri Database Schema

Database: Postgres (Supabase)

The schema is intentionally **simple for the MVP CRM**.

------------------------------------------------------------------------

# User Data

There is no `users` table. User profile and subscription data is stored in Supabase Auth `user_metadata`. See `.claude/authentication.md` for the full schema.

All CRM tables include a `user_id` column (uuid, not null) referencing `auth.users.id` for row-level security.

------------------------------------------------------------------------

# couples

Incoming enquiries from couples.

Columns:

id (uuid) user_id (uuid, not null) name (text) email (text) phone (text) event_date (date) venue
(text) notes (text) status (text)

Status values: stored as custom couple status slug (e.g. 'new', 'contacted', 'confirmed', 'paid', 'complete'). See couple_statuses table for user-defined statuses.

lead_source (text, nullable)

Lead source values: referral website social_media word_of_mouth wedding_expo venue_partner

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

share_token (uuid, nullable, default gen_random_uuid()) — generated on row creation; used as the public share URL key.

share_token_enabled (boolean, not null, default false) — link is inactive until the MC explicitly enables it. Disabling preserves the token. Regenerating updates share_token to a new gen_random_uuid(), permanently invalidating the old URL.

created_at (timestamp)

------------------------------------------------------------------------

# timeline_items

Ordered run-sheet items for an event's wedding timeline.

Columns:

id (uuid, primary key, default gen_random_uuid()) event_id (uuid, not null, FK to events.id, on delete cascade) user_id (uuid, not null)

start_time (time, nullable) — stored as HH:MM, displayed as "5:30 PM". Nullable — MC can add untimed items. Items are sorted by start_time ascending when set; untimed items fall below by position.

title (text, not null) — e.g. "Bridal party entrance"

description (text, nullable) — MC's internal notes or cues

duration_min (integer, nullable) — estimated duration in minutes

contact_id (uuid, nullable, FK to contacts.id, on delete set null) — the contact assigned to this item; scoped to contacts already linked to the event via event_contacts

position (integer, not null) — ordering; stored as multiples of 1000 on creation to allow insertion between items without a full renumber

created_at (timestamp)

RLS: Standard user_id = auth.uid() policy for authenticated CRUD. Anon SELECT is granted via a SECURITY DEFINER Supabase function get_public_timeline(token uuid) — returns event + items only when share_token_enabled = true; returns null otherwise. This avoids complex anon policy joins.

------------------------------------------------------------------------

# tasks

Follow-ups and reminders.

Columns:

id (uuid) title (text) description (text) due_date (date) status (text)
user_id (uuid) related_event_id (uuid) related_couple_id (uuid) related_contact_id (uuid, nullable, FK to contacts.id)

Status values: todo in_progress done

created_at (timestamp)

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

tasks -> can relate to couple (via tasks.related_couple_id), event (via tasks.related_event_id), or contact (via tasks.related_contact_id)

quotes -> belong to a couple (FK couple_id); have many quote_items (cascade delete)

quote_items -> belong to a quote (FK quote_id, cascade delete)

invoices -> belong to a couple (FK couple_id); optionally linked to an event (FK event_id, set null on delete) and a quote (FK quote_id, set null on delete); have many invoice_items (cascade delete)

invoice_items -> belong to an invoice (FK invoice_id, cascade delete)

All tables -> scoped to user via user_id (RLS)

------------------------------------------------------------------------

# quotes

Quotes and proposals sent to couples before booking confirmation.

Columns:

id (uuid) user_id (uuid, not null) couple_id (uuid, not null, FK to couples.id, on delete cascade)

title (text, not null) — e.g. "Wedding MC Package — Smith Wedding"

quote_number (text, not null) — auto-generated on insert as "QT-001" format (sequential count per user)

status (text, not null, default 'draft')

Status values: draft sent accepted declined expired

subtotal (numeric(10,2), not null, default 0) — sum of quote_items.amount; updated on item save

notes (text, nullable) — terms, inclusions, exclusions

expires_at (date, nullable)

share_token (uuid, not null, default gen_random_uuid()) — unique URL key; generated on row creation

share_token_enabled (boolean, not null, default false) — link inactive until MC explicitly enables it

accepted_at (timestamp with time zone, nullable)

created_at (timestamp)

RLS: Standard user_id = auth.uid() CRUD for authenticated users. Anon access via SECURITY DEFINER functions get_public_quote, accept_quote, and decline_quote (see quotes.md).

------------------------------------------------------------------------

# quote_items

Line items for a quote.

Columns:

id (uuid) quote_id (uuid, not null, FK to quotes.id, on delete cascade) user_id (uuid, not null)

description (text, not null) — e.g. "Wedding ceremony MC (2 hrs)"

amount (numeric(10,2), not null)

position (integer, not null) — ordering, multiples of 1000

created_at (timestamp)

------------------------------------------------------------------------

# invoices

Invoices sent to couples for payment.

Columns:

id (uuid) user_id (uuid, not null) couple_id (uuid, not null, FK to couples.id, on delete cascade)

event_id (uuid, nullable, FK to events.id, on delete set null) — links invoice to a specific wedding; used to update events.price when marked paid

quote_id (uuid, nullable, FK to quotes.id, on delete set null) — preserved link if invoice was generated from a quote

invoice_number (text, not null) — auto-generated on insert as "INV-001" format (sequential count per user)

title (text, not null) — e.g. "Wedding MC Services — Smith Wedding"

status (text, not null, default 'draft')

Status values: draft sent paid overdue cancelled

subtotal (numeric(10,2), not null, default 0) — sum of invoice_items.amount; updated on item save

due_date (date, nullable) — defaults to 7 days from creation when generated from a quote

notes (text, nullable) — payment instructions, bank details, reference number request

share_token (uuid, not null, default gen_random_uuid()) — unique URL key; generated on row creation

share_token_enabled (boolean, not null, default false) — link inactive until MC explicitly enables it

paid_at (timestamp with time zone, nullable)

created_at (timestamp)

RLS: Standard user_id = auth.uid() CRUD for authenticated users. Anon access via SECURITY DEFINER function get_public_invoice (read-only; no couple-side writes on invoices).

------------------------------------------------------------------------

# invoice_items

Line items for an invoice.

Columns:

id (uuid) invoice_id (uuid, not null, FK to invoices.id, on delete cascade) user_id (uuid, not null)

description (text, not null)

quantity (numeric(8,2), not null, default 1.00)

unit_price (numeric(10,2), not null)

amount (numeric(10,2), not null) — stored as quantity × unit_price; recalculated on save

position (integer, not null) — ordering, multiples of 1000

created_at (timestamp)

------------------------------------------------------------------------

# stripe_customers

Lookup table for resolving Stripe webhooks to Supabase users. See `.claude/payments.md` for details.

Columns:

stripe_customer_id (text, primary key) user_id (uuid, not null, references auth.users.id) created_at (timestamp)

RLS: service role only (no client access).
