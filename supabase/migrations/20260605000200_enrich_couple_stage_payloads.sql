-- Phase 14a follow-up: enrich the couples-related emit_automation_event
-- payloads so trigger config can filter on "days until wedding".
--
-- The original `tg_couples_emit_stage_changed` emits couple_id,
-- couple_name, from_status, to_status. For MC automations the most
-- common filter is "did this happen close to the wedding date?" -
-- a cancellation 30 days out triggers a refund + emergency-cover
-- flow; a cancellation 6 months out is a "thanks, let us know if
-- plans change" flow.
--
-- Adding `event_date` to the payload lets the trigger's match()
-- function compute days-until-event without joining back to couples
-- (the runner already loads the couple snapshot, but match() runs
-- in the dispatcher before snapshots are resolved).
--
-- Not destructive - just replaces the trigger function body with a
-- richer payload. Existing automations that ignore the new field
-- keep working unchanged.

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
