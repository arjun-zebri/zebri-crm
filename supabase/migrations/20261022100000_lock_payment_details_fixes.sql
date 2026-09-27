-- Payment-details lock: review fixes (Phase 4, Task 23c fix round 1).
--
-- 20261022000000 stays as shipped. This migration:
--
-- 1. Asserts the migration role can UPDATE auth.users (M3). The definer
--    set_my_payment_details() writes auth.users as its owner; without the
--    privilege every bank save would fail at runtime with nothing loud at
--    deploy. Checked first, so the push fails instead.
--
-- 2. get_public_invoice / get_public_proposal read stripe_connect_enabled
--    from app_metadata (I1 part 2). They read the user_metadata copy
--    (the invoice only it, the proposal as a fallback), which an aal1
--    token can rewrite through auth.updateUser: set it false to hide card
--    payment and push couples to bank transfer, or to a non-boolean so
--    the ::boolean cast raised and broke every public invoice of the MC.
--    Now the §7.4 rule: when app_metadata carries the migration sentinel
--    `account_type` (every user since Phase 0.8b), only app_metadata
--    counts; the legacy user_metadata copy is read only for a user
--    without the sentinel. The value is compared as text to 'true', so
--    anything else (false, absent, garbage) is false and never raises.
--    Each body is copied verbatim from pg_get_functiondef on the local
--    database (matching 20260903001000 and 20260925000000); only the
--    stripe_connect_enabled expression changes. Grants are kept by
--    create or replace.
--
-- 3. log_shadow_auth_user_change() counts an ABN change as sensitive
--    (M2), so a shadow session changing it pages Slack like a bank_* or
--    email change. Body copied verbatim from pg_get_functiondef (matching
--    20261020000000); only the sensitive-key predicate changes.
--
-- 4. set_my_payment_details() trims every kind of whitespace (M5), as the
--    TypeScript check does; it used btrim, which trims spaces only, so a
--    pasted value kept a trailing newline or tab. Body copied from
--    20261022000000; only the trim changes.
--
-- 5. Correction to 20261022000000's comment on the trigger (M8): OAuth
--    sign-in DOES rewrite user_metadata (GoTrue merges the provider's
--    claims into it), so the lock function runs then. It passes, because
--    provider claims never carry the protected keys. Password sign-in and
--    token refresh never call it. Also revokes the trigger function's
--    EXECUTE from service_role: Postgres checks EXECUTE on a trigger
--    function only at CREATE TRIGGER, never when it fires, and it cannot
--    be called directly, so this only tidies the ACL.

-- ---------------------------------------------------------------------
-- 1. The migration role must be able to write auth.users
-- ---------------------------------------------------------------------

