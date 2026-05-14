-- Extend the three document RPCs to return the saved branding_blocks tree for
-- the relevant surface, so the public couple-facing pages can render the
-- customised block layout from the branding editor (custom title text, custom
-- intro paragraph, custom Accept/Decline button colour, etc.).
--
-- Portal isn't a block-based surface; it gets the scalar branding only.

create or replace function _user_branding_blocks(p_user_id uuid, p_surface text)
returns jsonb
language sql
security definer
stable
as $$
  select branding_blocks -> p_surface
  from public.user_branding
  where user_id = p_user_id;
$$;

revoke all on function _user_branding_blocks(uuid, text) from public, anon, authenticated;

-- ── get_public_quote ──────────────────────────────────────────────────────────
create or replace function get_public_quote(token uuid)
returns jsonb language plpgsql security definer as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', q.id,
    'title', q.title,
    'quote_number', q.quote_number,
    'status', q.status,
    'subtotal', q.subtotal,
    'tax_rate', q.tax_rate,
    'discount_type', q.discount_type,
    'discount_value', q.discount_value,
    'notes', q.notes,
    'expires_at', q.expires_at,
    'accepted_at', q.accepted_at,
    'couple_name', c.name,
    'items', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', qi.id,
            'description', qi.description,
            'amount', qi.amount,
            'position', qi.position
          ) order by qi.position
        ),
        '[]'::jsonb
      )
      from quote_items qi
      where qi.quote_id = q.id
    ),
    'branding_blocks', _user_branding_blocks(q.user_id, 'quote')
  ) || coalesce(_user_branding(q.user_id), '{}'::jsonb)
  into result
  from quotes q
  join couples c on c.id = q.couple_id
  where q.share_token = token
    and q.share_token_enabled = true;

  return result;
end;
$$;

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

grant execute on function get_public_quote(uuid)    to anon;
grant execute on function get_public_invoice(uuid)  to anon;
grant execute on function get_public_contract(uuid) to anon;
