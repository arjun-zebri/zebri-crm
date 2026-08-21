-- Scheduler Phase D: booking lifecycle RPCs (cancel, reschedule, reminder).
--
-- Adds the manage page and reminder cron surface. Five SECURITY DEFINER functions:
-- - get_booking_by_manage_token: anon lookup by capability token (no user_id leak)
-- - cancel_booking: anon flip to cancelled, emit booking_cancelled event
-- - reschedule_booking: anon move times in place, clear reminder_sent_at
-- - bookings_due_for_reminder: service_role only, returns remindable bookings
-- - mark_booking_reminder_sent: service_role only, mark reminded
--
-- Non-destructive migration: no @ALLOW_DESTRUCTIVE marker required.

alter table bookings add column if not exists reminder_sent_at timestamptz;

-- get_booking_by_manage_token - anon lookup by manage token for the booking
-- detail/manage page. Returns null for unknown/missing token (no existence leak).
-- Merges meeting type fields and branding. CRITICAL: never returns user_id or
-- the MC's email address (auth.users.email is server-secret).
create or replace function get_booking_by_manage_token(token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'booking_id', b.id,
    'status', b.status,
    'starts_at', b.starts_at,
    'ends_at', b.ends_at,
    'timezone', b.timezone,
    'name', b.name,
    'email', b.email,
    'video_join_url', b.video_join_url,
    'business_name', coalesce(
      u.raw_user_meta_data->>'business_name',
      u.raw_user_meta_data->>'display_name',
      ''
    ),
    'meeting_type', jsonb_build_object(
      'id', mt.id,
      'name', mt.name,
      'description', mt.description,
      'duration_minutes', mt.duration_minutes,
      'location_type', mt.location_type,
      'address', mt.address
    ),
    'share_token', b.manage_token
  ) || coalesce(_user_branding(b.user_id), '{}'::jsonb)
  into result
  from bookings b
  join meeting_types mt on mt.id = b.meeting_type_id
  join auth.users u on u.id = b.user_id
  where b.manage_token = token;

  return result;
end;
$$;

