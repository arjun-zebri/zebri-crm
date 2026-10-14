-- Booking form questions: the public booking form becomes industry-neutral.
--
-- Until now the form had one wedding-specific field, partner_name, hard-wired
-- into submit_booking. Each meeting type now owns a list of questions
-- (meeting_types.questions, mirroring lib/booking/questions.ts) and a phone
-- mode (meeting_types.phone_field). Answers are stored on bookings.answers with
-- the question's label and type copied in, so a booking still reads correctly
-- after the question is renamed or deleted.
--
-- submit_booking is anon-callable, so it re-applies the same rules as
-- validateAnswers in SQL: required questions, multi_choice filtered to its
-- options, single_choice / date / number / length checks, labels and types
-- taken from the question (never from the input), and unknown question ids
-- ignored. Questions with maps_to copy their answer into the new couple record
-- (secondary_name, event_date, venue) and bookings.partner_name; every other
-- answer is folded into the new couple's notes as "Label: value" lines, as
-- submit_lead does.
--
-- Backfill: every form that existed before this migration collected a partner
-- name, so each existing meeting type gets the partner_name question to keep
-- that behaviour for current users. Existing bookings with a partner_name get
-- a matching answer row. bookings.partner_name is kept (never renamed or
-- dropped) and still written from the partner_name-mapped answer.
--
-- Non-destructive migration: no @ALLOW_DESTRUCTIVE marker required. The old
-- submit_booking signature is replaced with DROP FUNCTION, which removes no data.

-- 1. Per-meeting-type questions and phone mode.
alter table meeting_types
  add column if not exists questions jsonb not null default '[]'::jsonb,
  add column if not exists phone_field text not null default 'optional';

-- CASE rather than AND so jsonb_array_length never sees a non-array value.
alter table meeting_types
  drop constraint if exists meeting_types_questions_check;
alter table meeting_types
  add constraint meeting_types_questions_check check (
    jsonb_typeof(questions) = 'array'
    and (case when jsonb_typeof(questions) = 'array'
              then jsonb_array_length(questions) <= 20
              else false end)
  );

alter table meeting_types
  drop constraint if exists meeting_types_phone_field_check;
alter table meeting_types
  add constraint meeting_types_phone_field_check
  check (phone_field in ('hidden', 'optional', 'required'));

-- 2. Answers on each booking.
alter table bookings
  add column if not exists answers jsonb not null default '[]'::jsonb;

alter table bookings
  drop constraint if exists bookings_answers_check;
alter table bookings
  add constraint bookings_answers_check check (jsonb_typeof(answers) = 'array');

-- 3. Backfill. The '[]' guard makes a re-run a no-op: it only touches rows
--    that have not been given questions or answers yet.
update meeting_types
   set questions = '[{"id":"partner_name","label":"Partner''s name","type":"short_text","required":false,"maps_to":"partner_name"}]'::jsonb
 where questions = '[]'::jsonb;

update bookings
   set answers = jsonb_build_array(jsonb_build_object(
         'question_id', 'partner_name',
         'label', 'Partner''s name',
         'type', 'short_text',
         'value', partner_name
       ))
 where partner_name is not null
   and answers = '[]'::jsonb;

-- 4. The legacy column stays for compatibility; new bookings still write it from
--    the partner_name-mapped answer.
comment on column bookings.partner_name is
  'Legacy: the partner name the booker entered. Still written by submit_booking from the question mapped to partner_name; new reads should use bookings.answers.';

-- 5. get_public_booking_page: also returns the questions and phone mode.
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
    'questions', mt.questions,
    'phone_field', mt.phone_field,
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

-- 6. submit_booking: new signature. The old one took p_partner_name; the
--    answers array replaces it. Dropped first because a new argument list is a
--    different function, and the old grant goes with it.
drop function if exists submit_booking(uuid, timestamptz, timestamptz, text, text, text, text, text, text);

