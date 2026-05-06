-- Task groups: user-defined sections for organising tasks (custom Group-by mode)

create table if not exists task_groups (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  color       text not null default 'gray',
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists task_groups_user_id_idx on task_groups(user_id);

alter table task_groups enable row level security;

create policy "Users manage own task groups"
  on task_groups for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Tasks: add group + position for ordering within a group / flat list
alter table public.tasks
  add column if not exists group_id uuid references task_groups(id) on delete set null,
  add column if not exists position integer not null default 0;

create index if not exists tasks_group_id_idx on public.tasks(group_id);
