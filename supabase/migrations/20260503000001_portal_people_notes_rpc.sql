CREATE OR REPLACE FUNCTION save_portal_person(
  p_token      uuid,
  p_id         uuid,
  p_category   text,
  p_full_name  text,
  p_phonetic   text,
  p_role       text,
  p_audio_url  text,
  p_position   integer,
  p_notes      text DEFAULT NULL
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

  INSERT INTO portal_people (id, couple_id, user_id, category, full_name, phonetic, role, audio_url, position, notes)
  VALUES (p_id, v_couple_id, v_user_id, p_category, p_full_name, p_phonetic, p_role, p_audio_url, p_position, p_notes)
  ON CONFLICT (id) DO UPDATE SET
    full_name  = EXCLUDED.full_name,
    phonetic   = EXCLUDED.phonetic,
    role       = EXCLUDED.role,
    audio_url  = EXCLUDED.audio_url,
    position   = EXCLUDED.position,
    notes      = EXCLUDED.notes
  RETURNING id INTO v_result_id;

  RETURN v_result_id;
END;
$$;
