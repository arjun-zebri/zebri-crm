-- Idempotent catchup: ensures portal_people has notes/email/phone columns,
-- the 'other' category constraint, and all RPCs are up to date.

ALTER TABLE portal_people
  ADD COLUMN IF NOT EXISTS notes  text,
  ADD COLUMN IF NOT EXISTS email  text,
  ADD COLUMN IF NOT EXISTS phone  text;

ALTER TABLE portal_people DROP CONSTRAINT IF EXISTS portal_people_category_check;
ALTER TABLE portal_people ADD CONSTRAINT portal_people_category_check
  CHECK (category IN ('partner', 'bridal_party', 'family', 'other'));

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

CREATE OR REPLACE FUNCTION get_portal_data(token uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_couple_id uuid;
  v_user_id   uuid;
  v_event_id  uuid;
  result      json;
BEGIN
  SELECT id, user_id INTO v_couple_id, v_user_id
  FROM couples
  WHERE portal_token = token AND portal_token_enabled = true;

  IF v_couple_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_event_id
  FROM events
  WHERE couple_id = v_couple_id
  ORDER BY
    CASE WHEN date >= current_date THEN 0 ELSE 1 END,
    date ASC
  LIMIT 1;

  SELECT json_build_object(
    'couple_id',    v_couple_id,
    'couple_name',  c.name,
    'couple_email', c.email,
    'event', CASE WHEN v_event_id IS NOT NULL THEN
      json_build_object('id', e.id, 'date', e.date::text, 'venue', e.venue)
    ELSE NULL END,
    'events', COALESCE(
      (SELECT json_agg(json_build_object('id', ev.id, 'date', ev.date::text, 'venue', ev.venue, 'status', ev.status) ORDER BY ev.date ASC)
        FROM events ev WHERE ev.couple_id = v_couple_id),
      '[]'::json
    ),
    'people', COALESCE(
      (SELECT json_agg(json_build_object(
          'id', p.id, 'category', p.category, 'full_name', p.full_name,
          'phonetic', p.phonetic, 'role', p.role, 'audio_url', p.audio_url,
          'position', p.position, 'notes', p.notes, 'email', p.email, 'phone', p.phone)
        ORDER BY p.category, p.position, p.created_at)
        FROM portal_people p WHERE p.couple_id = v_couple_id),
      '[]'::json
    ),
    'contacts', COALESCE(
      (SELECT json_agg(json_build_object('id', ct.id, 'name', ct.name, 'category', ct.category,
          'email', ct.email, 'phone', ct.phone) ORDER BY ct.name)
        FROM couple_contacts cc
        JOIN contacts ct ON ct.id = cc.contact_id
        WHERE cc.couple_id = v_couple_id),
      '[]'::json
    ),
    'songs', COALESCE(
      (SELECT json_agg(json_build_object('id', s.id, 'category', s.category, 'title', s.title,
          'artist', s.artist, 'notes', s.notes, 'position', s.position)
        ORDER BY s.category, s.position, s.created_at)
        FROM portal_songs s WHERE s.couple_id = v_couple_id),
      '[]'::json
    ),
    'song_categories', COALESCE(
      (SELECT json_agg(json_build_object('key', key, 'label', label, 'description', description, 'position', position) ORDER BY position)
        FROM portal_song_categories WHERE couple_id = v_couple_id),
      '[]'::json
    ),
    'files', COALESCE(
      (SELECT json_agg(json_build_object('id', f.id, 'name', f.name, 'file_url', f.file_url,
          'file_size', f.file_size, 'created_at', f.created_at) ORDER BY f.created_at)
        FROM portal_files f WHERE f.couple_id = v_couple_id),
      '[]'::json
    ),
    'timeline_items', CASE WHEN v_event_id IS NOT NULL THEN COALESCE(
      (SELECT json_agg(json_build_object('id', ti.id, 'start_time', to_char(ti.start_time, 'HH24:MI'),
          'title', ti.title, 'description', ti.description,
          'duration_min', ti.duration_min, 'position', ti.position, 'pending_review', ti.pending_review)
        ORDER BY ti.start_time NULLS LAST, ti.position)
        FROM timeline_items ti WHERE ti.event_id = v_event_id),
      '[]'::json
    ) ELSE '[]'::json END,
    'payments', json_build_object(
      'quotes', COALESCE(
        (SELECT json_agg(json_build_object('id', q.id, 'title', q.title, 'quote_number', q.quote_number,
            'status', q.status, 'subtotal', q.subtotal,
            'share_token', q.share_token, 'share_token_enabled', q.share_token_enabled)
          ORDER BY q.created_at DESC)
          FROM quotes q WHERE q.couple_id = v_couple_id),
        '[]'::json
      ),
      'invoices', COALESCE(
        (SELECT json_agg(json_build_object('id', inv.id, 'title', inv.title, 'invoice_number', inv.invoice_number,
            'status', inv.status, 'subtotal', inv.subtotal, 'due_date', inv.due_date::text,
            'share_token', inv.share_token, 'share_token_enabled', inv.share_token_enabled)
          ORDER BY inv.created_at DESC)
          FROM invoices inv WHERE inv.couple_id = v_couple_id),
        '[]'::json
      )
    ),
    'contracts', COALESCE(
      (SELECT json_agg(json_build_object(
          'id', ctr.id,
          'title', ctr.title,
          'contract_number', ctr.contract_number,
          'status', ctr.status,
          'share_token', ctr.share_token,
          'share_token_enabled', ctr.share_token_enabled,
          'email_sent_at', ctr.email_sent_at,
          'signed_at', ctr.signed_at
        ) ORDER BY ctr.created_at DESC)
        FROM contracts ctr
        WHERE ctr.couple_id = v_couple_id
          AND ctr.status IN ('sent', 'signed', 'declined', 'expired')
          AND ctr.share_token_enabled = true),
      '[]'::json
    )
  )
  INTO result
  FROM couples c
  LEFT JOIN events e ON e.id = v_event_id
  WHERE c.id = v_couple_id;

  RETURN result;
END;
$$;
