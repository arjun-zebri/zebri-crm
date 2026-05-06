-- Timeline templates: reusable sets of items MCs can apply to any event

create table if not exists timeline_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists timeline_template_items (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references timeline_templates(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  description text,
  duration_min integer,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

-- RLS
alter table timeline_templates enable row level security;
alter table timeline_template_items enable row level security;

create policy "Users manage own timeline templates"
  on timeline_templates for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own timeline template items"
  on timeline_template_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
