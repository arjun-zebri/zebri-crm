-- @ALLOW_DESTRUCTIVE: timeline templates feature removed; every wedding is bespoke so reusable run-sheet templates add no value (owner-approved 2026-08-02)
-- Remove the timeline-templates feature in full. These two tables backed the
-- "Timelines" tab on /templates and the "Apply template" button in the couple
-- Timeline tab, both of which are gone. The core timeline (timeline_items) and
-- its public RPCs are untouched — they never depended on these tables.

-- timeline_template_items.template_id references timeline_templates(id) with
-- ON DELETE CASCADE, so an ordered drop would work, but cascade keeps this
-- robust against any policy/grant dependency and drops the start_time column
-- added by 20260506000002 along with the table.

-- @ALLOW_DESTRUCTIVE: timeline templates feature removed (owner-approved 2026-08-02)
drop table if exists public.timeline_template_items cascade;
-- @ALLOW_DESTRUCTIVE: timeline templates feature removed (owner-approved 2026-08-02)
drop table if exists public.timeline_templates cascade;
