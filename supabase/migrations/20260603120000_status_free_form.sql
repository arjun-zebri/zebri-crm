-- Drop the status enum check on tasks so users can apply custom
-- status labels created via the StatusCell dropdown — mirrors the
-- earlier `priority_free_form` migration that did the same for
-- `tasks.priority`.
--
-- Without this, patching a task with a custom status (one that
-- doesn't appear in the seeded `('todo', 'in_progress', 'done')`
-- list) hits `tasks_status_check` and rolls back the optimistic UI
-- update, so the new status visibly fails to apply.
--
-- The application still treats those three values as built-in (with
-- hardcoded pill / dot colours); the `task_statuses` lookup added in
-- 20260603110000 backs the rest.

alter table public.tasks drop constraint if exists tasks_status_check;
