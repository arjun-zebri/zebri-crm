-- The account-wide emergency stop for workflow automation (workflows
-- trust remediation, Phase 3, Task 18).
--
-- One switch per MC that stops every automated workflow step on their
-- account at once: the executor skips their due steps and the send gate
-- refuses their automated sends. It is separate from an instance's own
-- `paused` status (Task 16) and from turning one workflow off (Task 17):
-- it never writes `workflow_instances.status`, so lifting it cannot
-- resume a couple the MC paused on purpose, and resuming one couple
-- cannot lift it.
--
--   workflows_paused_at   when the stop went on; null means running.
--   workflows_resumed_at  when it was lifted; null while it is still on.
--
-- Stopped means `workflows_paused_at is not null and workflows_resumed_at
-- is null`. Once lifted, the pair is the window the stop covered: an
-- automated step whose due time fell inside it is skipped with an audit
-- line rather than sent late, evaluated lazily by the executor (a sweep
-- at lift time could time out on a large account).
--
-- On `user_public_settings` rather than auth metadata because the tick
-- reads every paused MC in one query; a metadata read would be one
-- auth-admin call per MC per tick. The table's own-row RLS policies
-- already cover the new columns.
--
-- Additive only: two nullable columns with no default, a CHECK every
-- existing row satisfies (both null), and a partial index.

alter table public.user_public_settings
  add column if not exists workflows_paused_at timestamptz,
  add column if not exists workflows_resumed_at timestamptz;

-- A lift only means something after a stop, and a window that ends
-- before it starts would skip nothing and read as "still stopped" to
-- nobody. Rejected at the row so a direct write cannot store either.
alter table public.user_public_settings
  drop constraint if exists user_public_settings_workflows_pause_window_check;
alter table public.user_public_settings
  add constraint user_public_settings_workflows_pause_window_check
  check (
    workflows_resumed_at is null
    or (workflows_paused_at is not null and workflows_resumed_at >= workflows_paused_at)
  );

-- The tick reads "every MC who has ever stopped" once a minute. Almost
-- nobody has, so the partial index keeps that read to a handful of rows.
create index if not exists user_public_settings_workflows_paused_idx
  on public.user_public_settings (user_id)
  where workflows_paused_at is not null;

comment on column public.user_public_settings.workflows_paused_at is
  'Account-wide stop for workflow automation: when it went on. Null means running. Never touches workflow_instances.status.';
comment on column public.user_public_settings.workflows_resumed_at is
  'When the account-wide stop was lifted; null while it is on. [paused_at, resumed_at] is the window whose due steps are skipped, not sent late.';
