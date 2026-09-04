-- Issue signing codes for a draft contract, not just a sent one.
--
-- 20260903006000 ("a contract's link works from the moment the contract
-- exists") took the draft gate off every public contract RPC it knew about.
-- issue_signer_otp was defined in 20260903004000, two files earlier, and was
-- missed. The result is a dead end that only appears when signer verification
-- is switched on: get_public_contract serves the draft, the signing dialog
-- opens, sign_contract_v2 is willing to accept the signature, and the code the
-- signer needs to get that far can never be issued.
--
-- Rebuilt from 20260903004000 with the status predicate widened to match its
-- siblings. Nothing else about the function changes.

create or replace function public.issue_signer_otp(
  p_token uuid,
  p_code_hash text,
  p_code_salt text,
  p_ttl_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract_id uuid;
  v_signer_id   uuid;
  v_signer      record;
  v_contract    record;
  v_existing    record;
  v_id          uuid;
begin
  select r.contract_id, r.signer_id into v_contract_id, v_signer_id
    from public._resolve_contract_token(p_token) r;

  if v_contract_id is null or v_signer_id is null then
    return jsonb_build_object('error', 'not_found');
  end if;

  select * into v_contract
    from public.contracts
   -- Draft is not a gate on the public surface. 20260903006000 removed that
   -- predicate from get_public_contract, record_contract_view, sign_contract_v2
   -- and decline_contract_v2, but this function was written two files earlier
   -- and kept it, so a draft with signer verification on served a signing page
   -- whose code could never be issued: the signer sat on "not active" forever
   -- while sign_contract_v2 would happily have accepted their signature.
   -- Revoked is still refused, and share_token_enabled still governs access.
   where id = v_contract_id and share_token_enabled = true and status <> 'revoked';
  if v_contract is null then
    return jsonb_build_object('error', 'not_found');
  end if;

  select * into v_signer from public.contract_signers where id = v_signer_id;
  if v_signer is null then
    return jsonb_build_object('error', 'not_found');
  end if;

  -- Verification off for this contract: nothing to issue, and the caller is
  -- told not to gate the form.
  if not v_contract.require_signer_otp then
    return jsonb_build_object('ok', true, 'required', false);
  end if;

  -- No address on file. Never lock a signer out of a contract because the MC
  -- left the email field blank: the form stays open.
  if nullif(btrim(coalesce(v_signer.email, '')), '') is null then
    return jsonb_build_object('ok', true, 'required', false, 'reason', 'no_email');
  end if;

  -- A live, unconsumed, unlocked code already exists: return it rather than
  -- issuing another. This is what makes "request on page open" safe against a
  -- refresh loop turning into a mail cannon.
  select * into v_existing
    from public.contract_signer_otps
   where signer_id = v_signer_id
     and consumed_at is null
     and expires_at > now()
     and (locked_until is null or locked_until <= now())
   order by created_at desc
   limit 1;

  if v_existing is not null then
    return jsonb_build_object(
      'ok', true, 'required', true, 'reissued', false,
      'otp_id', v_existing.id, 'expires_at', v_existing.expires_at,
      'email', v_signer.email, 'name', v_signer.name
    );
  end if;

  -- Supersede anything stale so only the newest code can ever be used.
  update public.contract_signer_otps
     set consumed_at = now()
   where signer_id = v_signer_id and consumed_at is null;

  insert into public.contract_signer_otps (
    signer_id, contract_id, user_id, code_hash, code_salt, expires_at
  )
  values (
    v_signer_id, v_contract_id, v_contract.user_id, p_code_hash, p_code_salt,
    now() + make_interval(secs => p_ttl_seconds)
  )
  returning id into v_id;

  return jsonb_build_object(
    'ok', true, 'required', true, 'reissued', true,
    'otp_id', v_id, 'expires_at', now() + make_interval(secs => p_ttl_seconds),
    'email', v_signer.email, 'name', v_signer.name
  );
end;
$$;

revoke all on function public.issue_signer_otp(uuid, text, text, integer) from public;
revoke all on function public.issue_signer_otp(uuid, text, text, integer) from anon;
revoke all on function public.issue_signer_otp(uuid, text, text, integer) from authenticated;
grant execute on function public.issue_signer_otp(uuid, text, text, integer) to service_role;
