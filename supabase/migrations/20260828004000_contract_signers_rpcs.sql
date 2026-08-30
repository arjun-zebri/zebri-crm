-- Phase 5 of the contracts audit remediation: make the public signing RPCs
-- per-signer, so each party signs with their own link and the contract only
-- completes when everyone required has signed.
--
-- Token resolution accepts EITHER:
--   * a contract_signers.sign_token, the new per-signer link, or
--   * a contracts.share_token, the legacy single link.
-- Contracts already in flight therefore keep working; the legacy link is
-- treated as "whoever holds it is the first client signer still outstanding".
--
-- Non-destructive: no drops, no column changes.

-- ── Every contract gets a signer roster ─────────────────────────────────
-- Seeding in the database rather than the app guarantees the invariant that
-- the RPCs below depend on: a contract always has at least one client signer,
-- no matter which code path created it.
create or replace function public.seed_contract_signers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple record;
begin
  select name, primary_name, primary_email, secondary_name, secondary_email, email
    into v_couple
    from public.couples
   where id = new.couple_id;

  if v_couple is null then
    return new;
  end if;

  insert into public.contract_signers (contract_id, user_id, role, name, email, signing_order, required)
  values (
    new.id, new.user_id, 'client',
    coalesce(nullif(btrim(v_couple.primary_name), ''), nullif(btrim(v_couple.name), ''), 'Client'),
    coalesce(nullif(btrim(v_couple.primary_email), ''), v_couple.email),
    1, true
  );

  -- The second partner is only a signer when the couple record names them.
  if nullif(btrim(v_couple.secondary_name), '') is not null then
    insert into public.contract_signers (contract_id, user_id, role, name, email, signing_order, required)
    values (
      new.id, new.user_id, 'client',
      btrim(v_couple.secondary_name),
      nullif(btrim(v_couple.secondary_email), ''),
      2, true
    );
  end if;

  return new;
end;
$$;

drop trigger if exists contracts_seed_signers on public.contracts;
create trigger contracts_seed_signers
  after insert on public.contracts
  for each row execute function public.seed_contract_signers();

-- ── Token resolution ────────────────────────────────────────────────────
-- Returns the contract and, when the caller presented a per-signer token, the
-- signer it belongs to. For a legacy share_token the signer is the lowest
-- ordered required client who has not signed or declined yet.
create or replace function public._resolve_contract_token(p_token uuid)
returns table (contract_id uuid, signer_id uuid, is_legacy boolean)
language sql
stable
security definer
set search_path = public
as $$
  select s.contract_id, s.id, false
    from public.contract_signers s
   where s.sign_token = p_token
  union all
  select c.id, (
      select s2.id
        from public.contract_signers s2
       where s2.contract_id = c.id
         and s2.role = 'client'
         and s2.required
         and s2.signed_at is null
         and s2.declined_at is null
       order by s2.signing_order
       limit 1
    ), true
    from public.contracts c
   where c.share_token = p_token
     and not exists (select 1 from public.contract_signers s3 where s3.sign_token = p_token)
  limit 1;
$$;

