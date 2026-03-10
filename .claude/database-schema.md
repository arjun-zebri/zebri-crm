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

Status values: new contacted confirmed paid complete

created_at (timestamp)

------------------------------------------------------------------------

# vendors

Other wedding vendors the MC liaises with.

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
timeline_notes (text) status (text)

Status values: upcoming completed cancelled

created_at (timestamp)

------------------------------------------------------------------------

# tasks

Follow-ups and reminders.

Columns:

id (uuid) title (text) description (text) due_date (date) status (text)
user_id (uuid) related_event_id (uuid) related_couple_id (uuid) related_vendor_id (uuid, nullable, FK to vendors.id)

Status values: todo in_progress done

created_at (timestamp)

------------------------------------------------------------------------

# event_vendors

Join table linking vendors to events.

Columns:

id (uuid) event_id (uuid, not null, FK to events.id) vendor_id (uuid, not null, FK to vendors.id) user_id (uuid, not null) role_notes (text) created_at (timestamp)

Unique constraint on (event_id, vendor_id).

------------------------------------------------------------------------

# Relationships

couples -> have events

vendors -> linked to events via event_vendors join table

vendors -> can have tasks (via tasks.related_vendor_id)

events -> can have tasks

All tables -> scoped to user via user_id (RLS)

------------------------------------------------------------------------

# stripe_customers

Lookup table for resolving Stripe webhooks to Supabase users. See `.claude/payments.md` for details.

Columns:

stripe_customer_id (text, primary key) user_id (uuid, not null, references auth.users.id) created_at (timestamp)

RLS: service role only (no client access).
