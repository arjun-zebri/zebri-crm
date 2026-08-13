-- Trigger sweep: `couple_stage_changed` gains a lead-source filter.
--
-- The stage-change payload already carried enough to answer "which
-- stage, and how close is the wedding?", but not "where did this
-- couple come from?". That is the question behind most of the
-- pipeline automations an MC actually wants: a website enquiry
-- reaching Booked gets a different follow-up from a referral doing
-- the same thing.
--
-- `new_enquiry` has emitted `lead_source` since the original trigger
-- migration; this brings the stage-change payload in line so the two
-- couple triggers offer the same filter over the same field.
--
-- Not destructive: the function body is replaced, one key is added to
-- the emitted jsonb. Automations that ignore the new field keep
-- working unchanged, and `booking_cancelled` is emitted exactly as
-- before.

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

    if new.status in ('cancelled', 'lost') then
      perform public.emit_automation_event(
        new.user_id,
        'couples',
        new.id,
        'booking_cancelled',
        jsonb_build_object(
          'couple_id', new.id,
          'couple_name', new.name,
          'from_status', old.status,
          'event_date', new.event_date
        ),
        new.id
      );
    end if;
  end if;
  return new;
end;
$$;
