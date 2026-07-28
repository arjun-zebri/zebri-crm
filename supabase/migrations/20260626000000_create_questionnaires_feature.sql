-- Couple questionnaires
--
-- Two tables mirroring the contracts shape:
--   * questionnaire_templates — MC-owned reusable templates (full control).
--   * couple_questionnaires    — per-couple instances. `questions` is a
--     snapshot taken at send time so later template edits never mutate a
--     questionnaire the couple has already been sent (same principle as the
--     contract locked_content snapshot).
--
-- Public access is token-gated via share_token / share_token_enabled and the
-- three SECURITY DEFINER RPCs below, exactly like get_public_contract /
-- sign_contract. The anon client never touches the tables directly.

-- questionnaire_templates table
create table questionnaire_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  -- Ordered array of question objects: { id, type, label, help_text, required, options[] }
  questions jsonb not null default '[]'::jsonb,
  is_starter boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- couple_questionnaires table (per-couple instances)
create table couple_questionnaires (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid not null references couples(id) on delete cascade,
  template_id uuid references questionnaire_templates(id) on delete set null,
  title text not null,
  -- Snapshot of the template questions at send time (decoupled from the template).
  questions jsonb not null default '[]'::jsonb,
  -- Couple answers keyed by question id.
  responses jsonb not null default '{}'::jsonb,
  status text not null default 'draft', -- draft | sent | completed
  share_token uuid not null default gen_random_uuid(),
  share_token_enabled boolean not null default false,
  sent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS — owner-only on both tables.
alter table questionnaire_templates enable row level security;
alter table couple_questionnaires enable row level security;

create policy "Users manage own questionnaire_templates" on questionnaire_templates for all using (user_id = auth.uid());
create policy "Users manage own couple_questionnaires" on couple_questionnaires for all using (user_id = auth.uid());

-- Indexes
create index questionnaire_templates_user_id_idx on questionnaire_templates(user_id);
create index couple_questionnaires_user_id_idx on couple_questionnaires(user_id);
create index couple_questionnaires_couple_id_idx on couple_questionnaires(couple_id);
create index couple_questionnaires_template_id_idx on couple_questionnaires(template_id);
create index couple_questionnaires_share_token_idx on couple_questionnaires(share_token);

-- get_public_questionnaire — anon-safe read via share token.
-- Returns questions + current responses + status, with branding merged at the
-- top level the same way get_public_contract does. Null when the token is
-- missing or disabled (the public page renders a generic 404).
create or replace function get_public_questionnaire(token uuid)
returns jsonb language plpgsql security definer as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', q.id,
    'title', q.title,
    'status', q.status,
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

-- save_questionnaire_progress — anon-safe autosave of partial answers.
-- No status change; blocked once the questionnaire is completed.
create or replace function save_questionnaire_progress(token uuid, p_responses jsonb)
returns jsonb language plpgsql security definer as $$
declare
  q record;
begin
  select * into q
  from couple_questionnaires
  where share_token = token and share_token_enabled = true;

  if not found then
    return '{"error":"not_found"}'::jsonb;
  end if;

  if q.status = 'completed' then
    return '{"error":"already_completed"}'::jsonb;
  end if;

  update couple_questionnaires
  set responses = coalesce(p_responses, '{}'::jsonb),
      updated_at = now()
  where id = q.id;

  return '{"success":true}'::jsonb;
end;
$$;

-- submit_questionnaire — anon-safe final submission. Stores answers, stamps
-- completed_at, flips status to completed, and spawns a follow-up task for the
-- MC (mirrors the sign_contract follow-up-task pattern).
create or replace function submit_questionnaire(token uuid, p_responses jsonb)
returns jsonb language plpgsql security definer as $$
declare
  q record;
  couple record;
begin
  select * into q
  from couple_questionnaires
  where share_token = token and share_token_enabled = true;

  if not found then
    return '{"error":"not_found"}'::jsonb;
  end if;

  if q.status = 'completed' then
    return '{"error":"already_completed"}'::jsonb;
  end if;

  update couple_questionnaires
  set responses = coalesce(p_responses, '{}'::jsonb),
      status = 'completed',
      completed_at = now(),
      updated_at = now()
  where id = q.id;

  select * into couple from couples where id = q.couple_id;

  insert into tasks (user_id, title, due_date, status, related_couple_id)
  values (
    q.user_id,
    'Questionnaire completed by ' || couple.name || ' — review answers',
    current_date,
    'todo',
    q.couple_id
  );

  return '{"success":true}'::jsonb;
end;
$$;

-- updated_at triggers (touch_updated_at defined in the contracts migration).
create trigger questionnaire_templates_touch_updated_at
  before update on questionnaire_templates
  for each row execute function touch_updated_at();

create trigger couple_questionnaires_touch_updated_at
  before update on couple_questionnaires
  for each row execute function touch_updated_at();

-- Grants for the public-facing RPCs.
grant execute on function get_public_questionnaire(uuid) to anon;
grant execute on function save_questionnaire_progress(uuid, jsonb) to anon;
grant execute on function submit_questionnaire(uuid, jsonb) to anon;
