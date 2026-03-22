-- Create couple_statuses table
create table if not exists public.couple_statuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  color text not null default 'gray',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique(user_id, slug)
);

alter table public.couple_statuses enable row level security;

create policy "Users manage own statuses"
  on public.couple_statuses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Drop hardcoded check constraint from couples table
alter table public.couples drop constraint if exists couples_status_check;
