-- Workflows foundation: the unified model that replaces both the
-- standalone Tasks system and the event-driven Automations engine.
--
-- The model is three objects plus their children:
--
--   workflow_templates       A reusable definition the MC builds once.
--   workflow_template_steps  The canvas DAG inside one template.
--   workflow_instances       A template applied to one couple. THIS IS
--                            ALSO THE RUN: where the old engine kept
--                            progress in automation_runs and walked the
--                            template's actions, the new engine snapshots
--                            the steps and walks the snapshot. That is
--                            what lets a manual to-do and an automated
--                            email sit in one ordered list and gate each
--                            other.
--   workflow_steps           The snapshot. One row per checklist item.
--   workflow_tags            User-defined colour tags on templates.
--   workflow_template_tags   Join.
--   workflow_audit_log       Durable trail of every step transition.
--
-- The event bus (automation_events + emit_automation_event) is REUSED
-- unchanged. It is generic infrastructure called by a dozen DB triggers
-- across couples/invoices/contracts/events/bookings; renaming it would
-- mean rewriting all of them for no behavioural gain. It is deliberately
-- NOT on the list of tables frozen or dropped at cutover.
--
-- Every statement here is additive. No destructive markers needed.

-- ────────────────────────────────────────────────────────────────
-- 0. shared updated_at touch function
-- ────────────────────────────────────────────────────────────────
-- The codebase has no single shared handle_updated_at(); each feature
-- ships its own touch function (see touch_email_templates_updated_at in
-- 20260618000000). One function serves all four workflow tables.
create or replace function public.touch_workflows_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────────
-- 1. workflow_tags - user-defined colour tags
-- ────────────────────────────────────────────────────────────────
create table if not exists public.workflow_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  -- Colour name, not a hex value: the UI maps it onto design tokens so
  -- tags stay on-palette in both themes. Same pattern as task_groups.
  color text not null default 'gray',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists workflow_tags_user_id_idx
  on public.workflow_tags (user_id);
-- Case-insensitive uniqueness so "Enquiry" and "enquiry" cannot both exist.
create unique index if not exists workflow_tags_user_name_unique_idx
  on public.workflow_tags (user_id, lower(name));

alter table public.workflow_tags enable row level security;

drop policy if exists workflow_tags_all_own on public.workflow_tags;
create policy workflow_tags_all_own
  on public.workflow_tags for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────────
-- 2. workflow_templates - the reusable definition
-- ────────────────────────────────────────────────────────────────
create table if not exists public.workflow_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  name text not null,
  description text,

  -- New templates start as drafts so an in-progress build never applies
  -- to a real couple.
  status text not null default 'draft' check (
    status in ('draft', 'active', 'archived')
  ),

  -- How instances get created AUTOMATICALLY. 'manual' is always
  -- available regardless of this value: the couple profile's "Apply
  -- workflow" picker offers every non-archived template.
  --   manual              never auto-applies
  --   on_couple_created   a new couple row
  --   on_stage_changed    couple status moved to a chosen value
  --   on_package_applied  couples.selected_package_id became non-null
  --   on_event            any bus event type (this is how the old
  --                       event-driven automations are expressed)
  apply_rule_type text not null default 'manual' check (
    apply_rule_type in (
      'manual', 'on_couple_created', 'on_stage_changed',
      'on_package_applied', 'on_event'
    )
  ),

  -- Rule-specific config, validated by the apply-rule registry's Zod
  -- schema at save time. e.g. on_stage_changed: {"toStatus": "Booked"};
  -- on_package_applied: {"packageId": "uuid"} or {} for any package;
  -- on_event: {"eventType": "contract_signed", "triggerConfig": {...}}.
  apply_rule_config jsonb not null default '{}'::jsonb,

  -- Re-applying the same template to the same couple is normally a
  -- mistake (double emails). The dispatcher enforces this; the column
  -- lets a user opt out for genuinely repeatable workflows.
  allow_reapply boolean not null default false,

  -- Quiet hours: never send between these times. NULL on both means
  -- "use the workspace default". Carried over from automations.
  quiet_hours_start time,
  quiet_hours_end time,

  branch_depth_limit int not null default 2,

  -- The React Flow viewport (x, y, zoom) so the canvas reopens where the
  -- user left it. The builder is a free-placement canvas, not a list.
  canvas_viewport jsonb not null default '{}'::jsonb,

  -- Bumped whenever a step's config changes shape. Snapshotted onto the
  -- instance so we can tell which template version an instance came from.
  version int not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workflow_templates_user_id_idx
  on public.workflow_templates (user_id);

-- The dispatcher's hottest query: "which active templates does user X
-- have?". Partial index keeps drafts out of the way.
create index if not exists workflow_templates_active_rule_idx
  on public.workflow_templates (user_id, apply_rule_type)
  where status = 'active';

