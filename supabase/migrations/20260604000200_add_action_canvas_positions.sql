-- Phase 14a: canvas positions on automation actions.
--
-- The builder is a node-graph canvas (React Flow). Each action has
-- an x/y coordinate so the user can drag nodes around. The
-- runtime semantics (parent_action_id + branch_path) still drive
-- execution — positions are purely visual.
--
-- New actions default to NULL coordinates; the canvas auto-lays-out
-- any action with a NULL position on open, so old automations
-- created before the canvas render cleanly. The user's first
-- drag stamps a real coordinate.
--
-- Not destructive — additive columns only.

alter table public.automation_actions
  add column if not exists position_x double precision,
  add column if not exists position_y double precision;
