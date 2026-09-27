-- Phase 6 residual pass (fix wave re-review F1, F3, F4).
--
-- 1. F1: only the step-revision trigger writes
--    workflow_templates.steps_revision. The Turn on refuses a flip (WF002)
--    when the revision moved after its pre-flight read it. A signed-in
--    client could update the column itself (RLS lets the owner update
--    their template row), reset it under a step edit still in flight, and
--    pass that check with steps nobody checked. A BEFORE trigger now
--    refuses any insert or update that sets it, from every role, unless
--    the write comes from inside another trigger: the only trigger that
--    updates this column is _workflow_template_steps_bump_revision
--    (20261024200000), which runs at trigger depth 1, so its UPDATE
--    reaches this guard at depth 2. A client statement reaches it at
--    depth 1. No trigger copies a client value into this column, so depth
--    is a sound test. A column privilege was not used: it needs the
--    table-level UPDATE revoked and every other column re-granted, which
--    silently stops working the day a column is added.
--
-- 2. F3: workflow_steps.skip_reason records why a step was skipped when
--    the reason is the branch logic ('branch'): a branch picking a lane,
--    or the MC skipping a branch step, skipping what sits under it.
--    Reopening a branch restores only those, so a step the MC skipped by
--    hand, or one a resume skipped because its time passed while the
--    workflow was paused, stays skipped: a past wedding-relative step
--    must never send late. Rows skipped before this column carry null
--    and are never restored (the safe side: the MC can reopen one by
--    hand).
--
-- 3. F4: ticking or skipping a held step clears its hold
--    (`due_held_at`), so reopening it later does not bring it back held
--    and undated. A branch skip keeps it: that is not the MC acting on
--    the step, and a reopened branch should bring the step back as the
--    MC left it.
--
-- One BEFORE trigger on workflow_steps does 2 and 3, so every writer
-- (the executor, the MC's actions, the heal, a resume, a migration) gets
-- the same rule without each one remembering it.
--
-- Additive: one column, two trigger functions.

-- 1. The revision guard.
create or replace function public._workflow_templates_guard_steps_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Depth 1 is a statement from a client, the service role or SQL; depth
  -- 2 or more is a write from inside a trigger, i.e. the bump.
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.steps_revision is distinct from 0 then
      raise exception 'steps_revision is set by the database, not by a write'
        using errcode = '42501';
    end if;
  elsif new.steps_revision is distinct from old.steps_revision then
    raise exception 'steps_revision is set by the database, not by a write'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function public._workflow_templates_guard_steps_revision() is
  'Refuses any write of workflow_templates.steps_revision except the step-revision trigger''s bump.';

drop trigger if exists workflow_templates_guard_steps_revision on public.workflow_templates;
create trigger workflow_templates_guard_steps_revision
  before insert or update on public.workflow_templates
  for each row execute function public._workflow_templates_guard_steps_revision();

-- 2. Why a step was skipped.
alter table public.workflow_steps
  add column if not exists skip_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workflow_steps_skip_reason_check'
  ) then
    alter table public.workflow_steps
      add constraint workflow_steps_skip_reason_check
      check (skip_reason is null or skip_reason in ('branch'));
  end if;
end;
$$;

comment on column public.workflow_steps.skip_reason is
  '''branch'' when the branch logic skipped this step (a lane not taken, or everything under a skipped branch). Reopening the branch restores only these. Null on every other skip, and whenever the step is not skipped.';

-- 2 and 3. The step-row rules.
create or replace function public._workflow_steps_skip_and_hold_rules()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- A reason belongs to a skip. Clearing it whenever the step is anything
  -- else means a step entering `skipped` starts with no reason, so only a
  -- writer that says 'branch' sets one.
  if new.status is distinct from 'skipped' then
    new.skip_reason := null;
  end if;
  -- The MC (or the engine) finished or skipped the step: the hold was on
  -- a step that is no longer waiting, so it goes.
  if new.status = 'done'
     or (new.status = 'skipped' and new.skip_reason is distinct from 'branch') then
    new.due_held_at := null;
  end if;
  return new;
end;
$$;

comment on function public._workflow_steps_skip_and_hold_rules() is
  'Clears skip_reason off a step that is not skipped, and the date hold off a step that is done or skipped (a branch skip keeps it).';

drop trigger if exists workflow_steps_skip_and_hold_rules on public.workflow_steps;
create trigger workflow_steps_skip_and_hold_rules
  before insert or update on public.workflow_steps
  for each row execute function public._workflow_steps_skip_and_hold_rules();

select public.ensure_require_mfa_policies();
select public.ensure_shadow_triggers();
