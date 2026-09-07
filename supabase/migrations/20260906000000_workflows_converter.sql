-- One-time conversion of the legacy Tasks and Automations data into the
-- unified Workflows model.
--
-- Not destructive: it only reads the legacy tables and writes new rows.
-- The legacy tables are frozen in 20260907000000 and dropped in Phase F,
-- so this migration is the single bridge between the two models. Guarded
-- by a ledger so a replay (local `supabase db reset`, a re-run in CI) is
-- a no-op rather than a duplicating second pass.


-- ────────────────────────────────────────────────────────────────
-- Provenance columns
-- ────────────────────────────────────────────────────────────────
-- Every converted row remembers where it came from. Three jobs:
--   1. idempotency, for both this migration and lib/workflows/converter.ts
--      (the per-user re-run tool the integration test drives);
--   2. answering "where did this step come from?" during the cutover;
--   3. mapping a legacy parent to its converted parent without relying on
--      insert ordering against a self-referencing foreign key.

alter table public.workflow_steps
  add column if not exists legacy_task_id uuid;
alter table public.workflow_templates
  add column if not exists legacy_automation_id uuid;
alter table public.workflow_templates
  add column if not exists template_slug text;
alter table public.workflow_template_steps
  add column if not exists legacy_action_id uuid;

create unique index if not exists workflow_steps_legacy_task_idx
  on public.workflow_steps (legacy_task_id)
  where legacy_task_id is not null;
create unique index if not exists workflow_templates_legacy_automation_idx
  on public.workflow_templates (legacy_automation_id)
  where legacy_automation_id is not null;
create unique index if not exists workflow_template_steps_legacy_action_idx
  on public.workflow_template_steps (legacy_action_id)
  where legacy_action_id is not null;

comment on column public.workflow_steps.legacy_task_id is
  'The tasks row this step was converted from, if any. Null for everything created natively.';
comment on column public.workflow_templates.legacy_automation_id is
  'The automations row this template was converted from, if any.';
comment on column public.workflow_templates.template_slug is
  'Starter-library provenance carried over from automations.template_slug.';
comment on column public.workflow_template_steps.legacy_action_id is
  'The automation_actions row this step was converted from, if any.';


-- ────────────────────────────────────────────────────────────────
-- Conversion ledger
-- ────────────────────────────────────────────────────────────────
create table if not exists public.workflow_conversion_ledger (
  id text primary key,
  converted_at timestamptz not null default now(),
  detail jsonb not null default '{}'::jsonb
);

comment on table public.workflow_conversion_ledger is
  'Records which one-time data conversions have run. No RLS: service-role and migrations only.';


-- ────────────────────────────────────────────────────────────────
-- The conversion
-- ────────────────────────────────────────────────────────────────
do $$
declare
  v_tasks_converted     int := 0;
  v_tasks_skipped       int := 0;
  v_automations         int := 0;
  v_active_templates    int := 0;
  v_draft_templates     int := 0;
  v_steps_converted     int := 0;
  v_warnings            jsonb := '[]'::jsonb;
  v_row                 record;
