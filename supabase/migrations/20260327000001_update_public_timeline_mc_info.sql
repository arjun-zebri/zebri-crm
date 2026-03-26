-- Update get_public_timeline to include MC contact info from auth.users metadata
CREATE OR REPLACE FUNCTION get_public_timeline(token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'date', e.date,
    'venue', e.venue,
    'couple', json_build_object('name', c.name),
    'mc', json_build_object(
      'business_name', u.raw_user_meta_data->>'business_name',
      'display_name',  u.raw_user_meta_data->>'display_name',
      'email',         u.email,
      'phone',         u.raw_user_meta_data->>'phone'
    ),
    'timeline_items', COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'id',           ti.id,
            'start_time',   to_char(ti.start_time, 'HH24:MI'),
            'title',        ti.title,
            'description',  ti.description,
            'duration_min', ti.duration_min,
            'position',     ti.position,
            'contact', CASE
              WHEN co.id IS NOT NULL THEN json_build_object('name', co.name, 'category', co.category)
              ELSE NULL
            END
          )
          ORDER BY ti.start_time NULLS LAST, ti.position
        )
        FROM timeline_items ti
        LEFT JOIN contacts co ON co.id = ti.contact_id
        WHERE ti.event_id = e.id
      ),
      '[]'::json
    )
  )
  INTO result
  FROM events e
  JOIN couples c ON c.id = e.couple_id
  JOIN auth.users u ON u.id = e.user_id
  WHERE e.share_token = token
    AND e.share_token_enabled = true;

  RETURN result;
END;
$$;
