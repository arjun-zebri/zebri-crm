-- Phase 14a remediation #2: re-point the legacy FK from the
-- prior `automation_steps` table to the current `automation_actions`
-- table.
--
-- Background: the Step→Action rename (commit 976a1a6) edited the
-- foundation migration's column name from `current_step_id` to
-- `current_action_id`. The previous migration in this branch
-- (20260609000000) renames the column on any env that still has
-- the legacy name. But `RENAME COLUMN` does NOT touch the FK
-- constraint's name or its target table. So on a legacy env the
-- chain looks like:
--
--   automation_runs.current_action_id (renamed)
--     → constraint `automation_runs_current_step_id_fkey` (legacy name)
--       → references `automation_steps`(id) (legacy target)
--
-- Inserting a run with `current_action_id` pointing at an
-- `automation_actions(id)` row fails the FK check with 23503
-- because the id is looked up in `automation_steps`, not
-- `automation_actions`. End-user symptom: every tick's dispatcher
-- match() succeeds but `openedRuns` stays 0.
--
-- This migration:
--   1. Drops the legacy FK if present.
--   2. Nulls any orphan `current_action_id` values whose ids don't
--      exist in `automation_actions` (so the new FK can be added
--      without violation — there is no data we need to preserve
--      from legacy `automation_steps` references).
--   3. Adds the FK with the correct name + target if absent.
--
-- All steps are idempotent: a fresh env (FK already correct) hits
-- no branches and the migration is a no-op.

do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'automation_runs'
      and constraint_name = 'automation_runs_current_step_id_fkey'
  ) then
    alter table public.automation_runs
      drop constraint automation_runs_current_step_id_fkey;
  end if;
end $$;

update public.automation_runs
set current_action_id = null
where current_action_id is not null
  and not exists (
    select 1 from public.automation_actions a
    where a.id = automation_runs.current_action_id
  );

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'automation_runs'
      and constraint_name = 'automation_runs_current_action_id_fkey'
  ) then
    alter table public.automation_runs
      add constraint automation_runs_current_action_id_fkey
      foreign key (current_action_id)
      references public.automation_actions(id) on delete set null;
  end if;
end $$;
