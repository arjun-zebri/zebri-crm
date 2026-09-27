-- Stopping a workflow marks its steps cancelled, and records why
-- (workflows trust remediation, Phase 3, Task 22).
--
-- Until now a stopped (cancelled) instance kept its unstarted steps as
-- `pending` or `waiting`. The executor never ran them, because it only
-- runs `active` instances, but every reader that looks at a step on its
-- own saw live work: a stopped workflow read as "still to come". And
-- nothing said why a workflow had stopped, so Resume could not tell an
-- MC's own stop from a setup that died half way (steps possibly missing)
-- or a workflow that no longer exists.
--
-- 1. `workflow_steps.status` admits `cancelled`.
-- 2. `workflow_instances.cancelled_reason` records why the instance was
--    stopped. Existing cancelled rows stay null (reason unknown).
-- 3. A trigger marks an instance's `pending` and `waiting` steps
--    `cancelled` in the same statement that flips the instance to
--    `cancelled`. A trigger rather than a second write in each caller:
--    there are five cancel paths today (the Stop action, Stop
--    everything, deleting a workflow, an apply that failed, the sweep for
--    an apply that died) and a sixth is coming (exit rules). One place
--    means none of them can forget, and none can half do it.
-- 4. `delete_workflow_template` records `template_deleted`.
-- 5. Steps already sitting open on a cancelled instance are marked, so
--    the rule holds for every row, not only the ones stopped from now on.
--
-- A `running` step is left alone on purpose: the executor has claimed
-- it, and an in-flight send finishes (the same rule as Turn off, Task
-- 17). `done`, `skipped` and `errored` are history and are left alone.
--
-- Resume reverses 3: the app flips the instance's `cancelled` steps back
-- to `pending` before it settles the overdue ones and flips the instance
-- (app/(dashboard)/workflows/instance-actions.ts, lib/workflows/resume.ts).

-- 1. Admit `cancelled` on steps.
--
-- @ALLOW_DESTRUCTIVE: drops and re-adds the step status CHECK to widen it
-- by one value. Every existing row satisfies the new, larger set, so the
-- re-add validates without touching data. The constraint name is the
-- one Postgres generated for the inline CHECK in 20260905000000.
alter table public.workflow_steps
  drop constraint if exists workflow_steps_status_check;
alter table public.workflow_steps
  add constraint workflow_steps_status_check
  check (status in ('pending', 'running', 'waiting', 'done', 'skipped', 'errored', 'cancelled'));

-- 2. Why an instance was stopped.
alter table public.workflow_instances
  add column if not exists cancelled_reason text null;

alter table public.workflow_instances
  drop constraint if exists workflow_instances_cancelled_reason_check;
alter table public.workflow_instances
  add constraint workflow_instances_cancelled_reason_check
  check (
    cancelled_reason is null
    or cancelled_reason in ('manual', 'template_deleted', 'setup_interrupted', 'exit_rule')
  );

comment on column public.workflow_instances.cancelled_reason is
  'Why a cancelled instance was stopped: manual (the MC stopped it), '
  'template_deleted (its workflow was deleted), setup_interrupted (the '
  'apply that built it failed or died; its steps may be incomplete), '
  'exit_rule (an exit rule ended it). Null on rows stopped before this '
  'column existed, and on every instance that is not cancelled.';

-- 3. Cancelling an instance cancels its open steps, in the same statement.
--
-- security invoker: the caller's RLS applies. An MC can only flip their
-- own instance, and workflow_steps_all_own admits exactly that
-- instance's steps, so the trigger never reaches further than the
-- statement that fired it. The service role (the sweep, abandonApply)
-- bypasses RLS on both, as it does on the flip itself.
create or replace function public._workflow_instance_cancel_steps()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.workflow_steps s
     set status = 'cancelled'
   where s.instance_id = new.id
     and s.status in ('pending', 'waiting');
  return null;
end;
$$;

comment on function public._workflow_instance_cancel_steps() is
  'Trigger: when an instance becomes cancelled, marks its pending and '
  'waiting steps cancelled. running, done, skipped and errored are left alone.';

-- No grant change: a trigger function cannot be called as an RPC.

drop trigger if exists workflow_instances_cancel_steps on public.workflow_instances;
create trigger workflow_instances_cancel_steps
  after update of status on public.workflow_instances
  for each row
  when (new.status = 'cancelled' and old.status is distinct from 'cancelled')
  execute function public._workflow_instance_cancel_steps();

-- 4. Deleting a workflow records why its couples stopped.
--
-- The body is 20261008100000's, with `cancelled_reason` added to the
-- cancel. The trigger above marks the steps.
--
-- Lock order is template (`for update`), then its instances (the sweep).
-- `resume_workflow_instance` (20261011100000) takes the same order, so a
-- resume and a delete of the same paused instance serialise on the
-- template lock instead of deadlocking.
create or replace function public.delete_workflow_template(p_template_id uuid)
returns table (instance_id uuid, user_id uuid, couple_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_found uuid;
begin
  -- Lock and check ownership first, so another tenant's call stops
  -- nothing and deletes nothing.
  select t.id into v_found
    from public.workflow_templates t
   where t.id = p_template_id
   for update;
  if v_found is null then
    raise exception 'workflow not found' using errcode = 'P0002';
  end if;

  return query
    update public.workflow_instances i
       set status = 'cancelled',
           cancelled_reason = 'template_deleted',
           completed_at = now()
     where i.template_id = p_template_id
       and i.status in ('active', 'paused')
    returning i.id, i.user_id, i.couple_id;

  delete from public.workflow_templates t where t.id = p_template_id;
end;
$$;

comment on function public.delete_workflow_template(uuid) is
  'Cancels a workflow template''s active and paused instances (reason '
  'template_deleted; their open steps are cancelled by trigger), then '
  'deletes the template, in one transaction. Returns the cancelled '
  'instances. security invoker: RLS applies.';

revoke all on function public.delete_workflow_template(uuid) from public, anon;
grant execute on function public.delete_workflow_template(uuid)
  to authenticated, service_role;

-- 5. Open steps already on a cancelled instance.
--
-- Additive in effect: the executor never ran these (the instance is not
-- active), so marking them changes what readers show, not what sends.
-- A later Resume flips them back to pending exactly as it does for a
-- stop made from now on.
update public.workflow_steps s
   set status = 'cancelled'
  from public.workflow_instances i
 where i.id = s.instance_id
   and i.status = 'cancelled'
   and s.status in ('pending', 'waiting');
