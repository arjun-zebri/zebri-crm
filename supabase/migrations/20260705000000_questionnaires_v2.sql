-- Questionnaires v2 — add display_mode and viewed_at tracking
--
-- Extends the questionnaires tables with:
--   1. display_mode on both questionnaire_templates and couple_questionnaires
--      ('typeform' | 'form'), used to control UI rendering on the portal.
--   2. viewed_at on couple_questionnaires (null → now() on first portal open),
--      recording when the couple first accessed the link.
--   3. Enhances get_public_questionnaire to include display_mode in the payload
--      and stamp viewed_at exactly once when the token is first accessed.
--   4. Adds an AFTER UPDATE trigger on couple_questionnaires that fires when
--      status transitions to 'completed' and emits a 'questionnaire_completed'
--      automation event.
--
-- Idempotent: column-add with `if not exists`, function with `create or replace`,
-- trigger with `drop if exists` + `create`.

-- ── Add display_mode to questionnaire_templates ───────────────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'questionnaire_templates' and column_name = 'display_mode'
  ) then
    alter table public.questionnaire_templates
    add column display_mode text not null default 'typeform';
  end if;
end $$;

-- ── Add display_mode and viewed_at to couple_questionnaires ──────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'couple_questionnaires' and column_name = 'display_mode'
  ) then
    alter table public.couple_questionnaires
    add column display_mode text not null default 'typeform';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'couple_questionnaires' and column_name = 'viewed_at'
  ) then
    alter table public.couple_questionnaires
    add column viewed_at timestamptz;
  end if;
end $$;

-- ── Replace get_public_questionnaire to include display_mode and stamp viewed_at
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
    'couple_name', cp.name
  ) || coalesce(_user_branding(q.user_id), '{}'::jsonb)
  into result
  from couple_questionnaires q
  join couples cp on cp.id = q.couple_id
  where q.share_token = token
    and q.share_token_enabled = true;

  return result;
end;
$$;

-- ── Automation event trigger for questionnaire completion ────────────────────
create or replace function public.tg_couple_questionnaires_emit_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    perform public.emit_automation_event(
      new.user_id,
      'couple_questionnaires',
      new.id,
      'questionnaire_completed',
      jsonb_build_object(
        'questionnaire_id', new.id,
        'couple_id', new.couple_id,
        'template_id', new.template_id,
        'title', new.title,
        'share_token', new.share_token,
        'sent_at', new.sent_at,
        'completed_at', new.completed_at
      ),
      new.couple_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists couple_questionnaires_emit_completed on public.couple_questionnaires;
create trigger couple_questionnaires_emit_completed
  after update on public.couple_questionnaires
  for each row execute function public.tg_couple_questionnaires_emit_completed();