begin
  if exists (
    select 1 from public.workflow_conversion_ledger
    where id = 'tasks_and_automations_v1'
  ) then
    raise notice 'workflows converter: already run, skipping';
    return;
  end if;

  -- Nothing to convert on a fresh database (a local reset, a preview
  -- branch). Still write the ledger so a later replay stays a no-op.
  if to_regclass('public.tasks') is null or to_regclass('public.automations') is null then
    insert into public.workflow_conversion_ledger (id, detail)
    values ('tasks_and_automations_v1', jsonb_build_object('skipped', 'legacy tables absent'));
    return;
  end if;

  -- ── 1. Every couple needs a default instance to hang to-dos on ──
  -- The couples INSERT trigger creates one for new couples; couples that
  -- predate it have none, and a converted task with nowhere to land would
  -- be silently dropped.
  insert into public.workflow_instances (user_id, couple_id, name, is_default)
  select c.user_id, c.id, 'General', true
  from public.couples c
  where not exists (
    select 1 from public.workflow_instances i
    where i.couple_id = c.id and i.is_default
  );

  -- ── 2. A personal instance per user with unlinked tasks ──
  insert into public.workflow_instances (user_id, couple_id, name, is_personal)
  select distinct t.user_id, null::uuid, 'My to-dos', true
  from public.tasks t
  where t.related_couple_id is null
    and not exists (
      select 1 from public.workflow_instances i
      where i.user_id = t.user_id and i.is_personal
    );

  -- ── 3. Tasks whose couple is gone are skipped, not guessed at ──
  select count(*) into v_tasks_skipped
  from public.tasks t
  where t.related_couple_id is not null
    and not exists (select 1 from public.couples c where c.id = t.related_couple_id);

  for v_row in
    select t.id, t.title
    from public.tasks t
    where t.related_couple_id is not null
      and not exists (select 1 from public.couples c where c.id = t.related_couple_id)
  loop
    v_warnings := v_warnings || to_jsonb(
      format('Task %s (%s) skipped: its couple no longer exists.', v_row.id, v_row.title)
    );
  end loop;

  -- ── 4. Tasks become to-do steps ──
  -- `due_date` is a date. Read at midnight in the MC's own timezone: a
  -- plain UTC cast moves an Australian task onto the previous day.
  -- `position` is renumbered per instance so the checklist reads in the
  -- order the MC had it, with no gaps.
  with ranked as (
    select
      t.*,
      coalesce(i.id, p.id) as instance_id,
      coalesce(s.timezone, 'Australia/Sydney') as tz,
      row_number() over (
        partition by coalesce(i.id, p.id)
        order by t.position, t.created_at
      ) as new_position
    from public.tasks t
    left join public.couples c on c.id = t.related_couple_id
    left join public.workflow_instances i
      on i.couple_id = t.related_couple_id and i.is_default
    left join public.workflow_instances p
      on t.related_couple_id is null and p.user_id = t.user_id and p.is_personal
    left join public.user_public_settings s on s.user_id = t.user_id
    where (t.related_couple_id is null or c.id is not null)
  )
  insert into public.workflow_steps (
    instance_id, legacy_task_id, position, type, config, title, description,
    timing, due_at, status, completed_at, created_at
  )
  select
    r.instance_id,
    r.id,
    r.new_position,
    'todo',
    '{}'::jsonb,
    r.title,
    r.description,
    '{"mode":"after_previous","delayAmount":0,"unit":"days"}'::jsonb,
    case when r.due_date is null then null
         else (r.due_date::timestamp at time zone r.tz) end,
    -- Every legacy status, built-in or custom, collapses to the checklist
    -- binary. That simplification is the point of the new model.
    case when r.status = 'done' then 'done' else 'pending' end,
    case when r.status = 'done' then r.created_at else null end,
    r.created_at
  from ranked r
  where r.instance_id is not null
  on conflict (legacy_task_id) where legacy_task_id is not null do nothing;

  get diagnostics v_tasks_converted = row_count;

  -- Record what the checklist model drops rather than losing it silently.
  for v_row in
    select t.id, t.title, t.priority, t.task_type, t.group_id
    from public.tasks t
    where t.priority is not null or t.task_type is not null or t.group_id is not null
  loop
    v_warnings := v_warnings || to_jsonb(format(
      'Task %s (%s): dropped priority=%s task_type=%s group_id=%s. Steps are checklist-simple.',
      v_row.id, v_row.title,
      coalesce(v_row.priority, '-'), coalesce(v_row.task_type, '-'),
      coalesce(v_row.group_id::text, '-')
    ));
  end loop;

  -- ── 5. Automations become templates ──
  -- Every legacy trigger keeps working through the `on_event` apply rule,
  -- which matches an automation_events row by type. Draft, paused and
  -- archived all land as draft: a converted workflow the MC can open,
  -- read and activate beats an archived one they cannot touch.
  insert into public.workflow_templates (
    user_id, legacy_automation_id, name, description, status,
    apply_rule_type, apply_rule_config,
    quiet_hours_start, quiet_hours_end, branch_depth_limit,
    template_slug, version, created_at
  )
  select
    a.user_id,
    a.id,
    a.name,
    a.description,
    case when a.status = 'active' then 'active' else 'draft' end,
    'on_event',
    jsonb_build_object('eventType', a.trigger_type, 'triggerConfig', a.trigger_config),
    a.quiet_hours_start,
    a.quiet_hours_end,
    a.branch_depth_limit,
    a.template_slug,
    a.version,
    a.created_at
  from public.automations a
  on conflict (legacy_automation_id) where legacy_automation_id is not null do nothing;

  get diagnostics v_automations = row_count;

  select
    count(*) filter (where status = 'active'),
    count(*) filter (where status = 'draft')
  into v_active_templates, v_draft_templates
  from public.workflow_templates
  where legacy_automation_id is not null;

  -- ── 6. Actions become template steps ──
  -- Parents are wired up in a second statement: a single ordered insert
  -- would rely on row order satisfying the self-referencing foreign key.
  -- `wait` and `branch` are step types in their own right; every other
  -- action slug moves into config.actionType, which is the whole
  -- adapter contract the builder speaks.
  insert into public.workflow_template_steps (
    template_id, legacy_action_id, position, type, config, title,
    timing, requires_approval, disabled, canvas_x, canvas_y, created_at
  )
  select
    t.id,
    act.id,
    act.position,
    case when act.type in ('wait', 'branch') then act.type else 'action' end,
    case
      when act.type in ('wait', 'branch') then coalesce(act.config, '{}'::jsonb)
      else coalesce(act.config, '{}'::jsonb) || jsonb_build_object('actionType', act.type)
    end,
    coalesce(act.label, ''),
    -- An automation's action chain was implicitly sequential, so every
    -- converted step waits on the one before it.
    '{"mode":"after_previous","delayAmount":0,"unit":"days"}'::jsonb,
    false,
    act.disabled,
    -- Seeded from the old canvas where it was saved; otherwise a simple
    -- column, so a converted template opens readable rather than as a
    -- pile of nodes at the origin.
    coalesce(act.position_x, 0),
    coalesce(act.position_y, act.position * 160),
    act.created_at
  from public.automation_actions act
  join public.workflow_templates t on t.legacy_automation_id = act.automation_id
  on conflict (legacy_action_id) where legacy_action_id is not null do nothing;

  get diagnostics v_steps_converted = row_count;

  update public.workflow_template_steps s
  set parent_step_id = p.id,
      branch_path = act.branch_path
  from public.automation_actions act
  join public.workflow_template_steps p on p.legacy_action_id = act.parent_action_id
  where s.legacy_action_id = act.id
    and act.parent_action_id is not null
    and act.branch_path is not null
    and s.parent_step_id is null;

  -- ── 7. In-flight runs ──
  -- Runs are not converted: an applied instance IS the run in the new
  -- model, and there is no faithful mapping from a half-walked action
  -- DAG onto a snapshot. Production had none in flight at the audit; if
  -- any exist the report names them so they can be handled by hand.
  for v_row in
    select r.id, r.automation_id
    from public.automation_runs r
    where r.status in ('running', 'waiting', 'paused')
  loop
    v_warnings := v_warnings || to_jsonb(format(
      'Automation run %s (automation %s) was in flight and was NOT converted.',
      v_row.id, v_row.automation_id
    ));
  end loop;

  insert into public.workflow_conversion_ledger (id, detail)
  values (
    'tasks_and_automations_v1',
    jsonb_build_object(
      'tasksConverted', v_tasks_converted,
      'tasksSkipped', v_tasks_skipped,
      'automationsConverted', v_automations,
      'activeTemplates', v_active_templates,
      'draftTemplates', v_draft_templates,
      'stepsConverted', v_steps_converted,
      'warnings', v_warnings
    )
  );

  raise notice 'workflows converter: % tasks, % skipped, % automations, % steps',
    v_tasks_converted, v_tasks_skipped, v_automations, v_steps_converted;
end;
$$;
