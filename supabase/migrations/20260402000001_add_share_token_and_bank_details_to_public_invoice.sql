-- Update get_public_invoice to include share_token and bank details
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
    'business_name', (
      select raw_user_meta_data->>'business_name'
      from auth.users
      where id = i.user_id
    ),
    'bank_account_name', (
      select raw_user_meta_data->>'bank_account_name'
      from auth.users
      where id = i.user_id
    ),
    'bank_bsb', (
      select raw_user_meta_data->>'bank_bsb'
      from auth.users
      where id = i.user_id
    ),
    'bank_account_number', (
      select raw_user_meta_data->>'bank_account_number'
      from auth.users
      where id = i.user_id
    ),
    'stripe_connect_enabled', (
      select (raw_user_meta_data->>'stripe_connect_enabled')::boolean
      from auth.users
      where id = i.user_id
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
    )
  )
  into result
  from invoices i
  join couples c on c.id = i.couple_id
  where i.share_token = token
    and i.share_token_enabled = true;

  return result;
end;
$$;
