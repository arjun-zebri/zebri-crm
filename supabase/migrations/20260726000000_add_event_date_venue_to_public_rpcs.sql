-- ────────────────────────────────────────────────────────────────
-- Add event_date and venue to public document RPCs
-- ────────────────────────────────────────────────────────────────
--
-- The branding editor now supports {{ event_date }} and {{ venue }}
-- variable chips that resolve on public documents. Extend
-- get_public_invoice, get_public_proposal, and get_public_contract
-- to return these fields from the couples table so branded documents
-- can render them.
--
-- All three RPCs already join couples; this is a simple additive change
-- to the returned jsonb object.

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
    'deposit_percent', i.deposit_percent,
    'deposit_due_date', i.deposit_due_date,
    'deposit_paid_at', i.deposit_paid_at,
    'final_due_date', i.final_due_date,
    'final_paid_at', i.final_paid_at,
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

-- ── get_public_contract ───────────────────────────────────────────────────────
create or replace function get_public_contract(token uuid)
returns jsonb language plpgsql security definer as $$
declare
  result jsonb;
begin
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
    'branding_blocks', _user_branding_blocks(c.user_id, 'contract')
  ) || coalesce(_user_branding(c.user_id), '{}'::jsonb)
  into result
  from contracts c
  join couples cp on cp.id = c.couple_id
  where c.share_token = token
    and c.share_token_enabled = true
    and c.status <> 'revoked';

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
            'deposit_percent', po.deposit_percent,
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

grant execute on function get_public_invoice(uuid)  to anon;
grant execute on function get_public_proposal(uuid) to anon;
grant execute on function get_public_contract(uuid) to anon;
