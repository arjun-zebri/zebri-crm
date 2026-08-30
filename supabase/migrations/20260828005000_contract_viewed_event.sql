-- Record when a contract is first opened.
--
-- `contract_audit_log` has allowed a 'viewed' event_type since
-- 20260528000000, but nothing ever wrote one, so the trail could show a
-- contract signed with no evidence it was ever read. "Opened on <date>" is
-- standard in an e-signature audit trail and is the thing most often asked
-- for when a signatory later claims they never saw the terms.
--
-- Written at most once per signer (or once per contract for a legacy share
-- link) so a couple refreshing the page does not flood the log.

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
