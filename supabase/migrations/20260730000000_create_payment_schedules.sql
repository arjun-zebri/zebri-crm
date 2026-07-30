-- Custom payment schedules: reusable multi-stage payment plans.
--
-- Additive only. Migration 20260730000100 drops the legacy two-stage columns
-- once every consumer reads stage rows, and guards itself on the backfill
-- below having landed.

create table if not exists public.payment_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_schedule_stages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  schedule_id uuid not null references public.payment_schedules(id) on delete cascade,
  position integer not null,
  label text not null,
  amount_type text not null check (amount_type in ('percent', 'fixed', 'remainder')),
  amount_value numeric,
  due_offset_days integer not null default 0,
  -- A remainder stage absorbs what is left, so it carries no value; every
  -- other type must carry one. Enforced in SQL as well as the resolver so a
  -- direct write cannot create a stage the resolver refuses to read.
  constraint payment_schedule_stages_value_shape check (
    (amount_type = 'remainder' and amount_value is null)
    or (amount_type <> 'remainder' and amount_value is not null)
  )
);

create table if not exists public.invoice_payment_stages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  position integer not null,
  label text not null,
  amount_type text not null check (amount_type in ('percent', 'fixed', 'remainder')),
  amount_value numeric,
  amount_cents integer not null,
  due_date date,
  paid_at timestamptz,
  stripe_payment_intent_id text,
  constraint invoice_payment_stages_value_shape check (
    (amount_type = 'remainder' and amount_value is null)
    or (amount_type <> 'remainder' and amount_value is not null)
  )
);

-- At most one default schedule per MC. Partial unique index rather than a
-- trigger so the database is the arbiter.
create unique index if not exists payment_schedules_one_default
  on public.payment_schedules (user_id) where is_default;

create index if not exists payment_schedule_stages_schedule_idx
  on public.payment_schedule_stages (schedule_id);
create index if not exists invoice_payment_stages_invoice_idx
  on public.invoice_payment_stages (invoice_id);
-- Carries the reminder emitters, which scan for stages falling due on a date.
create index if not exists invoice_payment_stages_due_date_idx
  on public.invoice_payment_stages (due_date);

alter table public.payment_schedules enable row level security;
alter table public.payment_schedule_stages enable row level security;
alter table public.invoice_payment_stages enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['payment_schedules', 'payment_schedule_stages', 'invoice_payment_stages']
  loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format(
      'create policy %1$s_select on public.%1$s for select using (auth.uid() = user_id)', t);
    execute format(
      'create policy %1$s_insert on public.%1$s for insert with check (auth.uid() = user_id)', t);
    execute format(
      'create policy %1$s_update on public.%1$s for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format(
      'create policy %1$s_delete on public.%1$s for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- Wrapped in a function, not inlined, so the integration suite can replay the
-- exact production backfill against a freshly seeded legacy invoice instead of
-- reimplementing the logic in test code (which would prove nothing).
create or replace function public.backfill_invoice_payment_stages()
returns integer language plpgsql security definer set search_path = public as $$
declare
  inserted integer;
begin
  with legacy as (
    select
      i.id,
      i.user_id,
      round((i.subtotal + i.subtotal * coalesce(i.tax_rate, 0) / 100) * 100)::int as total_cents,
      coalesce(i.deposit_percent, 50) as deposit_pct,
      i.deposit_due_date, i.deposit_paid_at, i.final_due_date, i.final_paid_at
    from public.invoices i
    where (i.deposit_percent is not null or i.deposit_paid_at is not null)
      and not exists (
        select 1 from public.invoice_payment_stages s where s.invoice_id = i.id
      )
  ),
  deposit_rows as (
    insert into public.invoice_payment_stages (
      user_id, invoice_id, position, label, amount_type, amount_value,
      amount_cents, due_date, paid_at
    )
    select l.user_id, l.id, 1, 'Deposit', 'percent', l.deposit_pct,
           round(l.total_cents * l.deposit_pct / 100)::int,
           l.deposit_due_date, l.deposit_paid_at
    from legacy l
    returning invoice_id, amount_cents
  ),
  final_rows as (
    insert into public.invoice_payment_stages (
      user_id, invoice_id, position, label, amount_type, amount_value,
      amount_cents, due_date, paid_at
    )
    select l.user_id, l.id, 2, 'Final balance', 'remainder', null,
           l.total_cents - d.amount_cents, l.final_due_date, l.final_paid_at
    from legacy l
    join deposit_rows d on d.invoice_id = l.id
    returning id
  )
  select count(*) into inserted from final_rows;
  return inserted;
end $$;

revoke all on function public.backfill_invoice_payment_stages() from public;
revoke all on function public.backfill_invoice_payment_stages() from anon, authenticated;

select public.backfill_invoice_payment_stages();

-- ── Default schedule per MC: function, trigger, and backfill ─────────────
--
-- Three parts, mirroring seed_default_contract_template in
-- 20260525000000_recovery_phase3_phase4_schema_drift.sql:358-596, which is this
-- codebase's established pattern for per-user defaults. A one-off backfill
-- would only cover users who existed at migration time, so every new signup
-- would have no default schedule and sign_contract would spawn stageless
-- invoices for them. The auth.users trigger is what makes it forward-safe.
--
-- Every user, not only those with default_deposit_percent set. That key turns
-- out never to be written by the app: it is read in exactly two places, both
-- with a `?? 25` fallback, and no Settings UI sets it. Seeding only the users
-- who have it would leave nearly everyone without a default, so sign_contract
-- would spawn stageless invoices where it previously applied a hardcoded 25%.
-- This turns that implicit fallback into real data.
create or replace function public.seed_default_payment_schedule(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_schedule_id uuid;
  v_deposit_pct numeric;
begin
  -- Idempotent, so the trigger and the backfill loop below cannot produce a
  -- second schedule for the same user (the partial unique index would reject
  -- it anyway, but failing the whole signup transaction is not acceptable).
  if exists (select 1 from public.payment_schedules where user_id = p_user_id) then
    return;
  end if;

  select coalesce((raw_user_meta_data ->> 'default_deposit_percent')::numeric, 25)
    into v_deposit_pct
  from auth.users
  where id = p_user_id;

  insert into public.payment_schedules (user_id, name, is_default)
  values (p_user_id, 'Default', true)
  returning id into v_schedule_id;

  insert into public.payment_schedule_stages (
    user_id, schedule_id, position, label, amount_type, amount_value, due_offset_days
  ) values
    -- 7 days mirrors the `current_date + interval '7 days'` the older
    -- sign_contract used for deposit_due_date.
    (p_user_id, v_schedule_id, 1, 'Deposit', 'percent', coalesce(v_deposit_pct, 25), 7),
    (p_user_id, v_schedule_id, 2, 'Final balance', 'remainder', null, 30);
end $$;

revoke all on function public.seed_default_payment_schedule(uuid) from public;
revoke all on function public.seed_default_payment_schedule(uuid) from anon, authenticated;

create or replace function public.trigger_seed_payment_schedule()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.seed_default_payment_schedule(new.id); return new; end;
$$;

drop trigger if exists on_new_user_seed_payment_schedule on auth.users;
create trigger on_new_user_seed_payment_schedule
  after insert on auth.users for each row
  execute function public.trigger_seed_payment_schedule();

-- Back-fill every existing user.
do $$
declare r record;
begin
  for r in select id from auth.users loop
    perform public.seed_default_payment_schedule(r.id);
  end loop;
end $$;
