-- Public-facing surfaces (quote, invoice, contract, portal) previously received
-- only logo_url, brand_color, business_name and tagline. The branding editor
-- stores a far richer payload (favicon, header banner, full colour palette,
-- fonts, density, corner radius). This migration plumbs that full scalar
-- payload through every public RPC so the couple-facing pages can apply it.
--
-- Block trees (public.user_branding.branding_blocks) are deliberately NOT
-- exposed here — that requires a read-only public renderer and is a separate
-- piece of work.

create or replace function _user_branding(p_user_id uuid)
returns jsonb
language sql
security definer
stable
as $$
  select jsonb_build_object(
    'logo_url',                  raw_user_meta_data->>'logo_url',
    'favicon_url',               raw_user_meta_data->>'favicon_url',
    'header_image_url',          raw_user_meta_data->>'header_image_url',
    'brand_color',               coalesce(raw_user_meta_data->>'brand_color',   '#A7F3D0'),
    'accent_color',              coalesce(raw_user_meta_data->>'accent_color',  '#111827'),
    'surface_color',             coalesce(raw_user_meta_data->>'surface_color', '#ffffff'),
    'text_color',                coalesce(raw_user_meta_data->>'text_color',    '#111827'),
    'muted_color',               coalesce(raw_user_meta_data->>'muted_color',   '#6B7280'),
    'business_name',             raw_user_meta_data->>'business_name',
    'tagline',                   raw_user_meta_data->>'tagline',
    'abn',                       raw_user_meta_data->>'abn',
    'phone',                     raw_user_meta_data->>'phone',
    'website',                   raw_user_meta_data->>'website',
    'instagram_url',             raw_user_meta_data->>'instagram_url',
    'facebook_url',              raw_user_meta_data->>'facebook_url',
    'show_contact_on_documents', coalesce((raw_user_meta_data->>'show_contact_on_documents')::boolean, true),
    'font_heading',              coalesce(raw_user_meta_data->>'font_heading',   'inter'),
    'font_body',                 coalesce(raw_user_meta_data->>'font_body',      'inter'),
    'font_weight',               coalesce((raw_user_meta_data->>'font_weight')::int,      600),
    'font_body_weight',          coalesce((raw_user_meta_data->>'font_body_weight')::int, 400),
    'font_scale',                coalesce((raw_user_meta_data->>'font_scale')::numeric, 1),
    'density',                   coalesce(raw_user_meta_data->>'density',       'cozy'),
    'corner_radius',             coalesce((raw_user_meta_data->>'corner_radius')::int, 12),
    'theme_preset',              coalesce(raw_user_meta_data->>'theme_preset',  'minimal')
  )
  from auth.users
  where id = p_user_id;
$$;

revoke all on function _user_branding(uuid) from public, anon, authenticated;

-- ── get_public_quote ──────────────────────────────────────────────────────────
create or replace function get_public_quote(token uuid)
returns jsonb language plpgsql security definer as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', q.id,
    'title', q.title,
    'quote_number', q.quote_number,
    'status', q.status,
    'subtotal', q.subtotal,
    'tax_rate', q.tax_rate,
    'discount_type', q.discount_type,
    'discount_value', q.discount_value,
    'notes', q.notes,
    'expires_at', q.expires_at,
    'accepted_at', q.accepted_at,
    'couple_name', c.name,
    'items', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', qi.id,
            'description', qi.description,
            'amount', qi.amount,
            'position', qi.position
          ) order by qi.position
        ),
        '[]'::jsonb
      )
      from quote_items qi
      where qi.quote_id = q.id
    )
  ) || coalesce(_user_branding(q.user_id), '{}'::jsonb)
  into result
  from quotes q
  join couples c on c.id = q.couple_id
  where q.share_token = token
    and q.share_token_enabled = true;

  return result;
end;
$$;

-- ── get_public_invoice ────────────────────────────────────────────────────────
create or replace function get_public_invoice(token uuid)
returns jsonb language plpgsql security definer as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', i.id,
    'invoice_number', i.invoice_number,
    'title', i.title,
    'status', i.status,
    'subtotal', i.subtotal,
    'tax_rate', i.tax_rate,
    'discount_type', i.discount_type,
    'discount_value', i.discount_value,
    'due_date', i.due_date,
    'payment_terms', i.payment_terms,
    'notes', i.notes,
    'paid_at', i.paid_at,
    'share_token', i.share_token,
    'deposit_percent', i.deposit_percent,
    'deposit_due_date', i.deposit_due_date,
    'deposit_paid_at', i.deposit_paid_at,
    'final_due_date', i.final_due_date,
    'final_paid_at', i.final_paid_at,
    'stripe_payment_enabled', i.stripe_payment_enabled,
    'couple_name', c.name,
    -- Bank + Stripe live in user_metadata but aren't part of the branding helper.
    'bank_account_name', (
      select raw_user_meta_data->>'bank_account_name'
      from auth.users where id = i.user_id
    ),
    'bank_bsb', (
      select raw_user_meta_data->>'bank_bsb'
      from auth.users where id = i.user_id
    ),
    'bank_account_number', (
      select raw_user_meta_data->>'bank_account_number'
      from auth.users where id = i.user_id
    ),
    'stripe_connect_enabled', (
      select (raw_user_meta_data->>'stripe_connect_enabled')::boolean
      from auth.users where id = i.user_id
    ),
    'items', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', ii.id,
            'description', ii.description,
            'quantity', ii.quantity,
            'unit_price', ii.unit_price,
            'amount', ii.amount,
            'position', ii.position
          ) order by ii.position
        ),
        '[]'::jsonb
      )
      from invoice_items ii
      where ii.invoice_id = i.id
    )
  ) || coalesce(_user_branding(i.user_id), '{}'::jsonb)
  into result
  from invoices i
  join couples c on c.id = i.couple_id
  where i.share_token = token
    and i.share_token_enabled = true;

  return result;
end;
$$;

-- ── get_public_contract ───────────────────────────────────────────────────────
create or replace function get_public_contract(token uuid)
returns jsonb language plpgsql security definer as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', c.id,
    'title', c.title,
    'contract_number', c.contract_number,
    'status', c.status,
    'locked_content_html', c.locked_content_html,
    'expires_at', c.expires_at,
    'signed_at', c.signed_at,
    'signer_name', c.signer_name,
    'signer_ip', c.signer_ip,
    'signer_user_agent', c.signer_user_agent,
    'declined_at', c.declined_at,
    'declined_reason', c.declined_reason,
    'mc_signature_name', c.mc_signature_name,
    'email_sent_at', c.email_sent_at,
    'couple_name', cp.name
  ) || coalesce(_user_branding(c.user_id), '{}'::jsonb)
  into result
  from contracts c
  join couples cp on cp.id = c.couple_id
  where c.share_token = token
    and c.share_token_enabled = true
    and c.status <> 'revoked';

  return result;
end;
$$;

-- ── get_portal_data ───────────────────────────────────────────────────────────
-- The original signature returned `json` (not jsonb); CREATE OR REPLACE refuses
-- to change a function's return type, so we preserve `json` here and cast the
-- final jsonb assembly back to json at the return site.
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
    'branding', _user_branding(v_user_id)
  )
  into result
  from couples c
  left join events e on e.id = v_event_id
  where c.id = v_couple_id;

  return result::json;
end;
$$;

grant execute on function get_public_quote(uuid)    to anon;
grant execute on function get_public_invoice(uuid)  to anon;
grant execute on function get_public_contract(uuid) to anon;
grant execute on function get_portal_data(uuid)     to anon;
