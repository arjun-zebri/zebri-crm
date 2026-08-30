-- A revoked contract must not stay reachable by its links.
--
-- `revoke_contract` reset a contract to 'draft', nulled `locked_content_html`
-- and reissued every signer token, but left `share_token_enabled = true`. Any
-- signer link (old or new) therefore opened a live page with an EMPTY body:
-- header, roster and the sign form rendered around "No content." Signing was
-- never possible (sign_contract requires status = 'sent'), so this leaked an
-- incomplete document rather than a signature, but a couple opening a stale
-- link saw a blank agreement bearing the supplier's name.
--
-- The send route sets share_token_enabled = true when it locks the body, so
-- the link goes live again exactly when there is content behind it.
--
-- Non-destructive: recreates one owner-only RPC.

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
      -- Off until the next send locks a body behind it.
      share_token_enabled = false,
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
