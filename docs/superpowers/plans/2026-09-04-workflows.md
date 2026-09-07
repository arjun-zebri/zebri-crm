# Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Zebri's two overlapping systems (standalone Tasks and event-driven Automations) with one unified **Workflows** feature: reusable templates built on a canvas, applied to a couple as an editable checklist instance, where manual to-dos and automated actions are step types in one ordered sequence.

**Architecture:** The existing automations engine already has the right bones (append-only event bus, dispatcher, runner, action registry, time emitters). The unification is one structural change: **an applied workflow instance IS the run.** Where the old engine walked a template's action DAG and kept progress in `automation_runs`, the new engine snapshots the template's steps into `workflow_steps` rows owned by a `workflow_instances` row, then walks those. That single change is what lets a manual to-do and an automated email sit in one list, gate each other, and render as a checklist. Everything else is re-pointing: the action registry, condition evaluator, variable renderer, quiet hours, recipients and composers are reused unchanged.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase (Postgres + RLS), Zod, `@xyflow/react` (React Flow) for the builder canvas, `@tanstack/react-query`, Vitest 3 (unit + integration against local Supabase), Playwright.

**Spec:** `docs/superpowers/specs/2026-08-19-workflows-design.md` (read the "Decisions settled at implementation planning (2026-09-04)" section at the end first: it reverses one line in the body).

## Global Constraints

- **Do not commit.** Leave every change in the working tree. Branching and worktrees are fine; the user makes the commits. Where a task says "Checkpoint", run the gates and report, do not `git commit`.
- **No em dashes** anywhere: copy, comments, prose, commit messages. Rewrite with natural punctuation.
- **TSDoc on every exported function, type and module**, plus why-comments on non-obvious logic. This overrides any default minimal-comment habit.
- **Design system is mandatory.** Tokens and primitives only. No `text-sm`, `text-xs`, `rounded-lg`, `rounded-xl`, `text-gray-*`, `bg-white`, `border-gray-200`, no inline `style={{}}`, no raw `<button>` / `<input>` / `<select>`. One control height: `h-8`. Radii: `rounded-control` or `rounded-pill`, nothing else. Type: `text-display` / `text-section` / `text-body`. Icons: Lucide at `strokeWidth={1.5}`.
- **Components stay at roughly 150 lines.** Pages are orchestrators: fetch and compose, no form logic or business rules inline.
- **`lib/` is React-free.** Pure functions and server-only modules.
- **Owner column + RLS on every new table:** `user_id uuid not null references auth.users(id) on delete cascade`, base policy `auth.uid() = user_id`. Child tables scope through their parent with an `exists` clause. Foreign keys ignore RLS, so any column referencing another tenant's row (`couple_id`, `template_id`) needs an ownership `with check`, not just an FK. See `20260820010000_couple_package_ownership_guard.sql` for the precedent.
- **Migrations are the source of truth** and deploy only through CI `supabase db push`. Never the Supabase web SQL editor. Destructive statements require an explicit `-- @ALLOW_DESTRUCTIVE: <reason>` marker.
- **`npm run typecheck` must stay at 0 errors.** `npm run typecheck:strict` and `npm run lint:gate` budgets must monotonically decrease; ratchet them down when a task reduces them.
- **New code must be clean under `tsconfig.strict.json`** (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). Declare Zod-backed config types with `z.infer`, never a hand-written twin: under `exactOptionalPropertyTypes` Zod emits `?: T | undefined` and a hand-written twin will not match.
- **Every feature works on desktop and mobile** (Pixel 5, iPhone 12) via Tailwind responsive prefixes, never raw media queries.
- **Never reference `SUPABASE_SERVICE_ROLE_KEY` in a file containing `'use client'`.** CI gate `scripts/check-no-service-role-in-client.mjs` fails the build.
- **Server action files (`'use server'`) export functions only.** Zod schemas exported from them crash at runtime; keep schemas in plain modules. Run `npm run check:server-action-exports`.
- **PostgREST bulk insert needs uniform keys.** A `.insert([...])` array whose rows have differing key sets silently drops rows. Always build snapshot rows from one shared shape and assert `.error` is null.

## Naming decisions locked for this plan

Use these exact names everywhere. Inconsistency here is the single most likely source of churn.

| Concept | Name |
|---|---|
| Reusable definition | table `workflow_templates`, type `WorkflowTemplateRow` |
| A step in a definition | table `workflow_template_steps`, type `WorkflowTemplateStepRow` |
| User tag | table `workflow_tags`, join `workflow_template_tags` |
| Applied per-couple instance | table `workflow_instances`, type `WorkflowInstanceRow` |
| A step in an instance | table `workflow_steps`, type `WorkflowStepRow` |
| Audit trail | table `workflow_audit_log` |
| Event bus | **reused unchanged**: `automation_events` + `emit_automation_event()` |

**The event bus is deliberately NOT renamed and NOT dropped.** Around a dozen DB triggers across `couples`, `invoices`, `contracts`, `events`, `bookings` and the Stripe webhook call `emit_automation_event()` inside their transactions. That function and its table are generic infrastructure, not part of the automations recipe model. Renaming them would mean rewriting every one of those triggers for zero behavioural gain. Phase E freezes and later drops `automations`, `automation_actions`, `automation_runs`, `automation_waits`, `automation_audit_log`, `tasks`, `task_groups`, `task_statuses`, `task_priorities`, `task_types`. It leaves `automation_events`, `emit_automation_event()` and `couple_custom_fields` alone.

---

## File Structure

### Created

**Migrations** (`supabase/migrations/`)
- `20260905000000_create_workflows_foundation.sql` — the six new tables, RLS, indexes, ownership guards.
- `20260905000100_workflow_apply_rule_triggers.sql` — DB triggers for `on_couple_created`, `on_stage_changed`, `on_package_applied`; the default-instance trigger on `couples` INSERT; the wedding-date-change recompute trigger on `events`.
- `20260905000200_workflow_helper_rpcs.sql` — `ensure_default_workflow(uuid)`, `apply_workflow_template(uuid, uuid)`, `emit_workflow_step_event()`.
- `20260906000000_workflows_converter.sql` — one-time converter for the 55 tasks and 27 automations. Idempotent, guarded by a ledger table.
- `20260907000000_freeze_legacy_tables.sql` — revoke DML on the legacy tables at cutover.
- `20260908000000_drop_legacy_tables.sql` — Phase F, carries `-- @ALLOW_DESTRUCTIVE`.

**Domain (`lib/workflows/`)** — pure, React-free, one responsibility each
- `timing.ts` — `computeDueDate()`, `recomputeInstanceDueDates()`. The only place date arithmetic for steps lives.
- `apply-rules.ts` — the apply-rule registry: slug, Zod config schema, `matches(event, config)`.
- `dispatcher.ts` — pulls pending bus events, matches apply rules, creates instances. Replaces `lib/automations/dispatcher.ts`.
- `instantiate.ts` — snapshots template steps into instance steps. The one place the template-to-instance copy happens.
- `executor.ts` — advances due steps in live instances. Replaces `lib/automations/runner.ts`.
- `steps.ts` — step-type registry: which types are automated, which are manual, which are flow control.
- `audit.ts` — `writeAudit()` against `workflow_audit_log`.
- `converter.ts` — the TypeScript half of the legacy conversion (used by the integration test to seed and assert; the SQL migration is the shipping path).
- `queue.ts` — the work-queue query: overdue / due today / upcoming grouping.
- `ai-copilot/` — `llm-client.ts`, `stream.ts`, `system-prompt.ts`, `tool-executors.ts`, `tool-schemas.ts` ported from `lib/automations/ai-copilot/` and re-pointed at the new tables.

**Types**
- `types/workflows.ts` — `StepType`, `ApplyRuleType`, `StepTiming`, the six row types, `WorkflowInstanceWithSteps`.

**Routes / pages (`app/(dashboard)/workflows/`)**
- `page.tsx` — orchestrator: reads `?tab=`, composes Queue or Templates.
- `workflows-queue.tsx`, `queue-group.tsx`, `queue-row.tsx`, `queue-filters.tsx` — the daily view.
- `workflows-templates.tsx`, `template-card.tsx`, `template-tag-filter.tsx`, `tag-editor-modal.tsx` — the library.
- `actions.ts` — server actions for templates, instances, steps, tags.
- `[id]/page.tsx` and the ported builder files (see the rename map in Task 10).

**Couple profile**
- `app/(dashboard)/couples/couple-workflow.tsx` — the folded tab orchestrator.
- `app/(dashboard)/couples/workflow-checklist.tsx` — the vertical checklist rendering of one instance.
- `app/(dashboard)/couples/workflow-step-row.tsx` — one step: checkbox, title, due chip, overflow menu.
- `app/(dashboard)/couples/workflow-apply-picker.tsx` — "Apply workflow" picker.
- `app/(dashboard)/couples/workflow-add-step.tsx` — inline ad-hoc step add.
- `app/(dashboard)/couples/use-couple-workflows.ts` — data hook.

**Dashboard**
- `app/(dashboard)/dashboard-steps.tsx` — replaces `dashboard-tasks.tsx`.

**Redirects**
- `app/(dashboard)/tasks/page.tsx` (replaced with a redirect), `app/(dashboard)/automations/page.tsx` and `app/(dashboard)/automations/[id]/page.tsx` (replaced with redirects).

### Modified

- `app/components/sidebar.tsx` — drop Tasks and Automations, add Workflows.
- `app/(dashboard)/couples/couple-profile.tsx` and `couple-profile-tabs.ts` and `couple-profile-body.tsx` — fold `tasks` + `automations` tab keys into one `workflow` key.
- `app/(dashboard)/page.tsx`, `use-dashboard.ts` — swap the tasks widget for the steps widget.
- `app/api/cron/automations-tick/route.ts` — tick both engines during Phase A to E, then only the workflow engine.
- `lib/automations/actions/task.ts` — `create_task` / `update_task` / `create_calendar_event` / `create_reminder` re-point at the couple's default workflow instance.
- `lib/automations/time-emitters/task-overdue.ts` becomes `lib/workflows/emitters/step-overdue.ts`.
- `types/automations.ts` — `RunContext` gains `instanceId` and `stepId`.
- `types/database.ts` — regenerated LAST, after every migration in the batch, in one pass.

### Deleted at cutover (Phase E)

`app/(dashboard)/tasks/` (11 files, 4907 lines) and `app/(dashboard)/automations/` after its builder files have been moved (see Task 10's rename map). `app/(dashboard)/couples/couple-tasks.tsx`, `couple-automations*.tsx` (9 files), `components/events/event-tasks.tsx`, `app/(dashboard)/dashboard-tasks.tsx`.

---

# Phase A: Schema + engine core

## Task 1: Workflows schema foundation

**Files:**
- Create: `supabase/migrations/20260905000000_create_workflows_foundation.sql`
- Test: `tests/integration/rls/workflows.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: tables `workflow_templates`, `workflow_template_steps`, `workflow_tags`, `workflow_template_tags`, `workflow_instances`, `workflow_steps`, `workflow_audit_log`; helper `public._owns_workflow_template_or_null(uuid)`.

- [ ] **Step 1: Write the failing RLS integration test**

Create `tests/integration/rls/workflows.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestUser, type TestUser } from '../helpers/supabase';

/**
 * RLS tenant isolation for the Workflows tables.
 *
 * Every table is owner-scoped. Child tables (`workflow_template_steps`,
 * `workflow_steps`, `workflow_template_tags`) scope through their parent,
 * so a cross-tenant read must return zero rows even when the attacker
 * knows the parent id.
 *
 * The cross-tenant WRITE cases matter as much as the reads: foreign keys
 * are checked with elevated privileges and ignore RLS, so an owner-only
 * `with check (auth.uid() = user_id)` still lets user B insert an
 * instance pointing at user A's couple or template unless the policy
 * carries an explicit ownership clause.
 */
