-- Invoice templates: reusable invoice skeletons (a named set of priced
-- line items). Built from scratch or seeded by referencing a package or
-- quote template (items are snapshotted in at edit time — no live FK, so
-- later price edits to a package never silently change a saved template).
--
-- Structurally mirrors packages / quote_templates. Owner-scoped RLS.

create table if not exists invoice_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  notes text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists invoice_template_items (
  id uuid primary key default gen_random_uuid(),
  invoice_template_id uuid not null references invoice_templates(id) on delete cascade,
  user_id uuid not null,
  description text not null,
  amount numeric(10,2) not null,
  position integer not null,
  created_at timestamptz not null default now()
);

-- RLS: owner-only (USING doubles as INSERT WITH CHECK), matching packages.
alter table invoice_templates enable row level security;
alter table invoice_template_items enable row level security;

create policy "Users manage own invoice_templates" on invoice_templates for all using (user_id = auth.uid());
create policy "Users manage own invoice_template_items" on invoice_template_items for all using (user_id = auth.uid());

create index if not exists invoice_templates_user_id_idx on invoice_templates(user_id);
create index if not exists invoice_template_items_template_id_idx on invoice_template_items(invoice_template_id);
