-- Drop the priority enum check so users can create custom priority labels
-- (mirrors the existing free-form behaviour of status and task_type).

alter table public.tasks drop constraint if exists tasks_priority_check;
