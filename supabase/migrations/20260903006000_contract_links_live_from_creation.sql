-- A contract's link works from the moment the contract exists.
--
-- 20260828011000 made the public RPCs refuse a draft. The reasoning was sound
-- at the time: a draft had no `locked_content_html`, so serving it produced a
-- page with a header, the words "No content." and a sign form that
-- `sign_contract` would then refuse anyway.
--
-- But the rule solved the symptom. The real problem was that rendering the
-- body was welded to emailing the couple, so an MC who wanted to hand the link
-- over themselves (a text, a DM, in person) had no way to do it. There is no
-- meaningful "live vs not live" state for an MC to reason about, and having
-- one produced a dead link with no explanation.
--
-- The body is now rendered on every save (see lib/contracts/publish), so a
-- draft always HAS a snapshot to serve. With that, the draft gate has nothing
-- left to protect and comes off:
--
--   * get_public_contract    - serve drafts
--   * record_contract_view   - log views of drafts
--   * sign_contract_v2       - allow signing a draft, flipping it to 'sent' as
--                              the first signature lands, because a contract
--                              somebody has signed is self-evidently issued
--
-- `status` keeps its meaning for the MC: 'draft' is "still editable". It is no
-- longer a gate on the public surface.
--
-- Revoked contracts are still refused, and `share_token_enabled` still governs
-- access, so an MC can pull a link at any time.

