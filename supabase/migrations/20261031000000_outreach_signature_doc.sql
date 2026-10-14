-- Rich outreach signature: bold, links and images, edited with the same
-- editor as Settings > Signature.
--
-- signature_doc holds the editor's document (TipTap JSON) and drives the
-- HTML part of each email. The existing `signature` text column stays as
-- the plain-text copy, derived from the document on save: it is the
-- text/plain part, and the Spam Act contact-details check reads it.
-- Null means "not converted yet": the app builds a document from the
-- plain text the first time the settings form loads.
alter table public.outreach_settings
  add column if not exists signature_doc jsonb;

comment on column public.outreach_settings.signature_doc is
  'Rich signature (TipTap JSON). signature holds its plain-text copy.';
