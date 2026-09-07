-- Morning digest settings.
--
-- One email a day, in the MC's own morning, listing what is overdue,
-- due, waiting for their OK, and about to send by itself. Everything the
-- workflow engine does is otherwise invisible until somebody logs in.
--
-- `daily_digest_last_sent_on` is a DATE in the MC's local zone rather
-- than a timestamp: the cron fires hourly so that every timezone gets its
-- own 7am, and a local-date guard is what stops a second send when the
-- hour is re-entered (which daylight saving does once a year).

alter table public.user_public_settings
  add column if not exists daily_digest_enabled boolean not null default true;

alter table public.user_public_settings
  add column if not exists daily_digest_last_sent_on date;

comment on column public.user_public_settings.daily_digest_enabled is
  'Send the morning workflow digest. On by default; a day with nothing to report sends nothing regardless.';

comment on column public.user_public_settings.daily_digest_last_sent_on is
  'Local date of the last digest sent, guarding against a repeat within one local day.';
