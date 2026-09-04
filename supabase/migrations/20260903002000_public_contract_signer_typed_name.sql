-- Expose each signer's TYPED name on the public contract payload.
--
-- The contract page is gaining a per-party signature panel (one block per
-- party in Branding: the supplier, the primary contact, the secondary
-- contact). Each panel prints that party's signature, and a signature is the
-- name the person actually typed when they signed, not the roster name the MC
-- put on the contract beforehand.
--
-- Those differ often enough to matter: the roster carries "Sarah" from the
-- couple record while the signature reads "Sarah Ellen Mitchell". Printing the
-- roster name in a signature slot would show a mark the signer never made.
--
-- `signer_name_typed` is already captured by sign_contract_v2 and is already
-- readable by the contract owner; this only adds it to the token-gated public
-- payload, alongside the signed_at / declined_at that were already there. Note
-- `sign_token` remains deliberately excluded from the signers array: each is a
-- bearer credential for that person's signature.
--
-- Re-declared from the live definition at
-- 20260828011000_contract_link_requires_send.sql:14-80. Additive; nothing else
-- changes.

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
    -- Which signer this link belongs to; null on a legacy link with every
    -- signer already done.
    'viewer_signer_id', v_signer,
    'signers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id,
               'role', s.role,
               'name', s.name,
               -- What they actually typed when signing. Null until they sign.
               'signer_name_typed', s.signer_name_typed,
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
