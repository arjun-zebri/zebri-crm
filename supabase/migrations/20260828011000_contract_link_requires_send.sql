-- A contract link is live only once the contract has been sent.
--
-- 20260527000000 made `share_token_enabled` default to true so a link copied
-- from a draft does not 404. That is right for invoices, which render live
-- data, but a contract's body only exists for the couple once `send` freezes
-- it into `locked_content_html`. Serving a draft therefore produced a public
-- page with the header, "No content." and a sign form that `sign_contract`
-- would then refuse (it requires status = 'sent'). contracts.md has always
-- said "draft: no public link"; this makes the RPCs match.
--
-- Both readers gain the same gate. The functions are re-issued in full
-- because plpgsql cannot patch a single predicate.

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
    and c.status <> 'draft'
    and c.status <> 'revoked';

  return result;
end;
$$;

grant execute on function get_public_contract(uuid) to anon;

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
    return jsonb_build_object('ok', false);
  end if;

  -- Only log views of a live contract; a draft or revoked link is not a
  -- document anyone can act on.
  if not exists (
    select 1 from public.contracts
     where id = v_contract_id
       and share_token_enabled = true
       and status <> 'draft'
       and status <> 'revoked'
  ) then
    return jsonb_build_object('ok', false);
  end if;

  -- `signer_name_typed` is reused to record WHICH signer opened it: the audit
  -- table has no signer_id column, and adding one would fork the schema for a
  -- single event type.
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

comment on function public.record_contract_view(uuid, text, text) is
  'Logs a one-time ''viewed'' audit event the first time each signer opens a live contract.';

grant execute on function public.record_contract_view(uuid, text, text) to anon;
