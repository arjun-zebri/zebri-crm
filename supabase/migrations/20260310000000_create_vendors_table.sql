-- Create vendors table
create table if not exists public.vendors (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  contact_name text,
  email text,
  phone text,
  category text not null default 'other' check (category in ('venue', 'celebrant', 'photographer', 'videographer', 'dj', 'florist', 'hair_makeup', 'caterer', 'photo_booth', 'lighting_av', 'planner', 'other')),
  notes text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.vendors enable row level security;

-- RLS Policy: Users can only access their own vendors
create policy "Users can view their own vendors"
  on public.vendors
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own vendors"
  on public.vendors
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own vendors"
  on public.vendors
  for update
  using (auth.uid() = user_id);

create policy "Users can delete their own vendors"
  on public.vendors
  for delete
  using (auth.uid() = user_id);

-- Create indexes for faster queries
create index if not exists vendors_user_id_idx on public.vendors(user_id);
create index if not exists vendors_created_at_idx on public.vendors(created_at);