-- ── get_public_contract ─────────────────────────────────────────────────
-- Now resolves either token and returns the signer roster so the page can
-- show progress. Sign tokens are deliberately NOT included: each is a bearer
-- credential for that person's signature.
create or replace function get_public_contract(token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result      jsonb;
  v_contract  uuid;
  v_signer    uuid;
begin
  select r.contract_id, r.signer_id into v_contract, v_signer
    from public._resolve_contract_token(token) r;

  if v_contract is null then
    return null;
  end if;

  select jsonb_build_object(
    'id', c.id,
    'title', c.title,
    'contract_number', c.contract_number,
    'status', c.status,
    'locked_content_html', c.locked_content_html,
    'expires_at', c.expires_at,
    'signed_at', c.signed_at,
    'signer_name', c.signer_name,
    'signer_ip', c.signer_ip,
    'signer_user_agent', c.signer_user_agent,
    'declined_at', c.declined_at,
    'declined_reason', c.declined_reason,
    'mc_signature_name', c.mc_signature_name,
    'email_sent_at', c.email_sent_at,
    'couple_name', cp.name,
    'event_date', cp.event_date,
    'venue', cp.venue,
    'branding_blocks', _user_branding_blocks(c.user_id, 'contract'),
    -- Which signer this link belongs to; null on a legacy link with every
    -- signer already done.
    'viewer_signer_id', v_signer,
    'signers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id,
               'role', s.role,
               'name', s.name,
               'signing_order', s.signing_order,
               'required', s.required,
               'signed_at', s.signed_at,
               'declined_at', s.declined_at
             ) order by s.signing_order, s.created_at)
        from public.contract_signers s
       where s.contract_id = c.id
    ), '[]'::jsonb)
  ) || coalesce(_user_branding(c.user_id), '{}'::jsonb)
  into result
  from contracts c
  join couples cp on cp.id = c.couple_id
  where c.id = v_contract
    and c.share_token_enabled = true
    and c.status <> 'revoked';

  return result;
end;
$$;

grant execute on function get_public_contract(uuid) to anon;

