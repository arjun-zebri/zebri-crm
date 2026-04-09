-- ============================================================
-- Portal V2: Contacts, Dynamic Categories, Payments Summary
-- ============================================================

-- 1a. Relax portal_songs.category constraint (allow custom categories)
ALTER TABLE portal_songs DROP CONSTRAINT portal_songs_category_check;
ALTER TABLE portal_songs ADD CONSTRAINT portal_songs_category_nonempty
  CHECK (length(trim(category)) > 0);

-- 1b. Create portal_song_categories table
CREATE TABLE IF NOT EXISTS portal_song_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id  uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  key        text NOT NULL,
  label      text NOT NULL,
  description text,
  position   integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (couple_id, key)
);

ALTER TABLE portal_song_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their portal song categories"
  ON portal_song_categories FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- SECURITY DEFINER RPCs
-- ============================================================

-- 1c. Save a portal contact (couple adds from portal)
CREATE OR REPLACE FUNCTION save_portal_contact(
  p_token        uuid,
  p_name         text,
  p_email        text,
  p_phone        text,
  p_category     text,
  p_notes        text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_couple_id uuid;
  v_user_id   uuid;
  v_contact_id uuid;
BEGIN
  SELECT id, user_id INTO v_couple_id, v_user_id
  FROM couples WHERE portal_token = p_token AND portal_token_enabled = true;
  IF v_couple_id IS NULL THEN RAISE EXCEPTION 'Invalid portal token'; END IF;

  -- Insert into contacts table (owned by MC)
  INSERT INTO contacts (user_id, name, email, phone, category, notes, status, contact_name)
  VALUES (v_user_id, p_name, p_email, p_phone, p_category, p_notes, 'active', '')
  RETURNING id INTO v_contact_id;

  -- Link to couple
  INSERT INTO couple_contacts (couple_id, contact_id, user_id)
  VALUES (v_couple_id, v_contact_id, v_user_id)
  ON CONFLICT DO NOTHING;

  RETURN v_contact_id;
END;
$$;

-- 1d. Extend get_portal_data with contacts, payments, song_categories
CREATE OR REPLACE FUNCTION get_portal_data(token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_couple_id   uuid;
  v_user_id     uuid;
  v_event_id    uuid;
  result        json;
BEGIN
  -- Validate token
  SELECT id, user_id INTO v_couple_id, v_user_id
  FROM couples
  WHERE portal_token = token AND portal_token_enabled = true;

  IF v_couple_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get primary event (first upcoming, else most recent)
  SELECT id INTO v_event_id
  FROM events
  WHERE couple_id = v_couple_id
  ORDER BY
    CASE WHEN date >= CURRENT_DATE THEN 0 ELSE 1 END,
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
      (SELECT json_agg(
        json_build_object('id', ev.id, 'date', ev.date::text, 'venue', ev.venue, 'status', ev.status)
        ORDER BY ev.date ASC
      ) FROM events ev WHERE ev.couple_id = v_couple_id),
      '[]'::json
    ),
    'people', COALESCE(
      (SELECT json_agg(
        json_build_object(
          'id', p.id, 'category', p.category, 'full_name', p.full_name,
          'phonetic', p.phonetic, 'role', p.role, 'audio_url', p.audio_url,
          'position', p.position
        ) ORDER BY p.category, p.position, p.created_at
      ) FROM portal_people p WHERE p.couple_id = v_couple_id),
      '[]'::json
    ),
    'contacts', COALESCE(
      (SELECT json_agg(
        json_build_object(
          'id', ct.id, 'name', ct.name, 'category', ct.category,
          'email', ct.email, 'phone', ct.phone
        ) ORDER BY ct.name
      )
      FROM couple_contacts cc
      JOIN contacts ct ON ct.id = cc.contact_id
      WHERE cc.couple_id = v_couple_id),
      '[]'::json
    ),
    'songs', COALESCE(
      (SELECT json_agg(
        json_build_object(
          'id', s.id, 'category', s.category, 'title', s.title,
          'artist', s.artist, 'notes', s.notes, 'position', s.position
        ) ORDER BY s.category, s.position, s.created_at
      ) FROM portal_songs s WHERE s.couple_id = v_couple_id),
      '[]'::json
    ),
    'song_categories', COALESCE(
      (SELECT json_agg(
        json_build_object('key', key, 'label', label, 'description', description, 'position', position)
        ORDER BY position
      ) FROM portal_song_categories WHERE couple_id = v_couple_id),
      '[]'::json
    ),
    'files', COALESCE(
      (SELECT json_agg(
        json_build_object(
          'id', f.id, 'name', f.name, 'file_url', f.file_url,
          'file_size', f.file_size, 'created_at', f.created_at
        ) ORDER BY f.created_at
      ) FROM portal_files f WHERE f.couple_id = v_couple_id),
      '[]'::json
    ),
    'timeline_items', CASE WHEN v_event_id IS NOT NULL THEN COALESCE(
      (SELECT json_agg(
        json_build_object(
          'id', ti.id, 'start_time', to_char(ti.start_time, 'HH24:MI'),
          'title', ti.title, 'description', ti.description,
          'duration_min', ti.duration_min, 'position', ti.position,
          'pending_review', ti.pending_review
        ) ORDER BY ti.start_time NULLS LAST, ti.position
      ) FROM timeline_items ti WHERE ti.event_id = v_event_id),
      '[]'::json
    ) ELSE '[]'::json END,
    'payments', json_build_object(
      'quotes', COALESCE(
        (SELECT json_agg(
          json_build_object(
            'id', q.id, 'title', q.title, 'quote_number', q.quote_number,
            'status', q.status, 'subtotal', q.subtotal,
            'share_token', q.share_token, 'share_token_enabled', q.share_token_enabled
          ) ORDER BY q.created_at DESC
        ) FROM quotes q WHERE q.couple_id = v_couple_id),
        '[]'::json
      ),
      'invoices', COALESCE(
        (SELECT json_agg(
          json_build_object(
            'id', inv.id, 'title', inv.title, 'invoice_number', inv.invoice_number,
            'status', inv.status, 'subtotal', inv.subtotal, 'due_date', inv.due_date::text,
            'share_token', inv.share_token, 'share_token_enabled', inv.share_token_enabled
          ) ORDER BY inv.created_at DESC
        ) FROM invoices inv WHERE inv.couple_id = v_couple_id),
        '[]'::json
      )
    )
  )
  INTO result
  FROM couples c
  LEFT JOIN events e ON e.id = v_event_id
  WHERE c.id = v_couple_id;

  RETURN result;
END;
$$;
