-- Add branding fields to get_public_quote
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
    'business_name', (
      select raw_user_meta_data->>'business_name'
      from auth.users
      where id = q.user_id
    ),
    'logo_url', (
      select raw_user_meta_data->>'logo_url'
      from auth.users
      where id = q.user_id
    ),
    'brand_color', (
      select COALESCE(raw_user_meta_data->>'brand_color', '#A7F3D0')
      from auth.users
      where id = q.user_id
    ),
    'tagline', (
      select raw_user_meta_data->>'tagline'
      from auth.users
      where id = q.user_id
    ),
    'show_contact_on_documents', (
      select (raw_user_meta_data->>'show_contact_on_documents')::boolean
      from auth.users
      where id = q.user_id
    ),
    'phone', (
      select raw_user_meta_data->>'phone'
      from auth.users
      where id = q.user_id
    ),
    'website', (
      select raw_user_meta_data->>'website'
      from auth.users
      where id = q.user_id
    ),
    'instagram_url', (
      select raw_user_meta_data->>'instagram_url'
      from auth.users
      where id = q.user_id
    ),
    'facebook_url', (
      select raw_user_meta_data->>'facebook_url'
      from auth.users
      where id = q.user_id
    ),
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
    )
  )
  into result
  from quotes q
  join couples c on c.id = q.couple_id
  where q.share_token = token
    and q.share_token_enabled = true;

  return result;
end;
$$;

-- Add branding fields to get_public_invoice
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
    'business_name', (
      select raw_user_meta_data->>'business_name'
      from auth.users
      where id = i.user_id
    ),
    'logo_url', (
      select raw_user_meta_data->>'logo_url'
      from auth.users
      where id = i.user_id
    ),
    'brand_color', (
      select COALESCE(raw_user_meta_data->>'brand_color', '#A7F3D0')
      from auth.users
      where id = i.user_id
    ),
    'tagline', (
      select raw_user_meta_data->>'tagline'
      from auth.users
      where id = i.user_id
    ),
    'abn', (
      select raw_user_meta_data->>'abn'
      from auth.users
      where id = i.user_id
    ),
    'show_contact_on_documents', (
      select (raw_user_meta_data->>'show_contact_on_documents')::boolean
      from auth.users
      where id = i.user_id
    ),
    'phone', (
      select raw_user_meta_data->>'phone'
      from auth.users
      where id = i.user_id
    ),
    'website', (
      select raw_user_meta_data->>'website'
      from auth.users
      where id = i.user_id
    ),
    'instagram_url', (
      select raw_user_meta_data->>'instagram_url'
      from auth.users
      where id = i.user_id
    ),
    'facebook_url', (
      select raw_user_meta_data->>'facebook_url'
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

grant execute on function get_public_quote(uuid) to anon;
grant execute on function get_public_invoice(uuid) to anon;
