-- Invoice templates get the package single-price mode.
--
-- An invoice template's total was always the sum of its priced line items, so
-- an MC who pulled a single-price package ("Gold, $2,400" with unpriced
-- inclusions) into a template got a column of $0 lines and had to invent
-- per-line prices that add up. `pricing_mode = 'single'` mirrors
-- `packages.pricing_mode`: the line items become unpriced inclusions and
-- `fixed_price` is the whole price. Applying such a template writes ONE priced
-- invoice line with the inclusions in its note, exactly as a single-price
-- package applies.
--
-- Additive and non-destructive: the default reproduces today's behaviour and
-- the price is nullable, so existing rows are unaffected. No
-- @ALLOW_DESTRUCTIVE marker required.

alter table public.invoice_templates
  add column if not exists pricing_mode text not null default 'itemised'
    check (pricing_mode in ('itemised', 'single'));

-- Nullable rather than defaulted: an itemised template has no fixed price, and
-- 0 would be indistinguishable from "free".
alter table public.invoice_templates
  add column if not exists fixed_price numeric(10,2)
    check (fixed_price is null or fixed_price >= 0);

comment on column public.invoice_templates.pricing_mode is
  'itemised = total is the sum of invoice_template_items (the default and historical behaviour); single = line items are unpriced inclusions and fixed_price is the whole price.';
comment on column public.invoice_templates.fixed_price is
  'The template price when pricing_mode = ''single''. Ignored in itemised mode.';
