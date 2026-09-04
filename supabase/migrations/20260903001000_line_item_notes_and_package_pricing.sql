-- Two user-reported gaps in the money surfaces.
--
-- 1. LINE-ITEM NOTES. An invoice could carry one note, at the very end of the
--    document. MCs wanted a note per line ("includes the rehearsal and a site
--    visit", "through to last dance"), because a single trailing block cannot
--    say which charge it qualifies. The note has to reach the couple, so it
--    lands on both the template items (where the MC authors it) and the real
--    invoice items (what actually gets sent), and it joins the public payload.
--
-- 2. PACKAGE SINGLE-PRICE MODE. A package's total was always the sum of its
--    priced items, so an MC who sells "the Gold package, $2,400" had to invent
--    per-line prices that add up, and the couple saw a breakdown the MC never
--    intended to quote. `pricing_mode = 'single'` lets the line items be
--    unpriced inclusions with one `fixed_price` for the package.
--
-- Additive and non-destructive: every column is nullable or carries a default
-- that reproduces today's behaviour, so existing rows are unaffected. No
-- @ALLOW_DESTRUCTIVE marker required.

-- ── 1. Line-item notes ──────────────────────────────────────────────────
-- Nullable: a note is optional on every row, and NULL means "no note", which
-- is what every existing row means.
alter table public.invoice_template_items
  add column if not exists note text;

alter table public.invoice_items
  add column if not exists note text;

comment on column public.invoice_items.note is
  'Optional qualifying note rendered under this line''s description on the public invoice and PDF.';
comment on column public.invoice_template_items.note is
  'Optional per-line note, copied onto invoice_items.note when the template is applied.';

-- ── 2. Package pricing mode ─────────────────────────────────────────────
-- Default 'itemised' is today's behaviour, so every existing package keeps
-- summing its items with no migration of data.
alter table public.packages
  add column if not exists pricing_mode text not null default 'itemised'
    check (pricing_mode in ('itemised', 'single'));

-- Nullable rather than defaulted: a package in 'itemised' mode has no fixed
-- price at all, and 0 would be indistinguishable from "free".
alter table public.packages
  add column if not exists fixed_price numeric(10,2)
    check (fixed_price is null or fixed_price >= 0);

comment on column public.packages.pricing_mode is
  'itemised = total is the sum of package_items (the default and historical behaviour); single = line items are unpriced inclusions and fixed_price is the whole price.';
comment on column public.packages.fixed_price is
  'The package price when pricing_mode = ''single''. Ignored in itemised mode.';

-- ── get_public_invoice: carry the per-line note ─────────────────────────
--
-- Re-declared from the current live definition at
-- 20260730150000_add_gst_inclusive_to_invoices.sql:29-110, with `note` added
-- to each item object. Everything else is verbatim.
--
-- Note this is the ONLY change the couple-facing surface needs: the public
-- page, the builder preview, the PDF preview iframe and the printed file all
-- render through the same React component, so there is no separate PDF
-- renderer to update.
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
            'note', ii.note,
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

grant execute on function get_public_invoice(uuid) to anon;

-- ── get_portal_packages: price a single-price package correctly ─────────
--
-- The couple portal shows each package's headline price, computed as the sum
-- of its required items. A `single` package's items are unpriced inclusions,
-- so that sum is 0 and the couple would be offered the package for nothing.
--
-- Re-declared from the live definition at
-- 20260819110000_portal_package_selection.sql:26-68, with `total_amount`
-- taught about the pricing mode. Everything else is verbatim.
create or replace function public.get_portal_packages(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_user_id   uuid;
  result      jsonb;
begin
  select couple_id, owner_id into v_couple_id, v_user_id
  from _resolve_portal_couple(p_token);

  if v_couple_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'selected_package_id', (select selected_package_id from couples where id = v_couple_id),
    'packages', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'description', p.description,
        'gst_inclusive', p.gst_inclusive,
        'total_amount', case
          when p.pricing_mode = 'single' then coalesce(p.fixed_price, 0)
          else coalesce((
            select sum(i.amount * i.quantity)
            from package_items i
            where i.package_id = p.id and not i.optional
          ), 0)
        end
      ) order by p.position, p.created_at
    ), '[]'::jsonb)
  )
  into result
  from packages p
  where p.user_id = v_user_id
    and p.archived_at is null;

  return result;
end;
$$;

grant execute on function public.get_portal_packages(uuid) to anon;
