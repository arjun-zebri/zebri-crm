-- Let a contract have no title.
--
-- `contracts.title` was NOT NULL, so every layer invented one rather than let
-- a save fail: the builder modal substituted "Contract for <couple>" (both on
-- save and in its preview) and the server action substituted "Untitled
-- contract". The invented text was never shown in the title box, which
-- rendered it only as a grey placeholder, yet it was persisted and printed as
-- an <h1> on the public signing page and in the PDF, directly above the
-- agreement's own heading. A signed contract therefore carried two competing
-- titles, one of which the sender never wrote.
--
-- With the column nullable the app can require a real title before sending
-- instead of fabricating one.
--
-- Non-destructive: dropping NOT NULL widens what the column accepts and
-- rewrites no data, so no @ALLOW_DESTRUCTIVE marker is required.

alter table public.contracts alter column title drop not null;

comment on column public.contracts.title is
  'Document heading, written by the sender. Null until they title it; never auto-generated. Rendered as the document h1 on the public page and PDF, so display surfaces must handle null.';
