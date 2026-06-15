-- Vow edit history (P3 follow-up).
--
-- The MC can edit the couple's vows from the dashboard, but every
-- version is preserved so they can revert — including back to the
-- couple's original submission. Each couple save (via save_portal_vow)
-- and each MC edit (via the dashboard action) appends a row here.
-- Append-only: no update/delete policy.

create table if not exists public.vow_revisions (
  id         uuid primary key default gen_random_uuid(),
  vow_id     uuid not null references public.vows(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  content    text not null,
  author     text not null, -- 'couple' | 'mc'
  created_at timestamptz not null default now()
);

create index if not exists vow_revisions_vow_id_idx on public.vow_revisions(vow_id);
create index if not exists vow_revisions_user_id_idx on public.vow_revisions(user_id);

alter table public.vow_revisions enable row level security;

drop policy if exists vow_revisions_select_own on public.vow_revisions;
create policy vow_revisions_select_own on public.vow_revisions
  for select using (auth.uid() = user_id);

drop policy if exists vow_revisions_insert_own on public.vow_revisions;
create policy vow_revisions_insert_own on public.vow_revisions
  for insert with check (auth.uid() = user_id);

-- save_portal_vow now logs a 'couple' revision on every portal save.
create or replace function save_portal_vow(
  p_token   uuid,
  p_id      uuid,
  p_who     text,
  p_content text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_user_id   uuid;
  v_result_id uuid;
begin
  select id, user_id into v_couple_id, v_user_id
  from couples
  where portal_token = p_token and portal_token_enabled = true;

  if v_couple_id is null then raise exception 'Invalid portal token'; end if;

  insert into vows (id, couple_id, user_id, who, content)
  values (coalesce(p_id, gen_random_uuid()), v_couple_id, v_user_id, p_who, p_content)
  on conflict (id) do update set
    who        = excluded.who,
    content    = excluded.content,
    updated_at = now()
  returning id into v_result_id;

  insert into vow_revisions (vow_id, user_id, content, author)
  values (v_result_id, v_user_id, p_content, 'couple');

  return v_result_id;
end;
$$;
