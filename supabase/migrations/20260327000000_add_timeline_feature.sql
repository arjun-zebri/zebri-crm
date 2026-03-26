-- Add share fields to events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS share_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS share_token_enabled boolean NOT NULL DEFAULT false;

-- Backfill share_token for any existing rows that might have null
UPDATE events SET share_token = gen_random_uuid() WHERE share_token IS NULL;

-- Create timeline_items table
CREATE TABLE IF NOT EXISTS timeline_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  start_time time,
  title text NOT NULL,
  description text,
  duration_min integer,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  position integer NOT NULL DEFAULT 1000,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE timeline_items ENABLE ROW LEVEL SECURITY;

-- Authenticated users can manage their own timeline items
CREATE POLICY "Users can manage their own timeline items"
  ON timeline_items
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Public function for share link (SECURITY DEFINER bypasses RLS)
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
    'timeline_items', COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'id', ti.id,
            'start_time', to_char(ti.start_time, 'HH24:MI'),
            'title', ti.title,
            'description', ti.description,
            'duration_min', ti.duration_min,
            'position', ti.position,
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
  WHERE e.share_token = token
    AND e.share_token_enabled = true;

  RETURN result;
END;
$$;
