-- Move bulky branding data (block trees, saved kits, portal section toggles)
-- out of auth.users.raw_user_meta_data, which is JWT-encoded into cookies.
-- Once the contract template had 13 full clauses, the chunked auth cookie was
-- hitting Node's default 8KB header limit and producing HTTP 431 errors on
-- /branding loads.

create table if not exists public.user_branding (
  user_id uuid primary key references auth.users(id) on delete cascade,
  branding_blocks jsonb,
  brand_kits jsonb not null default '[]'::jsonb,
  portal_sections jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_branding_updated_at on public.user_branding(updated_at desc);

alter table public.user_branding enable row level security;

-- Users can only see / change their own row.
create policy user_branding_select on public.user_branding
  for select using (auth.uid() = user_id);

create policy user_branding_insert on public.user_branding
  for insert with check (auth.uid() = user_id);

create policy user_branding_update on public.user_branding
  for update using (auth.uid() = user_id);

create policy user_branding_delete on public.user_branding
  for delete using (auth.uid() = user_id);

-- One-time migration: copy existing values out of user metadata into the new
-- table so users do not lose their work, then null the metadata fields so
-- the JWT shrinks back down.
do $$
declare
  u record;
begin
  for u in
    select id,
           raw_user_meta_data
    from auth.users
    where raw_user_meta_data ? 'branding_blocks'
       or raw_user_meta_data ? 'brand_kits'
       or raw_user_meta_data ? 'portal_sections'
  loop
    insert into public.user_branding (user_id, branding_blocks, brand_kits, portal_sections)
    values (
      u.id,
      u.raw_user_meta_data -> 'branding_blocks',
      coalesce(u.raw_user_meta_data -> 'brand_kits', '[]'::jsonb),
      u.raw_user_meta_data -> 'portal_sections'
    )
    on conflict (user_id) do update
      set branding_blocks = excluded.branding_blocks,
          brand_kits      = excluded.brand_kits,
          portal_sections = excluded.portal_sections;

    update auth.users
       set raw_user_meta_data = raw_user_meta_data
            - 'branding_blocks'
            - 'brand_kits'
            - 'portal_sections'
     where id = u.id;
  end loop;
end $$;

-- get_portal_data now reads portal section visibility from user_branding so it
-- keeps working after the field is stripped from user_metadata.
CREATE OR REPLACE FUNCTION get_portal_data(token uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_couple_id        uuid;
  v_user_id          uuid;
  v_event_id         uuid;
  v_portal_sections  jsonb;
  result             json;
BEGIN
  SELECT id, user_id INTO v_couple_id, v_user_id
  FROM couples
  WHERE portal_token = token AND portal_token_enabled = true;

  IF v_couple_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_event_id
  FROM events
  WHERE couple_id = v_couple_id
  ORDER BY
    CASE WHEN date >= current_date THEN 0 ELSE 1 END,
    date ASC
  LIMIT 1;

  -- Prefer the new user_branding table; fall back to user_metadata for users
  -- who haven't re-saved since the migration.
  SELECT portal_sections INTO v_portal_sections
  FROM public.user_branding
  WHERE user_id = v_user_id;

  IF v_portal_sections IS NULL THEN
    SELECT raw_user_meta_data -> 'portal_sections'
    INTO v_portal_sections
    FROM auth.users
    WHERE id = v_user_id;
  END IF;

  SELECT json_build_object(
    'couple_id',    v_couple_id,
    'couple_name',  c.name,
    'couple_email', c.email,
    'enabled_sections', CASE
      WHEN v_portal_sections IS NULL THEN NULL::json
      ELSE (
        SELECT json_agg(key ORDER BY key)
        FROM jsonb_each_text(v_portal_sections)
        WHERE value = 'true'
      )
    END,
    'event', CASE WHEN v_event_id IS NOT NULL THEN
      json_build_object('id', e.id, 'date', e.date::text, 'venue', e.venue)
    ELSE NULL END,
    'events', COALESCE(
      (SELECT json_agg(json_build_object('id', ev.id, 'date', ev.date::text, 'venue', ev.venue, 'status', ev.status) ORDER BY ev.date ASC)
        FROM events ev WHERE ev.couple_id = v_couple_id),
      '[]'::json
    ),
    'people', COALESCE(
      (SELECT json_agg(json_build_object(
          'id', p.id, 'category', p.category, 'full_name', p.full_name,
          'phonetic', p.phonetic, 'role', p.role, 'audio_url', p.audio_url,
          'position', p.position, 'notes', p.notes, 'email', p.email, 'phone', p.phone)
        ORDER BY p.category, p.position, p.created_at)
        FROM portal_people p WHERE p.couple_id = v_couple_id),
      '[]'::json
    ),
    'contacts', COALESCE(
      (SELECT json_agg(json_build_object('id', ct.id, 'name', ct.name, 'category', ct.category,
          'email', ct.email, 'phone', ct.phone) ORDER BY ct.name)
        FROM couple_contacts cc
        JOIN contacts ct ON ct.id = cc.contact_id
        WHERE cc.couple_id = v_couple_id),
      '[]'::json
    ),
    'songs', COALESCE(
      (SELECT json_agg(json_build_object('id', s.id, 'category', s.category, 'title', s.title,
          'artist', s.artist, 'notes', s.notes, 'position', s.position)
        ORDER BY s.category, s.position, s.created_at)
        FROM portal_songs s WHERE s.couple_id = v_couple_id),
      '[]'::json
    ),
    'song_categories', COALESCE(
      (SELECT json_agg(json_build_object('key', key, 'label', label, 'description', description, 'position', position) ORDER BY position)
        FROM portal_song_categories WHERE couple_id = v_couple_id),
      '[]'::json
    ),
    'files', COALESCE(
      (SELECT json_agg(json_build_object('id', f.id, 'name', f.name, 'file_url', f.file_url,
          'file_size', f.file_size, 'created_at', f.created_at) ORDER BY f.created_at)
        FROM portal_files f WHERE f.couple_id = v_couple_id),
      '[]'::json
    ),
    'timeline_items', CASE WHEN v_event_id IS NOT NULL THEN COALESCE(
      (SELECT json_agg(json_build_object('id', ti.id, 'start_time', to_char(ti.start_time, 'HH24:MI'),
          'title', ti.title, 'description', ti.description,
          'duration_min', ti.duration_min, 'position', ti.position, 'pending_review', ti.pending_review)
        ORDER BY ti.start_time NULLS LAST, ti.position)
        FROM timeline_items ti WHERE ti.event_id = v_event_id),
      '[]'::json
    ) ELSE '[]'::json END,
    'payments', json_build_object(
      'quotes', COALESCE(
        (SELECT json_agg(json_build_object('id', q.id, 'title', q.title, 'quote_number', q.quote_number,
            'status', q.status, 'subtotal', q.subtotal,
            'share_token', q.share_token, 'share_token_enabled', q.share_token_enabled)
          ORDER BY q.created_at DESC)
          FROM quotes q WHERE q.couple_id = v_couple_id),
        '[]'::json
      ),
      'invoices', COALESCE(
        (SELECT json_agg(json_build_object('id', inv.id, 'title', inv.title, 'invoice_number', inv.invoice_number,
            'status', inv.status, 'subtotal', inv.subtotal, 'due_date', inv.due_date::text,
            'share_token', inv.share_token, 'share_token_enabled', inv.share_token_enabled)
          ORDER BY inv.created_at DESC)
          FROM invoices inv WHERE inv.couple_id = v_couple_id),
        '[]'::json
      )
    ),
    'contracts', COALESCE(
      (SELECT json_agg(json_build_object(
          'id', ctr.id,
          'title', ctr.title,
          'contract_number', ctr.contract_number,
          'status', ctr.status,
          'share_token', ctr.share_token,
          'share_token_enabled', ctr.share_token_enabled,
          'email_sent_at', ctr.email_sent_at,
          'signed_at', ctr.signed_at
        ) ORDER BY ctr.created_at DESC)
        FROM contracts ctr
        WHERE ctr.couple_id = v_couple_id
          AND ctr.status IN ('sent', 'signed', 'declined', 'expired')
          AND ctr.share_token_enabled = true),
      '[]'::json
    )
  )
  INTO result
  FROM couples c
  LEFT JOIN events e ON e.id = v_event_id
  WHERE c.id = v_couple_id;

  RETURN result;
END;
$$;
