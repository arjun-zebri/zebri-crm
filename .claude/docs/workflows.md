# Workflows

Source-of-truth doc for the unified Workflows feature, which replaced
both the standalone Tasks system and the event-driven Automations
engine. Read this before touching anything under `lib/workflows/`,
`app/(dashboard)/workflows/`, the couple profile's Workflow tab, or
`app/api/cron/automations-tick/`.

Spec: `docs/superpowers/specs/2026-08-19-workflows-design.md`.
Implementation plan: `docs/superpowers/plans/2026-09-04-workflows.md`.

The older `automations.md`, `automations-wiring.md`,
`automations-review.md` and `couple-automations-tab.md` describe the
retired engine. They are kept for the trigger and action vocabulary,
which carried over verbatim, but where they disagree with this file,
this file wins.

## The one idea

**An applied workflow instance IS the run.**

The old engine walked a template's action DAG and kept progress in
`automation_runs`. The new engine **snapshots** a template's steps into
`workflow_steps` rows owned by a `workflow_instances` row, then walks
the snapshot. That single change is what lets a manual to-do and an
automated email sit in one ordered list and gate each other.

Two properties fall out of it:

- **Template edits never touch live work.** Editing or deleting a
  template step cannot disturb a couple mid-workflow, because their
  steps are their own rows. This is Dubsado's safety property, and it
  avoids the Studio Ninja bug where editing a workflow resets everyone.
- **A to-do can block an automated step.** A step timed
  `after_previous` has `due_at = null` until its predecessor completes.
  The executor only picks up steps with a non-null, past `due_at`, so
  an unticked to-do simply holds the line.

## Mental model

```
DB write / webhook / time emitter
              │
              ▼
      automation_events            the bus, unchanged
              │
              ▼
  lib/workflows/dispatcher.ts      match active templates by apply rule
              │
              ▼
  lib/workflows/instantiate.ts     snapshot template steps → instance
              │
              ▼
      workflow_instances
      workflow_steps               the work the MC actually does
              │
              ▼
  lib/workflows/executor.ts        run every due automated step
```

The MC sees the bottom two boxes: this couple's steps on their Workflow
tab, and the same steps across every couple on the Workflows queue.

## Schema

Seven tables, all owner-scoped with RLS (`20260905000000`):

| Table | Holds |
|---|---|
| `workflow_tags` | The MC's custom colour tags. |
| `workflow_templates` | A reusable workflow: name, status, apply rule, quiet hours, canvas viewport. |
| `workflow_template_tags` | Join. Its RLS checks **both** sides, because a foreign key does not. |
| `workflow_template_steps` | The authored steps, with canvas coordinates. |
| `workflow_instances` | One applied workflow on one couple. Also the run. |
| `workflow_steps` | The snapshot the MC actually works. |
| `workflow_audit_log` | What the engine did. SELECT-only policy. |

Plus `workflow_conversion_ledger` (one-time conversion guard, no RLS)
and `workflow_dispatched_events` (the retired dual-run guard, kept
until the legacy tables drop so a rollback has somewhere to look).

Three partial unique indexes carry real rules: one default instance per
couple, one personal instance per user, one instance per trigger event.

### Step types

`todo` and `appointment` are manual: the MC ticks them. They live in
the builder's picker under "Yours to do", and an unticked one is what
holds up every automated step anchored behind it. Their card carries a
checkbox / calendar icon and opens the manual composer
(`manual-step-modal.tsx`) rather than expanding, which is the only
place a manual step's title is written: the title is a row column
(`workflow_template_steps.title`), not part of `config`.

An appointment step can name a `config.meetingTypeId`. When it does, a
confirmed Scheduler booking against that meeting type for that couple
ticks the step by itself (`lib/workflows/appointments.ts`, called from
the dispatcher as it walks the bus). Left unset, it stays a reminder
the MC ticks by hand. `action`,
`wait` and `branch` are automated: the executor runs them. The registry
is `lib/workflows/steps.ts`.

An `action` step stores `type = 'action'` with the old action slug in
`config.actionType`. The builder canvas still thinks in slugs, so the
split and join happen only at the data boundary (`splitStepType` /
`joinStepType` in `app/(dashboard)/workflows/actions.ts`, `toBuilderStep`
in `adapt.ts`). That adapter is why all 41 builder components carried
over untouched.

### Step timing

