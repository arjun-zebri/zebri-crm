-- Trigger sweep: `invoice_created` gets the fields its filters need.
--
-- Three changes to the invoice_created payload, all read off the row
-- being inserted (plus one join to couples):
--
-- 1. `total` — the amount filter compared `subtotal`, the raw sum of
--    line items, before discount and before tax. Every couple-facing
--    surface shows (subtotal - discount) * (1 + tax_rate/100), and
--    that is what an MC means by "invoices over $2,000". `subtotal`
--    stays in the payload; the matcher moves to `total`.
--
-- 2. `discount_type` / `discount_value` — the trigger has advertised a
--    "discount applied" filter since Phase 14a with nothing behind it.
--    Both columns are written in the same insert as the rest of the
--    invoice (saveInvoiceAction), so they are available here.
--
-- 3. `event_date` — joined from the couple, so the wedding-date filter
--    family works on this trigger the way it does on the couple
--    triggers ("invoice created and the wedding is inside 30 days").
--
-- The couples lookup is a primary-key read on a row this invoice
-- already references, inside a trigger that only fires on invoice
-- insert. `security definer` means it is not blocked by RLS, and it
-- reads only the couple the invoice points at.
--
-- Not destructive: keys are added to one emitted jsonb. The
-- payment_received and invoice_sent branches are unchanged.

create or replace function public.tg_invoices_emit_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_discount numeric;
  v_total numeric;
  v_event_date date;
begin
  if tg_op = 'INSERT' then
    -- Mirror of the shared display formula (see
    -- lib/branding/public-blocks/variable-values.ts). A percentage
    -- discount is taken off the subtotal; a fixed one is subtracted
    -- outright. `greatest(…, 0)` stops an over-large fixed discount
    -- producing a negative taxable base.
    v_discount := case
      when new.discount_type = 'percentage'
        then new.subtotal * coalesce(new.discount_value, 0) / 100
      when new.discount_type = 'fixed'
        then coalesce(new.discount_value, 0)
      else 0
    end;
    v_total := greatest(new.subtotal - v_discount, 0) * (1 + coalesce(new.tax_rate, 0) / 100);

    select c.event_date into v_event_date
    from public.couples c
    where c.id = new.couple_id;

    perform public.emit_automation_event(
      new.user_id,
      'invoices',
      new.id,
      'invoice_created',
      jsonb_build_object(
        'invoice_id', new.id,
        'couple_id', new.couple_id,
        'invoice_number', new.invoice_number,
        'title', new.title,
        'subtotal', new.subtotal,
        'total', v_total,
        'discount_type', new.discount_type,
        'discount_value', new.discount_value,
        'due_date', new.due_date,
        'event_date', v_event_date,
        'status', new.status
      ),
      new.couple_id
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- paid_at moving from null → not-null is the payment-received
    -- signal. The Stripe webhook handler also produces card
    -- payments - but the same `update invoices set paid_at = …`
    -- path runs in both cases, so this trigger covers manual and
    -- Stripe-mediated payments uniformly. Event type matches the
    -- user-facing trigger slug in the registry.
    if new.paid_at is not null and old.paid_at is null then
      perform public.emit_automation_event(
        new.user_id,
        'invoices',
        new.id,
        'payment_received',
        jsonb_build_object(
          'invoice_id', new.id,
          'couple_id', new.couple_id,
          'invoice_number', new.invoice_number,
          'subtotal', new.subtotal,
          'paid_at', new.paid_at
        ),
        new.couple_id
      );
    end if;

    if new.share_token_enabled = true and coalesce(old.share_token_enabled, false) = false then
      perform public.emit_automation_event(
        new.user_id,
        'invoices',
        new.id,
        'invoice_sent',
        jsonb_build_object(
          'invoice_id', new.id,
          'couple_id', new.couple_id,
          'invoice_number', new.invoice_number
        ),
        new.couple_id
      );
    end if;
    return new;
  end if;

  return new;
end;
$$;
