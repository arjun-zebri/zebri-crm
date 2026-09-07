-- Portal milestones: the steps a couple is allowed to see.
--
-- A workflow is the MC's internal list. "Chase the outstanding balance"
-- and "check the venue will not double-book us again" are steps, and a
-- couple must never read either. So visibility is opt-in per step and
-- defaults to false: the safe direction is that nothing leaks unless the
-- MC deliberately puts it on the couple's page.
--
-- What it buys: a couple who can see "planning call — done, run sheet —
-- with you next week" stops emailing to ask whether anything is
-- happening, which is the single most common interruption in an MC's
-- week.

alter table public.workflow_template_steps
  add column if not exists visible_to_couple boolean not null default false;

alter table public.workflow_steps
  add column if not exists visible_to_couple boolean not null default false;

comment on column public.workflow_template_steps.visible_to_couple is
  'Show this step on the couple''s portal as a milestone. Opt-in: a workflow is an internal list by default.';

comment on column public.workflow_steps.visible_to_couple is
  'Snapshotted from the template step. Opt-in: a workflow is an internal list by default.';

-- Partial index: the portal reads only the visible handful, and on a
-- table where almost every row is invisible a full index would be mostly
-- dead weight.
create index if not exists workflow_steps_visible_idx
  on public.workflow_steps (instance_id)
  where visible_to_couple;

-- ────────────────────────────────────────────────────────────────
-- The couple-facing read.
-- ────────────────────────────────────────────────────────────────
--
-- A separate function rather than another key on get_portal_data: that
-- one is a 150-line jsonb_build_object and replacing it wholesale to add
-- a field would put every other portal section at risk for no gain.
--
-- The couple sees two states only, done and upcoming. They never see
-- `errored` (a failure on the MC's side is not the couple's problem and
-- reads as alarming), and never see `skipped` as distinct from done (the
-- MC decided; explaining that decision is not this page's job).

create or replace function public.get_portal_milestones(token uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
begin
  select couple_id into v_couple_id from _resolve_portal_couple(token);
  if v_couple_id is null then
    return '[]'::json;
  end if;

  return coalesce(
    (select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'title', s.title,
        'note', s.description,
        'status', case when s.status in ('done', 'skipped') then 'done' else 'upcoming' end,
        'due_at', s.due_at
      ) order by s.due_at asc nulls last, s.position asc)
      from public.workflow_steps s
      join public.workflow_instances i on i.id = s.instance_id
      where i.couple_id = v_couple_id
        and i.status = 'active'
        and s.visible_to_couple),
    '[]'::jsonb
  )::json;
end;
$$;

grant execute on function public.get_portal_milestones(uuid) to anon, authenticated;

comment on function public.get_portal_milestones(p_token uuid) is
  'Couple-facing milestones: the workflow steps the MC opted into showing, as done or upcoming.';
