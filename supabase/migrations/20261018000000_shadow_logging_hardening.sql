-- Shadow-mode logging, fix round 2 (Phase 4, Task 25).
--
-- 1. After Exit, account changes through a copied target token went
--    unlogged: the auth.users trigger only looked for an OPEN shadow
--    session, and exit does not revoke the target session. Now, when no
--    session is open, it falls back to any recorded shadow session for
--    that user whose auth.sessions row is still live. Those changes are
--    logged with after_end = true and attribution
--    'unrevoked_shadow_session'; a bank_* or email change alerts Slack.
-- 2. The auth-table trigger bodies are guarded: a logging failure raises
--    a WARNING (and a Slack note) and never aborts GoTrue's write. The
--    writer may be the MC or a Stripe entitlement update, not the admin.
--    JSON-null or non-object metadata no longer raises.
-- 3. Key names in Slack text are sanitised and capped (they are chosen
--    by whoever holds the session).
-- 4. my_support_access counts shadow_request rows too, so service-role
--    work done while shadowing reaches the MC's card.
-- 5. ensure_shadow_triggers() only accepts a trigger that calls the right
--    function on the right events; anything else is replaced.
--
-- Kill switch (hosted may not let postgres drop a trigger on auth.users,
-- which supabase_auth_admin owns, but postgres owns these functions):
--
--   create or replace function public.log_shadow_auth_user_change()
--   returns trigger language plpgsql security definer set search_path = ''
--   as $$ begin return null; end; $$;
--
-- and the same for public.log_shadow_mfa_change(). Re-applying this
-- migration's definitions restores logging.

-- ---------------------------------------------------------------------
-- Slack-safe key list
-- ---------------------------------------------------------------------

