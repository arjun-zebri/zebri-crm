-- Task 36, fix round 1 (review I1): find workflows a failed bookkeeping
-- write left stranded, so the tick can finish the job.
--
-- A step's completion is one guarded write. What follows it (merging its
-- output into the instance, skipping the branch not taken, re-dating the
-- steps behind it, completing the instance) is separate statements. If
-- one of those fails after the completion landed, the step reads `done`
-- and nothing re-runs it: an `after_previous` follower keeps a null
-- `due_at` for good, and the due read never sees an undated step. One
-- connection reset was enough to stop a workflow permanently.
--
-- This function names the active instances in that state, so the tick's
-- heal pass (`lib/workflows/heal.ts`) can redo the bookkeeping. Two
-- shapes:
--
--   1. A pending, undated `after_previous` step whose predecessor has
--      released it: the previous sibling in its lane (same parent step,
--      same branch path) is `done` or `skipped` with a `completed_at`,
--      or, heading a branch lane, its branch step is. That is exactly
--      the case where `recomputeDueDates` (lib/workflows/timing.ts)
--      would date it, so a healthy workflow never matches: a step gated
--      behind an open to-do has an unreleased predecessor, and a
--      wedding-relative step with no wedding date is not
--      `after_previous`. Keep the two in sync if either changes.
--      Only a release in the last two days counts. A heal dates the
--      follower from its predecessor's completion, so an older strand
--      (one left by the bugs before this pass existed) would come due at
--      once and send months late to a couple who has moved on. Two days
--      covers a blip and a day-long outage; anything older is left for a
--      person to judge rather than sent.
--   2. An instance with steps and nothing outstanding (no pending,
--      running, waiting or errored step) that is still `active`: its
--      completion was lost. Default and personal instances are
--      open-ended lists and never complete, so they are left out.
--
-- Keyset paged on instance id (`p_after`, null for the first page;
-- `p_limit`) so a large backlog
-- is healed a bounded slice per tick.
--
-- security invoker, execute revoked from public, anon and authenticated,
-- like workflow_due_steps: an executor internal, called with the service
-- role.
--
-- Additive only: one new function.

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
  where i.status = 'active'
    and (p_after is null or i.id > p_after)
    and (
      exists (
        select 1
        from public.workflow_steps s
        where s.instance_id = i.id
          and s.status = 'pending'
          and s.due_at is null
          and s.timing ->> 'mode' = 'after_previous'
          and (
            -- The previous sibling in the lane released it.
            exists (
              select 1
              from public.workflow_steps p
              where p.instance_id = s.instance_id
                and p.parent_step_id is not distinct from s.parent_step_id
                and p.branch_path is not distinct from s.branch_path
                and p.position < s.position
                and p.status in ('done', 'skipped')
                and p.completed_at > now() - interval '2 days'
                and not exists (
                  select 1
                  from public.workflow_steps q
                  where q.instance_id = s.instance_id
                    and q.parent_step_id is not distinct from s.parent_step_id
                    and q.branch_path is not distinct from s.branch_path
                    and q.position > p.position
                    and q.position < s.position
                )
            )
            -- Or it heads a branch lane whose branch step finished.
            or (
              s.parent_step_id is not null
              and not exists (
                select 1
                from public.workflow_steps q
                where q.instance_id = s.instance_id
                  and q.parent_step_id = s.parent_step_id
                  and q.branch_path is not distinct from s.branch_path
                  and q.position < s.position
              )
              and exists (
                select 1
                from public.workflow_steps b
                where b.id = s.parent_step_id
                  and b.status in ('done', 'skipped')
                  and b.completed_at > now() - interval '2 days'
              )
            )
          )
      )
      or (
        i.is_default = false
        and i.is_personal = false
        and exists (select 1 from public.workflow_steps a where a.instance_id = i.id)
        and not exists (
          select 1
          from public.workflow_steps o
          where o.instance_id = i.id
            and o.status in ('pending', 'running', 'waiting', 'errored')
        )
      )
    )
  order by i.id
  limit p_limit
$$;

revoke all on function public.workflow_stranded_instances(integer, uuid)
  from public, anon, authenticated;
grant execute on function public.workflow_stranded_instances(integer, uuid)
  to service_role;

comment on function public.workflow_stranded_instances(integer, uuid) is
  'Executor internal: active workflow instances left stranded by a failed bookkeeping write (an undated follower of a finished step, or nothing outstanding yet not completed). Service role only.';
