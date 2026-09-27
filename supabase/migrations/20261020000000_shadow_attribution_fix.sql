-- Shadow-mode attribution fix (Phase 4 fix wave, review I2 and M7).
--
-- 1. The after-exit fallback in the auth.users trigger no longer
--    attributes raw_app_meta_data changes. Only the service role can
--    write app_metadata (auth.updateUser cannot), so after exit such a
--    change is always Stripe or an admin tool, never a kept shadow token.
--    user_metadata, email, phone and password changes are still
--    attributed there. During an open session app_metadata changes are
--    still logged (the trail stays whole), but see 2.
-- 2. my_support_access() stops over-counting on the MC's Settings card:
--    - change_count now counts only the record and account changes made
--      through the shadow session, leaving out auth.users rows whose only
--      changed keys are app_metadata (a Stripe webhook during the visit
--      is not something support did);
--    - request_count (new) counts the save or send requests support made
--      through Zebri (shadow_request rows) separately, instead of adding
--      them to the changes. One request that writes through the user
--      client used to count once as a request and again per row.
--    The return type changes, so the function is dropped and recreated;
--    its guard, grants and security posture are unchanged.
--
-- Exit now revokes the target session (app/admin/actions.ts exitShadow),
-- and middleware revokes it when the grant expires, so the fallback in 1
-- fires only for a token copied out of the browser.

-- ---------------------------------------------------------------------
-- 1. auth.users: no app_metadata attribution in the after-exit fallback
-- ---------------------------------------------------------------------

-- Body copied from 20261018000000_shadow_logging_hardening.sql; the only
-- change is the app_metadata branch of the key list, which now requires
-- `not v_after_end`.
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
      -- A shadow session whose auth session is still live after exit or
      -- expiry: only a copied token can reach this now that exit and
      -- expiry revoke the session.
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

    -- Names only, never values. app_metadata is service-role only, so a
    -- change to it after the session ended cannot be the kept token's;
    -- attributing it would page Slack and blame support for Stripe.
    select coalesce(jsonb_agg(k order by k), '[]'::jsonb)
      into v_keys
      from (
        select 'user_metadata.' || key as k
          from (select jsonb_object_keys(v_new_um) union select jsonb_object_keys(v_old_um)) m(key)
         where (v_new_um -> key) is distinct from (v_old_um -> key)
        union all
        select 'app_metadata.' || key
          from (select jsonb_object_keys(v_new_am) union select jsonb_object_keys(v_old_am)) m(key)
         where not v_after_end
           and (v_new_am -> key) is distinct from (v_old_am -> key)
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
-- 2. my_support_access(): changes and requests counted separately
-- ---------------------------------------------------------------------

-- The return type gains request_count, which create or replace cannot
-- do. Dropping a function is not destructive to data.
drop function if exists public.my_support_access();

-- Guard and body otherwise as in 20261019000000_require_mfa_at_database.sql.
create function public.my_support_access()
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
    s.ended_at is not null,
    (
      -- Record and account changes, leaving out auth.users rows that
      -- touched app_metadata only (service-role writes such as Stripe).
      select count(*)
        from public.admin_audit_log l
       where l.target_user_id = s.target_user_id
         and l.action = 'shadow_mutation'
         and (l.details ->> 'shadow_session_id') = s.session_id::text
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
