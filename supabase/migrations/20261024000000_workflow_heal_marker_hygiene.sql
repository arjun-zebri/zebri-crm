-- Phase 6 fix wave: keep the heal's queue to instances it can act on
-- (Task 36 re-review 2, N10).
--
-- 1. A marked instance that later completes or is cancelled kept its
--    `needs_recompute_at` for good. The finder skips it (active only), but
--    it sat in the partial index as a heap-filtered row forever. A BEFORE
--    UPDATE trigger now clears the marker whenever an instance becomes
--    `completed` or `cancelled`, whoever finishes it. A paused instance
--    keeps its marker: it is healed when it is active again.
-- 2. The rows already in that state are cleared once, here.
-- 3. A marked instance whose heal fails every tick was re-named every
--    tick, ahead of later ids, so two hundred of them would starve every
--    instance behind them. The heal now pushes a failed instance's marker
--    a few minutes into the future (lib/workflows/heal.ts, deferMarker),
--    and the finder names only markers that are due (`<= now()`). A
--    failure written by the executor stamps `now()`, so it is always due
--    on the next tick.
--
-- The finder keeps its name, signature and grants; only its body changes.
-- Additive apart from the one-off clear, which only nulls a marker on
-- instances that can no longer be healed.

create or replace function public._workflow_instance_clear_marker()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status in ('completed', 'cancelled') then
    new.needs_recompute_at := null;
  end if;
  return new;
end;
$$;

comment on function public._workflow_instance_clear_marker() is
  'Clears needs_recompute_at when a workflow instance completes or is '
  'cancelled: the heal only acts on active instances.';

drop trigger if exists workflow_instances_clear_marker on public.workflow_instances;
create trigger workflow_instances_clear_marker
  before update of status on public.workflow_instances
  for each row execute function public._workflow_instance_clear_marker();

update public.workflow_instances
   set needs_recompute_at = null
 where needs_recompute_at is not null
   and status in ('completed', 'cancelled');

create or replace function public.workflow_stranded_instances(
  p_limit integer,
  p_after uuid default null
)
returns table (instance_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  select i.id
  from public.workflow_instances i
  where i.needs_recompute_at is not null
    -- A heal that failed pushed its marker ahead (a backoff); it is named
    -- again once that time comes, not on every tick.
    and i.needs_recompute_at <= now()
    and i.status = 'active'
    and (p_after is null or i.id > p_after)
  order by i.id
  limit p_limit
$$;

revoke all on function public.workflow_stranded_instances(integer, uuid)
  from public, anon, authenticated;
grant execute on function public.workflow_stranded_instances(integer, uuid)
  to service_role;

comment on function public.workflow_stranded_instances(integer, uuid) is
  'Executor internal: active workflow instances whose bookkeeping after a finished step failed (needs_recompute_at set and due), keyset paged on id. Service role only.';
