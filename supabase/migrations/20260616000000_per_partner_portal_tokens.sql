-- ============================================================
-- Per-Partner Portal Tokens: Enable separate links per couple member
-- ============================================================
--
-- Each couple now has TWO portal tokens: portal_token (primary partner)
-- and secondary_portal_token (spouse). This allows each partner to have
-- a private portal link and view ONLY their own vow content.
--
-- CRITICAL: Vows are now privacy-filtered per viewer in get_portal_data.
-- The primary partner can never see the spouse's vow, and vice versa.

-- ── 1. Add secondary_portal_token to couples ────────────────────────
alter table public.couples
  add column if not exists secondary_portal_token uuid;

-- Idempotent backfill: every couple gets a unique secondary token
update public.couples
  set secondary_portal_token = gen_random_uuid()
  where secondary_portal_token is null;

-- Make NOT NULL and add default for future inserts
alter table public.couples
  alter column secondary_portal_token set not null,
  alter column secondary_portal_token set default gen_random_uuid();

-- Unique index on secondary token (same uniqueness guarantee as portal_token)
create unique index if not exists couples_secondary_portal_token_idx
  on public.couples(secondary_portal_token);

-- ── 2. Helper: resolve either token to (couple_id, owner_id, viewer) ──
--
-- Maps portal_token → 'primary' or secondary_portal_token → 'spouse'.
-- Returns the couple, owner (MC user_id), and which partner is viewing.
-- All token-gated RPCs use this to authorize and route requests.
create or replace function public._resolve_portal_couple(p_token uuid)
returns table (couple_id uuid, owner_id uuid, viewer text)
language sql
stable
security definer
set search_path = public
as $$
  select
    id,
    user_id,
    case
      when secondary_portal_token = p_token then 'spouse'
      else 'primary'
    end as viewer
  from couples
  where (portal_token = p_token or secondary_portal_token = p_token)
    and portal_token_enabled = true;
$$;

grant execute on function public._resolve_portal_couple(uuid)
  to anon, authenticated, service_role;

comment on function public._resolve_portal_couple(p_token uuid) is
  'Resolve either partner token to (couple, owner, viewer role). '
  'Used by all token-gated portal RPCs to derive who is viewing.';

-- ── 3. Rewrite shared-section RPCs to use the helper ────────────────