do $$
begin
  if not has_table_privilege('auth.users', 'UPDATE') then
    raise exception 'lock_payment_details: the migration role (%) cannot UPDATE auth.users; '
                    'set_my_payment_details() would fail on every save', current_user;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. stripe_connect_enabled from app_metadata on the public RPCs
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_public_invoice(token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', i.id,
    'invoice_number', i.invoice_number,
    'title', i.title,
    'status', i.status,
    'subtotal', i.subtotal,
    'tax_rate', i.tax_rate,
    'gst_inclusive', i.gst_inclusive,
    'discount_type', i.discount_type,
    'discount_value', i.discount_value,
    'due_date', i.due_date,
    'payment_terms', i.payment_terms,
    'notes', i.notes,
    'paid_at', i.paid_at,
    'share_token', i.share_token,
    'stripe_payment_enabled', i.stripe_payment_enabled,
    'couple_name', c.name,
    'event_date', c.event_date,
    'venue', c.venue,
    'bank_account_name', (
      select raw_user_meta_data->>'bank_account_name'
      from auth.users where id = i.user_id
    ),
    'bank_bsb', (
      select raw_user_meta_data->>'bank_bsb'
      from auth.users where id = i.user_id
    ),
    'bank_account_number', (
      select raw_user_meta_data->>'bank_account_number'
      from auth.users where id = i.user_id
    ),
    'stripe_connect_enabled', (
      select case
               when raw_app_meta_data ? 'account_type'
                 then coalesce(raw_app_meta_data ->> 'stripe_connect_enabled', '') = 'true'
               else coalesce(raw_user_meta_data ->> 'stripe_connect_enabled', '') = 'true'
             end
      from auth.users where id = i.user_id
    ),
    'items', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', ii.id,
            'description', ii.description,
            'note', ii.note,
            'quantity', ii.quantity,
            'unit_price', ii.unit_price,
            'amount', ii.amount,
            'position', ii.position
          ) order by ii.position
        ),
        '[]'::jsonb
      )
      from invoice_items ii
      where ii.invoice_id = i.id
    ),
    'stages', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'position', s.position,
          'label', s.label,
          'amount_cents', s.amount_cents,
          'due_date', s.due_date,
          'paid_at', s.paid_at
        ) order by s.position
      )
      from public.invoice_payment_stages s
      where s.invoice_id = i.id
    ), '[]'::jsonb),
    'branding_blocks', _user_branding_blocks(i.user_id, 'invoice')
  ) || coalesce(_user_branding(i.user_id), '{}'::jsonb)
  into result
  from invoices i
  join couples c on c.id = i.couple_id
  where i.share_token = token
    and i.share_token_enabled = true;

  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_proposal(token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  result jsonb;
begin
  select id into v_id
  from proposals
  where share_token = token and share_token_enabled = true;

  if v_id is null then
    return null;
  end if;

  update proposals
  set view_count = view_count + 1,
      last_viewed_at = now(),
      first_viewed_at = coalesce(first_viewed_at, now()),
      status = case when status = 'sent' then 'viewed' else status end
  where id = v_id;

  select jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'proposal_number', p.proposal_number,
    'status', p.status,
    'version', p.version,
    'intro_note', p.intro_note,
    'hero_override', p.hero_override,
    'expires_at', p.expires_at,
    'expired', (p.expires_at is not null and p.expires_at < current_date),
    -- An explicit schedule wins outright (ruling W1): the percent is hidden
    -- so the page never shows a deposit the invoice will not carry.
    'deposit_percent', case when p.payment_schedule_id is null then p.deposit_percent else null end,
    'accepted_option_id', p.accepted_option_id,
    'accepted_addon_selection', p.accepted_addon_selection,
    'accepted_at', p.accepted_at,
    'declined_at', p.declined_at,
    'couple_name', c.name,
    'event_date', c.event_date,
    'venue', c.venue,
    'options', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', po.id,
        'position', po.position,
        'title', po.title,
        'description', po.description,
        'pricing_mode', po.pricing_mode,
        'fixed_price', po.fixed_price,
        'gst_inclusive', po.gst_inclusive,
        'weekend_loading_percent', po.weekend_loading_percent,
        'is_popular', po.is_popular,
        'subtotal', po.subtotal,
        'items', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', poi.id,
            'description', poi.description,
            'note', poi.note,
            'amount', poi.amount,
            'quantity', poi.quantity,
            'is_addon', poi.is_addon,
            'default_included', poi.default_included,
            'position', poi.position
          ) order by poi.position), '[]'::jsonb)
          from proposal_option_items poi
          where poi.option_id = po.id
        )
      ) order by po.position), '[]'::jsonb)
      from proposal_options po
      where po.proposal_id = p.id
    ),
    'branding_blocks', _user_branding_blocks(p.user_id, 'proposal'),
    'bank_account_name', (select u.raw_user_meta_data ->> 'bank_account_name' from auth.users u where u.id = p.user_id),
    'bank_bsb', (select u.raw_user_meta_data ->> 'bank_bsb' from auth.users u where u.id = p.user_id),
    'bank_account_number', (select u.raw_user_meta_data ->> 'bank_account_number' from auth.users u where u.id = p.user_id),
    'stripe_connect_enabled', coalesce((
      select case
               when u.raw_app_meta_data ? 'account_type'
                 then coalesce(u.raw_app_meta_data ->> 'stripe_connect_enabled', '') = 'true'
               else coalesce(u.raw_user_meta_data ->> 'stripe_connect_enabled', '') = 'true'
             end
      from auth.users u where u.id = p.user_id
    ), false),
    -- Returned whenever the pointer is set, signed or not, so the server
    -- page can self-heal a signed-but-unfinalized contract (ruling W3b).
    -- Owner-matched: a spoofed pointer must not leak another MC's locked
    -- HTML or their couple's sign token.
    'pending_contract', (
      select jsonb_build_object(
        'sign_token', (select s.sign_token from contract_signers s where s.contract_id = ct.id and s.role = 'client' order by s.signing_order limit 1),
        'contract_number', ct.contract_number,
        'title', ct.title,
        'locked_content_html', ct.locked_content_html,
        'signed_at', ct.signed_at
      )
      from contracts ct where ct.id = p.contract_id and ct.user_id = p.user_id
    ),
    'invoice', (
      select jsonb_build_object(
        'id', i.id,
        'share_token', i.share_token,
        'invoice_number', i.invoice_number,
        'stripe_payment_enabled', i.stripe_payment_enabled,
        'paid_at', i.paid_at,
        'first_stage', (
          select jsonb_build_object('id', s.id, 'label', s.label, 'amount_cents', s.amount_cents, 'due_date', s.due_date, 'paid_at', s.paid_at)
          from invoice_payment_stages s where s.invoice_id = i.id order by s.position limit 1
        )
      )
      from invoices i where i.id = p.invoice_id and i.user_id = p.user_id
    )
  ) || coalesce(_user_branding(p.user_id), '{}'::jsonb)
  into result
  from proposals p
  join couples c on c.id = p.couple_id
  where p.id = v_id;

  return result;
