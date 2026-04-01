-- invoices table
create table invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  couple_id uuid not null references couples(id) on delete cascade,
  event_id uuid references events(id) on delete set null,
  quote_id uuid references quotes(id) on delete set null,
  invoice_number text not null,
  title text not null,
  status text not null default 'draft',
  subtotal numeric(10,2) not null default 0,
  due_date date,
  notes text,
  share_token uuid not null default gen_random_uuid(),
  share_token_enabled boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- invoice_items table
create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  user_id uuid not null,
  description text not null,
  quantity numeric(8,2) not null default 1.00,
  unit_price numeric(10,2) not null,
  amount numeric(10,2) not null,
  position integer not null,
  created_at timestamptz not null default now()
);

-- RLS
alter table invoices enable row level security;
alter table invoice_items enable row level security;

create policy "Users manage own invoices" on invoices for all using (user_id = auth.uid());
create policy "Users manage own invoice_items" on invoice_items for all using (user_id = auth.uid());

-- Indexes
create index invoices_share_token_idx on invoices(share_token);
create index invoices_couple_id_idx on invoices(couple_id);
create index invoices_event_id_idx on invoices(event_id);

-- Invoice number generator (sequential per user, e.g. INV-001)
create or replace function generate_invoice_number(p_user_id uuid)
returns text language plpgsql as $$
declare
  next_num integer;
begin
  select coalesce(
    max(cast(regexp_replace(invoice_number, '[^0-9]', '', 'g') as integer)),
    0
  ) + 1
  into next_num
  from invoices
  where user_id = p_user_id;
  return 'INV-' || lpad(next_num::text, 3, '0');
end;
$$;

-- get_public_invoice — anon-safe read via share token (read-only; no couple-side writes)
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
    'due_date', i.due_date,
    'notes', i.notes,
    'paid_at', i.paid_at,
    'couple_name', c.name,
    'business_name', (
      select raw_user_meta_data->>'business_name'
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

grant execute on function get_public_invoice(uuid) to anon;
