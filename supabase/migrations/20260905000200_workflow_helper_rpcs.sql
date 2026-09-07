-- Workflows: helper RPCs + the dual-run guard.
--
-- Not destructive.

-- ────────────────────────────────────────────────────────────────
-- ensure_default_workflow
-- ────────────────────────────────────────────────────────────────
-- The couple's default ("General") applied workflow, created if absent.
-- A DB trigger creates it on couple INSERT, so this is the safety net for
-- couples that predate that trigger.
--
-- `security invoker`, deliberately NOT definer: the caller's RLS should
-- apply, so a user cannot conjure an instance on another tenant's couple.
create or replace function public.ensure_default_workflow(p_couple_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid;
  v_id      uuid;
begin
  select id into v_id
  from public.workflow_instances
  where couple_id = p_couple_id and is_default
  limit 1;
  if v_id is not null then return v_id; end if;

  -- RLS on couples means this returns nothing for another tenant's couple,
  -- so the insert below never runs.
  select user_id into v_user_id from public.couples where id = p_couple_id;
  if v_user_id is null then return null; end if;

  insert into public.workflow_instances (user_id, couple_id, name, is_default)
  values (v_user_id, p_couple_id, 'General', true)
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    -- Lost the race against workflow_instances_one_default_per_couple_idx.
    select id into v_id
    from public.workflow_instances
    where couple_id = p_couple_id and is_default
    limit 1;
  end if;

  return v_id;
end;
$$;

comment on function public.ensure_default_workflow(uuid) is
  'Returns the couple''s default applied workflow, creating it if absent. '
  'Idempotent. security invoker so RLS still gates cross-tenant calls.';


-- ────────────────────────────────────────────────────────────────
-- workflow_dispatched_events - the dual-run guard
-- ────────────────────────────────────────────────────────────────
-- Until the Phase E cutover, the automations dispatcher and the workflows
-- dispatcher read the SAME bus (automation_events). The old one owns
-- `automation_events.processed_at`, so whichever ticked first would
-- consume every event and starve the other. The new dispatcher records
-- what it has seen here instead, and only starts writing processed_at
-- once the automations engine is gone.
--
-- Dropped along with the legacy tables in Phase F.
create table if not exists public.workflow_dispatched_events (
  event_id uuid primary key references public.automation_events(id) on delete cascade,
  dispatched_at timestamptz not null default now()
);

-- No RLS: written only by the service-role tick, read by nothing
-- user-facing. Same access model as the other engine-internal tables.
comment on table public.workflow_dispatched_events is
  'Dual-run guard: which bus events the workflows dispatcher has already '
  'matched. Needed only while the automations engine still owns '
  'automation_events.processed_at. Dropped at the Phase F cleanup.';
