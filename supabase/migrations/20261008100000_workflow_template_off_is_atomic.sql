-- Turning a workflow off, or deleting it, stops its couples atomically
-- (workflows trust remediation, Phase 3, Task 17 fix round 1).
--
-- Three ways a workflow the MC had turned off could still send:
--
-- 1. The switch flipped the template, then paused its couples in a
--    second round trip. If the second step failed, the template was off
--    and its couples still ran; pressing Turn off again saw an off
--    template and did nothing. `set_workflow_template_status` does both
--    in one transaction, and sweeps whenever the target is not `active`,
--    so a retry (or a template turned off before this existed) repairs
--    itself.
--
-- 2. The dispatcher loads its candidate templates while they are active
--    and applies each match afterwards. A template turned off in between
--    was applied anyway, after the sweep had already run. The trigger in
--    step 3 refuses such an enrolment.
--
-- 3. Deleting a template left its couples running: the instance FK is
--    `on delete set null` and the executor never reads the template.
--    `delete_workflow_template` stops (cancels) them first, in the same
--    transaction.
--
-- Both functions are `security invoker`, like ensure_default_workflow
-- (20260905000200): the caller's RLS applies, so they only ever touch
-- the caller's own template and the caller's own instances, even when
-- another tenant's instance row points at the same template.
--
-- Grants: execute is revoked from public and anon, and granted to
-- authenticated (the server actions call these as the signed-in MC) and
-- service_role.

-- 1. Flip and sweep, in one transaction.
create or replace function public.set_workflow_template_status(
  p_template_id uuid,
  p_status text
)
returns table (instance_id uuid, user_id uuid, couple_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_found uuid;
begin
  if p_status not in ('draft', 'active', 'archived') then
    raise exception 'invalid workflow status: %', p_status using errcode = '22023';
  end if;

  -- Takes the row lock the enrolment guard (step 3) waits on, so an
  -- event-driven insert either sees this flip or is seen by the sweep.
  update public.workflow_templates t
     set status = p_status
   where t.id = p_template_id
  returning t.id into v_found;
  if v_found is null then
    raise exception 'workflow not found' using errcode = 'P0002';
  end if;

  -- Unconditional whenever the target is off, not only on active to
  -- off: idempotent, and it is what makes a retry repair a template
  -- whose couples are still running.
  if p_status <> 'active' then
    return query
      update public.workflow_instances i
         set status = 'paused', paused_reason = 'template_off'
       where i.template_id = p_template_id
         and i.status = 'active'
      returning i.id, i.user_id, i.couple_id;
  end if;
end;
$$;

comment on function public.set_workflow_template_status(uuid, text) is
  'Sets a workflow template''s status and, when the target is not active, '
  'pauses its active instances (paused_reason template_off) in the same '
  'transaction. Returns the paused instances. security invoker: RLS applies.';

revoke all on function public.set_workflow_template_status(uuid, text) from public, anon;
grant execute on function public.set_workflow_template_status(uuid, text)
  to authenticated, service_role;

-- 2. Stop the couples, then delete the template, in one transaction.
--
-- Cancelled rather than paused: with the template gone there is no Turn
-- on to resume from. Steps are left as they are, which is what
-- cancelInstanceAction does: the executor ignores every step on a
-- cancelled instance.
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
       set status = 'cancelled', completed_at = now()
     where i.template_id = p_template_id
       and i.status in ('active', 'paused')
    returning i.id, i.user_id, i.couple_id;

  delete from public.workflow_templates t where t.id = p_template_id;
end;
$$;

comment on function public.delete_workflow_template(uuid) is
  'Cancels a workflow template''s active and paused instances, then deletes '
  'the template, in one transaction. Returns the cancelled instances. '
  'security invoker: RLS applies.';

revoke all on function public.delete_workflow_template(uuid) from public, anon;
grant execute on function public.delete_workflow_template(uuid)
  to authenticated, service_role;

-- 3. An off workflow takes no new event-driven enrolments.
--
-- Only rows with a trigger_event_id: those come from the dispatcher. A
-- manual apply (trigger_event_id null) of a draft stays allowed, since
-- drafts can be applied by hand on purpose.
--
-- `for share` conflicts with the row lock the flip's UPDATE holds, so
-- this waits for an in-flight flip and then reads its result. In the
-- other order, the flip waits for this insert to commit, and the sweep
-- (a later statement in the same transaction, with a fresh snapshot)
-- sees and pauses the new instance.
--
-- A template this caller cannot see counts as not active, so the guard
-- also refuses an enrolment on another tenant's template.
--
-- SQLSTATE WF001 is this guard's own code: the dispatcher reads it as a
-- quiet skip, not an error.
create or replace function public._workflow_instance_refuse_off_template()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status text;
begin
  if new.trigger_event_id is null or new.template_id is null then
    return new;
  end if;

  select t.status into v_status
    from public.workflow_templates t
   where t.id = new.template_id
   for share;

  if v_status is distinct from 'active' then
    raise exception 'workflow % is not active; it takes no new enrolments', new.template_id
      using errcode = 'WF001';
  end if;
  return new;
end;
$$;

-- No grant change: a trigger function cannot be called as an RPC, and
-- the roles that insert instances need it to fire.

drop trigger if exists workflow_instances_refuse_off_template on public.workflow_instances;
create trigger workflow_instances_refuse_off_template
  before insert on public.workflow_instances
  for each row execute function public._workflow_instance_refuse_off_template();