alter table public.workflow_templates enable row level security;

drop policy if exists workflow_templates_all_own on public.workflow_templates;
create policy workflow_templates_all_own
  on public.workflow_templates for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- Ownership guards used by the instance policies below. Foreign keys are
-- checked with elevated privileges and ignore RLS, so without these an MC
-- could reference another MC's template or couple and confirm its id
-- exists. Same class of hole as the couples.selected_package_id guard in
-- 20260820010000.
create or replace function public._owns_workflow_template_or_null(p_template_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select p_template_id is null
      or exists (
        select 1 from workflow_templates
        where id = p_template_id and user_id = auth.uid()
      );
$$;

comment on function public._owns_workflow_template_or_null(uuid) is
  'True when the template is the caller''s own, or when none is set. '
  'Foreign keys ignore RLS, so instance policies need this to stop a '
  'cross-tenant template reference.';

create or replace function public._owns_couple_or_null(p_couple_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select p_couple_id is null
      or exists (
        select 1 from couples
        where id = p_couple_id and user_id = auth.uid()
      );
$$;

comment on function public._owns_couple_or_null(uuid) is
  'True when the couple is the caller''s own, or when none is set. '
  'Used by workflow_instances so an instance cannot be attached to '
  'another tenant''s couple.';


-- ────────────────────────────────────────────────────────────────
-- 3. workflow_template_tags - join
-- ────────────────────────────────────────────────────────────────
create table if not exists public.workflow_template_tags (
  template_id uuid not null references public.workflow_templates(id) on delete cascade,
  tag_id uuid not null references public.workflow_tags(id) on delete cascade,
  primary key (template_id, tag_id)
);

create index if not exists workflow_template_tags_tag_idx
  on public.workflow_template_tags (tag_id);

alter table public.workflow_template_tags enable row level security;

-- Both sides must belong to the caller. Checking only the template would
-- let a user attach another tenant's tag and read its id back.
drop policy if exists workflow_template_tags_all_own on public.workflow_template_tags;
create policy workflow_template_tags_all_own
  on public.workflow_template_tags for all
  using (
    exists (select 1 from public.workflow_templates t
            where t.id = template_id and t.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.workflow_templates t
            where t.id = template_id and t.user_id = auth.uid())
    and exists (select 1 from public.workflow_tags g
            where g.id = tag_id and g.user_id = auth.uid())
  );


-- ────────────────────────────────────────────────────────────────
-- 4. workflow_template_steps - the canvas DAG
-- ────────────────────────────────────────────────────────────────
create table if not exists public.workflow_template_steps (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workflow_templates(id) on delete cascade,

  -- Order within the parent branch (or the top-level list when
  -- parent_step_id is null). Sparse integers so a reorder does not have
  -- to renumber the whole list.
  position integer not null,

  -- Step type slug. Plain text, no CHECK, so the application registry in
  -- lib/workflows/steps.ts can grow without a migration.
  --   todo         manual tick by the MC
  --   action       an automated action, config.actionType names which
  --   wait         explicit delay
  --   branch       inline if/else
  --   appointment  a dated to-do in v1, Scheduler-wired later
  type text not null,

  -- Type-specific config. For type='action' this carries
  -- {"actionType": "send_email", ...the existing action config}, which
  -- is why every handler in lib/automations/actions works unchanged.
  config jsonb not null default '{}'::jsonb,

  title text not null default '',
  description text,

  -- When this step becomes due, relative to an anchor. One of:
  --   {"mode":"wedding_relative","direction":"before","amount":2,"unit":"weeks"}
  --   {"mode":"apply_relative","amount":3,"unit":"days"}
  --   {"mode":"after_previous","delayAmount":0,"unit":"days"}
  -- after_previous is the default: it makes a manual to-do naturally
  -- gate every automated step below it.
  timing jsonb not null default '{"mode":"after_previous","delayAmount":0,"unit":"days"}'::jsonb,

  -- Hierarchy. A top-level step has parent_step_id IS NULL. A step under
  -- a branch has parent_step_id = the branch step and branch_path set.
  parent_step_id uuid references public.workflow_template_steps(id) on delete cascade,
  branch_path text check (branch_path in ('yes', 'no')),

  -- Automated steps can be held for the MC to approve before they fire.
  requires_approval boolean not null default false,

  disabled boolean not null default false,

  -- React Flow node coordinates. The builder is a free-placement canvas,
  -- so position on screen is user data, not derived from `position`.
  canvas_x double precision not null default 0,
  canvas_y double precision not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint workflow_template_steps_branch_consistency check (
    (parent_step_id is null and branch_path is null) or
    (parent_step_id is not null and branch_path is not null)
  )
);

create index if not exists workflow_template_steps_template_idx
  on public.workflow_template_steps (template_id, position);
create index if not exists workflow_template_steps_parent_idx
  on public.workflow_template_steps (parent_step_id);

alter table public.workflow_template_steps enable row level security;

drop policy if exists workflow_template_steps_all_own on public.workflow_template_steps;
create policy workflow_template_steps_all_own
  on public.workflow_template_steps for all
  using (
    exists (select 1 from public.workflow_templates t
            where t.id = template_id and t.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.workflow_templates t
            where t.id = template_id and t.user_id = auth.uid())
  );


-- ────────────────────────────────────────────────────────────────
-- 5. workflow_instances - the applied workflow AND the run
-- ────────────────────────────────────────────────────────────────
create table if not exists public.workflow_instances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- NULL couple_id means this is the user's personal workflow: the home
  -- for couple-less to-dos. Exactly one per user (partial unique index
  -- below). It surfaces only in the work queue, never on a couple.
  couple_id uuid references public.couples(id) on delete cascade,

  -- NULL template_id means an ad-hoc instance with no definition behind
  -- it: the per-couple default ("General") and the personal workflow.
  template_id uuid references public.workflow_templates(id) on delete set null,

  name text not null,

  -- The template version this instance was snapshotted from. Template
  -- edits never touch a live instance (Dubsado safety, and it avoids the
  -- Studio Ninja progress-reset bug); this records what it came from.
  template_version int,

  status text not null default 'active' check (
    status in ('active', 'completed', 'cancelled')
  ),

  -- The per-couple default instance. Created by a DB trigger on couple
  -- INSERT so the "every couple has at least one applied workflow"
  -- invariant holds without a lazy-creation race.
  is_default boolean not null default false,
  is_personal boolean not null default false,

  -- The bus event that caused an automatic apply, when there was one.
  -- Combined with the unique index below this is the idempotency key:
  -- one event cannot apply the same template twice.
  trigger_event_id uuid references public.automation_events(id) on delete set null,

  -- Working context carried between automated steps: the triggering
  -- payload plus accumulated action outputs, keyed by step id. Mirrors
  -- automation_runs.last_payload.
  context jsonb not null default '{}'::jsonb,

  applied_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A personal instance has no couple; a default instance must have one.
  constraint workflow_instances_personal_has_no_couple check (
    (is_personal and couple_id is null) or (not is_personal)
  ),
  constraint workflow_instances_default_has_couple check (
    (is_default and couple_id is not null) or (not is_default)
  )
);

create index if not exists workflow_instances_user_idx
  on public.workflow_instances (user_id);
create index if not exists workflow_instances_couple_idx
  on public.workflow_instances (couple_id, applied_at desc)
  where couple_id is not null;
create index if not exists workflow_instances_template_idx
  on public.workflow_instances (template_id);
-- The executor's hot query: "which instances are live?".
create index if not exists workflow_instances_active_idx
  on public.workflow_instances (status, applied_at)
  where status = 'active';

-- Exactly one default per couple, exactly one personal per user.
create unique index if not exists workflow_instances_one_default_per_couple_idx
  on public.workflow_instances (couple_id) where is_default;
create unique index if not exists workflow_instances_one_personal_per_user_idx
  on public.workflow_instances (user_id) where is_personal;

-- Hard idempotency for automatic applies: one bus event opens at most
-- one instance per template. Partial so manual applies (where both
-- columns can repeat) are unaffected.
create unique index if not exists workflow_instances_unique_per_event_idx
  on public.workflow_instances (template_id, trigger_event_id)
  where trigger_event_id is not null;

alter table public.workflow_instances enable row level security;

drop policy if exists workflow_instances_select_own on public.workflow_instances;
create policy workflow_instances_select_own
  on public.workflow_instances for select
  using (auth.uid() = user_id);

drop policy if exists workflow_instances_insert_own on public.workflow_instances;
create policy workflow_instances_insert_own
  on public.workflow_instances for insert
  with check (
    auth.uid() = user_id
    and _owns_couple_or_null(couple_id)
    and _owns_workflow_template_or_null(template_id)
  );

drop policy if exists workflow_instances_update_own on public.workflow_instances;
create policy workflow_instances_update_own
  on public.workflow_instances for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and _owns_couple_or_null(couple_id)
    and _owns_workflow_template_or_null(template_id)
  );

