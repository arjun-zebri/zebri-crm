-- Create tasks table
create table if not exists public.tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  related_event_id uuid references public.events(id) on delete set null,
  related_couple_id uuid references public.couples(id) on delete set null,
  related_vendor_id uuid references public.vendors(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.tasks enable row level security;

-- RLS Policy: Users can only access their own tasks
create policy "Users can view their own tasks"
  on public.tasks
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own tasks"
  on public.tasks
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own tasks"
  on public.tasks
  for update
  using (auth.uid() = user_id);

create policy "Users can delete their own tasks"
  on public.tasks
  for delete
  using (auth.uid() = user_id);

-- Create indexes for faster queries
create index if not exists tasks_user_id_idx on public.tasks(user_id);
create index if not exists tasks_related_event_id_idx on public.tasks(related_event_id);
create index if not exists tasks_related_couple_id_idx on public.tasks(related_couple_id);
create index if not exists tasks_related_vendor_id_idx on public.tasks(related_vendor_id);
create index if not exists tasks_created_at_idx on public.tasks(created_at);
