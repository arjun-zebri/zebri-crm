-- How many times the executor has tried this step.
--
-- A transient provider failure used to end a workflow permanently: the
-- step went straight to `errored` and every step gated behind it kept a
-- null due_at forever. The executor now reschedules under a cap, which
-- needs somewhere to count.

alter table public.workflow_steps
  add column if not exists attempt_count int not null default 0;

comment on column public.workflow_steps.attempt_count is
  'Executor attempts so far. Reset when the MC retries by hand.';