drop policy if exists workflow_instances_delete_own on public.workflow_instances;
create policy workflow_instances_delete_own
  on public.workflow_instances for delete
  using (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────────
-- 6. workflow_steps - the snapshot, and the checklist item
-- ────────────────────────────────────────────────────────────────
create table if not exists public.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.workflow_instances(id) on delete cascade,

  -- The template step this was snapshotted from, when there was one.
  -- NULL for ad-hoc steps the MC typed straight onto the couple.
  -- ON DELETE SET NULL: deleting a template step must never delete
  -- progress on a live couple.
  template_step_id uuid references public.workflow_template_steps(id) on delete set null,

  position integer not null,
  type text not null,
  config jsonb not null default '{}'::jsonb,

  title text not null default '',
  description text,

  timing jsonb not null default '{"mode":"after_previous","delayAmount":0,"unit":"days"}'::jsonb,

  -- When this step is due / becomes actionable. Computed by
  -- lib/workflows/timing.ts at snapshot time, recomputed when the
  -- couple's wedding date moves or the previous step completes.
  -- NULL means "not schedulable yet": an after_previous step whose
  -- predecessor has not finished. That is the gating mechanism.
  due_at timestamptz,

  parent_step_id uuid references public.workflow_steps(id) on delete cascade,
  branch_path text check (branch_path in ('yes', 'no')),

  --   pending  not yet due, or a to-do not yet ticked
  --   running  an automated step currently executing
  --   waiting  held: a wait step, an approval gate, or quiet hours
  --   done     ticked or executed successfully
  --   skipped  the MC skipped it, or a branch did not take this path
  --   errored  execution failed; error_message carries why
  status text not null default 'pending' check (
    status in ('pending', 'running', 'waiting', 'done', 'skipped', 'errored')
  ),

  requires_approval boolean not null default false,
  -- Single-use token emailed to the approver. Random, not guessable.
  approval_token text,
  approval_expires_at timestamptz,

  completed_at timestamptz,
  error_message text,

  -- Whatever the action handler returned, merged into the instance
  -- context so later steps can reference it.
  output jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint workflow_steps_branch_consistency check (
    (parent_step_id is null and branch_path is null) or
    (parent_step_id is not null and branch_path is not null)
  )
);

