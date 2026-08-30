-- Name both partners on a sent contract.
--
-- `get_public_contract` returned `couples.name`, the legacy couple-level
-- column, which in practice is often just one partner's first name ("Arjun").
-- That is fine as a list label but wrong on a service agreement, where the
-- couple are a named party and the document should say in full who is bound.
--
-- The real names have lived in `primary_name` / `secondary_name` since
-- 20260603000000. This composes them and falls back to the legacy column only
-- when neither is captured, mirroring `coupleDisplayName()` in
-- lib/couples/display-name.ts so the public header and the `{{couple_name}}`
-- variable cannot drift.
--
-- Non-destructive: recreates one read-only RPC.

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
    -- Both partners in full. The legacy `couples.name` column is often one
    -- partner's first name, which is not who the agreement binds. Mirrors
    -- coupleDisplayName() in lib/couples/display-name.ts.
    'couple_name', coalesce(
      nullif(
        concat_ws(
          ' and ',
          nullif(btrim(cp.primary_name), ''),
          nullif(btrim(cp.secondary_name), '')
        ),
        ''
      ),
      nullif(btrim(cp.name), '')
    ),
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
