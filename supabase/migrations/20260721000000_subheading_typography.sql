-- Adds the subheading text role as its own global control: size, weight, and
-- case. The `sectionLabel` role (invoice "Ref"/"Expires", "Account name"/
-- "BSB"/"Account number", and every other small label) used to derive these
-- from the heading/body scale; they are now first-class so MCs can style every
-- label at once. Colour already exists (subheading_color).
--
-- No DDL: the values live in auth.users raw_user_meta_data JSONB, surfaced by
-- _user_branding's COALESCE list, so this is a pure function replacement.
--
-- Each new key COALESCEs to the value the role derived before, so existing
-- documents render identically until the MC touches the subheading controls:
--   subheading_size   -> round(body_size * 0.73), min 9
--   subheading_weight -> font_body_weight
--   subheading_case   -> heading_case
-- No data backfill: the coalesce fallbacks cover unset accounts, so nothing is
-- overwritten (no destructive marker needed).
--
-- NOTE: this file inherited a latent bug (heading_letter_spacing cast ::int) and
-- must NOT be edited to fix it — it is already applied. The fix lives in the
-- later migration 20260722000000_fix_letter_spacing_cast.sql.

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
    -- Subheading role controls. Each falls back to the value the sectionLabel
    -- role used to derive, so untouched documents are unchanged.
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
    'heading_letter_spacing',    coalesce((raw_user_meta_data->>'heading_letter_spacing')::int, 0),
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
