-- Proposals engine, Phase C: the close.
--
-- accept_proposal      couple picks a package: snapshot + draft contract + signer
-- decline_proposal     couple declines with a reason
-- finalize_proposal_acceptance
--                      after the last signature: invoice + stages, proposal
--                      accepted, couple confirmed (idempotent)
-- expire_proposals     daily cron: sent/viewed past expires_at -> expired
-- get_public_proposal  gains pending_contract, invoice, bank details, connect
--
-- Every anon-callable RPC resolves its subject through a token the couple
-- already holds (the proposal share token, or the contract signer token), so
-- no caller can act on an id they merely guessed. Spec 5.3, 8; plan C1-C4, C7, C8.

-- ── accept_proposal ────────────────────────────────────────────────────
create or replace function public.accept_proposal(
  p_token uuid,
  p_option_id uuid,
  p_addon_selection jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p          record;
  v_template   record;
  v_contract_id uuid;
  v_sign_token uuid;
  v_addon      uuid;
  v_addons     jsonb;
begin
  select * into v_p
    from proposals
   where share_token = p_token and share_token_enabled = true
     for update;
  if v_p is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  if v_p.accepted_at is not null then
    return jsonb_build_object('error', 'already_accepted');
  end if;
  if v_p.declined_at is not null then
    return jsonb_build_object('error', 'declined');
  end if;
  if v_p.expires_at is not null and v_p.expires_at < current_date then
    return jsonb_build_object('error', 'expired');
  end if;

  -- Add-on ids are stored de-duplicated and order-insensitive so a
  -- re-ordered (or doubled) array is the same choice, not a "new" one that
  -- would drop a still-valid pending contract.
  select coalesce(jsonb_agg(distinct value), '[]'::jsonb) into v_addons
    from jsonb_array_elements(coalesce(p_addon_selection, '[]'::jsonb));

  -- The choice can change until the contract is signed: a couple who picked
  -- the wrong package and came back should not be stuck with it. A pending
  -- contract for the same choice is returned as-is (a refresh mid-stepper),
  -- with no re-validation needed since that choice was already validated
  -- when it was first accepted. Only an unsigned draft counts as pending: a
  -- signed contract whose finalize has not landed yet must never be handed
  -- back for re-publishing (the route rewrites locked HTML + countersign).
  if v_p.contract_id is not null
     and v_p.accepted_option_id = p_option_id
     and coalesce(v_p.accepted_addon_selection, '[]'::jsonb) = v_addons then
    if not exists (
      select 1 from contracts c
       where c.id = v_p.contract_id and c.user_id = v_p.user_id
         and c.status = 'draft' and c.signed_at is null
    ) then
      return jsonb_build_object('error', 'already_accepted');
    end if;
    select s.sign_token into v_sign_token
      from contract_signers s
     where s.contract_id = v_p.contract_id and s.role = 'client'
     order by s.signing_order limit 1;
    return jsonb_build_object(
      'ok', true, 'contract_id', v_p.contract_id, 'sign_token', v_sign_token,
      'user_id', v_p.user_id, 'proposal_id', v_p.id, 'already_pending', true
    );
  end if;

  -- Validate the NEW choice in full before touching any existing contract:
  -- a bad request (wrong option/add-on) must never destroy a still-valid
  -- pending contract.
  if v_p.contract_template_id is null then
    return jsonb_build_object('error', 'no_template');
  end if;
  -- Owner-matched (not only via the with-check): a pointer at another MC's
  -- template must never be cloned into this MC's contract.
  select * into v_template from contract_templates
   where id = v_p.contract_template_id and user_id = v_p.user_id;
  if v_template is null then
    return jsonb_build_object('error', 'no_template');
  end if;

  if not exists (select 1 from proposal_options o where o.id = p_option_id and o.proposal_id = v_p.id) then
    return jsonb_build_object('error', 'invalid_option');
  end if;
  for v_addon in select (value #>> '{}')::uuid from jsonb_array_elements(v_addons) loop
    if not exists (
      select 1 from proposal_option_items i
       where i.id = v_addon and i.option_id = p_option_id and i.is_addon = true
    ) then
      return jsonb_build_object('error', 'invalid_addon');
    end if;
  end loop;

  -- Only now, with the new choice fully validated, may an existing
  -- different-choice contract be touched: a different choice drops the
  -- unsigned draft (signers cascade) and starts over.
  if v_p.contract_id is not null then
    if exists (
      select 1 from contracts c
       where c.id = v_p.contract_id and c.user_id = v_p.user_id
         and c.status = 'draft' and c.signed_at is null
    ) then
      -- Every predicate repeated on the delete itself so a spoofed pointer
      -- can never remove another MC's row, whatever the check above saw.
      delete from contracts
       where id = v_p.contract_id and user_id = v_p.user_id and couple_id = v_p.couple_id
         and status = 'draft' and signed_at is null;
    else
      return jsonb_build_object('error', 'already_accepted');
    end if;
  end if;

  insert into contracts (
    user_id, couple_id, title, contract_number, status, content,
    proposal_id, require_signer_otp, signing_mode
  ) values (
    v_p.user_id, v_p.couple_id, v_p.title, generate_contract_number(v_p.user_id), 'draft', v_template.content,
    v_p.id, false, 'parallel'
  ) returning id into v_contract_id;

  -- contracts_seed_signers (20260828004000) already fires after this insert
  -- and creates the client signer row(s) from the couple's own name/email
  -- fields (one per named partner); inserting a second one here would leave
  -- two same-signing_order rows and an ambiguous sign_token read. It also
  -- seeds a second required client signer (signing_order 2) whenever
  -- couples.secondary_name is set, which would block the inline one-signer
  -- flow this stepper depends on (spec D5: one light signature, no
  -- countersign) since a required second signer would never get a link.
  -- Drop any such second signer immediately: this contract has exactly one
  -- client signer, whoever accepted the proposal.
  delete from contract_signers
   where contract_id = v_contract_id and role = 'client' and signing_order > 1;

  select s.sign_token into v_sign_token
    from contract_signers s
   where s.contract_id = v_contract_id and s.role = 'client'
   order by s.signing_order limit 1;

  update proposals
     set accepted_option_id = p_option_id,
         accepted_addon_selection = v_addons,
         contract_id = v_contract_id,
         updated_at = now()
   where id = v_p.id;

  return jsonb_build_object(
    'ok', true, 'contract_id', v_contract_id, 'sign_token', v_sign_token,
    'user_id', v_p.user_id, 'proposal_id', v_p.id, 'already_pending', false
  );
end;
$$;
grant execute on function public.accept_proposal(uuid, uuid, jsonb) to anon, authenticated;

-- ── decline_proposal ───────────────────────────────────────────────────
create or replace function public.decline_proposal(
  p_token uuid,
  p_reason text,
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p record;
begin
  if p_reason not in ('price', 'date', 'other_vendor', 'other') then
    return jsonb_build_object('error', 'invalid_reason');
  end if;
  select * into v_p from proposals where share_token = p_token and share_token_enabled = true for update;
  if v_p is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  if v_p.accepted_at is not null then
    return jsonb_build_object('error', 'already_accepted');
  end if;
  -- A signed contract whose finalize has not landed yet is still a booking:
  -- the signature is not retractable, so the decline is refused. An unsigned
  -- draft is dropped (signers cascade) so no signable link outlives the
  -- decline. Owner-matched so a spoofed pointer never touches another MC's row.
  if v_p.contract_id is not null then
    if exists (
      select 1 from contracts c
       where c.id = v_p.contract_id and c.user_id = v_p.user_id and c.signed_at is not null
    ) then
      return jsonb_build_object('error', 'already_accepted');
    end if;
    delete from contracts
     where id = v_p.contract_id and user_id = v_p.user_id
       and status = 'draft' and signed_at is null;
  end if;
  update proposals
     set declined_at = coalesce(declined_at, now()),
         declined_reason = p_reason,
         declined_message = left(p_message, 1000),
         status = 'declined',
         contract_id = null,
         updated_at = now()
   where id = v_p.id;
  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.decline_proposal(uuid, text, text) to anon, authenticated;

-- ── finalize_proposal_acceptance ───────────────────────────────────────
-- Callable only by the service role; the invoice payload is computed
-- server-side in lib/proposals/finalize.ts, never trusted from a public
-- caller (it decides the amounts that get invoiced).
-- p_invoice: { title, due_date, subtotal, gst_inclusive, stripe_payment_enabled,
--   items: [{ description, note, amount, position }],
--   stages: [{ position, label, amount_type, amount_value, amount_cents, due_date,
--              due_offset_value, due_offset_unit, due_offset_anchor }] }
create or replace function public.finalize_proposal_acceptance(
  p_token uuid,
  p_invoice jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract_id uuid;
  v_c           record;
  v_p           record;
  v_invoice_id  uuid;
  v_share_token uuid;
  v_invoice_no  text;
  v_stripe      boolean;
  v_first       jsonb;
  v_item        jsonb;
  v_stage       jsonb;
begin
  select r.contract_id into v_contract_id
    from public._resolve_contract_token(p_token) r;
  if v_contract_id is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  select * into v_c from contracts where id = v_contract_id;
  if v_c.share_token_enabled is distinct from true then
    return jsonb_build_object('error', 'not_found');
  end if;
  if v_c.proposal_id is null then
    return jsonb_build_object('error', 'not_a_proposal');
  end if;
  if v_c.status <> 'signed' then
    return jsonb_build_object('error', 'not_signed');
  end if;

  select * into v_p from proposals where id = v_c.proposal_id for update;

  -- A decline recorded before the signature landed wins: the couple said
  -- no, so no invoice is generated off a stale draft link.
  if v_p.declined_at is not null then
    return jsonb_build_object('error', 'declined');
  end if;

  if v_p.invoice_id is not null then
    -- Owner-matched: a spoofed invoice_id must not surface another MC's
    -- invoice share token through this proposal.
    select i.share_token, i.invoice_number, i.stripe_payment_enabled into v_share_token, v_invoice_no, v_stripe
      from invoices i where i.id = v_p.invoice_id and i.user_id = v_p.user_id;
    if v_share_token is null then
      return jsonb_build_object('error', 'not_found');
    end if;
    -- Stage 1, same as the fresh branch and get_public_proposal, so every
    -- reader of first_stage sees the same stage (see close-types).
    select jsonb_build_object('id', s.id, 'label', s.label, 'amount_cents', s.amount_cents, 'due_date', s.due_date, 'paid_at', s.paid_at) into v_first
      from invoice_payment_stages s where s.invoice_id = v_p.invoice_id order by s.position limit 1;
    return jsonb_build_object(
      'ok', true, 'invoice_id', v_p.invoice_id, 'share_token', v_share_token, 'invoice_number', v_invoice_no,
      'stripe_payment_enabled', v_stripe, 'first_stage', v_first, 'already_finalized', true
    );
  end if;

  insert into invoices (
    user_id, couple_id, event_id, title, invoice_number, status, subtotal, tax_rate,
    gst_inclusive, due_date, stripe_payment_enabled, share_token_enabled, proposal_id
  ) values (
    v_p.user_id, v_p.couple_id, v_p.event_id, coalesce(p_invoice ->> 'title', v_p.title),
    generate_invoice_number(v_p.user_id), 'sent', (p_invoice ->> 'subtotal')::numeric, 0,
    coalesce((p_invoice ->> 'gst_inclusive')::boolean, true), (p_invoice ->> 'due_date')::date,
    coalesce((p_invoice ->> 'stripe_payment_enabled')::boolean, false), true, v_p.id
  ) returning id, share_token, invoice_number, stripe_payment_enabled into v_invoice_id, v_share_token, v_invoice_no, v_stripe;

  for v_item in select * from jsonb_array_elements(coalesce(p_invoice -> 'items', '[]'::jsonb)) loop
    insert into invoice_items (invoice_id, user_id, description, note, quantity, unit_price, amount, position)
    values (
      v_invoice_id, v_p.user_id, v_item ->> 'description', nullif(v_item ->> 'note', ''), 1,
      (v_item ->> 'amount')::numeric, (v_item ->> 'amount')::numeric, (v_item ->> 'position')::int
    );
  end loop;

  for v_stage in select * from jsonb_array_elements(coalesce(p_invoice -> 'stages', '[]'::jsonb)) loop
    insert into invoice_payment_stages (
      invoice_id, user_id, position, label, amount_type, amount_value, amount_cents, due_date,
      due_offset_value, due_offset_unit, due_offset_anchor
    ) values (
      v_invoice_id, v_p.user_id, (v_stage ->> 'position')::int, v_stage ->> 'label', v_stage ->> 'amount_type',
      (v_stage ->> 'amount_value')::numeric, (v_stage ->> 'amount_cents')::int, (v_stage ->> 'due_date')::date,
      (v_stage ->> 'due_offset_value')::int, v_stage ->> 'due_offset_unit', v_stage ->> 'due_offset_anchor'
    );
  end loop;

  update proposals
     set status = 'accepted', accepted_at = coalesce(accepted_at, v_c.signed_at, now()),
         invoice_id = v_invoice_id, updated_at = now()
   where id = v_p.id;

  -- sign_contract_v2 targets couple statuses this table no longer has, so the
  -- proposal path is what actually confirms the booking (C4).
  update couples set status = 'confirmed'
   where id = v_p.couple_id and status not in ('confirmed', 'paid', 'complete');

  select jsonb_build_object('id', s.id, 'label', s.label, 'amount_cents', s.amount_cents, 'due_date', s.due_date, 'paid_at', s.paid_at) into v_first
    from invoice_payment_stages s where s.invoice_id = v_invoice_id order by s.position limit 1;

  return jsonb_build_object(
    'ok', true, 'invoice_id', v_invoice_id, 'share_token', v_share_token, 'invoice_number', v_invoice_no,
    'stripe_payment_enabled', v_stripe, 'first_stage', v_first, 'already_finalized', false
  );
end;
$$;
-- Postgres grants execute to the implicit PUBLIC role on every new function
-- unless revoked, and every role (anon included) inherits PUBLIC's
-- privileges regardless of its own grants: revoking from anon/authenticated
-- alone leaves the function callable anyway, so PUBLIC must be revoked too.
revoke execute on function public.finalize_proposal_acceptance(uuid, jsonb) from public, anon, authenticated;

-- ── expire_proposals ───────────────────────────────────────────────────
create or replace function public.expire_proposals()
returns setof uuid
language sql
security definer
set search_path = public
as $$
  update proposals
     set status = 'expired', updated_at = now()
   where status in ('sent', 'viewed')
     and expires_at is not null
     and expires_at < current_date
     and accepted_at is null
  returning id;
$$;
-- Same PUBLIC-default gotcha as finalize_proposal_acceptance above: revoke
-- from public too, or anon inherits execute anyway.
revoke execute on function public.expire_proposals() from public, anon, authenticated;

-- ── get_public_proposal: pay-step fields ───────────────────────────────
-- Same body as Phase A plus bank details, the Connect flag, the pending
-- contract, and the generated invoice. Kept as one statement so the payload
-- is assembled in a single read.
create or replace function public.get_public_proposal(token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  result jsonb;
begin
  select id into v_id
  from proposals
  where share_token = token and share_token_enabled = true;

  if v_id is null then
    return null;
  end if;

  update proposals
  set view_count = view_count + 1,
      last_viewed_at = now(),
      first_viewed_at = coalesce(first_viewed_at, now()),
      status = case when status = 'sent' then 'viewed' else status end
  where id = v_id;

  select jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'proposal_number', p.proposal_number,
    'status', p.status,
    'version', p.version,
    'intro_note', p.intro_note,
    'hero_override', p.hero_override,
    'expires_at', p.expires_at,
    'expired', (p.expires_at is not null and p.expires_at < current_date),
    -- An explicit schedule wins outright (ruling W1): the percent is hidden
    -- so the page never shows a deposit the invoice will not carry.
    'deposit_percent', case when p.payment_schedule_id is null then p.deposit_percent else null end,
    'accepted_option_id', p.accepted_option_id,
    'accepted_addon_selection', p.accepted_addon_selection,
    'accepted_at', p.accepted_at,
    'declined_at', p.declined_at,
    'couple_name', c.name,
    'event_date', c.event_date,
    'venue', c.venue,
    'options', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', po.id,
        'position', po.position,
        'title', po.title,
        'description', po.description,
        'pricing_mode', po.pricing_mode,
        'fixed_price', po.fixed_price,
        'gst_inclusive', po.gst_inclusive,
        'weekend_loading_percent', po.weekend_loading_percent,
        'is_popular', po.is_popular,
        'subtotal', po.subtotal,
        'items', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', poi.id,
            'description', poi.description,
            'note', poi.note,
            'amount', poi.amount,
            'quantity', poi.quantity,
            'is_addon', poi.is_addon,
            'default_included', poi.default_included,
            'position', poi.position
          ) order by poi.position), '[]'::jsonb)
          from proposal_option_items poi
          where poi.option_id = po.id
        )
      ) order by po.position), '[]'::jsonb)
      from proposal_options po
      where po.proposal_id = p.id
    ),
    'branding_blocks', _user_branding_blocks(p.user_id, 'proposal'),
    'bank_account_name', (select u.raw_user_meta_data ->> 'bank_account_name' from auth.users u where u.id = p.user_id),
    'bank_bsb', (select u.raw_user_meta_data ->> 'bank_bsb' from auth.users u where u.id = p.user_id),
    'bank_account_number', (select u.raw_user_meta_data ->> 'bank_account_number' from auth.users u where u.id = p.user_id),
    'stripe_connect_enabled', coalesce((
      select coalesce(u.raw_app_meta_data ->> 'stripe_connect_enabled', u.raw_user_meta_data ->> 'stripe_connect_enabled')::boolean
      from auth.users u where u.id = p.user_id
    ), false),
    -- Returned whenever the pointer is set, signed or not, so the server
    -- page can self-heal a signed-but-unfinalized contract (ruling W3b).
    -- Owner-matched: a spoofed pointer must not leak another MC's locked
    -- HTML or their couple's sign token.
    'pending_contract', (
      select jsonb_build_object(
        'sign_token', (select s.sign_token from contract_signers s where s.contract_id = ct.id and s.role = 'client' order by s.signing_order limit 1),
        'contract_number', ct.contract_number,
        'title', ct.title,
        'locked_content_html', ct.locked_content_html,
        'signed_at', ct.signed_at
      )
      from contracts ct where ct.id = p.contract_id and ct.user_id = p.user_id
    ),
    'invoice', (
      select jsonb_build_object(
        'id', i.id,
        'share_token', i.share_token,
        'invoice_number', i.invoice_number,
        'stripe_payment_enabled', i.stripe_payment_enabled,
        'paid_at', i.paid_at,
        'first_stage', (
          select jsonb_build_object('id', s.id, 'label', s.label, 'amount_cents', s.amount_cents, 'due_date', s.due_date, 'paid_at', s.paid_at)
          from invoice_payment_stages s where s.invoice_id = i.id order by s.position limit 1
        )
      )
      from invoices i where i.id = p.invoice_id and i.user_id = p.user_id
    )
  ) || coalesce(_user_branding(p.user_id), '{}'::jsonb)
  into result
  from proposals p
  join couples c on c.id = p.couple_id
  where p.id = v_id;

  return result;
end;
$$;
grant execute on function public.get_public_proposal(uuid) to anon;
