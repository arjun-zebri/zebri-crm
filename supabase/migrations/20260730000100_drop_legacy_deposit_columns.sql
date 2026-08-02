-- Retire the two-stage deposit model.
--
-- Split from 20260730000000 so every application consumer could be rewritten
-- and tested against stage rows while the old columns still existed. The guard
-- below replaces the single-transaction safety that split gives up: this
-- migration refuses to drop anything unless the backfill actually landed.

do $$
declare
  unmigrated integer;
begin
  select count(*) into unmigrated
  from public.invoices i
  where (i.deposit_percent is not null or i.deposit_paid_at is not null)
    and not exists (
      select 1 from public.invoice_payment_stages s where s.invoice_id = i.id
    );

  if unmigrated > 0 then
    raise exception
      'Refusing to drop legacy deposit columns: % invoice(s) have no stage rows. Re-run backfill_invoice_payment_stages() first.',
      unmigrated;
  end if;
end $$;

-- @ALLOW_DESTRUCTIVE: payment terms move to payment_schedules; packages and
-- proposals no longer carry them at all (see spec section 2, decision 3).
alter table public.packages drop column if exists deposit_percent;
alter table public.proposal_options drop column if exists deposit_percent;

-- @ALLOW_DESTRUCTIVE: replaced by invoice_payment_stages, backfilled in
-- migration 20260730000000 and asserted by the guard above.
alter table public.invoices drop column if exists deposit_percent;
alter table public.invoices drop column if exists deposit_due_date;
alter table public.invoices drop column if exists deposit_paid_at;
alter table public.invoices drop column if exists final_due_date;
alter table public.invoices drop column if exists final_paid_at;

-- ────────────────────────────────────────────────────────────────
-- Re-declare public functions without deposit columns
-- ────────────────────────────────────────────────────────────────

-- ── get_public_invoice ────────────────────────────────────────────────────────
create or replace function get_public_invoice(token uuid)
returns jsonb language plpgsql security definer as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', i.id,
    'invoice_number', i.invoice_number,
    'title', i.title,
    'status', i.status,
    'subtotal', i.subtotal,
    'tax_rate', i.tax_rate,
    'discount_type', i.discount_type,
    'discount_value', i.discount_value,
    'due_date', i.due_date,
    'payment_terms', i.payment_terms,
    'notes', i.notes,
    'paid_at', i.paid_at,
    'share_token', i.share_token,
    'stripe_payment_enabled', i.stripe_payment_enabled,
    'couple_name', c.name,
    'event_date', c.event_date,
    'venue', c.venue,
    'bank_account_name', (
      select raw_user_meta_data->>'bank_account_name'
      from auth.users where id = i.user_id
    ),
    'bank_bsb', (
      select raw_user_meta_data->>'bank_bsb'
      from auth.users where id = i.user_id
    ),
    'bank_account_number', (
      select raw_user_meta_data->>'bank_account_number'
      from auth.users where id = i.user_id
    ),
    'stripe_connect_enabled', (
      select (raw_user_meta_data->>'stripe_connect_enabled')::boolean
      from auth.users where id = i.user_id
    ),
    'items', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', ii.id,
            'description', ii.description,
            'quantity', ii.quantity,
            'unit_price', ii.unit_price,
            'amount', ii.amount,
            'position', ii.position
          ) order by ii.position
        ),
        '[]'::jsonb
      )
      from invoice_items ii
      where ii.invoice_id = i.id
    ),
    'stages', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'position', s.position,
          'label', s.label,
          'amount_cents', s.amount_cents,
          'due_date', s.due_date,
          'paid_at', s.paid_at
        ) order by s.position
      )
      from public.invoice_payment_stages s
      where s.invoice_id = i.id
    ), '[]'::jsonb),
    'branding_blocks', _user_branding_blocks(i.user_id, 'invoice')
  ) || coalesce(_user_branding(i.user_id), '{}'::jsonb)
  into result
  from invoices i
  join couples c on c.id = i.couple_id
  where i.share_token = token
    and i.share_token_enabled = true;

  return result;
end;
$$;

