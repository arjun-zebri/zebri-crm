-- Branding overhaul: surface enablement + first-run onboarding flag,
-- preview-phase data reset, and branding for the vendor timeline +
-- questionnaire public surfaces.

alter table public.user_branding
  add column if not exists enabled_surfaces jsonb not null
    default '["proposal","invoice","contract","portal","vendorTimeline","questionnaire"]'::jsonb,
  add column if not exists onboarded_at timestamptz;

comment on column public.user_branding.enabled_surfaces is
  'Which branding surfaces the user opted into during onboarding. Disabled surfaces hide their editor tab; live pages fall back to the default layout with scalar branding.';
comment on column public.user_branding.onboarded_at is
  'Null until the user completes (or skips through) the branding onboarding wizard.';

-- Preview-phase reset (product decision 2026-07-16): the branding editor has
-- only ever shipped as a preview. Wipe saved kits and per-surface block
-- layouts so every user re-onboards onto the new template system. Scalars
-- (colors, fonts, logo, business info in auth metadata) are untouched.
update public.user_branding
set brand_kits = '[]'::jsonb,
    branding_blocks = null,
    updated_at = now();

-- ── Extend get_vendor_timeline to include branding ──────────────────────────
create or replace function get_vendor_timeline(token uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_couple_id  uuid;
  v_user_id    uuid;
  result       json;
begin
  select id, user_id into v_couple_id, v_user_id
  from couples
  where portal_token = token and portal_token_enabled = true;

  if v_couple_id is null then
    return null;
  end if;

  select json_build_object(
    'events', coalesce(
      (select json_agg(
        json_build_object('id', ev.id, 'date', ev.date::text, 'venue', ev.venue)
        order by ev.date asc
      ) from events ev where ev.couple_id = v_couple_id),
      '[]'::json
    ),
    'timeline_items', coalesce(
      (select json_agg(
        json_build_object(
          'id', ti.id,
          'event_id', ti.event_id,
          'start_time', to_char(ti.start_time, 'HH24:MI'),
          'title', ti.title,
          'description', ti.description,
          'duration_min', ti.duration_min,
          'position', ti.position,
          'pending_review', ti.pending_review
        ) order by ti.start_time nulls last, ti.position
      )
      from timeline_items ti
      join events ev2 on ev2.id = ti.event_id
      where ev2.couple_id = v_couple_id
        and ti.internal = false),
      '[]'::json
    ),
    'branding', coalesce(_user_branding(v_user_id)::json, '{}'::json),
    'branding_blocks', coalesce(_user_branding_blocks(v_user_id, 'vendorTimeline')::json, null)
  )
  into result;

  return result;
end;
$$;

-- ── Extend get_public_questionnaire to include branding_blocks ──────────────
create or replace function get_public_questionnaire(token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  result jsonb;
begin
  -- Stamp viewed_at = now() if this is the first access (viewed_at is null).
  update couple_questionnaires
  set viewed_at = now(),
      updated_at = now()
  where share_token = token
    and share_token_enabled = true
    and viewed_at is null;

  -- Build and return the payload.
  select jsonb_build_object(
    'id', q.id,
    'title', q.title,
    'status', q.status,
    'display_mode', q.display_mode,
    'questions', q.questions,
    'responses', q.responses,
    'completed_at', q.completed_at,
    'couple_name', cp.name,
    'branding_blocks', _user_branding_blocks(q.user_id, 'questionnaire')
  ) || coalesce(_user_branding(q.user_id), '{}'::jsonb)
  into result
  from couple_questionnaires q
  join couples cp on cp.id = q.couple_id
  where q.share_token = token
    and q.share_token_enabled = true;

  return result;
end;
$$;
