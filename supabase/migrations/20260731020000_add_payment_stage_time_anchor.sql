-- Timing anchor for payment schedule + invoice stages.
--
-- A stage's offset is measured either forward from the invoice issue date
-- ('issue', the existing behaviour) or backward from its due date ('due'). The
-- default is 'issue' so every existing row keeps its meaning.

alter table public.payment_schedule_stages
  add column if not exists due_offset_anchor text not null default 'issue'
    check (due_offset_anchor in ('issue', 'due'));

-- Invoice stages carry the same anchor so the modal round-trips the MC's choice.
-- Nullable: legacy rows predate the column and fall back to 'issue' in code.
alter table public.invoice_payment_stages
  add column if not exists due_offset_anchor text
    check (due_offset_anchor is null or due_offset_anchor in ('issue', 'due'));