-- Anon ingest. Keeps every check from the previous version (token, rate limit,
-- range, past, duration, couple match, STARTER_COUPLE_LIMIT, slot_taken), and
-- adds phone-mode and answer validation. Every invalid input returns
-- {"error":"invalid"} rather than raising, so the response shape never leaks
-- which question failed.
create or replace function submit_booking(
  token uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_timezone text,
  p_name text,
  p_email text,
  p_phone text default null,
  p_notes text default null,
  p_answers jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  mt record;
  q jsonb;
  a jsonb;
  v_input jsonb;
  v_input_val jsonb;
  v_qid text;
  v_qtype text;
  v_qlabel text;
  v_required boolean;
  v_options jsonb;
  v_maps text;
  v_text text;
  v_value jsonb;
  v_display text;
  v_date_check date;
  v_mapped boolean;
  v_answers jsonb := '[]'::jsonb;
  v_unmapped text := '';
  v_partner text := null;
  v_event_date date := null;
  v_venue text := null;
  v_phone text;
  v_couple_notes text;
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

  -- Phone mode. 'hidden' drops whatever the booker sent, so a stale client
  -- cannot store a phone number the MC switched off.
  v_phone := nullif(btrim(coalesce(p_phone, '')), '');
  if mt.phone_field = 'hidden' then
    v_phone := null;
  elsif mt.phone_field = 'required' and v_phone is null then
    return '{"error":"invalid"}'::jsonb;
  end if;

  -- Answers. A non-array payload counts as no answers. More than 50 entries is
  -- rejected outright: the question list is capped at 20, so anything bigger
  -- is not a real form submission.
  v_input := case when jsonb_typeof(p_answers) = 'array' then p_answers else '[]'::jsonb end;
  if jsonb_array_length(v_input) > 50 then
    return '{"error":"invalid"}'::jsonb;
  end if;

  -- Walk the meeting type's questions in order, so stored answers keep the
  -- order the MC set. Malformed question elements are skipped, as
  -- parseBookingQuestions does in the app.
  for q in select value from jsonb_array_elements(mt.questions) loop
    if jsonb_typeof(q) <> 'object'
       or jsonb_typeof(q->'id') <> 'string'
       or jsonb_typeof(q->'label') <> 'string'
       or jsonb_typeof(q->'type') <> 'string' then
      continue;
    end if;

    v_qid := q->>'id';
    v_qlabel := q->>'label';
    v_qtype := q->>'type';
    if btrim(v_qid) = '' or btrim(v_qlabel) = '' then
      continue;
    end if;
    if v_qtype not in ('short_text', 'long_text', 'date', 'number', 'single_choice', 'multi_choice') then
      continue;
    end if;

    v_required := coalesce((q->'required') = 'true'::jsonb, false);
    v_options := case when jsonb_typeof(q->'options') = 'array' then q->'options' else '[]'::jsonb end;
    v_maps := case when jsonb_typeof(q->'maps_to') = 'string' then q->>'maps_to' else null end;

    -- First answer whose question_id matches this question. Later duplicates
    -- are ignored, the same as the app's keyed lookup.
    v_input_val := null;
    for a in select value from jsonb_array_elements(v_input) loop
      if jsonb_typeof(a) = 'object'
         and jsonb_typeof(a->'question_id') = 'string'
         and a->>'question_id' = v_qid then
        v_input_val := a->'value';
        exit;
      end if;
    end loop;

    v_value := null;
    if v_qtype = 'multi_choice' then
      -- Keep only the chosen strings that are real options, in option order.
      -- A non-array value counts as no choice, as in validateAnswers.
      if jsonb_typeof(v_input_val) = 'array' then
        select coalesce(jsonb_agg(o.opt order by o.ord), '[]'::jsonb) into v_value
        from jsonb_array_elements(v_options) with ordinality as o(opt, ord)
        where jsonb_typeof(o.opt) = 'string'
          and v_input_val @> jsonb_build_array(o.opt);
        if jsonb_array_length(v_value) = 0 then
          v_value := null;
        end if;
      end if;
    else
      -- Text-like types. A non-string value counts as no answer. Trim the
      -- whole whitespace set (not just spaces) to match JS trim().
      v_text := case when jsonb_typeof(v_input_val) = 'string'
                     then regexp_replace(v_input_val #>> '{}', '^\s+|\s+$', '', 'g')
                     else '' end;

      if v_text <> '' then
        if char_length(v_text) > 2000 then
          return '{"error":"invalid"}'::jsonb;
        end if;

        if v_qtype = 'date' then
          if v_text !~ '^\d{4}-\d{2}-\d{2}$' then
            return '{"error":"invalid"}'::jsonb;
          end if;
          -- Postgres rejects impossible dates (e.g. Feb 30) on cast, which
          -- makes the cast the calendar check.
          begin
            v_date_check := v_text::date;
          exception when others then
            return '{"error":"invalid"}'::jsonb;
          end;
        elsif v_qtype = 'number' and v_text !~ '^-?\d+(\.\d+)?$' then
          return '{"error":"invalid"}'::jsonb;
        elsif v_qtype = 'single_choice' and not (v_options @> jsonb_build_array(v_text)) then
          return '{"error":"invalid"}'::jsonb;
        end if;

        v_value := to_jsonb(v_text);
      end if;
    end if;

    if v_value is null then
      if v_required then
        return '{"error":"invalid"}'::jsonb;
      end if;
      continue;
    end if;

    -- A mapping applies only when the question type fits the target field, the
    -- same rule the editor enforces. A mismatched mapping falls through to notes.
    v_mapped := false;
    if v_maps is not null
       and v_qtype = (case v_maps
                        when 'partner_name' then 'short_text'
                        when 'event_date' then 'date'
                        when 'venue' then 'short_text'
                      end)
       and jsonb_typeof(v_value) = 'string' then
      v_mapped := true;
      v_text := v_value #>> '{}';
      if v_maps = 'partner_name' then
        v_partner := v_text;
      elsif v_maps = 'event_date' then
        v_event_date := v_text::date;
      else
        v_venue := v_text;
      end if;
    end if;

    if not v_mapped then
      v_display := case when jsonb_typeof(v_value) = 'array'
                        then (select string_agg(x, ', ') from jsonb_array_elements_text(v_value) as x)
                        else v_value #>> '{}' end;
      v_unmapped := concat_ws(E'\n', nullif(v_unmapped, ''), v_qlabel || ': ' || v_display);
    end if;

    -- Label and type come from the question, never from the input.
    v_answers := v_answers || jsonb_build_array(jsonb_build_object(
      'question_id', v_qid,
      'label', v_qlabel,
      'type', v_qtype,
      'value', v_value
    ));
  end loop;

  -- Couple notes: the booker's message, then one "Label: value" line per
  -- unmapped answer.
  v_couple_notes := nullif(btrim(concat_ws(E'\n',
    nullif(btrim(coalesce(p_notes, '')), ''),
    nullif(v_unmapped, ''))), '');

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
        event_date, venue, notes, lead_source, status
      ) values (
        mt.user_id,
        p_name, p_name,
        nullif(btrim(coalesce(v_partner, '')), ''),
        p_email, p_email,
        v_phone,
        v_phone,
        v_event_date,
        nullif(btrim(coalesce(v_venue, '')), ''),
        v_couple_notes,
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
      starts_at, ends_at, timezone, status, manage_token, answers
    ) values (
      mt.user_id, mt.id, v_couple_id,
      p_name, nullif(btrim(coalesce(v_partner, '')), ''),
      p_email, v_phone,
      nullif(btrim(coalesce(p_notes, '')), ''),
      p_starts_at, p_ends_at, p_timezone, 'confirmed', gen_random_uuid(),
      v_answers
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

grant execute on function submit_booking(uuid, timestamptz, timestamptz, text, text, text, text, text, jsonb) to anon;
