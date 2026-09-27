-- A `paused` state for applied workflows (workflows trust remediation,
-- Phase 3, Task 16).
--
-- Until now an MC could only stop a couple's workflow outright
-- (`cancelled`). Paused is the reversible stop: nothing runs while it
-- holds, and the MC resumes it from the couple's Workflow tab.
--
-- The executor needs no change to honour it. Its due query joins
-- `workflow_instances!inner(status)` and keeps `status = 'active'` only,
-- and every per-instance guard in lib/workflows/executor.ts checks for
-- `active` too, so a paused instance's steps are invisible to the tick
-- the moment this CHECK admits the value.
--
-- Deliberately NOT the account-wide pause (Task 18). That is a separate
-- switch on the MC, not a state on each instance, so un-pausing the
-- account can never resume a workflow the MC paused on purpose.
--
-- The dedupe index (20261003000000) is `where status <> 'cancelled'`, so a
-- paused instance still blocks a duplicate enrolment of the same template
-- on the same couple. That is intended: paused is not finished.
--
-- Step 2 also fixes a sleeping `wait` having its wake time rewritten by
-- the wedding-date recompute (fix round 1 of the same task); see there.
-- Step 3 repairs the waits the old rewrite left with no wake at all.

-- 1. Admit `paused`.
--
-- @ALLOW_DESTRUCTIVE: drops and re-adds the status CHECK to widen it by
-- one value. Every existing row satisfies the new, larger set, so the
-- re-add validates without touching data. The constraint name is the
-- one Postgres generated for the inline CHECK in 20260905000000.
alter table public.workflow_instances
  drop constraint if exists workflow_instances_status_check;
alter table public.workflow_instances
  add constraint workflow_instances_status_check
  check (status in ('active', 'paused', 'completed', 'cancelled'));

-- 2. Keep a paused workflow following the wedding date, and stop
--    rewriting the wake time of a wait that is already asleep.
--
-- (a) `_workflow_recompute_wedding_steps` reshuffled `active` instances
-- only. A paused one would keep the dates it had when it was paused, so
-- a wedding moved later during the pause would leave its steps on the
-- old, earlier dates, and resuming would treat them as overdue and skip
-- them. Paused instances are included now; cancelled and completed ones
-- still are not.
--
-- (b) It also rewrote a sleeping `wait` step's due_at from the step's
-- template timing (20261004100000 kept `waiting` rows of type `wait` on
-- purpose). That was a bug. A wait's timing says when the wait STARTS;
-- when it starts, evaluateWaitAction writes the wake time (start plus the
-- configured duration) into due_at, and rewriting it from the timing
-- throws the duration away, so the wait ends at the next tick and the
-- send behind it goes out early. The TypeScript recompute
-- (`recomputeInstance`) had the same defect and now excludes every
-- `waiting` row; this function now does too. A wait that has not started
-- is `pending` and is still reshuffled like any other step.
--
-- (c) One sleeping wake does depend on the wedding: a wait in
-- `relative_to_event` mode ("until 7 days before the wedding"). When the
-- wedding moves, its wake is re-derived from the wait's OWN config, never
-- from the template timing, with the formula `computeWaitWakeAt`
-- (lib/automations/conditions.ts) uses: 09:00 on the anchor date plus or
-- minus the configured amount. `computeWaitWakeAt` builds that 09:00 in
-- the Node process's zone, which on the production runtime is UTC, so
-- this uses UTC too; anything else would move every such wake by the
-- zone offset each time the function runs, even when the date did not
-- change. A couple with no wedding date, or a config that does not parse,
-- leaves the wake alone: `computeWaitWakeAt` falls back to "now" there,
-- which would end the wait and send the step behind it.
--
-- Everything else is the body from 20261004100000 unchanged.
--
-- Non-destructive: `create or replace` keeps the signature. It also
-- keeps the grants, and the default ones let `anon` and `authenticated`
-- execute both functions below, so each is followed by an explicit
-- revoke (Phase 3 fix wave, I5). See (d).
--
-- (d) `_workflow_recompute_wedding_steps` is SECURITY DEFINER and takes
-- any couple id. Callable over PostgREST, it let anyone holding another
-- tenant's couple id re-date that tenant's steps, which undoes an MC's
-- manual reschedule: a send snoozed to next week went back to its past
-- wedding-relative date and out on the next tick. Its only callers are
-- the two SECURITY DEFINER triggers on `couples` and `events`
-- (20260905000100), which run as the function owner and keep working.
-- `_workflow_wait_relative_wake` is harmless (pure), but has no reason to
-- be exposed either.
--
-- The wake time of a `relative_to_event` wait for a given wedding date,
-- or null when there is nothing to derive it from. See (c) above.
--
-- This runs inside the couple or event UPDATE that fired the recompute,
-- so it must never raise: one malformed step would fail the MC's edit.
-- The shape checks below turn obvious garbage into null, and the
-- exception handler turns everything else into null too, whatever it is:
-- a cast, or arithmetic that runs past the range of a timestamp (a
-- six-digit number of weeks "before" a date does). A handler, not a
-- tighter bound, because a bound only covers the failure someone
-- thought of.
create or replace function public._workflow_wait_relative_wake(p_config jsonb, p_date date)
returns timestamptz
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_date is null
     or coalesce(p_config->'relative'->>'amount', '') !~ '^[0-9]{1,6}(\.[0-9]{1,6})?$'
     or coalesce(p_config->'relative'->>'unit', '') not in ('minutes', 'hours', 'days', 'weeks')
  then
    return null;
  end if;

  return (
    (p_date + time '09:00')
    + (case when p_config->'relative'->>'direction' = 'before' then -1 else 1 end)
      * (p_config->'relative'->>'amount')::numeric
      * case p_config->'relative'->>'unit'
          when 'minutes' then interval '1 minute'
          when 'hours' then interval '1 hour'
          when 'days' then interval '1 day'
          else interval '7 days'
        end
  ) at time zone 'UTC';