`lib/workflows/timing.ts`. Three modes:

- `wedding_relative` — "2 weeks before the wedding". Null wedding date
  means the step stays unscheduled rather than guessing.
- `apply_relative` — "3 days after this workflow was applied".
- `after_previous` — the default, and the gating mechanism above.

Never do date arithmetic by hand here. Compose `zonedTimeToUtc`,
`localMidnight`, `addDaysToDateString` and `addMonthsToDateString` from
`lib/scheduling/timezone`. Adding 86,400,000 ms lands on the wrong day
across a DST boundary, and every fixture must carry a non-UTC case.

### Apply rules

`lib/workflows/apply-rules.ts`. A template applies when its rule
matches: `manual`, `on_couple_created`, `on_stage_changed`,
`on_package_applied`, or `on_event` (any bus event type, with the old
trigger config nested under `triggerConfig`).

`on_event` is also what every converted automation uses, which is why
the whole trigger vocabulary in `lib/automations/triggers.ts` stayed
put.

The builder does not speak this vocabulary. Its picker lists **triggers**
out of the registry, so every rule saved from the canvas is stored as
`on_event` nesting the trigger and its config. `splitApplyRule` /
`joinApplyRule` (same module) translate at the data boundary, the same
way `splitStepType` / `joinStepType` do one level down: `toBuilderTemplate`
splits on read, `setApplyRuleAction` and `createWorkflowTemplateAction`
join on write. Two consequences worth knowing:

- The canvas word for "no automatic rule" is `unset`; the stored word is
  `manual`. Writing `unset` straight through fails the `apply_rule_type`
  CHECK constraint, and reading `manual` straight through titles a card
  with a slug the trigger registry cannot label.
- The three native rules are read back as their equivalent triggers
  (`on_couple_created` → `new_enquiry`, and so on). Their config keys
  match, so the canvas can edit one in place, but it re-saves it as
  `on_event`.

## Surfaces

| Route | What it is |
|---|---|
| `/workflows` | Upcoming tab (default) and Templates tab. |
| `/workflows/[id]` | The React Flow canvas builder, moved from `/automations/[id]`. Below `md` it renders as a plain list instead (`mobile-step-list.tsx`). |
| Couple profile, Workflow tab | One merged list of this couple's steps (Needs you now / Next / Done), ad-hoc to-dos, and the audit feed. |
| Couples board | Per-couple progress line, from `use-workflow-progress.ts`. |
| Settings, Notifications | The morning digest toggle (`daily-digest-card.tsx`). |
| `/portal/[token]` | "Where we are up to", the steps the MC opted into sharing. |
| `/tasks` | Redirect to `/workflows`. |
| `/automations`, `/automations/[id]` | Redirect to `/workflows?tab=templates`. |

The dashboard's Outstanding To-Dos card (`dashboard-steps.tsx`) reads
the same manual steps the queue does.

**Canvas positions are nullable on purpose.** `canvas_x` / `canvas_y`
shipped `not null default 0`, and the builder's auto-layout only places
a step with no saved position, so every step in a workflow rendered on
top of every other one and fitView zoomed into the pile. Migration
`20260910000000` drops the not-null and backfills the (0, 0) rows to
null. Null means "lay me out"; a number means "the MC dragged me here".

The couple profile's Tasks and Automations tabs folded into the single
Workflow tab. Layouts saved against the old tab keys are migrated on
read: see `migrateTabKeys` / `migrateHiddenTabKeys` in
`app/(dashboard)/couples/couple-profile-tabs.ts`.

## The tick

Two things run the engine: the mutation that caused an event runs it at
once for that one MC, and the cron sweeps everyone.

### The immediate kick

`lib/workflows/kick.ts`. Until it existed, the cron was the only reader
of the bus, so a workflow whose apply rule was "when a couple is added"
opened its instance up to a day later - and never at all on a dev
server, which no cron reaches. Adding a couple and watching nothing
happen was the whole of that bug.

A mutation that emits a bus event now calls `scheduleKick(userId)`,
which runs `kickWorkflows` inside `after()` so the request returns
first. Outside a request scope (a script, or a test calling the action
straight from Node) `after` throws, and the fallback runs the kick
immediately: nobody is waiting there anyway. The kick runs the same
dispatch and execute passes the tick does, with two limits that make it
safe on a user's own request:

