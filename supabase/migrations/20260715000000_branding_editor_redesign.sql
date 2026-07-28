-- ────────────────────────────────────────────────────────────────
-- Branding editor redesign: extend _user_branding with typography
-- and global layout fields
-- ────────────────────────────────────────────────────────────────
--
-- Task 0.3: extend `_user_branding(uuid)` to include the new global
-- typography, layout, and component-style fields consumed by the
-- public pages and the branding editor preview.
--
-- Each field is coalesced to its default from `buildPublicBranding`:
-- - heading_size:             32 (px)
-- - body_size:                15 (px)
-- - heading_case:            'none' (none|uppercase|capitalize)
-- - body_case:               'none' (none|uppercase|capitalize)
-- - heading_letter_spacing:   0 (px)
-- - body_line_height:        1.5 (unitless multiplier)
-- - link_color:              brand_color (text color for links)
-- - button_variant:          'fill' (fill|outline)
-- - button_size:             'md' (sm|md|lg)
-- - button_radius:           8 (px)
-- - section_spacing:         32 (px)
-- - page_background:         surface_color (page bg, defaults to surface)
--
-- The per-RPC functions (get_public_proposal, get_public_invoice, etc.)
-- already spread _user_branding in their top-level merge, so no changes
-- to those functions are needed. proposal_labels already passes through
-- as jsonb — still a string→text passthrough until the UI saves styled
-- shapes.
--
-- `_user_branding` is a pure read-assembly, so a `create or replace`
-- is safe and replay-clean.

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
    'secondary_color',           coalesce(raw_user_meta_data->>'secondary_color',      '#FFFFFF'),
    'secondary_text_color',      coalesce(raw_user_meta_data->>'secondary_text_color', '#374151'),
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
    'doc_padding',               coalesce((raw_user_meta_data->>'doc_padding')::int, 0),
    'proposal_labels',           coalesce(raw_user_meta_data->'proposal_labels', '{}'::jsonb),
    'theme_preset',              coalesce(raw_user_meta_data->>'theme_preset',  'minimal'),
    'heading_size',              coalesce((raw_user_meta_data->>'heading_size')::int, 32),
    'body_size',                 coalesce((raw_user_meta_data->>'body_size')::int, 15),
    'heading_case',              coalesce(raw_user_meta_data->>'heading_case', 'none'),
    'body_case',                 coalesce(raw_user_meta_data->>'body_case', 'none'),
    'heading_letter_spacing',    coalesce((raw_user_meta_data->>'heading_letter_spacing')::int, 0),
    'body_line_height',          coalesce((raw_user_meta_data->>'body_line_height')::numeric, 1.5),
    'link_color',                coalesce(raw_user_meta_data->>'link_color', coalesce(raw_user_meta_data->>'brand_color', '#A7F3D0')),
    'button_variant',            coalesce(raw_user_meta_data->>'button_variant', 'fill'),
    'button_size',               coalesce(raw_user_meta_data->>'button_size', 'md'),
    'button_radius',             coalesce((raw_user_meta_data->>'button_radius')::int, 8),
    'section_spacing',           coalesce((raw_user_meta_data->>'section_spacing')::int, 32),
    'page_background',           coalesce(raw_user_meta_data->>'page_background', coalesce(raw_user_meta_data->>'surface_color', '#ffffff'))
  )
  from auth.users
  where id = p_user_id;
$$;
