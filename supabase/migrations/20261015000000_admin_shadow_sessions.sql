-- Shadow-mode sessions and per-write attribution (Phase 4, Task 25).
--
-- Shadow mode signs an admin in AS an MC. Until now the only trail was
-- one `enter_shadow` row in admin_audit_log: nothing said what the admin
-- changed while inside, and the MC could not see that support had been
-- in their account at all.
--
-- This migration adds:
--
-- 1. `public.admin_shadow_sessions`: one row per shadow session, keyed
--    by the Supabase JWT `session_id` claim of the session enterShadow
--    minted for the target. The server writes it with the service role
--    on enter and stamps `ended_at` on a genuine exit. `expires_at`
--    matches the 8 hour shadow grant (SHADOW_GRANT_TTL_MS), so a session
--    nobody exited stops being "open" by itself.
--
-- 2. `public.log_shadow_mutation()`: one generic AFTER row trigger,
--    attached to every public table with RLS on. When the writing JWT
--    belongs to an open shadow session it appends a `shadow_mutation`
--    row to admin_audit_log naming the admin (actor) and the MC
--    (target). Why in the database and not in Next: the browser writes
--    to PostgREST directly for most of the app, so only the database
--    sees every mutation.
--
-- 3. `public.my_support_access()`: the MC's own view of it. Start and
--    end times plus a change count, never the admin's id or email.
--
-- Task 23b will reuse the open-session lookup to waive database-level
-- aal2 for shadow sessions, hence the partial index on open rows.

create table if not exists public.admin_shadow_sessions (
  id              uuid primary key default gen_random_uuid(),
  -- The `session_id` claim of the target session's access token. Not a
  -- foreign key: auth.sessions rows are deleted on sign-out, and this
  -- history has to outlive them.
  session_id      uuid not null unique,
  -- Cascade matches admin_audit_log.actor_id: deleting an admin account
  -- removes its trail in both tables alike.
  admin_id        uuid not null references auth.users(id) on delete cascade,
  target_user_id  uuid not null references auth.users(id) on delete cascade,
  started_at      timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '8 hours'),
  ended_at        timestamptz,
  constraint admin_shadow_sessions_not_self check (admin_id <> target_user_id),
  constraint admin_shadow_sessions_expiry_after_start check (expires_at > started_at)
);

-- "Is this JWT an open shadow session?": the trigger below on every
-- write, and Task 23b's aal2 waiver. Partial, so it only ever holds the
-- handful of sessions that are open right now.
create index if not exists admin_shadow_sessions_open_idx
  on public.admin_shadow_sessions (session_id)
  include (admin_id, target_user_id, expires_at)
  where ended_at is null;
create index if not exists admin_shadow_sessions_target_idx
  on public.admin_shadow_sessions (target_user_id, started_at desc);
create index if not exists admin_shadow_sessions_admin_idx
  on public.admin_shadow_sessions (admin_id);

alter table public.admin_shadow_sessions enable row level security;
-- No policies on purpose. The service role (enterShadow / exitShadow)
-- is the only writer, and MCs read their history through
-- my_support_access(), which never exposes the admin.
revoke all on public.admin_shadow_sessions from anon, authenticated;
grant select, insert, update, delete on public.admin_shadow_sessions to service_role;

comment on table public.admin_shadow_sessions is
  'One row per admin shadow session, keyed by the target session''s JWT '
  'session_id. Service role only; MCs read their own via my_support_access().';

-- The change count in my_support_access() filters one MC's audit rows
-- by shadow session.
create index if not exists admin_audit_log_shadow_session_idx
  on public.admin_audit_log (target_user_id, (details ->> 'shadow_session_id'))
  where action = 'shadow_mutation';

-- ---------------------------------------------------------------------
-- The trigger
-- ---------------------------------------------------------------------

-- SECURITY DEFINER because the writer (an MC session) has no grant on
-- admin_shadow_sessions or admin_audit_log, and must not get one.
-- search_path is empty so every name below is schema-qualified.
create or replace function public.log_shadow_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sid     text;
  v_session record;
  v_row     jsonb;
