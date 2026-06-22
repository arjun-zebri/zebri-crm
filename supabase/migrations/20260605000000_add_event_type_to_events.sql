-- Add a short event-type slug to events (e.g. 'ceremony', 'rehearsal',
-- 'reception', 'send_off'). Couples regularly have multiple events per
-- wedding and the automation triggers want to narrow on "rehearsal only"
-- without having to grep the free-form `title` column.
--
-- Free-form text (no CHECK) so MCs can extend the vocabulary later
-- ('engagement', 'sundowner', etc.). The four common values above are
-- the defaults the UI will surface as Select options; anything else
-- still flows through unchanged.
--
-- Default is 'ceremony' so every existing row carries a sensible
-- type. The `events_user_id_event_type_idx` index keeps the
-- "events of type X for user Y" query (used by the time_before_event
-- tick emitter) cheap.

alter table public.events add column if not exists event_type text not null default 'ceremony';

create index if not exists events_user_id_event_type_idx
  on public.events(user_id, event_type);
