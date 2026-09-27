-- A lease so two ticks cannot run at once.
--
-- pg_cron fires every minute; the route may run for forty-five seconds
-- and longer when the queue is deep. Overlapping runs race for every due
-- step. A session advisory lock is the usual answer and is wrong here:
-- pooled connections do not keep the session, so the lock is released
-- under the caller's feet. A row with an expiry is pooling-safe and
-- self-healing if a run dies holding it.
--
-- The lease is both released and expiring, and the two cover different
-- failures. The release is what keeps the schedule honest: the expiry
-- has to be longer than one tick can run (120 seconds, twice the
-- budget), which is also longer than the gap between two ticks, so a
-- lease left to expire would refuse the next minute's run every time and
-- turn a per-minute schedule into a two-minute one. The expiry is what
-- covers a run that dies without reaching its release, at the cost of
-- one or two missed ticks: 120 seconds against a 60 second cadence
-- always swallows the next tick and swallows the one after it too when
-- the run died early in its minute.
--
-- Releasing takes the token the run acquired with. Without it, a run
-- whose lease had already expired, and whose successor had already
-- acquired, would release that successor's hold on its way out, which is
-- the overlap the lease exists to prevent.

create table if not exists public.scheduler_leases (
  name text primary key,
  held_until timestamptz not null,
  -- Whoever holds it right now. Nullable because a lease that has
  -- expired without being released is still a row, just an unowned one.
  holder uuid
);

-- Kept separate from the create above so a database that applied an
-- earlier draft of this migration (the column was added after the first
-- local apply) ends up with the same shape as one replayed from zero.
alter table public.scheduler_leases add column if not exists holder uuid;

alter table public.scheduler_leases enable row level security;
-- No policies: service_role bypasses RLS and nothing else may read this.

-- The tokenless first draft of this function. Dropped rather than left
-- beside the three-argument version: Postgres would find the two
-- overloads ambiguous for an existing two-argument call, and a caller
-- that skipped the token would hold a lease nothing could release.
drop function if exists public.acquire_scheduler_lease(text, int);

create or replace function public.acquire_scheduler_lease(
  p_name text,
  p_ttl_seconds int,
  p_token uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  insert into public.scheduler_leases (name, held_until, holder)
  values (p_name, v_now + make_interval(secs => p_ttl_seconds), p_token)
  on conflict (name) do update
    set held_until = excluded.held_until,
        holder = excluded.holder
    where public.scheduler_leases.held_until < v_now;

  return found;
end;
$$;

comment on function public.acquire_scheduler_lease(text, int, uuid) is
  'Take the named scheduler lease for p_ttl_seconds, stamping p_token as '
  'the holder. Returns true only to the caller that took it. Pair every '
  'true with release_scheduler_lease(p_name, p_token) when the run ends.';

-- Hand the lease back the moment the run is done with it.
--
-- Deletes the row rather than back-dating `held_until`: the next
-- acquire then inserts a fresh row instead of having to compare against
-- a timestamp this statement just wrote, so there is no window in which
-- the release and the next acquire disagree about whose `now()` came
-- first.
--
-- Matching on the holder token is what makes it safe to call from a
-- `finally`: a run whose lease expired mid-flight no longer matches, so
-- it cannot release the hold its successor has already taken.
create or replace function public.release_scheduler_lease(
  p_name text,
  p_token uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.scheduler_leases
   where name = p_name
     and holder = p_token;

  return found;
end;
$$;

comment on function public.release_scheduler_lease(text, uuid) is
  'Release the named scheduler lease, but only if p_token still holds '
  'it. Returns false when the lease expired and somebody else took it.';

-- `revoke ... from public` alone is not enough here: Supabase's local and
-- hosted projects both run `alter default privileges` for the `public`
-- schema that grant EXECUTE on every new function straight to `anon` and
-- `authenticated`, on creation, independent of the PUBLIC pseudo-role.
-- The other critical finding in the audit was exactly this shape, a
-- scheduler-adjacent function left reachable by `authenticated`, so the
-- two roles are revoked from explicitly rather than trusted to inherit
-- the `public` revoke.
revoke all on function public.acquire_scheduler_lease(text, int, uuid) from public, anon, authenticated;
grant execute on function public.acquire_scheduler_lease(text, int, uuid) to service_role;
revoke all on function public.release_scheduler_lease(text, uuid) from public, anon, authenticated;
grant execute on function public.release_scheduler_lease(text, uuid) to service_role;
