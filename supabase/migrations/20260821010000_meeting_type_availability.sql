-- Per-meeting-type weekly availability.
--
-- Until now an MC had ONE weekly schedule (availability_rules), shared by
-- every meeting type. That is right for most of them, but an MC who takes
-- evening consultations or Saturday-only site visits could not express it.
--
-- Model: a meeting type either uses the MC's standard weekly hours (the
-- default) or carries its own set of windows that REPLACE them entirely.
-- Date overrides stay user-level: a blocked wedding day blocks every type.
--
-- `uses_custom_availability` is not redundant with "does the type have
-- rows". Because custom hours replace rather than narrow, a custom
-- schedule with every day switched off means "never bookable", which is a
-- real thing to want and is otherwise indistinguishable from "fall back to
-- the standard hours".
--
-- Non-destructive migration: no @ALLOW_DESTRUCTIVE marker required.

alter table public.meeting_types
  add column if not exists uses_custom_availability boolean not null default false;

comment on column public.meeting_types.uses_custom_availability is
  'When true the slot engine reads meeting_type_availability_rules for this '
  'type instead of the MC''s user-level availability_rules. Date overrides '
  'apply either way.';

create table meeting_type_availability_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meeting_type_id uuid not null references meeting_types(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (start_time < end_time),
  created_at timestamptz not null default now()
);
create index meeting_type_availability_rules_user_id_idx
  on meeting_type_availability_rules(user_id);
create index meeting_type_availability_rules_meeting_type_id_idx
  on meeting_type_availability_rules(meeting_type_id);

comment on table meeting_type_availability_rules is
  'Weekly bookable windows for one meeting type, in the MC''s timezone. '
  'Read only when meeting_types.uses_custom_availability is true.';

alter table meeting_type_availability_rules enable row level security;

-- Foreign keys are checked with elevated privileges and ignore RLS, so an
-- owner-only `auth.uid() = user_id` policy would still accept a row whose
-- meeting_type_id belongs to a different MC: the FK finds the row even
-- though the writer could never read it. Same class of hole as the
-- couples/selected_package_id guard (20260820010000).
create or replace function public._owns_meeting_type(p_meeting_type_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from meeting_types
    where id = p_meeting_type_id
      and user_id = auth.uid()
  );
$$;

comment on function public._owns_meeting_type(uuid) is
  'True when the meeting type is the caller''s own. Used by the '
  'meeting_type_availability_rules RLS policies: foreign keys ignore RLS, '
  'so without this an MC could attach hours to another MC''s meeting type.';

create policy "meeting_type_availability_rules_select"
  on meeting_type_availability_rules
  for select
  using (auth.uid() = user_id);

create policy "meeting_type_availability_rules_insert"
  on meeting_type_availability_rules
  for insert
  with check (auth.uid() = user_id and _owns_meeting_type(meeting_type_id));

create policy "meeting_type_availability_rules_update"
  on meeting_type_availability_rules
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and _owns_meeting_type(meeting_type_id));

create policy "meeting_type_availability_rules_delete"
  on meeting_type_availability_rules
  for delete
  using (auth.uid() = user_id);
