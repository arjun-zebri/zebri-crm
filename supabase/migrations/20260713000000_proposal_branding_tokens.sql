-- ────────────────────────────────────────────────────────────────
-- Proposal branding: expose doc_padding + editable proposal labels
-- ────────────────────────────────────────────────────────────────
--
-- The proposal page now consumes the full brand kit — including the
-- document padding and the MC's custom section wording. Both already
-- live in `user_metadata` (the branding editor writes them); this
-- migration adds them to the `_user_branding` payload so the PUBLIC
-- page (via get_public_proposal / get_public_invoice / etc., which all
-- merge `_user_branding`) reflects them too, not just the in-app
-- preview.
--
-- `_user_branding` is a plain read-assembly with no side effects, so a
-- straight recreate is safe + replay-clean. All existing keys are
-- preserved; two are added: `doc_padding` and `proposal_labels`.

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
    'theme_preset',              coalesce(raw_user_meta_data->>'theme_preset',  'minimal')
  )
  from auth.users
  where id = p_user_id;
$$;
