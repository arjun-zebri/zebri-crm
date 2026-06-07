-- Wedding couples are two people. Until now the `couples` row carried
-- a single (name / email / phone) triple, which forced MCs to merge
-- both partners into the same field. This migration introduces
-- separate primary + secondary contact triples so the Overview and
-- Contacts surfaces can show each partner individually.
--
-- Backfill: the existing `email` / `phone` columns most likely refer
-- to the primary partner (one person typed them in during enquiry),
-- so we copy them into `primary_*` for rows that haven't been edited
-- through the new flow yet. Names are NOT auto-split from
-- `couples.name` (e.g. "John & Jane Smith") - the heuristic is too
-- brittle; MCs can fill them in the next time they open the modal.
--
-- The original `name`, `email`, `phone` columns are kept (legacy
-- API contracts read them; we don't rename existing columns).

alter table couples
  add column if not exists primary_name text,
  add column if not exists primary_email text,
  add column if not exists primary_phone text,
  add column if not exists secondary_name text,
  add column if not exists secondary_email text,
  add column if not exists secondary_phone text;

update couples
set
  primary_email = nullif(email, ''),
  primary_phone = nullif(phone, '')
where primary_email is null and primary_phone is null;