-- cancel_booking - anon flip to cancelled, emit booking_cancelled event.
-- Guards: row exists, not already cancelled, not past (ends_at <= now()).
-- Returns {ok, booking_id, user_id, starts_at, ends_at, timezone, name,
-- email, business_name, external_event_ids, meeting_type_name} or
-- {error: 'not_found'|'already_cancelled'|'past'}.
create or replace function cancel_booking(p_manage_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_booking record;
  v_business_name text;
begin
  -- Resolve booking by manage_token
  select * into v_booking
  from bookings
  where manage_token = p_manage_token;

  if not found then
    return '{"error":"not_found"}'::jsonb;
  end if;

  -- Guard: already cancelled
  if v_booking.status = 'cancelled' then
    return '{"error":"already_cancelled"}'::jsonb;
  end if;

  -- Guard: ends_at is in the past (cannot cancel a past meeting)
  if v_booking.ends_at <= now() then
    return '{"error":"past"}'::jsonb;
  end if;

  -- Update status and cancelled_at
  update bookings
    set status = 'cancelled',
        cancelled_at = now(),
        updated_at = now()
    where id = v_booking.id;

  -- Fetch business_name for response
  select coalesce(raw_user_meta_data->>'business_name', '')
    into v_business_name
    from auth.users
    where id = v_booking.user_id;

  -- Emit booking_cancelled event for automations
  perform public.emit_automation_event(
    v_booking.user_id,
    'bookings',
    v_booking.id,
    'booking_cancelled',
    jsonb_build_object(
      'booking_id', v_booking.id,
      'couple_id', v_booking.couple_id,
      'meeting_type_id', v_booking.meeting_type_id,
      'booker_name', v_booking.name,
      'booker_email', v_booking.email,
      'starts_at', v_booking.starts_at,
      'ends_at', v_booking.ends_at,
      'timezone', v_booking.timezone
    ),
    v_booking.couple_id
  );

  return jsonb_build_object(
    'ok', true,
    'booking_id', v_booking.id,
    'user_id', v_booking.user_id,
    'starts_at', v_booking.starts_at,
    'ends_at', v_booking.ends_at,
    'timezone', v_booking.timezone,
    'name', v_booking.name,
    'email', v_booking.email,
    'business_name', v_business_name,
    'external_event_ids', v_booking.external_event_ids,
    'meeting_type_name', (select name from meeting_types where id = v_booking.meeting_type_id)
  );
end;
$$;

-- reschedule_booking - anon move times in place, clear reminder_sent_at
-- for the new time to get its own reminder. Guards: row exists, not
-- cancelled, not past, valid range, duration within 60 seconds of meeting
-- type's duration_minutes. Wraps update in begin/exception to catch
-- exclusion_violation (double-booking) returning {error:'slot_taken'}.
-- The partial exclusion constraint only checks against OTHER confirmed rows,
-- so updating a row onto its own current range succeeds (no self-conflict).
-- Returns {ok, booking_id, user_id, previous_starts_at, starts_at, ends_at,
-- timezone, name, email, business_name, external_event_ids, meeting_type_name}
-- or {error: 'not_found'|'cancelled'|'past'|'slot_taken'|'invalid'}.
create or replace function reschedule_booking(
  p_manage_token uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_booking record;
  v_meeting_type record;
  v_duration_sec integer;
  v_expected_sec integer;
  v_diff_sec integer;
  v_business_name text;
begin
  -- Resolve booking by manage_token
  select * into v_booking
  from bookings
  where manage_token = p_manage_token;

  if not found then
    return '{"error":"not_found"}'::jsonb;
  end if;

  -- Guard: already cancelled
  if v_booking.status = 'cancelled' then
    return '{"error":"cancelled"}'::jsonb;
  end if;

  -- Guard: ends_at is in the past (cannot reschedule a past meeting)
  if v_booking.ends_at <= now() then
    return '{"error":"past"}'::jsonb;
  end if;

  -- Guard: invalid range (p_starts_at >= p_ends_at or in past)
  if p_starts_at >= p_ends_at then
    return '{"error":"invalid"}'::jsonb;
  end if;

  if p_starts_at <= now() then
    return '{"error":"invalid"}'::jsonb;
  end if;

  -- Validate duration matches meeting type within 60 seconds
  select * into v_meeting_type
  from meeting_types
  where id = v_booking.meeting_type_id;

  v_duration_sec := extract(epoch from (p_ends_at - p_starts_at))::integer;
  v_expected_sec := v_meeting_type.duration_minutes * 60;
  v_diff_sec := abs(v_duration_sec - v_expected_sec);

  if v_diff_sec > 60 then
    return '{"error":"invalid"}'::jsonb;
  end if;

  -- Update the booking times. Wrap in begin/exception to catch exclusion
  -- constraint violation (another confirmed booking occupies this range).
  -- The partial exclusion constraint only checks against OTHER confirmed rows
  -- (where status = 'confirmed'), so a row can update onto its own current
  -- range without self-conflict.
  -- Clear reminder_sent_at so the new time gets its own reminder sent.
  begin
    update bookings
      set starts_at = p_starts_at,
          ends_at = p_ends_at,
          reminder_sent_at = null,
          updated_at = now()
      where id = v_booking.id;
  exception
    when others then
      if sqlerrm like '%exclusion%' then
        return '{"error":"slot_taken"}'::jsonb;
      end if;
      raise;
  end;

  -- Fetch business_name for response
  select coalesce(raw_user_meta_data->>'business_name', '')
    into v_business_name
    from auth.users
    where id = v_booking.user_id;

  return jsonb_build_object(
    'ok', true,
    'booking_id', v_booking.id,
    'user_id', v_booking.user_id,
    'previous_starts_at', v_booking.starts_at,
    'starts_at', p_starts_at,
    'ends_at', p_ends_at,
    'timezone', v_booking.timezone,
    'name', v_booking.name,
    'email', v_booking.email,
    'business_name', v_business_name,
    'external_event_ids', v_booking.external_event_ids,
    'meeting_type_name', (select name from meeting_types where id = v_booking.meeting_type_id)
  );
end;
$$;

-- bookings_due_for_reminder - service_role only. Returns confirmed bookings
-- whose meeting type has reminder_enabled=true, starts_at between now() and
-- now() + 36 hours, and reminder_sent_at is null. Each row contains booking
-- and meeting type details needed for the reminder email/SMS.
create or replace function bookings_due_for_reminder()
returns setof jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  return query
  select jsonb_build_object(
    'booking_id', b.id,
    'user_id', b.user_id,
    'name', b.name,
    'email', b.email,
    'starts_at', b.starts_at,
    'ends_at', b.ends_at,
    'timezone', b.timezone,
    'video_join_url', b.video_join_url,
    'business_name', coalesce(
      u.raw_user_meta_data->>'business_name',
      u.raw_user_meta_data->>'display_name',
      ''
    ),
    'meeting_type_name', mt.name,
    'location_type', mt.location_type,
    'address', mt.address
  )
  from bookings b
  join meeting_types mt on mt.id = b.meeting_type_id
  join auth.users u on u.id = b.user_id
  where b.status = 'confirmed'
    and mt.reminder_enabled = true
    and b.starts_at > now()
    and b.starts_at <= now() + interval '36 hours'
    and b.reminder_sent_at is null;
end;
$$;

-- mark_booking_reminder_sent - service_role only. Sets reminder_sent_at = now()
-- to mark a booking as having been reminded. Cron calls this after sending.
create or replace function mark_booking_reminder_sent(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update bookings
    set reminder_sent_at = now(),
        updated_at = now()
    where id = p_booking_id;
end;
$$;

-- Grant lifecycle RPCs
grant execute on function get_booking_by_manage_token(uuid) to anon;
grant execute on function cancel_booking(uuid) to anon;
grant execute on function reschedule_booking(uuid, timestamptz, timestamptz) to anon;
grant execute on function bookings_due_for_reminder() to service_role;
grant execute on function mark_booking_reminder_sent(uuid) to service_role;
