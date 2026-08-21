-- Admin dashboard: "Last seen" - when each user was last actually on Zebri.
--
-- Why this exists: the admin Users table used auth.users.last_sign_in_at,
-- which GoTrue stamps ONLY on a real credential exchange. Zebri sets no
-- session timebox or inactivity_timeout, and login/page.tsx redirects anyone
-- with a live session away from the form, so a returning user never
-- re-authenticates and that column freezes at their last password entry.
-- Verified in production: a user with sessions refreshed the previous day
-- still reported a sign-in from four weeks earlier.
--
-- auth.sessions carries the real signal. Each row is one login; created_at is
-- when it began and refreshed_at moves every time that browser rotates its
-- token (hourly, driven by middleware). The newest of those across a user's
-- sessions is "last time they had Zebri open", accurate to within the 1-hour
-- jwt_expiry window.
--
-- auth.audit_log_entries would be richer but is pruned on hosted Supabase -
-- it returned zero rows for a user with active sessions, so it is not usable.
--
-- SECURITY DEFINER because the auth schema is not exposed to PostgREST
-- (config.toml: schemas = ["public", "graphql_public"]). Execute is revoked
-- from every role except service_role: this reads session activity for EVERY
-- tenant, so an authenticated MC must never be able to call it.
--
-- Non-destructive migration: no @ALLOW_DESTRUCTIVE marker required.

create or replace function public.admin_user_last_seen()
returns table (user_id uuid, last_seen timestamptz)
language sql
stable
security definer
-- Empty search_path (not "public, auth") so nothing resolves implicitly;
-- every object below is schema-qualified. Keeps a malicious search_path from
-- shadowing anything inside a definer-rights function.
set search_path = ''
as $$
  select
    s.user_id,
    -- greatest() ignores NULLs in Postgres, so a session that has not been
    -- refreshed yet correctly falls back to when it was created.
    -- refreshed_at is `timestamp WITHOUT time zone` holding UTC (every other
    -- column here is timestamptz); the explicit cast stops it being read as
    -- local time and shifting the result by the server's offset.
    max(greatest(s.created_at, (s.refreshed_at at time zone 'utc')))
  from auth.sessions s
  group by s.user_id
$$;

-- Lock it down: EXECUTE is granted to PUBLIC by default on new functions.
revoke all on function public.admin_user_last_seen() from public;
revoke all on function public.admin_user_last_seen() from anon;
revoke all on function public.admin_user_last_seen() from authenticated;
grant execute on function public.admin_user_last_seen() to service_role;

comment on function public.admin_user_last_seen() is
  'Per-user last activity (newest auth.sessions created_at/refreshed_at). Feeds the admin Users table "Last seen" column. service_role only - reads across every tenant.';
