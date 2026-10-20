-- A relative-date Wait wakes at 9am in the MC's timezone, not 9am UTC.
--
-- computeWaitWakeAt (lib/automations/conditions.ts) built a dated wake
-- as `${date}T09:00:00` parsed on the server, which runs in UTC, and
-- `_workflow_wait_relative_wake` (20261024600000) mirrored it with
-- `at time zone 'UTC'`. So "2 months before the wedding" woke at 8pm in
-- Sydney (owner report, 2026-10-20). The runner now resolves 09:00 in the
-- MC's timezone (user_public_settings.timezone, Sydney when unset), and
-- this migration makes the database agree:
--
-- (a) `_workflow_wait_relative_wake_local(config, date, timezone)`: the
--     same rule as the runner. Days, weeks and months shift the calendar
--     date, then take 09:00 local on it, so a wait across a daylight-
--     saving switch still wakes at 9am on the wall clock. Minutes and
--     hours are an elapsed offset from 09:00 local on the wedding day.
-- (b) `_workflow_recompute_wedding_steps` re-derives sleeping relative
--     waits with (a) in the timezone it already reads for the scheduled
--     steps. Its body is otherwise the 20261023700000 body unchanged.
--     It also picks up a wait parked for a missing wedding date (wake
--     9999-12-31, reason needs_wedding_date): once a date is set, (a)
--     returns a real wake and the update moves it.
-- (c) One pass over the waits already asleep on the old 09:00 UTC wake,
--     moving each to 09:00 local. Only a wake that still equals the old
--     formula's answer is touched, so a wake the engine pushed out of
--     quiet hours, or one an MC moved, is left alone.
--
-- The 2-argument `_workflow_wait_relative_wake` stays (nothing calls it
-- after this), so replay from zero and older branches keep working.
--
-- Non-destructive: new function, `create or replace` with the same
-- signature, and an UPDATE limited to sleeping waits.

-- (a)
create or replace function public._workflow_wait_relative_wake_local(
  p_config jsonb,
  p_date date,
  p_timezone text
)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  v_amount numeric;
  v_sign   integer;
  v_unit   text;
  v_day    date;
begin
  if p_date is null
     or coalesce(p_config->'relative'->>'amount', '') !~ '^[0-9]{1,6}(\.[0-9]{1,6})?$'
     or coalesce(p_config->'relative'->>'unit', '') not in ('minutes', 'hours', 'days', 'weeks', 'months')
  then
    return null;
  end if;

  v_amount := (p_config->'relative'->>'amount')::numeric;
  v_sign := case when p_config->'relative'->>'direction' = 'before' then -1 else 1 end;
  v_unit := p_config->'relative'->>'unit';

  if v_unit in ('minutes', 'hours') then
    -- Elapsed time from 9am local on the wedding day. An interval with
    -- only a time part adds absolute time to a timestamptz.
    return ((p_date + time '09:00') at time zone coalesce(p_timezone, 'Australia/Sydney'))
      + v_sign * v_amount
        * case v_unit when 'minutes' then interval '1 minute' else interval '1 hour' end;
  end if;

  -- Calendar arithmetic on the date (months clamp to month end, as
  -- addMonthsToDateString does), then 9am local on the day it lands.
  v_day := (
    p_date
    + v_sign * v_amount
      * case v_unit
          when 'days' then interval '1 day'
          when 'weeks' then interval '7 days'
          else interval '1 month'
        end
  )::date;
  return (v_day + time '09:00') at time zone coalesce(p_timezone, 'Australia/Sydney');
exception when others then
  return null;
end;
$$;

comment on function public._workflow_wait_relative_wake_local(jsonb, date, text) is
  'Wake time of a relative_to_event wait for a wedding date: 09:00 in the '
  'MC''s timezone on the date shifted by the configured days, weeks or '
  'calendar months, or 09:00 local on the date plus or minus minutes or '
  'hours. Mirrors computeWaitWakeAt. Null when the date is missing or the '
  'config does not parse.';

revoke execute on function public._workflow_wait_relative_wake_local(jsonb, date, text)
  from public, anon, authenticated;
grant execute on function public._workflow_wait_relative_wake_local(jsonb, date, text)
  to service_role;

-- (b)
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
    and i.status in ('active', 'paused')
    and s.status = 'pending'
    and not (s.status = 'pending' and s.attempt_count > 0)
    -- A step the MC took the date off stays undated: moving the wedding
    -- is not the MC dating it.
    and s.due_held_at is null
    and s.timing->>'mode' = 'wedding_relative';

  -- Sleeping waits that wait on the wedding itself: re-derived from their
  -- own config, at 9am in the MC's timezone. A wait parked because the
  -- couple had no date gets its real wake here once one is set.
  update public.workflow_steps s
  set due_at = public._workflow_wait_relative_wake_local(s.config, v_date, v_timezone)
  from public.workflow_instances i
  where s.instance_id = i.id
    and i.couple_id = p_couple_id
    and i.status in ('active', 'paused')
    and s.type = 'wait'
    and s.status = 'waiting'
    and s.config->>'mode' = 'relative_to_event'
    and s.due_held_at is null
    and public._workflow_wait_relative_wake_local(s.config, v_date, v_timezone) is not null
    and s.due_at is distinct from public._workflow_wait_relative_wake_local(s.config, v_date, v_timezone);
end;
$$;

comment on function public._workflow_recompute_wedding_steps(uuid) is
  'Reshuffles workflow steps on active and paused instances when a '
  'couple''s wedding date moves. Pending wedding_relative steps are '
  're-derived from their timing; apply_relative and after_previous steps '
  'are deliberately untouched, as is a pending step mid-retry (its due_at '
  'is the executor''s backoff) and a step the MC took the date off '
  '(due_held_at). No waiting step is re-derived from its timing: its '
  'due_at is an engine park or a sleeping wait''s wake time. The one '
  'exception is a sleeping relative_to_event wait, whose wake is '
  're-derived from its own config at 9am in the MC''s timezone.';

revoke execute on function public._workflow_recompute_wedding_steps(uuid)
  from public, anon, authenticated;
grant execute on function public._workflow_recompute_wedding_steps(uuid)
  to service_role;

-- (c)
update public.workflow_steps s
set due_at = public._workflow_wait_relative_wake_local(
  s.config,
  public._workflow_couple_wedding_date(i.couple_id),
  coalesce(ups.timezone, 'Australia/Sydney')
)
from public.workflow_instances i
left join public.user_public_settings ups on ups.user_id = i.user_id
where s.instance_id = i.id
  and i.status in ('active', 'paused')
  and s.type = 'wait'
  and s.status = 'waiting'
  and s.config->>'mode' = 'relative_to_event'
  and s.due_held_at is null
  -- Still on the old 09:00 UTC wake, and nothing else moved it.
  and s.due_at = public._workflow_wait_relative_wake(
    s.config,
    public._workflow_couple_wedding_date(i.couple_id)
  )
  and public._workflow_wait_relative_wake_local(
    s.config,
    public._workflow_couple_wedding_date(i.couple_id),
    coalesce(ups.timezone, 'Australia/Sydney')
  ) is not null;

select public.ensure_require_mfa_policies();
select public.ensure_shadow_triggers();
