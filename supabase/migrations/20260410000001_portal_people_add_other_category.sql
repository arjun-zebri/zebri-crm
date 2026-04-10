-- Add 'other' as a valid category for portal_people

ALTER TABLE portal_people
  DROP CONSTRAINT IF EXISTS portal_people_category_check;

ALTER TABLE portal_people
  ADD CONSTRAINT portal_people_category_check
  CHECK (category IN ('partner', 'bridal_party', 'family', 'other'));
