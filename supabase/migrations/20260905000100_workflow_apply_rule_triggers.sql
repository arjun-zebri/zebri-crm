-- Workflows: apply-rule emitters + the default-instance invariant.
--
-- Three triggers:
--
--  1. couples INSERT -> create the couple's default ("General") applied
--     workflow. Doing this in the same transaction as the couple insert
--     is what makes "every couple has at least one applied workflow" a
--     real invariant rather than a lazy-creation race between the
--     Workflow tab and an ad-hoc step insert.
--
--  2. couples UPDATE OF selected_package_id -> emit `package_applied`.
--     That single column is written both by the MC on the couple profile
--     and by the couple in the portal (get_portal_packages, see
--     20260819110000), so one trigger covers both paths. Invoice
--     created / sent / paid are deliberately NOT the anchor: an invoice
--     is a billing artefact and can lag or never exist.
--
--  3. events UPDATE OF date -> recompute due_at on every
--     wedding_relative step of that couple's active instances, so a
--     moved wedding reshuffles the checklist (the 17hats base-date
--     behaviour).
--
-- There is deliberately NO new `couple_created` event: couple INSERT
-- already emits `new_enquiry` (20260604000100), and the workflows
-- `on_couple_created` apply rule matches that existing slug. Emitting a
-- second event for the same row change would double-fire anything
-- listening to both.
--
-- Not destructive: every trigger here is new.

-- ────────────────────────────────────────────────────────────────
-- 1. Default applied workflow on couple creation
-- ────────────────────────────────────────────────────────────────
create or replace function public.tg_couples_create_default_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- on conflict against workflow_instances_one_default_per_couple_idx:
  -- belt and braces, the couple row is brand new so there cannot be one
  -- yet, but a replayed trigger must stay a no-op.
  insert into public.workflow_instances (user_id, couple_id, name, is_default)
  values (new.user_id, new.id, 'General', true)
  on conflict do nothing;
  return new;
end;
$$;

comment on function public.tg_couples_create_default_workflow() is
  'Creates the couple''s default ("General") applied workflow in the same '
  'transaction as the couple insert, so ad-hoc to-dos always have a home.';

drop trigger if exists couples_create_default_workflow on public.couples;
create trigger couples_create_default_workflow
  after insert on public.couples
  for each row execute function public.tg_couples_create_default_workflow();


-- ────────────────────────────────────────────────────────────────
-- 2. package_applied
-- ────────────────────────────────────────────────────────────────
create or replace function public.tg_couples_emit_package_applied()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- `is distinct from` handles the null transitions correctly, and the
  -- non-null guard means clearing a package does not fire. Together they
  -- are why a no-op update never re-emits.
  if new.selected_package_id is not null
     and new.selected_package_id is distinct from old.selected_package_id then
    perform public.emit_automation_event(
      new.user_id,
      'couples',
      new.id,
      'package_applied',
      jsonb_build_object(
        'couple_id', new.id,
        'couple_name', new.name,
        'package_id', new.selected_package_id,
        'previous_package_id', old.selected_package_id,
        'event_date', new.event_date
      ),
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists couples_emit_package_applied on public.couples;
create trigger couples_emit_package_applied
  after update of selected_package_id on public.couples
  for each row execute function public.tg_couples_emit_package_applied();


-- ────────────────────────────────────────────────────────────────
-- 3. Wedding-date change recomputes wedding_relative steps
-- ────────────────────────────────────────────────────────────────
-- Mirrors lib/workflows/timing.ts computeDueAt() for the
-- `wedding_relative` mode only. The other two modes are not affected by
-- a date move: `apply_relative` is anchored to when the workflow was
-- applied, and `after_previous` to a completion instant.
--
-- The timezone is read from user_public_settings with the same
-- Australia/Sydney default the application uses. A hard-coded UTC here
-- would reintroduce the off-by-one-day bug class the Scheduler build
-- spent six fixes on: "2 weeks before" has to mean local midnight in the
-- MC's zone, not 00:00Z.
create or replace function public._workflow_wedding_due_at(
  p_timing jsonb,
  p_wedding_date date,
  p_timezone text
)
returns timestamptz
language plpgsql
immutable
set search_path = public
as $$
declare
  v_amount int;
  v_unit   text;
  v_signed int;
  v_target date;
begin
  if p_wedding_date is null then return null; end if;
  if p_timing->>'mode' is distinct from 'wedding_relative' then return null; end if;

  v_amount := coalesce((p_timing->>'amount')::int, 0);
  v_unit   := coalesce(p_timing->>'unit', 'days');
  v_signed := case when p_timing->>'direction' = 'before' then -v_amount else v_amount end;

  v_target := case v_unit
    when 'weeks'  then p_wedding_date + (v_signed * 7)
    when 'months' then (p_wedding_date + (v_signed || ' months')::interval)::date
    else               p_wedding_date + v_signed
  end;

  -- Local midnight on the shifted date, converted to an instant.
  return (v_target::timestamp at time zone p_timezone);
end;
$$;

comment on function public._workflow_wedding_due_at(jsonb, date, text) is
  'SQL mirror of computeDueAt() for wedding_relative timings. Returns '
  'local midnight on the shifted date in the MC''s timezone.';


-- The couple's wedding date, resolved the same way loadCoupleSnapshot
-- resolves it: the earliest of the couple's `events` rows, falling back
-- to the legacy couple-level column for pre-events-table couples. If
-- these two resolutions ever disagree, a step's due date and an email's
-- {{event.date}} disagree with it, which is worse than either being wrong.
create or replace function public._workflow_couple_wedding_date(p_couple_id uuid)
returns date
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select e.date from public.events e
      where e.couple_id = p_couple_id
      order by e.date asc
      limit 1),
    (select c.event_date from public.couples c where c.id = p_couple_id)
  );
