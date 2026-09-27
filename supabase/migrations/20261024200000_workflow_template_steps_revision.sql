-- Phase 6 fix wave: an exact "did the steps change?" fingerprint for the
-- Turn on and the hand apply, and an allow-list activation lock (Task 34
-- re-review, Minors 2, 3 and 4).
--
-- 1. `workflow_templates.steps_revision`, bumped by a trigger in the same
--    transaction as every insert, update or delete of one of its steps.
--    20261023600000 fingerprinted the steps by count and max(updated_at).
--    `updated_at` is the transaction's start time, so an edit that began
--    before, but committed after, the edit that set the current max left
--    both unchanged and a Turn on could pass a check that never saw it. A
--    counter bumped inside the writing transaction cannot be missed: if
--    the revision read under the lock equals the one the pre-flight read
--    first, no step write committed in between.
-- 2. set_workflow_template_status takes the revision instead of the count
--    and timestamp. The four-argument version is replaced, not
--    overloaded, so the weaker check cannot be called. Code and this
--    migration deploy together (the action passes the new argument).
-- 3. The activation lock becomes an allow-list. It refused only the
--    `authenticated` and `anon` roles, so any other role (a future
--    SECURITY DEFINER function owned by some other role, a new API role)
--    could switch a workflow on without the pre-flight. Now only
--    `service_role` (the pre-flighted action, the legacy converter),
--    `postgres` (migrations) and `supabase_admin` (the platform) may.
--    A SECURITY DEFINER function owned by `postgres` runs as `postgres`
--    and passes: such a function must run the pre-flight itself.
--
-- Additive apart from replacing the RPC's signature: one column with a
-- default, one trigger, two function bodies.

-- 1. The revision.
alter table public.workflow_templates
  add column if not exists steps_revision bigint not null default 0;

comment on column public.workflow_templates.steps_revision is
  'Bumped in the same transaction as every insert, update or delete of one of this template''s steps. The Turn on pre-flight reads it first and set_workflow_template_status refuses the flip (WF002) when it moved.';

create or replace function public._workflow_template_steps_bump_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- AFTER ROW, so a cascade from a deleted template finds no row to bump
  -- rather than updating one mid-delete. security invoker: the MC edits
  -- only their own steps, and the steps policy lets them write only under
  -- their own template, which the templates policy lets them update.
  if tg_op in ('UPDATE', 'DELETE') then
    update public.workflow_templates t
       set steps_revision = t.steps_revision + 1
     where t.id = old.template_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE')
     and (tg_op = 'INSERT' or new.template_id is distinct from old.template_id) then
    update public.workflow_templates t
       set steps_revision = t.steps_revision + 1
     where t.id = new.template_id;
  end if;
  return null;
end;
$$;

comment on function public._workflow_template_steps_bump_revision() is
  'Bumps workflow_templates.steps_revision for every write to one of its steps.';

drop trigger if exists workflow_template_steps_bump_revision on public.workflow_template_steps;
create trigger workflow_template_steps_bump_revision
  after insert or update or delete on public.workflow_template_steps
  for each row execute function public._workflow_template_steps_bump_revision();

-- 3. The activation lock, as an allow-list.
create or replace function public.workflow_templates_activation_lock()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- security invoker, so current_user is the caller's role: PostgREST
  -- sets it to `authenticated` or `anon` for a client, `service_role`
  -- for the server's admin client. Anything not on this list is refused,
  -- so a role nobody thought of cannot skip the pre-flight. A SECURITY
  -- DEFINER function owned by postgres runs as postgres and is allowed:
  -- one that switches a workflow on must run the pre-flight itself.
  if current_user not in ('service_role', 'postgres', 'supabase_admin')
     and new.status = 'active'
     and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    raise exception 'Turn this workflow on from the builder, which checks it is finished first.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function public.workflow_templates_activation_lock() is
  'Refuses a workflow template''s status becoming active for every role but '
  'service_role, postgres and supabase_admin. Turn on goes through '
  'setTemplateStatusAction, which runs the pre-flight.';

-- 2. The flip, checked against the revision.
drop function if exists public.set_workflow_template_status(uuid, text, integer, timestamptz);

create or replace function public.set_workflow_template_status(
  p_template_id uuid,
  p_status text,
  p_expected_steps_revision bigint default null
)
returns table (instance_id uuid, user_id uuid, couple_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_found uuid;
  v_owner uuid;
  v_revision bigint;
begin
  if p_status not in ('draft', 'active', 'archived') then
    raise exception 'invalid workflow status: %', p_status using errcode = '22023';
  end if;

  -- The row lock the enrolment guard also waits on, taken before any
  -- check, so a second Turn on or Turn off queues behind this one.
  select t.id, t.user_id, t.steps_revision into v_found, v_owner, v_revision
    from public.workflow_templates t
   where t.id = p_template_id
     for update;
  if v_found is null then
    raise exception 'workflow not found' using errcode = 'P0002';
  end if;

  if p_status = 'active' then
    -- A Turn on must say which revision its pre-flight checked. A step
    -- write that committed since bumped the revision in its own
    -- transaction; one still in flight holds the row lock this waited on.
    if p_expected_steps_revision is null then
      raise exception 'a Turn on must pass the steps revision its pre-flight checked'
        using errcode = '22023';
    end if;
    if v_revision <> p_expected_steps_revision then
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
         -- Called as the service role, so RLS does not scope this. A
         -- foreign key does not check RLS: another tenant's instance can
         -- point at this template, and it must never be paused by this
         -- owner's switch.
         and i.user_id = v_owner
         and i.status = 'active'
      returning i.id, i.user_id, i.couple_id;
  end if;
end;
$$;

comment on function public.set_workflow_template_status(uuid, text, bigint) is
  'Sets a workflow template''s status under a row lock and, when the target '
  'is not active, pauses its active instances (paused_reason template_off) in '
  'the same transaction. A Turn on must pass the steps_revision its '
  'pre-flight read (WF002 when it moved). Service role only: '
  'setTemplateStatusAction checks ownership and runs the pre-flight first.';

revoke all on function public.set_workflow_template_status(uuid, text, bigint)
  from public, anon, authenticated;
grant execute on function public.set_workflow_template_status(uuid, text, bigint)
  to service_role;

-- A new column and no policy change, but both helpers are idempotent, so
-- re-assert them rather than rely on that reasoning.
select public.ensure_require_mfa_policies();
select public.ensure_shadow_triggers();
