# Workflows: unified design spec

Status: approved direction, 2026-08-19. Phase planning not yet started.

## Context

MCs and celebrants run a detailed, repeatable process per couple (15 to 25
steps depending on the package). Zebri today has two disconnected halves of
this: a standalone Tasks system (board page, couple tab, dashboard widget)
and an event-driven Automations engine (28 triggers, 50+ actions, canvas
builder). Neither gives the Studio Ninja experience users expect: a named,
reusable step list applied to a couple, visible as a checklist ("we're on
step 7 of 20 for Sarah & Tom").

Competitor research (Studio Ninja, Dubsado, HoneyBook, 17hats, VSCO
Workspace) shows nobody runs tasks + automations + workflows as separate
features. Studio Ninja, Dubsado, and 17hats have ONE system, Workflows,
where automated emails and manual to-dos are step types in one sequence.

Production usage audit (prod DB, 2026-08-19) confirms the blast radius of a
full replacement is small: paying users (Marianna, TJ, John, Jack) own 9
tasks and 1 active automation total ("Untitled automation", likely an
experiment). Whole DB: 55 tasks, 27 automations, 4 active, 0 in-flight runs.

## Decisions locked in discussion (2026-08-19)

1. **Workflows REPLACE tasks and automations.** One unified model, like
   Dubsado/Studio Ninja. The Tasks and Automations nav items retire; a
   single **Workflows** nav item replaces both.
2. **Every couple has at least one applied workflow.** Ad-hoc to-dos
   ("call the venue about parking") are steps inserted into the couple's
   workflow. No standalone task concept survives.
3. **Workflows page = template library + work queue** (steps due across all
   couples).
4. **Custom tags** on templates (user-defined, name + colour) so "New
   enquiry" vs "Package workflows" etc. are easy to scan and filter.
5. **Branch is a step type**: the builder stays a vertical ordered list; a
   branch step expands inline into indented sub-paths.
6. **Per-step timing choice**: anchor to wedding date, to apply date, or to
   previous-step completion.
7. **Clean new schema + one-time converter** for the 55 tasks and 27
   automations. Old tables frozen, dropped later with an
   `@ALLOW_DESTRUCTIVE` migration.
8. **Steps are checklist-simple**: no custom statuses, priorities, task
   types, or groups. Those lookup tables retire.
9. Template edits are **isolated from applied instances** (Dubsado safety,
   avoids Studio Ninja's progress-reset bug); applied instances are fully
   editable per couple (Studio Ninja mutability).

## The model

Three objects, all owner-scoped (`user_id`, RLS `auth.uid() = user_id`):

### 1. Workflow template

The reusable definition built on the Workflows page.

- name, description, status (draft/active/archived)
- **tags**: user-defined lookup table (name, colour, position; same proven
  pattern as the retiring task lookup tables) + join table
- **apply rule** (how instances get created):
  - `manual` (always available)
  - `on_couple_created`
  - `on_stage_changed` (to a chosen status)
  - `on_package_applied` (when the MC applies package X to the couple via
    an invoice today; upgradeable later if couples self-select via portal)
  - `on_event` (any existing automation trigger: new_enquiry,
    invoice_overdue, contract_signed, ...). This is how old event-driven
    automations are expressed in the unified model.
- ordered **step definitions** (see step shape below)

### 2. Applied workflow (per couple)

Created when a template applies to a couple; **snapshots** the template's
steps at apply time. Fully editable per couple: add, remove, reorder, skip.
Statuses: active, completed, cancelled. Every couple gets a default
instance ("General") so ad-hoc steps always have a home. Multiple applied
workflows per couple are allowed (e.g. Enquiry process + Gold Package).

A small **personal workflow** (not couple-linked) exists per user for
migrated couple-less tasks and personal to-dos; it surfaces only in the
work queue.

### 3. Step

One item in a template or instance. Shape: title, description, type,
config (JSONB), timing, position, branch parentage, status
(pending/done/skipped), completed_at.

**Step types (v1):**

- **to-do**: manual tick by the MC.
- **automated action**: send email / invoice / contract / questionnaire /
  portal link / update stage / add note, etc. Reuses the existing action
  handlers, `{{couple.*}} {{mc.*}} {{portal.*}}` templating, quiet hours,
  and an optional **require approval** flag (existing approval machinery).
- **wait**: explicit delay ("wait 3 days" / "until 2 weeks before the
  wedding").
- **branch**: inline if/else using the existing predicates (has paid
  deposit, has signed contract, couple field, custom field); children
  render as indented sub-lists.
- **appointment**: v1 is a dated to-do ("booked consult"); a later phase
  wires it to the Scheduler (meeting types from the current scheduler
  build).

**Timing (per step):** one of

- relative to wedding date ("2 weeks before", "3 days after"): steps
  reshuffle automatically if the couple's event date changes (17hats
  base-date behaviour)
- relative to apply date ("3 days after booking")
- after previous step completes, plus an optional delay: manual to-dos
  naturally gate later automated steps (Dubsado gating)

## Engine

Carry over the proven event-bus + tick architecture (dispatcher/runner
pattern from `lib/automations/`), re-pointed at the new tables:

1. DB triggers + time emitters push events onto the bus (unchanged
   concept).
2. Dispatcher matches events against template **apply rules** to create
   applied workflows, and against waiting steps (event-gated waits).
3. Tick executes due automated steps, honours waits/approvals/quiet hours,
   advances after-previous chains when steps complete, writes an audit
   trail.
4. Overdue to-do steps feed the work queue (and later, optional
   notifications), replacing the `task_overdue` trigger.

## UI surfaces

- **Workflows page** (replaces Tasks AND Automations in the sidebar):
  - **Queue tab**: cross-couple list of steps (overdue, due today,
    upcoming), personal list included, click-through to the couple. This
    is the MC's daily view.
  - **Templates tab**: template library, filterable by tag; create/edit.
- **Template builder**: vertical ordered step list (NOT the old canvas);
  chip-style step-type picker; inline indented branches; per-step timing
  control; email/document composers reused from the automations builder.
- **Couple profile**: the Tasks tab becomes a **Workflow tab**: applied
  workflows as checklists with progress, inline add-step, skip, reorder;
  "Apply workflow" picker.
- **Dashboard**: the tasks widget becomes a "steps due" widget.
- Design-system rules apply throughout (tokens, primitives, ~150-line
  components, loading/empty/error states, mobile).

## Migration (clean schema + converter)

One-time converter, run as part of the cutover deploy:

- **Tasks to steps**: couple-linked tasks become to-do steps on that
  couple's default applied workflow (due_date preserved, done status
  preserved); couple-less tasks go to the user's personal workflow.
  Custom status/priority/type/group metadata is dropped (checklist
  simplification); nothing else is lost.
- **Automations to templates**: each automation becomes a template with
  apply rule `on_event(<trigger>)` and its action chain as automated
  steps (branches/waits map 1:1). The 4 active ones convert as active;
  the rest as drafts. In-flight runs: none exist (verified in prod).
- `create_task` / `update_task` actions in converted automations map to
  "add step to couple's default workflow" semantics; the
  task_created/task_completed/task_overdue triggers retire (step
  completion and overdue live natively in the engine).
- Old tables (tasks, task_* lookups, automations*, automation_*) are
  frozen (no writes) at cutover and dropped in a later
  `@ALLOW_DESTRUCTIVE` migration once verified.

## Testing

- Unit: timing computation (wedding-date shifts, after-previous chains),
  branch evaluation, converter mapping.
- Integration (local Supabase, real RLS): cross-tenant denial on every new
  table (tick the security.md matrix); apply-rule dispatch; step execution
  through real action handlers; converter round-trip on seeded legacy data.
- E2E (Playwright, desktop + Pixel 5 + iPhone 12): build template, apply
  to couple, tick to-dos, automated step fires, queue reflects it.

## Phasing (each phase a PR to staging, per the current batch rule)

- **A. Schema + engine core**: new tables, RLS, apply-rule dispatch, step
  scheduler/executor reusing action handlers.
- **B. Template builder UI** + tags.
- **C. Couple profile Workflow tab** + default/ad-hoc instance.
- **D. Queue tab + dashboard widget.**
- **E. Cutover**: converter, nav swap (Tasks + Automations to Workflows),
  freeze old tables, update docs (`page-specs.md`, `database-schema.md`,
  `security.md`, `production-readiness.md`, automations docs).
- **F. Later**: appointment/Scheduler wiring, portal package selection
  hook, old-table drop.

## Open questions (to settle during phase planning, none block the spec)

- Exact moment for `on_package_applied` (invoice created vs sent vs paid).
- Queue layout details (grouping, filters) and whether bulk actions from
  the old board are needed at this usage level.
- Whether converted draft automations are worth keeping vs offering
  archived read-only.
- Notification story for overdue steps (Slack alert? email digest?).
  Currently task_overdue could email via automations; decide the native
  equivalent.

## Decisions settled at implementation planning (2026-09-04)

These close the "Open questions" section above and correct one line in
the UI section. Where this section and the body of the spec disagree,
this section wins.

1. **The builder keeps the React Flow canvas.** This REVERSES the
   "vertical ordered step list (NOT the old canvas)" line under UI
   surfaces. Free node placement, zoom and connector lines were an
   explicit earlier decision, and a flow-list variant of the
   automations builder was built and reverted once already. The
   vertical checklist is how an **applied instance** renders on the
   couple profile and in the queue; it is not the authoring surface.
2. **Everything in the automations builder ports over**: the chip-driven
   config UI and its per-trigger filter arrays, the email / document /
   questionnaire / run-sheet / timeline composer modals, the trigger
   filter system, and the AI copilot (its tool schemas re-point at the
   new tables).
3. **The couple profile gets ONE folded Workflow tab.** Applied
   workflows render as checklists with progress; the per-couple run /
   audit feed that lives in the Automations tab today becomes an
   activity section inside the same tab. The `automations` tab key
   retires from `couple-profile-tabs`.
4. **`on_package_applied` fires when `couples.selected_package_id`
   transitions to a non-null value** (or changes to a different
   package). That single column is written both by the MC on the couple
   profile and by the couple in the portal, so one DB trigger covers
   both paths. Invoice created / sent / paid are deliberately NOT the
   anchor: an invoice is a billing artefact and can lag or never exist.
5. **Queue layout**: three groups, Overdue / Due today / Upcoming, with
   filters for couple, tag and step type. No bulk actions in v1 (the
   old task board's bulk bar does not carry over) since production
   usage does not justify them; the decision is revisitable once real
   step volume exists.
6. **Converted automations stay as real drafts**, not archived
   read-only. A draft is editable and activatable, which is what an MC
   would want from an automation they built; the 4 active ones convert
   active.
7. **Overdue steps notify natively via the bus.** The `task_overdue`
   trigger is replaced by a `step_overdue` event emitted by the tick's
   time emitters, so an MC can build a workflow that emails them a
   digest. The queue's Overdue group is the primary surface. No Slack
   alert for user-level overdue: `sendAlert()` stays operational
   (engine failures, converter problems), not a user notification
   channel.
8. **Appointment steps stay a dated to-do in the core phases**; the
   Scheduler wiring is Phase F as originally specced, even though the
   Scheduler has since shipped.
