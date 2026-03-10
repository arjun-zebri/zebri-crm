-- Create events table
create table if not exists public.events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  date date not null,
  venue text,
  timeline_notes text,
  status text not null default 'upcoming' check (status in ('upcoming', 'completed', 'cancelled')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.events enable row level security;

-- RLS Policy: Users can only access their own events
create policy "Users can view their own events"
  on public.events
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own events"
  on public.events
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own events"
  on public.events
  for update
  using (auth.uid() = user_id);

create policy "Users can delete their own events"
  on public.events
  for delete
  using (auth.uid() = user_id);

-- Create indexes for faster queries
create index if not exists events_user_id_idx on public.events(user_id);
create index if not exists events_couple_id_idx on public.events(couple_id);
create index if not exists events_created_at_idx on public.events(created_at);
