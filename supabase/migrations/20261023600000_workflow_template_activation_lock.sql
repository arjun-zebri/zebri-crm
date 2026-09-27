-- Only the pre-flighted Turn on can switch a workflow on (Task 34).
--
-- The Turn on pre-flight (lib/workflows/preflight.ts) runs in
-- setTemplateStatusAction. Two doors went round it: the owner's
-- workflow_templates_all_own policy let a signed-in client
-- `update ... set status = 'active'` (or insert a row already on), and
-- set_workflow_template_status was executable by `authenticated`. An
-- unfinished workflow switched on that way errors at every couple who
-- reaches its unfinished step.
--
-- 1. A BEFORE INSERT OR UPDATE trigger refuses a status BECOMING 'active'
--    for the `authenticated` and `anon` roles. Everything else a client
--    legitimately writes keeps working: create and duplicate insert
--    drafts, a move to draft or archived is never refused, and a rename
--    of a workflow already on is not a status change. The service role
--    (the action's flip, the legacy converter) and migrations are
--    unaffected.
-- 2. set_workflow_template_status is revoked from `authenticated`. The
--    action checks ownership with the MC's RLS client, runs the
--    pre-flight, then calls it with the service role.
-- 3. The function takes the template row lock first and, for a Turn on,
--    re-reads the step count and newest step edit under it. The action
--    passes what its pre-flight read; a step added, removed or edited in
--    between refuses the flip (SQLSTATE WF002) instead of switching on a
--    workflow the check never saw.

-- 1. The activation lock.
create or replace function public.workflow_templates_activation_lock()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- security invoker, so current_user is the caller's role: PostgREST
  -- sets it to `authenticated` or `anon` for a client, `service_role`
  -- for the server's admin client.
  if current_user in ('authenticated', 'anon')
     and new.status = 'active'
     and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    raise exception 'Turn this workflow on from the builder, which checks it is finished first.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function public.workflow_templates_activation_lock() is
  'Refuses a workflow template''s status becoming active for client roles. '
  'Turn on goes through setTemplateStatusAction, which runs the pre-flight.';

drop trigger if exists workflow_templates_activation_lock on public.workflow_templates;
create trigger workflow_templates_activation_lock
  before insert or update of status on public.workflow_templates
  for each row execute function public.workflow_templates_activation_lock();

-- 2 and 3. The flip, service role only, locked and re-checked.
--
-- The old two-argument signature is replaced rather than overloaded: two
-- versions would leave the unchecked one callable.
drop function if exists public.set_workflow_template_status(uuid, text);

create or replace function public.set_workflow_template_status(
  p_template_id uuid,
  p_status text,
  p_expected_step_count integer default null,
  p_expected_steps_updated_at timestamptz default null
)
returns table (instance_id uuid, user_id uuid, couple_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_found uuid;
  v_owner uuid;
  v_count integer;
  v_newest timestamptz;
begin
  if p_status not in ('draft', 'active', 'archived') then
    raise exception 'invalid workflow status: %', p_status using errcode = '22023';
  end if;

  -- The row lock the enrolment guard also waits on, taken before any
  -- check, so a second Turn on or Turn off queues behind this one.
  select t.id, t.user_id into v_found, v_owner
    from public.workflow_templates t
   where t.id = p_template_id
     for update;
  if v_found is null then
    raise exception 'workflow not found' using errcode = 'P0002';
  end if;

  if p_status = 'active' then
    -- A Turn on must say what its pre-flight read. All steps, disabled
    -- ones included: toggling one changes what the pre-flight counts.
    if p_expected_step_count is null then
      raise exception 'a Turn on must pass the steps its pre-flight checked'
        using errcode = '22023';
    end if;
    select count(*)::integer, max(s.updated_at)
      into v_count, v_newest
      from public.workflow_template_steps s
     where s.template_id = p_template_id;
    if v_count <> p_expected_step_count
       or v_newest is distinct from p_expected_steps_updated_at then
      raise exception 'the workflow changed after it was checked' using errcode = 'WF002';
    end if;
  end if;

  update public.workflow_templates t
     set status = p_status
   where t.id = p_template_id;

  -- Unconditional whenever the target is off, not only on active to
  -- off: idempotent, and it is what makes a retry repair a template
  -- whose couples are still running.
  if p_status <> 'active' then
    return query
      update public.workflow_instances i
         set status = 'paused', paused_reason = 'template_off'
       where i.template_id = p_template_id
         -- Called as the service role now, so RLS no longer scopes this.
         -- A foreign key does not check RLS: another tenant's instance
         -- can point at this template, and it must never be paused by
         -- this owner's switch.
         and i.user_id = v_owner
         and i.status = 'active'
      returning i.id, i.user_id, i.couple_id;
  end if;
end;
$$;

comment on function public.set_workflow_template_status(uuid, text, integer, timestamptz) is
  'Sets a workflow template''s status under a row lock and, when the target '
  'is not active, pauses its active instances (paused_reason template_off) in '
  'the same transaction. A Turn on must pass the step count and newest step '
  'edit its pre-flight read (WF002 when they changed). Service role only: '
  'setTemplateStatusAction checks ownership and runs the pre-flight first.';

revoke all on function public.set_workflow_template_status(uuid, text, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.set_workflow_template_status(uuid, text, integer, timestamptz)
  to service_role;
