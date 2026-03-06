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

# couples

Incoming enquiries from couples.

Columns:

id (uuid) name (text) email (text) phone (text) event_date (date) venue
(text) notes (text) status (text)

Status values: new contacted quoted lost

created_at (timestamp)

------------------------------------------------------------------------

# vendors

Other wedding vendors the MC liaises with.

Columns:

id (uuid) name (text) contact_name (text) email (text) phone
(text) category (text) notes (text) status (text)

Category values: venue photographer videographer dj florist planner caterer other

Status values: active inactive

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
user_id (uuid) related_event_id (uuid) related_couple_id (uuid)

Status values: todo in_progress done

created_at (timestamp)

------------------------------------------------------------------------

# Relationships

couples -\> have events

vendors -\> can be linked to events

events -\> can have tasks

users -\> own tasks
