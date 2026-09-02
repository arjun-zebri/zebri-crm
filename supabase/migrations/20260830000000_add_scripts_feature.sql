-- Scripts feature: per-couple ceremony / reception scripts.
--
-- An MC or celebrant writes the words they will read on the day as a rich
-- document (TipTap JSON in `content`) attached to the couple. Several named
-- scripts per couple (Ceremony, Reception, ...). MC-only: no portal RPCs, the
-- couple never sees these. Mirrors the `vows` shape, minus revisions.
--
-- `font` is the script's base face id (see lib/documents/script-fonts.ts);
-- validated by the server action's Zod enum, stored as text so adding a face
-- never needs a migration.
--
-- Idempotent throughout so it replays cleanly from zero.

-- ── Table ───────────────────────────────────────────────────────────
create table if not exists public.scripts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  couple_id  uuid not null references public.couples(id) on delete cascade,
  title      text not null default 'Untitled script',
  content    jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  font       text not null default 'noto_serif',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scripts_couple_id_idx on public.scripts(couple_id);
create index if not exists scripts_user_id_idx on public.scripts(user_id);

-- ── updated_at ──────────────────────────────────────────────────────
create or replace function public.touch_scripts_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists scripts_set_updated_at on public.scripts;
create trigger scripts_set_updated_at
  before update on public.scripts
  for each row execute function public.touch_scripts_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────
-- Owner-only on every verb. The write policies ALSO require the couple to
-- belong to the writer: a foreign key is not subject to RLS, so without the
-- EXISTS clause an owner-only `with check` still lets a user attach a script
-- to another tenant's couple.
alter table public.scripts enable row level security;

drop policy if exists scripts_select_own on public.scripts;
create policy scripts_select_own on public.scripts
  for select using (auth.uid() = user_id);

drop policy if exists scripts_insert_own on public.scripts;
create policy scripts_insert_own on public.scripts
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.couples c
      where c.id = couple_id and c.user_id = auth.uid()
    )
  );

drop policy if exists scripts_update_own on public.scripts;
create policy scripts_update_own on public.scripts
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.couples c
      where c.id = couple_id and c.user_id = auth.uid()
    )
  );

drop policy if exists scripts_delete_own on public.scripts;
create policy scripts_delete_own on public.scripts
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.scripts to authenticated;