-- ── get_public_contract ─────────────────────────────────────────────────
-- Rebuilt from 20260903005000, minus the draft predicate.
create or replace function get_public_contract(token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract uuid;
  v_signer   uuid;
  result     jsonb;
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
    'viewer_signer_id', v_signer,
    'signing_mode', c.signing_mode,
    'require_signer_otp', c.require_signer_otp,
    'document_hash', c.document_hash,
    'document_hash_algo', c.document_hash_algo,
    'document_hash_at', c.document_hash_at,
    'viewer_otp_verified', (
      select s.otp_verified_at is not null
         and s.otp_verified_at >= now() - interval '30 minutes'
        from public.contract_signers s
       where s.id = v_signer
    ),
    'audit_trail', case
      when c.status in ('signed', 'declined') then coalesce((
        select jsonb_agg(jsonb_build_object(
                 'event_type', a.event_type,
                 'actor', a.actor,
                 'event_at', a.event_at,
                 'signer_name_typed', a.signer_name_typed,
                 'decline_reason', a.decline_reason,
                 'reminder_number', a.reminder_number,
                 'actor_ip_prefix', public._ip_prefix(a.actor_ip),
                 'actor_user_agent', a.actor_user_agent
               ) order by a.event_at, a.id)
          from public.contract_audit_log a
         where a.contract_id = c.id
      ), '[]'::jsonb)
      else null
    end,
    'signers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id,
               'role', s.role,
               'name', s.name,
               'signer_name_typed', s.signer_name_typed,
               'signature_mode', s.signature_mode,
               'signature_image', s.signature_image,
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

-- ── record_contract_view ────────────────────────────────────────────────
-- Rebuilt from 20260903000000, minus the draft predicate: a view of a draft is
-- still a view, and the trail should say so.
create or replace function public.record_contract_view(
  token uuid,
  p_actor_ip text default null,
  p_actor_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract_id uuid;
  v_signer_id   uuid;
  v_name        text;
  v_already     boolean;
begin
  select r.contract_id, r.signer_id into v_contract_id, v_signer_id
    from public._resolve_contract_token(token) r;

  if v_contract_id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_token');
  end if;

  if not exists (
    select 1 from public.contracts
     where id = v_contract_id
       and share_token_enabled = true
       and status <> 'revoked'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not_live');
  end if;

  select name into v_name from public.contract_signers where id = v_signer_id;

  select exists (
    select 1 from public.contract_audit_log
     where contract_id = v_contract_id
       and event_type = 'viewed'
       and coalesce(signer_name_typed, '') = coalesce(v_name, '')
  ) into v_already;

  if v_already then
    return jsonb_build_object('ok', true, 'logged', false);
  end if;

  perform public.emit_contract_audit_event(
    p_contract_id := v_contract_id,
    p_event_type := 'viewed',
    p_actor := 'couple',
    p_actor_ip := p_actor_ip,
    p_actor_user_agent := p_actor_user_agent,
    p_signer_name_typed := v_name
  );

  return jsonb_build_object('ok', true, 'logged', true);
end;
$$;

grant execute on function public.record_contract_view(uuid, text, text) to anon;

-- ── sign_contract_v2 ────────────────────────────────────────────────────
-- Rebuilt from 20260903005000. A draft is now signable, and the first
-- signature flips it out of draft: once somebody has signed, the MC must not
-- keep editing the terms underneath them.
create or replace function public.sign_contract_v2(
  p_token uuid,
  p_payload jsonb
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
  v_next_id    uuid;
  v_signer_name       text := p_payload ->> 'signer_name';
  v_signer_ip         text := p_payload ->> 'signer_ip';
  v_signer_user_agent text := p_payload ->> 'signer_user_agent';
  v_signature_image   text := p_payload ->> 'signature_image';
  v_signature_mode    text := coalesce(p_payload ->> 'signature_mode', 'typed');
begin
  select r.contract_id, r.signer_id into v_contract_id, v_signer_id
    from public._resolve_contract_token(p_token) r;

  if v_contract_id is null then
    return jsonb_build_object('error', 'not_found_or_not_sent');
  end if;

  select * into v_contract
    from public.contracts
   where id = v_contract_id
     and share_token_enabled = true
     and status in ('draft', 'sent')
     for update;

  if v_contract is null then
    return jsonb_build_object('error', 'not_found_or_not_sent');
  end if;

  -- Nothing to sign. A contract whose body has never been rendered would have
  -- the signer agreeing to a blank page.
  if nullif(btrim(coalesce(v_contract.locked_content_html, '')), '') is null then
    return jsonb_build_object('error', 'not_found_or_not_sent');
  end if;

  if v_contract.expires_at is not null and v_contract.expires_at < current_date then
    update public.contracts set status = 'expired' where id = v_contract.id;
    return jsonb_build_object('error', 'expired');
  end if;

  if v_signer_id is null then
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

  if v_contract.signing_mode = 'sequential' and v_signer.role = 'client' then
    if exists (
      select 1 from public.contract_signers s
       where s.contract_id = v_contract.id
         and s.role = 'client'
         and s.required
         and s.signed_at is null
         and s.declined_at is null
         and s.signing_order < v_signer.signing_order
    ) then
      return jsonb_build_object('error', 'not_your_turn');
    end if;
  end if;

  if v_contract.require_signer_otp and v_signer.role = 'client' then
    if v_signer.otp_verified_at is null
       or v_signer.otp_verified_at < now() - interval '30 minutes' then
      return jsonb_build_object('error', 'otp_required');
    end if;
  end if;

  if v_signature_mode = 'drawn' then
    if v_signature_image is null or v_signature_image !~ '^data:image/png;base64,' then
      return jsonb_build_object('error', 'signature_invalid');
    end if;
    if length(v_signature_image) > 131072 then
      return jsonb_build_object('error', 'signature_too_large');
    end if;
  else
    v_signature_image := null;
    v_signature_mode := 'typed';
  end if;

  perform public.emit_contract_audit_event(
    p_contract_id := v_contract.id,
    p_event_type := 'signed',
    p_actor := case when v_signer.role = 'vendor' then 'mc' else 'couple' end,
    p_actor_ip := v_signer_ip,
    p_actor_user_agent := v_signer_user_agent,
    p_signer_name_typed := v_signer_name
  );

  update public.contract_signers
     set signed_at = v_now,
         signer_name_typed = v_signer_name,
         signer_ip = v_signer_ip,
         signer_user_agent = v_signer_user_agent,
         signature_mode = v_signature_mode,
         signature_image = v_signature_image
   where id = v_signer_id;

  if v_signer.role = 'client' then
    update public.contracts
       set signer_name = v_signer_name,
           signer_ip = v_signer_ip,
           signer_user_agent = v_signer_user_agent
     where id = v_contract.id;
  end if;

  select count(*) into v_outstanding
    from public.contract_signers
   where contract_id = v_contract.id
     and required
     and signed_at is null;

  if v_outstanding > 0 then
    -- Someone has signed, so the terms are settled: leave draft behind even
    -- though the contract is not complete.
    if v_contract.status = 'draft' then
      update public.contracts
         set status = 'sent',
             email_sent_at = coalesce(email_sent_at, v_now)
       where id = v_contract.id;
    end if;

    if v_contract.signing_mode = 'sequential' then
      select s.id into v_next_id
        from public.contract_signers s
       where s.contract_id = v_contract.id
         and s.role = 'client'
         and s.required
         and s.signed_at is null
         and s.declined_at is null
       order by s.signing_order
       limit 1;
    end if;

    return jsonb_build_object(
      'ok', true, 'contract_id', v_contract.id,
      'complete', false, 'outstanding', v_outstanding,
      'next_signer_id', v_next_id
    );
  end if;

  update public.contracts
     set status = 'signed',
         signed_at = v_now,
         email_sent_at = coalesce(email_sent_at, v_now),
         document_hash = encode(
           sha256(convert_to(public._contract_canonical_payload(v_contract.id), 'UTF8')), 'hex'),
         document_hash_algo = 'zebri-sha256-v1',
         document_hash_at = v_now
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

grant execute on function public.sign_contract_v2(uuid, jsonb) to anon;

-- ── decline_contract_v2 ─────────────────────────────────────────────────
-- Same reasoning: a couple who has been given a link can decline from it.
-- Rebuilt from 20260903000000, with the status predicate widened.
create or replace function public.decline_contract_v2(
  p_token uuid,
  p_payload jsonb
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
  v_reason           text := p_payload ->> 'reason';
  v_actor_ip         text := p_payload ->> 'actor_ip';
  v_actor_user_agent text := p_payload ->> 'actor_user_agent';
begin
  select r.contract_id, r.signer_id into v_contract_id, v_signer_id
    from public._resolve_contract_token(p_token) r;

  if v_contract_id is null then
    return jsonb_build_object('error', 'not_found_or_not_sent');
  end if;

  select * into v_contract
    from public.contracts
   where id = v_contract_id
     and share_token_enabled = true
     and status in ('draft', 'sent')
     for update;

  if v_contract is null then
    return jsonb_build_object('error', 'not_found_or_not_sent');
  end if;

  perform public.emit_contract_audit_event(
    p_contract_id := v_contract.id,
    p_event_type := 'declined',
    p_actor := 'couple',
    p_actor_ip := v_actor_ip,
    p_actor_user_agent := v_actor_user_agent,
    p_decline_reason := v_reason
  );

  if v_signer_id is not null then
    update public.contract_signers
       set declined_at = v_now,
           declined_reason = v_reason,
           signer_ip = v_actor_ip,
           signer_user_agent = v_actor_user_agent
     where id = v_signer_id;
  end if;

  update public.contracts
     set status = 'declined',
         declined_at = v_now,
         declined_reason = v_reason
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

grant execute on function public.decline_contract_v2(uuid, jsonb) to anon;

-- Backfill: every existing draft gets its link working. `locked_content_html`
-- cannot be rendered in SQL (merge-field substitution lives in TypeScript), so
-- drafts that have never been saved since this change still have no body; the
-- next save publishes them. Enabling the token is safe either way, since the
-- sign path refuses a contract with no body.
update public.contracts
   set share_token_enabled = true
 where status = 'draft'
   and share_token_enabled = false;
