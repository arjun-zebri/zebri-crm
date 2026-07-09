-- Package categories — user-editable grouping for the Templates →
-- Packages tab, mirroring `email_template_categories` (Notion-style:
-- create / rename / recolour / reorder, coloured dot per category).
--
-- Unlike email categories there is NO default seeding and NO backfill:
-- packages had no prior taxonomy, so every account starts with an
-- empty category list and an "Uncategorised" bucket.

-- ────────────────────────────────────────────────────────────────
-- Table
-- ────────────────────────────────────────────────────────────────
create table if not exists public.package_categories (
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

alter table public.package_categories enable row level security;

create policy "Users manage own package_categories"
  on public.package_categories for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists package_categories_user_id_idx
  on public.package_categories(user_id);

-- keep updated_at fresh (same touch pattern as email_template_categories)
create or replace function public.touch_package_categories_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists package_categories_set_updated_at on public.package_categories;
create trigger package_categories_set_updated_at
  before update on public.package_categories
  for each row execute function public.touch_package_categories_updated_at();

-- ────────────────────────────────────────────────────────────────
-- packages.category_id
-- ────────────────────────────────────────────────────────────────
alter table public.packages
  add column if not exists category_id uuid references public.package_categories(id) on delete set null;

create index if not exists packages_category_id_idx
  on public.packages(category_id);
