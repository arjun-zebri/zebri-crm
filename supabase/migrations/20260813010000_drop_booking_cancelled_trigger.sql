-- Trigger sweep: `booking_cancelled` is retired.
--
-- The trigger could never fire. Its emit block tested
-- `new.status in ('cancelled', 'lost')`, but `couples.status` holds a
-- slug from the MC's own `couple_statuses` rows, and the defaults the
-- app seeds are `new`, `contacted`, `confirmed`, `paid`, `complete`.
-- Neither hardcoded slug is in that set, so the condition never
-- passed for anyone on the default pipeline. The trigger has been
-- visible in the picker, and offering filters, the whole time.
--
-- Rather than guess which of an MC's stages means "cancelled", the
-- concept is folded into `couple_stage_changed`: that trigger now
-- filters on "moved into <stage>" using the MC's real stage names,
-- which is both accurate and something they can see is correct.
--
-- Removing the emit block stops new `booking_cancelled` rows landing
-- in `automation_events`. Historical rows are left alone: they are
-- inert, since the dispatcher skips any event whose trigger type has
-- no registry entry (`getTriggerSpec` returns null).
--
-- Not destructive: the function body is replaced, one `if` block is
-- dropped. The `couple_stage_changed` emit is unchanged, so every
-- pipeline automation keeps working.

create or replace function public.tg_couples_emit_stage_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform public.emit_automation_event(
      new.user_id,
      'couples',
      new.id,
      'couple_stage_changed',
      jsonb_build_object(
        'couple_id', new.id,
        'couple_name', new.name,
        'from_status', old.status,
        'to_status', new.status,
        'lead_source', new.lead_source,
        'event_date', new.event_date
      ),
      new.id
    );
  end if;
  return new;
end;
$$;
