-- ============================================================
-- Couple Portal: adds portal token, submission tables, and
-- pending-review flag for timeline items submitted by couples.
-- ============================================================

-- 1. Add portal fields to couples table
ALTER TABLE couples
  ADD COLUMN IF NOT EXISTS portal_token uuid DEFAULT gen_random_uuid() NOT NULL,
  ADD COLUMN IF NOT EXISTS portal_token_enabled boolean NOT NULL DEFAULT false;

-- Backfill any nulls (shouldn't happen but defensive)
UPDATE couples SET portal_token = gen_random_uuid() WHERE portal_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS couples_portal_token_idx ON couples(portal_token);

-- 2. Add pending_review flag to timeline_items
ALTER TABLE timeline_items
  ADD COLUMN IF NOT EXISTS pending_review boolean NOT NULL DEFAULT false;

-- 3. portal_people: names, pronunciations, bridal party, family
CREATE TABLE IF NOT EXISTS portal_people (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id   uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  category    text NOT NULL CHECK (category IN ('partner', 'bridal_party', 'family')),
  full_name   text NOT NULL,
  phonetic    text,
  role        text,
  audio_url   text,
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE portal_people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their portal people"
  ON portal_people FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. portal_songs: song requests by category
CREATE TABLE IF NOT EXISTS portal_songs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id   uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  category    text NOT NULL CHECK (category IN (
                'entry_partner1','entry_partner2','first_dance',
                'bridal_party_entry','ceremony','reception','avoid')),
  title       text NOT NULL,
  artist      text,
  notes       text,
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE portal_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their portal songs"
  ON portal_songs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. portal_files: document uploads
CREATE TABLE IF NOT EXISTS portal_files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id   uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  name        text NOT NULL,
  file_url    text NOT NULL,
  file_size   integer,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE portal_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their portal files"
  ON portal_files FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. Storage buckets
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit)
VALUES
  ('portal-files', 'portal-files', true, false, 20971520),   -- 20 MB
  ('portal-audio', 'portal-audio', true, false, 10485760)    -- 10 MB
ON CONFLICT (id) DO NOTHING;

-- portal-files: public read
CREATE POLICY "Public read portal files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'portal-files');

-- portal-audio: public read
CREATE POLICY "Public read portal audio"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'portal-audio');

-- ============================================================
-- SECURITY DEFINER RPC functions for anon portal access
-- ============================================================

-- 6a. Read portal data
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
    'event', CASE WHEN v_event_id IS NOT NULL THEN
      json_build_object('id', e.id, 'date', e.date::text, 'venue', e.venue)
    ELSE NULL END,
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
    'songs', COALESCE(
      (SELECT json_agg(
        json_build_object(
          'id', s.id, 'category', s.category, 'title', s.title,
          'artist', s.artist, 'notes', s.notes, 'position', s.position
        ) ORDER BY s.category, s.position, s.created_at
      ) FROM portal_songs s WHERE s.couple_id = v_couple_id),
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
    ) ELSE '[]'::json END
  )
  INTO result
  FROM couples c
  LEFT JOIN events e ON e.id = v_event_id
  WHERE c.id = v_couple_id;

  RETURN result;
END;
$$;