exception when others then
  return null;
end;
$$;

comment on function public._workflow_wait_relative_wake(jsonb, date) is
  'Wake time of a relative_to_event wait for a wedding date: 09:00 UTC on '
  'the date, plus or minus the configured amount, mirroring '
  'computeWaitWakeAt on the production runtime. Null when the date is '
  'missing or the config does not parse.';

-- See (d): internal to the recompute below, never an API.
revoke execute on function public._workflow_wait_relative_wake(jsonb, date)
  from public, anon, authenticated;
grant execute on function public._workflow_wait_relative_wake(jsonb, date)
  to service_role;

create or replace function public._workflow_recompute_wedding_steps(p_couple_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id  uuid;
  v_timezone text;
  v_date     date;
begin
  if p_couple_id is null then return; end if;

  select user_id into v_user_id from public.couples where id = p_couple_id;
  if v_user_id is null then return; end if;

  select coalesce(timezone, 'Australia/Sydney') into v_timezone
  from public.user_public_settings where user_id = v_user_id;
  v_timezone := coalesce(v_timezone, 'Australia/Sydney');

  v_date := public._workflow_couple_wedding_date(p_couple_id);

  -- Scheduled steps: re-derived from their template timing.
  update public.workflow_steps s
  set due_at = public._workflow_wedding_due_at(s.timing, v_date, v_timezone)
  from public.workflow_instances i
  where s.instance_id = i.id
    and i.couple_id = p_couple_id
    -- Paused too: see (a) in the header.
    and i.status in ('active', 'paused')
    -- Only steps still waiting to start. Terminal steps keep the due_at
    -- they had (it is history), and a `waiting` step's due_at is a time
    -- the engine chose when it parked it, not a schedule: an action
    -- parked on the send limiter, a missing variable or an approval, or
    -- a wait that is asleep (see (b) in the header).
    and s.status = 'pending'
    -- A pending step with attempts spent is holding the executor's retry
    -- backoff in its due_at, not a schedule.
    and not (s.status = 'pending' and s.attempt_count > 0)
    and s.timing->>'mode' = 'wedding_relative';

  -- Sleeping waits that wait on the wedding itself: re-derived from their
  -- own config. See (c) in the header.
  update public.workflow_steps s
  set due_at = public._workflow_wait_relative_wake(s.config, v_date)
  from public.workflow_instances i
  where s.instance_id = i.id
    and i.couple_id = p_couple_id
    and i.status in ('active', 'paused')
    and s.type = 'wait'
    and s.status = 'waiting'
    and s.config->>'mode' = 'relative_to_event'
    -- Null means "nothing to re-derive from" (no wedding date, or a
    -- config that does not parse): leave the wake alone.
    and public._workflow_wait_relative_wake(s.config, v_date) is not null
    and s.due_at is distinct from public._workflow_wait_relative_wake(s.config, v_date);
end;
$$;

comment on function public._workflow_recompute_wedding_steps(uuid) is
  'Reshuffles workflow steps on active and paused instances when a '
  'couple''s wedding date moves. Pending wedding_relative steps are '
  're-derived from their timing; apply_relative and after_previous steps '
  'are deliberately untouched, as is a pending step mid-retry (its due_at '
  'is the executor''s backoff). No waiting step is re-derived from its '
  'timing: its due_at is an engine park or a sleeping wait''s wake time. '
  'The one exception is a sleeping relative_to_event wait, whose wake is '
  're-derived from its own config (09:00 UTC on the anchor date, as '
  'computeWaitWakeAt resolves it on the production runtime).';

-- See (d): only the couples and events triggers (SECURITY DEFINER, run as
-- the owner) may call it. Revoked from `public` too, or the default grant
-- to PUBLIC would still reach `anon` and `authenticated`.
revoke execute on function public._workflow_recompute_wedding_steps(uuid)
  from public, anon, authenticated;
grant execute on function public._workflow_recompute_wedding_steps(uuid)
  to service_role;

-- 3. Repair waits the old recompute stranded.
--
-- Both recomputes used to rewrite a sleeping wait's due_at from its
-- template timing, and that timing resolves to null whenever the wait's
-- anchor is gone: the step before it was un-ticked, or the wedding date
-- was cleared under a wedding-relative wait. Those rows are `waiting`
-- with a null due_at. Nothing rewrites a waiting row any more (step 2), so
-- without this they would sleep forever and the step behind them would
-- never send.
--
-- The safe direction, row by row. Nothing here ever makes a wait due now,
-- so the repair itself cannot send anything.
--
-- - The step before the wait is open again (un-ticked): the wait goes
--   back to `pending` with no date, exactly as if it had never started.
--   When the MC ticks that step again, the ordinary recompute dates the
--   wait and it sleeps its full duration from then.
-- - Otherwise its wake is re-derived from its OWN config and a known
--   anchor: a `duration` wait from the moment it started (the step before
--   it finishing, plus the wait's own after_previous delay), a
--   `relative_to_event` wait from the wedding date. The executor holds a
--   wake that lands in quiet hours when it wakes, so quiet hours need no
--   handling here.
-- - A re-derived wake still in the future is written back, and the wait
--   carries on sleeping.
-- - Anything else (a wake already past, an `until_date` wait, a wait not
--   anchored after its previous step, a config that does not parse) is
--   left exactly as it is and flagged with one `step_waiting` audit row,
--   reason `wake_lost`, which the couple's activity feed shows. It is not
--   skipped: a skipped wait releases the step behind it, and the next
--   recompute would date that step from the repair, a send nobody timed.
--   The MC decides, with Skip on the row.
--
-- Kept as a function so the integration suite can exercise it and a
-- repeat run is harmless (restored rows are no longer null, flagged rows
-- are flagged once). Service role only.
--
-- Before deploying, the owner can size this in production with the
-- query below. It counts only live workflows (active or paused), since a
-- stranded wait on a stopped or finished one never runs either way. The
-- repair itself still visits every such row, which is harmless.
--   select count(*) from public.workflow_steps s
--   join public.workflow_instances i on i.id = s.instance_id
--   where s.type = 'wait' and s.status = 'waiting' and s.due_at is null
--     and i.status in ('active', 'paused');
create or replace function public._workflow_repair_stranded_waits()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r          record;
  v_prev     record;
  v_has_prev boolean;
  v_anchor   timestamptz;
  v_wake     timestamptz;
  v_regated  int := 0;
  v_restored int := 0;
  v_flagged  int := 0;
begin
  for r in
    select s.id, s.instance_id, s.position, s.parent_step_id, s.branch_path,
           s.config, s.timing, i.user_id, i.couple_id, i.applied_at
    from public.workflow_steps s
    join public.workflow_instances i on i.id = s.instance_id
    where s.type = 'wait' and s.status = 'waiting' and s.due_at is null
  loop
    v_wake := null;
    v_anchor := null;

    -- The previous step in the same lane (top level, or one side of a
    -- branch), as recomputeDueDates orders it.
    select p.status, p.completed_at into v_prev
    from public.workflow_steps p
    where p.instance_id = r.instance_id
      and p.parent_step_id is not distinct from r.parent_step_id
      and p.branch_path is not distinct from r.branch_path
      and p.position < r.position
    order by p.position desc
    limit 1;
    v_has_prev := found;

    if v_has_prev and v_prev.status not in ('done', 'skipped') then
      update public.workflow_steps
      set status = 'pending', attempt_count = 0
      where id = r.id and status = 'waiting' and due_at is null;
      v_regated := v_regated + 1;
      continue;
    end if;

    begin
      if r.config->>'mode' = 'duration'
         and r.config->>'durationMinutes' ~ '^[0-9]{1,6}$'
         and coalesce(r.timing->>'mode', 'after_previous') = 'after_previous' then
        if v_has_prev then
          v_anchor := v_prev.completed_at;
        elsif r.parent_step_id is not null then
          select completed_at into v_anchor
          from public.workflow_steps where id = r.parent_step_id;
        else
          v_anchor := r.applied_at;
        end if;
        if v_anchor is not null then
          v_wake := v_anchor
            + coalesce(
                case r.timing->>'unit'
                  when 'minutes' then interval '1 minute'
                  when 'hours' then interval '1 hour'
                  when 'days' then interval '1 day'
                end
                * case when r.timing->>'delayAmount' ~ '^[0-9]{1,6}$'
                    then (r.timing->>'delayAmount')::int else 0 end,
                interval '0')
            + (r.config->>'durationMinutes')::int * interval '1 minute';
        end if;
      elsif r.config->>'mode' = 'relative_to_event' then
        v_wake := public._workflow_wait_relative_wake(
          r.config, public._workflow_couple_wedding_date(r.couple_id));
      end if;
    exception when others then
      -- A row the formula cannot handle is flagged, never fatal: the
      -- migration must not fail a deploy over one odd step.
      v_wake := null;
    end;

    if v_wake is not null and v_wake > now() then
      update public.workflow_steps
      set due_at = v_wake
      where id = r.id and status = 'waiting' and due_at is null;
      v_restored := v_restored + 1;
    elsif not exists (
      select 1 from public.workflow_audit_log a
      where a.step_id = r.id
        and a.event = 'step_waiting'
        and a.detail->>'reason' = 'wake_lost'
    ) then
      insert into public.workflow_audit_log (user_id, instance_id, step_id, couple_id, event, detail)
      values (r.user_id, r.instance_id, r.id, r.couple_id, 'step_waiting',
              jsonb_build_object('reason', 'wake_lost'));
      v_flagged := v_flagged + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'regated', v_regated, 'restored', v_restored, 'flagged', v_flagged);
end;
$$;

revoke execute on function public._workflow_repair_stranded_waits() from public, anon, authenticated;

comment on function public._workflow_repair_stranded_waits() is
  'One-off repair (20261007000000) for waits the old recompute left '
  'waiting with a null due_at. Re-gates a wait whose previous step is open '
  'again, restores a future wake derived from the wait''s own config, and '
  'flags anything else with a wake_lost audit row. Never makes a wait due '
  'now. Idempotent. Service role only.';

select public._workflow_repair_stranded_waits();
