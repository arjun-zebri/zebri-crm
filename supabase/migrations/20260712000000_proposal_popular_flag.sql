-- ────────────────────────────────────────────────────────────────
-- "Most popular" flag for packages + proposal options
-- ────────────────────────────────────────────────────────────────
--
-- An MC can mark one package template as their most popular. The flag
-- snapshots into a proposal option at apply time (like the commercial
-- terms), and the public proposal chooser badges it — but only when a
-- proposal offers more than one option, so a single-option proposal
-- never shows a lone "most popular" tag. Purely presentational: it
-- never affects pricing or acceptance.
--
-- Idempotent adds so a re-run / from-zero replay is clean.

alter table packages
  add column if not exists is_popular boolean not null default false;

alter table proposal_options
  add column if not exists is_popular boolean not null default false;

-- Recreate get_public_proposal so each option carries `is_popular`.
-- (create or replace preserves the anon grant; re-granted below to
-- match the original definition and survive a fresh replay.)
create or replace function get_public_proposal(token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'proposal_number', p.proposal_number,
    'status', p.status,
    'notes', p.notes,
    'expires_at', p.expires_at,
    'accepted_at', p.accepted_at,
    'accepted_option_id', p.accepted_option_id,
    'accepted_addon_selection', p.accepted_addon_selection,
    'couple_name', c.name,
    'business_name', (
      select u.raw_user_meta_data->>'business_name'
      from auth.users u
      where u.id = p.user_id
    ),
    'options', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', po.id,
            'title', po.title,
            'description', po.description,
            'deposit_percent', po.deposit_percent,
            'gst_inclusive', po.gst_inclusive,
            'is_popular', po.is_popular,
            'subtotal', po.subtotal,
            'position', po.position,
            'items', (
              select coalesce(
                jsonb_agg(
                  jsonb_build_object(
                    'id', poi.id,
                    'description', poi.description,
                    'amount', poi.amount,
                    'is_addon', poi.is_addon,
                    'default_included', poi.default_included,
                    'position', poi.position
                  ) order by poi.position
                ),
                '[]'::jsonb
              )
              from proposal_option_items poi
              where poi.option_id = po.id
            )
          ) order by po.position
        ),
        '[]'::jsonb
      )
      from proposal_options po
      where po.proposal_id = p.id
    )
  ) || coalesce(_user_branding(p.user_id), '{}'::jsonb)
  into result
  from proposals p
  join couples c on c.id = p.couple_id
  where p.share_token = token
    and p.share_token_enabled = true;

  return result;
end;
$$;

grant execute on function get_public_proposal(uuid) to anon;