begin
  -- Fast path. The service role, cron and anything else without a user
  -- JWT carries no session_id; those writes are never shadow writes.
  v_sid := auth.jwt() ->> 'session_id';
  -- A claim that is not a uuid cannot name a shadow session, and a bad
  -- cast would abort the MC's own write, so skip it instead.
  if v_sid is null or v_sid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;

  -- Log what the admin did, not its knock-on effects. A row written by
  -- another trigger (an automation_events row a contact insert emits, a
  -- cascaded FK delete, which Postgres runs as a trigger) is depth 2 or
  -- more. A write inside an RPC the session called is still depth 1.
  if pg_trigger_depth() > 1 then
    return null;
  end if;

  select s.session_id, s.admin_id, s.target_user_id
    into v_session
    from public.admin_shadow_sessions s
   where s.session_id = v_sid::uuid
     and s.ended_at is null
     and now() < s.expires_at
     -- Belt and braces: the JWT's user must be the session's target.
     and s.target_user_id = auth.uid();
  if not found then
    return null;
  end if;

  -- Only the id is kept, never row contents: the log is readable by
  -- every admin and must not become a copy of MC data. Tables without
  -- an `id` column (join tables) log a null row_id.
  v_row := to_jsonb(case when tg_op = 'DELETE' then old else new end);

  insert into public.admin_audit_log (actor_id, target_user_id, action, details)
  values (
    v_session.admin_id,
    v_session.target_user_id,
    'shadow_mutation',
    jsonb_build_object(
      'table', tg_table_schema || '.' || tg_table_name,
      'op', tg_op,
      'row_id', v_row ->> 'id',
      'shadow_session_id', v_session.session_id
    )
  );
  return null;
end;
$$;

revoke all on function public.log_shadow_mutation() from public, anon, authenticated;

-- Attach to every public table with RLS on (the owned tables), except the
-- two this feature writes itself. A table created after this migration
-- does not get it automatically: the integration ratchet test
-- (tests/integration/admin/shadow-trigger-coverage.test.ts) fails until
-- its migration attaches the trigger too.
do $$
declare
  t record;
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r', 'p')
       and c.relrowsecurity
       and c.relname not in ('admin_audit_log', 'admin_shadow_sessions')
       and not exists (
         select 1 from pg_trigger g
          where g.tgrelid = c.oid and g.tgname = 'zz_log_shadow_mutation'
       )
  loop
    execute format(
      'create trigger zz_log_shadow_mutation after insert or update or delete on public.%I '
      'for each row execute function public.log_shadow_mutation()',
      t.relname
    );
  end loop;
end;
$$;

-- storage.objects is deliberately left out. Storage API (v1.73) checks
-- the MC's RLS but performs the write under service_role claims, so the
-- trigger would never see a user session_id there (probed against local
-- Supabase, Task 25). File changes made while shadowing are therefore
-- not in the log; the row writes that reference files (portal_files,
-- user_branding, proposal media rows) are.

-- ---------------------------------------------------------------------
-- The MC's view
-- ---------------------------------------------------------------------

-- An MC's own support-access history. SECURITY DEFINER because the MC
-- has no grant on either table; it only ever returns rows where the MC
-- is the target, and never the admin's identity.
--
-- ended_at: when the admin exited; else the expiry once it has passed;
-- else null (still open).
create or replace function public.my_support_access()
returns table (
  started_at   timestamptz,
  ended_at     timestamptz,
  change_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.started_at,
    coalesce(s.ended_at, case when s.expires_at <= now() then s.expires_at end) as ended_at,
    (
      select count(*)
        from public.admin_audit_log l
       where l.target_user_id = s.target_user_id
         and l.action = 'shadow_mutation'
         and (l.details ->> 'shadow_session_id') = s.session_id::text
    ) as change_count
  from public.admin_shadow_sessions s
  where s.target_user_id = auth.uid()
  order by s.started_at desc
  limit 100;
$$;

revoke all on function public.my_support_access() from public, anon;
grant execute on function public.my_support_access() to authenticated;
