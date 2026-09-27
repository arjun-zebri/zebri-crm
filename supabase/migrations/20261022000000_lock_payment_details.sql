-- Lock the MC's payment details behind two-factor (Phase 4, Task 23c).
--
-- The hole (Task 23b review I1): the MC's bank details and ABN live in
-- auth.users.raw_user_meta_data, and public invoices and proposals print
-- them for couples to pay into. GoTrue's `PUT /auth/v1/user`
-- (supabase.auth.updateUser({ data })) writes user_metadata for a
-- password-only (aal1) session, and 23b's require_mfa policies cannot see
-- it: GoTrue writes as supabase_auth_admin with no JWT. So a stolen
-- password alone could redirect couples' payments even with 2FA on.
--
-- The fix is a write-path lock (ruling "Task 23c design"). Every reader
-- keeps reading user_metadata unchanged; only the writer moves:
--
-- 1. public.set_my_payment_details(p_details jsonb): the ONLY way to
--    change the protected keys. SECURITY DEFINER, guarded by
--    mfa_satisfied() as its first statement (so an aal1 session of a 2FA
--    MC is refused with 42501, exactly like 23b's guarded RPCs), validates
--    the shape of each changed value, and writes them for auth.uid() with
--    a transaction-local flag set.
-- 2. A BEFORE UPDATE trigger on auth.users that raises 42501 when any
--    protected key's value CHANGES and that flag is not on. GoTrue (user
--    or admin API), and any other writer, is refused; a write that
--    resends the keys unchanged (every profile save spreads the whole
--    metadata) passes untouched.
--
-- Protected keys, as the app and the public RPCs use them:
--   bank_account_name, bank_bsb, bank_account_number, abn
--
-- No service-role path writes these keys (the Stripe webhook and
-- updateEntitlements write app_metadata; the admin profile edit writes
-- display_name and business_name only), so there is no service-role
-- overload. A support fix by hand runs, in one transaction:
--   select set_config('zebri.payment_details_write', 'on', true);
--   update auth.users set raw_user_meta_data = ... where id = ...;
--
-- The existing shadow-logging trigger (zz_log_shadow_auth_user, AFTER
-- UPDATE, 20261017000000 / 20261020000000) still sees the RPC's UPDATE,
-- so a change made through a shadow session is logged and alerted as
-- before. A refused write never reaches it (the BEFORE trigger aborts
-- the statement first), which is right: nothing changed.
--
-- If this is wrong: an MC cannot save bank details or ABN at all (the
-- RPC is the only path), or a GoTrue write that CHANGES a protected key
-- as a side effect (none known) starts failing. Kill switch:
--   drop trigger if exists lock_payment_details on auth.users;

-- ---------------------------------------------------------------------
-- The trigger
-- ---------------------------------------------------------------------

-- SECURITY INVOKER: it reads only OLD, NEW and a GUC, so it needs no
-- privileges, and it runs as whoever updates the row (supabase_auth_admin
-- for GoTrue, postgres for the definer RPC below).
create or replace function public.lock_payment_details()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  c_keys constant text[] := array['bank_account_name', 'bank_bsb', 'bank_account_number', 'abn'];
  v_old  jsonb;
  v_new  jsonb;
  k      text;
begin
  -- Set only inside set_my_payment_details(), transaction-local, so it
  -- cannot outlive that one statement's transaction. The second argument
  -- makes an unset GUC read as null instead of raising; once set in a
  -- session a custom GUC reads '' after its transaction ends, hence the
  -- exact comparison.
  if current_setting('zebri.payment_details_write', true) = 'on' then
    return new;
  end if;

  -- Metadata can be JSON null or a non-object; treat those as empty.
  v_old := case when jsonb_typeof(old.raw_user_meta_data) = 'object' then old.raw_user_meta_data else '{}'::jsonb end;
  v_new := case when jsonb_typeof(new.raw_user_meta_data) = 'object' then new.raw_user_meta_data else '{}'::jsonb end;

  -- An absent key, a JSON null and "" all mean "not set" to every reader
  -- (they use ->> and treat empty as missing), so moving between them is
  -- not a change. GoTrue deletes a key sent as null, and the forms have
  -- always stored "" for a cleared field; without this, the first
  -- profile save after clearing a field would be refused.
  foreach k in array c_keys loop
    if nullif(nullif(v_old -> k, 'null'::jsonb), '""'::jsonb)
       is distinct from
       nullif(nullif(v_new -> k, 'null'::jsonb), '""'::jsonb) then
      raise exception using
        errcode = '42501',
        message = 'payment details can only be changed from Settings',
        detail  = format('user_metadata.%s changed outside set_my_payment_details()', k);
    end if;
  end loop;

  return new;
end;
$$;

comment on function public.lock_payment_details() is
  'BEFORE UPDATE trigger on auth.users: refuses a change to bank_account_name, '
  'bank_bsb, bank_account_number or abn in raw_user_meta_data unless it comes '
  'from set_my_payment_details() (Task 23c).';

revoke all on function public.lock_payment_details() from public, anon, authenticated;

drop trigger if exists lock_payment_details on auth.users;
-- The WHEN clause keeps sign-in and token refresh free: those rewrite
-- last_sign_in_at and the like, never user_metadata, so the function is
-- not even called. Only one BEFORE UPDATE trigger exists on auth.users,
-- and the AFTER triggers are unaffected by a row that passes.
create trigger lock_payment_details
  before update on auth.users
  for each row
  when (old.raw_user_meta_data is distinct from new.raw_user_meta_data)
  execute function public.lock_payment_details();

-- ---------------------------------------------------------------------
-- The writer
-- ---------------------------------------------------------------------

-- p_details is a partial object: only the keys present change, so a form
-- that owns the bank details never touches the ABN and the other way
-- round (a whole-set API would let a stale form revert the other one).
-- A key sent as null or "" is cleared (removed from the metadata, as
-- GoTrue does for null). Returns all four values after the write.
--
-- Validation follows the forms' placeholders ("062-000",
-- "00 000 000 000"): spaces and hyphens are allowed as separators and
-- the value is stored as typed (trimmed), so every reader prints what
-- the MC entered. A value equal to the one already stored is not
-- re-checked, so an older value that predates these rules never blocks
-- a save of a different field.
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

    v_text := nullif(pg_catalog.btrim(v_val #>> '{}'), '');
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

comment on function public.set_my_payment_details(jsonb) is
  'The only writer of the MC''s bank details and ABN in user_metadata. Guarded by '
  'mfa_satisfied(); partial (only keys present change; null or "" clears); returns '
  'all four values (Task 23c).';

revoke all on function public.set_my_payment_details(jsonb) from public, anon, service_role;
grant execute on function public.set_my_payment_details(jsonb) to authenticated;
