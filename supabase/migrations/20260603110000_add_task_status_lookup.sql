-- Persisted option list for the `status` column on `tasks`. Same
-- motivation as the `task_priorities` / `task_types` lookups added in
-- the previous migration: custom statuses created via the cell
-- dropdown previously vanished as soon as no task referenced them,
-- and had no user-pickable colour.
--
-- `tasks.status` continues to store the status **name** as free-form
-- text (kept that way during the priority/type lookup migration). The
-- lookup table is the source of truth for which options appear in the
-- dropdown and what colour they render in.
--
-- Built-in statuses (`todo` / `in_progress` / `done`) stay in
-- application code with their existing pill + dot colours and are
-- always shown in the dropdown regardless of the user's custom list.

create table if not exists task_statuses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  color       text not null default 'gray',
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists task_statuses_user_id_idx on task_statuses(user_id);
create unique index if not exists task_statuses_user_name_unique_idx
  on task_statuses(user_id, lower(name));

alter table task_statuses enable row level security;

create policy "Users manage own task statuses"
  on task_statuses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Backfill: any custom status already in use on a task gets a lookup
-- row so it keeps showing up in the dropdown after this migration.
-- Built-in statuses (todo/in_progress/done) are excluded — those stay
-- in application code.
insert into task_statuses (user_id, name, color, position)
select distinct t.user_id, t.status, 'gray', 0
from tasks t
where t.status is not null
  and lower(t.status) not in ('todo', 'in_progress', 'done')
on conflict do nothing;
