-- Quote templates table
create table quote_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  notes text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Quote template items
create table quote_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references quote_templates(id) on delete cascade,
  user_id uuid not null,
  description text not null,
  amount numeric(10,2) not null,
  position integer not null,
  created_at timestamptz not null default now()
);

-- RLS
alter table quote_templates enable row level security;
alter table quote_template_items enable row level security;

create policy "Users manage own quote_templates" on quote_templates for all using (user_id = auth.uid());
create policy "Users manage own quote_template_items" on quote_template_items for all using (user_id = auth.uid());

-- Indexes
create index quote_templates_user_id_idx on quote_templates(user_id);
create index quote_template_items_template_id_idx on quote_template_items(template_id);
