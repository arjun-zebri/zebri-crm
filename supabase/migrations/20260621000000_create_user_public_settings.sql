-- ────────────────────────────────────────────────────────────────
-- Public Page settings (Settings → Public Page)
--
-- Backs the outward-facing config an MC's couples see and how their
-- email is sent:
--   * `subdomain`    — the branded Zebri address (persisted preference;
--                      actual subdomain routing is a separate infra task).
--   * email sending  — by default mail goes from the shared Zebri address.
--                      An MC can instead connect their own mailbox over
--                      OAuth (Gmail or Outlook), so couple-facing mail
--                      sends through their inbox via the Gmail / Microsoft
--                      Graph API (lands in their Sent folder, replies come
--                      back to them). Costs Zebri nothing per MC.
--
-- OAuth tokens are stored AES-256-GCM encrypted (see `lib/crypto/secret-box`)
-- — never plaintext, never returned to the client. One row per user, same
-- ownership + RLS shape as `user_branding`.
-- ────────────────────────────────────────────────────────────────

create table if not exists public.user_public_settings (
  user_id                        uuid primary key references auth.users(id) on delete cascade,
  -- Branded Zebri address (the part before `.zebri.com.au`). Nullable
  -- until the MC sets one.
  subdomain                      text,
  -- Which path couple-facing mail takes. 'zebri' uses the shared
  -- address; 'oauth' sends through the MC's connected mailbox (only once
  -- `oauth_status = 'connected'`).
  email_mode                     text not null default 'zebri',
  -- Connected mailbox (OAuth). All nullable until the MC connects one.
  oauth_provider                 text,           -- 'google' | 'microsoft'
  oauth_email                    text,           -- connected address; the `from`
  oauth_from_name                text,           -- display name (defaults to business name)
  -- AES-256-GCM ciphertext (`v1:<iv>.<tag>.<data>`). Refresh token is the
  -- long-lived secret; access token is a short-lived cache.
  oauth_refresh_token_encrypted  text,
  oauth_access_token_encrypted   text,
  oauth_token_expires_at         timestamptz,
  -- Connection state: none|connected|failed.
  oauth_status                   text not null default 'none',
  oauth_last_error               text,
  oauth_connected_at             timestamptz,
  created_at                     timestamptz not null default now(),
  updated_at                     timestamptz not null default now()
);

-- Subdomain must be globally unique (case-insensitive). RLS hides other
-- users' rows, so availability can't be checked with a SELECT — this index
-- is the real enforcement; the server action maps a 23505 to a friendly
-- "that address is taken" message.
create unique index if not exists user_public_settings_subdomain_key
  on public.user_public_settings (lower(subdomain))
  where subdomain is not null;

alter table public.user_public_settings enable row level security;

-- Users can only see / change their own row. The encrypted OAuth tokens
-- never leave the server (the app never selects them back to the client),
-- and RLS keeps the whole row invisible to other tenants regardless.
create policy user_public_settings_select on public.user_public_settings
  for select using (auth.uid() = user_id);

create policy user_public_settings_insert on public.user_public_settings
  for insert with check (auth.uid() = user_id);

create policy user_public_settings_update on public.user_public_settings
  for update using (auth.uid() = user_id);

create policy user_public_settings_delete on public.user_public_settings
  for delete using (auth.uid() = user_id);
