# Zebri Database Schema

Database: Postgres (Supabase)

The schema is intentionally **simple for the MVP CRM**.

------------------------------------------------------------------------

# users

Represents Zebri accounts.

Columns:

id (uuid, primary key) name (text) email (text, unique) role (text)
created_at (timestamp)

------------------------------------------------------------------------

# leads

Incoming enquiries from couples.

Columns:

id (uuid) name (text) email (text) phone (text) event_date (date) venue
(text) notes (text) status (text)

Status values: new contacted quoted lost

created_at (timestamp)

------------------------------------------------------------------------

# couples

Couples who have booked the MC.

Columns:

id (uuid) partner_1_name (text) partner_2_name (text) email (text) phone
(text) wedding_date (date) venue (text) notes (text) status (text)

Status values: booked confirmed completed

created_at (timestamp)

------------------------------------------------------------------------

# events

Actual weddings being managed.

Columns:

id (uuid) couple_id (uuid, foreign key) date (date) venue (text)
timeline_notes (text) status (text)

Status values: upcoming completed cancelled

created_at (timestamp)

------------------------------------------------------------------------

# tasks

Follow-ups and reminders.

Columns:

id (uuid) title (text) description (text) due_date (date) status (text)
user_id (uuid) related_event_id (uuid) related_lead_id (uuid)

Status values: todo in_progress done

created_at (timestamp)

------------------------------------------------------------------------

# Relationships

leads -\> can convert to couples

couples -\> have events

events -\> can have tasks

users -\> own tasks