-- 6b. Read vendor timeline (read-only, no couple PII)
CREATE OR REPLACE FUNCTION get_vendor_timeline(token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_couple_id  uuid;
  v_event_id   uuid;
  result       json;
BEGIN
  SELECT id INTO v_couple_id
  FROM couples
  WHERE portal_token = token AND portal_token_enabled = true;

  IF v_couple_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_event_id
  FROM events
  WHERE couple_id = v_couple_id
  ORDER BY
    CASE WHEN date >= CURRENT_DATE THEN 0 ELSE 1 END,
    date ASC
  LIMIT 1;

  IF v_event_id IS NULL THEN
    RETURN json_build_object('event', NULL, 'timeline_items', '[]'::json);
  END IF;

  SELECT json_build_object(
    'event', json_build_object('date', e.date::text, 'venue', e.venue),
    'timeline_items', COALESCE(
      (SELECT json_agg(
        json_build_object(
          'id', ti.id,
          'start_time', to_char(ti.start_time, 'HH24:MI'),
          'title', ti.title,
          'description', ti.description,
          'duration_min', ti.duration_min,
          'position', ti.position,
          'pending_review', ti.pending_review
        ) ORDER BY ti.start_time NULLS LAST, ti.position
      ) FROM timeline_items ti WHERE ti.event_id = v_event_id),
      '[]'::json
    )
  )
  INTO result
  FROM events e WHERE e.id = v_event_id;

  RETURN result;
END;
$$;

-- 6c. Save (upsert) a portal person
CREATE OR REPLACE FUNCTION save_portal_person(
  p_token      uuid,
  p_id         uuid,          -- pass gen_random_uuid() for new records
  p_category   text,
  p_full_name  text,
  p_phonetic   text,
  p_role       text,
  p_audio_url  text,
  p_position   integer
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

  INSERT INTO portal_people (id, couple_id, user_id, category, full_name, phonetic, role, audio_url, position)
  VALUES (p_id, v_couple_id, v_user_id, p_category, p_full_name, p_phonetic, p_role, p_audio_url, p_position)
  ON CONFLICT (id) DO UPDATE SET
    full_name  = EXCLUDED.full_name,
    phonetic   = EXCLUDED.phonetic,
    role       = EXCLUDED.role,
    audio_url  = EXCLUDED.audio_url,
    position   = EXCLUDED.position
  RETURNING id INTO v_result_id;

  RETURN v_result_id;
END;
$$;

-- 6d. Delete a portal person
CREATE OR REPLACE FUNCTION delete_portal_person(p_token uuid, p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_couple_id uuid;
BEGIN
  SELECT id INTO v_couple_id FROM couples
  WHERE portal_token = p_token AND portal_token_enabled = true;

  IF v_couple_id IS NULL THEN RAISE EXCEPTION 'Invalid portal token'; END IF;

  DELETE FROM portal_people WHERE id = p_id AND couple_id = v_couple_id;
END;
$$;

-- 6e. Save (upsert) a portal song
CREATE OR REPLACE FUNCTION save_portal_song(
  p_token     uuid,
  p_id        uuid,
  p_category  text,
  p_title     text,
  p_artist    text,
  p_notes     text,
  p_position  integer
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

  IF v_couple_id IS NULL THEN RAISE EXCEPTION 'Invalid portal token'; END IF;

  INSERT INTO portal_songs (id, couple_id, user_id, category, title, artist, notes, position)
  VALUES (p_id, v_couple_id, v_user_id, p_category, p_title, p_artist, p_notes, p_position)
  ON CONFLICT (id) DO UPDATE SET
    title    = EXCLUDED.title,
    artist   = EXCLUDED.artist,
    notes    = EXCLUDED.notes,
    position = EXCLUDED.position
  RETURNING id INTO v_result_id;

  RETURN v_result_id;
END;
$$;

-- 6f. Delete a portal song
CREATE OR REPLACE FUNCTION delete_portal_song(p_token uuid, p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_couple_id uuid;
BEGIN
  SELECT id INTO v_couple_id FROM couples
  WHERE portal_token = p_token AND portal_token_enabled = true;

  IF v_couple_id IS NULL THEN RAISE EXCEPTION 'Invalid portal token'; END IF;

  DELETE FROM portal_songs WHERE id = p_id AND couple_id = v_couple_id;
END;
$$;

-- 6g. Save a portal timeline item (always pending_review = true)
CREATE OR REPLACE FUNCTION save_portal_timeline_item(
  p_token        uuid,
  p_id           uuid,
  p_start_time   text,       -- 'HH24:MI' or null
  p_title        text,
  p_description  text,
  p_duration_min integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_couple_id uuid;
  v_user_id   uuid;
  v_event_id  uuid;
  v_result_id uuid;
  v_max_pos   integer;
BEGIN
  SELECT id, user_id INTO v_couple_id, v_user_id
  FROM couples
  WHERE portal_token = p_token AND portal_token_enabled = true;

  IF v_couple_id IS NULL THEN RAISE EXCEPTION 'Invalid portal token'; END IF;

  SELECT id INTO v_event_id FROM events
  WHERE couple_id = v_couple_id
  ORDER BY CASE WHEN date >= CURRENT_DATE THEN 0 ELSE 1 END, date ASC
  LIMIT 1;

  IF v_event_id IS NULL THEN RAISE EXCEPTION 'No event found for this couple'; END IF;

  SELECT COALESCE(MAX(position), 0) INTO v_max_pos
  FROM timeline_items WHERE event_id = v_event_id;

  INSERT INTO timeline_items (
    id, event_id, user_id, start_time, title, description,
    duration_min, position, pending_review
  )
  VALUES (
    p_id, v_event_id, v_user_id,
    CASE WHEN p_start_time IS NOT NULL AND p_start_time <> '' THEN p_start_time::time ELSE NULL END,
    p_title, p_description, p_duration_min,
    v_max_pos + 1000,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    start_time   = CASE WHEN p_start_time IS NOT NULL AND p_start_time <> '' THEN p_start_time::time ELSE NULL END,
    title        = EXCLUDED.title,
    description  = EXCLUDED.description,
    duration_min = EXCLUDED.duration_min
  RETURNING id INTO v_result_id;

  RETURN v_result_id;
END;
$$;

-- 6h. Delete a portal timeline item (only pending ones)
CREATE OR REPLACE FUNCTION delete_portal_timeline_item(p_token uuid, p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_couple_id uuid;
  v_event_id  uuid;
BEGIN
  SELECT id INTO v_couple_id FROM couples
  WHERE portal_token = p_token AND portal_token_enabled = true;

  IF v_couple_id IS NULL THEN RAISE EXCEPTION 'Invalid portal token'; END IF;

  SELECT id INTO v_event_id FROM events WHERE couple_id = v_couple_id LIMIT 1;

  DELETE FROM timeline_items
  WHERE id = p_id AND event_id = v_event_id AND pending_review = true;
END;
$$;

-- 6i. Save a portal file record (called from API route after upload)
CREATE OR REPLACE FUNCTION save_portal_file(
  p_token     uuid,
  p_id        uuid,
  p_name      text,
  p_file_url  text,
  p_file_size integer
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

  IF v_couple_id IS NULL THEN RAISE EXCEPTION 'Invalid portal token'; END IF;

  INSERT INTO portal_files (id, couple_id, user_id, name, file_url, file_size)
  VALUES (p_id, v_couple_id, v_user_id, p_name, p_file_url, p_file_size)
  RETURNING id INTO v_result_id;

  RETURN v_result_id;
END;
$$;

-- 6j. Delete a portal file
CREATE OR REPLACE FUNCTION delete_portal_file(p_token uuid, p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_couple_id uuid;
BEGIN
  SELECT id INTO v_couple_id FROM couples
  WHERE portal_token = p_token AND portal_token_enabled = true;

  IF v_couple_id IS NULL THEN RAISE EXCEPTION 'Invalid portal token'; END IF;

  DELETE FROM portal_files WHERE id = p_id AND couple_id = v_couple_id;
END;
$$;
