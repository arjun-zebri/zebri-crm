-- Scheduler Phase C: public booking RPCs (get_public_booking_page, submit_booking).
--
-- Two SECURITY DEFINER functions granted to anon, mirroring the lead-capture
-- form ingest pattern. The submit_booking RPC creates bookings with the
-- consultation_booked trigger firing on insert (Task 1), couples matching by
-- email case-insensitively, and a plan-limit exception handler that leaves
-- couple_linked false rather than failing the booking.
--
-- Non-destructive migration: no @ALLOW_DESTRUCTIVE marker required.

-- get_public_booking_page - anon read for rendering the public booking form.
-- Returns null for a missing/disabled token (no existence leak); merges the MC
-- branding scalars and meeting type fields (name, description, duration_minutes,
-- location_type, address).
create or replace function get_public_booking_page(token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'name', mt.name,
    'description', mt.description,
    'duration_minutes', mt.duration_minutes,
    'location_type', mt.location_type,
    'address', mt.address,
    'business_name', coalesce(
      u.raw_user_meta_data->>'business_name',
      u.raw_user_meta_data->>'display_name',
      ''
    )
  ) || coalesce(_user_branding(mt.user_id), '{}'::jsonb)
  into result
  from meeting_types mt
  join auth.users u on u.id = mt.user_id
  where mt.share_token = token
    and mt.active = true;

  return result;
end;
$$;

-- submit_booking - anon ingest. Validates the token, the booking range, and
-- duration. Rate-limits at the RPC boundary (anon-callable, so route-level IP
-- limits can be bypassed; the DB is the authority). Searches for an existing
-- couple by primary_email or legacy email (case-insensitive, ordered by
-- created_at). If no match, inserts a couple with lead_source='booking',
-- wrapping in begin/exception to surface plan-limit blocks as couple_linked=
-- false rather than failing the booking. Inserts the booking (status confirmed)
-- and catches exclusion_violation (double-booking guard from Task 1) returning
-- {error:'slot_taken'}. Success returns booking_id, manage_token, and couple
-- fields; the consultation_booked trigger fires on insert (Task 1). MC email
-- is NOT returned to anon (attacker could harvest emails via share tokens);
-- the route fetches it server-side.
create or replace function submit_booking(
  token uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_timezone text,
  p_name text,
  p_email text,
  p_partner_name text default null,
  p_phone text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  mt record;
  v_couple_id uuid;
  v_couple_created boolean;
  v_couple_linked boolean;
  v_booking_id uuid;
  v_manage_token uuid;
  v_duration_sec integer;
  v_expected_sec integer;
  v_diff_sec integer;
  v_status text;
  v_business_name text;
  v_recent integer;
begin
  -- Resolve meeting type by share_token, active only
  select * into mt
  from meeting_types
  where share_token = token and active = true;

  if not found then
    return '{"error":"not_found"}'::jsonb;
  end if;

  -- Rate-limit at the RPC boundary: count bookings for this meeting type
  -- created in the last hour. Anon RPC is the authority; route-level IP limits
  -- can be bypassed. Allow up to 6 per hour as a booking spam guard.
  select count(*) into v_recent
  from bookings
  where meeting_type_id = mt.id
    and created_at > now() - interval '1 hour'
    and status = 'confirmed';

  if v_recent >= 6 then
    return '{"error":"rate_limited"}'::jsonb;
  end if;

  -- Validate range: p_starts_at < p_ends_at
  if p_starts_at >= p_ends_at then
    return '{"error":"invalid"}'::jsonb;
  end if;

  -- Validate starts_at is not in the past
  if p_starts_at <= now() then
    return '{"error":"invalid"}'::jsonb;
  end if;

  -- Validate duration matches meeting type within 60 seconds
  v_duration_sec := extract(epoch from (p_ends_at - p_starts_at))::integer;
  v_expected_sec := mt.duration_minutes * 60;
  v_diff_sec := abs(v_duration_sec - v_expected_sec);

  if v_diff_sec > 60 then
    return '{"error":"invalid"}'::jsonb;
  end if;

  -- Couple match: case-insensitive search by primary_email or legacy email,
  -- ordered by created_at, limit 1.
  select id into v_couple_id
  from couples
  where user_id = mt.user_id
    and (
      lower(primary_email) = lower(p_email)
      or lower(email) = lower(p_email)
    )
  order by created_at asc
  limit 1;

  -- If no couple match, insert a new couple (lead_source='booking').
  if v_couple_id is null then
    v_couple_created := false;
    v_couple_linked := false;

    -- Resolve landing status: use first by position, else 'new'
    select cs.slug into v_status
    from couple_statuses cs
    where cs.user_id = mt.user_id
    order by cs.position asc, cs.created_at asc
    limit 1;
    v_status := coalesce(v_status, 'new');

    begin
      insert into couples (
        user_id, name, primary_name, secondary_name,
        email, primary_email, phone, primary_phone,
        notes, lead_source, status
      ) values (
        mt.user_id,
        p_name, p_name,
        nullif(btrim(coalesce(p_partner_name, '')), ''),
        p_email, p_email,
        nullif(btrim(coalesce(p_phone, '')), ''),
        nullif(btrim(coalesce(p_phone, '')), ''),
        nullif(btrim(coalesce(p_notes, '')), ''),
        'booking',
        v_status
      )
      returning id into v_couple_id;

      v_couple_created := true;
      v_couple_linked := true;
    exception
      when others then
        -- Plan limit or any other exception: couple creation fails silently,
        -- leave couple_id null and couple_linked false so booking still inserts.
        if sqlerrm = 'STARTER_COUPLE_LIMIT' then
          v_couple_id := null;
          v_couple_created := false;
          v_couple_linked := false;
        else
          raise;
        end if;
    end;
  else
    v_couple_created := false;
    v_couple_linked := true;
  end if;

  -- Insert the booking (status confirmed). Wrap in begin/exception to catch
  -- exclusion_violation (double-booking guard from Task 1) and return
  -- {error:'slot_taken'}.
  begin
    insert into bookings (
      user_id, meeting_type_id, couple_id,
      name, partner_name, email, phone, notes,
      starts_at, ends_at, timezone, status, manage_token
    ) values (
      mt.user_id, mt.id, v_couple_id,
      p_name, nullif(btrim(coalesce(p_partner_name, '')), ''),
      p_email, nullif(btrim(coalesce(p_phone, '')), ''),
      nullif(btrim(coalesce(p_notes, '')), ''),
      p_starts_at, p_ends_at, p_timezone, 'confirmed', gen_random_uuid()
    )
    returning id, manage_token into v_booking_id, v_manage_token;
  exception
    when others then
      -- Catch exclusion_violation from bookings_no_confirmed_overlap constraint
      if sqlerrm like '%exclusion%' then
        return '{"error":"slot_taken"}'::jsonb;
      end if;
      raise;
  end;

  -- Fetch business_name for the response (shown on public page; not leaked by MC email)
  select coalesce(raw_user_meta_data->>'business_name', '')
  into v_business_name
  from auth.users
  where id = mt.user_id;

  return jsonb_build_object(
    'ok', true,
    'booking_id', v_booking_id,
    'manage_token', v_manage_token,
    'user_id', mt.user_id,
    'couple_id', v_couple_id,
    'couple_created', v_couple_created,
    'couple_linked', v_couple_linked,
    'business_name', v_business_name
  );
end;
$$;

grant execute on function get_public_booking_page(uuid) to anon;
grant execute on function submit_booking(uuid, timestamptz, timestamptz, text, text, text, text, text, text) to anon;
