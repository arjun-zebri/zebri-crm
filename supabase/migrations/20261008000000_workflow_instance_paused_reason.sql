-- Why an applied workflow is paused (workflows trust remediation,
-- Phase 3, Task 17).
--
-- Turning a workflow template off now pauses every couple running it
-- (setTemplateStatusAction). Turning it back on offers to resume those
-- couples, and only those: a couple the MC paused one by one, on
-- purpose, must stay paused. The two look identical in `status`, so the
-- reason is recorded next to it.
--
--   template_off  paused because the MC turned the workflow off
--   manual        paused from the couple's Workflow tab
--
-- Null whenever the instance is not paused for either reason: every row
-- that exists today, and every row after it resumes (the resume path
-- clears it). A row cancelled while paused keeps its reason; the resume
-- offer only ever reads `status = 'paused'`, so a stale reason on a
-- cancelled row is inert.
--
-- Additive only: a nullable column with no default rewrites nothing, and
-- the CHECK is satisfied by every existing row (all null).

alter table public.workflow_instances
  add column if not exists paused_reason text;

alter table public.workflow_instances
  drop constraint if exists workflow_instances_paused_reason_check;
alter table public.workflow_instances
  add constraint workflow_instances_paused_reason_check
  check (paused_reason is null or paused_reason in ('template_off', 'manual'));

comment on column public.workflow_instances.paused_reason is
  'Why a paused instance is paused: template_off (the MC turned the workflow off) or manual (paused on the couple). Null otherwise; cleared on resume.';
