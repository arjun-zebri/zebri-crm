-- Shadow-mode logging: coverage and lifetime (Phase 4, Task 25 fix round 1).
--
-- 20261015000000 logged a write only while its shadow session was open,
-- only on tables with RLS on, and only for writes that reach a public
-- table under the shadow JWT. The review found three ways around that:
--
-- 1. Attribution stopped at exit or expiry, but the minted target
--    session lives on (its refresh token is good for the 168h timebox).
--    A copied token wrote unlogged after "Exit". Now any write from a
--    recorded shadow session_id is logged, flagged `after_end` once the
--    session has ended or expired, and Slack is told (at most hourly per
--    session). Only admin browsers ever hold these session ids, so this
--    has no false positives.
-- 2. GoTrue writes auth.users (user_metadata holds the MC's bank
--    details, plus email and password) as supabase_auth_admin with no
--    JWT, so the table trigger never saw them. New triggers on auth.users
--    and auth.mfa_factors log the changed KEY NAMES (never values) while
--    the user has an open shadow session, labelled `during_session`
--    because the database cannot tell who made the change. A bank_* or
--    email change also alerts Slack.
-- 3. Coverage could lapse unseen: non-RLS tables were skipped, and on a
--    hosted project a table from an earlier-timestamped migration pushed
--    later would never get the trigger. `ensure_shadow_triggers()` now
--    attaches to every public base table except the two this feature
--    writes, runs at the end of this migration, and runs again as the
--    last step of both deploy workflows.
--
-- Also: triggers are attached WHEN (pg_trigger_depth() = 0), so knock-on
-- and cascade rows are never even queued; `row_id` falls back to the
-- primary-key columns for tables with no `id`; and my_support_access()
-- says whether a visit ended by exit or by expiry.
--
-- Service-role writes made by Next server actions are still invisible to
-- any table trigger (no session in the JWT). Those are covered in the
-- app: middleware writes one `shadow_request` row per non-GET request
-- made under a verified shadow grant.

alter table public.admin_shadow_sessions
  add column if not exists after_end_alerted_at timestamptz;

comment on column public.admin_shadow_sessions.after_end_alerted_at is
  'Last time Slack was told this session wrote after it ended or expired. '
  'Throttles the alert to once an hour per session.';

-- ---------------------------------------------------------------------
-- Slack, from the database
-- ---------------------------------------------------------------------

