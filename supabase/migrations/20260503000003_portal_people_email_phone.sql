ALTER TABLE portal_people
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text;

-- Update save_portal_person to include email and phone
CREATE OR REPLACE FUNCTION save_portal_person(
  p_token      uuid,
  p_id         uuid,
  p_category   text,
  p_full_name  text,
  p_phonetic   text,
  p_role       text,
  p_audio_url  text,
  p_position   integer,
  p_notes      text DEFAULT NULL,
  p_email      text DEFAULT NULL,
  p_phone      text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_couple_id uuid;
  v_user_id   uuid;
  v_result_id uuid;
BEGIN
  SELECT id, user_id INTO v_couple_id, v_user_id
  FROM couples
  WHERE portal_token = p_token AND portal_token_enabled = true;

  IF v_couple_id IS NULL THEN
    RAISE EXCEPTION 'Invalid portal token';
  END IF;

  INSERT INTO portal_people (id, couple_id, user_id, category, full_name, phonetic, role, audio_url, position, notes, email, phone)
  VALUES (p_id, v_couple_id, v_user_id, p_category, p_full_name, p_phonetic, p_role, p_audio_url, p_position, p_notes, p_email, p_phone)
  ON CONFLICT (id) DO UPDATE SET
    full_name  = EXCLUDED.full_name,
    phonetic   = EXCLUDED.phonetic,
    role       = EXCLUDED.role,
    audio_url  = EXCLUDED.audio_url,
    position   = EXCLUDED.position,
    notes      = EXCLUDED.notes,
    email      = EXCLUDED.email,
    phone      = EXCLUDED.phone
  RETURNING id INTO v_result_id;

  RETURN v_result_id;
END;
$$;

-- Update get_portal_data to return email and phone for people
create or replace function get_portal_data(token uuid)
returns json language plpgsql security definer as $$
declare
  v_couple_id uuid;
  v_user_id   uuid;
  v_event_id  uuid;
  result      json;
begin
  select id, user_id into v_couple_id, v_user_id
  from couples
  where portal_token = token and portal_token_enabled = true;

  if v_couple_id is null then
    return null;
  end if;

  select id into v_event_id
  from events
  where couple_id = v_couple_id
  order by
    case when date >= current_date then 0 else 1 end,
    date asc
  limit 1;

  select json_build_object(
    'couple_id',    v_couple_id,
    'couple_name',  c.name,
    'couple_email', c.email,
    'event', case when v_event_id is not null then
      json_build_object('id', e.id, 'date', e.date::text, 'venue', e.venue)
    else null end,
    'events', coalesce(
      (select json_agg(json_build_object('id', ev.id, 'date', ev.date::text, 'venue', ev.venue, 'status', ev.status) order by ev.date asc)
        from events ev where ev.couple_id = v_couple_id),
      '[]'::json
    ),
    'people', coalesce(
      (select json_agg(json_build_object('id', p.id, 'category', p.category, 'full_name', p.full_name,
          'phonetic', p.phonetic, 'role', p.role, 'audio_url', p.audio_url, 'position', p.position,
          'notes', p.notes, 'email', p.email, 'phone', p.phone)
        order by p.category, p.position, p.created_at)
        from portal_people p where p.couple_id = v_couple_id),
      '[]'::json
    ),
    'contacts', coalesce(
      (select json_agg(json_build_object('id', ct.id, 'name', ct.name, 'category', ct.category,
          'email', ct.email, 'phone', ct.phone) order by ct.name)
        from couple_contacts cc
        join contacts ct on ct.id = cc.contact_id
        where cc.couple_id = v_couple_id),
      '[]'::json
    ),
    'songs', coalesce(
      (select json_agg(json_build_object('id', s.id, 'category', s.category, 'title', s.title,
          'artist', s.artist, 'notes', s.notes, 'position', s.position)
        order by s.category, s.position, s.created_at)
        from portal_songs s where s.couple_id = v_couple_id),
      '[]'::json
    ),
    'song_categories', coalesce(
      (select json_agg(json_build_object('key', key, 'label', label, 'description', description, 'position', position) order by position)
        from portal_song_categories where couple_id = v_couple_id),
      '[]'::json
    ),
    'files', coalesce(
      (select json_agg(json_build_object('id', f.id, 'name', f.name, 'file_url', f.file_url,
          'file_size', f.file_size, 'created_at', f.created_at) order by f.created_at)
        from portal_files f where f.couple_id = v_couple_id),
      '[]'::json
    ),
    'timeline_items', case when v_event_id is not null then coalesce(
      (select json_agg(json_build_object('id', ti.id, 'start_time', to_char(ti.start_time, 'HH24:MI'),
          'title', ti.title, 'description', ti.description,
          'duration_min', ti.duration_min, 'position', ti.position, 'pending_review', ti.pending_review)
        order by ti.start_time nulls last, ti.position)
        from timeline_items ti where ti.event_id = v_event_id),
      '[]'::json
    ) else '[]'::json end,
    'payments', json_build_object(
      'quotes', coalesce(
        (select json_agg(json_build_object('id', q.id, 'title', q.title, 'quote_number', q.quote_number,
            'status', q.status, 'subtotal', q.subtotal,
            'share_token', q.share_token, 'share_token_enabled', q.share_token_enabled)
          order by q.created_at desc)
          from quotes q where q.couple_id = v_couple_id),
        '[]'::json
      ),
      'invoices', coalesce(
        (select json_agg(json_build_object('id', inv.id, 'title', inv.title, 'invoice_number', inv.invoice_number,
            'status', inv.status, 'subtotal', inv.subtotal, 'due_date', inv.due_date::text,
            'share_token', inv.share_token, 'share_token_enabled', inv.share_token_enabled)
          order by inv.created_at desc)
          from invoices inv where inv.couple_id = v_couple_id),
        '[]'::json
      )
    ),
    'contracts', coalesce(
      (select json_agg(json_build_object(
          'id', ctr.id,
          'title', ctr.title,
          'contract_number', ctr.contract_number,
          'status', ctr.status,
          'share_token', ctr.share_token,
          'share_token_enabled', ctr.share_token_enabled,
          'email_sent_at', ctr.email_sent_at,
          'signed_at', ctr.signed_at
        ) order by ctr.created_at desc)
        from contracts ctr
        where ctr.couple_id = v_couple_id
          and ctr.status in ('sent', 'signed', 'declined', 'expired')
          and ctr.share_token_enabled = true),
      '[]'::json
    )
  )
  into result
  from couples c
  left join events e on e.id = v_event_id
  where c.id = v_couple_id;

  return result;
end;
$$;
