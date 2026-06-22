-- Packages: reusable service bundles (a named set of priced line items)
-- that quote and invoice templates can reference. Structurally mirrors
-- quote_templates / quote_template_items so referencing maps 1:1 later.
--
-- Owner-scoped with RLS, like every owned table.

create table if not exists packages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  notes text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists package_items (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references packages(id) on delete cascade,
  user_id uuid not null,
  description text not null,
  amount numeric(10,2) not null,
  position integer not null,
  created_at timestamptz not null default now()
);

-- RLS: owner-only. `for all using (...)` doubles as the INSERT WITH CHECK
-- (Postgres reuses USING when WITH CHECK is omitted), matching the
-- quote_templates policy.
alter table packages enable row level security;
alter table package_items enable row level security;

-- drop-if-exists keeps this replayable against a DB where a partial
-- earlier run already created the policy (CREATE POLICY isn't idempotent).
drop policy if exists "Users manage own packages" on packages;
create policy "Users manage own packages" on packages for all using (user_id = auth.uid());
drop policy if exists "Users manage own package_items" on package_items;
create policy "Users manage own package_items" on package_items for all using (user_id = auth.uid());

-- Indexes: owner lookups + the items→package foreign key.
create index if not exists packages_user_id_idx on packages(user_id);
create index if not exists package_items_package_id_idx on package_items(package_id);
