-- Fix: deleting a couple that owns events aborts with an FK violation.
--
-- `couples` cascades into `events`, and `events` carries the AFTER
-- DELETE trigger `events_emit_lifecycle`, which publishes an
-- `event_deleted` row onto the automation bus with
-- `automation_events.couple_id` pointing back at the parent couple.
--
-- Postgres runs a cascading delete as an AFTER trigger on the parent,
-- so by the time the child `events` row is removed the couple is
-- already gone. The emit then tries to insert a row referencing a
-- couple that no longer exists and the whole delete aborts:
--
--   insert or update on table "automation_events" violates foreign
--   key constraint "automation_events_couple_id_fkey"
--
-- The fix: in the DELETE branch, skip the emit when the parent couple
-- has already been removed. Nothing is lost by skipping. The bus row
-- would have been cascade-deleted with the couple a moment later
-- anyway. An `event_deleted` for a couple that no longer exists is
-- not something a workflow can usefully act on: dispatching one would
-- risk firing steps against a deleted record.
--
-- This also unblocks account deletion, which cascades through
-- auth.users → couples → events and hit the same wall on
-- `automation_events.user_id`.
--
-- The guard mirrors the precedent in
-- `_workflow_recompute_wedding_steps`, which already early-returns
-- when its couple lookup comes back empty for exactly this reason.
--
-- `events.couple_id` is NOT NULL, so the EXISTS check is the whole
-- story: true for a standalone event delete, false only mid-cascade.
--
-- Not destructive: replaces one trigger function body. INSERT and
-- UPDATE behaviour is unchanged.

create or replace function public.tg_events_emit_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.emit_automation_event(
      new.user_id,
      'events',
      new.id,
      'event_created',
      jsonb_build_object(
        'event_id', new.id,
        'couple_id', new.couple_id,
        'event_type', new.event_type,
        'title', new.title,
        'date', new.date,
        'venue', new.venue,
        'status', new.status
      ),
      new.couple_id
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- One 'event_updated' regardless of which column changed; the
    -- payload carries enough context for downstream automations to
    -- decide whether they care. We only suppress no-op rewrites
    -- where literally nothing changed.
    if new.date is distinct from old.date
       or new.venue is distinct from old.venue
       or new.title is distinct from old.title
       or new.event_type is distinct from old.event_type
       or new.status is distinct from old.status
       or new.timeline_notes is distinct from old.timeline_notes
    then
      perform public.emit_automation_event(
        new.user_id,
        'events',
        new.id,
        'event_updated',
        jsonb_build_object(
          'event_id', new.id,
          'couple_id', new.couple_id,
          'event_type', new.event_type,
          'title', new.title,
          'date', new.date,
          'venue', new.venue,
          'status', new.status,
          'prev_date', old.date,
          'prev_venue', old.venue,
          'prev_event_type', old.event_type
        ),
        new.couple_id
      );
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    -- Mid-cascade (the couple itself is being deleted) there is no
    -- parent left to hang the event off, and no consumer for it.
    if exists (select 1 from public.couples where id = old.couple_id) then
      perform public.emit_automation_event(
        old.user_id,
        'events',
        old.id,
        'event_deleted',
        jsonb_build_object(
          'event_id', old.id,
          'couple_id', old.couple_id,
          'event_type', old.event_type,
          'title', old.title,
          'date', old.date,
          'venue', old.venue
        ),
        old.couple_id
      );
    end if;
    return old;
  end if;

  return null;
end;
$$;

comment on function public.tg_events_emit_lifecycle() is
  'Publishes event_created / event_updated / event_deleted onto the '
  'automation bus. The DELETE branch stays silent when the parent '
  'couple is already gone (a cascading couple delete), because the '
  'automation_events.couple_id FK would reject the row and abort the '
  'delete.';
