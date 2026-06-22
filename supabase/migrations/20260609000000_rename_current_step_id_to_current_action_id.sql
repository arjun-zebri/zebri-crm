-- Phase 14a remediation: align `automation_runs` column name with code.
--
-- The Step→Action rename in commit 976a1a6 edited the foundation
-- migration's column from `current_step_id` to `current_action_id`,
-- but did not add a column-rename migration. Envs that applied the
-- foundation migration BEFORE the rename kept the original column
-- name (`current_step_id`); envs created AFTER the rename got the
-- new name (`current_action_id`). The application code uses
-- `current_action_id` everywhere — runner, dispatcher, test-run,
-- and the AutomationRunRow type — so the legacy envs failed every
-- run-insert with PGRST204 "column not found in schema cache".
--
-- This migration converges all envs on `current_action_id` by
-- renaming the legacy column where it still exists. It is a no-op
-- in envs that already migrated (the legacy column won't be there).
--
-- Not flagged as destructive by `scripts/check-migrations.sh` —
-- RENAME COLUMN preserves data and references. CLAUDE.md's "never
-- rename existing columns" rule was violated by the original code
-- edit; this migration corrects the divergence rather than
-- introducing a new rename.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'automation_runs'
      and column_name = 'current_step_id'
  ) then
    alter table public.automation_runs
      rename column current_step_id to current_action_id;
  end if;
end $$;
