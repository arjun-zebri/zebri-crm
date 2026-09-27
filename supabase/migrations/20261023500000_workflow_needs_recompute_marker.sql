-- Task 36, fix round 2 (re-review N1): the heal pass finds only the
-- instances a failed write marked, never what merely looks stranded.
--
-- 20261023400000 named instances by shape: a pending, undated
-- `after_previous` step whose predecessor had released it. A step whose
-- date the MC took off ("Take the date off", which is how an MC holds an
-- automated send) has exactly that shape, so the heal put the date back
-- within a minute and the executor sent what the MC had held. Shape is
-- not evidence of a failure.
--
-- So the failure records itself. When the bookkeeping after a finished
-- step fails (`settleAfterCompletion` in lib/workflows/executor.ts), the
-- executor stamps `needs_recompute_at` on the instance. The heal pass
-- (lib/workflows/heal.ts) redoes the bookkeeping for marked instances
-- only and clears the stamp it read once that lands, guarded on the
-- value, so a failure that marks the instance again mid-heal is kept.
--
-- The first tick after this deploys touches nothing: no instance carries
-- a marker yet. A strand left before the deploy stays as it is today,
-- for a person to judge, rather than being sent late.
--
-- `workflow_stranded_instances` keeps its name, signature and grants, so
-- the caller and the generated types are unchanged; only its body
-- narrows. Active instances only: a marked instance that is paused keeps
-- its marker and is healed when it is active again (a resume also
-- re-dates its steps).
--
-- Additive: one nullable column, one partial index, one function body.

alter table public.workflow_instances
  add column if not exists needs_recompute_at timestamptz;

comment on column public.workflow_instances.needs_recompute_at is
  'Set when the bookkeeping after a finished step failed (output merge, branch skip, re-dating, completion); the tick''s heal pass redoes it and clears this. Null on a healthy instance.';

-- Almost every row is null, so the index holds only the handful waiting
-- for a heal, and the finder below is one small index scan per tick.
create index if not exists workflow_instances_needs_recompute_idx
  on public.workflow_instances (id)
  where needs_recompute_at is not null;

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
  'Executor internal: active workflow instances whose bookkeeping after a finished step failed (needs_recompute_at set), keyset paged on id. Service role only.';