create index if not exists workflow_steps_instance_idx
  on public.workflow_steps (instance_id, position);
create index if not exists workflow_steps_parent_idx
  on public.workflow_steps (parent_step_id);
create index if not exists workflow_steps_template_step_idx
  on public.workflow_steps (template_step_id);

-- The executor's hot query: "which automated steps are due now?".
create index if not exists workflow_steps_due_idx
  on public.workflow_steps (due_at)
  where status in ('pending', 'waiting') and due_at is not null;

-- Approval lookups are by token; unique so a token cannot collide.
create unique index if not exists workflow_steps_approval_token_idx
  on public.workflow_steps (approval_token)
  where approval_token is not null;

alter table public.workflow_steps enable row level security;

drop policy if exists workflow_steps_all_own on public.workflow_steps;
create policy workflow_steps_all_own
  on public.workflow_steps for all
  using (
    exists (select 1 from public.workflow_instances i
            where i.id = instance_id and i.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.workflow_instances i
            where i.id = instance_id and i.user_id = auth.uid())
  );


-- ────────────────────────────────────────────────────────────────
-- 7. workflow_audit_log - durable trail
-- ────────────────────────────────────────────────────────────────
create table if not exists public.workflow_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instance_id uuid references public.workflow_instances(id) on delete cascade,
  step_id uuid references public.workflow_steps(id) on delete set null,
  couple_id uuid references public.couples(id) on delete cascade,

  -- 'instance_created', 'step_started', 'step_completed', 'step_skipped',
  -- 'step_errored', 'step_waiting', 'branch_taken', 'instance_completed'
  event text not null,
  detail jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists workflow_audit_log_instance_idx
  on public.workflow_audit_log (instance_id, created_at desc);
create index if not exists workflow_audit_log_couple_idx
  on public.workflow_audit_log (couple_id, created_at desc)
  where couple_id is not null;

alter table public.workflow_audit_log enable row level security;

-- SELECT only. Writes go through the service-role-keyed tick and the
-- SECURITY DEFINER helpers, same access model as contract_audit_log.
drop policy if exists workflow_audit_log_select_own on public.workflow_audit_log;
create policy workflow_audit_log_select_own
  on public.workflow_audit_log for select
  using (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────────
-- 8. updated_at triggers
-- ────────────────────────────────────────────────────────────────
drop trigger if exists workflow_templates_set_updated_at on public.workflow_templates;
create trigger workflow_templates_set_updated_at
  before update on public.workflow_templates
  for each row execute function public.touch_workflows_updated_at();

drop trigger if exists workflow_template_steps_set_updated_at on public.workflow_template_steps;
create trigger workflow_template_steps_set_updated_at
  before update on public.workflow_template_steps
  for each row execute function public.touch_workflows_updated_at();

drop trigger if exists workflow_instances_set_updated_at on public.workflow_instances;
create trigger workflow_instances_set_updated_at
  before update on public.workflow_instances
  for each row execute function public.touch_workflows_updated_at();

drop trigger if exists workflow_steps_set_updated_at on public.workflow_steps;
create trigger workflow_steps_set_updated_at
  before update on public.workflow_steps
  for each row execute function public.touch_workflows_updated_at();
