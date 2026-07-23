-- FEATURE: expose twitter_url / pinterest_url / website_url via _user_branding
--
-- Social URLs (twitter_url, pinterest_url) live in auth.users.raw_user_meta_data
-- alongside the existing instagram_url and facebook_url. The website key is
-- aliased as website_url in the branding output so public surfaces (footer links,
-- document branding blocks) can render social links consistently.
--
-- This recreation of _user_branding(p_user_id uuid) adds three fields to the
-- jsonb_build_object() return:
--   - twitter_url: u.raw_user_meta_data->>'twitter_url'
--   - pinterest_url: u.raw_user_meta_data->>'pinterest_url'
--   - website_url: u.raw_user_meta_data->>'website' (alias for existing website key)

create or replace function _user_branding(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  select jsonb_build_object(
    'logo_url',                  raw_user_meta_data->>'logo_url',
    'favicon_url',               raw_user_meta_data->>'favicon_url',
    'header_image_url',          raw_user_meta_data->>'header_image_url',
    'brand_color',               coalesce(raw_user_meta_data->>'brand_color',   '#111827'),
    -- accent_color dropped as a control; derived = brand_color.
    'accent_color',              coalesce(raw_user_meta_data->>'brand_color',   '#111827'),
    'surface_color',             coalesce(raw_user_meta_data->>'surface_color', '#FFFFFF'),
    'heading_color',             coalesce(raw_user_meta_data->>'heading_color', '#111827'),
    'subheading_color',          coalesce(raw_user_meta_data->>'subheading_color', '#111827'),
    'text_color',                coalesce(raw_user_meta_data->>'text_color',    '#6B7280'),
    -- muted_color dropped as a control; derived = text_color (body).
    'muted_color',               coalesce(raw_user_meta_data->>'text_color',    '#6B7280'),
    'secondary_color',           coalesce(raw_user_meta_data->>'secondary_color',      '#6B7280'),
    -- secondary_text_color no longer rendered (sites compute contrast locally);
    -- kept for payload back-compat, defaulted.
    'secondary_text_color',      coalesce(raw_user_meta_data->>'secondary_text_color', '#FFFFFF'),
    'business_name',             raw_user_meta_data->>'business_name',
    'tagline',                   raw_user_meta_data->>'tagline',
    'abn',                       raw_user_meta_data->>'abn',
    'phone',                     raw_user_meta_data->>'phone',
    'website',                   raw_user_meta_data->>'website',
    'instagram_url',             raw_user_meta_data->>'instagram_url',
    'facebook_url',              raw_user_meta_data->>'facebook_url',
    'twitter_url',               raw_user_meta_data->>'twitter_url',
    'pinterest_url',             raw_user_meta_data->>'pinterest_url',
    'website_url',               raw_user_meta_data->>'website',
    'show_contact_on_documents', coalesce((raw_user_meta_data->>'show_contact_on_documents')::boolean, true),
    'font_heading',              coalesce(raw_user_meta_data->>'font_heading',   'inter'),
    'font_body',                 coalesce(raw_user_meta_data->>'font_body',      'inter'),
    'font_weight',               coalesce((raw_user_meta_data->>'font_weight')::int,      600),
    'font_body_weight',          coalesce((raw_user_meta_data->>'font_body_weight')::int, 400),
    'font_scale',                coalesce((raw_user_meta_data->>'font_scale')::numeric, 1),
    'density',                   coalesce(raw_user_meta_data->>'density',       'cozy'),
    'corner_radius',             coalesce((raw_user_meta_data->>'corner_radius')::int, 12),
    'doc_padding',               coalesce((raw_user_meta_data->>'doc_padding')::int, 0),
    'proposal_labels',           coalesce(raw_user_meta_data->'proposal_labels', '{}'::jsonb),
    'theme_preset',              coalesce(raw_user_meta_data->>'theme_preset',  'minimal'),
    'heading_size',              coalesce((raw_user_meta_data->>'heading_size')::int, 32),
    'body_size',                 coalesce((raw_user_meta_data->>'body_size')::int, 15),
    'heading_case',              coalesce(raw_user_meta_data->>'heading_case', 'none'),
    'body_case',                 coalesce(raw_user_meta_data->>'body_case', 'none'),
    -- Subheading role controls (from 20260721). Each falls back to the value the
    -- sectionLabel role used to derive, so untouched documents are unchanged.
    'subheading_size',           coalesce(
                                   (raw_user_meta_data->>'subheading_size')::int,
                                   greatest(9, round(coalesce((raw_user_meta_data->>'body_size')::numeric, 15) * 0.73)::int)
                                 ),
    'subheading_weight',         coalesce(
                                   (raw_user_meta_data->>'subheading_weight')::int,
                                   (raw_user_meta_data->>'font_body_weight')::int,
                                   400
                                 ),
    'subheading_case',           coalesce(
                                   raw_user_meta_data->>'subheading_case',
                                   raw_user_meta_data->>'heading_case',
                                   'none'
                                 ),
    -- Fractional em value (e.g. 0.04).
    'heading_letter_spacing',    coalesce((raw_user_meta_data->>'heading_letter_spacing')::numeric, 0),
    'body_line_height',          coalesce((raw_user_meta_data->>'body_line_height')::numeric, 1.5),
    'link_color',                coalesce(raw_user_meta_data->>'link_color', coalesce(raw_user_meta_data->>'brand_color', '#111827')),
    'border_color',              coalesce(raw_user_meta_data->>'border_color', '#E5E7EB'),
    'button_variant',            coalesce(raw_user_meta_data->>'button_variant', 'fill'),
    'button_size',               coalesce(raw_user_meta_data->>'button_size', 'md'),
    'button_radius',             coalesce((raw_user_meta_data->>'button_radius')::int, 8),
    'section_spacing',           coalesce((raw_user_meta_data->>'section_spacing')::int, 32),
    -- page_background dropped as a control; derived = surface_color.
    'page_background',           coalesce(raw_user_meta_data->>'surface_color', '#FFFFFF')
  )
  from auth.users
  where id = p_user_id;
$$;

revoke all on function _user_branding(uuid) from public, anon, authenticated;
