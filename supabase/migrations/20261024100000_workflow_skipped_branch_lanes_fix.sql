-- Phase 6 fix wave: one-off data fix for branches the MC skipped before
-- Task 36 fix round 2 deployed (Task 36 re-review 2, N7).
--
-- Before that round, "Skip this step" on a branch skipped the branch only.
-- Its lanes stayed pending, and the recompute dated both of them from the
-- skip, so both ran. Since the round, a lane head is dated only from a
-- branch that is `done` (lib/workflows/timing.ts branchReleaseAt), and a
-- manual branch skip takes everything under it (lib/workflows/branch-skip).
-- Rows written before it keep the old shape: a `skipped` branch with
-- `pending` or `waiting` steps underneath. The first recompute after the
-- deploy un-dates those lane heads (correct: a skipped branch chose
-- neither lane), but nothing skips them, so the completion check counts
-- them as outstanding and the instance reads "running" for good.
--
-- This skips every pending or waiting step under a skipped branch, at any
-- depth, on active and paused instances, exactly as the code does now,
-- with one timeline row per branch (the same `step_skipped` row
-- skipBranchSide writes, marked `via: deploy_fix`). Active instances it
-- touched are marked `needs_recompute_at`, so the tick's heal pass
-- re-dates them and completes any that have nothing left.
--
-- The count to review before the deploy, and how to read it, is in
-- .claude/docs/workflows.md, "Deploy notes: Phase 6". On a database built
-- from zero (local, CI) there is no such row and this does nothing.
--
-- Not destructive: an UPDATE of step status plus audit inserts. Nothing
-- is deleted.

with recursive under_skipped as (
  select s.id, b.id as branch_id
    from public.workflow_steps s
    join public.workflow_steps b on b.id = s.parent_step_id
   where b.type = 'branch'
     and b.status = 'skipped'
  union
  select c.id, u.branch_id
    from public.workflow_steps c
    join under_skipped u on c.parent_step_id = u.id
),
skipped as (
  update public.workflow_steps s
     set status = 'skipped',
         completed_at = now()
    from public.workflow_instances i
   where s.id in (select id from under_skipped)
     and s.instance_id = i.id
     and i.status in ('active', 'paused')
     and s.status in ('pending', 'waiting')
  returning s.id, s.instance_id
),
branches as (
  select distinct u.branch_id, k.instance_id
    from skipped k
    join under_skipped u on u.id = k.id
),
logged as (
  insert into public.workflow_audit_log (user_id, instance_id, step_id, couple_id, event, detail)
  select i.user_id, i.id, b.branch_id, i.couple_id, 'step_skipped',
         jsonb_build_object('reason', 'branch skipped', 'path', 'both', 'via', 'deploy_fix')
    from branches b
    join public.workflow_instances i on i.id = b.instance_id
  returning 1
)
update public.workflow_instances i
   set needs_recompute_at = now()
 where i.id in (select instance_id from skipped)
   and i.status = 'active';
