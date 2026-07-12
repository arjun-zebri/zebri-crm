-- ────────────────────────────────────────────────────────────────
-- Proposal public page: return the branding block tree
-- ────────────────────────────────────────────────────────────────
--
-- The proposal branding surface is now a block tree (chrome blocks
-- around a fixed `proposalBody` core, plus an editable Accept action
-- block and a Footer). For the MC's customised layout — button colour
-- / label, footer + ABN, extra text blocks — to reach the couple's
-- page, `get_public_proposal` must return the saved block tree, the
-- same way get_public_invoice / get_public_contract already do via
-- `_user_branding_blocks`.
--
-- Recreate get_public_proposal adding one key: `branding_blocks`. All
-- existing keys preserved. Read-only assembly, replay-clean.

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
    'branding_blocks', _user_branding_blocks(p.user_id, 'proposal'),
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
