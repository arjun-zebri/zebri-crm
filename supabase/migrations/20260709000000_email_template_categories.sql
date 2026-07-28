-- Email template categories — user-editable grouping (Notion-style)
-- replacing the fixed lifecycle-stage enum on the Templates → Emails tab.
--
-- MCs create / rename / recolour / reorder their own categories; each
-- template points at one via `category_id`. The legacy
-- `email_templates.lifecycle_stage` column is KEPT (non-destructive,
-- automation trigger suggestions still read it) but the UI now reads
-- and writes `category_id` only.
--
-- Backfill: every user who owns templates gets the six historical
-- stages seeded as categories, and their templates are pointed at the
-- matching one, so nobody's grouping changes on deploy.

-- ────────────────────────────────────────────────────────────────
-- Table
-- ────────────────────────────────────────────────────────────────
create table if not exists public.email_template_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  -- Named palette key (slate / rose / amber / emerald / sky / violet /
  -- pink / stone); the UI maps keys to token-safe chip classes.
  color text not null default 'slate',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_template_categories enable row level security;

create policy "Users manage own email_template_categories"
  on public.email_template_categories for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists email_template_categories_user_id_idx
  on public.email_template_categories(user_id);

-- keep updated_at fresh (same touch pattern as email_templates)
create or replace function public.touch_email_template_categories_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists email_template_categories_set_updated_at on public.email_template_categories;
create trigger email_template_categories_set_updated_at
  before update on public.email_template_categories
  for each row execute function public.touch_email_template_categories_updated_at();

-- ────────────────────────────────────────────────────────────────
-- email_templates.category_id
-- ────────────────────────────────────────────────────────────────
alter table public.email_templates
  add column if not exists category_id uuid references public.email_template_categories(id) on delete set null;

create index if not exists email_templates_category_id_idx
  on public.email_templates(category_id);

-- ────────────────────────────────────────────────────────────────
-- Backfill: seed the six historical stages per template-owning user,
-- then point each template at its matching category.
-- ────────────────────────────────────────────────────────────────
with owners as (
  select distinct user_id from public.email_templates
),
stage_defs(key, name, color, position) as (
  values
    ('enquiry',      'Enquiry',      'sky',     0),
    ('quote',        'Quote',        'amber',   1),
    ('booking',      'Booking',      'emerald', 2),
    ('planning',     'Planning',     'violet',  3),
    ('wedding_week', 'Wedding week', 'rose',    4),
    ('follow_up',    'Follow-up',    'slate',   5)
)
insert into public.email_template_categories (user_id, name, color, position)
select o.user_id, s.name, s.color, s.position
from owners o
cross join stage_defs s
where not exists (
  select 1 from public.email_template_categories c
  where c.user_id = o.user_id and c.name = s.name
);

update public.email_templates t
set category_id = c.id
from public.email_template_categories c
where t.category_id is null
  and t.lifecycle_stage is not null
  and c.user_id = t.user_id
  and c.name = case t.lifecycle_stage
    when 'enquiry'      then 'Enquiry'
    when 'quote'        then 'Quote'
    when 'booking'      then 'Booking'
    when 'planning'     then 'Planning'
    when 'wedding_week' then 'Wedding week'
    when 'follow_up'    then 'Follow-up'
  end;

-- Mark backfilled owners as initialised so the app's lazy seeder never
-- re-creates the defaults for them (deleting all categories must stick).
update auth.users u
set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
  || '{"email_categories_initialized": true}'::jsonb
where exists (select 1 from public.email_templates t where t.user_id = u.id);
