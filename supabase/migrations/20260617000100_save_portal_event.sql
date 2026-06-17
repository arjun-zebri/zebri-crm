-- ============================================================
-- Portal Overview: couples can add + edit their own events
-- ============================================================
--
-- The Overview timeline is now editable: a couple can add a new event
-- (date + venue) or change the date/venue of an existing one, straight
-- from the portal. Status is left untouched on edit and defaults to
-- 'upcoming' on insert. No delete path — couples can't remove events the
-- MC created.

create or replace function public.save_portal_event(
  p_token uuid,
  p_id    uuid,
  p_date  text,
  p_venue text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_user_id   uuid;
  v_result_id uuid;
begin
  select couple_id, owner_id into v_couple_id, v_user_id
  from _resolve_portal_couple(p_token);

  if v_couple_id is null then
    raise exception 'Invalid portal token';
  end if;

  if p_date is null or p_date = '' then
    raise exception 'Event date is required';
  end if;

  -- Upsert on id. The ON CONFLICT WHERE clause is the cross-couple guard:
  -- if a caller passes an event id owned by a different couple, the update
  -- is skipped (no row returned), so a token can only touch its own events.
  -- Status is preserved on edit; new rows default to 'upcoming'.
  insert into events (id, user_id, couple_id, date, venue, status)
  values (
    coalesce(p_id, gen_random_uuid()),
    v_user_id, v_couple_id, p_date::date,
    nullif(left(trim(p_venue), 300), ''), 'upcoming'
  )
  on conflict (id) do update set
    date  = excluded.date,
    venue = excluded.venue
  where events.couple_id = v_couple_id
  returning id into v_result_id;

  return v_result_id;
end;
$$;

grant execute on function public.save_portal_event(uuid, uuid, text, text)
  to anon;

comment on function public.save_portal_event(uuid, uuid, text, text) is
  'Add or edit a couple''s event (date + venue) from the public portal. '
  'Token-guarded via _resolve_portal_couple; can only touch its own couple''s events.';
