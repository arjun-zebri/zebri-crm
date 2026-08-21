-- Scheduler Phase A: external calendar connections (Google / Outlook).
--
-- One row per provider per MC. Holds the OAuth tokens (encrypted with
-- the server-only EMAIL_CRED_KEY via lib/crypto/secret-box, same as the
-- mailbox tokens in user_public_settings) used to read free/busy and
-- push booked meetings. Kept separate from user_public_settings so an
-- MC can have BOTH a Google and an Outlook calendar connected at once,
-- independent of which provider handles their email.
--
-- Non-destructive migration: no @ALLOW_DESTRUCTIVE marker required.

create table calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  account_email text not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  token_expires_at timestamptz not null,
  status text not null default 'connected' check (status in ('connected', 'error')),
  last_error text,
  -- Which calendar to check/push. Null means the provider's primary calendar.
  calendar_id text,
  connected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index calendar_connections_user_id_idx on calendar_connections(user_id);

alter table calendar_connections enable row level security;

-- Owner-only on every verb. Token columns are ciphertext, so owner
-- SELECT is acceptable (user_public_settings precedent); the key never
-- leaves the server.
create policy "calendar_connections_user_isolation" on calendar_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
