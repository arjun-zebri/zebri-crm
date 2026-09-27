-- A Wait has one number (wait card simplification).
--
-- Every step carries a generic start timing (`timing`: "after the step
-- above, 2 days"), and a Wait step also carries its own duration
-- (`config.durationMinutes`). The engine honoured both in turn: the step
-- came due after the offset, then slept for the duration. So the real
-- delay was their sum, and the builder card showed two numbers with no
-- hint that they add up. The card now shows only the duration, and a Wait
-- always starts straight after the step above. "Ask me before this runs"
-- (`requires_approval`) is gone from Waits too: a Wait sends nothing.
--
-- This fixes the rows already saved, with the same rule the app's saves
-- now apply (lib/workflows/wait-step.ts, foldWaitConfig; the two must
-- agree):
--
-- - A duration Wait whose start was an offset (`after_previous`, or
--   `apply_relative`, counted from the start of the workflow) waits that
--   much longer instead, capped at the runner's one-year maximum. A month
--   counts as 30 days.
-- - A duration Wait anchored to the wedding (`wedding_relative`) becomes
--   "Relative date" Wait (relative_to_event) whose offset is the anchor plus
--   the duration, so it ends at the same point.
-- - A date Wait (`until_date`, `relative_to_event`) keeps its config: it
--   ends on its own date whenever it starts.
-- - Then the timing becomes "straight after the step above" and the
--   review flag is cleared.
--
-- Template steps: every Wait with an offset or the review flag.
--
-- Live steps (`workflow_steps`): only a Wait that has not started and has
-- not been dated: `pending`, `due_at` null, not held by the MC, and timed
-- after the step above. Its `due_at` is still to be computed from its
-- timing, so folding the offset in now keeps the total delay exactly. A
-- Wait that is already dated keeps its date, its offset and its flag:
-- folding its offset into the duration without moving `due_at` would
-- wait for the offset twice, and moving `due_at` would re-date a step
-- that is already scheduled. A sleeping (`waiting`) or finished Wait is
-- history. A held Wait is left alone because the MC, not the timing,
-- dates it. An undated wedding-anchored live Wait is left alone because
-- it is undated only when the couple has no wedding date, and turning it
-- into a relative-to-event Wait would let it finish at once. These keep
-- running exactly as before: the engine still honours the offset.
--
-- Idempotent and safe to replay from zero: the fold only touches rows
-- that still have an offset or the flag, and a folded row has neither.
-- Only `type = 'wait'` rows are touched. Not destructive: UPDATEs only.

-- Does this timing start the step anywhere but straight after the step
-- above? Mirrors isWaitTiming in lib/workflows/wait-step.ts (negated).
create or replace function public._workflow_wait_has_offset(p_timing jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_timing is not null
     and jsonb_typeof(p_timing) = 'object'
     and not (
       coalesce(p_timing->>'mode', 'after_previous') = 'after_previous'
       and (case when jsonb_typeof(p_timing->'delayAmount') = 'number'
                 then greatest(0, trunc((p_timing->>'delayAmount')::numeric)) else 0 end) = 0
     );
$$;

comment on function public._workflow_wait_has_offset(jsonb) is
  'True when a step timing is anything but "straight after the step above". Mirrors isWaitTiming in lib/workflows/wait-step.ts.';

revoke all on function public._workflow_wait_has_offset(jsonb) from public, anon, authenticated;

-- The fold, as one pure function so both tables use the same rule.
create or replace function public._workflow_fold_wait_config(p_config jsonb, p_timing jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_config jsonb := coalesce(p_config, '{}'::jsonb);
  v_timing jsonb := p_timing;
  v_mode text;
  v_duration bigint;
  v_offset bigint;
  v_signed bigint;
  v_abs bigint;
  v_unit text;
begin
  -- Anything but an object reads as "straight after the step above", the
  -- same as toStepTiming's fallback.
  if not public._workflow_wait_has_offset(v_timing) or jsonb_typeof(v_config) <> 'object' then
    return v_config;
  end if;
  v_mode := coalesce(v_timing->>'mode', 'after_previous');
  -- A date Wait ends on its own date; nothing to fold.
  if v_config->>'mode' is distinct from 'duration' then
    return v_config;
  end if;

  v_duration := case when jsonb_typeof(v_config->'durationMinutes') = 'number'
                     then greatest(0, trunc((v_config->>'durationMinutes')::numeric)) else 0 end;

  -- Minutes for the timing's amount in its unit (a month is 30 days).
  v_offset :=
    (case when jsonb_typeof(v_timing->(case when v_mode = 'after_previous' then 'delayAmount' else 'amount' end)) = 'number'
          then greatest(0, trunc((v_timing->>(case when v_mode = 'after_previous' then 'delayAmount' else 'amount' end))::numeric))
          else 0 end)
    * (case v_timing->>'unit'
         when 'minutes' then 1
         when 'hours' then 60
         when 'days' then 1440
         when 'weeks' then 10080
         when 'months' then 43200
         else 0
       end);

  if v_mode = 'wedding_relative' then
    v_signed := (case when v_timing->>'direction' = 'after' then 1 else -1 end) * v_offset + v_duration;
    v_abs := abs(v_signed);
    -- The largest relative unit that divides the offset exactly.
    v_unit := case
      when v_abs >= 10080 and v_abs % 10080 = 0 then 'weeks'
      when v_abs >= 1440 and v_abs % 1440 = 0 then 'days'
      when v_abs >= 60 and v_abs % 60 = 0 then 'hours'
      else 'minutes'
    end;
    return (v_config - 'durationMinutes')
      || jsonb_build_object(
           'mode', 'relative_to_event',
           'relative', jsonb_build_object(
             'amount', v_abs / (case v_unit when 'weeks' then 10080 when 'days' then 1440 when 'hours' then 60 else 1 end),
             'unit', v_unit,
             'direction', case when v_signed >= 0 then 'after' else 'before' end,
             'anchor', 'event_date'
           )
         );
  end if;

  if v_mode not in ('after_previous', 'apply_relative') then
    v_offset := 0;
  end if;
  return v_config || jsonb_build_object('durationMinutes', least(525600, greatest(1, v_duration + v_offset)));
end;
$$;

comment on function public._workflow_fold_wait_config(jsonb, jsonb) is
  'A Wait''s config with its start timing folded in, so the Wait can start straight after the step above with the same total delay. Mirrors foldWaitConfig in lib/workflows/wait-step.ts.';

revoke all on function public._workflow_fold_wait_config(jsonb, jsonb) from public, anon, authenticated;

-- Template steps.
update public.workflow_template_steps s
   set config = public._workflow_fold_wait_config(s.config, s.timing),
       timing = '{"mode": "after_previous", "delayAmount": 0, "unit": "days"}'::jsonb,
       requires_approval = false
 where s.type = 'wait'
   and (s.requires_approval or public._workflow_wait_has_offset(s.timing));

-- Live steps that have not started and have not been dated.
update public.workflow_steps s
   set config = public._workflow_fold_wait_config(s.config, s.timing),
       timing = '{"mode": "after_previous", "delayAmount": 0, "unit": "days"}'::jsonb,
       requires_approval = false
 where s.type = 'wait'
   and s.status = 'pending'
   and s.due_at is null
   and s.due_held_at is null
   and coalesce(s.timing->>'mode', 'after_previous') = 'after_previous'
   and (s.requires_approval or public._workflow_wait_has_offset(s.timing));

select public.ensure_require_mfa_policies();
select public.ensure_shadow_triggers();