-- Key names come from user_metadata, which the session holder chooses.
-- Strip Slack's mrkdwn control characters (<, >, &), cap each name at 40
-- characters, list at most 10, and say how many more there were. The
-- audit row keeps the full list; only the Slack text is trimmed.
create or replace function public.shadow_slack_key_list(p_keys jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  with k as (
    select left(regexp_replace(value, '[<>&]', '', 'g'), 40) as name,
           row_number() over () as n
      from jsonb_array_elements_text(
             case when jsonb_typeof(p_keys) = 'array' then p_keys else '[]'::jsonb end
           ) as value
  )
  select coalesce(
    (select string_agg(name, ', ' order by n) from k where n <= 10),
    ''
  ) || case
         when (select count(*) from k) > 10
           then format(' and %s more', (select count(*) from k) - 10)
         else ''
       end;
$$;

revoke all on function public.shadow_slack_key_list(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- A recorded shadow session whose target session is still usable
-- ---------------------------------------------------------------------

-- The most recent shadow session for the user whose auth.sessions row
-- still exists and has not timed out. The two intervals mirror
-- supabase/config.toml ([auth.sessions] timebox = "168h",
-- inactivity_timeout = "72h"); change them together. refreshed_at is a
-- timestamp without time zone holding UTC.
create or replace function public.live_shadow_session_for(p_user_id uuid)
returns table (session_id uuid, admin_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select s.session_id, s.admin_id
    from public.admin_shadow_sessions s
    join auth.sessions a on a.id = s.session_id
   where s.target_user_id = p_user_id
     and a.user_id = p_user_id
     and (a.not_after is null or a.not_after > now())
     and a.created_at > now() - interval '168 hours'
     and coalesce(a.refreshed_at at time zone 'utc', a.created_at) > now() - interval '72 hours'
   order by s.started_at desc
   limit 1;
$$;

revoke all on function public.live_shadow_session_for(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- auth.users: guarded, with the after-exit fallback
-- ---------------------------------------------------------------------

create or replace function public.log_shadow_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session   record;
  v_after_end boolean := false;
  v_keys      jsonb;
  v_sensitive boolean;
  v_new_um    jsonb;
  v_old_um    jsonb;
  v_new_am    jsonb;
  v_old_am    jsonb;
begin
  -- Everything is inside one guarded block: a logging failure must never
  -- abort GoTrue's write, because the writer may be the MC themselves or
  -- a Stripe entitlement update, not the admin.
  begin
    select * into v_session from public.open_shadow_session_for(new.id);
    if not found then
      -- After Exit the target session is not revoked, so a copied token
      -- can still call auth.updateUser. Attribute to the shadow session
      -- whose auth session is still live.
      select * into v_session from public.live_shadow_session_for(new.id);
      if not found then
        return null;
      end if;
      v_after_end := true;
    end if;

    -- Metadata can be JSON null or a non-object; treat those as empty.
    v_new_um := case when jsonb_typeof(new.raw_user_meta_data) = 'object' then new.raw_user_meta_data else '{}'::jsonb end;
    v_old_um := case when jsonb_typeof(old.raw_user_meta_data) = 'object' then old.raw_user_meta_data else '{}'::jsonb end;
    v_new_am := case when jsonb_typeof(new.raw_app_meta_data) = 'object' then new.raw_app_meta_data else '{}'::jsonb end;
    v_old_am := case when jsonb_typeof(old.raw_app_meta_data) = 'object' then old.raw_app_meta_data else '{}'::jsonb end;

    -- Names only, never values.
    select coalesce(jsonb_agg(k order by k), '[]'::jsonb)
      into v_keys
      from (
        select 'user_metadata.' || key as k
          from (select jsonb_object_keys(v_new_um) union select jsonb_object_keys(v_old_um)) m(key)
         where (v_new_um -> key) is distinct from (v_old_um -> key)
        union all
        select 'app_metadata.' || key
          from (select jsonb_object_keys(v_new_am) union select jsonb_object_keys(v_old_am)) m(key)
         where (v_new_am -> key) is distinct from (v_old_am -> key)
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
        'attribution', case when v_after_end then 'unrevoked_shadow_session' else 'during_session' end,
        'after_end', v_after_end,
        'sensitive', v_sensitive,
        'shadow_session_id', v_session.session_id
      )
    );

    if v_sensitive then
      perform public.shadow_alert_slack(format(
        case when v_after_end
          then ':rotating_light: *Bank details or email changed through a shadow session after it ended.* '
               'User %s, admin %s (shadow session %s, not revoked). Changed: %s. '
               'Likely a kept or copied token; check admin_audit_log.'
          else ':warning: *Bank details or email changed during a shadow session.* User %s, '
               'admin %s signed in as them (shadow session %s). Changed: %s. '
               'The database cannot tell whether the admin or the user made it; check admin_audit_log.'
        end,
        new.id, v_session.admin_id, v_session.session_id,
        public.shadow_slack_key_list(v_keys)
      ));
    end if;
  exception
    when others then
      raise warning 'log_shadow_auth_user_change failed for user %: %', new.id, sqlerrm;
      perform public.shadow_alert_slack(format(
        ':warning: Shadow-mode account-change logging failed for user %s (%s). The change itself was saved.',
        new.id, sqlstate
      ));
  end;
  return null;
end;
$$;

revoke all on function public.log_shadow_auth_user_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- auth.mfa_factors: same guard (open sessions only, as ruled)
-- ---------------------------------------------------------------------

create or replace function public.log_shadow_mfa_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_user    uuid;
  v_id      uuid;
begin
  begin
    if tg_op = 'DELETE' then
      v_user := old.user_id; v_id := old.id;
    else
      v_user := new.user_id; v_id := new.id;
    end if;
    select * into v_session from public.open_shadow_session_for(v_user);
    if not found then
      return null;
    end if;
    insert into public.admin_audit_log (actor_id, target_user_id, action, details)
    values (
      v_session.admin_id,
      v_user,
      'shadow_mutation',
      jsonb_build_object(
        'table', 'auth.mfa_factors',
        'op', tg_op,
        'row_id', to_jsonb(v_id),
        'attribution', 'during_session',
        'shadow_session_id', v_session.session_id
      )
    );
  exception
    when others then
      raise warning 'log_shadow_mfa_change failed for user %: %', v_user, sqlerrm;
      perform public.shadow_alert_slack(format(
        ':warning: Shadow-mode 2FA-change logging failed for user %s (%s). The change itself was saved.',
        v_user, sqlstate
      ));
  end;
  return null;
end;
$$;

revoke all on function public.log_shadow_mfa_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- ensure_shadow_triggers(): check function and events, not just the name
-- ---------------------------------------------------------------------

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
       and not c.relispartition
       and c.relname not in ('admin_audit_log', 'admin_shadow_sessions')
       -- Attached means: enabled, calls log_shadow_mutation(), row-level
       -- AFTER on insert, update and delete (tgtype bits 1|4|8|16 = 29,
       -- before bit 2 clear), with a WHEN clause. Anything else under the
       -- name is replaced.
       and not exists (
         select 1 from pg_catalog.pg_trigger g
          where g.tgrelid = c.oid
            and g.tgname = 'zz_log_shadow_mutation'
            and g.tgenabled <> 'D'
            and g.tgqual is not null
            and g.tgfoid = 'public.log_shadow_mutation()'::regprocedure
            and g.tgtype & 29 = 29
            and g.tgtype & 2 = 0
       )
  loop
    if exists (
      select 1 from pg_catalog.pg_trigger g
       where g.tgrelid = t.oid and g.tgname = 'zz_log_shadow_mutation'
    ) then
      execute format('drop trigger zz_log_shadow_mutation on public.%I', t.relname);
    end if;
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
-- The MC's card counts requests as well as row changes
-- ---------------------------------------------------------------------

-- Service-role server actions leave only a shadow_request row; without
-- it the card said "No changes" for a visit that applied a workflow.
create or replace function public.my_support_access()
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
$$;

revoke all on function public.my_support_access() from public, anon;
grant execute on function public.my_support_access() to authenticated;

-- The count's index predicate follows the two actions it now counts.
drop index if exists public.admin_audit_log_shadow_session_idx;
create index if not exists admin_audit_log_shadow_activity_idx
  on public.admin_audit_log (target_user_id, (details ->> 'shadow_session_id'))
  where action in ('shadow_mutation', 'shadow_request');

select public.ensure_shadow_triggers();
