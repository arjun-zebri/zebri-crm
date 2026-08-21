-- Scheduler Phase B: meeting types + weekly availability + date overrides.
--
-- meeting_types: the Calendly-style bookable types (duration, location,
-- buffers, notice window) with a share_token for the Phase C public
-- booking page. availability_rules: the MC's ONE user-level weekly
-- schedule as (weekday, window) rows, times interpreted in the MC's
-- timezone (user_public_settings.timezone, added below).
-- availability_overrides: one row per date, either a full-day block
-- (available=false, times null) or one custom window.
--
-- Non-destructive migration: no @ALLOW_DESTRUCTIVE marker required.

create table meeting_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  location_type text not null default 'video'
    check (location_type in ('video', 'phone', 'in_person')),
  -- Physical address, only meaningful for in_person.
  address text,
  buffer_before_minutes integer not null default 0 check (buffer_before_minutes between 0 and 240),
  buffer_after_minutes integer not null default 0 check (buffer_after_minutes between 0 and 240),
  min_notice_hours integer not null default 24 check (min_notice_hours between 0 and 720),
  max_advance_days integer not null default 60 check (max_advance_days between 1 and 365),
  reminder_enabled boolean not null default true,
  active boolean not null default true,
  -- Capability token for the public /book page (Phase C). App code may
  -- rotate it with crypto.randomUUID(); the default covers creation.
  share_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meeting_types_user_id_idx on meeting_types(user_id);

create table availability_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (start_time < end_time),
  created_at timestamptz not null default now()
);
create index availability_rules_user_id_idx on availability_rules(user_id);

create table availability_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  available boolean not null,
  start_time time,
  end_time time,
  -- A custom window needs both ends; a block needs neither.
  check (
    (available and start_time is not null and end_time is not null and start_time < end_time)
    or (not available and start_time is null and end_time is null)
  ),
  unique (user_id, date),
  created_at timestamptz not null default now()
);
create index availability_overrides_user_id_idx on availability_overrides(user_id);

alter table meeting_types enable row level security;
alter table availability_rules enable row level security;
alter table availability_overrides enable row level security;

create policy "meeting_types_user_isolation" on meeting_types
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "availability_rules_user_isolation" on availability_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "availability_overrides_user_isolation" on availability_overrides
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The MC's IANA timezone; availability times are wall-clock in this
-- zone. Lives on the existing one-row-per-user settings table so Phase
-- C's public slot route can read it server-side. Null until the MC
-- first saves availability (the editor seeds it from the browser).
alter table public.user_public_settings
  add column if not exists timezone text;