- **Scoped to that owner.** `dispatchPendingEvents` and
  `advanceDueSteps` both take `{ userId }`; one MC adding a couple must
  never work another tenant's backlog, still less send their mail.
- **Windowed to the last five minutes.** The batch is oldest-first, so
  a limit alone is not enough: against the 164-event backlog on the dev
  bus, the first version drained the 50 oldest events and left the
  couple that had just been created undispatched. `since` keeps a kick
  about what just happened.

It is fire-and-forget and swallows its own errors. A failed kick leaves
`processed_at` null, so the sweep picks the event up: the cost is
freshness, never correctness, and never the mutation that called it.

Call sites are in `app/(dashboard)/couples/actions.ts` (create, bulk
create, update, bulk move, bulk status) - the paths behind
`new_enquiry` and `couple_stage_changed`, which is what the three
native apply rules key off. Every other emitter still waits for the
sweep; adding one is a single `scheduleKick(user.id)`.

### The cron sweep

`app/api/cron/automations-tick/route.ts` keeps its path (it is named in
`vercel.json`; renaming a live cron endpoint to match internal
vocabulary is a needless outage risk). It stays the sweeper: it owns
the time-based emitters, catches every event whose emitter does not
kick, and re-tries anything a kick dropped. Each tick:

1. `runTimeEmitters` — compute what should fire now for triggers with no
   source-row change (`invoice_due`, `step_overdue`, …).
2. `dispatchPendingEvents` — match bus events to active templates and
   apply them. Automatic applies dedupe per couple: a second copy means
   a second set of emails.
3. `advanceDueSteps` — run every step whose `due_at` has passed.

`advanceDueSteps` takes the oldest due steps up to a budget of 200, so
its query refuses in SQL everything `isExecutable` would refuse anyway:
manual types and anything held for the MC's OK. Both are due forever
until a person acts on them, and an MC carrying two hundred overdue
to-dos would otherwise fill every slot with work the engine cannot do
and never run another send.

Each pass is isolated, so one throwing does not cost the other its turn.

The time emitters ask which lead times anyone configured through
`loadActiveTriggerConfigs` (`lib/workflows/trigger-configs.ts`), which
reads active `on_event` templates. Before the cutover that question was
answered by the `automations` table.

## Getting a workflow onto the screen

An empty Workflows tab is the feature's hardest moment: a canvas with a
blank trigger asks the MC to design a process before they have seen one.
Two doors out of it:

- **Describe it** (`describe-workflow.tsx`) — the MC types how they
  actually work, in their own words. It creates an empty draft and hands
  the description to the canvas copilot through `?describe=`, so nobody
  types it twice.
- **Blank** — the old path, still there.

