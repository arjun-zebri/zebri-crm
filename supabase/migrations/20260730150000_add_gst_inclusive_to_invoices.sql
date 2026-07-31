-- Invoices: record whether the line-item prices already include GST.
--
-- Packages (`packages.gst_inclusive`) and proposal options
-- (`proposal_options.gst_inclusive`) have carried this flag since
-- packages-v2, but invoices had nowhere to put it. Applying a
-- GST-inclusive package to an invoice therefore threw the fact away:
-- the builder cleared the tax rate so nothing was added on top, but the
-- couple was never told the price already covered GST.
--
-- This is a DISPLAY flag. It does not participate in any total. Every
-- money path (Stripe charge amounts, payment-stage totals, the public
-- page, the PDF) keeps computing from `subtotal` + `tax_rate` exactly as
-- before, so existing invoices are byte-for-byte unaffected. The column
-- only decides whether a "Prices include GST" note renders under the
-- total.
--
-- Default is `false`: an invoice that never opts in reads and renders
-- identically to how it did before this migration.

alter table public.invoices
  add column if not exists gst_inclusive boolean not null default false;

comment on column public.invoices.gst_inclusive is
  'Display-only: when true, surfaces render a "Prices include GST" note under the total. Never affects any computed amount.';

-- ── get_public_invoice ────────────────────────────────────────────────
-- Re-declared verbatim from 20260730000100 with `gst_inclusive` added to
-- the payload, so the couple-facing page can render the note.
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
    'gst_inclusive', i.gst_inclusive,
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
