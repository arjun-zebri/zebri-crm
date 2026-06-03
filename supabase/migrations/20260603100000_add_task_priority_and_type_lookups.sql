-- Persisted option lists for the `priority` and `task_type` columns on
-- `tasks`. Before this migration the Notion-style dropdowns derived
-- their option list from whichever values appeared on currently-loaded
-- rows — which meant a user could "create" a new priority or type in
-- the cell popover and it would vanish from the dropdown as soon as no
-- task referenced it. These lookup tables make the option list a first
-- class entity per user, with a colour that follows the option around.
--
-- `tasks.priority` / `tasks.task_type` continue to store the option
-- **name** as free-form text — that keeps the existing reads/writes
-- working and avoids a large join on every task fetch. The lookup
-- table is the source of truth for "which options exist" and "what
-- colour to render them in"; the tasks table is just the assignments.
--
-- Built-in priorities (low/medium/high) stay in application code with
-- their existing pill colours and are not inserted here — they're
-- always shown in the dropdown regardless of the user's custom list.

create table if not exists task_priorities (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  color       text not null default 'gray',
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists task_priorities_user_id_idx on task_priorities(user_id);
-- Case-insensitive uniqueness so "Critical" and "critical" can't both
-- exist for the same user.
create unique index if not exists task_priorities_user_name_unique_idx
  on task_priorities(user_id, lower(name));

alter table task_priorities enable row level security;

create policy "Users manage own task priorities"
  on task_priorities for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


create table if not exists task_types (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  color       text not null default 'gray',
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists task_types_user_id_idx on task_types(user_id);
create unique index if not exists task_types_user_name_unique_idx
  on task_types(user_id, lower(name));

alter table task_types enable row level security;

create policy "Users manage own task types"
  on task_types for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- Backfill: any custom priority / task_type already in use on a task
-- gets a lookup row so it keeps showing up in the dropdown after this
-- migration lands. Built-in priorities (low/medium/high) are excluded —
-- those stay in application code.
insert into task_priorities (user_id, name, color, position)
select distinct t.user_id, t.priority, 'gray', 0
from tasks t
where t.priority is not null
  and lower(t.priority) not in ('low', 'medium', 'high')
on conflict do nothing;

insert into task_types (user_id, name, color, position)
select distinct t.user_id, t.task_type, 'gray', 0
from tasks t
where t.task_type is not null
on conflict do nothing;
