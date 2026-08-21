-- Questionnaire description on the public fill page.
--
-- The template's description was collected in the builder but never
-- snapshotted onto the couple's questionnaire, so the couple-facing page
-- had nothing to render. Snapshot it at send time (code side) the same
-- way title/questions are, and expose it through the public RPC.

alter table couple_questionnaires
  add column if not exists description text;

comment on column couple_questionnaires.description is
  'Intro text shown under the title on the public fill page. '
  'Snapshotted from questionnaire_templates.description at send time.';

-- ── Extend get_public_questionnaire to include the description ──────────────
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
    'description', q.description,
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
