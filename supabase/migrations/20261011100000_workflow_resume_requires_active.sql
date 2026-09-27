-- Resuming a workflow needs its workflow to be on, checked in the same
-- statement as the flip (workflows trust remediation, Phase 3, Task 22
-- fix round 1).
--
-- Until now `resumeInstanceAction` flipped an instance back to `active`
-- with a plain guarded UPDATE, and never looked at the template. The
-- WF001 guard (20261008100000) is BEFORE INSERT only. So after the MC
-- turned workflow X off, any paused or stopped couple on X could be
-- resumed onto an off workflow, and the next tick would send.
--
-- The app now refuses that up front (lib/workflows/resume-eligibility),
-- but a check in the app and a flip later leaves a window: a Turn off
-- committing in between would land after its own sweep had already run
-- (the sweep pauses `active` rows only, and this one was not active
-- yet). So the flip itself happens here, conditional on the template:
--
-- 1. Read the instance's `template_id`, without a lock, while it is
--    still in the state the caller resumed it from. Otherwise return null
--    (it changed, or it is not the caller's: RLS hides another tenant's
--    row).
-- 2. Lock its template `for share`, the same lock pairing as the WF001
--    guard and `activate_applied_workflow_instance` (20261010000000).
--    `set_workflow_template_status` and `delete_workflow_template` hold
--    the template's row lock while they flip or delete and sweep, so
--    either this waits for them and then reads the result (`draft`, or
--    no row), or they wait for this to commit and their sweep (a later
--    statement, fresh snapshot) sees the instance this just made active.
-- 3. Lock the instance `for update` and re-check it: still in `p_from`,
--    still on the same template. Otherwise return null.
-- 4. Flip to `active` only if the template is `active`, clearing both
--    reasons and `completed_at`. Return:
--    - 'active' when flipped;
--    - 'template_off' when the template is not active (nothing changed);
--    - 'template_missing' when the instance has no template;
--    - null when the instance was not found in `p_from`, or is in one of
--      the two states Resume refuses: paused with no reason (an apply is
--      still building it) or stopped as `setup_interrupted`.
--
-- Lock order is template, then instance: the same order as
-- `set_workflow_template_status` and `delete_workflow_template`, which
-- lock the template and then sweep its instances. The reverse order
-- deadlocked against a delete, whose sweep takes `paused` instances too:
-- a resume holding the instance and waiting for the template, the delete
-- holding the template and waiting for the instance (Task 22 fix round 2,
-- reproduced with a two-session race before the change).
--
-- security invoker: the caller's RLS applies, as for the update it
-- replaces. Execute is granted to authenticated (the server action runs
-- as the MC) and service_role, revoked from public and anon.
--
-- Additive: new functions only, no destructive SQL. The second one,
-- reopen_completed_workflow_instance, is at the end of this file (Phase 3
-- fix wave, I4).

