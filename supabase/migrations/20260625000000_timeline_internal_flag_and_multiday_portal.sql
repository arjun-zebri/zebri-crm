-- Timeline: MC-only "internal" items + multi-day public portals
--
-- Two related changes that ship together because they touch the same
-- public timeline RPCs:
--
-- 1. INTERNAL FLAG. The auto-inserted "Sunset" item is a planning cue
--    for the MC (golden-hour photos, ceremony light). It must stay on
--    the MC's own dashboard timeline but never appear on any client- or
--    vendor-facing surface. A new `internal` boolean carries that: the
--    Sunset auto-insert sets it true and the three public RPCs filter
--    `internal = false`. The flag generalises to any future MC-only item.
--
-- 2. MULTI-DAY PORTALS. A couple can have more than one event, and more
--    than one event can fall on the same calendar day. The couple portal
--    and vendor run sheet now expose the full set of events and tag every
--    timeline item with its `event_id`, so the client can offer a per-day
--    selector and merge same-day events into one chronological run sheet.
--    (The legacy /timeline/[token] link stays single-event by design — it
--    is keyed by one event's share_token.)

-- ── 1. Add the internal flag ────────────────────────────────────────
alter table public.timeline_items
  add column if not exists internal boolean not null default false;

comment on column public.timeline_items.internal is
  'MC-only: when true the item is hidden from every public surface '
  '(couple portal, vendor run sheet, public timeline link) and shows '
  'only on the MC dashboard. Used by the auto-inserted Sunset item.';

-- One-time backfill: existing auto-inserted Sunset rows predate the
-- flag. Match by title (only ever done here, never at runtime) and
-- scope to confirmed MC items so we never touch a couple suggestion
-- that happens to be titled "Sunset".
update public.timeline_items
   set internal = true
 where title = 'Sunset'
   and pending_review = false
   and internal = false;

-- ── 2. get_public_timeline: hide internal items ─────────────────────
-- Legacy single-event public link. Base: 20260327000001. Only change
-- is the `ti.internal = false` guard on the timeline subquery.
create or replace function get_public_timeline(token uuid)
returns json
language plpgsql
security definer
as $$
declare
  result json;
begin
  select json_build_object(
    'date', e.date,
    'venue', e.venue,
    'couple', json_build_object('name', c.name),
    'mc', json_build_object(
      'business_name', u.raw_user_meta_data->>'business_name',
      'display_name',  u.raw_user_meta_data->>'display_name',
      'email',         u.email,
      'phone',         u.raw_user_meta_data->>'phone'
    ),
    'timeline_items', coalesce(
      (
        select json_agg(
          json_build_object(
            'id',           ti.id,
            'start_time',   to_char(ti.start_time, 'HH24:MI'),
            'title',        ti.title,
            'description',  ti.description,
            'duration_min', ti.duration_min,
            'position',     ti.position,
            'contact', case
              when co.id is not null then json_build_object('name', co.name, 'category', co.category)
              else null
            end
          )
          order by ti.start_time nulls last, ti.position
        )
        from timeline_items ti
        left join contacts co on co.id = ti.contact_id
        where ti.event_id = e.id
          and ti.internal = false
      ),
      '[]'::json
    )
  )
  into result
  from events e
  join couples c on c.id = e.couple_id
  join auth.users u on u.id = e.user_id
  where e.share_token = token
    and e.share_token_enabled = true;

  return result;
end;
$$;

-- ── 3. get_vendor_timeline: all events + per-item event_id ──────────
-- Base: 20260409000000. Now returns the couple's full event list and
-- tags every timeline item with its event_id so the vendor page can
-- offer a per-day selector. Internal items are filtered out.
create or replace function get_vendor_timeline(token uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_couple_id  uuid;
  result       json;
begin
  select id into v_couple_id
  from couples
  where portal_token = token and portal_token_enabled = true;

  if v_couple_id is null then
    return null;
  end if;

  select json_build_object(
    'events', coalesce(
      (select json_agg(
        json_build_object('id', ev.id, 'date', ev.date::text, 'venue', ev.venue)
        order by ev.date asc
      ) from events ev where ev.couple_id = v_couple_id),
      '[]'::json
    ),
    'timeline_items', coalesce(
      (select json_agg(
        json_build_object(
          'id', ti.id,
          'event_id', ti.event_id,
          'start_time', to_char(ti.start_time, 'HH24:MI'),
          'title', ti.title,
          'description', ti.description,
          'duration_min', ti.duration_min,
          'position', ti.position,
          'pending_review', ti.pending_review
        ) order by ti.start_time nulls last, ti.position
      )
      from timeline_items ti
      join events ev2 on ev2.id = ti.event_id
      where ev2.couple_id = v_couple_id
        and ti.internal = false),
      '[]'::json
    )
  )
  into result;

  return result;
end;
$$;

-- ── 4. get_portal_data: all events' timeline + per-item event_id ────
-- Base: 20260617000000. Two changes to the timeline_items key:
--   (a) aggregate across ALL of the couple's events (not just the
--       soonest) so the client can group by day, tagging each item
--       with its event_id; and
--   (b) filter `ti.internal = false`.
-- Everything else — including the per-partner vow privacy filter and
-- the contact/song/payment/branding keys — is carried over verbatim.
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
  select couple_id, owner_id, viewer into v_couple_id, v_user_id, v_viewer
  from _resolve_portal_couple(token);

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
    'viewer',           v_viewer,
    'couple_id',        v_couple_id,
    'couple_name',      c.name,
    'couple_email',     c.email,
    'primary_name',     c.primary_name,
    'primary_email',    c.primary_email,
    'primary_phone',    c.primary_phone,
    'secondary_name',   c.secondary_name,
    'secondary_email',  c.secondary_email,
    'secondary_phone',  c.secondary_phone,
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
    'timeline_items', coalesce(
      (select jsonb_agg(jsonb_build_object('id', ti.id, 'start_time', to_char(ti.start_time, 'HH24:MI'),
          'title', ti.title, 'description', ti.description,
          'duration_min', ti.duration_min, 'position', ti.position,
          'pending_review', ti.pending_review, 'event_id', ti.event_id)
        order by ti.start_time nulls last, ti.position)
        from timeline_items ti
        join events ev2 on ev2.id = ti.event_id
        where ev2.couple_id = v_couple_id and ti.internal = false),
      '[]'::jsonb
    ),
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

-- ── 5. save_portal_timeline_item: attach to a chosen event ──────────
-- A couple suggestion must land on the event for the day the couple is
-- viewing, not always the soonest event. Add an optional p_event_id;
-- when provided and owned by the couple it wins, otherwise we fall back
-- to the soonest event (prior behaviour). The 6-arg signature is
-- dropped in favour of this 7-arg one — only the portal client calls it
-- and it is updated in the same change.
drop function if exists public.save_portal_timeline_item(uuid, uuid, text, text, text, integer);

create or replace function public.save_portal_timeline_item(
  p_token        uuid,
  p_id           uuid,
  p_start_time   text,
  p_title        text,
  p_description  text,
  p_duration_min integer,
  p_event_id     uuid default null
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

  -- Prefer the caller-supplied event when it belongs to this couple;
  -- otherwise fall back to the soonest upcoming event.
  if p_event_id is not null then
    select id into v_event_id from events
    where id = p_event_id and couple_id = v_couple_id;
  end if;

  if v_event_id is null then
    select id into v_event_id from events
    where couple_id = v_couple_id
    order by case when date >= current_date then 0 else 1 end, date asc
    limit 1;
  end if;

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

grant execute on function public.save_portal_timeline_item(uuid, uuid, text, text, text, integer, uuid)
  to anon;
