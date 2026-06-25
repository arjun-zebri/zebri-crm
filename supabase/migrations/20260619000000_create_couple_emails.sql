-- Couple email log: a record of every email actually sent to a couple
-- from the manual "Send email" flow (and, later, automations). Powers
-- the Emails tab on the couple profile — a sent-history view alongside
-- Automations.
--
-- Owner-scoped with RLS, like every owned table.

create table if not exists couple_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid not null references couples(id) on delete cascade,
  -- The template used, if any. `set null` so deleting a template keeps
  -- the history row; `template_name` snapshots the label for display.
  template_id uuid references email_templates(id) on delete set null,
  template_name text,
  subject text not null,
  to_email text not null,
  -- How it was sent. 'manual' today; 'automation' can log here later
  -- without a schema change.
  source text not null default 'manual',
  status text not null default 'sent',
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table couple_emails enable row level security;

-- drop-if-exists keeps this replayable against a partially-migrated DB.
drop policy if exists "Users manage own couple_emails" on couple_emails;
create policy "Users manage own couple_emails" on couple_emails for all using (user_id = auth.uid());

create index if not exists couple_emails_couple_id_idx on couple_emails(couple_id);
create index if not exists couple_emails_user_id_idx on couple_emails(user_id);
