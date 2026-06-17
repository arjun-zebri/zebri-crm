-- ============================================================
-- Portal Overview: editable couple contact details
-- ============================================================
--
-- The Overview tab now lets either partner edit BOTH contact triples
-- (primary + secondary name / email / phone) directly from the portal.
-- There is intentionally no privacy boundary on contact info — whoever
-- holds any valid link can edit both. (Vow privacy stays per-partner;
-- this migration does not touch it.)
--
-- Two changes:
--   1. New save_portal_couple_details RPC (anon, security definer).
--   2. get_portal_data also returns primary/secondary email + phone so
--      the Overview can hydrate the editable fields.

-- ── 1. save_portal_couple_details ───────────────────────────────────
--
-- Resolves either partner token to the couple, then updates the couple
-- row's primary/secondary contact triples. Empty strings are stored as
-- NULL; every field is trimmed and length-capped defensively (the
-- caller is anon — same hardening as the other save_portal_* RPCs).
create or replace function public.save_portal_couple_details(
  p_token            uuid,
  p_primary_name     text,
  p_primary_email    text,
  p_primary_phone    text,
  p_secondary_name   text,
  p_secondary_email  text,
  p_secondary_phone  text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
begin
  select couple_id into v_couple_id
  from _resolve_portal_couple(p_token);

  if v_couple_id is null then
    raise exception 'Invalid portal token';
  end if;

  update public.couples set
    primary_name     = nullif(left(trim(p_primary_name), 200), ''),
    primary_email    = nullif(left(trim(p_primary_email), 200), ''),
    primary_phone    = nullif(left(trim(p_primary_phone), 50), ''),
    secondary_name   = nullif(left(trim(p_secondary_name), 200), ''),
    secondary_email  = nullif(left(trim(p_secondary_email), 200), ''),
    secondary_phone  = nullif(left(trim(p_secondary_phone), 50), '')
  where id = v_couple_id;
end;
$$;

grant execute on function public.save_portal_couple_details(uuid, text, text, text, text, text, text)
  to anon;

comment on function public.save_portal_couple_details(uuid, text, text, text, text, text, text) is
  'Update a couple''s primary/secondary contact triples from the public '
  'portal. Either partner token may edit both triples (no privacy gate).';

-- ── 2. get_portal_data: expose primary/secondary email + phone ──────
--
-- Base: 20260616000000 definition. Only change is four added keys in
-- the result JSON (primary_email, primary_phone, secondary_email,
-- secondary_phone). Everything else — including the per-partner vow
-- privacy filter — is carried over verbatim.
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
