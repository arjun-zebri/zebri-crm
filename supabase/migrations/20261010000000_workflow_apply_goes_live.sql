-- A freshly applied workflow goes live in one guarded step (workflows
-- trust remediation, Phase 3, Task 19).
--
-- applyTemplate now inserts a new instance as `paused` (with a null
-- paused_reason), builds and dates its steps, skips any wedding-relative
-- step whose date had already passed, and only then flips it to
-- `active`. The executor ignores a paused instance, so no tick can send
-- a past-dated step in the gap. This function is that final flip.
--
-- Why a function rather than a plain UPDATE from the app: the flip has
-- to agree with a concurrent Turn off, archive or delete.
-- set_workflow_template_status (20261008100000) sweeps only `active`
-- instances, so an instance still paused mid-apply is invisible to it.
-- If the flip then read the template, saw it active, and woke the
-- instance after the sweep, the couple would be live on a workflow the
-- MC had just switched off. So the flip reads the template `for share`,
-- which conflicts with the row lock the switch and the delete hold while
-- they flip or delete and sweep:
--
-- - The switch or delete first: this waits for it to commit, then reads
--   `draft`, `archived` or no row. Off, it leaves the instance paused as
--   `template_off`, where Turn on offers to resume it. Deleted, the
--   delete's sweep has already cancelled the instance, and the re-check
--   below finds it no longer building.
-- - This first: the switch or delete waits for this to commit, and its
--   sweep (a later statement, with a fresh snapshot) sees the instance
--   `active` and pauses or cancels it.
--
-- Lock order is template, then instance, the one order every workflow
-- RPC takes (Task 22 fix round 2): `set_workflow_template_status` and
-- `delete_workflow_template` lock the template and then sweep its
-- instances, and `resume_workflow_instance` does the same as this. The
-- first version of this function locked the instance first, and
-- deadlocked against a delete, whose sweep takes `paused` instances too
-- (reproduced with a two-session race in the Phase 3 fix wave). So:
--
-- 1. Read the instance's `template_id`, without a lock, while it is still
--    building (`paused`, null reason). Otherwise return null.
-- 2. Lock the template `for share`.
-- 3. Lock the instance `for update` and re-check it: still building,
--    still on the same template. Otherwise return null.
-- 4. Leave it paused as `template_off`, and return 'paused', when:
--    - p_require_active is true and the template is not `active`; or
--    - the template is `archived` now and was not when the apply loaded
--      it (p_loaded_status). A draft applied by hand does not need an
--      active template, but an archived one takes no couples, and the
--      archive sweep cannot see an instance still being built.
--    Otherwise flip it to `active` and return 'active'.
--
-- p_require_active says whether the template must still be active for
-- the instance to go live. The app passes false only for a manual apply
-- of a workflow that was not active when the apply began (applying a
-- draft by hand is allowed on purpose, Task 17 ruling).
--
-- security invoker, and executable by service_role only: the app calls
-- it through the service-role client that writes the rest of the apply.
-- Additive: one new function, nothing else changes.

create or replace function public.activate_applied_workflow_instance(
  p_instance_id uuid,
  p_require_active boolean,
  p_loaded_status text
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
  -- Unlocked: the template has to be known before it can be locked, and
  -- locking the instance first is the order that deadlocks.
  select i.template_id into v_template
    from public.workflow_instances i
   where i.id = p_instance_id
     and i.status = 'paused'
     and i.paused_reason is null;
  if not found then
    return null;
  end if;

  if v_template is not null then
    select t.status into v_status
      from public.workflow_templates t
     where t.id = v_template
     for share;
  end if;

  -- Now the instance, re-checked under its lock: a delete, a sweep of
  -- interrupted applies or a manual pause that committed since the read
  -- above shows here.
  select i.template_id into v_locked
    from public.workflow_instances i
   where i.id = p_instance_id
     and i.status = 'paused'
     and i.paused_reason is null
   for update;
  if not found or v_locked is distinct from v_template then
    return null;
  end if;

  if v_template is not null and (
       (p_require_active and v_status is distinct from 'active')
       or (v_status = 'archived' and p_loaded_status is distinct from 'archived')
     ) then
    update public.workflow_instances
       set paused_reason = 'template_off'
     where id = p_instance_id;
    return 'paused';
  end if;

  update public.workflow_instances
     set status = 'active'
   where id = p_instance_id;
  return 'active';
end;
$$;

comment on function public.activate_applied_workflow_instance(uuid, boolean, text) is
  'Final step of applying a workflow: flips a still-paused (null reason) '
  'new instance to active, or labels it paused_reason template_off when '
  'p_require_active and the template is no longer active, or when the '
  'template was archived after the apply loaded it (p_loaded_status). '
  'Locks the template for share, then the instance for update, the order '
  'every workflow RPC takes. Returns active, paused, or null when the '
  'instance was not in the expected state. Service role only.';

revoke all on function public.activate_applied_workflow_instance(uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.activate_applied_workflow_instance(uuid, boolean, text)
  to service_role;

-- The tick's interrupted-apply sweep (lib/workflows/interrupted-applies.ts)
-- runs every minute on exactly this predicate. Paused-with-no-reason rows
-- exist only while an apply is building an instance, so the index stays
-- tiny, and without it every tick would scan the whole table.
create index if not exists workflow_instances_building_applied_at_idx
  on public.workflow_instances (applied_at)
  where status = 'paused' and paused_reason is null;
