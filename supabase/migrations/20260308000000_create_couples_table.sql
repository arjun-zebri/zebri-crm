-- Create couples table
create table if not exists public.couples (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  event_date date,
  venue text,
  notes text,
  status text not null default 'new' check (status in ('new', 'contacted', 'quoted', 'lost')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.couples enable row level security;

-- RLS Policy: Users can only access their own couples
create policy "Users can view their own couples"
  on public.couples
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own couples"
  on public.couples
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own couples"
  on public.couples
  for update
  using (auth.uid() = user_id);

create policy "Users can delete their own couples"
  on public.couples
  for delete
  using (auth.uid() = user_id);

-- Create index on user_id for faster queries
create index if not exists couples_user_id_idx on public.couples(user_id);
create index if not exists couples_created_at_idx on public.couples(created_at);
