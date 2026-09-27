-- Case-insensitive suppression lookup for the send path (Phase 2, Task 12).
--
-- `email_suppression.email` is stored exactly as typed, deliberately, so the
-- MC sees the address the way the provider or the unsubscribe click reported
-- it (see the column comment in 20261004000000_email_optout_and_suppression.sql).
-- Case normalisation therefore lives in the unique index,
-- `email_suppression_user_email_reason_idx on (user_id, lower(email), reason)`,
-- which constrains what can be INSERTed but does nothing to how a SELECT
-- compares.
--
-- The send path had been asking PostgREST for `.eq('email', $1)`, a
-- case-sensitive comparison, so a row stored as 'Sarah@Example.com' did not
-- match a send addressed to 'sarah@example.com' and that person kept
-- receiving email after unsubscribing. Lower-casing the search term in
-- TypeScript does not fix it either: either side can carry the mixed case.
-- Both sides have to be folded, and PostgREST cannot express
-- `lower(email) = lower($1)` as a filter. Hence a function.
--
-- The body's predicate is written to match the functional index exactly
-- (`lower(email)` against a constant), so this stays an index lookup rather
-- than a sequential scan as a tenant's suppression list grows.
--
-- Security invoker (the default), NOT definer. The send path calls this with
-- the service-role client, which bypasses RLS regardless, so a definer
-- function would buy nothing and would hand any future caller a read across
-- every tenant's suppression list. Leaving it invoker means RLS still scopes
-- an authenticated caller to their own rows.
--
-- Non-destructive: creates one function. No @ALLOW_DESTRUCTIVE marker needed.

create or replace function public.is_email_suppressed(
  p_user_id uuid,
  p_email text
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.email_suppression
    where user_id = p_user_id
      and lower(email) = lower(p_email)
  );
$$;

comment on function public.is_email_suppressed(uuid, text) is
  'True when this owner has any suppression row (unsubscribed, bounced or complained) for this address, compared case-insensitively against the lower(email) unique index. Read by the automated send path before dispatch.';

-- Supabase's default grants hand execute on a new public function to
-- `anon` and `authenticated` DIRECTLY, not by inheritance from `public`, so
-- `revoke ... from public` on its own leaves both roles able to call it.
-- That exact trap bit this branch once already (the emit_automation_event
-- grant). `anon` is revoked here because an unauthenticated caller has no
-- business probing whether a given address is on a given MC's suppression
-- list; `authenticated` keeps execute because the function is security
-- invoker, so RLS on email_suppression still scopes it to the caller's own
-- rows and it answers false for anyone else's.
revoke execute on function public.is_email_suppressed(uuid, text) from public;
revoke execute on function public.is_email_suppressed(uuid, text) from anon;