$$;

comment on function public._workflow_couple_wedding_date(uuid) is
  'Earliest event date for the couple, falling back to the legacy '
  'couples.event_date. Mirrors loadCoupleSnapshot / loadWeddingDate.';


-- Recompute every wedding_relative step for one couple.
create or replace function public._workflow_recompute_wedding_steps(p_couple_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id  uuid;
  v_timezone text;
  v_date     date;
begin
  if p_couple_id is null then return; end if;

  select user_id into v_user_id from public.couples where id = p_couple_id;
  if v_user_id is null then return; end if;

  select coalesce(timezone, 'Australia/Sydney') into v_timezone
  from public.user_public_settings where user_id = v_user_id;
  v_timezone := coalesce(v_timezone, 'Australia/Sydney');

  v_date := public._workflow_couple_wedding_date(p_couple_id);

  update public.workflow_steps s
  set due_at = public._workflow_wedding_due_at(s.timing, v_date, v_timezone)
  from public.workflow_instances i
  where s.instance_id = i.id
    and i.couple_id = p_couple_id
    and i.status = 'active'
    -- Terminal steps keep the due_at they had: it is history, and the MC
    -- has already acted on it.
    and s.status in ('pending', 'waiting')
    and s.timing->>'mode' = 'wedding_relative';
end;
$$;

comment on function public._workflow_recompute_wedding_steps(uuid) is
  'Reshuffles wedding_relative workflow steps when a couple''s wedding '
  'date moves. apply_relative and after_previous steps are deliberately '
  'untouched: neither is anchored to the wedding.';


-- Fires from the events table (insert, date update, delete) and from the
-- legacy couples.event_date column. All four can change which date
-- _workflow_couple_wedding_date returns, so all four have to recompute:
-- adding an earlier event moves the anchor just as surely as editing one.
create or replace function public.tg_events_recompute_workflow_due_dates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public._workflow_recompute_wedding_steps(old.couple_id);
    return old;
  end if;
  perform public._workflow_recompute_wedding_steps(new.couple_id);
  return new;
end;
$$;

drop trigger if exists events_recompute_workflow_due_dates on public.events;
create trigger events_recompute_workflow_due_dates
  after insert or delete or update of date on public.events
  for each row execute function public.tg_events_recompute_workflow_due_dates();


create or replace function public.tg_couples_recompute_workflow_due_dates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.event_date is distinct from old.event_date then
    perform public._workflow_recompute_wedding_steps(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists couples_recompute_workflow_due_dates on public.couples;
create trigger couples_recompute_workflow_due_dates
  after update of event_date on public.couples
  for each row execute function public.tg_couples_recompute_workflow_due_dates();
