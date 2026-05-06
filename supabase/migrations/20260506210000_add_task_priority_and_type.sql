-- Tasks: add priority + free-form task_type for Notion-style property columns

alter table public.tasks
  add column if not exists priority text check (priority in ('low', 'medium', 'high')),
  add column if not exists task_type text;

create index if not exists tasks_priority_idx on public.tasks(priority);
create index if not exists tasks_task_type_idx on public.tasks(task_type);