-- ── get_public_proposal ──────────────────────────────────────────────────────
create or replace function get_public_proposal(token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'proposal_number', p.proposal_number,
    'status', p.status,
    'notes', p.notes,
    'expires_at', p.expires_at,
    'accepted_at', p.accepted_at,
    'accepted_option_id', p.accepted_option_id,
    'accepted_addon_selection', p.accepted_addon_selection,
    'couple_name', c.name,
    'event_date', c.event_date,
    'venue', c.venue,
    'business_name', (
      select u.raw_user_meta_data->>'business_name'
      from auth.users u
      where u.id = p.user_id
    ),
    'branding_blocks', _user_branding_blocks(p.user_id, 'proposal'),
    'options', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', po.id,
            'title', po.title,
            'description', po.description,
            'gst_inclusive', po.gst_inclusive,
            'is_popular', po.is_popular,
            'subtotal', po.subtotal,
            'position', po.position,
            'items', (
              select coalesce(
                jsonb_agg(
                  jsonb_build_object(
                    'id', poi.id,
                    'description', poi.description,
                    'amount', poi.amount,
                    'is_addon', poi.is_addon,
                    'default_included', poi.default_included,
                    'position', poi.position
                  ) order by poi.position
                ),
                '[]'::jsonb
              )
              from proposal_option_items poi
              where poi.option_id = po.id
            )
          ) order by po.position
        ),
        '[]'::jsonb
      )
      from proposal_options po
      where po.proposal_id = p.id
    )
  ) || coalesce(_user_branding(p.user_id), '{}'::jsonb)
  into result
  from proposals p
  join couples c on c.id = p.couple_id
  where p.share_token = token
    and p.share_token_enabled = true;

  return result;
end;
$$;

-- ── sign_contract with stage stamping ──────────────────────────────────────────
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

  -- Auto-create an invoice from the linked ACCEPTED PROPOSAL
  -- (preferred — the recorded agreement, terms included).
  if v_contract.proposal_id is not null then
    select *
    into v_proposal
    from public.proposals p
    where p.id = v_contract.proposal_id and p.status = 'accepted';

    if found then
      select id into v_invoice_id
      from public.invoices
      where proposal_id = v_contract.proposal_id;

      if v_invoice_id is null then
        insert into public.invoices (
          user_id, couple_id, proposal_id, title, status,
          invoice_number, subtotal, share_token, share_token_enabled
        ) values (
          v_proposal.user_id,
          v_proposal.couple_id,
          v_proposal.id,
          'Invoice for ' || coalesce(v_proposal.title, v_proposal.proposal_number),
          'draft',
          public.generate_invoice_number(v_proposal.user_id),
          v_proposal.subtotal,
          gen_random_uuid(),
          true
        ) returning id into v_invoice_id;

        -- Stamp the MC's default schedule onto the new invoice. Percent
        -- stages resolve against the subtotal; the remainder stage takes what
        -- is left so the rows always sum to the invoice exactly. No default
        -- schedule means no stages, and the invoice behaves as a single
        -- payment.
        insert into public.invoice_payment_stages (
          user_id, invoice_id, position, label, amount_type, amount_value,
          amount_cents, due_date
        )
        select
          v_proposal.user_id,
          v_invoice_id,
          ts.position,
          ts.label,
          ts.amount_type,
          ts.amount_value,
          case
            when ts.amount_type = 'percent'
              then round(v_proposal.subtotal * 100 * ts.amount_value / 100)::int
            when ts.amount_type = 'fixed'
              then round(ts.amount_value * 100)::int
            else round(v_proposal.subtotal * 100)::int - coalesce((
              select sum(
                case
                  when x.amount_type = 'percent'
                    then round(v_proposal.subtotal * 100 * x.amount_value / 100)::int
                  else round(x.amount_value * 100)::int
                end
              )
              from public.payment_schedule_stages x
              where x.schedule_id = ts.schedule_id
                and x.amount_type <> 'remainder'
            ), 0)
          end,
          current_date + ts.due_offset_days
        from public.payment_schedule_stages ts
        join public.payment_schedules ps on ps.id = ts.schedule_id
        where ps.user_id = v_proposal.user_id and ps.is_default
        order by ts.position;
      end if;
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

grant execute on function get_public_invoice(uuid) to anon;
grant execute on function get_public_proposal(uuid) to anon;
