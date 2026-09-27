-- Phase 6 fix wave: "Take the date off" is a persisted hold that every
-- recompute respects.
--
-- An MC holds a step by taking its date off (rescheduleStepAction with a
-- null date). That only wrote `due_at = null`, and every recompute of the
-- instance (a sibling step being ticked, the heal pass on a marked
-- instance, a resume) re-derived the date from the step's timing and the
-- executor sent what the MC had held (Task 36 fix round 2, concern 4;
-- re-review N1). A null date is not evidence of a hold, so the hold is
-- now recorded:
--
-- 1. `workflow_steps.due_held_at`: set when the MC takes the date off,
--    cleared when they set a date. A held step is never re-dated by the
--    TypeScript recompute (`recomputeDueDates` in lib/workflows/timing.ts,
--    which recomputeInstance, the heal and the resume all go through) and
--    never claimed by the engine (workflow_claim_step, migration
--    20261023800000). The MC's own "Send now" still runs it, and clears
--    the hold as it claims.
-- 2. `_workflow_recompute_wedding_steps`, the other recompute (it runs
--    when a couple's wedding date moves), skips a held step too. Its body
--    is 20261007000000's unchanged apart from the two `due_held_at is null`
--    predicates.
--
-- Additive: one nullable column (metadata only, every row reads as not
-- held) and one function body with the same signature and grants.

alter table public.workflow_steps
  add column if not exists due_held_at timestamptz;

comment on column public.workflow_steps.due_held_at is
  'When the MC took this step''s date off ("Take the date off"). Non-null means held: no recompute re-dates it and the engine never claims it until the MC sets a date, which clears this.';

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
  -- own config (20261007000000 (c)).
  update public.workflow_steps s
  set due_at = public._workflow_wait_relative_wake(s.config, v_date)
  from public.workflow_instances i
  where s.instance_id = i.id
    and i.couple_id = p_couple_id
    and i.status in ('active', 'paused')
    and s.type = 'wait'
    and s.status = 'waiting'
    and s.config->>'mode' = 'relative_to_event'
    and s.due_held_at is null
    and public._workflow_wait_relative_wake(s.config, v_date) is not null
    and s.due_at is distinct from public._workflow_wait_relative_wake(s.config, v_date);
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
  're-derived from its own config.';

revoke execute on function public._workflow_recompute_wedding_steps(uuid)
  from public, anon, authenticated;
grant execute on function public._workflow_recompute_wedding_steps(uuid)
  to service_role;

-- A new column and no policy change, but both helpers are idempotent, so
-- re-assert them rather than rely on that reasoning.
select public.ensure_require_mfa_policies();
select public.ensure_shadow_triggers();