-- Posts to the same Vault-held webhook the tick watchdog uses
-- (20261001200000). Silent when no webhook is configured (local, CI).
-- Never raises: a Slack problem must not abort the write being logged.
-- Callers pass ids and key names only, never names, emails or values.
create or replace function public.shadow_alert_slack(p_text text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_webhook text;
begin
  select decrypted_secret into v_webhook
    from vault.decrypted_secrets where name = 'slack_webhook_url';
  if v_webhook is null then
    return null;
  end if;
  return net.http_post(
    url := v_webhook,
    body := jsonb_build_object('text', p_text),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 10000
  );
exception
  when others then
    raise warning 'shadow_alert_slack failed: %', sqlerrm;
    return null;
end;
$$;

revoke all on function public.shadow_alert_slack(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Row writes through a shadow session (replaces 20261015's body)
-- ---------------------------------------------------------------------

create or replace function public.log_shadow_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sid       text;
  v_session   record;
  v_row       jsonb;
  v_row_id    jsonb;
  v_after_end boolean;
begin
  -- The attach clause already filters to depth 0 at queue time; this is
  -- the same rule for any trigger attached without it.
  if pg_trigger_depth() > 1 then
    return null;
  end if;

  -- Service role and cron carry no session_id. Every MC token does, so
  -- normal MC writes pay one indexed lookup below.
  v_sid := auth.jwt() ->> 'session_id';
  if v_sid is null or v_sid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;

  -- No ended/expired filter on purpose: a recorded session id is only
  -- ever held by the admin's browser, so a write from it after exit is
  -- the admin (or a copied token) and must still be attributed.
  select s.id, s.session_id, s.admin_id, s.target_user_id, s.ended_at,
         s.expires_at, s.after_end_alerted_at
    into v_session
    from public.admin_shadow_sessions s
   where s.session_id = v_sid::uuid
     and s.target_user_id = auth.uid();
  if not found then
    return null;
  end if;

  v_after_end := v_session.ended_at is not null or now() >= v_session.expires_at;

  -- Ids only, never row contents. Tables without an `id` column log
  -- their primary-key columns as an object instead.
  v_row := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  if v_row ? 'id' then
    v_row_id := v_row -> 'id';
  else
    select jsonb_object_agg(a.attname, v_row -> a.attname::text)
      into v_row_id
      from pg_catalog.pg_index i
      join pg_catalog.pg_attribute a
        on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
     where i.indrelid = tg_relid and i.indisprimary;
  end if;

  insert into public.admin_audit_log (actor_id, target_user_id, action, details)
  values (
    v_session.admin_id,
    v_session.target_user_id,
    'shadow_mutation',
    jsonb_build_object(
      'table', tg_table_schema || '.' || tg_table_name,
      'op', tg_op,
      'row_id', v_row_id,
      'shadow_session_id', v_session.session_id,
      'after_end', v_after_end
    )
  );

  if v_after_end
     and (v_session.after_end_alerted_at is null
          or v_session.after_end_alerted_at < now() - interval '1 hour') then
    update public.admin_shadow_sessions
       set after_end_alerted_at = now()
     where id = v_session.id;
    perform public.shadow_alert_slack(format(
      ':rotating_light: *Shadow session wrote after it ended.* Admin %s, user %s, '
      'shadow session %s, table %s (%s). The admin exited or the session expired, '
      'so this is a kept or copied token. Check admin_audit_log.',
      v_session.admin_id, v_session.target_user_id, v_session.session_id,
      tg_table_schema || '.' || tg_table_name, tg_op
    ));
  end if;

  return null;
end;
$$;

revoke all on function public.log_shadow_mutation() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Keep every public table covered
-- ---------------------------------------------------------------------

-- Attach (or re-attach) the row trigger to every public base table
-- except the two this feature writes itself. Idempotent: a table that
-- already has the current definition is left alone. Returns how many
-- tables it attached. Service role only; called at the end of this
-- migration and by the deploy workflows after `supabase db push`, so an
-- out-of-order hosted push cannot leave a table uncovered.
create or replace function public.ensure_shadow_triggers()
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
       -- Partitions inherit a clone of their parent's trigger.
       and not c.relispartition
       and c.relname not in ('admin_audit_log', 'admin_shadow_sessions')
       and not exists (
         select 1 from pg_catalog.pg_trigger g
          where g.tgrelid = c.oid
            and g.tgname = 'zz_log_shadow_mutation'
            and g.tgenabled <> 'D'
            and g.tgqual is not null
       )
  loop
    if exists (
      select 1 from pg_catalog.pg_trigger g
       where g.tgrelid = t.oid and g.tgname = 'zz_log_shadow_mutation'
    ) then
      execute format('drop trigger zz_log_shadow_mutation on public.%I', t.relname);
    end if;
    -- WHEN is evaluated as the row changes, so rows written by other
    -- triggers and FK cascades are never queued. Writes inside an RPC
    -- the session calls are still depth 0.
    execute format(
      'create trigger zz_log_shadow_mutation after insert or update or delete on public.%I '
      'for each row when (pg_trigger_depth() = 0) execute function public.log_shadow_mutation()',
      t.relname
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.ensure_shadow_triggers() from public, anon, authenticated;
grant execute on function public.ensure_shadow_triggers() to service_role;

-- ---------------------------------------------------------------------
-- GoTrue writes: auth.users and auth.mfa_factors
-- ---------------------------------------------------------------------

-- The open shadow session on a user, if any. "Open" here (not "ever
-- recorded") because these writes carry no session id: all the database
-- knows is that support was signed in as this user at the time.
create or replace function public.open_shadow_session_for(p_user_id uuid)
returns table (session_id uuid, admin_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select s.session_id, s.admin_id
    from public.admin_shadow_sessions s
   where s.target_user_id = p_user_id
     and s.ended_at is null
     and now() < s.expires_at
   order by s.started_at desc
   limit 1;
$$;

revoke all on function public.open_shadow_session_for(uuid) from public, anon, authenticated;

create or replace function public.log_shadow_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session   record;
  v_keys      jsonb;
  v_sensitive boolean;
begin
  select * into v_session from public.open_shadow_session_for(new.id);
  if not found then
    return null;
  end if;

  -- Names only. Metadata keys are prefixed with their bag; the column
  -- changes use plain names; encrypted_password is reported as
  -- "password" and never read beyond "did it change".
  select coalesce(jsonb_agg(k order by k), '[]'::jsonb)
    into v_keys
    from (
      select 'user_metadata.' || key as k
        from (select jsonb_object_keys(coalesce(new.raw_user_meta_data, '{}'::jsonb))
              union
              select jsonb_object_keys(coalesce(old.raw_user_meta_data, '{}'::jsonb))) m(key)
       where (new.raw_user_meta_data -> key) is distinct from (old.raw_user_meta_data -> key)
      union all
      select 'app_metadata.' || key
        from (select jsonb_object_keys(coalesce(new.raw_app_meta_data, '{}'::jsonb))
              union
              select jsonb_object_keys(coalesce(old.raw_app_meta_data, '{}'::jsonb))) m(key)
       where (new.raw_app_meta_data -> key) is distinct from (old.raw_app_meta_data -> key)
      union all select 'email' where new.email is distinct from old.email
      union all select 'email_change' where new.email_change is distinct from old.email_change
      union all select 'phone' where new.phone is distinct from old.phone
      union all select 'phone_change' where new.phone_change is distinct from old.phone_change
      union all select 'password' where new.encrypted_password is distinct from old.encrypted_password
    ) changed;

  if v_keys = '[]'::jsonb then
    return null;
  end if;

  v_sensitive := exists (
    select 1 from jsonb_array_elements_text(v_keys) k
     where k like 'user\_metadata.bank\_%' or k in ('email', 'email_change')
  );

  insert into public.admin_audit_log (actor_id, target_user_id, action, details)
  values (
    v_session.admin_id,
    new.id,
    'shadow_mutation',
    jsonb_build_object(
      'table', 'auth.users',
      'op', tg_op,
      'row_id', to_jsonb(new.id),
      'changed_keys', v_keys,
      'attribution', 'during_session',
      'sensitive', v_sensitive,
      'shadow_session_id', v_session.session_id
    )
  );

  if v_sensitive then
    perform public.shadow_alert_slack(format(
      ':warning: *Bank details or email changed during a shadow session.* User %s, '
      'admin %s signed in as them (shadow session %s). Changed: %s. '
      'The database cannot tell whether the admin or the user made it; check admin_audit_log.',
      new.id, v_session.admin_id, v_session.session_id,
      (select string_agg(k, ', ') from jsonb_array_elements_text(v_keys) k)
    ));
  end if;
  return null;
end;
$$;

revoke all on function public.log_shadow_auth_user_change() from public, anon, authenticated;

drop trigger if exists zz_log_shadow_auth_user on auth.users;
-- Only the columns an MC can change through the app. Sign-ins rewrite
-- last_sign_in_at and the like; those never reach the function.
create trigger zz_log_shadow_auth_user
  after update on auth.users
  for each row
  when (
    old.raw_user_meta_data is distinct from new.raw_user_meta_data
    or old.raw_app_meta_data is distinct from new.raw_app_meta_data
    or old.email is distinct from new.email
    or old.email_change is distinct from new.email_change
    or old.phone is distinct from new.phone
    or old.phone_change is distinct from new.phone_change
    or old.encrypted_password is distinct from new.encrypted_password
  )
  execute function public.log_shadow_auth_user_change();

-- Turning 2FA on or off while shadowing.
create or replace function public.log_shadow_mfa_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_row     record;
begin
  if tg_op = 'DELETE' then v_row := old; else v_row := new; end if;
  select * into v_session from public.open_shadow_session_for(v_row.user_id);
  if not found then
    return null;
  end if;
  insert into public.admin_audit_log (actor_id, target_user_id, action, details)
  values (
    v_session.admin_id,
    v_row.user_id,
    'shadow_mutation',
    jsonb_build_object(
      'table', 'auth.mfa_factors',
      'op', tg_op,
      'row_id', to_jsonb(v_row.id),
      'attribution', 'during_session',
      'shadow_session_id', v_session.session_id
    )
  );
  return null;
end;
$$;

revoke all on function public.log_shadow_mfa_change() from public, anon, authenticated;

-- auth.mfa_factors belongs to supabase_auth_admin. If this role may not
-- create triggers there, skip it (and say so in the deploy log) rather
-- than fail the deploy; the factor change then goes unlogged.
do $$
begin
  execute 'drop trigger if exists zz_log_shadow_mfa on auth.mfa_factors';
  execute 'drop trigger if exists zz_log_shadow_mfa_status on auth.mfa_factors';
  execute 'create trigger zz_log_shadow_mfa after insert or delete on auth.mfa_factors '
          'for each row execute function public.log_shadow_mfa_change()';
  -- GoTrue touches factor rows on every challenge; only a status change
  -- (unverified to verified) is a change the MC would care about.
  execute 'create trigger zz_log_shadow_mfa_status after update on auth.mfa_factors '
          'for each row when (old.status is distinct from new.status) '
          'execute function public.log_shadow_mfa_change()';
exception
  when insufficient_privilege then
    raise warning 'log_shadow_mfa_change: no trigger privilege on auth.mfa_factors; 2FA changes while shadowing are not logged';
end;
$$;

-- ---------------------------------------------------------------------
-- The MC's view: say how each visit ended
-- ---------------------------------------------------------------------

-- The return type changes, which create or replace cannot do.
drop function if exists public.my_support_access();

create function public.my_support_access()
returns table (
  id            uuid,
  started_at    timestamptz,
  ended_at      timestamptz,
  ended_by_exit boolean,
  change_count  bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.started_at,
    -- The exit time; else the expiry once passed; else null (open).
    coalesce(s.ended_at, case when s.expires_at <= now() then s.expires_at end),
    s.ended_at is not null,
    (
      select count(*)
        from public.admin_audit_log l
       where l.target_user_id = s.target_user_id
         and l.action = 'shadow_mutation'
         and (l.details ->> 'shadow_session_id') = s.session_id::text
    )
  from public.admin_shadow_sessions s
  where s.target_user_id = auth.uid()
  order by s.started_at desc
  limit 100;
$$;

revoke all on function public.my_support_access() from public, anon;
grant execute on function public.my_support_access() to authenticated;

-- Re-attach every table with the WHEN clause, and pick up any table the
-- first migration's loop did not (non-RLS tables, later pushes).
select public.ensure_shadow_triggers();
