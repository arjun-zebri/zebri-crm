-- Couple time tracking: per-couple work sessions plus the user's own
-- category vocabulary.
--
-- A session with ended_at = null is RUNNING. Duration is never stored,
-- it is always (ended_at - started_at), so "edit the duration" is
-- "move ended_at".

create table if not exists public.time_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- Case-insensitive uniqueness per user so "Travel" and "travel" cannot
-- both exist and the type-to-create picker can resolve a typed name to
-- an existing row.
create unique index if not exists time_categories_user_lower_name_key
  on public.time_categories (user_id, lower(name));

alter table public.time_categories enable row level security;

drop policy if exists "Users manage own time categories" on public.time_categories;
create policy "Users manage own time categories"
  on public.time_categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.couple_time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  category_id uuid references public.time_categories(id) on delete set null,
  note text,
  auto_stopped boolean not null default false,
  created_at timestamptz not null default now(),
  constraint couple_time_entries_ends_after_start
    check (ended_at is null or ended_at > started_at)
);

-- The Time tab reads one couple's sessions newest-first.
create index if not exists couple_time_entries_user_couple_started_idx
  on public.couple_time_entries (user_id, couple_id, started_at desc);

-- FK index (repo convention: every foreign key gets an index).
create index if not exists couple_time_entries_category_idx
  on public.couple_time_entries (category_id);

-- "One running timer per user" as a database invariant, not an
-- application convention: two tabs racing on Start makes the second
-- insert fail loudly instead of silently producing two live timers.
create unique index if not exists couple_time_entries_one_running_per_user
  on public.couple_time_entries (user_id)
  where ended_at is null;

alter table public.couple_time_entries enable row level security;

drop policy if exists "Users manage own time entries" on public.couple_time_entries;
create policy "Users manage own time entries"
  on public.couple_time_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Seed-once marker for the starter category set. Without it, a user who
-- deletes all their categories would have them resurrected on the next
-- read.
alter table public.user_public_settings
  add column if not exists time_categories_seeded boolean not null default false;
