-- Send order after an early tick: clear the dates the old rule wrote.
--
-- Until this change, `recomputeDueDates` (lib/workflows/timing.ts) dated
-- a chained (`after_previous`) step from the step directly above it
-- only. Ticking a to-do early, while a send above it was still behind a
-- Wait, dated the send below the to-do from the tick, and it went out
-- first (owner report, 2026-09-27). The rule is now transitive up the
-- lane, but a date already written stays: the claim reads `due_at`
-- alone, and nothing recomputes an instance until one of its steps
-- moves. So a step dated early before the deploy could still send ahead
-- of the step above it after it.
--
-- Targeted, not "stamp every active instance". The heal pass reads 200
-- instances a tick (lib/workflows/heal.ts, HEAL_PAGE_SIZE x
-- HEAL_MAX_PAGES), and a request's kick can run the executor between
-- ticks, so stamping thousands would leave a stale step claimable for
-- many minutes. Instead, in one statement:
--
--   1. Every step the new rule would leave undated but which still has
--      a `due_at` is found: pending, chained, not mid-retry (a backoff
--      lives in `due_at`, and recomputeInstance never rewrites it
--      either), with an earlier step
--      in its lane (same parent step, same branch path) that is still
--      open (not done or skipped). A finished wedding- or apply-dated
--      step between them does not release it (owner ruling,
--      2026-09-27). Its `due_at` is set to null. That is the value the new
--      rule gives it, and a null date is never claimed, so this can only
--      stop a send, never start one.
--   2. Its instance is stamped `needs_recompute_at = now()`, so the heal
--      re-dates it with the real `recomputeDueDates` on the first tick,
--      in case anything in it should be dated after all.
--
-- `running` and `waiting` steps are left alone, like recomputeInstance:
-- a running one is already being sent, and a waiting one's date is a
-- park the engine chose. Only live instances (active or paused); a
-- paused one keeps its marker until it is active again, and its resume
-- recomputes anyway.
--
-- Sizing, for the deploy notes: the same predicate as a count.
--   (the query is in workflows.md,
--   "Deploy notes: send order after an early tick").
--
-- Kept as a function, like _workflow_repair_stranded_waits, so the
-- integration suite exercises this exact SQL and a repeat run is
-- harmless: a second run finds nothing, since every match is undated.
-- Service role only. Additive: one function, called once here.

create or replace function public._workflow_clear_early_tick_dates()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with stale as (
    update public.workflow_steps s
       set due_at = null
      from public.workflow_instances i
     where i.id = s.instance_id
       and i.status in ('active', 'paused')
       and s.status = 'pending'
       and s.due_at is not null
       and coalesce(s.attempt_count, 0) = 0
       -- Read like toStepTiming: anything not a known dated mode is chained.
       and coalesce(s.timing ->> 'mode', '') not in ('wedding_relative', 'apply_relative')
       and exists (
         select 1
         from public.workflow_steps p
         where p.instance_id = s.instance_id
           and p.parent_step_id is not distinct from s.parent_step_id
           and p.branch_path is not distinct from s.branch_path
           and p.position < s.position
           -- A finished row with no finish time releases nothing
           -- (`releasedAfter`, `releaseBlocker`).
           and (p.status not in ('done', 'skipped') or p.completed_at is null)
       )
    returning s.instance_id
  )
  update public.workflow_instances i
     set needs_recompute_at = now()
   where i.id in (select instance_id from stale);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public._workflow_clear_early_tick_dates()
  from public, anon, authenticated;
grant execute on function public._workflow_clear_early_tick_dates() to service_role;

comment on function public._workflow_clear_early_tick_dates() is
  'One-off repair (20261024700000): nulls the due_at of chained pending '
  'steps the old one-step release rule dated while an earlier step in '
  'their lane was still open, and stamps their instances for the heal. '
  'Never makes a step due. Idempotent. Service role only. Returns the '
  'number of instances stamped.';

select public._workflow_clear_early_tick_dates();