create or replace function public.resume_workflow_instance(
  p_instance_id uuid,
  p_from text
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_template uuid;
  v_locked   uuid;
  v_status   text;
  v_flipped  uuid;
begin
  if p_from not in ('paused', 'cancelled') then
    raise exception 'cannot resume from %', p_from using errcode = '22023';
  end if;

  -- Unlocked: the template has to be known before it can be locked, and
  -- locking the instance first is the order that deadlocks. The two
  -- states resumeRefusal (lib/workflows/resume-eligibility.ts) refuses
  -- are refused here too, so calling this RPC directly cannot flip one
  -- live without the settle: a paused instance with no reason is an
  -- apply still building it, and a `setup_interrupted` stop is one whose
  -- setup died half done.
  select i.template_id into v_template
    from public.workflow_instances i
   where i.id = p_instance_id
     and i.status = p_from
     and not (i.status = 'paused' and i.paused_reason is null)
     and i.cancelled_reason is distinct from 'setup_interrupted';
  if not found then
    return null;
  end if;

  if v_template is not null then
    select t.status into v_status
      from public.workflow_templates t
     where t.id = v_template
     for share;
  end if;

  -- Now the instance, re-checked under its lock: a delete, Turn off or
  -- another resume that committed since the read above shows here.
  select i.template_id into v_locked
    from public.workflow_instances i
   where i.id = p_instance_id
     and i.status = p_from
     and not (i.status = 'paused' and i.paused_reason is null)
     and i.cancelled_reason is distinct from 'setup_interrupted'
   for update;
  if not found or v_locked is distinct from v_template then
    return null;
  end if;
  if v_template is null then
    return 'template_missing';
  end if;
  if v_status is distinct from 'active' then
    return 'template_off';
  end if;

  update public.workflow_instances i
     set status = 'active',
         completed_at = null,
         paused_reason = null,
         cancelled_reason = null
   where i.id = p_instance_id
     and i.status = p_from
  returning i.id into v_flipped;

  return case when v_flipped is null then null else 'active' end;
end;
$$;

comment on function public.resume_workflow_instance(uuid, text) is
  'Flips a paused or cancelled instance to active only while its template '
  'is active, read for share in the same transaction. Returns active, '
  'template_off, template_missing, or null. security invoker: RLS applies.';

revoke all on function public.resume_workflow_instance(uuid, text) from public, anon;
grant execute on function public.resume_workflow_instance(uuid, text)
  to authenticated, service_role;

-- Un-ticking a step on a finished workflow reopens it only while its
-- workflow is on (Phase 3 fix wave, I4).
--
-- `reopenStep` (lib/workflows/executor.ts) used to flip a `completed`
-- instance straight back to `active` whenever the MC un-ticked one of its
-- steps. Neither Turn off nor delete touches a `completed` instance, so on
-- a workflow the MC had since turned off or deleted that flip made it
-- live again, and the next tick ran the reopened step. For a deleted
-- workflow there was then no switch left to stop it.
--
-- Same shape and lock order as resume_workflow_instance above: read the
-- instance's template unlocked while it is `completed`, lock the template
-- `for share`, lock the instance `for update` and re-check it. Then:
--
-- - the template is `active`: flip to `active` (clearing completed_at),
--   return 'active', as before;
-- - otherwise (off, archived or gone) and p_manual (a to-do or other
--   manual step): set it `paused` with paused_reason `template_off`,
--   return 'paused'. The to-do shows again, nothing automated runs, and
--   Turn on offers it back like any other couple paused by Turn off;
-- - otherwise: change nothing, return 'template_off'. The app refuses
--   the un-tick of an automated step with "Turn this workflow on first";
-- - null when the instance is not `completed` (or not the caller's).
--
-- security invoker, executable by service_role only: reopenStep runs on
-- the service-role client after the server action has checked the caller
-- owns the step. Additive: a new function only.

create or replace function public.reopen_completed_workflow_instance(
  p_instance_id uuid,
  p_manual boolean
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_template uuid;
  v_locked   uuid;
  v_status   text;
begin
  select i.template_id into v_template
    from public.workflow_instances i
   where i.id = p_instance_id
     and i.status = 'completed';
  if not found then
    return null;
  end if;

  if v_template is not null then
    select t.status into v_status
      from public.workflow_templates t
     where t.id = v_template
     for share;
  end if;

  select i.template_id into v_locked
    from public.workflow_instances i
   where i.id = p_instance_id
     and i.status = 'completed'
   for update;
  if not found or v_locked is distinct from v_template then
    return null;
  end if;

  if v_template is not null and v_status = 'active' then
    update public.workflow_instances i
       set status = 'active', completed_at = null
     where i.id = p_instance_id
       and i.status = 'completed';
    return 'active';
  end if;

  if not p_manual then
    return 'template_off';
  end if;

  update public.workflow_instances i
     set status = 'paused', paused_reason = 'template_off', completed_at = null
   where i.id = p_instance_id
     and i.status = 'completed';
  return 'paused';
end;
$$;

comment on function public.reopen_completed_workflow_instance(uuid, boolean) is
  'Reopens a completed instance for an un-ticked step: active while its '
  'template is active; otherwise paused (template_off) for a manual step, '
  'or refused (template_off, nothing changed) for an automated one. Locks '
  'the template for share, then the instance for update. Returns active, '
  'paused, template_off, or null. Service role only.';

revoke all on function public.reopen_completed_workflow_instance(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.reopen_completed_workflow_instance(uuid, boolean)
  to service_role;
