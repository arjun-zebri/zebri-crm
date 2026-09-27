-- Two-factor sign-in enforced by the database (Phase 4, Task 23b).
--
-- Task 23 gated every Next route on `aal2` for an MC with a verified
-- TOTP factor. That gate never sees a request that goes straight to
-- PostgREST, Storage or an RPC with the public publishable key, so a
-- stolen password alone (an `aal1` token) could still read and write the
-- MC's whole account. This migration moves the rule into the database:
--
-- 1. `public.mfa_satisfied()`: the one predicate. True when the JWT is
--    `aal2`, when the user has no verified factor, or when the JWT's
--    `session_id` is an open `admin_shadow_sessions` row (the same waiver
--    the Next layer applies: the admin does not hold the MC's phone).
--    Also true with no user JWT at all (service role, cron, migrations,
--    GoTrue), so nothing internal changes.
--
-- 2. A RESTRICTIVE policy `require_mfa` on every public table with RLS
--    on, for `authenticated` only. Restrictive policies are ANDed with
--    the table's own permissive ones, so an owner policy still decides
--    WHICH rows; this one only decides whether the session may touch any
--    at all. The `(select ...)` wrapper makes Postgres evaluate it once
--    per statement (an initplan), not once per row. Attached by the
--    idempotent `ensure_require_mfa_policies()`, which runs at the end of
--    this migration and again after every deploy push, like
--    `ensure_shadow_triggers()` (20261017000000).
--
-- 3. The same restrictive policy on `storage.objects`.
--
-- 4. SECURITY DEFINER functions bypass RLS, so the policy never reaches
--    them. The two that act for `auth.uid()` and are executable by
--    `authenticated` get a guard as their first statement. Every other
--    definer function an authenticated caller can reach is either a
--    trigger function (not callable directly), a token-gated public RPC
--    (portal, quote, invoice, contract, booking, lead, questionnaire:
--    the token is the capability and anon can call it anyway), or a
--    service-role-only function. The integration ratchet
--    tests/integration/rls/require-mfa-coverage.test.ts lists them all
--    and fails when a new one appears without a guard or a reason.
--
-- If this is wrong: an `aal1` MC with 2FA sees empty data until they
-- complete the second factor, which the Next gate already forces.

-- ---------------------------------------------------------------------
-- The predicate
-- ---------------------------------------------------------------------

-- SECURITY DEFINER because `authenticated` has no grant on
-- admin_shadow_sessions (service role only) and must not get one, and
-- reading auth.mfa_factors as the caller would tie this check to
-- whatever Supabase grants on the auth schema. search_path is empty so
-- every name below is schema-qualified. STABLE: one answer per statement, which is what
-- the initplan form in the policies relies on.
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
  -- and the policies below only apply to `authenticated` anyway.
  if v_uid is null or coalesce(v_claims ->> 'role', '') = 'service_role' then
    return true;
  end if;

  if (v_claims ->> 'aal') = 'aal2' then
    return true;
  end if;

  -- A user without a verified factor has nothing more to give; `aal1`
  -- is their full assurance. An unverified (half-enrolled) factor does
  -- not count, matching lib/auth/mfa `hasVerifiedFactor`.
  if not exists (
    select 1 from auth.mfa_factors f
     where f.user_id = v_uid
       and f.status = 'verified'
  ) then
    return true;
  end if;

  -- Shadow waiver: an admin shadowing the MC holds an `aal1` session
  -- minted by enterShadow, recorded server-side by its JWT session_id.
  -- Only an OPEN row counts (not ended, not past its 8 hour expiry), so
  -- a copied token stops working at Exit. A claim that is not a uuid
  -- cannot name a session, and a bad cast would abort the caller's
  -- statement, so it is skipped instead.
  v_sid := v_claims ->> 'session_id';
  if v_sid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and exists (
       select 1 from public.admin_shadow_sessions s
        where s.session_id = v_sid::uuid
          and s.ended_at is null
          and now() < s.expires_at
          -- Belt and braces, as in log_shadow_mutation(): the JWT's user
          -- must be the session's recorded target.
          and s.target_user_id = v_uid
     ) then
    return true;
  end if;

  return false;
end;
$$;

comment on function public.mfa_satisfied() is
  'True unless the caller is an MC with a verified second factor whose session is '
  'below aal2 and is not an open admin shadow session. Used by the require_mfa '
  'restrictive policies and the guards in definer RPCs (Task 23b).';

-- Policies evaluate it as the querying role, so `authenticated` needs
-- EXECUTE. It returns one boolean about the caller's own session.
revoke all on function public.mfa_satisfied() from public, anon;
grant execute on function public.mfa_satisfied() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- The restrictive policy on every RLS table
-- ---------------------------------------------------------------------

-- Idempotent. Returns how many tables it (re)attached, so the deploy
-- step can warn when coverage had drifted (a table from an
-- earlier-timestamped migration pushed after this one, or a policy
-- somebody altered by hand). "Attached" means: restrictive, for all
-- commands, to authenticated alone, with both USING and WITH CHECK
-- calling mfa_satisfied(). Anything else under the name is replaced.
create or replace function public.ensure_require_mfa_policies()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
  v_count integer := 0;
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
            and pg_catalog.pg_get_expr(p.polqual, p.polrelid) like '%mfa_satisfied()%'
            and pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid) like '%mfa_satisfied()%'
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

-- ---------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------

-- Storage API runs its RLS check under the caller's JWT claims, so the
-- same predicate sees the caller's `aal`. storage.objects belongs to
-- supabase_storage_admin; earlier migrations (20260515000000) already
-- create policies on it as the migration role, so this is expected to
-- work. If a project ever refuses it, the migration still lands and the
-- deploy's post-push check reports the missing policy.
do $$
begin
  drop policy if exists require_mfa on storage.objects;
  create policy require_mfa on storage.objects
    as restrictive for all to authenticated
    using ((select public.mfa_satisfied()))
    with check ((select public.mfa_satisfied()));
exception
  when insufficient_privilege then
    raise warning 'require_mfa not attached to storage.objects: %', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------
-- Guards in definer functions that act for auth.uid()
-- ---------------------------------------------------------------------

-- Body copied from 20260807000000_create_ai_copilot_usage.sql (unchanged
-- since; matches pg_get_functiondef), with the guard added first. A
-- password thief spending the MC's copilot allowance is small, but the
-- rule is uniform: a definer RPC that acts for auth.uid() checks.
create or replace function public.increment_ai_copilot_usage()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_count integer;
begin
  if not public.mfa_satisfied() then
    raise exception using errcode = '42501', message = 'second factor required';
  end if;

  if v_user is null then
    raise exception 'not authenticated';
  end if;

  insert into ai_copilot_usage as u (user_id, day, message_count)
  values (v_user, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day)
  do update set
    message_count = u.message_count + 1,
    updated_at = now()
  returning u.message_count into v_count;

  return v_count;
end;
$$;

-- Body copied from 20261018000000_shadow_logging_hardening.sql (matches
-- pg_get_functiondef). It was LANGUAGE sql; it is now plpgsql only so the
-- guard can raise before the query. Same signature, same columns, same
-- rows. Every column reference is table-qualified, so the OUT parameter
-- names (id, started_at, ...) cannot shadow them.
create or replace function public.my_support_access()
returns table (
  id            uuid,
  started_at    timestamptz,
  ended_at      timestamptz,
  ended_by_exit boolean,
  change_count  bigint
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
    s.ended_at is not null,
    (
      select count(*)
        from public.admin_audit_log l
       where l.target_user_id = s.target_user_id
         and l.action in ('shadow_mutation', 'shadow_request')
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
