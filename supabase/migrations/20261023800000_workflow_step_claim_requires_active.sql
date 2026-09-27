-- Phase 6 fix wave: a step is claimed, a sleeping wait finished, and a
-- wait held out of quiet hours only while its instance is still active,
-- decided in the same statement as the write (Task 38 review, parked).
--
-- The executor used to judge "is this workflow still running?" from an
-- instance row it had read earlier: up to a second earlier since the
-- tick batches its reads (Task 38), and before that, the step's own
-- read-to-claim latency. The claim itself only matched the step's status.
-- So a pause, or a Turn off (which pauses every active instance of the
-- template in its own transaction), landing in that window still let the
-- next step run: about a second of sends across a template's couples.
--
-- Each write below now takes the same locks, in the same order, as
-- set_workflow_template_status, delete_workflow_template and
-- resume_workflow_instance: the template row `for share`, then the
-- instance row `for share` re-checked as `active`, then the step. So a
-- Turn off either commits first (the claim then reads the instance
-- paused and refuses) or waits for the claim to commit (the step was
-- genuinely claimed before the switch). A pause of one instance takes
-- that instance's row lock, and the `for share` re-read after it sees the
-- paused row. Either way the NEXT step after a pause or Turn off never
-- runs.
--
-- "Its template is not off": Turn off pauses the template's active
-- instances in the same transaction that flips the template, so an
-- instance still active under the template lock is not on a switched-off
-- template. A draft applied by hand goes live on purpose (instantiate.ts
-- goLive), which is why the template's own status is not required to be
-- `active` here: that would stop every such workflow for good.
--
-- A step the MC took the date off (`due_held_at`, 20261023700000) is
-- never claimed by the engine. The MC's own "Send now" (p_manual) still
-- runs it and clears the hold as it claims, since pressing it is the MC
-- releasing the hold.
--
-- Service role only: every caller is the executor on the admin client.
-- security invoker; the service role bypasses RLS.

create or replace function public._workflow_lock_live_instance(p_step_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_instance uuid;
  v_template uuid;
begin
  select s.instance_id into v_instance
    from public.workflow_steps s
   where s.id = p_step_id;
  if v_instance is null then
    return false;
  end if;

  select i.template_id into v_template
    from public.workflow_instances i
   where i.id = v_instance;

  -- Template first, then instance: the order every template switch takes.
  if v_template is not null then
    perform 1 from public.workflow_templates t where t.id = v_template for share;
  end if;

  perform 1
    from public.workflow_instances i
   where i.id = v_instance
     and i.status = 'active'
     for share;
  return found;
end;
$$;

comment on function public._workflow_lock_live_instance(uuid) is
  'Executor internal: locks the step''s template (for share) and instance '
  '(for share, re-checked active), in the template-then-instance order. '
  'True when the instance is active. Service role only.';

create or replace function public.workflow_claim_step(
  p_step_id uuid,
  p_manual boolean default false
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claimed uuid;
begin
  if not public._workflow_lock_live_instance(p_step_id) then
    return false;
  end if;

  update public.workflow_steps s
     set status = 'running',
         -- The MC pressing Send now releases their own hold.
         due_held_at = case when p_manual then null else s.due_held_at end
   where s.id = p_step_id
     and s.status in ('pending', 'waiting')
     and (p_manual or s.due_held_at is null)
  returning s.id into v_claimed;

  return v_claimed is not null;
end;
$$;

comment on function public.workflow_claim_step(uuid, boolean) is
  'Claims a pending or waiting step (status running) only while its '
  'instance is active, under the template-then-instance locks. The engine '
  'never claims a held step (due_held_at); a manual run does, and clears '
  'the hold. True when this caller now owns the step. Service role only.';

create or replace function public.workflow_finish_wait(p_step_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_done uuid;
begin
  if not public._workflow_lock_live_instance(p_step_id) then
    return false;
  end if;

  update public.workflow_steps s
     set status = 'done',
         completed_at = now()
   where s.id = p_step_id
     and s.status = 'waiting'
  returning s.id into v_done;

  return v_done is not null;
end;
$$;

comment on function public.workflow_finish_wait(uuid) is
  'Completes a sleeping wait (waiting to done) only while its instance is '
  'active, under the template-then-instance locks. True when this caller '
  'finished it. Service role only.';

create or replace function public.workflow_hold_wait(
  p_step_id uuid,
  p_expected_due_at timestamptz,
  p_until timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_held uuid;
begin
  if not public._workflow_lock_live_instance(p_step_id) then
    return false;
  end if;

  -- Exclusive on the wake this caller read as well as the status: two
  -- callers holding the same row must not both re-park it.
  update public.workflow_steps s
     set due_at = p_until
   where s.id = p_step_id
     and s.status = 'waiting'
     and s.due_at is not distinct from p_expected_due_at
  returning s.id into v_held;

  return v_held is not null;
end;
$$;

comment on function public.workflow_hold_wait(uuid, timestamptz, timestamptz) is
  'Re-parks a woken wait until p_until (the end of the MC''s quiet hours) '
  'only while its instance is active and the wake is still the one the '
  'caller read. True when this caller held it. Service role only.';

revoke all on function public._workflow_lock_live_instance(uuid) from public, anon, authenticated;
revoke all on function public.workflow_claim_step(uuid, boolean) from public, anon, authenticated;
revoke all on function public.workflow_finish_wait(uuid) from public, anon, authenticated;
revoke all on function public.workflow_hold_wait(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public._workflow_lock_live_instance(uuid) to service_role;
grant execute on function public.workflow_claim_step(uuid, boolean) to service_role;
grant execute on function public.workflow_finish_wait(uuid) to service_role;
grant execute on function public.workflow_hold_wait(uuid, timestamptz, timestamptz) to service_role;
