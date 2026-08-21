-- Portal package selection.
--
-- Lets a couple pick which of the MC's packages they are going with from
-- the public portal, and lets the MC see/override that choice on the
-- couple profile. The choice is a single FK on couples; `on delete set
-- null` so deleting a package never blocks on (or cascades to) couples.

alter table couples
  add column if not exists selected_package_id uuid
    references packages(id) on delete set null;

comment on column couples.selected_package_id is
  'The package this couple has chosen (picked in the portal or recorded '
  'by the MC on the couple profile). Null until a choice is made.';

-- FK columns get an index (project convention).
create index if not exists couples_selected_package_id_idx
  on couples(selected_package_id);

-- ── Read: the MC's offerable packages + the couple's current choice ─────────
--
-- Separate RPC (not folded into get_portal_data) following the
-- get_portal_questionnaires precedent for newer portal sections.
-- Price shown is the sum of REQUIRED items only (amount is per-unit, so
-- quantity multiplies); optional add-ons don't inflate the headline price.
create or replace function public.get_portal_packages(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_user_id   uuid;
  result      jsonb;
begin
  select couple_id, owner_id into v_couple_id, v_user_id
  from _resolve_portal_couple(p_token);

  if v_couple_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'selected_package_id', (select selected_package_id from couples where id = v_couple_id),
    'packages', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'description', p.description,
        'gst_inclusive', p.gst_inclusive,
        'total_amount', coalesce((
          select sum(i.amount * i.quantity)
          from package_items i
          where i.package_id = p.id and not i.optional
        ), 0)
      ) order by p.position, p.created_at
    ), '[]'::jsonb)
  )
  into result
  from packages p
  where p.user_id = v_user_id
    and p.archived_at is null;

  return result;
end;
$$;

grant execute on function public.get_portal_packages(uuid) to anon;

comment on function public.get_portal_packages(uuid) is
  'List the owning MC''s live (non-archived) packages for the couple '
  'portal, plus the couple''s currently selected package id.';

-- ── Write: record the couple's choice ────────────────────────────────────────
create or replace function public.save_portal_package(
  p_token      uuid,
  p_package_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_user_id   uuid;
begin
  select couple_id, owner_id into v_couple_id, v_user_id
  from _resolve_portal_couple(p_token);

  if v_couple_id is null then
    raise exception 'Invalid portal token';
  end if;

  -- Null clears the choice. Otherwise the package must belong to this
  -- couple's MC and still be live; this is the cross-tenant guard (a token
  -- can never point its couple at another MC's package).
  if p_package_id is not null and not exists (
    select 1 from packages
    where id = p_package_id
      and user_id = v_user_id
      and archived_at is null
  ) then
    raise exception 'Invalid package';
  end if;

  update couples
  set selected_package_id = p_package_id
  where id = v_couple_id;
end;
$$;

grant execute on function public.save_portal_package(uuid, uuid) to anon;

comment on function public.save_portal_package(uuid, uuid) is
  'Set (or clear, with null) the couple''s selected package from the '
  'public portal. Token-guarded; only the owning MC''s live packages '
  'are accepted.';
