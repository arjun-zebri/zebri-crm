-- Canvas positions must be able to say "nobody has placed this yet".
--
-- `canvas_x` / `canvas_y` were created `not null default 0`, so every
-- step arrives at exactly (0, 0). The builder's auto-layout only runs
-- for a step with no saved position (`position_x ?? depth * ROW_GAP`),
-- and a stored 0 is not null, so it never ran: every step in a workflow
-- rendered on top of every other one, and fitView zoomed into the pile.
--
-- The column is presentation only (run order comes from `position` /
-- `parent_step_id` / `branch_path`), so making it nullable costs
-- nothing and restores the distinction the layout code was written
-- against: null means "lay me out", a number means "the MC dragged me
-- here".
--
-- The backfill sets existing (0, 0) rows to null. A step deliberately
-- dragged to exactly (0, 0) would be re-laid-out, which is the same
-- position the auto-layout puts the first step at anyway.

alter table public.workflow_template_steps
  alter column canvas_x drop not null,
  alter column canvas_y drop not null,
  alter column canvas_x set default null,
  alter column canvas_y set default null;

update public.workflow_template_steps
  set canvas_x = null, canvas_y = null
  where canvas_x = 0 and canvas_y = 0;

comment on column public.workflow_template_steps.canvas_x is
  'Builder canvas x. Null means the step has never been dragged and the auto-layout places it.';
comment on column public.workflow_template_steps.canvas_y is
  'Builder canvas y. Null means the step has never been dragged and the auto-layout places it.';
