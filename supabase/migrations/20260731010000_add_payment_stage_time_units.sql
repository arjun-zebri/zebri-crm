-- Flexible time-unit offsets for payment schedule + invoice stages.
--
-- Timing becomes "<value> <unit> after issue" where unit is day / week /
-- month, replacing the days-only `due_offset_days`. The unit is stored, not
-- converted, so "1 month" resolves to a real calendar month and reads back as
-- "1 month". `due_offset_days` is left in place (deprecated, already
-- `default 0`) so it can be omitted on insert; a later destructive migration
-- drops it once no reader references it.

-- Template stages: a value + unit, backfilled from the days-only column.
alter table public.payment_schedule_stages
  add column if not exists due_offset_value integer not null default 0;
alter table public.payment_schedule_stages
  add column if not exists due_offset_unit text not null default 'day'
    check (due_offset_unit in ('day', 'week', 'month'));

-- Every existing offset was expressed in days; carry it into the new value
-- column. Guarded on the freshly-added default so a replay cannot clobber an
-- edited value.
update public.payment_schedule_stages
  set due_offset_value = due_offset_days
  where due_offset_value = 0
    and due_offset_days <> 0;

-- Invoice stages carry the same value + unit so the modal can round-trip the
-- MC's chosen unit on reopen. Nullable: legacy rows have only a concrete
-- `due_date`, and the resolver falls back to days for those.
alter table public.invoice_payment_stages
  add column if not exists due_offset_value integer;
alter table public.invoice_payment_stages
  add column if not exists due_offset_unit text
    check (due_offset_unit is null or due_offset_unit in ('day', 'week', 'month'));