**Ready-made starter workflows were removed** (2026-09-06, at the
owner's call). `lib/workflows/starters.ts`, `starter-picker.tsx` and
`installStarterAction` are gone, along with the four seeded processes.
A library of workflows written for a generic MC is not the head start
it looks like: each one had to be read, understood and then rewritten
before it fitted anybody's actual business, which is more work than
describing the process once and letting the copilot draft it. Nothing
in the database changed — a starter was copied into the MC's own
templates at install time, so any workflow somebody already installed
is an ordinary template and keeps working.

Both remaining doors live behind one **New workflow** menu
(`new-workflow-menu.tsx`). Three toolbar buttons, repeated again inside
the empty state, asked the MC to choose between three words before they
knew what any of them meant.

The celebrant starter is the one to read before editing any of them. It
anchors every step to the wedding date (`wedding_relative`) because the
Australian legal calendar is anchored there: NOIM at six months, the
one-month deadline warning at five weeks, BDM registration three days
after. Copy that shape, and keep the "at least"/"within" wording:
those are legal minimums, not preferences.

## Review before send

An automated step can be marked **"Ask me before this runs"**
(`workflow_steps.requires_approval`, set per step in the builder's
inspector; the toggle reads "It stays in your upcoming tab until you
execute manually"). When it falls due it does not run. It surfaces on
the Upcoming tab with the **rendered** message for that couple, and
waits.

No new column was needed: `isExecutable` already refuses to run past the
flag. A step "needs review" when it is automated, pending, due, and
still flagged. That definition lives in one place,
`needsReview()` in `lib/workflows/review.ts`, so the Today view, the
couple's Workflow tab and the tests cannot drift apart.

- `buildStepPreview` renders through the same `renderTemplate` the send
  path uses, so what the MC reads is what the couple gets. It also
  reports `unresolved` tokens: a `{{couple.venue}}` that could not be
  filled in is the difference between a good email and an embarrassing
  one.
- `applyReviewEdits` writes the MC's edit onto **the step**, never onto
  the saved template, and drops `templateId` so the send uses what is on
  screen. It writes `content` (the rich TipTap doc the send path
  renders), not the legacy plain-string `body`.
- `approveStepAction` clears the flag and calls `runStepNow` so an
  approved send goes immediately rather than waiting for the tick.

This replaces the old approval-by-email gate, which mailed a tokenised
link to an inbox and, after the automations engine was retired, had no
route left to answer it.

### AI drafting

The review card can rewrite the message in place: one instruction
("warmer", "mention the venue changed", "shorter") applied to the copy
already on screen. `POST /api/ai/draft-email` → `lib/workflows/ai-draft.ts`.

It cannot send, cannot touch the saved template and cannot edit the
workflow. It returns a subject and a body for the MC to read, and the MC
still presses Send. `parseDraft` falls back to what was on screen rather
than throwing, so a model that ignores the reply format costs a
re-press, not an error over an email about to go out.

Gates match the copilot's: auth, subscription, a per-minute burst limit,
then the same DB-backed daily cap (`DAILY_MESSAGE_CAP` in
`lib/workflows/ai-copilot/limits.ts`, incremented through
`increment_ai_copilot_usage`). Both surfaces share one ceiling so an MC
cannot run up a bill through whichever one is cheaper to loop.

## The Upcoming view

`/workflows` opens on Upcoming, not on a template library: the MC's
question in the morning is "what do I do", not "how is my automation
configured". It is not called Today because most of what makes a
wedding go well is decided in the fortnight before it.

`loadQueue` (`lib/workflows/queue.ts`) still returns its five groups,
but the page flattens them (`flattenQueue`) and re-cuts them by date
(`bucketQueueItems` in `app/(dashboard)/workflows/queue-buckets.ts`):
Overdue, Today, Tomorrow, This week, Next week, Later, No date. Empty
bands drop out.

The five sections were five answers to a question nobody was asking.
An automated send now sits in the day it will run, marked with a ⚡,
rather than in a box of its own, and the review gate moved into the
detail modal: a held send is not a different kind of work, it is a step
whose button says Send instead of Done.

Every row opens the step, from anywhere on the row. It used to be the
title alone, and an unnamed send stored `title = ''` (the builder only
asks for a name on the manual steps), so the row's only click target
collapsed to nothing: a held send could be seen and never opened, which
meant it could never be authorised at all. `stepDisplayTitle`
(`lib/workflows/step-label.ts`) now names any step from what it does
and what it says ("Send email · Welcome!"), applied in the loaders so
the queue, the detail modal and the couple's list cannot call one step
three things.

A send waiting for the MC's OK carries a warning `StatePill` reading
**Needs your OK**: the row's ⚡ says "Zebri runs this", which is the
opposite of what a held send needs them to know. Every row also has an
always-visible `⋯` (Tomorrow / Next week / Skip this step / Open the
couple) - a control that appears only under the pointer is a control an
MC has to already know about. Nothing sends from a list row; the row
opens the step and Send lives in the modal. The same pill appears on
the couple's Workflow tab.

`rowDueLabel` picks the right-hand label from the band, which is the
part worth reading twice: a time within today, a weekday within the
fortnight, a date beyond it, and "87 days ago" for anything overdue.
An errored step lands in Overdue whatever date it carries.

One group-by dropdown (`queue-grouping.ts`) chooses what the rail
groups by: date (the bands above), couple (nearest wedding first, the
MC's own to-dos last), or who does it (You, then Zebri). It regroups
rather than filters, so no choice ever hides a step: hiding rows to
answer "what is Zebri doing for me this week" leaves the list wrong in
a way the MC has to remember. Grouping is client-side because the queue
is capped at a couple of hundred rows and the menu should be instant.
The button reads back the choice as a sentence ("Group by couple").

Because the rail no longer always means a date, `rowDueLabel` is fed
each row's own band from `bucketFor` rather than the group it landed
in, so "Mon" and "87 days ago" stay true under every grouping.

Finished work is not archived anywhere: ticking a step sets
`workflow_steps.status = 'done'` (or `'skipped'`) and stamps
`completed_at`, in place. The Done strip under the Upcoming list reads
those rows back for the last 90 days (`loadDoneSteps`,
`countDoneSteps`), and un-ticking one is `reopenStep`, which returns it
to `pending` and reopens the instance if that instance had completed.
Both done reads skip the queue's `instances.status = 'active'` filter,
which would otherwise hide the last step of every completed workflow.

`detectNudges` (`lib/workflows/nudges.ts`) still exists and names the
one thing most worth fixing; it is surfaced on the couple profile.

Both tabs share one shell (toolbar on the page, body below it taking
the rest of the height and scrolling itself, no card around either),
wait behind a skeleton shaped like their content
(`workflows-skeletons.tsx`), and render the same empty state
(`workflows-empty.tsx`). The Upcoming rows and their
skeleton share one set of layout classes, so the load is a fade and not
a jump.

A worked-out Upcoming with an empty Templates tab is normal, not a bug.
An instance is a snapshot: applying a template copies its steps into
`workflow_steps` and the instance runs on its own from then on.
`workflow_instances.template_id` is `on delete set null`, so deleting a
workflow leaves everything already running untouched. On top of that,
every couple gets a default ad-hoc instance named "General"
(`instantiate.ts`) with no template behind it at all, which is where
one-off to-dos and anything carried over from the retired Tasks system
lives. That name is never rendered: it is a heading for a workflow the
MC never made, so a step from a default instance simply carries no
workflow chip.

### The step detail modal

`step-detail-modal.tsx`, opened by clicking any row, backed by
`loadStepDetailAction`. It carries what a row cannot: the step's place
in its workflow ("step 4 of 11", counted from its siblings in position
order so it agrees with the couple's Workflow tab) and the rendered
message. The list rows deliberately carry only what a row shows;
fetching a preview for forty rows nobody opens would be the page's
largest read by far.

Shaped like every other action modal: the step's name in the header,
the step in the body (`step-detail-body.tsx`), the decision in the
footer. A held send opens under a warning callout saying nothing goes
out until they send it, and the message is rendered as a message rather
than quoted inside a tinted card.

The body holds one height whatever state it is in (`min-h-80`, footer
rendered from the first frame), and the wait is a skeleton shaped like
the step (`StepDetailBodySkeleton`), not a spinner: a modal that grows
as its data lands moves the button the MC was already reaching for.

**It opens as a form**, with the step's own words already in the
fields. There is no Edit button: a modal that shows you the wrong word
and then asks you to find a button before you can fix it is two steps
where one will do. Which form depends on the step:

- a send: the rendered subject and body for this couple
  (`step-email-edit.tsx`). Edits land on this step alone; the saved
  template behind it is untouched.
- a manual step: its name, note and due date (`step-detail-edit.tsx`,
  saved through `renameStepAction` + `rescheduleStepAction`).
- any other action: the action's own fields (`step-config-edit.tsx`),
  which are the builder's `ActionFields` rendered against the instance
  step and saved with `updateStepConfigAction`. The builder decides
  what every future couple gets; this decides what happens to this one,
  so the action's slug is not editable here.

The fields are seeded during render (a stepId latch, not an effect), so
they hold the step's words on the first frame it is on screen.

Footer: Open the couple, then Snooze, **Save** and the primary — Send &
complete / Mark done / Try again. Save keeps an edit without acting on
it (`saveStepMessageAction` for a send, which is `applyReviewEdits`
minus the send and minus clearing the gate): an MC who reworded a send
and then snoozed it should still have the rewording when it comes
back.

### The couple's Workflow tab

One list, not one checklist per applied workflow. The old shape put the
engine's structure on screen instead of the MC's day: a heading per
instance (including the auto-created "General" bucket nobody made), a
progress bar each, and the one overdue call buried under a send that is
not due for a fortnight.

`bucketCoupleSteps`
(`app/(dashboard)/couples/couple-workflow-buckets.ts`, pure and
unit-tested) merges every visible instance's steps into three groups:

- **Needs you now** — held sends, failures, anything overdue.
- **Next** — everything still to come, soonest first, undated last.
- **Done (n)** — a collapsed strip, most recent first.

The workflow's name is demoted to a chip on the row, and only when the
instance is not the default one, so "General" is never a heading.
Rows open the same `StepDetailModal` the queue uses; the row `⋯` keeps
Rename / Snooze / Take the date off / Skip / Reopen / Remove and gains
**Stop this workflow** for a step from a workflow the MC started.

"Add a to-do" sits beside "Start a workflow" as a button and a modal
(`couple-todo-modal.tsx`), like every other create: the inline row it
replaced had nowhere to put a note, so ad-hoc work arrived as a bare
line of text. The Upcoming toolbar's add has the same composer
(`queue-add-step.tsx`), with a "who this is for" picker in front of it.

The held-send, failed-step and overdue nudges are filtered out on this
tab (`COVERED_BY_THE_LIST`): *Needs you now* is exactly those three
rows, named one by one in the place the MC acts on them, so a banner
counting them again is the page saying it twice. The wedding-date
nudges stay, because nothing in the list carries them. The digest keeps
its own copy of all of them.

## Scheduling the MC can see

- **The timing control** (`timing-control.tsx`) is the missing half of
  the builder: the three timing modes were in the schema and the
  executor from the start, but there was no UI to set them. It is on the
  inspector, and the card shows a short chip ("2w before wedding") for
  anything that is not the default.
- **Dry run** (`lib/workflows/dry-run.ts`, `dry-run-modal.tsx`) projects
  the actual calendar a workflow would produce for one couple, before it
  is switched on. Rows whose date depends on a manual step completing on
  time are flagged `gated`, because that is an assumption and not a
  date.
- **Reschedule / snooze** (`rescheduleStepAction`) moves one step's
  `due_at` and deliberately leaves its `timing` alone: a
  wedding-relative step nudged by a day must still follow the wedding if
  the couple moves it.

## The morning digest

`app/api/cron/workflow-digest/route.ts`, daily at `0 21 * * *`.
Everything the engine does is invisible until somebody logs in, which is
the wrong default for a product whose promise is "you will not forget
anything".

The gate is the MC's **local** hour, not a fixed UTC time, so daylight
saving cannot drift the send an hour twice a year (`isDigestHour`).

It wants to run **hourly** -- that is what would give every timezone its
own 7am. Vercel's **Hobby plan caps crons at once per day** and rejects a
more frequent expression at deploy time, so the schedule is a single
daily run and `DIGEST_LOCAL_HOURS` is a window (`[7, 8]`) wide enough to
cover both halves of the Australian year: 21:00 UTC is 8am in Sydney
under AEDT and 7am under AEST. Hobby also promises no timing precision,
firing anywhere inside the 21:00 hour, which the same window absorbs.

The cost, stated plainly: **on Hobby an MC whose timezone falls outside
that window gets no digest at all.** Widening it further would mail
somebody at 4am, which is worse. Moving to Pro restores the hourly tick
and with it a real 7am for every timezone -- change the schedule back to
`0 * * * *` and narrow `DIGEST_LOCAL_HOURS` to `[DIGEST_LOCAL_HOUR]`.

Two guards keep it to one per MC per day:

- `user_public_settings.daily_digest_last_sent_on` holds the MC's
  **local** date, so the repeated hour daylight saving creates cannot
  produce a second send.
- **A digest with nothing in it is never sent.** An MC who receives "you
  have 0 things" every morning stops reading it inside a week, and then
  misses the morning that mattered.

Opt-out lives in Settings → Notifications
(`user_public_settings.daily_digest_enabled`).

## What the couple sees

**Nothing.** The builder no longer offers a "Show this to the couple"
toggle on any step: a workflow is the MC's internal list, start to
finish, and half of what is on it ("chase the outstanding balance") is
not something to put in front of a couple at all.

`workflow_steps.visible_to_couple` (default false) and
`get_portal_milestones(token)` survive from when the toggle existed, so
the column is still readable and any step an MC flipped on before the
removal still resolves - but nothing writes the field any more, which
means the milestone list is empty for every workflow built from here.
Rip both out, or bring the toggle back, but do not leave it as a
surface an MC can neither see nor set.

If it does come back: the couple sees two states only, **done** and
**upcoming**, never `errored` (a failure on the MC's side is not the
couple's problem and reads as alarming), and never `skipped` as
distinct from done (the MC decided; explaining that decision is not
this page's job).

It is a separate RPC rather than another key on `get_portal_data`,
because that one is a 150-line `jsonb_build_object` and editing it to
add a field would put every other portal section at risk for no gain.

Migrations: `20260908000000_workflow_digest_settings.sql`,
`20260909000000_workflow_portal_milestones.sql`.

## The cutover

Migrations `20260906000000` (convert) and `20260907000000` (freeze).

The converter turns every task into a `todo` step and every automation
into a template. It is idempotent through `legacy_task_id`,
`legacy_automation_id` and `legacy_action_id` provenance columns, and
guarded by `workflow_conversion_ledger` so a replay is a no-op. Its
TypeScript mirror, `lib/workflows/converter.ts`, is what the integration
test drives and what to reach for if one account needs re-running.

What the conversion deliberately drops, always with a warning naming
the row: task priority, type and group (steps are checklist-simple);
in-flight `automation_runs` (there is no faithful mapping from a
half-walked DAG onto a snapshot).

The freeze drops the write policies on `tasks`, the four task lookup
tables, `automations`, `automation_actions` and `automation_runs`.
Reads stay open so a support question is still answerable.

**`automation_events` and `couple_custom_fields` are NOT frozen.**
Despite the name, `automation_events` is the live bus, and a dozen DB
triggers write to it through `emit_automation_event`. Freezing either
silently stops every workflow.

`lib/automations/` still exists and is still imported: `actions/`,
`triggers.ts`, `trigger-constants.ts`, `conditions.ts`, `context.ts`,
`variables.ts`, `quiet-hours.ts`, `recipients.ts`, `mustache-doc.ts`,
`config-errors.ts`, `action-defaults.ts`, `launch-catalogue.ts`,
`audit-log/narrate.ts` and `time-emitters/` are the engine's vocabulary
and all live. The directory name is accurate for what remains; moving
it would be a large diff with no benefit.

Retired but still registered: `task_created`, `task_completed` and
`task_overdue`. Nothing emits them any more (`step_overdue` replaced
them), and they are hidden from the picker, but a converted workflow
saved against one must still parse. That is the standing rule here.

## Still to do

**Dropping the frozen legacy tables** (`tasks`, the four task lookup
tables, `automations`, `automation_actions`, `automation_runs`,
`automation_waits`, `automation_audit_log`, and
`workflow_dispatched_events`) is deliberately NOT written yet. Its
precondition is that the frozen tables have been verified untouched in
production for a reasonable window, and the freeze has not shipped. A
drop migration authored now would deploy in the same CI run as the
freeze and destroy the legacy rows before anyone could check the
cutover landed cleanly.

When that window has passed, the migration needs
`-- @ALLOW_DESTRUCTIVE:` on every statement, and
**`automation_events`, `emit_automation_event()` and
`couple_custom_fields` must never be added to it.**

Before retiring the three `task_*` trigger types from `TriggerType`,
check nothing still references them:

```sql
select count(*) from workflow_templates
where apply_rule_config->>'eventType'
  in ('task_created', 'task_completed', 'task_overdue');
```

## Testing

- Unit: `tests/unit/lib/workflows/`, `tests/unit/app/workflows/`,
  `tests/unit/app/couples/couple-workflow-buckets.test.ts` (the
  Needs-you-now split) and `couple-todo-modal.test.tsx`. The audit added
  `review`, `dry-run`, `nudges`, `digest`, `timing-summary`,
  `apply-rules` and `ai-draft`. `queue-done` covers the Done strip's day
  banding.
- Integration: `tests/integration/workflows/` — instantiation, the apply
  triggers, dispatcher, executor, converter, the re-pointed to-do
  actions, the freeze, and cross-tenant RLS denial for all seven tables.
  Plus `review.test.ts` (preview, approve-and-run, reschedule, each with
  its cross-tenant denial), `done-list.test.ts` (the Done strip's read,
  including the completed-instance case), `digest.test.ts`, and `tests/integration/portal/milestones.test.ts`
  (the couple-facing RPC through the anon client, including a token for
  the wrong couple and a revoked token).
- E2E: `tests/e2e/workflows-builder.spec.ts`,
  `tests/e2e/couple-workflow.spec.ts`, `tests/e2e/workflows-nav.spec.ts`,
  `tests/e2e/portal-package-workflow.spec.ts`.

`tests/integration/helpers/workflows.ts` seeds an `on_event` template
and reads back the instances it opened. The emitter suites use it, since
the far end of the "DB write → bus → dispatcher" chain is now an applied
instance rather than a run.
