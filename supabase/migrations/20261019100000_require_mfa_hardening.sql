-- Two-factor at the database: review fixes (Phase 4, Task 23b fix round 1).
--
-- Two changes to 20261019000000, which stays as shipped:
--
-- 1. The shadow waiver in mfa_satisfied() now also requires the admin
--    who opened the session to still be an admin (M6). The Next layer
--    re-checks this on every request; the database did not, and demoting
--    an admin does not stamp ended_at on their open shadow sessions. So a
--    demoted admin still holding a shadow token kept aal1 access to a 2FA
--    MC's data through PostgREST for up to the 8 hour expiry. "Admin"
--    means what lib/auth/entitlements `isAdmin` means: app_metadata
--    `account_type` = 'admin' (raw_app_meta_data, which only the service
--    role can write; never user_metadata).
--
-- 2. ensure_require_mfa_policies() accepts a policy as attached only if
--    its USING and WITH CHECK are exactly `(select public.mfa_satisfied())`
--    (M3). It used to accept any expression containing mfa_satisfied(),
--    so a hand-edited `(select mfa_satisfied()) or true` counted.

-- ---------------------------------------------------------------------
-- The predicate (replaces 20261019000000's body; same signature, grants
-- are kept by create or replace)
-- ---------------------------------------------------------------------

create or replace function public.mfa_satisfied()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_claims jsonb := auth.jwt();
  v_uid    uuid  := auth.uid();
  v_sid    text;
begin
  -- No user in the JWT: anon, the service role, cron, migrations and
  -- GoTrue itself. None of those is an MC session that owes a factor,
  -- and the policies only apply to `authenticated` anyway.
  if v_uid is null or coalesce(v_claims ->> 'role', '') = 'service_role' then
    return true;
  end if;

  if (v_claims ->> 'aal') = 'aal2' then
    return true;
  end if;

  -- A user without a verified factor has nothing more to give; `aal1`
  -- is their full assurance. An unverified (half-enrolled) factor does
  -- not count, matching lib/auth/mfa `hasVerifiedFactor`, so an MC in
  -- the middle of enrolling is never locked out.
  if not exists (
    select 1 from auth.mfa_factors f
     where f.user_id = v_uid
       and f.status = 'verified'
  ) then
    return true;
  end if;

  -- Shadow waiver: an OPEN admin_shadow_sessions row for this JWT's
  -- session_id and user, opened by someone who is STILL an admin. A
  -- claim that is not a uuid cannot name a session, and a bad cast would
  -- abort the caller's statement, so it is skipped instead.
  v_sid := v_claims ->> 'session_id';
  if v_sid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and exists (
       select 1
         from public.admin_shadow_sessions s
         join auth.users a on a.id = s.admin_id
        where s.session_id = v_sid::uuid
          and s.ended_at is null
          and now() < s.expires_at
          -- The JWT's user must be the session's recorded target.
          and s.target_user_id = v_uid
          -- Demotion ends the waiver at once, as it does in middleware.
          and (a.raw_app_meta_data ->> 'account_type') = 'admin'
     ) then
    return true;
  end if;

  return false;
end;
$$;

-- ---------------------------------------------------------------------
-- The ensure function: exact expression match
-- ---------------------------------------------------------------------

-- pg_get_expr prints the call schema-qualified or not depending on the
-- search_path of whoever deparses it (empty here, so `public.` appears;
-- a psql session prints it bare). Dropping a leading `public.` from the
-- call makes both spellings compare equal, and nothing else is loosened:
-- any other wrapper, operator or function makes the text differ.
create or replace function public.ensure_require_mfa_policies()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
  v_count integer := 0;
  c_expr constant text := '( SELECT mfa_satisfied() AS mfa_satisfied)';
begin
  for t in
    select c.oid, c.relname
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r', 'p')
       and c.relrowsecurity
       and not exists (
         select 1 from pg_catalog.pg_policy p
          where p.polrelid = c.oid
            and p.polname = 'require_mfa'
            and not p.polpermissive
            and p.polcmd = '*'
            and p.polroles = array['authenticated'::regrole::oid]
            and replace(pg_catalog.pg_get_expr(p.polqual, p.polrelid),
                        'public.mfa_satisfied()', 'mfa_satisfied()') = c_expr
            and replace(pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid),
                        'public.mfa_satisfied()', 'mfa_satisfied()') = c_expr
       )
  loop
    if exists (
      select 1 from pg_catalog.pg_policy p
       where p.polrelid = t.oid and p.polname = 'require_mfa'
    ) then
      execute format('drop policy require_mfa on public.%I', t.relname);
    end if;
    execute format(
      'create policy require_mfa on public.%I as restrictive for all to authenticated '
      'using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()))',
      t.relname
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.ensure_require_mfa_policies() from public, anon, authenticated;
grant execute on function public.ensure_require_mfa_policies() to service_role;

select public.ensure_require_mfa_policies();
