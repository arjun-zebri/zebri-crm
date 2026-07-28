-- sign_contract: auto-deposit-invoice from a linked ACCEPTED PROPOSAL.
--
-- Contracts can now link to a proposal (contracts.proposal_id, added
-- in 20260710000000). When the couple signs and the linked proposal
-- is accepted, the deposit invoice is generated from the RECORDED
-- selection: subtotal = the accepted option + ticked add-ons total
-- already denormalised onto proposals.subtotal, and the deposit uses
-- the accepted option's own deposit_percent (falling back to 25%).
--
-- The legacy quote branch is kept verbatim until the quote-removal
-- migration drops it. Not destructive — function replacement only.

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
  v_contract record;
  v_now timestamptz := now();
  v_invoice_id uuid;
  v_proposal record;
  v_deposit_pct numeric;
begin
  select * into v_contract
  from public.contracts
  where share_token = token
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

  -- Audit row first — survives any later revoke.
  perform public.emit_contract_audit_event(
    p_contract_id := v_contract.id,
    p_event_type := 'signed',
    p_actor := 'couple',
    p_actor_ip := p_signer_ip,
    p_actor_user_agent := p_signer_user_agent,
    p_signer_name_typed := p_signer_name
  );

  update public.contracts
  set status = 'signed',
      signed_at = v_now,
      signer_name = p_signer_name,
      signer_ip = p_signer_ip,
      signer_user_agent = p_signer_user_agent
  where id = v_contract.id;

  -- Update couple status to 'confirmed' on first signed contract.
  update public.couples
  set status = 'confirmed'
  where id = v_contract.couple_id and status in ('lead', 'enquiry', 'quoted');

  -- Auto-create a deposit invoice from the linked ACCEPTED PROPOSAL
  -- (preferred — the recorded agreement, terms included).
  if v_contract.proposal_id is not null then
    select p.*, po.deposit_percent as option_deposit_percent
    into v_proposal
    from public.proposals p
    left join public.proposal_options po on po.id = p.accepted_option_id
    where p.id = v_contract.proposal_id and p.status = 'accepted';

    if found then
      select id into v_invoice_id
      from public.invoices
      where proposal_id = v_contract.proposal_id;

      if v_invoice_id is null then
        v_deposit_pct := coalesce(v_proposal.option_deposit_percent, 25);
        insert into public.invoices (
          user_id, couple_id, proposal_id, title, status,
          invoice_number, subtotal, deposit_percent,
          share_token, share_token_enabled
        ) values (
          v_proposal.user_id,
          v_proposal.couple_id,
          v_proposal.id,
          'Deposit invoice for ' || coalesce(v_proposal.title, v_proposal.proposal_number),
          'draft',
          public.generate_invoice_number(v_proposal.user_id),
          round(v_proposal.subtotal * v_deposit_pct / 100, 2),
          v_deposit_pct,
          gen_random_uuid(),
          true
        ) returning id into v_invoice_id;
      end if;
    end if;
  -- Legacy: linked accepted quote (removed with the quotes feature).
  elsif v_contract.quote_id is not null then
    select id into v_invoice_id
    from public.invoices
    where quote_id = v_contract.quote_id;

    if v_invoice_id is null then
      insert into public.invoices (
        user_id, couple_id, quote_id, title, status,
        invoice_number, subtotal, share_token, share_token_enabled
      )
      select
        q.user_id, q.couple_id, q.id,
        'Deposit invoice for ' || coalesce(q.title, q.quote_number),
        'draft',
        public.generate_invoice_number(q.user_id),
        round(q.subtotal * 0.25, 2),
        gen_random_uuid(),
        true
      from public.quotes q
      where q.id = v_contract.quote_id and q.status = 'accepted'
      returning id into v_invoice_id;
    end if;
  end if;

  -- Follow-up task for the MC.
  insert into public.tasks (user_id, related_couple_id, title, status)
  values (
    v_contract.user_id, v_contract.couple_id,
    'Contract signed — follow up with couple',
    'todo'
  );

  return jsonb_build_object('ok', true, 'contract_id', v_contract.id);
end;
$$;
