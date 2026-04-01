-- quotes table
create table quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  couple_id uuid not null references couples(id) on delete cascade,
  title text not null,
  quote_number text not null,
  status text not null default 'draft',
  subtotal numeric(10,2) not null default 0,
  notes text,
  expires_at date,
  share_token uuid not null default gen_random_uuid(),
  share_token_enabled boolean not null default false,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- quote_items table
create table quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  user_id uuid not null,
  description text not null,
  amount numeric(10,2) not null,
  position integer not null,
  created_at timestamptz not null default now()
);

-- RLS
alter table quotes enable row level security;
alter table quote_items enable row level security;

create policy "Users manage own quotes" on quotes for all using (user_id = auth.uid());
create policy "Users manage own quote_items" on quote_items for all using (user_id = auth.uid());

-- Indexes
create index quotes_share_token_idx on quotes(share_token);
create index quotes_couple_id_idx on quotes(couple_id);
create index quote_items_quote_id_idx on quote_items(quote_id);

-- Quote number generator (sequential per user, e.g. QT-001)
create or replace function generate_quote_number(p_user_id uuid)
returns text language plpgsql as $$
declare
  next_num integer;
begin
  select coalesce(
    max(cast(regexp_replace(quote_number, '[^0-9]', '', 'g') as integer)),
    0
  ) + 1
  into next_num
  from quotes
  where user_id = p_user_id;
  return 'QT-' || lpad(next_num::text, 3, '0');
end;
$$;

-- get_public_quote — anon-safe read via share token
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
    'notes', q.notes,
    'expires_at', q.expires_at,
    'accepted_at', q.accepted_at,
    'couple_name', c.name,
    'business_name', (
      select raw_user_meta_data->>'business_name'
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

-- accept_quote — called from public page, touches quotes + couples + tasks atomically
create or replace function accept_quote(token uuid)
returns jsonb language plpgsql security definer as $$
declare
  q record;
  couple record;
begin
  select * into q
  from quotes
  where share_token = token and share_token_enabled = true;

  if not found then
    return '{"error":"not_found"}'::jsonb;
  end if;

  if q.status in ('accepted', 'declined') then
    return '{"error":"already_actioned"}'::jsonb;
  end if;

  if q.expires_at is not null and q.expires_at < current_date then
    return '{"error":"expired"}'::jsonb;
  end if;

  -- Accept quote
  update quotes
  set status = 'accepted', accepted_at = now()
  where id = q.id;

  -- Fetch couple name for task title
  select * into couple from couples where id = q.couple_id;

  -- Advance couple status to confirmed (never regress past confirmed/paid/complete)
  update couples
  set status = 'confirmed'
  where id = q.couple_id
    and status not in ('confirmed', 'paid', 'complete');

  -- Create follow-up task for MC
  insert into tasks (user_id, title, due_date, status, related_couple_id)
  values (
    q.user_id,
    'Quote accepted — confirm booking for ' || couple.name,
    current_date,
    'todo',
    q.couple_id
  );

  return '{"success":true}'::jsonb;
end;
$$;

-- decline_quote — called from public page
create or replace function decline_quote(token uuid)
returns jsonb language plpgsql security definer as $$
declare
  q record;
begin
  select * into q
  from quotes
  where share_token = token and share_token_enabled = true;

  if not found then
    return '{"error":"not_found"}'::jsonb;
  end if;

  if q.status in ('accepted', 'declined') then
    return '{"error":"already_actioned"}'::jsonb;
  end if;

  update quotes set status = 'declined' where id = q.id;

  return '{"success":true}'::jsonb;
end;
$$;

-- Grant anon role access to public functions
grant execute on function get_public_quote(uuid) to anon;
grant execute on function accept_quote(uuid) to anon;
grant execute on function decline_quote(uuid) to anon;
