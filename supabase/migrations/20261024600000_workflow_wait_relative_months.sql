-- A relative-date Wait in months (owner ruling 2026-09-27, wait block).
--
-- The Wait step's "Relative date" mode (config.mode 'relative_to_event',
-- "2 weeks before the event") gains a `months` unit. The runner computes
-- it in computeWaitWakeAt (lib/automations/conditions.ts) as calendar
-- months on the event's own date, clamped to the end of a shorter month
-- (31 March minus 1 month is 28 or 29 February), then 09:00 like every
-- other unit.
--
-- When a wedding moves, `_workflow_recompute_wedding_steps` re-derives a
-- sleeping relative-date Wait's wake from its config with
-- `_workflow_wait_relative_wake` (20261007000000 (c)). That function
-- refused any unit but minutes/hours/days/weeks and returned null, so a
-- months Wait would keep its old wake when the wedding moved. It now
-- takes `months` too. Postgres month arithmetic on a timestamp clamps to
-- month end exactly as addMonthsToDateString does, and the 09:00 UTC
-- stays, mirroring computeWaitWakeAt on the production runtime (UTC), so
-- the two never disagree and a recompute never moves a wake for nothing.
--
-- Everything else is the 20261007000000 body unchanged: the shape
-- checks, the never-raise handler, and the grants (internal to the
-- recompute, never an API).
--
-- Non-destructive: `create or replace` with the same signature. Replay
-- from zero is safe: it only redefines a pure function.

create or replace function public._workflow_wait_relative_wake(p_config jsonb, p_date date)
returns timestamptz
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_date is null
     or coalesce(p_config->'relative'->>'amount', '') !~ '^[0-9]{1,6}(\.[0-9]{1,6})?$'
     or coalesce(p_config->'relative'->>'unit', '') not in ('minutes', 'hours', 'days', 'weeks', 'months')
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
          -- Calendar months, clamped to month end by Postgres.
          when 'months' then interval '1 month'
          else interval '7 days'
        end
  ) at time zone 'UTC';
exception when others then
  return null;
end;
$$;

comment on function public._workflow_wait_relative_wake(jsonb, date) is
  'Wake time of a relative_to_event wait for a wedding date: 09:00 UTC on '
  'the date, plus or minus the configured amount (calendar months clamped '
  'to month end for `months`), mirroring computeWaitWakeAt on the '
  'production runtime. Null when the date is missing or the config does '
  'not parse.';

revoke execute on function public._workflow_wait_relative_wake(jsonb, date)
  from public, anon, authenticated;
grant execute on function public._workflow_wait_relative_wake(jsonb, date)
  to service_role;

select public.ensure_require_mfa_policies();
select public.ensure_shadow_triggers();
