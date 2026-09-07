-- Freeze the retired Tasks and Automations tables.
--
-- Not destructive: no data is removed and SELECT stays open, so a
-- support question about what a row used to hold is still answerable.
-- Only the write paths close. The tables are dropped in a later
-- migration, once the cutover has been live long enough to trust.
--
-- Writes are closed by dropping the write policies rather than revoking
-- DML grants: policies are easier to read here, and easier to put back
-- if the cutover has to be rolled back.
--
-- ⚠ `automation_events` and `couple_custom_fields` are deliberately NOT
-- frozen. Despite the name, `automation_events` is the live event bus
-- the workflow dispatcher reads, and roughly a dozen DB triggers write
-- to it through `emit_automation_event`. `couple_custom_fields` is read
-- by the variable resolver. Freezing either breaks the new engine.


-- ────────────────────────────────────────────────────────────────
-- tasks
-- ────────────────────────────────────────────────────────────────
drop policy if exists "Users can insert their own tasks" on public.tasks;
drop policy if exists "Users can update their own tasks" on public.tasks;
drop policy if exists "Users can delete their own tasks" on public.tasks;

comment on table public.tasks is
  'RETIRED 2026-09. Replaced by workflow_steps. Read-only: the write policies are dropped.';


-- ────────────────────────────────────────────────────────────────
-- task lookup tables
-- ────────────────────────────────────────────────────────────────
-- These carried the custom priorities, statuses, types and groups the
-- Tasks page let an MC define. Steps are checklist-simple, so all four
-- retire with it. Each had one `for all` policy, so the freeze replaces
-- it with a select-only one rather than dropping a write policy.
drop policy if exists "Users manage own task groups" on public.task_groups;
create policy task_groups_select_own on public.task_groups
  for select using (auth.uid() = user_id);

drop policy if exists "Users manage own task statuses" on public.task_statuses;
create policy task_statuses_select_own on public.task_statuses
  for select using (auth.uid() = user_id);

drop policy if exists "Users manage own task priorities" on public.task_priorities;
create policy task_priorities_select_own on public.task_priorities
  for select using (auth.uid() = user_id);

drop policy if exists "Users manage own task types" on public.task_types;
create policy task_types_select_own on public.task_types
  for select using (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────────
-- automations
-- ────────────────────────────────────────────────────────────────
drop policy if exists automations_insert_own on public.automations;
drop policy if exists automations_update_own on public.automations;
drop policy if exists automations_delete_own on public.automations;

drop policy if exists automation_actions_insert_own on public.automation_actions;
drop policy if exists automation_actions_update_own on public.automation_actions;
drop policy if exists automation_actions_delete_own on public.automation_actions;

-- The only write policy runs was a user-facing pause. There is nothing
-- left to pause: the runner is gone.
drop policy if exists automation_runs_update_own_pause on public.automation_runs;

comment on table public.automations is
  'RETIRED 2026-09. Converted into workflow_templates. Read-only: the write policies are dropped.';
comment on table public.automation_actions is
  'RETIRED 2026-09. Converted into workflow_template_steps. Read-only.';
comment on table public.automation_runs is
  'RETIRED 2026-09. An applied workflow_instances row IS the run now. Read-only.';

-- automation_waits and automation_audit_log never had write policies:
-- both were service-role only. Nothing to drop, so they are already
-- frozen for users.
comment on table public.automation_waits is
  'RETIRED 2026-09. The wait step type carries its own due_at. Service-role only, already frozen.';
comment on table public.automation_audit_log is
  'RETIRED 2026-09. Replaced by workflow_audit_log. Service-role writes only, already frozen.';