describe('RLS: workflows tenant isolation', () => {
  let userA: TestUser;
  let userB: TestUser;
  let templateAId: string;
  let coupleAId: string;
  let instanceAId: string;
  let stepAId: string;

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' };
    userA = await createTestUser({}, pro);
    userB = await createTestUser({}, pro);

    const { data: tpl, error: tplErr } = await userA.client
      .from('workflow_templates')
      .insert({ user_id: userA.id, name: 'Gold package' })
      .select('id')
      .single();
    expect(tplErr).toBeNull();
    templateAId = tpl!.id;

    const { data: couple, error: coupleErr } = await userA.client
      .from('couples')
      .insert({ user_id: userA.id, name: 'Sarah & Tom' })
      .select('id')
      .single();
    expect(coupleErr).toBeNull();
    coupleAId = couple!.id;

    const { data: inst, error: instErr } = await userA.client
      .from('workflow_instances')
      .insert({
        user_id: userA.id,
        couple_id: coupleAId,
        template_id: templateAId,
        name: 'Gold package',
      })
      .select('id')
      .single();
    expect(instErr).toBeNull();
    instanceAId = inst!.id;

    const { data: step, error: stepErr } = await userA.client
      .from('workflow_steps')
      .insert({
        instance_id: instanceAId,
        position: 0,
        type: 'todo',
        title: 'Call the venue',
      })
      .select('id')
      .single();
    expect(stepErr).toBeNull();
    stepAId = step!.id;
  });

  afterAll(async () => {
    await userA?.cleanup();
    await userB?.cleanup();
  });

  it('owner reads their own template', async () => {
    const { data } = await userA.client
      .from('workflow_templates')
      .select('id')
      .eq('id', templateAId);
    expect(data).toHaveLength(1);
  });

  it('another tenant cannot SELECT the template', async () => {
    const { data, error } = await userB.client
      .from('workflow_templates')
      .select('*')
      .eq('id', templateAId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('another tenant cannot UPDATE or DELETE the template', async () => {
    await userB.client
      .from('workflow_templates')
      .update({ name: 'hijacked' })
      .eq('id', templateAId);
    await userB.client.from('workflow_templates').delete().eq('id', templateAId);
    const { data } = await userA.client
      .from('workflow_templates')
      .select('name')
      .eq('id', templateAId)
      .single();
    expect(data!.name).toBe('Gold package');
  });

  it('another tenant cannot SELECT the instance or its steps', async () => {
    const { data: inst } = await userB.client
      .from('workflow_instances')
      .select('*')
      .eq('id', instanceAId);
    expect(inst).toEqual([]);
    const { data: steps } = await userB.client
      .from('workflow_steps')
      .select('*')
      .eq('id', stepAId);
    expect(steps).toEqual([]);
  });

  it('another tenant cannot INSERT a step into the instance', async () => {
    const { error } = await userB.client
      .from('workflow_steps')
      .insert({ instance_id: instanceAId, position: 99, type: 'todo', title: 'injected' });
    expect(error).not.toBeNull();
  });

  it('another tenant cannot create an instance against the victim couple', async () => {
    const { error } = await userB.client
      .from('workflow_instances')
      .insert({ user_id: userB.id, couple_id: coupleAId, name: 'cross tenant' });
    expect(error).not.toBeNull();
  });

  it('another tenant cannot create an instance against the victim template', async () => {
    const { error } = await userB.client
      .from('workflow_instances')
      .insert({ user_id: userB.id, template_id: templateAId, name: 'cross tenant' });
    expect(error).not.toBeNull();
  });

  it('another tenant cannot tag the victim template', async () => {
    const { data: tag } = await userB.client
      .from('workflow_tags')
      .insert({ user_id: userB.id, name: 'mine', color: 'blue' })
      .select('id')
      .single();
    const { error } = await userB.client
      .from('workflow_template_tags')
      .insert({ template_id: templateAId, tag_id: tag!.id });
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm run test:integration -- tests/integration/rls/workflows.test.ts`
Expected: FAIL with a PostgREST error along the lines of `relation "public.workflow_templates" does not exist`.

If the run reports "skipped" with `permission denied`, the local DB was reset and lost its DML grants. Run the repair SQL for the stale CLI before continuing; this is a known local-only breakage, not a schema bug.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260905000000_create_workflows_foundation.sql`:

```sql
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
-- mean rewriting all of them for no behavioural gain.
--
-- Every statement here is additive. No destructive markers needed.

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

  -- How instances get created. 'manual' is always available regardless
  -- of this value: the couple profile's "Apply workflow" picker offers
  -- every non-archived template. The rule below is the AUTOMATIC path.
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
  -- on_event: {"eventType": "contract_signed", ...trigger filters}.
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
  -- user left it. Shape: {"x": 0, "y": 0, "zoom": 1}.
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
-- have for apply rule R?". Partial index keeps drafts out of the way.
create index if not exists workflow_templates_active_rule_idx
  on public.workflow_templates (user_id, apply_rule_type)
  where status = 'active';

alter table public.workflow_templates enable row level security;

drop policy if exists workflow_templates_all_own on public.workflow_templates;
create policy workflow_templates_all_own
  on public.workflow_templates for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- Ownership guard used by the policies below. Foreign keys are checked
-- with elevated privileges and ignore RLS, so without this an MC could
-- reference another MC's template and confirm its id exists. Same class
-- of hole as the couples.selected_package_id guard in 20260820010000.
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
  --   appointment  a dated to-do in v1, Scheduler-wired in Phase F
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
-- one instance per template. Partial so manual applies (both columns
-- involved can repeat) are unaffected.
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
  -- NULL means "not schedulable yet" (an after_previous step whose
  -- predecessor has not finished).
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
-- 8. updated_at triggers, matching the rest of the schema
-- ────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'workflow_templates', 'workflow_template_steps',
    'workflow_instances', 'workflow_steps'
  ]
  loop
    execute format(
      'drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I '
      'for each row execute function public.handle_updated_at()', t);
  end loop;
end $$;
```

Before writing the last block, confirm the project's shared updated_at function name:
Run: `grep -rn "handle_updated_at\|set_updated_at\|moddatetime" supabase/migrations | head`
If the codebase uses a different name, use that one. If there is no shared helper, drop the block and set `updated_at` from the application layer instead, matching whatever the neighbouring tables do.

- [ ] **Step 4: Apply the migration locally and run the test**

```bash
supabase db reset
# If integration tests then report "permission denied", apply the known
# local grant-repair SQL: `supabase db reset` on the pinned CLI leaves
# tables with no DML grants. This is a local tooling issue, not a bug in
# the migration.
npm run test:integration -- tests/integration/rls/workflows.test.ts
```
Expected: PASS, all ten cases.

- [ ] **Step 5: Verify the migration safety gate accepts it**

Run: `bash scripts/check-migrations.sh`
Expected: PASS. There are no destructive statements in this file, so no `@ALLOW_DESTRUCTIVE` marker is needed.

- [ ] **Step 6: Checkpoint**

Do not commit. Report: tables created, tests passing, gate green.

---

## Task 2: Domain types + step and apply-rule registries

**Files:**
- Create: `types/workflows.ts`, `lib/workflows/steps.ts`, `lib/workflows/apply-rules.ts`
- Modify: `types/automations.ts` (extend `RunContext`)
- Test: `tests/unit/lib/workflows/apply-rules.test.ts`, `tests/unit/lib/workflows/steps.test.ts`

**Interfaces:**
- Consumes: tables from Task 1.
- Produces:
  - `types/workflows.ts`: `StepType = 'todo' | 'action' | 'wait' | 'branch' | 'appointment'`; `ApplyRuleType = 'manual' | 'on_couple_created' | 'on_stage_changed' | 'on_package_applied' | 'on_event'`; `StepTiming` (discriminated union); `WorkflowTemplateRow`, `WorkflowTemplateStepRow`, `WorkflowInstanceRow`, `WorkflowStepRow`, `WorkflowTagRow`, `WorkflowInstanceWithSteps`.
  - `lib/workflows/steps.ts`: `stepRegistry: Record<StepType, StepSpec>`, `getStepSpec(type: string): StepSpec | null`, `isAutomated(type: string): boolean`.
  - `lib/workflows/apply-rules.ts`: `applyRuleRegistry: Record<ApplyRuleType, ApplyRuleSpec>`, `getApplyRuleSpec(type: string): ApplyRuleSpec | null`.
  - `types/automations.ts`: `RunContext` gains `instanceId: string` and `stepId: string`.

- [ ] **Step 1: Write the failing apply-rule test**

Create `tests/unit/lib/workflows/apply-rules.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { getApplyRuleSpec } from '@/lib/workflows/apply-rules';
import type { AutomationEventRow } from '@/types/automations';

/** Minimal bus event, widened per case. */
function event(over: Partial<AutomationEventRow>): AutomationEventRow {
  return {
    id: 'e1',
    user_id: 'u1',
    source_table: 'couples',
    source_id: 'c1',
    event_type: 'couple_created',
    payload: {},
    couple_id: 'c1',
    created_at: '2026-09-04T00:00:00Z',
    processed_at: null,
    error_message: null,
    ...over,
  } as AutomationEventRow;
}

describe('apply rules', () => {
  it('manual never matches an event', () => {
    const spec = getApplyRuleSpec('manual')!;
    expect(spec.matches(event({}), {})).toBe(false);
  });

  it('on_couple_created matches only couple_created', () => {
    const spec = getApplyRuleSpec('on_couple_created')!;
    expect(spec.matches(event({ event_type: 'couple_created' }), {})).toBe(true);
    expect(spec.matches(event({ event_type: 'contract_signed' }), {})).toBe(false);
  });

  it('on_stage_changed matches the configured destination status', () => {
    const spec = getApplyRuleSpec('on_stage_changed')!;
    const e = event({ event_type: 'couple_stage_changed', payload: { to_status: 'Booked' } });
    expect(spec.matches(e, spec.configSchema.parse({ toStatus: 'Booked' }))).toBe(true);
    expect(spec.matches(e, spec.configSchema.parse({ toStatus: 'Enquiry' }))).toBe(false);
  });

  it('on_stage_changed compares case-insensitively', () => {
    // Couple statuses are user-defined free text. An MC who renames
    // "booked" to "Booked" must not silently kill their workflow.
    const spec = getApplyRuleSpec('on_stage_changed')!;
    const e = event({ event_type: 'couple_stage_changed', payload: { to_status: 'booked' } });
    expect(spec.matches(e, spec.configSchema.parse({ toStatus: 'Booked' }))).toBe(true);
  });

  it('on_package_applied matches any package when none is configured', () => {
    const spec = getApplyRuleSpec('on_package_applied')!;
    const e = event({ event_type: 'package_applied', payload: { package_id: 'p1' } });
    expect(spec.matches(e, spec.configSchema.parse({}))).toBe(true);
  });

  it('on_package_applied narrows to the configured package', () => {
    const spec = getApplyRuleSpec('on_package_applied')!;
    const e = event({ event_type: 'package_applied', payload: { package_id: 'p1' } });
    expect(spec.matches(e, spec.configSchema.parse({ packageId: 'p1' }))).toBe(true);
    expect(spec.matches(e, spec.configSchema.parse({ packageId: 'p2' }))).toBe(false);
  });

  it('on_event delegates to the existing trigger registry', () => {
    const spec = getApplyRuleSpec('on_event')!;
    const e = event({ event_type: 'contract_signed', payload: {} });
    const cfg = spec.configSchema.parse({ eventType: 'contract_signed', triggerConfig: {} });
    expect(spec.matches(e, cfg)).toBe(true);
    expect(spec.matches(event({ event_type: 'new_enquiry' }), cfg)).toBe(false);
  });

  it('every registry entry parses an empty config without throwing', () => {
    // A rule whose schema rejects {} is a dead rule: the dispatcher
    // re-parses config on every event and a rejected config silently
    // never matches. Same failure mode the trigger sweep found.
    for (const type of ['manual', 'on_couple_created', 'on_stage_changed', 'on_package_applied'] as const) {
      const spec = getApplyRuleSpec(type)!;
      expect(() => spec.configSchema.parse({})).not.toThrow();
    }
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm run test:unit -- tests/unit/lib/workflows/apply-rules.test.ts`
Expected: FAIL, cannot resolve `@/lib/workflows/apply-rules`.

- [ ] **Step 3: Write `types/workflows.ts`**

```ts
/**
 * Workflows domain types.
 *
 * Mirrors `supabase/migrations/20260905000000_create_workflows_foundation.sql`.
 * Row types here are hand-written for ergonomics; cross-check them against
 * the generated `Database['public']['Tables'][...]` types after the batch's
 * final `supabase gen types` pass.
 *
 * Terminology: a **template** is the reusable definition, an **instance**
 * is that template applied to one couple, and a **step** is one item in
 * either. An instance is also the run: the engine walks the instance's
 * snapshotted steps, not the template's.
 *
 * @module types/workflows
 */

import type { Json } from './database';

/** The kinds of step a workflow can contain. */
export type StepType = 'todo' | 'action' | 'wait' | 'branch' | 'appointment';

/** How instances of a template get created automatically. */
export type ApplyRuleType =
  | 'manual'
  | 'on_couple_created'
  | 'on_stage_changed'
  | 'on_package_applied'
  | 'on_event';

/** Lifecycle of a template. */
export type TemplateStatus = 'draft' | 'active' | 'archived';

/** Lifecycle of an applied instance. */
export type InstanceStatus = 'active' | 'completed' | 'cancelled';

/** Lifecycle of one step inside an instance. */
export type StepStatus =
  | 'pending'
  | 'running'
  | 'waiting'
  | 'done'
  | 'skipped'
  | 'errored';

/**
 * When a step comes due, relative to an anchor.
 *
 * `after_previous` is the default and the reason manual to-dos can gate
 * automated steps: an automated step anchored to its predecessor has no
 * `due_at` until that predecessor is ticked.
 */
export type StepTiming =
  | {
      mode: 'wedding_relative';
      direction: 'before' | 'after';
      amount: number;
      unit: 'days' | 'weeks' | 'months';
    }
  | { mode: 'apply_relative'; amount: number; unit: 'days' | 'weeks' | 'months' }
  | { mode: 'after_previous'; delayAmount: number; unit: 'hours' | 'days' };

export interface WorkflowTagRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
}

export interface WorkflowTemplateRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: TemplateStatus;
  apply_rule_type: ApplyRuleType;
  apply_rule_config: Json;
  allow_reapply: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  branch_depth_limit: number;
  canvas_viewport: Json;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowTemplateStepRow {
  id: string;
  template_id: string;
  position: number;
  type: StepType;
  config: Json;
  title: string;
  description: string | null;
  timing: StepTiming;
  parent_step_id: string | null;
  branch_path: 'yes' | 'no' | null;
  requires_approval: boolean;
  disabled: boolean;
  canvas_x: number;
  canvas_y: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowInstanceRow {
  id: string;
  user_id: string;
  couple_id: string | null;
  template_id: string | null;
  name: string;
  template_version: number | null;
  status: InstanceStatus;
  is_default: boolean;
  is_personal: boolean;
  trigger_event_id: string | null;
  context: Json;
  applied_at: string;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStepRow {
  id: string;
  instance_id: string;
  template_step_id: string | null;
  position: number;
  type: StepType;
  config: Json;
  title: string;
  description: string | null;
  timing: StepTiming;
  due_at: string | null;
  parent_step_id: string | null;
  branch_path: 'yes' | 'no' | null;
  status: StepStatus;
  requires_approval: boolean;
  approval_token: string | null;
  approval_expires_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  output: Json | null;
  created_at: string;
  updated_at: string;
}

/** An instance with its steps loaded, ordered by position. */
export interface WorkflowInstanceWithSteps extends WorkflowInstanceRow {
  steps: WorkflowStepRow[];
}

/** Progress summary rendered as "step 7 of 20". */
export interface WorkflowProgress {
  done: number;
  total: number;
  /** Steps that are done or skipped, over steps that are not skipped. */
  percent: number;
}
```

- [ ] **Step 4: Write `lib/workflows/steps.ts`**

```ts
/**
 * Step-type registry.
 *
 * One entry per step type the engine understands. The registry answers
 * the two questions the engine and the builder both need: is this step
 * something the engine executes on its own, and what does the builder
 * render for it.
 *
 * `action` steps carry the action slug in `config.actionType` and
 * delegate to the existing registry in `lib/automations/actions`. That
 * indirection is deliberate: it means every action handler, its Zod
 * schema, its composer modal and its templating keep working with no
 * change at all.
 *
 * @module lib/workflows/steps
 */

import type { StepType } from '@/types/workflows';

export interface StepSpec {
  type: StepType;
  /** Does the engine execute this without the MC touching it? */
  automated: boolean;
  /** Label shown in the builder's step picker. */
  label: string;
  /** One-line description for the picker tile. */
  description: string;
  /** Lucide icon name, rendered at strokeWidth 1.5. */
  icon: string;
}

export const stepRegistry: Record<StepType, StepSpec> = {
  todo: {
    type: 'todo',
    automated: false,
    label: 'To-do',
    description: 'Something you tick off yourself',
    icon: 'CheckSquare',
  },
  action: {
    type: 'action',
    automated: true,
    label: 'Automated action',
    description: 'Send an email, invoice, contract or update the couple',
    icon: 'Zap',
  },
  wait: {
    type: 'wait',
    automated: true,
    label: 'Wait',
    description: 'Pause before the next step',
    icon: 'Timer',
  },
  branch: {
    type: 'branch',
    automated: true,
    label: 'Branch',
    description: 'Take one path or the other',
    icon: 'GitBranch',
  },
  appointment: {
    type: 'appointment',
    automated: false,
    label: 'Appointment',
    description: 'A dated meeting to hold in the diary',
    icon: 'CalendarClock',
  },
};

/** Look up a step spec by slug. Returns null for an unknown type. */
export function getStepSpec(type: string): StepSpec | null {
  return stepRegistry[type as StepType] ?? null;
}

/**
 * True when the engine executes this step type by itself. Manual types
 * (`todo`, `appointment`) sit in `pending` until the MC ticks them, and
 * that is what gates everything anchored after them.
 */
export function isAutomated(type: string): boolean {
  return getStepSpec(type)?.automated ?? false;
}
```

- [ ] **Step 5: Write `lib/workflows/apply-rules.ts`**

```ts
/**
 * Apply-rule registry.
 *
 * An apply rule decides whether a bus event should create an instance of
 * a template for a couple. It is the workflows equivalent of an
 * automation's trigger, with two differences: `manual` is a first-class
 * rule that never matches an event, and `on_event` delegates to the
 * existing trigger registry so every one of the 28 automation triggers
 * remains expressible with no new matcher code.
 *
 * A rule whose `configSchema` rejects its stored config silently never
 * matches. Give every optional field a `.default()` so a config saved
 * before a field existed still parses. This is the exact failure mode
 * the 2026-08-13 trigger sweep found in the automations dispatcher.
 *
 * @module lib/workflows/apply-rules
 */

import { z } from 'zod';

import type { AutomationEventRow, TriggerType } from '@/types/automations';
import type { ApplyRuleType } from '@/types/workflows';

import { getTriggerSpec } from '../automations/triggers';

export interface ApplyRuleSpec<Config = unknown> {
  type: ApplyRuleType;
  configSchema: z.ZodType<Config>;
  /** Label for the builder's apply-rule picker. */
  label: string;
  matches: (event: AutomationEventRow, config: Config) => boolean;
}

/** Reads a string field out of a bus event payload. */
function payloadString(event: AutomationEventRow, key: string): string | null {
  const payload = event.payload as Record<string, unknown> | null;
  const value = payload?.[key];
  return typeof value === 'string' ? value : null;
}

const manualSchema = z.object({}).passthrough();
const manual: ApplyRuleSpec<z.infer<typeof manualSchema>> = {
  type: 'manual',
  configSchema: manualSchema,
  label: 'Only when I apply it',
  // Never matches. A manual template is applied from the couple profile
  // picker, which inserts the instance directly.
  matches: () => false,
};

const coupleCreatedSchema = z.object({}).passthrough();
const onCoupleCreated: ApplyRuleSpec<z.infer<typeof coupleCreatedSchema>> = {
  type: 'on_couple_created',
  configSchema: coupleCreatedSchema,
  label: 'When a couple is created',
  matches: (event) => event.event_type === 'couple_created',
};

const stageChangedSchema = z
  .object({ toStatus: z.string().default('') })
  .passthrough();
const onStageChanged: ApplyRuleSpec<z.infer<typeof stageChangedSchema>> = {
  type: 'on_stage_changed',
  configSchema: stageChangedSchema,
  label: 'When the couple moves to a status',
  matches: (event, config) => {
    if (event.event_type !== 'couple_stage_changed') return false;
    const to = payloadString(event, 'to_status');
    if (!to) return false;
    // Couple statuses are user-defined free text and get renamed. Compare
    // case-insensitively so a capitalisation change does not silently kill
    // an MC's workflow.
    return to.toLowerCase() === config.toStatus.toLowerCase();
  },
};

const packageAppliedSchema = z
  .object({ packageId: z.string().uuid().optional() })
  .passthrough();
const onPackageApplied: ApplyRuleSpec<z.infer<typeof packageAppliedSchema>> = {
  type: 'on_package_applied',
  configSchema: packageAppliedSchema,
  label: 'When a package is applied',
  matches: (event, config) => {
    if (event.event_type !== 'package_applied') return false;
    // No package configured means "any package".
    if (!config.packageId) return true;
    return payloadString(event, 'package_id') === config.packageId;
  },
};

const onEventSchema = z
  .object({
    eventType: z.string().default(''),
    /** The chosen trigger's own filter config, parsed by its spec. */
    triggerConfig: z.record(z.unknown()).default({}),
  })
  .passthrough();
const onEvent: ApplyRuleSpec<z.infer<typeof onEventSchema>> = {
  type: 'on_event',
  configSchema: onEventSchema,
  label: 'When something happens',
  matches: (event, config) => {
    if (event.event_type !== config.eventType) return false;
    const spec = getTriggerSpec(config.eventType as TriggerType);
    if (!spec) return false;
    // Re-parse through the trigger's own schema so optional fields with
    // declared defaults resolve before match() compares against them.
    const parsed = spec.configSchema.safeParse(config.triggerConfig);
    if (!parsed.success) return false;
    return spec.match(event, parsed.data);
  },
};

export const applyRuleRegistry: Record<ApplyRuleType, ApplyRuleSpec<any>> = {
  manual,
  on_couple_created: onCoupleCreated,
  on_stage_changed: onStageChanged,
  on_package_applied: onPackageApplied,
  on_event: onEvent,
};

/** Look up an apply-rule spec by slug. Returns null for an unknown type. */
export function getApplyRuleSpec(type: string): ApplyRuleSpec | null {
  return applyRuleRegistry[type as ApplyRuleType] ?? null;
}
```

- [ ] **Step 6: Extend `RunContext` in `types/automations.ts`**

Find `export interface RunContext` and add these two fields, keeping every existing field:

```ts
  /**
   * The applied workflow instance this step belongs to. In the unified
   * model the instance is the run, so `runId` above is populated with
   * the same value for backwards compatibility with action handlers
   * that read it.
   */
  instanceId: string

  /** The workflow step currently executing. */
  stepId: string
```

Then update the TSDoc on `automationId` and `runId` to record that the workflow engine populates them with the template id (or the instance id for an ad-hoc instance) and the instance id respectively. Do not remove them: eight action handler modules read them, and keeping the shape means none of those files change.

- [ ] **Step 7: Write the step-registry test**

Create `tests/unit/lib/workflows/steps.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { getStepSpec, isAutomated, stepRegistry } from '@/lib/workflows/steps';
import type { StepType } from '@/types/workflows';

describe('step registry', () => {
  it('covers every StepType', () => {
    const expected: StepType[] = ['todo', 'action', 'wait', 'branch', 'appointment'];
    expect(Object.keys(stepRegistry).sort()).toEqual([...expected].sort());
  });

  it('each entry declares its own type as the key', () => {
    for (const [key, spec] of Object.entries(stepRegistry)) {
      expect(spec.type).toBe(key);
    }
  });

  it('to-do and appointment are manual, the rest are automated', () => {
    expect(isAutomated('todo')).toBe(false);
    expect(isAutomated('appointment')).toBe(false);
    expect(isAutomated('action')).toBe(true);
    expect(isAutomated('wait')).toBe(true);
    expect(isAutomated('branch')).toBe(true);
  });

  it('an unknown type is not automated and has no spec', () => {
    expect(getStepSpec('nonsense')).toBeNull();
    expect(isAutomated('nonsense')).toBe(false);
  });
});
```

- [ ] **Step 8: Run both unit tests**

Run: `npm run test:unit -- tests/unit/lib/workflows/`
Expected: PASS.

- [ ] **Step 9: Checkpoint**

Run: `npm run typecheck && npm run typecheck:strict`
Expected: base at 0 errors; strict no worse than the recorded budget. Do not commit.

---

## Task 3: Step timing

**Files:**
- Create: `lib/workflows/timing.ts`
- Test: `tests/unit/lib/workflows/timing.test.ts`

**Interfaces:**
- Consumes: `StepTiming`, `WorkflowStepRow` from `types/workflows`.
- Produces:
  - `computeDueAt(timing: StepTiming, anchors: TimingAnchors): string | null`
  - `interface TimingAnchors { weddingDate: string | null; appliedAt: string; previousCompletedAt: string | null; timezone: string }`
  - `recomputeDueDates(steps: WorkflowStepRow[], anchors: Omit<TimingAnchors, 'previousCompletedAt'>): Array<{ id: string; due_at: string | null }>`

This is the highest-value pure module in the feature and the one most likely to be quietly wrong, so it gets the most test coverage.

**Do not hand-roll date or hour arithmetic on instants.** Compose `zonedDateParts` and `zonedTimeToUtc` from `lib/scheduling/timezone`, which already exist and are the project's answer to this. Six timezone bugs were found in the Scheduler build alone, every one hidden by fixtures pinned to UTC where wrong and right coincide. **Every fixture in this test file must carry a non-UTC case.**

- [ ] **Step 1: Confirm the timezone helpers' signatures**

Run: `grep -n "^export function\|^export interface" lib/scheduling/timezone.ts`
Use whatever `zonedTimeToUtc` and `zonedDateParts` actually take. If a helper you need is missing, add it there rather than inlining arithmetic here.

- [ ] **Step 2: Write the failing timing test**

Create `tests/unit/lib/workflows/timing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { computeDueAt, recomputeDueDates } from '@/lib/workflows/timing';
import type { StepTiming, WorkflowStepRow } from '@/types/workflows';

const SYDNEY = 'Australia/Sydney';

/**
 * Anchors for a couple married on 2026-11-14, whose workflow was applied
 * on 2026-09-04. Sydney, deliberately not UTC: a UTC fixture makes wrong
 * and right coincide and hides exactly the bug class this module has.
 */
const anchors = {
  weddingDate: '2026-11-14',
  appliedAt: '2026-09-04T03:00:00Z', // 2026-09-04 13:00 Sydney
  previousCompletedAt: null,
  timezone: SYDNEY,
};

describe('computeDueAt', () => {
  it('wedding_relative "2 weeks before" lands on the local morning of 2026-10-31', () => {
    const timing: StepTiming = {
      mode: 'wedding_relative',
      direction: 'before',
      amount: 2,
      unit: 'weeks',
    };
    // 2026-10-31 00:00 Sydney is 2026-10-30T13:00Z (AEDT, UTC+11).
    expect(computeDueAt(timing, anchors)).toBe('2026-10-30T13:00:00.000Z');
  });

  it('wedding_relative "3 days after" lands on 2026-11-17 local', () => {
    const timing: StepTiming = {
      mode: 'wedding_relative',
      direction: 'after',
      amount: 3,
      unit: 'days',
    };
    expect(computeDueAt(timing, anchors)).toBe('2026-11-16T13:00:00.000Z');
  });

  it('wedding_relative months step whole calendar months, not 30-day blocks', () => {
    const timing: StepTiming = {
      mode: 'wedding_relative',
      direction: 'before',
      amount: 1,
      unit: 'months',
    };
    // 2026-10-14 00:00 Sydney, not "wedding minus 30 days".
    expect(computeDueAt(timing, anchors)).toBe('2026-10-13T13:00:00.000Z');
  });

  it('wedding_relative returns null when the couple has no wedding date', () => {
    const timing: StepTiming = {
      mode: 'wedding_relative',
      direction: 'before',
      amount: 2,
      unit: 'weeks',
    };
    expect(computeDueAt(timing, { ...anchors, weddingDate: null })).toBeNull();
  });

  it('apply_relative counts from the apply date in local time', () => {
    const timing: StepTiming = { mode: 'apply_relative', amount: 3, unit: 'days' };
    // Applied 2026-09-04 13:00 Sydney, so +3 days is 2026-09-07 00:00
    // Sydney = 2026-09-06T14:00Z (AEST, UTC+10).
    expect(computeDueAt(timing, anchors)).toBe('2026-09-06T14:00:00.000Z');
  });

  it('apply_relative with amount 0 is due the day it was applied', () => {
    const timing: StepTiming = { mode: 'apply_relative', amount: 0, unit: 'days' };
    expect(computeDueAt(timing, anchors)).toBe('2026-09-03T14:00:00.000Z');
  });

  it('after_previous returns null until the predecessor completes', () => {
    const timing: StepTiming = { mode: 'after_previous', delayAmount: 2, unit: 'days' };
    expect(computeDueAt(timing, anchors)).toBeNull();
  });

  it('after_previous with a completed predecessor adds the delay to the completion instant', () => {
    const timing: StepTiming = { mode: 'after_previous', delayAmount: 2, unit: 'days' };
    const due = computeDueAt(timing, {
      ...anchors,
      previousCompletedAt: '2026-09-10T05:30:00Z',
    });
    expect(due).toBe('2026-09-12T05:30:00.000Z');
  });

  it('after_previous in hours adds hours to the completion instant', () => {
    const timing: StepTiming = { mode: 'after_previous', delayAmount: 6, unit: 'hours' };
    const due = computeDueAt(timing, {
      ...anchors,
      previousCompletedAt: '2026-09-10T05:30:00Z',
    });
    expect(due).toBe('2026-09-10T11:30:00.000Z');
  });

  it('after_previous with zero delay is due the instant the predecessor completes', () => {
    const timing: StepTiming = { mode: 'after_previous', delayAmount: 0, unit: 'days' };
    const due = computeDueAt(timing, {
      ...anchors,
      previousCompletedAt: '2026-09-10T05:30:00Z',
    });
    expect(due).toBe('2026-09-10T05:30:00.000Z');
  });

  it('crosses the Sydney DST boundary without drifting an hour', () => {
    // Sydney enters AEDT on 2026-10-04. A step 1 week before a
    // 2026-10-08 wedding must still land at local midnight, not 23:00.
    const timing: StepTiming = {
      mode: 'wedding_relative',
      direction: 'before',
      amount: 1,
      unit: 'weeks',
    };
    const due = computeDueAt(timing, {
      ...anchors,
      weddingDate: '2026-10-08',
    });
    // 2026-10-01 00:00 Sydney is still AEST (UTC+10).
    expect(due).toBe('2026-09-30T14:00:00.000Z');
  });
});

describe('recomputeDueDates', () => {
  function step(over: Partial<WorkflowStepRow>): WorkflowStepRow {
    return {
      id: 's1',
      instance_id: 'i1',
      template_step_id: null,
      position: 0,
      type: 'todo',
      config: {},
      title: 'step',
      description: null,
      timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
      due_at: null,
      parent_step_id: null,
      branch_path: null,
      status: 'pending',
      requires_approval: false,
      approval_token: null,
      approval_expires_at: null,
      completed_at: null,
      error_message: null,
      output: null,
      created_at: '2026-09-04T00:00:00Z',
      updated_at: '2026-09-04T00:00:00Z',
      ...over,
    } as WorkflowStepRow;
  }

  it('threads each step completion into the next after_previous step', () => {
    const steps = [
      step({
        id: 'a',
        position: 0,
        status: 'done',
        completed_at: '2026-09-10T05:00:00Z',
      }),
      step({
        id: 'b',
        position: 1,
        timing: { mode: 'after_previous', delayAmount: 1, unit: 'days' },
      }),
      step({
        id: 'c',
        position: 2,
        timing: { mode: 'after_previous', delayAmount: 1, unit: 'days' },
      }),
    ];
    const out = recomputeDueDates(steps, {
      weddingDate: '2026-11-14',
      appliedAt: '2026-09-04T03:00:00Z',
      timezone: SYDNEY,
    });
    expect(out.find((r) => r.id === 'b')!.due_at).toBe('2026-09-11T05:00:00.000Z');
    // c's predecessor b has not completed, so c is not schedulable yet.
    expect(out.find((r) => r.id === 'c')!.due_at).toBeNull();
  });

  it('a wedding_relative step is scheduled even when its predecessor is pending', () => {
    // Anchored steps do not gate on anything: this is what lets "2 weeks
    // before the wedding" show up in the queue while earlier to-dos are
    // still open.
    const steps = [
      step({ id: 'a', position: 0, status: 'pending' }),
      step({
        id: 'b',
        position: 1,
        timing: { mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'weeks' },
      }),
    ];
    const out = recomputeDueDates(steps, {
      weddingDate: '2026-11-14',
      appliedAt: '2026-09-04T03:00:00Z',
      timezone: SYDNEY,
    });
    expect(out.find((r) => r.id === 'b')!.due_at).toBe('2026-10-30T13:00:00.000Z');
  });

  it('skipped steps still count as completed for gating purposes', () => {
    // Skipping a to-do must not strand every automated step below it.
    const steps = [
      step({
        id: 'a',
        position: 0,
        status: 'skipped',
        completed_at: '2026-09-10T05:00:00Z',
      }),
      step({
        id: 'b',
        position: 1,
        timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
      }),
    ];
    const out = recomputeDueDates(steps, {
      weddingDate: null,
      appliedAt: '2026-09-04T03:00:00Z',
      timezone: SYDNEY,
    });
    expect(out.find((r) => r.id === 'b')!.due_at).toBe('2026-09-10T05:00:00.000Z');
  });

  it('gates within a branch on the branch parent, not the flat list', () => {
    const steps = [
      step({ id: 'br', position: 0, type: 'branch', status: 'done', completed_at: '2026-09-10T05:00:00Z' }),
      step({
        id: 'yes1',
        position: 0,
        parent_step_id: 'br',
        branch_path: 'yes',
        timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
      }),
      step({
        id: 'no1',
        position: 0,
        parent_step_id: 'br',
        branch_path: 'no',
        timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
      }),
    ];
    const out = recomputeDueDates(steps, {
      weddingDate: null,
      appliedAt: '2026-09-04T03:00:00Z',
      timezone: SYDNEY,
    });
    // Both first-in-branch children anchor to the branch step itself.
    expect(out.find((r) => r.id === 'yes1')!.due_at).toBe('2026-09-10T05:00:00.000Z');
    expect(out.find((r) => r.id === 'no1')!.due_at).toBe('2026-09-10T05:00:00.000Z');
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `npm run test:unit -- tests/unit/lib/workflows/timing.test.ts`
Expected: FAIL, cannot resolve `@/lib/workflows/timing`.

- [ ] **Step 4: Implement `lib/workflows/timing.ts`**

Write the module to satisfy the tests above. The rules it encodes:

1. `wedding_relative` resolves to **local midnight** on the shifted wedding date, converted to UTC through `zonedTimeToUtc`. Returns `null` when `weddingDate` is null. `months` steps whole calendar months (use the timezone helper's date-parts arithmetic, never a 30-day multiply).
2. `apply_relative` resolves to **local midnight** on the applied date shifted by `amount` units.
3. `after_previous` adds the delay to the predecessor's `completed_at` **instant** (not local midnight: the point is "N days after that happened"). Returns `null` when there is no `previousCompletedAt`.
4. `recomputeDueDates` walks steps in `(parent_step_id, branch_path, position)` order. For each step it determines the predecessor: the previous sibling in the same branch, or, for the first step in a branch, the branch step itself. `done` and `skipped` both count as completed. Only `after_previous` steps consult the predecessor; the other two modes are computed independently, which is what lets an anchored step appear in the queue while earlier to-dos are open.
5. All returned instants are ISO strings with milliseconds (`toISOString()`).

Keep the module under 150 lines. If it grows past that, the calendar-month arithmetic belongs in `lib/scheduling/timezone`, not here.

- [ ] **Step 5: Run the test until green**

Run: `npm run test:unit -- tests/unit/lib/workflows/timing.test.ts`
Expected: PASS, all fifteen cases.

If a case fails by exactly one hour, the bug is real and is in the timezone composition, not the fixture. Fix the app, never the test.

- [ ] **Step 6: Checkpoint**

Run: `npm run typecheck && npm run typecheck:strict && npm run lint:gate`
Do not commit.

---

## Task 4: Snapshotting a template into an instance

**Files:**
- Create: `lib/workflows/instantiate.ts`, `lib/workflows/audit.ts`
- Test: `tests/integration/workflows/instantiate.test.ts`

**Interfaces:**
- Consumes: Task 1 tables, `computeDueAt` / `recomputeDueDates` from Task 3, `WorkflowTemplateStepRow` from Task 2.
- Produces:
  - `applyTemplate(supabase, opts: ApplyTemplateOptions): Promise<{ instanceId: string } | { error: string }>` where `ApplyTemplateOptions = { userId: string; templateId: string; coupleId: string | null; triggerEventId?: string | null; name?: string }`
  - `ensureDefaultInstance(supabase, userId: string, coupleId: string): Promise<string>`
  - `ensurePersonalInstance(supabase, userId: string): Promise<string>`
  - `lib/workflows/audit.ts`: `writeAudit(supabase, entry: AuditEntry): Promise<void>` where `AuditEntry = { userId: string; instanceId: string; stepId?: string | null; coupleId?: string | null; event: string; detail?: Record<string, unknown> }`

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/workflows/instantiate.test.ts` covering:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { applyTemplate } from '@/lib/workflows/instantiate';
import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

describe('applyTemplate', () => {
  let user: TestUser;
  let coupleId: string;
  let templateId: string;

  beforeAll(async () => {
    user = await createTestUser({}, { subscription_status: 'active', subscription_plan: 'pro' });

    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Sarah & Tom', event_date: '2026-11-14' })
      .select('id')
      .single();
    coupleId = couple!.id;

    const { data: tpl } = await user.client
      .from('workflow_templates')
      .insert({ user_id: user.id, name: 'Gold package', status: 'active', version: 3 })
      .select('id')
      .single();
    templateId = tpl!.id;

    // Two top-level steps plus a branch with one child on each path.
    // Insert as one array with UNIFORM KEYS: a supabase-js array insert
    // whose rows have differing key sets silently drops rows.
    const { error } = await user.client.from('workflow_template_steps').insert([
      { template_id: templateId, position: 0, type: 'todo', title: 'Call the venue',
        timing: { mode: 'apply_relative', amount: 3, unit: 'days' },
        parent_step_id: null, branch_path: null, config: {}, canvas_x: 0, canvas_y: 0 },
      { template_id: templateId, position: 1, type: 'action', title: 'Send welcome email',
        timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
        parent_step_id: null, branch_path: null,
        config: { actionType: 'send_email', subject: 'Hi', body: 'Hello' },
        canvas_x: 0, canvas_y: 120 },
      { template_id: templateId, position: 2, type: 'todo', title: 'Final details call',
        timing: { mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'weeks' },
        parent_step_id: null, branch_path: null, config: {}, canvas_x: 0, canvas_y: 240 },
    ]);
    expect(error).toBeNull();
  });

  afterAll(async () => { await user?.cleanup(); });

  it('creates an instance carrying the template name and version', async () => {
    const result = await applyTemplate(serviceClient, {
      userId: user.id, templateId, coupleId: coupleId,
    });
    expect('instanceId' in result).toBe(true);
    const instanceId = (result as { instanceId: string }).instanceId;

    const { data: inst } = await serviceClient
      .from('workflow_instances').select('*').eq('id', instanceId).single();
    expect(inst!.name).toBe('Gold package');
    expect(inst!.template_version).toBe(3);
    expect(inst!.status).toBe('active');
    expect(inst!.is_default).toBe(false);

    const { data: steps } = await serviceClient
      .from('workflow_steps').select('*').eq('instance_id', instanceId).order('position');
    expect(steps).toHaveLength(3);
    expect(steps!.map((s) => s.title)).toEqual([
      'Call the venue', 'Send welcome email', 'Final details call',
    ]);
    // Every snapshotted step points back at the template step it came from.
    expect(steps!.every((s) => s.template_step_id !== null)).toBe(true);
  });

  it('computes due_at at snapshot time for anchored steps and leaves gated ones null', async () => {
    const result = await applyTemplate(serviceClient, {
      userId: user.id, templateId, coupleId,
    });
    const instanceId = (result as { instanceId: string }).instanceId;
    const { data: steps } = await serviceClient
      .from('workflow_steps').select('title, due_at').eq('instance_id', instanceId).order('position');

    const byTitle = Object.fromEntries(steps!.map((s) => [s.title, s.due_at]));
    expect(byTitle['Call the venue']).not.toBeNull();       // apply_relative
    expect(byTitle['Final details call']).not.toBeNull();   // wedding_relative
    expect(byTitle['Send welcome email']).toBeNull();       // after_previous, gated
  });

  it('editing the template afterwards does not touch the live instance', async () => {
    const result = await applyTemplate(serviceClient, {
      userId: user.id, templateId, coupleId,
    });
    const instanceId = (result as { instanceId: string }).instanceId;

    await serviceClient
      .from('workflow_template_steps')
      .update({ title: 'RENAMED' })
      .eq('template_id', templateId)
      .eq('position', 0);

    const { data: steps } = await serviceClient
      .from('workflow_steps').select('title').eq('instance_id', instanceId).eq('position', 0).single();
    expect(steps!.title).toBe('Call the venue');
  });

  it('deleting a template step does not delete progress on a live instance', async () => {
    const result = await applyTemplate(serviceClient, {
      userId: user.id, templateId, coupleId,
    });
    const instanceId = (result as { instanceId: string }).instanceId;
    const { data: before } = await serviceClient
      .from('workflow_steps').select('id').eq('instance_id', instanceId);
    const countBefore = before!.length;

    // Add then remove a template step, and confirm the instance is untouched.
    const { data: extra } = await serviceClient
      .from('workflow_template_steps')
      .insert({ template_id: templateId, position: 9, type: 'todo', title: 'temp', config: {} })
      .select('id').single();
    await serviceClient.from('workflow_template_steps').delete().eq('id', extra!.id);

    const { data: after } = await serviceClient
      .from('workflow_steps').select('id').eq('instance_id', instanceId);
    expect(after).toHaveLength(countBefore);
  });

  it('refuses to apply the same template to the same couple twice unless allow_reapply', async () => {
    const first = await applyTemplate(serviceClient, {
      userId: user.id, templateId, coupleId, triggerEventId: null,
    });
    expect('instanceId' in first).toBe(true);
    // Repeat applies are blocked by default so an MC does not double-send.
    const second = await applyTemplate(serviceClient, {
      userId: user.id, templateId, coupleId, dedupe: true,
    } as never);
    expect('error' in second).toBe(true);
  });

  it('writes an instance_created audit row', async () => {
    const result = await applyTemplate(serviceClient, {
      userId: user.id, templateId, coupleId,
    });
    const instanceId = (result as { instanceId: string }).instanceId;
    const { data } = await serviceClient
      .from('workflow_audit_log').select('event').eq('instance_id', instanceId);
    expect(data!.map((r) => r.event)).toContain('instance_created');
  });
});
```

Note on the fifth case: `applyTemplate` takes an explicit `dedupe` flag rather than inferring it, because the manual picker deliberately allows a repeat apply when the MC asks for one, while the dispatcher never should. Add `dedupe?: boolean` to `ApplyTemplateOptions` and default it to `false`; the dispatcher passes `true`. Update the Interfaces block above to match when you implement.

- [ ] **Step 2: Run and confirm it fails**

Run: `npm run test:integration -- tests/integration/workflows/instantiate.test.ts`
Expected: FAIL, cannot resolve `@/lib/workflows/instantiate`.

- [ ] **Step 3: Implement `lib/workflows/audit.ts`**

A single exported `writeAudit` that inserts one row into `workflow_audit_log` using the passed client. It must never throw: an audit write failing should not abort a step execution. Wrap the insert and log to `console.error` on failure, then return.

- [ ] **Step 4: Implement `lib/workflows/instantiate.ts`**

`applyTemplate` does, in order:

1. Load the template. If it is missing or `status = 'archived'`, return `{ error }`.
2. When `dedupe` is true and `allow_reapply` is false, check for an existing non-cancelled instance with the same `(template_id, couple_id)` and return `{ error: 'already applied' }` if one exists.
3. Load the couple's `event_date` (null for a personal instance) and the user's timezone from `user_public_settings`, defaulting to `Australia/Sydney` to match the Scheduler's default.
4. Insert the instance row: `name` from the template, `template_version` from `template.version`, `applied_at = now()`.
5. Load the template's steps ordered by `(parent_step_id nulls first, branch_path, position)`, skipping `disabled` ones.
6. Build the snapshot rows. **Every row object must have the identical key set**, because a supabase-js array insert with ragged keys silently drops rows. Insert them, then assert `error` is null and the returned row count equals the input count. Insert parents before children so `parent_step_id` can be remapped from template step ids to the new instance step ids.
7. Run `recomputeDueDates` over the inserted steps and write back the `due_at` values.
8. `writeAudit({ event: 'instance_created', detail: { templateId, stepCount } })`.

`ensureDefaultInstance` and `ensurePersonalInstance` are thin upserts against the partial unique indexes: insert with `is_default` / `is_personal` true and `on conflict do nothing`, then select and return the id.

- [ ] **Step 5: Run until green**

Run: `npm run test:integration -- tests/integration/workflows/instantiate.test.ts`
Expected: PASS, six cases.

- [ ] **Step 6: Checkpoint.** Typecheck, strict, lint gate. Do not commit.

---

## Task 5: Apply-rule DB triggers, default instances, wedding-date recompute

**Files:**
- Create: `supabase/migrations/20260905000100_workflow_apply_rule_triggers.sql`, `supabase/migrations/20260905000200_workflow_helper_rpcs.sql`
- Test: `tests/integration/workflows/apply-triggers.test.ts`

**Interfaces:**
- Consumes: Task 1 tables, the existing `emit_automation_event()` RPC.
- Produces: bus event types `couple_created` and `package_applied`; DB trigger `couples_create_default_workflow`; DB trigger `events_recompute_workflow_due_dates`; RPC `public.ensure_default_workflow(p_couple_id uuid) returns uuid`.

- [ ] **Step 1: Check which of these events the bus already emits**

Run: `grep -rn "couple_created\|couple_stage_changed\|package_applied" supabase/migrations | head -20`

`couple_stage_changed` already exists. `couple_created` may exist under a different slug (check `new_enquiry`, which fires on couple INSERT). `package_applied` definitely does not. **Do not add a duplicate emit for an event that already exists** with a different name: if couple INSERT already emits `new_enquiry`, make `on_couple_created` match that slug in `lib/workflows/apply-rules.ts` and update the Task 2 test accordingly, rather than emitting a second event for the same row change.

- [ ] **Step 2: Write the failing integration test**

Create `tests/integration/workflows/apply-triggers.test.ts` asserting:

1. Inserting a couple creates exactly one `workflow_instances` row with `is_default = true`, `couple_id` set, `template_id` null, and `name = 'General'`.
2. Inserting a couple emits one bus event whose `event_type` matches whatever Step 1 established for couple creation.
3. Updating `couples.selected_package_id` from null to a package emits a `package_applied` event with `payload->>'package_id'` equal to that package.
4. Updating `selected_package_id` from one package to a different one emits again.
5. Updating `selected_package_id` to the same value does **not** emit (no-op updates must not re-fire).
6. Setting `selected_package_id` back to null does not emit.
7. Changing a couple's `event_date` recomputes `due_at` on every `wedding_relative` step of that couple's active instances, and leaves `apply_relative` and `after_previous` steps untouched.
8. `ensure_default_workflow(couple_id)` is idempotent: calling it twice returns the same id and creates no second row.

- [ ] **Step 3: Write `20260905000100_workflow_apply_rule_triggers.sql`**

Three triggers, each following the existing pattern in `20260604000100_create_automation_db_triggers.sql` (read it first and match its style exactly):

```sql
-- Workflows: apply-rule emitters + the default-instance invariant.
--
-- Three triggers:
--
--  1. couples INSERT  -> create the couple's default ("General") applied
--     workflow. Doing this in the same transaction as the couple insert
--     is what makes "every couple has at least one applied workflow" a
--     real invariant rather than a lazy-creation race between the
--     Workflow tab and an ad-hoc step insert.
--
--  2. couples UPDATE OF selected_package_id -> emit `package_applied`.
--     That single column is written both by the MC on the couple profile
--     and by the couple in the portal, so one trigger covers both paths.
--     Invoice created / sent / paid are deliberately NOT the anchor: an
--     invoice is a billing artefact and can lag or never exist.
--
--  3. events UPDATE OF date -> recompute due_at on every
--     wedding_relative step of that couple's active instances, so a
--     moved wedding reshuffles the checklist (the 17hats base-date
--     behaviour).
```

For trigger 2, guard on `new.selected_package_id is not null and new.selected_package_id is distinct from old.selected_package_id`. `is distinct from` is what makes a no-op update not re-fire and is why cases 5 and 6 pass.

For trigger 3, recompute in SQL: for each active instance of the couple, update every `workflow_steps` row whose `timing->>'mode' = 'wedding_relative'` to the shifted date at local midnight. Read the user's timezone from `user_public_settings` with the same `Australia/Sydney` default the application uses; a hard-coded UTC here would reintroduce the exact off-by-one-day bug class the Scheduler build spent six fixes on.

- [ ] **Step 4: Write `20260905000200_workflow_helper_rpcs.sql`**

`ensure_default_workflow(p_couple_id uuid) returns uuid`, `security invoker`, `set search_path = public`. It inserts the default instance if absent and returns its id. `security invoker` (not definer) is correct here: the caller's RLS should apply, so a user cannot conjure an instance on another tenant's couple. Add `on conflict do nothing` against `workflow_instances_one_default_per_couple_idx`, then select and return.

- [ ] **Step 5: Reset, run the test until green**

```bash
supabase db reset
npm run test:integration -- tests/integration/workflows/apply-triggers.test.ts
```
Expected: PASS, eight cases.

- [ ] **Step 6: Run the migration gate**

Run: `bash scripts/check-migrations.sh`
Expected: PASS.

- [ ] **Step 7: Checkpoint.** Do not commit.

---

## Task 6: The dispatcher

**Files:**
- Create: `lib/workflows/dispatcher.ts`
- Test: `tests/integration/workflows/dispatcher.test.ts`

**Interfaces:**
- Consumes: `applyTemplate` (Task 4), `getApplyRuleSpec` (Task 2), the `automation_events` bus.
- Produces: `dispatchPendingEvents(supabase, limit?: number): Promise<DispatchResult>` where `DispatchResult = { processedEvents: number; matchedTemplates: number; openedInstances: number }`.

This is a near-copy of `lib/automations/dispatcher.ts` with two differences: it matches **apply rules** instead of triggers, and it opens **instances** instead of runs. Read that file first and keep its structure, its error handling and its `markProcessed` behaviour (an event that throws is still marked processed with an `error_message`, so the partial index stays small).

**One thing must change from the old dispatcher.** It marks an event processed after matching. During Phases A to E both engines tick against the same bus, so whichever runs first would consume the event and starve the other. Until Phase E's cutover, the workflow dispatcher must **not** write `processed_at`. Instead track its own progress in a `workflow_dispatch_cursor` column or a `workflow_dispatched_event_ids` guard. The simplest correct version, given the instance-level unique index already provides idempotency: query events by `created_at > (select max applied_at cursor)` is fragile, so add a small table.

Add to `20260905000200_workflow_helper_rpcs.sql`:

```sql
-- Dual-running guard. Until the Phase E cutover, both the automations
-- dispatcher and the workflows dispatcher read the same bus. The old one
-- owns `automation_events.processed_at`, so the new one records what it
-- has seen here instead. Dropped with the legacy tables in Phase F.
create table if not exists public.workflow_dispatched_events (
  event_id uuid primary key references public.automation_events(id) on delete cascade,
  dispatched_at timestamptz not null default now()
);
```

No RLS: it is written only by the service-role tick and read by nothing user-facing.

- [ ] **Step 1: Write the failing integration test**

`tests/integration/workflows/dispatcher.test.ts` asserting:

1. An active template with `apply_rule_type = 'on_couple_created'` gets an instance when a couple is inserted.
2. A **draft** template with the same rule does not.
3. An **archived** template does not.
4. Two active templates matching the same event both get instances.
5. A template with `on_stage_changed` and `{"toStatus":"Booked"}` fires only for that destination status.
6. Running the dispatcher twice over the same event opens exactly one instance (the `workflow_instances_unique_per_event_idx` idempotency).
7. Events belonging to user A never match user B's templates.
8. An event whose apply-rule config fails Zod parse is skipped without throwing, and the dispatcher still processes later events in the batch.
9. The dispatcher does not write `automation_events.processed_at` (the automations dispatcher still owns that during dual-run).

- [ ] **Step 2: Run and confirm it fails.** Expected: cannot resolve the module.

- [ ] **Step 3: Implement.** Mirror `lib/automations/dispatcher.ts`. `loadCandidateTemplates` selects from `workflow_templates` where `user_id`, `status = 'active'`, and `apply_rule_type` is any rule that could match this event type. Because `on_event` can match any bus event type, load candidates by `user_id + status` and filter in memory rather than by an equality on `apply_rule_type`; the partial index still keeps the read small at this data volume. Pass `dedupe: true` and the `triggerEventId` to `applyTemplate`.

- [ ] **Step 4: Run until green.** Nine cases.

- [ ] **Step 5: Checkpoint.** Do not commit.

---

## Task 7: The executor

**Files:**
- Create: `lib/workflows/executor.ts`
- Test: `tests/integration/workflows/executor.test.ts`, `tests/unit/lib/workflows/executor-gating.test.ts`

**Interfaces:**
- Consumes: `getActionSpec` from `lib/automations/actions`, `evaluateBranch` / `computeWaitWakeAt` / `evaluateWaitAction` from `lib/automations/conditions`, `buildRunContext` from `lib/automations/context`, `applyQuietHours` behaviour from `lib/automations/runner.ts`, `recomputeDueDates` from Task 3, `writeAudit` from Task 4.
- Produces:
  - `advanceDueSteps(supabase): Promise<ExecutorResult>` where `ExecutorResult = { stepsExecuted: number; instancesCompleted: number; errors: number }`
  - `completeStep(supabase, stepId: string, opts?: { skipped?: boolean }): Promise<void>` — the path the couple-profile checkbox calls, which is what makes ticking a to-do release the steps gated behind it.

This replaces `lib/automations/runner.ts`. Read that file end to end before starting; the quiet-hours handling, the per-tick action budget (`ACTION_BUDGET_PER_TICK = 200`), the audit writes and the error containment all carry over as-is.

The structural difference: the old runner tracked one `current_action_id` per run and walked forward. The executor instead **queries for due steps** across all active instances:

```sql
select * from workflow_steps
where status in ('pending', 'waiting')
  and due_at is not null and due_at <= now()
  and type in ('action', 'wait', 'branch')
order by due_at asc
limit 200
```

`todo` and `appointment` steps are excluded: they are for the MC to tick and simply sit there being overdue. That exclusion is the whole reason manual and automated steps can coexist in one list.

- [ ] **Step 1: Write the failing gating unit test**

`tests/unit/lib/workflows/executor-gating.test.ts` is a pure test over the helper that decides what is executable. Extract that decision into an exported pure function `isExecutable(step: WorkflowStepRow, now: Date): boolean` and cover: a pending action with a past `due_at` is executable; with a future `due_at` is not; with a null `due_at` is not; a `todo` with a past `due_at` is not; a `done` action is not; an `errored` action is not; a `waiting` action past its `due_at` is; an action with `requires_approval` and no approval recorded is not.

- [ ] **Step 2: Write the failing integration test**

`tests/integration/workflows/executor.test.ts` asserting:

1. A due `action` step whose `config.actionType` is a registered action runs its real handler and moves to `done`, with `output` populated.
2. A failing handler moves the step to `errored` with `error_message` set, and the instance stays `active` so the MC can retry. One failing step does not stop the other steps in the batch.
3. A `wait` step moves to `waiting` with `due_at` set to the computed wake time, then to `done` on a later tick.
4. A `branch` step evaluates its predicate, marks the losing path's children `skipped`, and leaves the winning path `pending`. An audit row records `branch_taken` with the chosen path.
5. Ticking `completeStep` on a manual `todo` sets `done` and `completed_at`, **and** recomputes `due_at` on the following `after_previous` step so it becomes executable. This is the gating behaviour and it is the single most important assertion in the file.
6. `completeStep(..., { skipped: true })` also releases the next step (a skipped predecessor must not strand the rest of the workflow).
7. When the last non-skipped step reaches a terminal status the instance moves to `completed` with `completed_at` set, and an `instance_completed` audit row is written.
8. A step falling inside the template's quiet hours is deferred rather than executed, with its `due_at` pushed to the end of the window.
9. An `action` step with `requires_approval` moves to `waiting`, gets an `approval_token`, and does not execute until approval is recorded.
10. Cross-tenant safety: the executor invoked with a service-role client still scopes every read and write by the instance's `user_id`, and a step in user A's instance never executes with user B's context.

- [ ] **Step 3: Run both and confirm they fail.**

- [ ] **Step 4: Implement `lib/workflows/executor.ts`**

The per-step flow:

1. Load the step, its instance, and build a `RunContext` via `buildRunContext`, populating `instanceId`, `stepId`, and the legacy `automationId` / `runId` aliases (template id or instance id, and instance id).
2. Dispatch by step type: `action` looks up `config.actionType` in `getActionSpec` and parses the rest of `config` through that spec's `configSchema`; `wait` uses `computeWaitWakeAt`; `branch` uses `evaluateBranch`.
3. Apply quiet hours before executing a messaging action, exactly as `applyQuietHours` does in the old runner.
4. Write the result: status, `completed_at`, `output`, merge `output` into `instance.context` keyed by step id.
5. `writeAudit` the transition.
6. Recompute `due_at` for the instance's remaining steps via `recomputeDueDates`.
7. If no step remains in a non-terminal status, complete the instance.

Keep the module focused. If it exceeds roughly 250 lines (the old runner is 547 and is harder to reason about than it should be), split the per-type handling into `lib/workflows/execute-step.ts` and leave `executor.ts` as the batch loop.

- [ ] **Step 5: Run until green.** Ten integration cases, eight unit cases.

- [ ] **Step 6: Checkpoint.** Do not commit.

---

## Task 8: Overdue emitter and tick wiring

**Files:**
- Create: `lib/workflows/emitters/step-overdue.ts`
- Modify: `app/api/cron/automations-tick/route.ts`, `lib/automations/time-emitters/index.ts`
- Test: `tests/integration/workflows/step-overdue-emitter.test.ts`, `tests/integration/workflows/tick.test.ts`

**Interfaces:**
- Consumes: `dispatchPendingEvents` (Task 6), `advanceDueSteps` (Task 7), the existing time-emitter registry shape.
- Produces: bus event type `step_overdue`; the tick route now runs both engines.

- [ ] **Step 1: Read the emitter being replaced**

Run: `cat lib/automations/time-emitters/task-overdue.ts`
Copy its idempotency approach exactly: dedupe by the calendar day the event fires for, by checking `automation_events` for an existing row with the same `(source_id, event_type, day)`. Without that guard the emitter re-fires every minute.

- [ ] **Step 2: Write the failing emitter test**

`tests/integration/workflows/step-overdue-emitter.test.ts` asserting: a `todo` step whose `due_at` is in the past and whose status is `pending` emits exactly one `step_overdue` event; running the emitter again the same day emits nothing more; a `done` step emits nothing; a step in a `cancelled` instance emits nothing; the payload carries `step_id`, `instance_id`, `couple_id` and `days_overdue`.

- [ ] **Step 3: Implement the emitter** following the registry shape in `lib/automations/time-emitters/index.ts`, and register it there alongside the existing emitters.

- [ ] **Step 4: Wire the tick**

In `app/api/cron/automations-tick/route.ts`, after the existing automations passes, add the workflow passes in this order: workflow dispatcher, then time emitters (already shared), then the workflow executor. Keep `isCronAuthorized(request)` from `@/lib/api/cron-auth` as the only auth. Wrap each pass so one throwing does not skip the others, and `sendAlert()` on failure, matching how the existing tick reports.

The route keeps its path for now. Renaming it to `/api/cron/workflows-tick` would need a matching `vercel.json` change and a deploy window; do that in Phase E, not here.

- [ ] **Step 5: Write the tick integration test**

`tests/integration/workflows/tick.test.ts` proves the whole loop end to end with no UI: insert a couple, an active template with an `on_couple_created` rule whose first step is a to-do and second is an automated email anchored `after_previous`, run the tick, assert an instance exists with the to-do pending and the email not yet due; call `completeStep` on the to-do; run the tick again; assert the email step is `done`.

- [ ] **Step 6: Run the full Phase A suite**

```bash
npm run test:unit -- tests/unit/lib/workflows/
npm run test:integration -- tests/integration/workflows/ tests/integration/rls/workflows.test.ts
npm run typecheck && npm run typecheck:strict && npm run lint:gate
```
Expected: all green, base typecheck at 0.

- [ ] **Step 7: Ratchet the gates**

If `typecheck:strict` or `lint:gate` came in under budget, lower the numbers in `scripts/typecheck-strict-gate.mjs` and `scripts/lint-gate.mjs` to lock the gain in. Only ever decrease them.

- [ ] **Step 8: Phase A checkpoint**

Report: the engine runs end to end with no UI. Do not commit.

---

# Phase B: Template builder UI and tags

The builder **keeps the React Flow canvas**: free node placement, zoom, connector lines. A flow-list variant of this builder was built and reverted once already. The vertical checklist introduced in Phase C is how an applied instance renders, not how a template is authored.

## Task 9: Tags

**Files:**
- Create: `app/(dashboard)/workflows/tag-editor-modal.tsx`, `app/(dashboard)/workflows/use-workflow-tags.ts`
- Create: `app/(dashboard)/workflows/actions.ts` (tag actions only in this task)
- Test: `tests/unit/app/workflows/tag-editor-modal.test.tsx`, `tests/integration/workflows/tag-actions.test.ts`

**Interfaces:**
- Produces: server actions `createWorkflowTag(name: string, color: string)`, `updateWorkflowTag(id: string, patch: { name?: string; color?: string; position?: number })`, `deleteWorkflowTag(id: string)`, `setTemplateTags(templateId: string, tagIds: string[])`; hook `useWorkflowTags(): { tags: WorkflowTagRow[]; isLoading: boolean; error: Error | null }`.

- [ ] **Step 1: Read the pattern being followed**

Run: `cat app/\(dashboard\)/couples/statuses-editor.tsx app/\(dashboard\)/couples/use-couple-statuses.ts`

Couple statuses are the same shape of feature: a user-defined lookup list with a name, a colour and a position, edited in a modal. Match its structure, its colour palette and its drag-reorder behaviour rather than inventing a second pattern.

- [ ] **Step 2: Write the failing component test**

`tests/unit/app/workflows/tag-editor-modal.test.tsx` using React Testing Library and semantic selectors (`getByRole` before `getByLabelText` before `getByText`; `data-testid` only as a last resort). Cover: the modal lists existing tags; adding a tag calls `createWorkflowTag` with the typed name and chosen colour; the save control shows a loading state without changing width (`<Button loading>` overlays the spinner, never `{saving ? 'Saving…' : 'Save'}`); an empty name disables save; deleting asks for confirmation.

- [ ] **Step 3: Write the integration test** for the four server actions, including a cross-tenant case: user B calling `setTemplateTags` with user A's template id must fail.

- [ ] **Step 4: Implement.**

`actions.ts` is a `'use server'` file, so it exports **functions only**. Put the Zod schemas in a sibling plain module (`app/(dashboard)/workflows/action-schemas.ts`) and import them. A schema exported from a `'use server'` file crashes at runtime, not at build time.

Every action validates with `@/lib/api/validate` and re-checks ownership; RLS is the backstop, not the only check.

- [ ] **Step 5: Run tests, then `npm run check:server-action-exports`.** Expected: PASS.

- [ ] **Step 6: Checkpoint.** Do not commit.

---

## Task 10: Move the builder to `/workflows/[id]`

This task is a **mechanical move plus a re-point**. It changes no behaviour. Do it in one pass so the tree is never half-moved, and run the typechecker as the correctness oracle.

**Files:** use `git mv` for every row in this map.

| From `app/(dashboard)/automations/[id]/` | To `app/(dashboard)/workflows/[id]/` |
|---|---|
| `page.tsx` | `page.tsx` |
| `flow-node.tsx` | `flow-node.tsx` |
| `auto-layout.ts` | `auto-layout.ts` |
| `canvas-header.tsx` | `canvas-header.tsx` |
| `command-palette.tsx` | `command-palette.tsx` |
| `action-picker.tsx` | `step-picker.tsx` |
| `action-chips.tsx` | `step-chips.tsx` |
| `wait-chips.tsx` | `wait-chips.tsx` |
| `branch-chips.tsx` | `branch-chips.tsx` |
| `trigger-picker.tsx` | `apply-rule-picker.tsx` |
| `trigger-card-body.tsx` | `apply-rule-card-body.tsx` |
| `trigger-filter-list.tsx` | `filter-list.tsx` |
| `filter-controls.tsx`, `filter-options.ts` | same names |
| `event-row-filters.tsx`, `event-date-filters.tsx`, `invoice-filters.tsx`, `portal-filters.tsx`, `task-filters.tsx` | same names, except `task-filters.tsx` becomes `step-filters.tsx` |
| `email-composer-modal.tsx`, `email-preview.tsx` | same names |
| `document-composer-modal.tsx`, `questionnaire-composer-modal.tsx`, `timeline-composer-modal.tsx`, `run-sheet-composer-modal.tsx` | same names |
| `task-composer-modal.tsx` | `todo-composer-modal.tsx` |
| `inspector-panel.tsx` | split, see Step 3 |
| `inspector-extended.tsx` | split, see Step 3 |
| `runs-panel.tsx` | `instances-panel.tsx` |
| `step-summary.ts` | `step-summary.ts` |
| `lucide-lookup.ts` | `lucide-lookup.ts` |
| `ai-copilot-bar.tsx`, `copilot-conversation.tsx`, `use-copilot-chat.ts` | same names |

Also move `lib/automations/ai-copilot/` to `lib/workflows/ai-copilot/` and `app/api/ai/automation-copilot/` to `app/api/ai/workflow-copilot/`.

**Interfaces:**
- Consumes: everything from Phase A.
- Produces: a working builder at `/workflows/[id]` writing to `workflow_templates` and `workflow_template_steps`.

- [ ] **Step 1: Move the files**

```bash
mkdir -p "app/(dashboard)/workflows/[id]"
git mv "app/(dashboard)/automations/[id]/page.tsx" "app/(dashboard)/workflows/[id]/page.tsx"
# ...one git mv per row in the map above
git mv lib/automations/ai-copilot lib/workflows/ai-copilot
git mv app/api/ai/automation-copilot app/api/ai/workflow-copilot
```

- [ ] **Step 2: Re-point every import and table reference**

Run: `npm run typecheck` and fix every error it reports. Then sweep for the string references the typechecker cannot see:

```bash
grep -rn "'automations'\|'automation_actions'\|'automation_runs'\|'automation_waits'" "app/(dashboard)/workflows" lib/workflows
grep -rn "/automations" "app/(dashboard)/workflows" lib/workflows
```

Table mapping: `automations` to `workflow_templates`; `automation_actions` to `workflow_template_steps`; `automation_runs` to `workflow_instances`; `automation_waits` folds away (wake times live on `workflow_steps.due_at`, approvals on `workflow_steps.approval_token`). Column mapping: `automation_id` to `template_id`; `parent_action_id` to `parent_step_id`; `label` to `title`; the action's `type` moves into `config.actionType` with the step's own `type` becoming `'action'`.

- [ ] **Step 3: Split the two oversized inspectors**

`inspector-panel.tsx` (1594 lines) and `inspector-extended.tsx` (1121 lines) are ten times the ~150-line rule and are being edited anyway. Split by step type, one file each, all under `app/(dashboard)/workflows/[id]/inspector/`:

- `inspector/index.tsx` — the shell: header, close, the switch on step type. Under 100 lines.
- `inspector/todo-inspector.tsx` — title, description, timing.
- `inspector/action-inspector.tsx` — the action picker plus the chips and composer launch for the chosen action.
- `inspector/wait-inspector.tsx` — wraps `wait-chips.tsx`.
- `inspector/branch-inspector.tsx` — the predicate builder. This is the one piece that keeps the old form rather than chips, deliberately: a predicate builder is real design work and a mechanical chip conversion would make it worse.
- `inspector/appointment-inspector.tsx` — date, duration, notes.
- `inspector/timing-control.tsx` — the shared per-step timing control used by all of the above. One control, three modes, matching the chip pattern.

- [ ] **Step 4: Add the timing control**

This is the only genuinely new builder UI in Phase B. It is a chip whose popover switches between the three modes from `StepTiming`. Follow `wait-chips.tsx` exactly, including its two hard constraints: **nothing inside a chip popover may portal** (which rules out the design-system `Select`; use the in-popover pattern `wait-chips.tsx` already uses), and **chip seed values must parse against the runtime Zod schema**, here the `StepTiming` schema. A seed that fails parse is a silently dead step, the same failure mode `action-chips.test.ts` was written to catch.

Write `tests/unit/app/workflows/timing-control.test.tsx` covering: each of the three modes renders its own fields; switching mode seeds a config that parses; the summary text reads naturally ("2 weeks before the wedding", "3 days after applying", "right after the previous step").

- [ ] **Step 5: Re-point the AI copilot**

In `lib/workflows/ai-copilot/tool-schemas.ts` and `tool-executors.ts`, rename the tools from automation vocabulary to workflow vocabulary (`add_action` to `add_step`, `set_trigger` to `set_apply_rule`) and re-point their writes at the new tables. Update `system-prompt.ts` so it describes workflows, step types and apply rules rather than automations, actions and triggers. The streaming plumbing in `stream.ts` and `llm-client.ts` needs no change beyond the moved import paths.

When the prompt or a tool description mentions a model, check `claude-api` for current model ids rather than carrying an old one forward.

- [ ] **Step 6: Update the copilot tests**

Run: `grep -rln "copilot" tests/` and re-point each file. Keep the assertions; only the vocabulary changes.

- [ ] **Step 7: Verify no behaviour changed**

```bash
npm run typecheck && npm run typecheck:strict && npm run lint:gate
npm run test:unit
```
Expected: green. The old `/automations` route still exists at this point and is untouched; it is deleted in Phase E.

- [ ] **Step 8: Checkpoint.** Do not commit.

---

## Task 11: The template library page

**Files:**
- Create: `app/(dashboard)/workflows/page.tsx`, `workflows-templates.tsx`, `template-card.tsx`, `template-tag-filter.tsx`, `use-workflow-templates.ts`
- Modify: `app/(dashboard)/workflows/actions.ts` (add template actions)
- Test: `tests/unit/app/workflows/workflows-templates.test.tsx`, `tests/integration/workflows/template-actions.test.ts`

**Interfaces:**
- Produces: server actions `createWorkflowTemplate(input)`, `updateWorkflowTemplate(id, patch)`, `duplicateWorkflowTemplate(id)`, `deleteWorkflowTemplate(id)`, `setTemplateStatus(id, status)`; hook `useWorkflowTemplates(filter: { tagIds?: string[]; status?: TemplateStatus })`.

- [ ] **Step 1: Read the page being replaced**

Run: `cat app/\(dashboard\)/automations/automations-home.tsx app/\(dashboard\)/automations/automations-table.tsx`

Reuse its structure. The one addition is tag chips on each row and a tag filter in the toolbar.

- [ ] **Step 2: Write the failing component test** covering explicit **loading**, **empty** and **error** states (these are Definition-of-Done items, not optional), tag filtering, and that a draft template renders visibly distinct from an active one.

- [ ] **Step 3: Implement.** `page.tsx` is an orchestrator: it reads `?tab=` (default `queue`, but the Queue tab arrives in Phase D so until then it renders Templates), fetches, and composes. No form logic, no mutations inline.

Use `components/ui/` primitives throughout: `Loading`, `Empty`, `ErrorState`, `Button`, `Input`, `Select`. No hand-written `<button>`, no `text-sm`, no `rounded-lg`.

- [ ] **Step 4: Verify on desktop and mobile**

Run the app and check at 1280px, Pixel 5 (393x851) and iPhone 12 (390x844). Use Tailwind responsive prefixes only.

- [ ] **Step 5: Run the design-system check**

Run: `npm run lint` and confirm no `zebri/no-off-token-color` warnings were added. Open `/design-system` and confirm nothing on this page is hand-rolled markup for something that already exists there. If you needed something that is not there, add the primitive to `components/ui/` with TSDoc and unit tests **and add its entry to `/design-system` in this task**, then use it.

- [ ] **Step 6: Checkpoint.** Do not commit.

---

## Task 12: Phase B end-to-end test

**Files:**
- Create: `tests/e2e/workflows-builder.spec.ts`

- [ ] **Step 1: Read the e2e conventions.** Run: `cat .claude/docs/testing.md` and an existing spec, e.g. `tests/e2e/booking.spec.ts`.

- [ ] **Step 2: Write the spec** for desktop, Pixel 5 and iPhone 12: sign in, go to `/workflows`, create a template, open the builder, add a to-do step and an automated email step on the canvas, set the email's timing to "right after the previous step", set the apply rule to "when a couple is created", activate the template, return to the library and see it listed as active with its tag.

**A logged-out visitor needs `browser.newContext()`, not `context.newPage()`.** A new page in the same context shares login cookies and will silently be authenticated, which has masked a real auth-wall bug in this codebase before.

- [ ] **Step 3: Run it.** `npx playwright test tests/e2e/workflows-builder.spec.ts`

- [ ] **Step 4: Phase B checkpoint.** Do not commit.

---

# Phase C: The couple profile Workflow tab

The couple profile currently has **two** relevant tabs: `tasks` (`couple-tasks.tsx`, 381 lines) and `automations` (nine `couple-automations*.tsx` files, an activity feed of runs). Both fold into **one** `workflow` tab: applied workflows as checklists, with the run and audit history as an activity section underneath.

## Task 13: The checklist

**Files:**
- Create: `app/(dashboard)/couples/couple-workflow.tsx`, `workflow-checklist.tsx`, `workflow-step-row.tsx`, `use-couple-workflows.ts`
- Test: `tests/unit/app/couples/workflow-checklist.test.tsx`

**Interfaces:**
- Consumes: `completeStep` from `lib/workflows/executor` (Task 7), `ensureDefaultInstance` from Task 4.
- Produces:
  - `useCoupleWorkflows(coupleId: string): { instances: WorkflowInstanceWithSteps[]; isLoading: boolean; error: Error | null; refetch: () => void }`
  - server actions `tickStep(stepId: string)`, `untickStep(stepId: string)`, `skipStep(stepId: string)`, `reorderSteps(instanceId: string, orderedIds: string[])`, `cancelInstance(instanceId: string)`

- [ ] **Step 1: Read the two components being replaced and the house style**

```bash
cat "app/(dashboard)/couples/couple-tasks.tsx"
cat "app/(dashboard)/couples/couple-overview.tsx"
cat "app/(dashboard)/couples/couple-events.tsx"
```

New couple-profile UI must mirror `couple-overview` and `couple-events`: calm, no bordered boxes inside bordered boxes, no new visual language. Verify it in the running app, not from a mockup.

- [ ] **Step 2: Write the failing component test** covering: a checklist renders its steps in position order with a "step 7 of 20" progress line; ticking a to-do calls `tickStep` optimistically; a step with a past `due_at` renders an overdue treatment; a `skipped` step renders struck through and is excluded from the progress denominator; branch children render indented under their branch step with their path labelled; an automated step that has already run shows when it ran and is not tickable; the loading, empty and error states each render.

- [ ] **Step 3: Implement.**

`couple-workflow.tsx` is the tab orchestrator: it fetches, renders one `workflow-checklist.tsx` per active instance, and composes the apply picker (Task 14) plus the activity section (Task 15). Keep it under 150 lines by pushing everything else into the child components.

The checkbox is a real `<button>` or the design-system checkbox primitive, never a raw `<input type="checkbox">`. Clickable non-button rows need `cursor-pointer`; real buttons do not, since `globals.css` covers them.

**Ticking a step must go through `completeStep`, not a bare status update.** A direct `update({ status: 'done' })` would set the status but never recompute `due_at` on the steps gated behind it, so every automated step anchored `after_previous` would sit unschedulable forever. This is the single easiest way to break the feature.

- [ ] **Step 4: Verify in the running app** on desktop and both mobile profiles.

- [ ] **Step 5: Checkpoint.** Do not commit.

---

## Task 14: Apply picker, ad-hoc steps, and folding the two tabs into one

**Files:**
- Create: `app/(dashboard)/couples/workflow-apply-picker.tsx`, `workflow-add-step.tsx`
- Modify: `app/(dashboard)/couples/couple-profile.tsx`, `couple-profile-tabs.ts`, `couple-profile-body.tsx`, `use-couple-profile-tabs.ts`
- Delete: `app/(dashboard)/couples/couple-tasks.tsx`, `couple-automations.tsx`, `couple-automations-data.ts`, `couple-automations-feed.tsx`, `couple-automations-group.tsx`, `couple-automations-header.tsx`, `couple-automations-loader.ts`, `couple-automations-run-picker.tsx`, `couple-automations-run-row.tsx`, `couple-automations-shared.ts`, `couple-automations-skeleton.tsx`
- Test: `tests/unit/app/couples/workflow-apply-picker.test.tsx`, `tests/integration/couples/workflow-actions.test.ts`

**Interfaces:**
- Produces: server actions `applyTemplateToCouple(coupleId: string, templateId: string)`, `addAdHocStep(coupleId: string, input: { title: string; dueAt?: string | null; instanceId?: string })`.

- [ ] **Step 1: Write the failing tests.**

Component: the picker lists active templates grouped by tag; picking one calls `applyTemplateToCouple`; a template already applied to this couple shows as already applied and needs a confirm to re-apply.

Integration: `addAdHocStep` with no `instanceId` lands the step on the couple's **default** instance and creates that instance if it somehow does not exist; a cross-tenant `applyTemplateToCouple` fails.

- [ ] **Step 2: Implement both components.**

`workflow-add-step.tsx` is the ad-hoc to-do entry: a single inline row with a title field and an optional date, matching the inline add already used by the couple Tasks tab. This is the home for "call the venue about parking" and it is why no standalone task concept is needed.

- [ ] **Step 3: Fold the tabs.**

In `couple-profile.tsx`'s `NAV_ITEMS`, replace the `tasks` entry and the `automations` entry with one:

```ts
  {
    key: 'workflow',
    label: 'Workflow',
    icon: <ListChecks size={18} strokeWidth={1.5} />,
  },
```

Place it where `tasks` sat (second, right after Overview). In `couple-profile-body.tsx`, replace both `activeSection === 'tasks'` and `activeSection === 'automations'` branches with a single `activeSection === 'workflow' && <CoupleWorkflow coupleId={couple.id} />`.

**Migrate saved tab configuration.** `use-couple-profile-tabs.ts` persists per-user tab order and hidden tabs by key. Users who hid or reordered `tasks` / `automations` have those strings saved. On read, map both old keys to `workflow` and de-duplicate; a stale key left in the array would render a nav gap or drop the new tab entirely.

Check where that config is stored before writing the migration:
Run: `grep -rn "hidden_tabs" app lib types | head`
If it lives in `user_metadata`, remember that field is **user-writable** and must never be read for entitlements. Tab layout is cosmetic so storing it there is fine; just do not add anything trust-bearing alongside it.

- [ ] **Step 4: Delete the eleven replaced files** and fix every resulting typecheck error.

- [ ] **Step 5: Run the suites.** `npm run test:unit && npm run typecheck`

- [ ] **Step 6: Checkpoint.** Do not commit.

---

## Task 15: Activity section and Phase C e2e

**Files:**
- Create: `app/(dashboard)/couples/workflow-activity.tsx`
- Create: `tests/e2e/couple-workflow.spec.ts`

- [ ] **Step 1: Implement the activity section.** A reverse-chronological list of `workflow_audit_log` rows for this couple, rendered with the narration helper. Reuse `lib/automations/audit-log/narrate.ts`, extending its vocabulary for the new event names rather than writing a second narrator. Collapsed by default under the checklists so the checklist stays the focus of the tab.

- [ ] **Step 2: Write the e2e spec** for desktop, Pixel 5, iPhone 12: open a couple, see the default General workflow, add an ad-hoc to-do, apply a template, tick a to-do, watch progress advance, expand activity and see the entries.

- [ ] **Step 3: Run it.** `npx playwright test tests/e2e/couple-workflow.spec.ts`

- [ ] **Step 4: Phase C checkpoint.** Do not commit.

---

# Phase D: Queue tab and dashboard widget

## Task 16: The work queue

**Files:**
- Create: `lib/workflows/queue.ts`, `app/(dashboard)/workflows/workflows-queue.tsx`, `queue-group.tsx`, `queue-row.tsx`, `queue-filters.tsx`, `use-workflow-queue.ts`
- Modify: `app/(dashboard)/workflows/page.tsx` (Queue becomes the default tab)
- Test: `tests/unit/lib/workflows/queue.test.ts`, `tests/unit/app/workflows/workflows-queue.test.tsx`, `tests/integration/workflows/queue.test.ts`

**Interfaces:**
- Produces:
  - `loadQueue(supabase, userId: string, filter: QueueFilter): Promise<QueueResult>`
  - `QueueFilter = { coupleIds?: string[]; tagIds?: string[]; types?: StepType[] }`
  - `QueueResult = { overdue: QueueItem[]; today: QueueItem[]; upcoming: QueueItem[] }`
  - `QueueItem = { step: WorkflowStepRow; instanceName: string; coupleId: string | null; coupleName: string | null; weddingDate: string | null }`

Layout, settled: three groups, **Overdue / Due today / Upcoming**, with filters for couple, tag and step type. **No bulk actions in v1** (the old task board's bulk bar does not carry over); production step volume does not justify them and it is revisitable later.

- [ ] **Step 1: Write the failing queue unit test.**

Grouping is a date-boundary calculation in the user's timezone, so **every fixture carries a non-UTC timezone**. Cover: a step due yesterday is overdue; due later today is today; due tomorrow is upcoming; a step due at 23:00 local, when "now" is 09:00 UTC the next calendar day, is still **today** in Sydney and must not be misfiled as overdue; `done` and `skipped` steps appear in no group; automated steps in `waiting` appear in no group (they are the engine's business, not the MC's); steps from a `cancelled` instance appear in no group; the personal instance's steps are included and carry a null `coupleId`.

- [ ] **Step 2: Implement `lib/workflows/queue.ts`.** One query with the filters applied server-side, then grouped in memory. Join the instance for its name and the couple for its name and wedding date. Do not fetch every step and filter client-side.

- [ ] **Step 3: Write the failing component test** covering explicit loading, empty and error states, the three groups, click-through to the couple, and ticking a to-do straight from the queue.

- [ ] **Step 4: Implement the UI.** `page.tsx` gains the two-tab shell (Queue default, Templates second) reading `?tab=`. Each of `workflows-queue.tsx`, `queue-group.tsx`, `queue-row.tsx`, `queue-filters.tsx` stays under 150 lines.

- [ ] **Step 5: Verify on desktop and both mobile profiles.** The queue is the MC's daily driver and is the surface most likely to be used on a phone. Rows must not overflow horizontally at 390px.

- [ ] **Step 6: Checkpoint.** Do not commit.

---

## Task 17: The dashboard steps widget

**Files:**
- Create: `app/(dashboard)/dashboard-steps.tsx`
- Modify: `app/(dashboard)/page.tsx`, `app/(dashboard)/use-dashboard.ts`
- Delete: `app/(dashboard)/dashboard-tasks.tsx`
- Test: `tests/unit/app/dashboard/dashboard-steps.test.tsx`

- [ ] **Step 1: Read the widget being replaced.** Run: `cat "app/(dashboard)/dashboard-tasks.tsx"` and the part of `use-dashboard.ts` that feeds it.

- [ ] **Step 2: Write the failing test** covering: the widget shows overdue steps first then today's; each row names its couple; an empty state reads as calm rather than as an error; clicking through goes to `/workflows`.

- [ ] **Step 3: Implement,** reusing `loadQueue` from Task 16 with a small limit. Do not write a second query.

- [ ] **Step 4: Delete `dashboard-tasks.tsx`** and fix the resulting typecheck errors.

- [ ] **Step 5: Run the suites and check the dashboard in the running app.**

- [ ] **Step 6: Phase D checkpoint.** Do not commit.

---

# Phase E: Cutover

## Task 18: The converter

**Files:**
- Create: `supabase/migrations/20260906000000_workflows_converter.sql`, `lib/workflows/converter.ts`
- Test: `tests/integration/workflows/converter.test.ts`

Production volumes at the 2026-08-19 audit: 55 tasks, 27 automations, 4 active, **0 in-flight runs**. Paying users own 9 tasks and 1 active automation between them. The blast radius is small, which is why a clean-schema replacement was chosen over an in-place migration. Do not let that make the converter sloppy: those 9 tasks belong to people paying for the product.

**Interfaces:**
- Produces: SQL that is the shipping path, plus `lib/workflows/converter.ts` exporting `convertLegacyData(supabase, userId: string): Promise<ConversionReport>` used by the integration test to seed and assert, and available as a re-run tool.
- `ConversionReport = { tasksConverted: number; tasksSkipped: number; automationsConverted: number; activeTemplates: number; draftTemplates: number; warnings: string[] }`

- [ ] **Step 1: Write the failing integration test**

`tests/integration/workflows/converter.test.ts`. Seed legacy rows, run the converter, assert:

**Tasks:**
1. A task with `related_couple_id` becomes a `todo` step on that couple's **default** instance.
2. Its `title`, `description` and `done` state survive; `due_date` becomes `due_at` at local midnight in the user's timezone (not UTC: a UTC conversion moves an Australian task to the previous day).
3. A task with `status = 'done'` converts with step status `done`; anything else converts as `pending`. The three built-in statuses and any user-defined custom status all collapse to that binary, which is the intended checklist simplification.
4. Custom `priority`, `task_type` and `group_id` are dropped, and each drop appends a line to `warnings` naming the task, so the report says what was lost rather than losing it silently.
5. A task with a null `related_couple_id` lands on the user's **personal** instance, which is created if absent.
6. A task whose `related_couple_id` points at a deleted couple is skipped and counted in `tasksSkipped`.
7. Converted steps get sequential `position` values, ordered by the task's existing `position` then `created_at`.

**Automations:**
8. Each automation becomes one `workflow_template` with `apply_rule_type = 'on_event'` and `apply_rule_config = { eventType: <trigger_type>, triggerConfig: <trigger_config> }`.
9. `status = 'active'` converts active; `draft`, `paused` and `archived` all convert as **draft**. Converted drafts stay editable and activatable rather than becoming archived read-only.
10. Each `automation_action` becomes a `workflow_template_step`: `wait` to `type='wait'`, `branch` to `type='branch'`, everything else to `type='action'` with the old `type` moved into `config.actionType` and the old `config` merged alongside it.
11. `parent_action_id` and `branch_path` map 1:1 to `parent_step_id` and `branch_path`, parents inserted before children.
12. `disabled` actions carry their flag over.
13. Steps get `timing = {"mode":"after_previous","delayAmount":0,"unit":"days"}`, because an automation's action chain was implicitly sequential.
14. `canvas_x` / `canvas_y` are seeded from the old auto-layout so a converted template opens as a readable canvas rather than a pile of overlapping nodes at the origin.
15. A `create_task` action converts to an `action` step whose `config.actionType` stays `create_task`; the handler is re-pointed in Task 19 rather than the config being rewritten here.
16. Quiet hours, `branch_depth_limit` and `template_slug` carry over.

**Idempotency and safety:**
17. Running the converter twice produces no duplicates.
18. The converter never crosses tenants: a user's tasks only ever land on their own instances.
19. `automation_runs` are **not** converted. Production has none in flight; if any exist at cutover the converter records a warning naming them and leaves them alone.

- [ ] **Step 2: Run and confirm it fails.**

- [ ] **Step 3: Write the converter.**

The SQL migration is the shipping path because the cutover deploy runs through CI `supabase db push` and must not depend on someone remembering to run a script. Guard it with a ledger so a replay is a no-op:

```sql
-- One-time conversion of the legacy Tasks and Automations data into the
-- unified Workflows model. Guarded by a ledger table so a migration
-- replay (local `supabase db reset`, a re-run in CI) is a no-op rather
-- than a duplicating second pass.
create table if not exists public.workflow_conversion_ledger (
  id text primary key,
  converted_at timestamptz not null default now(),
  detail jsonb not null default '{}'::jsonb
);
```

Use `'tasks_and_automations_v1'` as the ledger id and wrap the whole conversion in `if not exists (select 1 from workflow_conversion_ledger where id = ...) then ... end if;`.

Keep `lib/workflows/converter.ts` as a faithful TypeScript mirror. It is what the integration test drives and what you would reach for if a single user's conversion needs re-running.

- [ ] **Step 4: Run until green.** Nineteen cases.

- [ ] **Step 5: Rehearse against a production snapshot**

Before this ships, restore a production snapshot into the local stack, run the converter, and diff the counts: 55 tasks in, 55 steps out (minus any orphaned ones, which the report must name); 27 automations in, 27 templates out, 4 of them active. Report the numbers. **Do not run the converter against production by hand.** It ships through the CI deploy like every other migration; the web SQL editor is retired and using it causes ledger drift.

- [ ] **Step 6: Checkpoint.** Do not commit.

---

## Task 19: Re-point the task-writing actions and retire the task triggers

**Files:**
- Modify: `lib/automations/actions/task.ts`, `lib/automations/triggers.ts`, `lib/automations/trigger-constants.ts`, `types/automations.ts`
- Delete: `lib/automations/time-emitters/task-overdue.ts`
- Modify: `lib/events/actions.ts`, `app/(dashboard)/couples/actions.ts`
- Delete: `components/events/event-tasks.tsx`
- Test: `tests/integration/workflows/task-action-repoint.test.ts`

- [ ] **Step 1: Write the failing integration test.** A workflow step with `config.actionType = 'create_task'` inserts a `todo` step on the target couple's **default** instance, not a `tasks` row; `update_task` patches a `workflow_steps` row; `create_calendar_event` and `create_reminder` do the same with a date.

- [ ] **Step 2: Re-point the four handlers in `lib/automations/actions/task.ts`.**

Keep the action slugs (`create_task`, `update_task`, `create_calendar_event`, `create_reminder`) so converted configs keep working. Only the handler bodies change: swap `.from('tasks')` for a `workflow_steps` insert against `ensureDefaultInstance(ctx.userId, ctx.couple.id)`. `findLatestTaskId` becomes `findLatestStepId` reading `step_id` out of `ctx.actionResults`.

`resolveDueDate`'s relative-to-event arithmetic currently builds a `Date` from a string and adds milliseconds, which is exactly the timezone bug class to stop repeating. Replace it with `computeDueAt` from `lib/workflows/timing.ts`.

- [ ] **Step 3: Retire the three task triggers.** Remove `task_created`, `task_completed` and `task_overdue` from the picker in `trigger-constants.ts`. **Leave their entries in the `TriggerType` union and the registry**, hidden from the picker: retired types always stay in the registry so a config saved against one still parses. That is the established rule here and skipping it produces silently dead automations.

Delete `lib/automations/time-emitters/task-overdue.ts` and its registration; `step_overdue` from Task 8 replaces it.

- [ ] **Step 4: Re-point the remaining `from('tasks')` call sites.**

Run: `grep -rn "from('tasks')" app lib components`
Remaining after Phase C: `lib/events/actions.ts`, `app/(dashboard)/couples/actions.ts`, and `components/events/event-tasks.tsx`. Event-scoped tasks become steps on the couple's default instance with the event named in the description; there is no event-level workflow instance in v1. Delete `event-tasks.tsx` and the Tasks section of the event modal that renders it.

- [ ] **Step 5: Run the suites.** `npm run test:unit && npm run test:integration && npm run typecheck`

- [ ] **Step 6: Checkpoint.** Do not commit.

---

## Task 20: Nav swap, redirects, and deleting the old surfaces

**Files:**
- Modify: `app/components/sidebar.tsx`
- Replace with redirects: `app/(dashboard)/tasks/page.tsx`, `app/(dashboard)/automations/page.tsx`, `app/(dashboard)/automations/[id]/page.tsx`
- Delete: the remaining 10 files in `app/(dashboard)/tasks/` and the remaining files in `app/(dashboard)/automations/`
- Test: `tests/e2e/workflows-nav.spec.ts`

- [ ] **Step 1: Swap the sidebar.**

In `app/components/sidebar.tsx`, remove the `Tasks` and `Automations` entries and add one in the Tasks slot (fourth, after Calendar):

```ts
  { label: "Workflows", href: "/workflows", icon: ListChecks },
```

`ListChecks` reads as the checklist the feature actually is. Do not reuse `Sparkles` from Automations: it promised magic, and the queue is a to-do list.

- [ ] **Step 2: Add the three redirects.** Real users have bookmarks and browser history on all three paths.

```tsx
import { redirect } from 'next/navigation';

/** The Tasks page retired into Workflows. Kept as a redirect for bookmarks. */
export default function TasksRedirect() {
  redirect('/workflows');
}
```

`/automations` redirects to `/workflows?tab=templates`. `/automations/[id]` cannot map an old automation id to a new template id from the URL alone, so it redirects to `/workflows?tab=templates` too rather than 404ing.

- [ ] **Step 3: Delete the old surfaces.**

```bash
git rm "app/(dashboard)/tasks/"{actions.ts,bulk-actions-bar.tsx,filter-bar.tsx,group-by-toggle.tsx,group-section.tsx,task-cells.tsx,task-row.tsx,task-side-panel.tsx,use-task-groups.ts,use-task-options.ts}
git rm "app/(dashboard)/automations/"{automations-home.tsx,automations-table.tsx,pagination-bar.tsx,actions.ts}
```

Then fix every typecheck error. Run `grep -rn "task_groups\|task_statuses\|task_priorities\|task_types" app lib components` and remove the last references; those four lookup tables retire with the checklist simplification.

- [ ] **Step 4: Write the nav e2e spec** asserting the sidebar shows Workflows and shows neither Tasks nor Automations, and that all three old URLs land on the right place.

- [ ] **Step 5: Run the whole pyramid.**

```bash
npm run test:unit
npm run test:integration
npm run typecheck && npm run typecheck:strict && npm run lint:gate
npx playwright test
```
Expected: green. Fix the app, never the test.

- [ ] **Step 6: Ratchet the gates down.** Deleting roughly 17,000 lines of legacy UI should move both budgets meaningfully. Lower them in `scripts/typecheck-strict-gate.mjs` and `scripts/lint-gate.mjs` to lock the gain in.

- [ ] **Step 7: Checkpoint.** Do not commit.

---

## Task 21: Freeze the legacy tables

**Files:**
- Create: `supabase/migrations/20260907000000_freeze_legacy_tables.sql`
- Test: `tests/integration/workflows/legacy-frozen.test.ts`

- [ ] **Step 1: Write the failing test.** An authenticated user can no longer INSERT or UPDATE `tasks` or `automations`; they can still SELECT (so a support question about what was there is answerable); `automation_events`, `emit_automation_event` and `couple_custom_fields` are **untouched** and still work, because a dozen DB triggers depend on them.

- [ ] **Step 2: Write the migration.** Drop the write policies on the legacy tables, keep the select policies. Revoking DML grants would also work but policy drops are easier to read and to reverse if the cutover has to be rolled back.

The tables to freeze: `tasks`, `task_groups`, `task_statuses`, `task_priorities`, `task_types`, `automations`, `automation_actions`, `automation_runs`, `automation_waits`, `automation_audit_log`.

**Do not freeze `automation_events` or `couple_custom_fields`.** Add a comment in the migration saying so and why, because the next person reading this file will assume every `automation_*` table is dead.

- [ ] **Step 3: Remove the dual-run guard.** With the automations engine gone, the workflow dispatcher owns the bus. Change it to write `automation_events.processed_at` like the old one did, and drop the reads against `workflow_dispatched_events`. Keep the table itself until Phase F so a rollback has somewhere to look.

- [ ] **Step 4: Delete the automations engine modules** that nothing imports any more:

```bash
git rm lib/automations/dispatcher.ts lib/automations/runner.ts lib/automations/home-payload.ts lib/automations/launch-catalogue.ts lib/automations/run-controls.ts
```

Run `npm run typecheck` after each removal. **Keep** `actions/`, `triggers.ts`, `trigger-constants.ts`, `conditions.ts`, `context.ts`, `variables.ts`, `quiet-hours.ts`, `recipients.ts`, `mustache-doc.ts`, `config-errors.ts`, `action-defaults.ts`, `audit-log/narrate.ts` and `time-emitters/`: the workflow engine imports all of them. Leaving them under `lib/automations/` is deliberate; moving them is churn with a large diff and no benefit, and the directory name is accurate for what remains (the event and action vocabulary).

- [ ] **Step 5: Run the pyramid and the migration gate.**

- [ ] **Step 6: Checkpoint.** Do not commit.

---

## Task 22: Regenerate types and update the docs

This task is deliberately last in the batch. Regenerating `types/database.ts` earlier would mean regenerating it again after every subsequent migration, and that file conflicts badly when several sessions share a checkout.

**Files:**
- Modify: `types/database.ts` (regenerate)
- Modify: `.claude/docs/database-schema.md`, `page-specs.md`, `security.md`, `production-readiness.md`, `testing.md`, `automations.md`, `automations-wiring.md`, `couple-automations-tab.md`, `frontend-design.md`, `alerts.md`
- Modify: `.claude/CLAUDE.md`

- [ ] **Step 1: Regenerate the database types.**

```bash
supabase db reset
supabase gen types typescript --local > types/database.ts
npm run typecheck
```

Run this **once**, after every migration in the batch is in place. Fix any drift between the hand-written row types in `types/workflows.ts` and the generated ones; the generated types win.

- [ ] **Step 2: Update the docs, each in the way its own table row demands.**

- `database-schema.md`: the seven new tables, their columns, RLS policies and indexes. Mark the legacy tables frozen with the date and the migration that froze them, and state explicitly that `automation_events` and `emit_automation_event()` survive as the shared event bus.
- `page-specs.md`: the `/workflows` page (both tabs), the `/workflows/[id]` builder, the couple Workflow tab. Remove the `/tasks` and `/automations` specs.
- `security.md`: tick the RLS coverage matrix for all seven new tables, naming `tests/integration/rls/workflows.test.ts` as the proof. Add the per-page security checklist result for `/workflows`.
- `production-readiness.md`: record the phase as complete with the date, and note which Definition-of-Done items are met.
- `testing.md`: the new selectors and the three new e2e specs.
- `automations.md`, `automations-wiring.md`, `couple-automations-tab.md`: these describe a feature that no longer exists. Do not delete them, they hold the trigger and action reference that is still live. Retitle them to reflect that they now document the **engine internals** the workflows feature runs on, and put a header at the top of each pointing at the workflows spec and this plan for the current model.
- `alerts.md`: the new `sendAlert()` call sites in the tick.
- `frontend-design.md`: any primitive added along the way, and confirm each has an entry on `/design-system`.
- `.claude/CLAUDE.md`: update the "Current scope" line so it reads Workflows rather than Tasks and Automations, and update the sidebar nav list in the App layout section.

- [ ] **Step 3: Confirm the docs match reality.** Re-read each edited section against the code. A doc that describes the plan rather than what shipped is worse than no doc.

- [ ] **Step 4: Full pyramid, final.**

```bash
npm run test:unit && npm run test:integration
npm run typecheck && npm run typecheck:strict && npm run lint:gate
npm run check:server-action-exports
bash scripts/check-migrations.sh
node scripts/check-no-service-role-in-client.mjs
npx playwright test
```

- [ ] **Step 5: Phase E checkpoint.** Report every number: tests passing, lines deleted, gate budgets before and after. Do not commit.

---

# Phase F: Follow-ups

These are separate pieces of work. Each is worth its own review and none of them blocks the cutover.

## Task 23: Wire appointment steps to the Scheduler

**Files:**
- Modify: `lib/workflows/steps.ts`, `app/(dashboard)/workflows/[id]/inspector/appointment-inspector.tsx`
- Create: `lib/workflows/appointments.ts`
- Test: `tests/integration/workflows/appointment-steps.test.ts`

The Scheduler shipped in PR #80 and has `meeting_types`, `availability` and `bookings` tables plus a slot engine at `lib/scheduling/`. An appointment step gains an optional `config.meetingTypeId`; when set, completing the step means a booking exists against that meeting type for the couple, and the `consultation_booked` DB trigger auto-completes it.

**Read `lib/scheduling/timezone.ts` and use `zonedTimeToUtc` / `zonedDateParts`.** Never hand-roll date or hour arithmetic on instants. Every fixture in the test file carries a non-UTC case.

There is one **known open defect** in the Scheduler to be aware of, not to fix here: a skipped test in `tests/unit/app/calendar/week-grid.test.tsx` where no booking renders in any column during a DST changeover week, suspected to be booking-local-day-start compared to column-day-start by exact equality. Do not build appointment logic that depends on that comparison.

## Task 24: Portal package selection hook

The portal already writes `couples.selected_package_id` (`get_portal_packages` / `20260819110000_portal_package_selection.sql`), and Task 5's trigger already emits `package_applied` for it. So a couple self-selecting a package in the portal **already** applies the matching workflow. This task is verification plus the e2e proof, not new engine work: write `tests/e2e/portal-package-workflow.spec.ts` covering select-in-portal to workflow-applied, and confirm the emit fires from the portal's SECURITY DEFINER path as well as the MC's direct update.

## Task 25: Drop the legacy tables

**Files:** `supabase/migrations/20260908000000_drop_legacy_tables.sql`

Only after the frozen tables have been verified untouched in production for a reasonable window. This migration is destructive and needs the marker on every statement:

```sql
-- @ALLOW_DESTRUCTIVE: Tasks and Automations were replaced by Workflows in
-- the 2026-09 cutover. All rows were converted by
-- 20260906000000_workflows_converter.sql and the tables have been frozen
-- (no DML) since 20260907000000. Verified untouched in production before
-- this ran.
drop table if exists public.automation_audit_log;
drop table if exists public.automation_waits;
drop table if exists public.automation_runs;
drop table if exists public.automation_actions;
drop table if exists public.automations;
drop table if exists public.tasks;
drop table if exists public.task_groups;
drop table if exists public.task_statuses;
drop table if exists public.task_priorities;
drop table if exists public.task_types;
drop table if exists public.workflow_dispatched_events;
```

**`automation_events`, `emit_automation_event()` and `couple_custom_fields` are NOT in that list and must never be added to it.** They are the live event bus and a dozen DB triggers call into them. Dropping them takes the whole engine down.

Delete the retired trigger types from `TriggerType` only if nothing in `workflow_templates.apply_rule_config` still references them. Check first:

```sql
select count(*) from workflow_templates
where apply_rule_config->>'eventType' in ('task_created', 'task_completed', 'task_overdue');
```

---

## Self-review notes

**Spec coverage.** Every section of the spec maps to a task: the three-object model to Tasks 1 and 2; step types to Task 2 and the Phase B inspectors; per-step timing to Task 3; the engine's four numbered stages to Tasks 5 through 8; tags to Task 9; the builder to Tasks 10 and 11; the couple tab to Tasks 13 through 15; the queue and dashboard widget to Tasks 16 and 17; migration to Tasks 18 and 19; the nav swap and freeze to Tasks 20 and 21; docs to Task 22; the three Phase F items to Tasks 23 through 25. The spec's testing section is satisfied by the unit tests in Tasks 2, 3, 7 and 16, the integration tests in Tasks 1, 4, 5, 6, 7, 8, 14, 18, 19 and 21, and the e2e specs in Tasks 12, 15 and 20.

**One deliberate deviation from the spec body**, recorded in the spec's own settled-decisions section: the builder keeps the React Flow canvas.

**Two decisions the plan makes that the spec did not cover.** First, the event bus is reused rather than renamed, because a dozen DB triggers call `emit_automation_event()` and renaming buys nothing. Second, roughly a dozen `lib/automations/` modules stay where they are rather than moving to `lib/workflows/`, because the workflow engine imports them unchanged and a move is a large diff with no benefit.

**The riskiest task is 18, the converter,** because it is the only one that touches data real paying users own. It has a rehearsal step against a production snapshot for that reason.

**The most likely silent bug is timing.** Three separate tasks (3, 16 and 23) carry an explicit instruction that every fixture must include a non-UTC case, because the Scheduler build found six timezone bugs, each one hidden by a UTC-pinned fixture where wrong and right coincide.