-- 3a. save_portal_timeline_item
create or replace function public.save_portal_timeline_item(
  p_token        uuid,
  p_id           uuid,
  p_start_time   text,
  p_title        text,
  p_description  text,
  p_duration_min integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_user_id   uuid;
  v_event_id  uuid;
  v_result_id uuid;
  v_max_pos   integer;
begin
  select couple_id, owner_id into v_couple_id, v_user_id
  from _resolve_portal_couple(p_token);

  if v_couple_id is null then
    raise exception 'Invalid portal token';
  end if;

  select id into v_event_id from events
  where couple_id = v_couple_id
  order by case when date >= current_date then 0 else 1 end, date asc
  limit 1;

  if v_event_id is null then
    raise exception 'No event found for this couple';
  end if;

  select coalesce(max(position), 0) into v_max_pos
  from timeline_items where event_id = v_event_id;

  insert into timeline_items (
    id, event_id, user_id, start_time, title, description,
    duration_min, position, pending_review
  )
  values (
    p_id, v_event_id, v_user_id,
    case when p_start_time is not null and p_start_time <> '' then p_start_time::time else null end,
    p_title, p_description, p_duration_min,
    v_max_pos + 1000,
    true
  )
  on conflict (id) do update set
    start_time   = case when p_start_time is not null and p_start_time <> '' then p_start_time::time else null end,
    title        = excluded.title,
    description  = excluded.description,
    duration_min = excluded.duration_min
  returning id into v_result_id;

  return v_result_id;
end;
$$;

grant execute on function public.save_portal_timeline_item(uuid, uuid, text, text, text, integer)
  to anon;

-- 3b. delete_portal_timeline_item
create or replace function public.delete_portal_timeline_item(p_token uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_event_id  uuid;
begin
  select couple_id into v_couple_id from _resolve_portal_couple(p_token);

  if v_couple_id is null then
    raise exception 'Invalid portal token';
  end if;

  select id into v_event_id from events
  where couple_id = v_couple_id limit 1;

  delete from timeline_items
  where id = p_id and event_id = v_event_id and pending_review = true;
end;
$$;

grant execute on function public.delete_portal_timeline_item(uuid, uuid)
  to anon;

-- 3c. save_portal_person
create or replace function public.save_portal_person(
  p_token      uuid,
  p_id         uuid,
  p_category   text,
  p_full_name  text,
  p_phonetic   text,
  p_role       text,
  p_audio_url  text,
  p_position   integer,
  p_notes      text default null,
  p_email      text default null,
  p_phone      text default null
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
  select couple_id, owner_id into v_couple_id, v_user_id
  from _resolve_portal_couple(p_token);

  if v_couple_id is null then
    raise exception 'Invalid portal token';
  end if;

  insert into portal_people (
    id, couple_id, user_id, category, full_name, phonetic, role,
    audio_url, position, notes, email, phone
  )
  values (
    p_id, v_couple_id, v_user_id, p_category, p_full_name, p_phonetic,
    p_role, p_audio_url, p_position, p_notes, p_email, p_phone
  )
  on conflict (id) do update set
    full_name  = excluded.full_name,
    phonetic   = excluded.phonetic,
    role       = excluded.role,
    audio_url  = excluded.audio_url,
    position   = excluded.position,
    notes      = excluded.notes,
    email      = excluded.email,
    phone      = excluded.phone
  returning id into v_result_id;

  return v_result_id;
end;
$$;

grant execute on function public.save_portal_person(uuid, uuid, text, text, text, text, text, integer, text, text, text)
  to anon;

-- 3d. delete_portal_person
create or replace function public.delete_portal_person(p_token uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
begin
  select couple_id into v_couple_id from _resolve_portal_couple(p_token);

  if v_couple_id is null then
    raise exception 'Invalid portal token';
  end if;

  delete from portal_people where id = p_id and couple_id = v_couple_id;
end;
$$;

grant execute on function public.delete_portal_person(uuid, uuid)
  to anon;

-- 3e. save_portal_contact
create or replace function public.save_portal_contact(
  p_token    uuid,
  p_name     text,
  p_email    text,
  p_phone    text,
  p_category text,
  p_notes    text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id  uuid;
  v_user_id    uuid;
  v_contact_id uuid;
begin
  select couple_id, owner_id into v_couple_id, v_user_id
  from _resolve_portal_couple(p_token);

  if v_couple_id is null then
    raise exception 'Invalid portal token';
  end if;

  insert into contacts (
    user_id, name, email, phone, category, notes, status, contact_name
  )
  values (v_user_id, p_name, p_email, p_phone, p_category, p_notes, 'active', '')
  returning id into v_contact_id;

  insert into couple_contacts (couple_id, contact_id, user_id)
  values (v_couple_id, v_contact_id, v_user_id)
  on conflict do nothing;

  return v_contact_id;
end;
$$;

grant execute on function public.save_portal_contact(uuid, text, text, text, text, text)
  to anon;

-- 3f. save_portal_song
create or replace function public.save_portal_song(
  p_token    uuid,
  p_id       uuid,
  p_category text,
  p_title    text,
  p_artist   text,
  p_notes    text,
  p_position integer
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
  select couple_id, owner_id into v_couple_id, v_user_id
  from _resolve_portal_couple(p_token);

  if v_couple_id is null then
    raise exception 'Invalid portal token';
  end if;

  insert into portal_songs (
    id, couple_id, user_id, category, title, artist, notes, position
  )
  values (p_id, v_couple_id, v_user_id, p_category, p_title, p_artist, p_notes, p_position)
  on conflict (id) do update set
    title    = excluded.title,
    artist   = excluded.artist,
    notes    = excluded.notes,
    position = excluded.position
  returning id into v_result_id;

  return v_result_id;
end;
$$;

grant execute on function public.save_portal_song(uuid, uuid, text, text, text, text, integer)
  to anon;

-- 3g. delete_portal_song
create or replace function public.delete_portal_song(p_token uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
begin
  select couple_id into v_couple_id from _resolve_portal_couple(p_token);

  if v_couple_id is null then
    raise exception 'Invalid portal token';
  end if;

  delete from portal_songs where id = p_id and couple_id = v_couple_id;
end;
$$;

grant execute on function public.delete_portal_song(uuid, uuid)
  to anon;

-- 3h. delete_portal_file
create or replace function public.delete_portal_file(p_token uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
begin
  select couple_id into v_couple_id from _resolve_portal_couple(p_token);

  if v_couple_id is null then
    raise exception 'Invalid portal token';
  end if;

  delete from portal_files where id = p_id and couple_id = v_couple_id;
end;
$$;

grant execute on function public.delete_portal_file(uuid, uuid)
  to anon;

-- ── 4. Rewrite vow RPCs: drop old signatures, add new ones ──────────

-- 4a. Drop old save_portal_vow(token, id, who, content) signature
-- @ALLOW_DESTRUCTIVE: Replace with new 3-arg signature that derives who from viewer
drop function if exists public.save_portal_vow(uuid, uuid, text, text);

-- 4b. New save_portal_vow(token, id, content) — who is derived from viewer
create or replace function public.save_portal_vow(
  p_token   uuid,
  p_id      uuid,
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
  v_viewer    text;
  v_result_id uuid;
begin
  select couple_id, owner_id, viewer into v_couple_id, v_user_id, v_viewer
  from _resolve_portal_couple(p_token);

  if v_couple_id is null then
    raise exception 'Invalid portal token';
  end if;

  insert into vows (id, couple_id, user_id, who, content)
  values (coalesce(p_id, gen_random_uuid()), v_couple_id, v_user_id, v_viewer, p_content)
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

grant execute on function public.save_portal_vow(uuid, uuid, text)
  to anon;

-- 4c. Rewrite delete_portal_vow: only allow deletion of viewer's own vow
create or replace function public.delete_portal_vow(p_token uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_viewer    text;
begin
  select couple_id, viewer into v_couple_id, v_viewer
  from _resolve_portal_couple(p_token);

  if v_couple_id is null then
    raise exception 'Invalid portal token';
  end if;

  delete from vows
  where id = p_id and couple_id = v_couple_id and who = v_viewer;
end;
$$;

grant execute on function public.delete_portal_vow(uuid, uuid)
  to anon;

-- ── 5. Rewrite get_portal_data: add viewer context, privacy-filter vows ──
--
-- Base: 20260615000100 definition. Changes:
-- - Resolve token via helper to get viewer role
-- - Add 'viewer', 'primary_name', 'secondary_name' to returned JSON
-- - Filter vows: ONLY include the viewer's own vow (critical privacy gate)
create or replace function public.get_portal_data(token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id        uuid;
  v_user_id          uuid;
  v_viewer           text;
  v_event_id         uuid;
  v_portal_sections  jsonb;
  result             jsonb;
begin
  -- Resolve either partner token to (couple, owner, viewer)
  select couple_id, owner_id, viewer into v_couple_id, v_user_id, v_viewer
  from _resolve_portal_couple(token);

  if v_couple_id is null then
    return null;
  end if;

  -- Get primary event (first upcoming, else most recent)
  select id into v_event_id
  from events
  where couple_id = v_couple_id
  order by
    case when date >= current_date then 0 else 1 end,
    date asc
  limit 1;

  -- Load portal section settings
  select portal_sections into v_portal_sections
  from public.user_branding
  where user_id = v_user_id;

  if v_portal_sections is null then
    select raw_user_meta_data -> 'portal_sections'
    into v_portal_sections
    from auth.users
    where id = v_user_id;
  end if;

  -- Build result with viewer context and privacy-filtered vows
  select jsonb_build_object(
    'viewer',           v_viewer,
    'couple_id',        v_couple_id,
    'couple_name',      c.name,
    'couple_email',     c.email,
    'primary_name',     c.primary_name,
    'secondary_name',   c.secondary_name,
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
        from vows v where v.couple_id = v_couple_id and v.who = v_viewer),
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

grant execute on function public.get_portal_data(uuid)
  to anon;

-- ── Vendor RPC unchanged ────────────────────────────────────────────
-- get_vendor_timeline and is_valid_portal_token stay on portal_token.
-- No changes needed; vendor flow is unaffected by partner tokens.
