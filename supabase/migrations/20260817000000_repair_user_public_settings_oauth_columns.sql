-- ────────────────────────────────────────────────────────────────
-- Repair: bring user_public_settings up to its declared shape.
--
-- `20260621000000_create_user_public_settings.sql` opens with
-- `create table if not exists` — but the production database already
-- had a user_public_settings table (created in the pre-CI SQL-editor
-- era for the subdomain feature), so on prod that migration was a
-- silent no-op and the email/OAuth columns it declares never landed.
-- The ledger says "applied"; the columns don't exist. First observed
-- 2026-08-17 as PGRST204 ("Could not find the
-- 'oauth_access_token_encrypted' column") when the OAuth callback
-- tried to persist a connected Gmail mailbox.
--
-- Every statement here is idempotent (`if not exists` / guarded), so
-- this replays cleanly both on prod (adds what's missing) and on a
-- from-zero database where 20260621000000 already created everything.
-- ────────────────────────────────────────────────────────────────

-- Column meanings are documented in 20260621000000; `not null default`
-- columns backfill existing rows with the default, matching what the
-- create-table would have produced.
alter table public.user_public_settings
  add column if not exists subdomain                      text,
  add column if not exists email_mode                     text not null default 'zebri',
  add column if not exists oauth_provider                 text,
  add column if not exists oauth_email                    text,
  add column if not exists oauth_from_name                text,
  add column if not exists oauth_refresh_token_encrypted  text,
  add column if not exists oauth_access_token_encrypted   text,
  add column if not exists oauth_token_expires_at         timestamptz,
  add column if not exists oauth_status                   text not null default 'none',
  add column if not exists oauth_last_error               text,
  add column if not exists oauth_connected_at             timestamptz,
  add column if not exists created_at                     timestamptz not null default now(),
  add column if not exists updated_at                     timestamptz not null default now();

create unique index if not exists user_public_settings_subdomain_key
  on public.user_public_settings (lower(subdomain))
  where subdomain is not null;

alter table public.user_public_settings enable row level security;

-- `create policy` has no IF NOT EXISTS; guard each one so this replays
-- on databases where 20260621000000 (or the SQL-editor original)
-- already created policies under these names.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_public_settings'
      and policyname = 'user_public_settings_select'
  ) then
    create policy user_public_settings_select on public.user_public_settings
      for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_public_settings'
      and policyname = 'user_public_settings_insert'
  ) then
    create policy user_public_settings_insert on public.user_public_settings
      for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_public_settings'
      and policyname = 'user_public_settings_update'
  ) then
    create policy user_public_settings_update on public.user_public_settings
      for update using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_public_settings'
      and policyname = 'user_public_settings_delete'
  ) then
    create policy user_public_settings_delete on public.user_public_settings
      for delete using (auth.uid() = user_id);
  end if;
end $$;