end;
$function$;

-- ---------------------------------------------------------------------
-- 3. ABN is sensitive in the shadow trigger
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_shadow_auth_user_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
       where k like 'user\_metadata.bank\_%' or k in ('user_metadata.abn', 'email', 'email_change')
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
$function$;

-- ---------------------------------------------------------------------
-- 4. set_my_payment_details(): trim all whitespace
-- ---------------------------------------------------------------------

create or replace function public.set_my_payment_details(p_details jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_keys   constant text[] := array['bank_account_name', 'bank_bsb', 'bank_account_number', 'abn'];
  v_uid    uuid := auth.uid();
  v_old    jsonb;
  v_new    jsonb;
  k        text;
  v_val    jsonb;
  v_text   text;
  v_digits text;
begin
  if not public.mfa_satisfied() then
    raise exception using errcode = '42501', message = 'second factor required';
  end if;

  if v_uid is null then
    raise exception using errcode = '42501', message = 'not authenticated';
  end if;

  if p_details is null or jsonb_typeof(p_details) <> 'object' then
    raise exception using errcode = '22023', message = 'payment details must be an object';
  end if;

  select k2 into k
    from jsonb_object_keys(p_details) k2
   where k2 <> all (c_keys)
   limit 1;
  if k is not null then
    raise exception using errcode = '22023', message = format('unknown payment detail: %s', k);
  end if;

  -- Lock the row so two saves in flight merge instead of one losing.
  select u.raw_user_meta_data into v_old
    from auth.users u
   where u.id = v_uid
     for update;
  if not found then
    raise exception using errcode = '42501', message = 'not authenticated';
  end if;
  v_old := case when jsonb_typeof(v_old) = 'object' then v_old else '{}'::jsonb end;
  v_new := v_old;

  for k in select jsonb_object_keys(p_details) loop
    v_val := p_details -> k;
    if jsonb_typeof(v_val) not in ('string', 'null') then
      raise exception using errcode = '22023', message = format('%s must be text', k);
    end if;

    -- Every kind of whitespace at either end (tab, newline, NBSP), as
    -- JavaScript's String.prototype.trim does on the form side.
    v_text := nullif(pg_catalog.regexp_replace(v_val #>> '{}', '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
    if v_text is null then
      v_new := v_new - k;
      continue;
    end if;

    if v_text is distinct from (v_old ->> k) then
      v_digits := pg_catalog.regexp_replace(v_text, '[[:space:]-]', '', 'g');
      if k = 'bank_account_name' and pg_catalog.char_length(v_text) > 200 then
        raise exception using errcode = '22023', message = 'Account name must be 200 characters or fewer';
      elsif k = 'bank_bsb' and v_digits !~ '^[0-9]{6}$' then
        raise exception using errcode = '22023', message = 'BSB must be 6 digits';
      elsif k = 'bank_account_number' and v_digits !~ '^[0-9]{4,10}$' then
        raise exception using errcode = '22023', message = 'Account number must be 4 to 10 digits';
      elsif k = 'abn' and v_digits !~ '^[0-9]{11}$' then
        raise exception using errcode = '22023', message = 'ABN must be 11 digits';
      end if;
    end if;

    v_new := v_new || pg_catalog.jsonb_build_object(k, v_text);
  end loop;

  -- The flag the trigger looks for, on for this one UPDATE only. is_local
  -- (the third argument) scopes it to this transaction, so a pooled
  -- connection never carries it into another request; it is switched
  -- off again straight after, in case a caller composes more statements
  -- into the same transaction.
  perform pg_catalog.set_config('zebri.payment_details_write', 'on', true);
  update auth.users
     set raw_user_meta_data = v_new,
         updated_at = now()
   where id = v_uid;
  perform pg_catalog.set_config('zebri.payment_details_write', 'off', true);

  return pg_catalog.jsonb_build_object(
    'bank_account_name',   v_new ->> 'bank_account_name',
    'bank_bsb',            v_new ->> 'bank_bsb',
    'bank_account_number', v_new ->> 'bank_account_number',
    'abn',                 v_new ->> 'abn'
  );
end;
$$;

comment on function public.lock_payment_details() is
  'BEFORE UPDATE trigger on auth.users: refuses a change to bank_account_name, '
  'bank_bsb, bank_account_number or abn in raw_user_meta_data unless it comes '
  'from set_my_payment_details() (Task 23c). Runs on any user_metadata write, '
  'OAuth sign-in included; password sign-in and refresh never reach it.';

-- ---------------------------------------------------------------------
-- 5. Trigger function ACL
-- ---------------------------------------------------------------------

revoke all on function public.lock_payment_details() from service_role;
