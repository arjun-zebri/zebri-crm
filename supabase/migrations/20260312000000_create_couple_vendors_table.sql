-- Create couple_vendors join table
create table if not exists public.couple_vendors (
  id uuid default gen_random_uuid() primary key,
  couple_id uuid not null references public.couples(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (couple_id, vendor_id)
);

-- Enable RLS
alter table public.couple_vendors enable row level security;

-- RLS Policy: Users can only access their own couple_vendors
create policy "Users can view their own couple_vendors"
  on public.couple_vendors
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own couple_vendors"
  on public.couple_vendors
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own couple_vendors"
  on public.couple_vendors
  for update
  using (auth.uid() = user_id);

create policy "Users can delete their own couple_vendors"
  on public.couple_vendors
  for delete
  using (auth.uid() = user_id);

-- Create indexes for faster queries
create index if not exists couple_vendors_user_id_idx on public.couple_vendors(user_id);
create index if not exists couple_vendors_couple_id_idx on public.couple_vendors(couple_id);
create index if not exists couple_vendors_vendor_id_idx on public.couple_vendors(vendor_id);
