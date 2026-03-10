-- Create event_vendors join table
create table if not exists public.event_vendors (
  id uuid default gen_random_uuid() primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (event_id, vendor_id)
);

-- Enable RLS
alter table public.event_vendors enable row level security;

-- RLS Policy: Users can only access their own event_vendors
create policy "Users can view their own event_vendors"
  on public.event_vendors
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own event_vendors"
  on public.event_vendors
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own event_vendors"
  on public.event_vendors
  for update
  using (auth.uid() = user_id);

create policy "Users can delete their own event_vendors"
  on public.event_vendors
  for delete
  using (auth.uid() = user_id);

-- Create indexes for faster queries
create index if not exists event_vendors_user_id_idx on public.event_vendors(user_id);
create index if not exists event_vendors_event_id_idx on public.event_vendors(event_id);
create index if not exists event_vendors_vendor_id_idx on public.event_vendors(vendor_id);
