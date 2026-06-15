-- P3: Vows feature.
--
-- A couple-facing portal section where each partner writes their vows.
-- Backs the `couple_completed_vows` automation trigger (the MC can, e.g.,
-- send a "got your vows!" note or a reminder). Mirrors the existing
-- portal-section pattern: an owner-scoped table with RLS + token-gated
-- SECURITY DEFINER RPCs for the anon portal client, plus an AFTER INSERT
-- trigger that emits the automation event.
--
-- Idempotent throughout (create-if-not-exists / or-replace / drop-if-
-- exists) so it replays cleanly.

-- ── Table + RLS ────────────────────────────────────────────────────
create table if not exists public.vows (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  couple_id  uuid not null references public.couples(id) on delete cascade,
  who        text not null default 'primary', -- 'primary' | 'spouse'
  content    text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vows_couple_id_idx on public.vows(couple_id);
create index if not exists vows_user_id_idx on public.vows(user_id);

alter table public.vows enable row level security;

drop policy if exists vows_select_own on public.vows;
create policy vows_select_own on public.vows
  for select using (auth.uid() = user_id);

drop policy if exists vows_insert_own on public.vows;
create policy vows_insert_own on public.vows
  for insert with check (auth.uid() = user_id);

drop policy if exists vows_update_own on public.vows;
create policy vows_update_own on public.vows
  for update using (auth.uid() = user_id);

drop policy if exists vows_delete_own on public.vows;
create policy vows_delete_own on public.vows
  for delete using (auth.uid() = user_id);

-- ── Token-gated portal RPCs (anon portal client) ───────────────────
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

  return v_result_id;
end;
$$;

create or replace function delete_portal_vow(p_token uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
begin
  select id into v_couple_id from couples
  where portal_token = p_token and portal_token_enabled = true;
  if v_couple_id is null then raise exception 'Invalid portal token'; end if;
  delete from vows where id = p_id and couple_id = v_couple_id;
end;
$$;

grant execute on function save_portal_vow(uuid, uuid, text, text) to anon;
grant execute on function delete_portal_vow(uuid, uuid) to anon;

-- ── couple_completed_vows automation event ─────────────────────────
create or replace function public.tg_vows_emit_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id from public.couples where id = new.couple_id;
  if v_user_id is null then return new; end if;

  perform public.emit_automation_event(
    v_user_id,
    'vows',
    new.id,
    'couple_completed_vows',
    jsonb_build_object('vow_id', new.id, 'couple_id', new.couple_id, 'who', new.who),
    new.couple_id
  );
  return new;
end;
$$;

drop trigger if exists vows_emit_completed on public.vows;
create trigger vows_emit_completed
  after insert on public.vows
  for each row execute function public.tg_vows_emit_completed();

-- ── Extend get_portal_data with a `vows` payload ───────────────────
-- Re-creates the 20260516010000 definition verbatim plus a `vows` key,
-- so the portal's VowsSection can self-load through the same RPC as the
-- other sections.
create or replace function get_portal_data(token uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_couple_id        uuid;
  v_user_id          uuid;
  v_event_id         uuid;
  v_portal_sections  jsonb;
  result             jsonb;
begin
  select id, user_id into v_couple_id, v_user_id
  from couples
  where portal_token = token and portal_token_enabled = true;

  if v_couple_id is null then
    return null;
  end if;

  select id into v_event_id
  from events
  where couple_id = v_couple_id
  order by
    case when date >= current_date then 0 else 1 end,
    date asc
  limit 1;

  select portal_sections into v_portal_sections
  from public.user_branding
  where user_id = v_user_id;

  if v_portal_sections is null then
    select raw_user_meta_data -> 'portal_sections'
    into v_portal_sections
    from auth.users
    where id = v_user_id;
  end if;

  select jsonb_build_object(
    'couple_id',    v_couple_id,
    'couple_name',  c.name,
    'couple_email', c.email,
    'enabled_sections', case
      when v_portal_sections is null then null
      else (
        select jsonb_agg(key order by key)
        from jsonb_each_text(v_portal_sections)
        where value = 'true'
      )
    end,
    'event', case when v_event_id is not null then
      jsonb_build_object('id', e.id, 'date', e.date::text, 'venue', e.venue)
    else null end,
    'events', coalesce(
      (select jsonb_agg(jsonb_build_object('id', ev.id, 'date', ev.date::text, 'venue', ev.venue, 'status', ev.status) order by ev.date asc)
        from events ev where ev.couple_id = v_couple_id),
      '[]'::jsonb
    ),
    'people', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', p.id, 'category', p.category, 'full_name', p.full_name,
          'phonetic', p.phonetic, 'role', p.role, 'audio_url', p.audio_url,
          'position', p.position, 'notes', p.notes, 'email', p.email, 'phone', p.phone)
        order by p.category, p.position, p.created_at)
        from portal_people p where p.couple_id = v_couple_id),
      '[]'::jsonb
    ),
    'contacts', coalesce(
      (select jsonb_agg(jsonb_build_object('id', ct.id, 'name', ct.name, 'category', ct.category,
          'email', ct.email, 'phone', ct.phone) order by ct.name)
        from couple_contacts cc
        join contacts ct on ct.id = cc.contact_id
        where cc.couple_id = v_couple_id),
      '[]'::jsonb
    ),
    'songs', coalesce(
      (select jsonb_agg(jsonb_build_object('id', s.id, 'category', s.category, 'title', s.title,
          'artist', s.artist, 'notes', s.notes, 'position', s.position)
        order by s.category, s.position, s.created_at)
        from portal_songs s where s.couple_id = v_couple_id),
      '[]'::jsonb
    ),
    'song_categories', coalesce(
      (select jsonb_agg(jsonb_build_object('key', key, 'label', label, 'description', description, 'position', position) order by position)
        from portal_song_categories where couple_id = v_couple_id),
      '[]'::jsonb
    ),
    'files', coalesce(
      (select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'file_url', f.file_url,
          'file_size', f.file_size, 'created_at', f.created_at) order by f.created_at)
        from portal_files f where f.couple_id = v_couple_id),
      '[]'::jsonb
    ),
    'vows', coalesce(
      (select jsonb_agg(jsonb_build_object('id', v.id, 'who', v.who, 'content', v.content)
        order by v.who)
        from vows v where v.couple_id = v_couple_id),
      '[]'::jsonb
    ),
    'timeline_items', case when v_event_id is not null then coalesce(
      (select jsonb_agg(jsonb_build_object('id', ti.id, 'start_time', to_char(ti.start_time, 'HH24:MI'),
          'title', ti.title, 'description', ti.description,
          'duration_min', ti.duration_min, 'position', ti.position, 'pending_review', ti.pending_review)
        order by ti.start_time nulls last, ti.position)
        from timeline_items ti where ti.event_id = v_event_id),
      '[]'::jsonb
    ) else '[]'::jsonb end,
    'payments', jsonb_build_object(
      'quotes', coalesce(
        (select jsonb_agg(jsonb_build_object('id', q.id, 'title', q.title, 'quote_number', q.quote_number,
            'status', q.status, 'subtotal', q.subtotal,
            'share_token', q.share_token, 'share_token_enabled', q.share_token_enabled)
          order by q.created_at desc)
          from quotes q where q.couple_id = v_couple_id),
        '[]'::jsonb
      ),
      'invoices', coalesce(
        (select jsonb_agg(jsonb_build_object('id', inv.id, 'title', inv.title, 'invoice_number', inv.invoice_number,
            'status', inv.status, 'subtotal', inv.subtotal, 'due_date', inv.due_date::text,
            'share_token', inv.share_token, 'share_token_enabled', inv.share_token_enabled)
          order by inv.created_at desc)
          from invoices inv where inv.couple_id = v_couple_id),
        '[]'::jsonb
      )
    ),
    'contracts', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', ctr.id,
          'title', ctr.title,
          'contract_number', ctr.contract_number,
          'status', ctr.status,
          'share_token', ctr.share_token,
          'share_token_enabled', ctr.share_token_enabled,
          'email_sent_at', ctr.email_sent_at,
          'signed_at', ctr.signed_at
        ) order by ctr.created_at desc)
        from contracts ctr
        where ctr.couple_id = v_couple_id
          and ctr.status in ('sent', 'signed', 'declined', 'expired')
          and ctr.share_token_enabled = true),
      '[]'::jsonb
    ),
    'branding',        _user_branding(v_user_id),
    'branding_blocks', _user_branding_blocks(v_user_id, 'portal')
  )
  into result
  from couples c
  left join events e on e.id = v_event_id
  where c.id = v_couple_id;

  return result::json;
end;
$$;

grant execute on function get_portal_data(uuid) to anon;
