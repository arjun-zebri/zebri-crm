-- Email templates: archive support.
--
-- Adds `archived_at` (nullable timestamptz) to `email_templates` — the
-- same soft-retirement pattern packages v2 introduced: an archived
-- template drops out of the Emails library list and the template
-- pickers, but keeps its row (and any automation references) intact.
-- NULL = active.

alter table email_templates add column if not exists archived_at timestamptz;

comment on column email_templates.archived_at is
  'Soft retirement: set when the MC archives the template; NULL = active.';
