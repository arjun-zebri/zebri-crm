-- Exit rules: a workflow names the stages that stop it for a couple
-- (workflows trust remediation, Phase 3, Task 21).
--
-- A nurture sequence has to stop when the couple books, or when the MC
-- marks them lost. Until now the only way was to open each couple and
-- press Stop, so a couple moved to Lost kept receiving "just checking
-- in" emails until someone noticed.
--
-- 1. `workflow_templates.exit_statuses` lists the stages that stop the
--    workflow. Each entry is a `couple_statuses.slug`, the value
--    `couples.status` holds and `tg_couples_emit_stage_changed` sends as
--    `to_status`. That is the same form the stage-changed apply rule
--    stores in `toStatus`, so both sides compare like with like. The app
--    lower-cases entries on save (lib/workflows/exit-rules.ts), because
--    the native apply rule compares case-insensitively.
-- 2. `exit_workflow_instances_for_stage` is the dispatcher's single
--    statement per `couple_stage_changed` event: it cancels the couple's
--    running and paused instances of every workflow of that MC whose
--    exit list holds the new stage, with `cancelled_reason = 'exit_rule'`.
--    The trigger from 20261011000000 then marks their open steps
--    `cancelled` in the same statement.
--
-- Lock order is template, then instance, the one global order every
-- workflow RPC keeps (Task 22 fix round 2): the matching templates are
-- locked `for share` first, so a concurrent Turn off, delete or save of
-- the exit list either finishes first or waits for this.
--
-- A `running` step is not touched (the trigger leaves it alone): a send
-- the executor already claimed finishes, the same rule as Turn off.
--
-- The couple's own to-do list and the MC's personal list are never
-- touched: they are not sequences, and they carry no template anyway.
--
-- security invoker, executable by service_role only: the dispatcher runs
-- from the cron tick through the service-role client.
--
-- Additive: one new column with a default, and one new function.

-- 1. The stages that stop the workflow.
alter table public.workflow_templates
  add column if not exists exit_statuses text[] not null default '{}';

comment on column public.workflow_templates.exit_statuses is
  'Stages (couple_statuses.slug, lower-cased) that stop this workflow for a '
  'couple. When a couple moves into one, the dispatcher cancels its running '
  'and paused instances of this workflow with cancelled_reason exit_rule. '
  'Must not contain a stage the workflow''s own stage-changed rule starts on '
  '(refused at save).';

-- 2. The dispatcher's exit statement.
create or replace function public.exit_workflow_instances_for_stage(
  p_user_id uuid,
  p_couple_id uuid,
  p_to_status text
)
returns table (instance_id uuid, couple_id uuid, workflow text, stage text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_stage text := lower(coalesce(p_to_status, ''));
  v_stage_name text;
begin
  if v_stage = '' or p_couple_id is null then
    return;
  end if;

  -- Template first. Ordered so two sessions lock the same rows in the
  -- same order.
  perform 1
     from public.workflow_templates t
    where t.user_id = p_user_id
      and t.exit_statuses @> array[v_stage]
    order by t.id
    for share;

  -- The stage's display name for the audit line, falling back to the
  -- slug when the stage row has since been deleted.
  select s.name into v_stage_name
    from public.couple_statuses s
   where s.user_id = p_user_id
     and lower(s.slug) = v_stage
   limit 1;

  return query
    update public.workflow_instances i
       set status = 'cancelled',
           cancelled_reason = 'exit_rule',
           completed_at = now()
      from public.workflow_templates t
     where t.id = i.template_id
       and t.user_id = p_user_id
       and t.exit_statuses @> array[v_stage]
       and i.user_id = p_user_id
       and i.couple_id = p_couple_id
       and i.status in ('active', 'paused')
       and not i.is_default
       and not i.is_personal
    returning i.id, i.couple_id, t.name, coalesce(v_stage_name, v_stage);
end;
$$;

comment on function public.exit_workflow_instances_for_stage(uuid, uuid, text) is
  'Exit rules: cancels the couple''s active and paused instances of the '
  'owner''s workflows whose exit_statuses contain the new stage, with '
  'cancelled_reason exit_rule. Locks the matching templates for share '
  'first (template then instance). Returns one row per cancelled instance '
  'with the workflow name and the stage name for the audit line. Service '
  'role only.';

revoke all on function public.exit_workflow_instances_for_stage(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.exit_workflow_instances_for_stage(uuid, uuid, text)
  to service_role;
