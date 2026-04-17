ALTER TABLE couples ADD COLUMN kanban_position double precision DEFAULT 0;

WITH ordered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY user_id, status ORDER BY created_at DESC) AS rn
  FROM couples
)
UPDATE couples
SET kanban_position = ordered.rn
FROM ordered
WHERE couples.id = ordered.id;
