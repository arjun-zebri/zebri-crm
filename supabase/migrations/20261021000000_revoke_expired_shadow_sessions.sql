-- Server-side revocation of finished shadow sessions (Phase 4 fix-2,
-- review N2).
--
-- Exit revokes the target session, and middleware revokes it once the
-- grant has gone, but only on the shadow browser's next request. A
-- browser that is closed or left idle keeps the target auth session
-- live for up to 72 hours after its last refresh (168 hours for an open
-- tab that keeps refreshing), and in that window the MC's own account
-- edits are attributed to the admin by the after-exit fallback. This
-- sweep closes it from the server side, called by the workflow tick
-- every minute.
--
-- 1. admin_shadow_sessions.revoked_at: when the sweep dealt with the row,
--    so each row is swept once and the per-minute call stays cheap.
-- 2. revoke_expired_shadow_sessions(): for every unswept row that has
--    ended or expired, deletes its auth.sessions row (refresh tokens and
--    mfa_amr_claims cascade from it, ON DELETE CASCADE), stamps
--    ended_at = expires_at where it was null (the visit ended when the
--    grant did), and stamps revoked_at. Returns how many auth sessions it
--    deleted. Idempotent. Service role only.
-- 3. my_support_access(): "ended by exit" now means an ended_at before
--    the expiry (the sweep's stamp equals expires_at), and change_count
--    leaves out after_end rows, so the card counts only what happened
--    during the visit. After-visit activity through a kept token stays
--    in admin_audit_log and alerts Slack; it is not shown on the card.

-- ---------------------------------------------------------------------
-- 1. Sweep marker
-- ---------------------------------------------------------------------

alter table public.admin_shadow_sessions
  add column if not exists revoked_at timestamptz;

comment on column public.admin_shadow_sessions.revoked_at is
  'When revoke_expired_shadow_sessions() deleted (or found already gone) '
  'the target auth session after the visit ended or expired. Null until swept.';

-- The sweep reads only rows it has not handled yet.
create index if not exists admin_shadow_sessions_unswept_idx
  on public.admin_shadow_sessions (expires_at)
  include (session_id, ended_at)
  where revoked_at is null;

-- ---------------------------------------------------------------------
-- 2. The sweep
-- ---------------------------------------------------------------------

create or replace function public.revoke_expired_shadow_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  with finished as (
    select s.id, s.session_id
      from public.admin_shadow_sessions s
     where s.revoked_at is null
       and (s.ended_at is not null or s.expires_at <= now())
       for update of s skip locked
  ),
  gone as (
    -- Refresh tokens and AMR claims go with the session (FK cascade).
    delete from auth.sessions a
     using finished f
     where a.id = f.session_id
    returning a.id
  ),
  stamped as (
    update public.admin_shadow_sessions s
       set revoked_at = now(),
           ended_at = coalesce(s.ended_at, s.expires_at)
      from finished f
     where s.id = f.id
    returning s.id
  )
  -- A data-modifying WITH query always runs to completion, read or not,
  -- so `stamped` needs no reference here.
  select count(*)::integer into v_deleted from gone;
  return v_deleted;
end;
$$;

revoke all on function public.revoke_expired_shadow_sessions() from public, anon, authenticated;
grant execute on function public.revoke_expired_shadow_sessions() to service_role;

-- ---------------------------------------------------------------------
-- 3. The MC's card: during-visit changes only; exit told apart from the
--    sweep's stamp
-- ---------------------------------------------------------------------

-- Same signature and columns as 20261020000000, so replace in place.
-- Guard first, as before.
create or replace function public.my_support_access()
returns table (
  id            uuid,
  started_at    timestamptz,
  ended_at      timestamptz,
  ended_by_exit boolean,
  change_count  bigint,
  request_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.mfa_satisfied() then
    raise exception using errcode = '42501', message = 'second factor required';
  end if;

  return query
  select
    s.id,
    s.started_at,
    coalesce(s.ended_at, case when s.expires_at <= now() then s.expires_at end),
    -- The sweep stamps ended_at = expires_at on a visit nobody exited;
    -- a real exit is always before the expiry (after it, exit refuses).
    s.ended_at is not null and s.ended_at < s.expires_at,
    (
      -- Record and account changes made during the visit, leaving out
      -- after_end rows (after exit or expiry) and auth.users rows that
      -- touched app_metadata only (service-role writes such as Stripe).
      select count(*)
        from public.admin_audit_log l
       where l.target_user_id = s.target_user_id
         and l.action = 'shadow_mutation'
         and (l.details ->> 'shadow_session_id') = s.session_id::text
         and coalesce((l.details ->> 'after_end')::boolean, false) = false
         and not (
           (l.details ->> 'table') = 'auth.users'
           and not exists (
             select 1
               from jsonb_array_elements_text(
                      case when jsonb_typeof(l.details -> 'changed_keys') = 'array'
                           then l.details -> 'changed_keys' else '[]'::jsonb end
                    ) k
              where k not like 'app\_metadata.%'
           )
         )
    ),
    (
      select count(*)
        from public.admin_audit_log l
       where l.target_user_id = s.target_user_id
         and l.action = 'shadow_request'
         and (l.details ->> 'shadow_session_id') = s.session_id::text
    )
  from public.admin_shadow_sessions s
  where s.target_user_id = auth.uid()
  order by s.started_at desc
  limit 100;
end;
$$;

revoke all on function public.my_support_access() from public, anon;
grant execute on function public.my_support_access() to authenticated;
