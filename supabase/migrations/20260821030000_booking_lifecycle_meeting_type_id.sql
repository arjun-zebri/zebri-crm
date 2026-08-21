-- Booking lifecycle: return the meeting type ID (and the video link) so the
-- post-RPC code can resolve the meeting type without guessing.
--
-- Why: `lib/booking/lifecycle.ts` needed the meeting type's location_type and
-- address for the cancel / reschedule emails, and the RPCs only handed it back
-- a NAME. It looked the row up with the service-role client as
-- `where name = <name>`, unscoped. `meeting_types.name` has no uniqueness
-- constraint of any kind, and "Consultation" is the default template name, so
-- that read either matched several tenants at once (`.single()` errors, the
-- email silently falls back to "in person" with no address) or matched exactly
-- one OTHER MC and put their venue address in a stranger's inbox.
--
-- Returning the id closes it: the caller filters on id AND user_id, which is
-- unique by construction and never crosses a tenant boundary.
--
-- `video_join_url` rides along in the reschedule payload for a smaller bug in
-- the same code path: the reschedule email hard-coded a null join link, so a
-- couple whose Meet link had not changed was told "link to follow".
--
-- Non-destructive migration: no @ALLOW_DESTRUCTIVE marker required.

-- ── cancel_booking ──────────────────────────────────────────────────────────
-- Unchanged except for the two extra keys on the returned object.
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
    'meeting_type_id', v_booking.meeting_type_id,
    'video_join_url', v_booking.video_join_url,
    'meeting_type_name', (select name from meeting_types where id = v_booking.meeting_type_id)
  );
end;
$$;

-- ── reschedule_booking ──────────────────────────────────────────────────────
-- Unchanged except for the two extra keys on the returned object.
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
    'meeting_type_id', v_booking.meeting_type_id,
    'video_join_url', v_booking.video_join_url,
    'meeting_type_name', v_meeting_type.name
  );
end;
$$;

-- ── bookings_due_for_reminder ───────────────────────────────────────────────
-- The reminder email's "Update your booking" link was built from booking_id,
-- but /book/manage/[manage_token] resolves through get_booking_by_manage_token.
-- Every reminder therefore shipped a link that 404s into the unavailable state.
-- manage_token is the capability, so the cron needs it back from here.
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
    'manage_token', b.manage_token,
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