-- ── sign_contract ───────────────────────────────────────────────────────
-- Marks ONE signer. The contract flips to 'signed' only once every required
-- signer is done.
create or replace function public.sign_contract(
  token uuid,
  p_signer_name text,
  p_signer_ip text,
  p_signer_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract   record;
  v_signer     record;
  v_contract_id uuid;
  v_signer_id  uuid;
  v_now        timestamptz := now();
  v_outstanding int;
begin
  select r.contract_id, r.signer_id into v_contract_id, v_signer_id
    from public._resolve_contract_token(token) r;

  if v_contract_id is null then
    return jsonb_build_object('error', 'not_found_or_not_sent');
  end if;

  select * into v_contract
    from public.contracts
   where id = v_contract_id
     and share_token_enabled = true
     and status = 'sent'
     for update;

  if v_contract is null then
    return jsonb_build_object('error', 'not_found_or_not_sent');
  end if;

  if v_contract.expires_at is not null and v_contract.expires_at < current_date then
    update public.contracts set status = 'expired' where id = v_contract.id;
    return jsonb_build_object('error', 'expired');
  end if;

  if v_signer_id is null then
    -- A legacy link whose signers have all signed already.
    return jsonb_build_object('error', 'already_signed');
  end if;

  select * into v_signer
    from public.contract_signers
   where id = v_signer_id
     for update;

  if v_signer.signed_at is not null then
    return jsonb_build_object('error', 'already_signed');
  end if;
  if v_signer.declined_at is not null then
    return jsonb_build_object('error', 'already_declined');
  end if;

  -- Audit row first: it survives any later revoke.
  perform public.emit_contract_audit_event(
    p_contract_id := v_contract.id,
    p_event_type := 'signed',
    p_actor := case when v_signer.role = 'vendor' then 'mc' else 'couple' end,
    p_actor_ip := p_signer_ip,
    p_actor_user_agent := p_signer_user_agent,
    p_signer_name_typed := p_signer_name
  );

  update public.contract_signers
     set signed_at = v_now,
         signer_name_typed = p_signer_name,
         signer_ip = p_signer_ip,
         signer_user_agent = p_signer_user_agent
   where id = v_signer_id;

  -- Mirror the latest CLIENT signature onto the contract row. These columns
  -- are the denormalised fast path the PDF and status banner still read.
  if v_signer.role = 'client' then
    update public.contracts
       set signer_name = p_signer_name,
           signer_ip = p_signer_ip,
           signer_user_agent = p_signer_user_agent
     where id = v_contract.id;
  end if;

  select count(*) into v_outstanding
    from public.contract_signers
   where contract_id = v_contract.id
     and required
     and signed_at is null;

  if v_outstanding > 0 then
    -- Still waiting on somebody; the contract stays 'sent'.
    return jsonb_build_object(
      'ok', true, 'contract_id', v_contract.id,
      'complete', false, 'outstanding', v_outstanding
    );
  end if;

  update public.contracts
     set status = 'signed',
         signed_at = v_now
   where id = v_contract.id;

  update public.couples
     set status = 'confirmed'
   where id = v_contract.couple_id and status in ('lead', 'enquiry', 'quoted');

  insert into public.tasks (user_id, related_couple_id, title, status)
  values (
    v_contract.user_id, v_contract.couple_id,
    'Contract signed - follow up with couple',
    'todo'
  );

  return jsonb_build_object(
    'ok', true, 'contract_id', v_contract.id, 'complete', true, 'outstanding', 0
  );
end;
$$;

grant execute on function public.sign_contract(uuid, text, text, text) to anon;

-- ── decline_contract ────────────────────────────────────────────────────
-- One client declining ends the contract for everyone: there is no version of
-- this agreement that binds only half a couple.
-- Defaults on the last two params are preserved from the existing signature:
-- `create or replace` cannot drop them, and an older caller may omit them.
create or replace function public.decline_contract(
  token uuid,
  p_reason text,
  p_actor_ip text default null,
  p_actor_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract    record;
  v_contract_id uuid;
  v_signer_id   uuid;
  v_now         timestamptz := now();
begin
  select r.contract_id, r.signer_id into v_contract_id, v_signer_id
    from public._resolve_contract_token(token) r;

  if v_contract_id is null then
    return jsonb_build_object('error', 'not_found_or_not_sent');
  end if;

  select * into v_contract
    from public.contracts
   where id = v_contract_id
     and share_token_enabled = true
     and status = 'sent'
     for update;

  if v_contract is null then
    return jsonb_build_object('error', 'not_found_or_not_sent');
  end if;

  perform public.emit_contract_audit_event(
    p_contract_id := v_contract.id,
    p_event_type := 'declined',
    p_actor := 'couple',
    p_actor_ip := p_actor_ip,
    p_actor_user_agent := p_actor_user_agent,
    p_decline_reason := p_reason
  );

  if v_signer_id is not null then
    update public.contract_signers
       set declined_at = v_now,
           declined_reason = p_reason,
           signer_ip = p_actor_ip,
           signer_user_agent = p_actor_user_agent
     where id = v_signer_id;
  end if;

  update public.contracts
     set status = 'declined',
         declined_at = v_now,
         declined_reason = p_reason
   where id = v_contract.id;

  insert into public.tasks (user_id, related_couple_id, title, status)
  values (
    v_contract.user_id, v_contract.couple_id,
    'Contract declined - follow up with couple',
    'todo'
  );

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.decline_contract(uuid, text, text, text) to anon;

-- ── revoke_contract ─────────────────────────────────────────────────────
-- Revoking must also clear any PARTIAL signatures and reissue every per-signer
-- token, otherwise partner A's signature would silently carry over onto a
-- contract whose wording has since changed, and their old link would still work.
create or replace function public.revoke_contract(p_contract_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from public.contracts where id = p_contract_id;

  if v_status is null then
    return '{"error":"not_found"}'::jsonb;
  end if;

  if v_status = 'signed' then
    return '{"error":"already_signed"}'::jsonb;
  end if;

  perform public.emit_contract_audit_event(
    p_contract_id := p_contract_id,
    p_event_type := 'revoked',
    p_actor := 'mc',
    p_revoked_from_status := v_status
  );

  update public.contracts
  set status = 'draft',
      share_token = gen_random_uuid(),
      share_token_enabled = true,
      locked_content = null,
      locked_content_html = null,
      mc_signature_name = null,
      email_sent_at = null,
      last_reminder_at = null,
      signed_at = null,
      signer_name = null,
      signer_ip = null,
      signer_user_agent = null,
      version = coalesce(version, 0) + 1,
      updated_at = now()
  where id = p_contract_id;

  update public.contract_signers
  set signed_at = null,
      signer_name_typed = null,
      signer_ip = null,
      signer_user_agent = null,
      declined_at = null,
      declined_reason = null,
      sign_token = gen_random_uuid()
  where contract_id = p_contract_id;

  return '{"success":true}'::jsonb;
end;
$$;
