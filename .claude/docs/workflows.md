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
- **Release is transitive up the lane (2026-09-27).** The MC can tick a
  to-do early, but the step behind it is released only once every step
  above it in the lane is done or skipped, and it is dated from
  whichever finished last. Before this, ticking a to-do while a send
  above it was still behind a Wait dated the send below it from the
  tick, and it went out first. The same holds behind a wedding- or
  apply-dated step (owner ruling, 2026-09-27): the dated step still
  runs on its own date whatever is open above it, but finishing it
  does not release the step behind it while an earlier step is open.
  One rule in
  `recomputeDueDates` (`lib/workflows/timing.ts`), `releaseBlocker`
  (`lib/workflows/release.ts`) and the Upcoming projection
  (`lib/workflows/schedule-projection.ts`); no SQL path dates a chained
  step from its predecessor.

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

- `wedding_relative`: "2 weeks before the wedding", optionally `sendTime`
  ("at 9:15am", `HH:MM` on a 15-minute grid, MC timezone). Null wedding
  date means the step stays unscheduled rather than guessing.
- `apply_relative`: "3 days after this workflow was applied" (local
  days, optional `sendTime`), or "45 minutes after" (`minutes` / `hours`
  are an instant offset from the apply moment, no `sendTime`).
- `after_previous`: the default, and the gating mechanism above. Delay
  in `minutes` (multiples of 15), `hours` or `days`.

One schema, `lib/workflows/timing-schema.ts`, validates every writer
(builder save, copilot, converter); `toStepTiming` still coerces on read
so a row from before a mode existed renders. Quiet hours apply after
timing: a 9:15pm send inside the couple's quiet window is deferred as
before. A workflow's own window (`workflow_templates.quiet_hours_start`
/ `_end`) is a Postgres `time` and reads back as `HH:MM:SS`; the parser
(`lib/automations/quiet-hours.ts`) accepts that as well as `HH:MM`.
Until the Phase 3 fix wave it did not, so every template-level window
silently read as "no quiet hours" in production. The 15-minute grid is a product choice (a short picker, round
numbers), not an engine limit now that the tick runs every minute.

#### "Take the date off" is a hold

An MC holds a step by taking its date off (the step menu's "Take the
date off", `rescheduleStepAction` with a null date). That used to write
`due_at = null` and nothing else, and a null date looks exactly like a
step waiting on its predecessor: the next recompute of the instance (a
sibling ticked, a sibling automated step finishing, the heal on a marked
instance, a resume) put the date back from the timing, and the executor
sent what the MC had held (Task 36 fix round 2, concern 4). The hold is
now recorded in `workflow_steps.due_held_at` (migration
`20261023700000`):

- Taking the date off sets it; setting a date clears it. An ad-hoc
  to-do added with no date is held from the start, so a recompute
  cannot date it from the step before it and show it overdue at once.
- `recomputeDueDates` (`lib/workflows/timing.ts`, `isHeld`) leaves a
  held step out of its patch, so every recompute path respects it:
  `recomputeInstance` after a tick, a skip, a reopen or a resume; the
  heal on any marked instance (a failed settle, a failed completion
  chunk, a failed completion check); the apply. It still gates the
  steps behind it, because it is pending.
- `_workflow_recompute_wedding_steps` (the SQL recompute when the
  wedding moves) skips it too.
- The engine never claims a held step (`workflow_claim_step`), even if a
  date reached the row by some other route. The MC's own Send now does,
  and lifts the hold as it claims.
- Ticking or skipping a held step clears its hold, so un-ticking it later
  brings it back as an ordinary step, not held and undated (Phase 6
  residual F4). The `workflow_steps_skip_and_hold_rules` trigger
  (`20261024300000`) does it for every writer. A branch skip keeps the
  hold, so a reopened branch brings the step back as the MC left it.
- The hold is per instance: applying the workflow again is a fresh
  enrolment and does not inherit it.

A date the MC types is not held: a later recompute can still move it, as
before.

Never do date arithmetic by hand here. Compose `zonedTimeToUtc`,
`localMidnight`, `addDaysToDateString` and `addMonthsToDateString` from
`lib/scheduling/timezone`. Adding 86,400,000 ms lands on the wrong day
across a DST boundary, and every fixture must carry a non-UTC case.

### The Wait step has one number

Owner rulings, 2026-09-27. A Wait used to carry the generic step timing
("after the step above, 2 days") as well as its own duration ("wait 1
day"), and the engine honoured both in turn, so the real delay was the
sum and the card showed two unrelated numbers. Now:

- **A Wait always starts straight after the step above.** Its timing is
  `{mode: 'after_previous', delayAmount: 0, unit: 'days'}` and its
  config is its only delay. The builder card has no When/offset block
  and no "Ask me before this runs" toggle for a Wait (a Wait sends
  nothing), and `timingChip` shows no chip for one.
- **One rule folds an offset in, never refuses.** `normalizeWaitStep` /
  `foldWaitConfig` (`lib/workflows/wait-step.ts`, re-exported from
  `step-config-validation.ts` beside the Task 33 check) run in the
  builder save (`upsertTemplateStepRow`), the step card (so a legacy
  Wait shows its whole delay), and both copilot writers (`add_action`,
  `update_action_config`). A duration Wait adds an `after_previous` or
  `apply_relative` offset to `durationMinutes` (a month counts 30 days;
  capped at the runner's one-year maximum); a duration Wait anchored to
  the wedding becomes a Relative date Wait ending at the same point; a
  date Wait keeps its config. `requires_approval` becomes false. The
  copilot's tool schema and prompt say never to send timing or
  approval on a Wait. The Turn on pre-flight is unchanged: it only
  checks config, and a normal Wait passes.
- **Data fix `20261024500000_workflow_wait_single_delay.sql`** applies
  the same fold (`public._workflow_fold_wait_config`, mirrored from
  `foldWaitConfig`) to every template Wait with an offset or the flag,
  and to live Waits that are `pending`, undated (`due_at` null), not
  held, and timed `after_previous`: their date is still to be computed
  from the timing, so the fold keeps the total exactly. **Live Waits
  that are already dated, asleep (`waiting`) or held are left
  untouched**, offset and flag included: folding without moving
  `due_at` would wait for the offset twice, and moving it would re-date
  a scheduled step. The engine still honours their offset, so they run
  exactly as before. Idempotent; only `type = 'wait'` rows.
- **Quiet hours** on a Wait read "hold until they end" (the default) or
  "ignored"; the options are "Hold until quiet hours end" and "Ignore
  quiet hours". The feed narrates a quiet-hours park as "held until your
  quiet hours end".
- **Wedding-anchored folds are approximate.** A Wait whose old timing
  was relative to the wedding becomes a Relative date Wait, so a late
  apply now skips it like any date Wait, along with a zero-delay step
  behind it. Months in that old timing fold as 30 days.
- **Modes.** The builder offers "A fixed amount of time" and "Relative
  date" (`relative_to_event`, before or after the event). A Relative
  date takes minutes, hours, days, weeks or **months**. Months are
  calendar months on the event's own date, clamped to the end of a
  shorter month (31 March minus 1 month is 28 or 29 February), then the
  same 09:00 as every other unit: `computeWaitWakeAt` in TS, and
  `_workflow_wait_relative_wake` (`20261024600000`) for the SQL
  recompute when a wedding moves, so the two never disagree.
  **"Until a specific date" is no longer offered** by the builder or
  the copilot (its model schema refuses `until_date`). Saved
  `until_date` Waits are untouched: they run unchanged, pass save
  validation and the pre-flight, read "Until <date>" on the card, and
  can be switched to a supported mode.

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

### Trigger filter chips must match `match()` exactly

Every "Only when" chip a trigger offers has to be read by that
trigger's `match()`, and every field `match()` reads has to have a
chip (or be a chip-set field written under a different key, such as
`invoice_due`'s required `days`). A chip with no effect in `match()`
reads as a broken app: the MC narrows an automation and it keeps
firing for everything. This is the rule the 2026-08-13 trigger sweep
enforced across all 34 shipped triggers, and it is checked for every
trigger in `tests/unit/app/workflows/trigger-filter-defs.test.ts`.

**`invoice_overdue` is the one deliberate exception worth calling
out** (Task 35, workflows audit M8): its chip list
(`INVOICE_OVERDUE_FILTERS` in `invoice-filters.tsx`) offers only
`daysOverdueMin` (required) and `isFinalBalance`, not the
"Days until the wedding" (`daysUntilEvent*`) chip every other
couple-shaped trigger offers from `EVENT_DATE_FILTERS`. That is
intentional, not an oversight: the `invoice_overdue` time-emitter
(`lib/automations/time-emitters/invoice-overdue.ts`) never joins the
couple's wedding date onto the event payload, so `match()` has
nothing to compare a `daysUntilEvent*` filter against. Enforcing it
would mean adding that join to the emitter first; until that lands,
removing the chip (and the config field, kept only as an inert
`.passthrough()` key so automations saved before the sweep still
parse) is the correct fix, matching every other trigger whose config
schema has no backing data. `.claude/docs/automations.md` (retired)
still describes the pre-sweep, unenforced version of this filter;
this doc wins where the two disagree.

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
the scheduler migration; renaming a live cron endpoint is a needless
outage risk). pg_cron calls it **every minute**
(`20261001200000_tick_every_minute.sql`; it was every 15 minutes until
2026-09-22, when "wait 15 minutes, then send" was observed landing 30 to
45 minutes late in production). It stays the sweeper: it owns the
time-based emitters, catches every event whose emitter does not kick,
and re-tries anything a kick dropped. The passes share one 45-second
deadline (`TICK_BUDGET_MS`), but the executor runs first on a 30-second
slice of its own (`EXECUTOR_BUDGET_MS`): a due step is what an MC is
waiting on, and nothing else in the tick may starve it. Work not reached
is left exactly where it was and the next tick takes it a minute later,
oldest first. The response and the `automations-tick` heartbeat both
carry `truncated` plus the pass counts (`stepsExecuted`,
`processedEvents`, `staleEvents`), so a tick that keeps running out of
time is visible on the Admin Scheduler card. They also carry
`failedPasses` (every pass the guard caught throwing) and `failedReads`
(reads that failed inside passes that carried on), so a tick that could
not read is never recorded as a clean one that found nothing to do. See
"A failed read is never nothing to do" below.

**The tick takes a lease before it does anything else**
(`acquire_scheduler_lease`, `supabase/migrations/20261003200000_scheduler_lease.sql`).
pg_cron fires every minute, but a run can take up to the 45-second
budget, so without a lease a slow run and the next minute's run would
both work the same due steps at once. A row with an expiry stands in
for a session advisory lock because pooled connections do not keep a
session for a lock to live on. A tick that does not get the lease
returns immediately (`{ skipped: 'another tick is running' }`).

**A finished tick releases the lease**
(`release_scheduler_lease`), from a `finally` so a throw on the way out
cannot skip it. That release is what keeps the schedule per-minute: the
120-second expiry has to outlast the longest tick, which also makes it
outlast the one-minute gap between ticks, so a lease left to expire
would refuse the next minute's run on a completely healthy system and
quietly halve the cadence (and, because the emitters only run when the
minute divides by fifteen, drop half the emitter windows with it). The
expiry stays, for the run that dies before reaching its release. That
costs one or two ticks rather than one: 120 seconds against a
60-second cadence always swallows the next tick, and swallows the one
after it as well when the run died early in its own minute. Acquire and
release both carry a per-run token, so a run whose lease expired
mid-flight cannot release the hold its successor has already taken.

Once the lease is held, each tick:

1. `sweepStuckSteps`: recover any step a dead function left claimed
   (`running`) past a 10-minute staleness window and error it, before
   anything else runs, so a step stranded by a previous tick is
   surfaced rather than staying invisible. See "When a step fails"
   below.
2. `advanceDueSteps`: run every step whose `due_at` has passed, and
   **chain**: after a step completes, any follower now due on the same
   instance (a zero-delay step behind a wait) runs in the same pass, up
   to `maxChainDepth` (25). "Wait 15 minutes, then send" is therefore
   one tick, not two. Each step is claimed **atomically**: `claimStep`
   calls `workflow_claim_step` (migration `20261023800000`), which moves
   the step to `running` only while it is `pending` or `waiting`, **its
   instance is still `active`**, and it is not held by the MC
   (`due_held_at`, see "Take the date off is a hold"). It takes the
   template row `for share` and then the instance row `for share`, the
   order Turn off, delete and resume take, so a pause or Turn off either
   lands first (the claim refuses) or waits for the claim (the step was
   genuinely claimed before it). Only the caller that gets `true` may
   run the step, so the tick, a manual "run now", and the immediate kick
   can all reach the same due step without racing or running it twice.
   A woken wait's finish (`workflow_finish_wait`) and its quiet-hours
   hold (`workflow_hold_wait`) are guarded the same way. "Its template
   is not off" needs no separate check: Turn off pauses the template's
   active instances in the same transaction as the flip, and a draft
   applied by hand goes live on purpose, so requiring the template itself
   to be `active` would stop those for good. All three are service role
   only.
3. `runTimeEmitters`, **on the quarter hour only**: compute what should
   fire now for triggers with no source-row change (`invoice_due`,
   `step_overdue`, …). Every emitter is day-granular, so 96 runs a day
   is already generous and the other 56 ticks an hour stay cheap. The
   pass gets a 10-second slice of its own (`EMITTERS_BUDGET_MS`),
   measured from when it starts rather than from the top of the tick,
   and the deadline is handed down into each emitter rather than only
   checked between them: `step_overdue` can walk thousands of rows with
   an RPC apiece, and being killed mid-pass costs the tick its heartbeat
   and its lease. Inside the emitter the deadline is a watch rather than
   a predicate (`watchDeadline`), so observing it is what records it and
   no stopping point can fail to report: a deadline landing among the
   rows of the final batch used to return a partial count and alert on
   nothing. Stopping fires `automation_overdue_scan_capped` with
   `reason: 'deadline'`, and the rest is picked up on the next quarter
   hour.

   **Registry order is a correctness property**
   (`timeEmitterRegistry`). `step_overdue` runs **last** because it is
   the only emitter whose work grows with the backlog, so it is the only
   one that can eat the whole slice, and it is also the only one that
   loses nothing by waiting: its day-bucket dedupe means an unfinished
   run carries on fifteen minutes later. The others fire on a date being
   exactly so many days out, so an emitter that never got its turn has
   missed that day for every couple it would have matched and nothing
   replays it. A pass that skips any emitter fires
   `automation_emitters_skipped` naming them, rather than only feeding
   the tick's `truncated` flag, which also means "dispatch has a backlog"
   and is ordinary.
4. `dispatchPendingEvents`: match bus events to active templates and
   apply them. Automatic applies dedupe per couple through
   `workflow_instances.dedupe_key` (see "One enrolment per couple"
   below): a second copy means a second set of emails. Before reading
   the bus it stamps every event older than 24 hours
   (`STALE_EVENT_MS`) as `skipped: stale` instead of applying it:
   production once replayed three months of June enquiries against
   workflows switched on in September, and a note nobody read for a
   day is history, not a trigger. Each batch it skips raises
   `workflow_events_stale` with the count (deduped to one per ten
   minutes, the suppressed count carried into the next alert) and
   stamps the `workflow-stale-events` heartbeat row, which the Admin
   Scheduler card shows as "N stale events skipped, <when>" (Task 36,
   audit M4). Before that, an outage over a day dropped every enquiry
   that arrived during it with no trace.

`advanceDueSteps` takes the oldest due steps up to a budget of 200
(`workflow_due_steps`, through `loadDueSteps`, which throws rather than
return an empty batch on a failed read), so its query refuses in SQL
everything `isExecutable` would refuse anyway:
manual types and anything held for the MC's OK. Both are due forever
until a person acts on them, and an MC carrying two hundred overdue
to-dos would otherwise fill every slot with work the engine cannot do
and never run another send.

Each pass is isolated, so one throwing does not cost the other its turn.

**Instances and quiet hours are read per pass, not per step** (Task 38,
`lib/workflows/pass-reads.ts`). Each due step used to cost its own
instance read before it ran, its own quiet-hours read inside the run and
another instance read when the pass checked for finished workflows: for
150 due steps, 300 instance reads and 150 template reads. A pass now
reads them in `in(...)` batches of at most 100 ids (every id rides in the
request URL, and an unbounded list once overflowed the gateway and
halted every tenant), looking ahead from the step being run: 5 and 3
reads for the same 150 fast steps, moving no more rows than the per-step
reads did. Four rules keep the batch honest:

- A failed batch throws the same `WorkflowReadError`, with the same site
  and message, and caches nothing. The step that asked counts it as
  before and the next step asks again, so it is never read as "that
  workflow is gone". A batch that succeeds without an id is the old null:
  the workflow no longer exists, and its step is skipped.
- An instance the pass ran a step on (or settled a lifted stop on) is
  invalidated and read again before its next use. The step merged its
  output into the instance's context, and the chain's follower and the
  closing completion check both need the new row.
- No batched row is used once it is older than `PASS_READ_FRESH_MS`
  (one second). A pause or Turn off pressed mid-pass can make a batched
  row stale, but it no longer lets anything run: the claim requires the
  instance to be active in the same statement (Phase 6 wave), so the
  step is refused as a lost claim and not counted. The window now costs
  refused attempts, not sends. A stop, an exit rule, a template delete
  and the account-wide stop cancel the steps, so the claim matches
  nothing either way, and the send gate re-reads the account stop.
- Each batch is sized from how fast the pass used the rows it already
  read: at that rate, how many will it use before they age? The first
  read of a pass asks for one row. Fast steps grow the batch to 100;
  steps of half a second settle at two rows a read, and steps over a
  second at one, so a slow pass never reads more often, or moves more
  rows, than one per step.

A failed closing completion read covers up to 100 instances, so the pass
marks those instances `needs_recompute_at` (best effort) and the heal
completes whichever are done on the next tick. A failure in one
instance's own check (its outstanding count, its step count, or the
completing write) is marked the same way, and alerted as
`workflow_step_unsettled` with the instance id and no step (Phase 6
review M1): its last step may just have finished, and nothing later
would finish it, so it would read "running" for good and hold its
dedupe key.

A manual run (Run now, approve and send, Try again) still reads its own
instance and quiet hours.

### A failed read is never nothing to do

Most engine reads used to destructure only `data`, so a database error
came back as an empty answer and the tick carried on as if there were
nothing to do, or acted on the wrong answer (Task 36, found during Task
2a's review of `advanceDueSteps`). Every read on the tick and emitter
paths now checks its error, and a failed one throws a
`WorkflowReadError` (`lib/workflows/read-failure.ts`). Where it lands
decides what happens:

- **A pass-level read** (the stuck-step sweep, the event batch, the
  account stops, the due steps) throws out of its pass. The tick's guard
  alerts `app_error` with the pass as `source`, and the heartbeat's
  `failedPasses` names it. The other passes still run.
- **A per-step read in the executor** (the instance, the chain's next
  step, the completion counts) is counted in `failedReads`, and the pass
  carries on with every other step. Nothing was claimed, so the step is
  still due and the next tick finds it. Throwing out of the pass instead
  would let one unreadable row halt every tenant behind it on every tick,
  the failure mode `loadDueSteps` was fixed for. A woken wait whose
  quiet-hours check cannot read stays asleep and is counted the same way.
- **A read inside a claimed step** (its context: the couple, the MC, the
  invoice, the contract, the trigger event, the quiet hours) marks the
  step errored with the message, before anything is sent, and is
  counted. A failed write of a step's outcome after its action ran says
  "This step ran but its result could not be saved. It may or may not
  have sent", the stuck sweep's own wording for the same uncertainty.
- **A read in dispatch** (the event's candidate templates, the
  appointment steps a booking completes, the template, timezone and
  wedding date an apply reads before it inserts) leaves the event
  unprocessed for the next tick and counts it in `readFailures`, like an
  exit failure. A bad event (anything that is not a read failure) is
  still marked seen so it cannot jam the queue. The stale sweep caps the
  retries, and now alerts.
- **An emitter read** throws out of that emitter; the emitter pass
  already records it as failed and alerts.

The tick raises `workflow_reads_failed` (deduped to one per ten
minutes) whenever `failedReads` or `readFailures` is non-zero. It is
**awaited** before the heartbeat, inside the tail the tick keeps for
what is in flight (Phase 6 review I2): a Slack post still running when a
Vercel function returns may never land. The transport's 3-second
timeout bounds it, and the ten-minute quiet window starts only once a
post has landed (`sendAlert` resolves whether it did), so a lost post
does not silence the next ten minutes too. The heartbeat records
`failedReads` and `failedReadSite`, and the Admin Scheduler card shows
"N failed reads in the last tick, first at <site>", so a failed read is
on screen even when Slack is down. A whole pass failing (`app_error`
from the tick's guard) is awaited the same way.
`recomputeInstance` is now strict on every call: it used to be strict
only for the skip paths, and a quiet failure elsewhere left the follower
of a finished step undated for good, or dated it from a wedding date
that read as missing. The full list of sites and the verdict on each is
in `.superpowers/sdd/2026-09-23-workflows-trust-remediation/task-36-report.md`.
The few left unchecked are writes or display-only reads whose failure is
backstopped elsewhere, each with a why-comment at the site.

Failed reads carry an MC-facing message by default ("Zebri could not
reach the database. Try again in a moment.", or for a step's context
"Zebri could not read the details this step needs, so nothing was sent.
Try again."). The database's own text stays on `dbMessage` for logs and
alerts (review M3). `workflow_reads_failed` names the first failing
read's `site` (review M2).

**A step that finished never strands the steps behind it** (fix round
1, review I1). A step's completion is one guarded write; what follows it
(merging its output, skipping the branch not taken, the audit rows,
re-dating the followers, completing the instance) is separate
statements. A failure there used to reach `run`'s catch, whose
`markErrored` matches nothing on a `done` row, so the followers kept a
null `due_at` for good behind a green tick. Now
`settleAfterCompletion` catches it, alerts `workflow_step_unsettled`
with the instance and step ids (deduped per instance), and the step
counts as run but `unsettled` (a failed read on the heartbeat). The same
wrapper covers a woken wait, a manual tick (`completeStep` returns
`unsettled` rather than throwing, since the tick did land) and the
instance completion after Run now.

The failure also **marks** the instance: `needs_recompute_at` is stamped
(migration `20261023500000`). If that write fails too, the alert says
`marked: false`, because the heal will not find the instance.

The tick then **heals** it: `healStrandedInstances` (`lib/workflows/heal.ts`)
runs before the executor, reads `workflow_stranded_instances`, which
names active instances carrying a **due** marker and nothing else, and for
each one merges any missing step output, skips everything under each
finished branch's losing side (both sides of a skipped branch), re-dates,
completes the instance if nothing is left, and clears the marker it read
(guarded on that value, so a newer failure mid-heal keeps its stamp).

Step outputs are merged **in SQL** (`workflow_merge_step_outputs`,
migration `20261023900000`), by the executor after each finished step
and by the heal. Both used to write the whole `context` back from the
row they had read, so a second writer's output (a kick pass beside the
cron pass, the MC's Run now beside the tick, the heal beside either)
that landed in between was erased for good (Task 38 review M2, Phase 6
review M3). One UPDATE now merges into whatever the row holds when it
runs; the executor's key wins, and the heal only fills keys that are
still missing.

Marker hygiene (Task 36 re-review 2, N10, migration `20261024000000`):
an instance that completes or is cancelled has its marker cleared by a
trigger, whoever finished it (a paused one keeps it). And a heal that
fails pushes the instance's marker five minutes ahead
(`HEAL_RETRY_BACKOFF_MS`); the finder names only markers that are due,
so an instance whose heal keeps failing is retried on that backoff
instead of being named first on every tick, ahead of every instance
behind it.

It heals marked instances only (fix round 2, re-review N1). It used to
infer strands from the shape of the steps (an undated follower of a
finished step), and a step whose date the MC took off to hold it has
exactly that shape: the heal put the date back within a minute and the
executor sent what the MC had held. Shape is not evidence; the marker
is. So a held step is never re-dated by the heal, and the first tick
after the deploy touches nothing, since no marker exists yet. A strand
left before the deploy stays as it is today, for a person to judge.

It is keyset paged, 50 instances a page, at most 4 pages a tick, and it
has its own slice (`HEAL_BUDGET_MS`, 10 seconds from the tick's start,
carved out of the executor's): past it, no further instance starts, and
the rest keep their markers for the next tick. Its own read throws (the
guard alerts); one instance that cannot be healed is counted, keeps its
marker (deferred by the backoff above), and is retried. A paused
instance keeps its marker until it is active again.

An un-tick is marked like any other failure, and the heal's recompute
does re-gate the steps behind a reopened step (it writes null for a
gated step). But that is a tick away at best and a follower already due
could send first, so the action also says so ("Tick and untick it again
to retry").

**Skipping a branch side takes everything under it** (fix round 2,
re-review N3). The losing side used to be skipped one level deep, so a
branch nested there became `skipped` with both of its own lanes still
pending, and both were dated and ran. Every skip of a side now goes
through `skipBranchSide` (`lib/workflows/branch-skip.ts`), which follows
`descendantsOf` from `apply-skips.ts`: the executor when a branch picks
a lane, the heal redoing that, and "Skip this step" on a branch step,
which takes both lanes because a skipped branch chose neither. And
`recomputeDueDates` dates a lane head only from a parent that is
`done`, never from a skipped one.

"Skip this step" on a branch writes **one** timeline line: its own
`step_skipped {manual: true}`. The lanes going with it no longer add a
second "Skipped: <branch> (branch skipped)" row for the same step
(`skipBranchSide`'s `audit: false`, Task 36 re-review 2, N9).

**Reopening a branch brings its lanes back** (N8). Un-ticking a skipped
or finished branch puts every step **the branch logic skipped** under
it, at any depth, back to `pending` and undated (its branch is pending
again, so nothing is released). Steps that finished keep their record.
The branch skip (`skipBranchSide`) writes `skip_reason = 'branch'` on
what it skips, and only those come back (Phase 6 residual F3). A step
the MC skipped by hand, or one a resume or an apply skipped because its
time had passed, carries no reason and stays skipped: restored, a past
wedding-relative step would be dated in the past once its lane was
taken and send at once, the late send the resume rule exists to stop.
Steps skipped before the column existed (including the N7 data fix's)
carry no reason either, so they stay skipped on a reopen; the MC can
reopen one by hand. When the branch
runs again it skips the side it does not take, as always; before this,
a reopened branch's lanes stayed `skipped`, which is terminal, so the
winning lane of its next run did nothing.

Branches the MC skipped **before** this deep skip existed were left with
their lanes `pending` (N7). The first recompute after the deploy
un-dates those lane heads (correct), but nothing skipped them, so the
instance read "running" for good. Migration `20261024100000` is the
one-off data fix: it skips them, writes one `step_skipped` row per
branch (`via: deploy_fix`) and marks the active instances so the heal
completes the ones with nothing left. See "Deploy notes: Phase 6".

**The MC always gets a sentence** (fix round 1, review I2). Every step
action (tick, skip, untick, retry, approve, preview, the detail load,
apply) and the manual send's context read catch at their boundary and
return `{ ok: false, error }` through `actionFailureMessage`
(`lib/workflows/action-failure.ts`): a read failure's own MC-facing
message, or "Something went wrong. Try again in a moment." plus an
`app_error` alert for anything unexpected. The send-template route
answers JSON 500. Every mutation calling them toasts the message
(`useActionErrorToast`); the step detail modal shows it inline, as it
did. Send & complete that sent the email but could not finish the step
succeeds with the notice "Sent. Finishing the step failed; it will
retry." and closes, so a second press is not needed; the heal finishes
it.

**An apply that fails after its instance exists** is cancelled as
`setup_interrupted` as before, which the couple's Stopped strip shows as
"Its setup did not finish ... Start it again instead", and now raises
`workflow_apply_failed` (ids only, deduped per workflow). An insert that
failed outright wrote nothing, so it throws as a read failure and the
dispatcher retries the event.

### When a step fails

Most failures are a provider having a bad minute, not a reason to stop
the whole workflow (everything gated behind a step keeps a null
`due_at` until it completes). `handleFailure` in
`lib/workflows/executor.ts` gives a step **three attempts**
(`MAX_ATTEMPTS`) before burying it: the first failure reschedules it 1
minute out, the second 5 minutes out, and the third is final. The step
is marked `errored` and `workflow_step_failed` fires so the MC knows to
look. `RETRY_DELAY_MS` holds a third entry of 15 minutes that nothing
reaches while the cap is three; it is there so raising the cap
lengthens the backoff rather than silently reusing the last delay.

**The backoff lives in `due_at` and nowhere else**, so the recompute
that runs after any step transition deliberately skips a `pending` step
with `attempt_count > 0`. Without that skip, a sibling completing
rewrote the failed step's due date back to its template anchor, which is
in the past, and the next tick retried immediately: all three attempts
inside a minute or two instead of spread over six. The database-side
recompute (`_workflow_recompute_wedding_steps`, fired when a couple's
wedding date moves) carries the same exclusion; keep the two in sync.

**A sleeping wait owns its wake time.** A `wait` step's template timing
says when the wait *starts*; when it starts, `evaluateWaitAction`
writes the wake time (start plus the configured duration) into
`due_at` and parks the step in `waiting`. Neither recompute rewrites a
`waiting` row (`20261007000000`). Before that, both re-derived a
sleeping wait's `due_at` from its timing, which threw the duration away:
ticking any sibling to-do ended a three-day wait at the next tick and
sent the step behind it days early. The one sleeping wake that does
move is a `relative_to_event` wait ("until 7 days before the wedding")
when the wedding moves: the database function re-derives it from the
wait's own config (`_workflow_wait_relative_wake`, 09:00 UTC on the
anchor date plus or minus the amount, calendar months clamped to month
end for `months` since `20261024600000`, which is what
`computeWaitWakeAt` resolves on the production runtime), and leaves it
alone when the wedding date is cleared.

That re-derived wake is unshifted, so it can land inside the MC's quiet
hours even though the executor pushed the original wake out of them. The
executor therefore checks quiet hours again **at the moment a sleeping
wait wakes** (`quietHoursHoldUntil`, `lib/workflows/execute-step.ts`,
the same window the wake computation uses): inside the window, the wait
is re-parked to the window's end with a `step_waiting` /
`quiet_hours` audit row instead of finishing and releasing the send
behind it. The re-park is always outside the window, so it cannot loop,
and it is guarded on the row still being `waiting` with the wake the
caller read, so two callers waking the same wait re-park it once. If the
check cannot run (building the step context throws), the wait is left
exactly as it is for the next tick: not finished, since that could send
inside quiet hours, and not errored, since that strands the workflow.

Waits the old rewrite left `waiting` with a null `due_at` are repaired on
deploy by `_workflow_repair_stranded_waits()` (`20261007000000`). A wait
whose previous step is open again goes back to `pending`; a `duration` or
`relative_to_event` wait gets its wake re-derived from its own config
when that wake is still in the future; anything else is left alone and
flagged with a `step_waiting` / `wake_lost` audit row the feed narrates
("its timer was lost in an update; skip it to carry on"). The repair
never makes a wait due now.

**Every automated send carries an idempotency key**, built the same way
by every send path through `lib/email/idempotency.ts`: `<step
id>:<recipient>:<fingerprint of what is being sent>`. The fingerprint is
taken from the configured subject and body rather than the rendered
output, so a retry of an unedited step keeps its key while an edit mints
a new one and a correction still reaches the couple. The key is per
recipient, not per step: a run sheet going to four vendors is four
different messages, and one key for all of them would leave three
vendors with nothing.

**There is one way to send, and a gate that enforces it.** An action
mailing from the shared Zebri address calls `sendAutomationEmail`
(`lib/email/automation-send.ts`), which owns the key, reads the result
and answers whether a retry is safe. An action that resolves its own
sender, which today is only `send_email` reaching an MC's connected
mailbox, calls `dispatchEmail` directly. Nothing else may touch a
provider: `scripts/check-no-direct-email-send.mjs` fails the build when
anything outside `lib/email/dispatch.ts` imports the Resend SDK or posts
to the Gmail or Graph send endpoints, and it runs in CI beside the
service-role guard.

That gate exists because this went wrong three times. Each round of
review found more actions that had gone straight to Resend, and each of
them had quietly dropped the same three things: the key, the result
check, and the retry verdict. A send with none of those turns one
timed-out request into three copies in a couple's inbox. Writing a new
email action is exactly the moment somebody reinvents it, so the build
now says so, and names what to use instead.

**The key only means something to Resend.** An MC sending from their own
connected Gmail or Microsoft mailbox goes through a transport with no
equivalent, and the failures a retry most wants (a thrown request, a
timeout) are exactly the ones where the mailbox may have accepted the
message and only the response was lost. Ask
`transportDeduplicates(sender)` (`lib/email/dispatch.ts`) before
treating any retry as safe. The pre-composed six always send from the
shared Zebri address, so they are always on Resend.

**A retry is only offered when the action says a repeat is worth it.**
An `ActionResult` error carrying `recoverable: false` is buried on the
first attempt. Two cases use it. One is a configuration error only the
MC can fix: a missing review link, an unwired action, a saved email
template that is gone. The other is a send whose transport cannot
deduplicate, where retrying would put a second and third copy in the
couple's inbox. The distinction is about whether a repeat can do better,
not about whether something went wrong: a template read that failed on
the network stays retryable, because it says nothing about the
template.

A step still `running` past a 10-minute staleness window is a different
case, not a retry: the function that claimed it is presumed dead, so
`sweepStuckSteps` errors it directly rather than rescheduling, because
it genuinely does not know whether the send left. The sweep writes its
own `step_errored` audit row with `detail.reason = 'stuck_sweep'`, so a
transition nobody chose still leaves a trace.

**Every write after a claim is guarded on still owning the step**, and
so is everything that follows from it. A completion that no longer finds
the row `running` (the sweep got there first) writes no output, skips no
losing branch, logs no `step_completed` and triggers no recompute: the
audit log has to agree with what the MC sees on the step, and a skipped
branch is permanent.

**A manual "Try again" resets `attempt_count` to 0**: the MC retrying
by hand is a fresh start, not the fourth try of the same run
(`app/(dashboard)/workflows/instance-actions.ts`). Try again, and
approve-and-send, are refused unless the workflow is running: on a
paused or stopped one they would clear the gate or re-queue the step,
and it would go the moment the workflow came back. Un-ticking a step
from the Done strip resets it too, for the same reason and because the
recompute would otherwise leave the step frozen on an old retry date.

### A buried step holds up everything behind it

**This is intended, and it is the thing most likely to generate a
support question.** An `errored` step never completes, and a step timed
`after_previous` keeps a null `due_at` until its predecessor completes.
So every step behind a buried one in the same lane waits, indefinitely,
until the MC opens the step and presses Try again. The instance stays
`active` rather than completing, and the couple's checklist still shows
it, which is how the MC finds it.

Two reasons it stays this way. A sequence usually means what it says
("send the invoice, then chase it a week later"), and running the chase
for an invoice that never went out is worse than running nothing. And
skipping past a failure would hide it: the workflow would look like it
finished.

What changed in September is the frequency, not the rule. Several
actions could not report a failure at all before, because they awaited
the provider and discarded the result, so a rejected send left a green
step and the rest of the sequence carried on regardless. Now that they
report properly, a bad send address or an unverified domain stalls the
rest of the sequence instead of silently carrying on. **If an MC asks
why a workflow "stopped halfway": look for an errored step above the
one they are waiting on, fix what it reports, and press Try again,
which releases everything behind it.** `workflow_step_failed` fires on
every burial, so the Slack feed has it too.

### One enrolment per couple

`workflow_instances.dedupe_key` stops the same template applying twice
to the same couple. `instantiate.ts` used to check-then-insert, which
two bus events landing in the same tick could both pass, opening two
instances and sending every email twice. A partial unique index on
`(couple_id, dedupe_key) where dedupe_key is not null and status <>
'cancelled'` closes it in Postgres instead
(`supabase/migrations/20261003000000_workflow_instance_dedupe_key.sql`).

The writer stamps `dedupe_key` with the template id only when the
template does **not** allow re-apply and a `couple_id` is present;
otherwise it is left **null**, and null never collides with anything.
A personal instance, an ad-hoc apply, or a template with
`allow_reapply` set all get a null key on purpose: those enrolments
are legitimately allowed to repeat.

Two watchers read the heartbeat (`TICK_STALE_MS`, 5 minutes):
`tick_watchdog()` in Postgres posts to Slack through pg_net every 5
minutes the tick is down (hourly dedupe, one "back" post on recovery)
and keeps working when the app itself is unreachable; the hourly digest
raises `cron_job_missed` through `sendAlert()`. Details in
`.claude/docs/cicd.md` "Health".

The time emitters ask which lead times anyone configured through
`loadActiveTriggerConfigs` (`lib/workflows/trigger-configs.ts`), which
reads active `on_event` templates. Before the cutover that question was
answered by the `automations` table.

### Pausing and resuming an enrolment

An applied workflow can be **paused** (`workflow_instances.status =
'paused'`, `20261007000000`): the reversible stop, beside the permanent
one (`cancelled`). `pauseInstanceAction` moves `active` to `paused` and
nothing else; `resumeInstanceAction` brings back `paused` or
`cancelled`, and refuses anything else rather than reporting a phantom
success. Both are RLS-scoped, and both write an audit row
(`instance_paused`, `instance_resumed`) the couple's feed narrates.
Stop this workflow and Stop everything end a paused workflow too.

The executor needed no change: its due query and every per-instance
guard require `active`. A paused workflow's manual to-dos leave the
Upcoming queue (it filters `active`) and stay on the couple's tab with a
**Paused** pill, which is where it is resumed. The wedding-date
recompute keeps paused instances in step with the wedding.

**Resume never sends a backlog.** Everything that came due while the
workflow was not running would otherwise go on the next tick at once.
Before the instance is flipped back (skip first, flip second, so no
tick can land in between), `settleOverdueForResume`
(`lib/workflows/resume.ts`) walks the steps:

- an `action` the next tick would run is **skipped**, with a
  `step_skipped` audit row whose reason reads "its time passed while
  the workflow was paused" (or "stopped");
- a `wait` already asleep whose wake time passed is **completed**;
- whatever those release with a zero delay is skipped too, since it was
  meant to go at the same moment; anything with a real delay anchors to
  the resume and runs when that comes;
- a `branch` the next tick would run is **skipped together with every
  step under it**, on both lanes and at any depth, with future-dated ones
  included (reason "with its branch, whose date had passed"). Left alone
  it would run and its zero-delay lane would send; skipped on its own it
  would release both lanes, since a lane's head anchors to the branch's
  completion whatever its status;
- a `wait` that came due but had not started, and whose own date
  (`relative_to_event` or `until_date`) had passed at the resume, is
  **skipped** (`isPastWait`): started late it would finish at once and
  release the send behind it;
- a held send (`requires_approval`) is left for the MC, and any other
  unstarted wait runs on the next tick and counts from the resume.

**It fails closed.** Every read and write the settle makes throws on an
error (the steps, the instance, the wedding date, each skip, and the
recompute that dates what a skip released), and `resumeInstanceAction`
then returns an error **before** the flip, undoing a stopped workflow's
restore, so the instance stays paused or stopped and nothing sends. Zero
rows because another caller got there first is still a normal no-op.

Skip rather than reschedule because a wedding-relative step cannot be
moved "from the resume moment": its date is fixed to the wedding. It is
also what apply does with a past-dated step, so the MC sees one rule
for one problem. If the skips leave nothing outstanding the workflow
completes.

### Turning a workflow off pauses its couples

Any move of a template to `draft` or `archived` (`setTemplateStatusAction`)
pauses every `active` instance of it, marked `paused_reason =
'template_off'` (`20261008000000`), with an `instance_paused` audit row
whose detail names the workflow. The feed reads "Workflow paused: X (X
was turned off)".

- **One transaction.** The flip and the pause run together in
  `set_workflow_template_status` (`20261008100000`, replaced by
  `20261023600000`: service role only, called after the action's RLS
  ownership check, and scoped to the owner's instances). If the pause
  fails the switch stays on, and the MC's retry is real.
- **Unconditional.** The sweep runs on every move to off, not only
  active to off. It is idempotent, so pressing Turn off again repairs a
  template whose couples are still running (a template turned off
  before this existed, for example).
- **No late enrolments.** A BEFORE INSERT trigger on
  `workflow_instances` refuses an event-driven enrolment
  (`trigger_event_id` set) on a template that is not `active`, with
  SQLSTATE `WF001`. It reads the template `for share`, so it waits on
  an in-flight flip: either the insert sees the flip, or the sweep sees
  the insert. `applyTemplate` maps `WF001` to `skipped: 'template_off'`
  and the dispatcher counts it in `skippedOffTemplates`: a quiet skip,
  not an error. Manual applies of a draft stay allowed.
- A step already claimed by a tick when the switch lands finishes; only
  the steps after it stop.

`pauseInstanceAction` marks its pauses `manual`; `resumeInstanceAction`
clears the column. Turning a template back on resumes nothing by
itself. Its confirmation offers "Resume the N couples paused when this
was turned off" (unticked), and only `template_off` instances resume,
each through `resumeInstanceAction`, so what fell due while it was off
is skipped, not sent. A `manual` pause is never touched. A resume that
fails part way returns `stillPaused`, and the UI says how many couples
are still paused.

Both switches (the canvas header's `CanvasStatusToggle` and the library
card) go through `useTemplateStatusChange`, which asks the server
(`countTemplateEnrolmentsAction`) at the moment of the click, is busy
while it does, and ignores a second click in flight. At 0 the change
applies with no dialog. The copy is about this workflow and these
couples only; the account-wide stop is a separate control.

### The account-wide stop

One switch that stops every automated workflow step on the MC's
account: Settings, Account, "Workflow automation", and the "Pause all
workflows" button in the Workflows page header. While it is on, a
warning banner stays under the Workflows title with a one-click
**Resume all**. Both directions confirm (`AccountPauseDialog`), and the
copy says this is every workflow for the whole account, automated
invoice and contract steps included, and that invoices and contracts
the MC sends by hand still go. A failed read of the stop shows an
error, never the "running" controls.

- **Storage.** `user_public_settings.workflows_paused_at` and
  `workflows_resumed_at` (`20261009000000`). Stopped means `paused_at`
  set and `resumed_at` null. A missing row is running. Written only by
  `pauseAccountWorkflowsAction` / `resumeAccountWorkflowsAction`
  (`app/(dashboard)/workflows/account-pause-actions.ts`) through the
  caller's RLS client.
- **Separate from instance pauses.** It never writes
  `workflow_instances.status`. Lifting it leaves a couple paused on its
  own (Task 16) or by Turn off (Task 17) paused, and resuming one couple
  does not lift it.
- **Executor.** `advanceDueSteps` reads every stop once per pass
  (`loadAccountPauses`, paged past the API's 1000-row cap, and it
  throws on a failed read so nothing runs unchecked); that set drives
  the lifted-window rule. A stopped MC's steps are excluded in the due
  read itself, in SQL: `loadDueSteps` (`lib/workflows/due-steps.ts`)
  calls `workflow_due_steps` (`20261014000000`), which leaves out every
  stopped account with a `not exists` on `user_public_settings`. Their
  backlog can never fill the 200-step batch and starve other tenants:
  no claim, no write, no count. The scoped kick returns at once for a
  stopped MC. The chain uses the same set.
- **Never an id list in the URL.** The due read once sent every
  stopped MC's id as `user_id not in (...)` in the request URL. Past
  about two hundred stopped accounts the URL outgrew the gateway limit,
  the read failed, the error was dropped, and the tick reported a clean
  pass with zero steps: every tenant halted in silence. The stop now
  lives in SQL, and `loadDueSteps` throws on a failed read, which the
  tick's `guard('workflows.executor')` alerts on. A stop pressed after
  the due read and before a step runs is caught by the send gate below.
  Regression: `tests/integration/workflows/due-steps-many-stops.test.ts`
  (300 stopped accounts).
- **Send gate backstop.** `openAutomationSend` / `sendAutomationEmail`
  and `send_email` read the stop on every automated send
  (`readAccountPause`). A stopped MC gets a `sleep` with reason
  `account_paused`, due now, never an error, so a step the executor
  claimed a moment before the stop is neither sent nor buried. A failed
  read is `check_failed` (retryable). Feed: "Waiting: X (held while all
  workflows are paused)". `send_contract`, `send_invoice` and
  `trigger_payment_reminder` send outside the gate
  (`sendContractEmail` / `sendInvoiceEmail`), so they make the same
  check at the top of the handler (`accountStopHold` in
  `lib/automations/actions/documents.ts`), before the share token is
  switched on or `email_sent_at` stamped.
- **Lifting.** Stamps `workflows_resumed_at` only. The executor skips
  lazily: when it meets an action, a branch, an already-sleeping wait,
  or an unstarted wait whose own date had passed at the lift, whose
  `due_at` fell inside `[paused_at, resumed_at]` AND whose row was last
  written at or before `resumed_at` (`isLiftedPauseBacklog`, asked
  through `isAccountPauseBacklog` so the executor and the settle agree
  exactly), it calls `settleAccountPauseWindow`
  (`lib/workflows/resume.ts`) on that instance. That is the resume rule
  limited to the window: in-window actions skipped ("its time passed
  while all workflows were paused"), in-window branches skipped with
  their subtree, past date-waits skipped (judged at the lift moment),
  in-window sleeping waits completed, and anything the release makes due
  on the spot that would send skipped too. A settle that throws defers:
  the step that led to it is not run, nothing more runs on that instance
  in the pass, and the next pass settles again. A step due after the lift
  runs, and so does a step given a date inside the window after the lift
  (a wedding date added later, say): `workflow_steps_set_updated_at`
  stamps every UPDATE and the recomputes write only rows whose `due_at`
  changed, so `updated_at` tells the two apart. To-dos are never
  skipped. A stop pressed again while the last window still has
  unskipped steps (same test, excluding steps held for approval) keeps
  the old `paused_at`, so the new window covers that backlog. If that
  check cannot be read, the old `paused_at` is kept too: the stop still
  goes on, and the old backlog is never stranded.
- **Dispatcher.** Keeps enrolling, so new couples get their workflow and
  their to-dos; nothing automated runs until the lift, and early steps
  are then skipped by the window rule.
- **Manual acts pass.** `runStepNow` (Send & complete, Try again) sets
  `ctx.manualRun`, which the gate and `send_email` let through. The step
  modal shows an info callout saying so while the stop is on.
- **Alert.** `workflows_account_paused` (warn) on each pause and lift.

Scheduled paths checked: the executor's due loop, its post-claim
chain and the scoped kick (all `advanceDueSteps`); woken waits run
inside that loop (there is no separate `wakeDueWaits` any more); the
stuck-step sweep only marks rows errored and sends nothing; the time
emitters and `step-overdue` only emit bus events; the dispatcher only
enrols. None of the other crons (`booking-reminders`, `workflow-digest`,
`expire-contracts`) run workflow steps.

### Past-dated steps do not fire on apply

Applying a long wedding-relative workflow to a couple whose wedding is
close used to fire every step dated before today on the next tick
(Dubsado's retroactive-fire gotcha). `applyTemplate`
(`lib/workflows/instantiate.ts`) now:

1. inserts the instance as `paused` with a null `paused_reason`, so the
   executor ignores it while it is built;
2. inserts and dates the steps, and writes `instance_created`;
3. re-checks the instance is still building; if something stopped it
   meanwhile (an exit rule, a delete, the interrupted-apply sweep), the
   steps inserted after the stop are marked `cancelled` and the apply
   returns `{ error, skipped: 'stopped' }`;
4. runs `settlePastOnApply` (`lib/workflows/resume.ts`), the resume
   rule scoped to steps whose own timing is `wedding_relative` and whose
   `due_at` is before `applied_at`. Each such **action** is `skipped`
   with a `step_skipped` audit line, reason "its date had already
   passed when this workflow was started"; each such **branch** is
   skipped with its whole subtree (reason "with its branch, whose date
   had passed"). The release cascade is the resume one: a zero-delay
   `after_previous` follower of a skipped step is skipped too (a send, a
   branch with its subtree, or a past date-wait); a follower with a real
   delay is dated from the skip. Any read or write that fails throws, and
   the apply abandons the instance rather than let it go live half
   settled;
5. flips it live through `activate_applied_workflow_instance`
   (`20261010000000`). A flip that finds the instance no longer building
   returns null, and the apply reports `{ error, skipped: 'stopped' }`:
   the picker does not say "started", and the dispatcher does not count
   an opened enrolment.

Never skipped: a step timed from the apply or from its predecessor (the
"send the welcome email immediately" case, even when a zero-day offset
resolves to a midnight before the apply), a to-do (a past-dated to-do
stays for the MC to see), a step held for approval, a `duration` wait, a
branch timed from the apply or its predecessor (unless a skip released
it), and anything on a couple with no wedding date (its due date is
null).

The flip agrees with a concurrent Turn off: the sweep only pauses
`active` instances and cannot see one mid-apply, so the function
re-checks the template under `for share` and, when it is no longer
active, leaves the instance paused as `template_off` (with the same
"was turned off" audit line the sweep writes) for Turn on to offer.
That check applies to an event-triggered apply and to a manual apply of
an active workflow; a draft applied by hand goes live unless it was
archived since the apply loaded it (`p_loaded_status`), in which case it
is left paused as `template_off` the same way. The function locks the
template `for share` first and the instance `for update` second, then
re-checks the instance is still building: the one lock order every
workflow RPC takes, so it cannot deadlock against a delete.

A `wait` can be past too, whatever its own timing: "wait until 60 days
before the wedding" is usually timed straight after the apply and keeps
its date in its config. On an apply only, a due, not-yet-started wait
whose config wake (`relative_to_event` or `until_date`, via
`computeWaitWakeAt`) is before the apply is skipped with the same
reason, in the first pass and in the cascade, so the send behind it
never goes out early. A `duration` wait still sleeps from when it
starts.

An apply that fails part way cancels its half-built instance
(`abandonApply`, `lib/workflows/interrupted-applies.ts`), which releases
the couple's `dedupe_key`; the feed reads "Workflow stopped: X (its
setup did not finish)". An apply that died (crash or timeout) is caught
by the tick: `sweepInterruptedApplies` runs next to `sweepStuckSteps`
and cancels every instance still `paused` with a null `paused_reason`
and `applied_at` over 10 minutes old. `manual` and `template_off`
pauses are never touched. `resumeInstanceAction` refuses a paused
instance with a null reason: that is an apply in progress. When the
switch catches an apply mid-build, `applyTemplate` returns
`pausedReason: 'template_off'` and the dispatcher counts it in
`skippedOffTemplates`, not `openedInstances`.

Every template-to-instance copy goes through `applyTemplate`: the
couple tab's picker (`applyTemplateToCoupleAction`) and the dispatcher.
Nothing else instantiates a template (the AI copilot edits templates
only, and there is no bulk apply).

### The Start preview shows the calendar first

Start (and "Start again") in the couple tab's picker no longer applies
on the spot. It opens a preview in the same modal: every step with the
date it will run for this couple, in the MC's timezone, and a line up
top saying how many steps will be skipped because their dates have
passed. Each of those rows reads "Date already passed, will be
skipped". A couple with no wedding date gets a callout that
wedding-dated steps will wait until one is set. Only **Start workflow**
applies; **Back** returns to the list. "Start again" still asks the
second-copy question before applying.

The data comes from `previewApplyAction` (`instance-actions.ts`), which
reads the template's enabled steps, the couple's wedding date and the
MC's timezone through the caller's RLS client and writes nothing.

The preview cannot drift from the apply. The skip rule and its release
cascade live once, as a pure plan, in `lib/workflows/apply-skips.ts`
(`planApplySkips`). `settlePastOnApply` (`resume.ts`) writes that plan
to the new instance; `projectApply` (`lib/workflows/apply-projection.ts`)
turns the same plan into preview rows. `isExecutable` moved to
`lib/workflows/executable.ts` (the executor re-exports it) so the plan
can use it without an import cycle. A unit test feeds one workflow to
both and asserts they skip the same steps
(`tests/unit/lib/workflows/apply-skips-agreement.test.ts`), and an
integration test checks the preview against a real apply.

### Stopping a workflow marks its steps cancelled

Every way a workflow stops (Stop this workflow, Stop everything,
deleting the workflow, an apply that failed, the tick's sweep for an
apply that died) flips the instance to `cancelled` and records why in
`workflow_instances.cancelled_reason` (`20261011000000`): `manual`,
`template_deleted`, `setup_interrupted`, or `exit_rule` (the couple
moved into one of the workflow's exit stages; see "Exit rules"). Rows stopped before the column existed stay null.

In the same statement, the trigger `workflow_instances_cancel_steps`
marks that instance's `pending` and `waiting` steps `cancelled`. A
trigger rather than a second write in each caller, so no stop path can
forget it or half do it. `running` is left alone (an in-flight send
finishes, the Turn off rule), and `done`, `skipped` and `errored` are
history. The migration also marks the open steps already sitting on
cancelled instances.

A `cancelled` step:
- never runs: `isExecutable` and the executor's `TERMINAL` set refuse
  it, so "send it now" refuses it too, and the due query reads only
  `pending` and `waiting`;
- is never re-dated: `recomputeDueDates` treats it as terminal and it
  releases nothing behind it, and the SQL wedding recompute touches
  `pending` only;
- is neither done nor an error: the couple tab's buckets and the board's
  progress leave it out, and its row reads **Cancelled** (neutral pill),
  never "Failed".

**Resuming a stopped workflow** (`resumeInstanceAction`, order in
`lib/workflows/resume-stopped.ts`): its `cancelled` steps go back to
`pending` and are re-dated from today's data (nothing kept a stopped
workflow's dates current, so a wedding moved while stopped would
otherwise be judged by the old date), then the usual
`settleOverdueForResume` skips whatever went overdue, then the instance
flips to `active` and `cancelled_reason` clears. The instance stays
cancelled until that flip, so no tick can send a restored step before
it is judged. A step that was a sleeping `wait` comes back unstarted and
waits its full time from the resume: later than planned, never
retroactive.

Resume refuses, with the reason (`lib/workflows/resume-eligibility.ts`,
shared with the couple tab):
- `setup_interrupted`: its steps may be incomplete;
- any instance whose template is gone (`template_id` null), whatever the
  reason: a workflow stopped by hand and deleted later keeps `manual`,
  because the delete sweeps only running and paused couples;
- any instance whose template is not `active`: "Turn this workflow on
  first, then resume it." Turning the workflow back on (with its resume
  option) is what brings back the couples Turn off paused;
- a paused instance with no `paused_reason` (an apply still building);
- a stopped workflow whose template was started again on the couple
  since (`hasLiveTwin`, the dedupe index's rule as a pure function; the
  couple tab shows **Running again** instead of Resume from the same
  rule). Checked before anything is written; a unique violation on the
  flip, the race, is mapped to the same words and the restore undone.

The flip itself is `resume_workflow_instance(p_instance_id, p_from)`
(`20261011100000`, `security invoker`): it reads the template `for
share` (the same pairing as the WF001 guard), then locks the instance in
its `p_from` state, and flips to `active` only while the template is
`active`, so a Turn off landing between the check and the flip still
wins. It refuses, in SQL too, a paused instance with no reason and a
`setup_interrupted` stop, so a direct call cannot skip the settle.

A legacy stop with no reason and a live, active template stays
resumable.

A step on a stopped workflow cannot be ticked, skipped, reopened or
re-dated: the four step actions refuse it ("Resume the workflow first"),
and `completeStep`, `reopenStep` and the reschedule write carry
`status <> 'cancelled'` too.

`pauseInstanceAction` and `cancelInstanceAction` refuse the couple's
default and the MC's personal instance: they hold loose to-dos, not a
sequence. Pause is guarded against a second choice while the first is
in flight. `cancelInstanceAction`
and `cancelCoupleWorkflowsAction` now refuse rather than report a
phantom success when nothing matched (another tenant's instance or
couple, or a finished workflow), and write an `instance_cancelled` audit
row with reason `manual`.

### Deleting a workflow stops its couples

`workflow_instances.template_id` is `on delete set null` and the
executor never reads the template, so a plain delete used to leave
every live couple sending. `deleteTemplateAction` now calls
`delete_workflow_template` (`20261008100000`), which cancels the
template's `active` and `paused` instances and deletes the template in
one transaction, then writes an `instance_cancelled` audit row per
couple ("Workflow stopped: X (X was deleted)"). Cancelled, not paused:
with the template gone there is no Turn on to resume from. Its open
steps are marked `cancelled` and the instance records
`cancelled_reason = 'template_deleted'` (see "Stopping a workflow marks
its steps cancelled"), and Resume refuses it. The library's
delete confirmation (`template-delete-dialog.tsx`) names the number of
couples it will stop, counted on the server (`live`: active plus
paused).

### Exit rules: stages that stop a workflow

A workflow can name the stages that stop it for a couple
(`workflow_templates.exit_statuses`, `20261012000000`), for example a
nurture sequence that stops at Lost or Booked. The builder no longer
offers a control for them: the gear and its "Workflow settings" drawer
were removed (owner ruling 2026-09-27). `setExitStatusesAction` and the
engine are unchanged, so stages already saved keep stopping the
workflow.

- **Stored form.** Each entry is a `couple_statuses.slug`, lower-cased:
  the value `couples.status` holds and the `couple_stage_changed` event
  carries as `to_status`, the same form the stage-changed trigger stores
  in `toStatus`.
- **The stop.** For every `couple_stage_changed` event the dispatcher
  calls `exit_workflow_instances_for_stage` (`lib/workflows/exit-dispatch.ts`)
  before it matches apply rules. One statement per event cancels that
  couple's `active` and `paused` instances of every workflow of the MC
  whose list holds the new stage, with `cancelled_reason = 'exit_rule'`;
  the Task 22 trigger marks their open steps `cancelled`. One
  `instance_cancelled` audit row per instance reads "Workflow stopped: X
  (couple moved to Lost)". The couple's default and personal lists are
  never touched, and the templates are locked `for share` first
  (template, then instance, the global order).
- **Exits before applies.** A stage that starts workflow A and stops
  workflow B does both in one pass.
- **Never started on its own exit stage.** At match time the dispatcher
  skips any workflow whose `exit_statuses` holds the stage the couple just
  moved into (`isOwnExitStage`), whatever its trigger says. That is what
  closes the contradiction.
- **Concrete overlap refused at save.** A workflow whose own trigger
  names a stage in its exit list is refused in plain words by
  `setExitStatusesAction`, `setApplyRuleAction` and the copilot's
  `set_trigger` (`exitRuleConflict`, `lib/workflows/exit-rules.ts`). A
  stage trigger with no stage chosen (it fires on any stage) is allowed:
  the picker seeds exactly that when "Couple stage changed" is first
  picked, and refusing it left the MC no way to go on and choose the
  stage. The check fails closed: a failed read refuses the save. The
  builder shows the trigger refusal as a toast and reloads the saved rule.
- **A failed exit call.** It runs in its own try, so the event's applies
  still run. The event is left unprocessed and retried whole on the next
  tick (idempotent: the exit matches only running and paused instances,
  and `workflow_instances_unique_per_event_idx` allows one instance per
  template and event). The stale sweep (`STALE_EVENT_MS`, 24h, on
  `created_at`) caps the retries. `workflow_exit_failed` alerts once per
  tenant per hour.
- **Latency.** The stop lands when the dispatcher reads the event: within
  one tick, sooner when the MC's own move kicks the dispatcher. A step the
  executor has already claimed finishes (the same rule as Turn off).
- **Idempotent.** Only `active` and `paused` instances match, so a
  replayed event stops nothing and writes nothing.
- **Not retroactive.** Saving the list does not stop couples already
  sitting in one of the stages; it acts on the next move.
- **Resume.** An exit-rule stop can be resumed from the couple's Stopped
  strip, through the Task 22 path, as an explicit act of the MC.
- **Duplicate** copies the list. Converted legacy automations have none.

Tests: `tests/integration/workflows/exit-rules.test.ts`,
`tests/unit/lib/workflows/exit-rules.test.ts`,
`tests/unit/app/workflows/exit-stages-control.test.tsx`.

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
  the saved template, and drops `templateId` (copying the template's
  subject and body onto the step first) so the send uses what is on
  screen. Edits are per field (Phase 5 live check B2): a subject edit
  leaves the stored body untouched, and a body edit is the TipTap doc
  from the same editor Compose uses, so nothing is flattened and an
  unfilled variable still holds the send. See `email-system.md`.
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

**Every send is listed, at the time it will go** (owner report
2026-09-27: a send behind a 5 minute Wait never appeared). The engine
dates a step only when the step above it finishes, so a send behind a
Wait has no `due_at` until the Wait ends. `loadQueue` now reads every
unfinished step of the MC's active instances, finished steps included
as anchors (`loadScheduledItems`, `lib/workflows/queue-schedule.ts`),
and dates each one with `projectSchedule`
(`lib/workflows/schedule-projection.ts`), which walks the instance lane
by lane exactly as `recomputeDueDates` does:

- a stored `due_at` is used; an automated step already past it runs on
  the next tick, so it shows at now;
- an undated step is dated from its predecessor's projected finish with
  the engine's own `computeDueAt`;
- a Wait finishes at its wake: `computeWaitWakeAt` plus the quiet-hours
  push `execute-step` applies (template window, else the MC's own from
  their user metadata). Sends themselves are not moved for quiet hours
  because the engine does not move them;
- a to-do, an appointment, a send waiting for the MC's OK, an undecided
  branch, a held date and a failed step each stop the chain: the steps
  behind them carry a reason in place of a time ("After you finish Call
  the venue", "After you OK Quote", "Depends on Paid deposit?", "After
  Thank you, which has no date", "After Invoice is fixed"), in the No
  date band. A wedding- or apply-dated step keeps its own date behind
  any of these, and one with no wedding date reads "Needs a wedding
  date".

Waits and branches are never rows (only when they fail): the send
behind a Wait carries the Wait's end as its own time. The couple's own
to-do list and the MC's personal one are loose lists, not sequences, so
their to-dos keep the date the MC gave them.

Every read is paged to exhaustion (`lib/workflows/read-pages.ts`,
`queue-schedule-reads.ts`): PostgREST cuts a response at `max_rows`
(1000) without an error, and a missing finished step or to-do dates the
steps behind it wrongly. A failed read, or one past the safety caps
(5,000 instances, 100,000 steps), fails the list into its error state;
there is no silent partial list. The list itself is capped at 500 rows,
soonest first.

**Sends that are not released yet cannot be sent or snoozed** (fix
round 1, review I1). Now that Upcoming lists every send, a send behind
a to-do, a Wait, an approval or an undecided branch is a row. A date on
it is one the engine runs on sight (`isExecutable` reads only `due_at`),
and Send & complete ran it at once, so either sent it out of order. One
rule, `lib/workflows/release.ts` (`releaseBlocker`, `blockedReason`),
asks the question `recomputeDueDates` answers: a chained step is
released once the step above it in its lane is done or skipped, a
branch-lane head once its branch is `done`, the top-level head at once,
and a wedding- or apply-dated step always. Every surface refuses by it:

- the Upcoming row (`QueueItem.blocked`, which also covers a send with
  only a projected time) drops Tomorrow and Next week from its `⋯`;
- the detail modal (`StepDetail.blockedReason`) drops Snooze and Send &
  complete and shows the reason ("This step waits for "Wait" to finish
  first."); Save stays, since editing sends nothing;
- `approveStepAction`, `retryStepAction` and `rescheduleStepAction` (to
  a date) refuse with the same sentence before writing anything. Taking
  the date off (a hold) is still allowed. A held step whose own
  predecessor is released keeps its documented Send now and set-a-date;
- `runStepNow` returns false for an unreleased step, as a backstop.

`loadQueue` returns six groups: `review`, `overdue`, `today`,
`upcoming` (to-dos after today), `sendingToday`, and `scheduled`
(automated steps after today or behind a person). The digest reads the
first five and not `scheduled`, but it is **not** unchanged: its today
groups now carry projected rows (a send behind today's Wait, a to-do
dated from a projected send). `buildDigest` passes the MC's own quiet
hours, and a caller that passes none still gets the template window.
The page flattens them (`flattenQueue`) and re-cuts them by date
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
That reopen goes through `reopen_completed_workflow_instance`
(`20261011100000`, template then instance, like resume): with the
workflow on, the instance goes back to `active`; with it off or deleted,
an automated step is refused ("Turn this workflow on first") and a
manual one reopens with the instance `paused` as `template_off`, so the
to-do shows and nothing automated runs.
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

### Save-time config validation (Task 33)

A step config the runner would reject is refused **when it is saved**,
not when it is due. Every path that writes a step config runs the same
pure check, `validateStepConfig(type, config)` in
`lib/workflows/step-config-validation.ts`, which mirrors `executeStep`'s
type switch (wait and branch schemas from `conditions.ts`, an action's
`ActionSpec.configSchema`, manual steps unchecked). It returns
`configErrorMessage(label, error, 'save')`: the same field clause the
send would have written, closing with a save instruction ("The "Send
email" step has invalid settings: Subject is required. Fix this before
saving."). The runner keeps the default `'send'` context, whose stored
text ("... Edit the automation to fix it.") is unchanged. The check
never rewrites: the caller writes the config it was given, never the
parsed one, so schema defaults still apply at send. Unknown action
types (and an action step with no action) are refused too, since the
runner errors on them.

| Save path | Where | How the error shows |
|---|---|---|
| Builder canvas edit (inspector autosave) | `upsertTemplateStepRow` | toast, not repeated for the same refusal while the MC types, and never for a save a newer one already replaced (the refusal branch is gated on the save sequence like the success branch, Task 33 re-review); the canvas card is updated only once the server accepts, with the config and label captured when the save fired, so a refused save leaves the card on its stored values |
| Builder step picker adding a step | `upsertTemplateStepRow` with `isNew: true` | an EMPTY starting config (`{}` once `actionType` is set aside: a branch with no condition, a note with no text) skips the check; any real config is checked. Written with a plain insert; if the card's first edit won the race, the add reports done and never overwrites it. the Task 34 pre-flight badges it on the canvas and refuses Turn on until it is finished |
| Step detail modal, action fields | `updateStepConfigAction` | inline in the modal, which stays open with the draft; the line is scrolled into view and focused on each refusal (live check B3) |
| Step detail modal, Save on a send | `saveStepMessageAction` (the `applyReviewEdits` result) | inline |
| Step detail modal, Send & complete with edits | `approveStepAction` | inline; checked before the gate is cleared and before `runStepNow`, so nothing is written or sent |
| Copilot add / update step | `tool-executors.ts` | returned to the model; runs after the copilot's own schema check, which also accepts builder-only flow types (sub_flow, approval) a workflow step cannot run. Stop is no longer in the copilot's schemas or prompt (see "The Stop step was removed") |

Timing, the review flag and the title save in the same upsert as the
config, so a refused builder save refuses them too: on an unfinished
step (a new branch with no condition) they land once the step is
finished.

Not checked, on purpose: duplicating a template and applying one (they
copy configs that were already saved), the legacy automation converter,
and engine-written to-dos (`{}` on a manual step). A legacy step whose
stored config fails the stricter runner schema cannot be saved until
it is fixed; the send would have failed on it anyway.

### The Turn on pre-flight (Task 34)

An unfinished workflow cannot be turned on (audit M7).
`lib/workflows/preflight.ts` reads the template's enabled steps
(`loadTemplatePreflight`; a disabled step never reaches a couple) and
lists one problem per step (`preflightSteps`):

Each row carries a `kind` (`empty`, `config`, `unnamed`, `cannot_run`)
so client code can word the consequence without importing the module.
The kind comes from `validateStepConfig`'s structured `reason`
(`no_action`, `not_runnable`, `removed`, `invalid`), never from its
sentence, so the wording can change freely (Task 34 re-review Minor 7).
An unnamed to-do or appointment is titled by its type ("To-do",
"Appointment"), never by its placeholder, which read "Give it a name
has no name" (Minor 6).

| Problem | Row text |
|---|---|
| No steps at all | "It has no steps yet. Add at least one." |
| A config the runner would reject: an unconfigured send, a picker placeholder (`{}`), a branch with no condition | `validateStepConfig(type, config, 'checklist')`, the Task 33 check in its checklist wording: the field clause as a sentence ("Subject is required.", "No condition chosen.") |
| A to-do or appointment with no name, or still named "Give it a name" | "No name yet, so it won't say what to do on the day." |
| A step type with no working handler: an unknown action, a coming-soon action (SMS, WhatsApp, the Phase 14a stubs) | "This step type can't run yet." |
| A saved Stop step (removed from the picker, see below) | "Stop isn't a step Zebri runs. Remove it; a workflow ends once its last step is done." |

The verdict imports the action registry, which is server-only, so it
is computed on the server and client components get plain
`PreflightProblem` rows (`{ stepId, title, message }`).

Every activation path and its gate:

| Path | Gate |
|---|---|
| Canvas header Turn on (`canvas-status-toggle.tsx`) | `setTemplateStatusAction` refuses any move to `active` while problems exist, with `preflightRefusal` naming each step. The click first reads `templatePreflightAction` and, if anything is unfinished, opens "Finish these steps first" (`preflight-list.tsx`) instead of turning on |
| Library card switch (`template-card.tsx`) | the same hook (`use-template-status-change.ts`), the same dialog, the same server gate |
| Hand apply to a couple (`applyTemplateToCoupleAction`) | the same pre-flight, refused with the list ("Finish 1 step before starting this on a couple. ..."); a finished draft still applies. The pre-flight's `stepsRevision` is passed to `applyTemplate`, which refuses ("This workflow changed while it was being started. Try again.", no alert) when the revision moved before the instance was created or by the time its steps were snapshotted (Task 34 re-review Minor 2) |
| A client role writing the row, or calling the RPC | refused by the database: trigger `workflow_templates_activation_lock`, and `set_workflow_template_status` is service role only (`20261023600000`). Since `20261024200000` the trigger is an allow-list: only `service_role`, `postgres` and `supabase_admin` may make a template active, so a role nobody thought of cannot skip the pre-flight (Minor 3). A SECURITY DEFINER function owned by `postgres` passes, so one that switches a workflow on must run the pre-flight itself |
| AI copilot | not an activation path: it has no status tool, and its mutating tools refuse any template that is not a draft (pinned by `tests/unit/lib/workflows/ai-copilot/cannot-activate.test.ts`) |
| API routes | none changes a template's status; the copilot route only reads it |
| Legacy converter (`lib/workflows/converter.ts`) | not gated: a one-off re-run tool with no runtime caller that preserves an already running legacy automation's `active`. Gating it would silently switch off a live workflow |

Turning off is never gated: an unfinished workflow must always be
stoppable. A failed pre-flight read refuses the Turn on (fails closed,
`actionFailureMessage`).

On the canvas, `use-template-preflight.ts` asks the server again a
moment after the steps change and whenever a save, add or delete lands.
Each unfinished card gets a warning chip with the row text
(`step-card-chips.tsx`, shared by the canvas node and the phone list).
A workflow that is **already on** and has unfinished steps (a step
added from the picker is a placeholder until filled in) shows a warning
above the flow naming them (`unfinished-steps-banner.tsx`): a couple
enrolled meanwhile would reach them and error.

The flip itself (`set_workflow_template_status`) is service role only.
The action checks ownership on the MC's RLS client, runs the
pre-flight, then calls it with the admin client, passing the
`steps_revision` the pre-flight read first. Every insert, update or
delete of a template step bumps `workflow_templates.steps_revision` in
its own transaction (trigger, `20261024200000`). The function reads the
revision under the template's row lock and refuses (WF002, "This
workflow changed while it was being checked. Try Turn on again.") when
it moved. This replaced a count plus `max(updated_at)` fingerprint:
`updated_at` is the transaction's start time, so an edit that began
before, but committed after, the newest one left both unchanged (Minor
4). The action also reads its errors properly (Phase 6 review M2): a
failed ownership read is "Zebri could not reach the database", not
"Workflow not found"; a template deleted before the flip (P0002) is
"Workflow not found."; any other RPC error goes through
`actionFailureMessage`, never PostgREST's own text. `templatePreflightAction`
checks its ownership read the same way.

The canvas banner words each kind by what happens: a `config` or
`cannot_run` step "will error for a couple who reaches it"; an
`unnamed` one runs but "won't say what to do". The Turn on dialog says
"Finish this, then turn it on." for one row (or the empty-workflow row)
and "Finish these, then turn it on." for more. The card chips are `StatePill`s with a
leading icon (`wrap` on the unfinished one).

### The Stop step was removed (Phase 6 ruling)

The picker offered a "Stop: End the run here" flow step, and the copilot
was taught it, but the workflow engine never had a handler for it: a
couple who reached one errored at that step. The ruling was a handler
that ends the instance cleanly, or removal. It was **removed**:

- A handler is not small. What "end the run" means is a product
  decision the UI never made: whether the MC's own open to-dos in the
  workflow are skipped too, what happens to a parallel lane, whether an
  errored step still blocks completion, and the heal would need to redo
  it after a failed write. A workflow already ends by itself once its
  last step is done, and "Stop this workflow" ends one by hand.
- It is gone from the step picker (`step-picker.tsx`), the copilot's
  system prompt and its flow-control schemas (`tool-schemas.ts`), so the
  copilot is told it is not a step it can add.
- A Stop step already saved on a template still renders on the canvas,
  and its card reads "Stop isn't a step Zebri runs. Remove it; a
  workflow ends once its last step is done." (`STOP_NOT_A_STEP`, no
  longer "End the run here"). The Turn on pre-flight names it with the
  same sentence (reason `removed`, kind `cannot_run`), not "can't run
  yet", and a save of one is refused the same way.
- A Stop already copied onto a couple's running workflow still **errors**
  when it comes due (skipping it would run the steps behind it, which
  the MC meant to stop), with that same sentence rather than "unknown
  action stop" (`execute-step.ts`, Phase 6 residual F2). The MC can Skip
  it or stop the workflow. The deploy notes carry a count of them.

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
Rename / Snooze / Take the date off (a hold every recompute respects,
see "Take the date off is a hold") / Skip / Reopen / Remove and gains
**Pause this workflow** (running), **Resume this workflow** (paused,
when the server would allow it) and **Stop this workflow** for a step
from a workflow the MC started. A step on a paused workflow carries a
**Paused** pill. Resume always opens a confirm saying steps that fell
due while it was paused (or stopped) will be skipped, not sent; for a
stopped workflow it adds that the rest is re-dated from today and any
wait starts again (`workflow-resume-dialog.tsx`). Stopped workflows sit in a collapsed
**Stopped (n)** strip under the list (`couple-stopped-workflows.tsx`),
each with why and when it stopped and a Resume button, or, when Resume
is refused, the reason in place of the button. Pause and Resume errors
show as a toast in the server's words (`use-instance-controls.ts`).

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

`app/api/cron/workflow-digest/route.ts`, hourly via pg_cron
(`zebri:workflow-digest`, `0 * * * *`). Everything the engine does is
invisible until somebody logs in, which is the wrong default for a
product whose promise is "you will not forget anything".

The gate is the MC's **local** hour, not a fixed UTC time, so daylight
saving cannot drift the send an hour twice a year (`isDigestHour`).
`DIGEST_LOCAL_HOURS` is `[DIGEST_LOCAL_HOUR]` (7am): the job runs hourly
now that pg_cron is not capped the way Vercel's Hobby scheduler used to
be, so every timezone gets its own real 7am instead of the shared UTC
window the old daily run needed.

The hourly run also checks the tick's health: when
`system_heartbeats.automations-tick` is older than 5 minutes
(`TICK_STALE_MS`), the digest route sends a `cron_job_missed` Slack
alert. It is the in-app half of the check; `tick_watchdog()` in Postgres
is the half that survives the app being down.

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

## Deploy notes: Phase 6

Phase 6 (validation and observability) and its fix wave ship these
migrations, in this order. `supabase db push` applies them in filename
order, which is the order they must run in:

1. `20261023600000_workflow_template_activation_lock.sql`: a client role
   cannot switch a template on; `set_workflow_template_status` (Turn on
   and Turn off) is the only way.
2. `20261023700000_workflow_step_date_hold.sql`: `workflow_steps.due_held_at`
   and the wedding-date recompute skipping held steps.
3. `20261023800000_workflow_step_claim_requires_active.sql`: the claim,
   wait-finish and quiet-hours hold RPCs, which require a live instance.
4. `20261023900000_workflow_merge_step_outputs.sql`: step outputs merge
   into `context` in SQL.
5. `20261024000000_workflow_heal_marker_hygiene.sql`: the marker clears
   when an instance finishes, and the heal finder skips a deferred one.
6. `20261024100000_workflow_skipped_branch_lanes_fix.sql`: the one-off
   N7 data fix (below).
7. `20261024200000_workflow_template_steps_revision.sql`:
   `workflow_templates.steps_revision`, the activation-lock allowlist,
   and `set_workflow_template_status` moving from four arguments to
   three.
8. `20261024300000_workflow_revision_guard_and_skip_reason.sql`: only the
   revision trigger may write `steps_revision` (F1);
   `workflow_steps.skip_reason` and the trigger that clears it and the
   date hold (F3, F4).
9. `20261024400000_workflow_steps_revision_bump_definer.sql`: the
   revision bump runs security definer and skips a template that is gone,
   so deleting a user who owns a template with steps works again (live
   check B2; migration 7 had broken `auth.admin.deleteUser` for them).
   Must ship with migration 7.
10. `20261024500000_workflow_wait_single_delay.sql`: the Wait data fix
    (fold a start offset into the duration, clear the review flag; see
    "The Wait step has one number"). Count first, and keep the numbers:
    `select count(*) from workflow_template_steps where type = 'wait' and
    (requires_approval or timing->>'mode' <> 'after_previous' or
    coalesce(timing->>'delayAmount', '0') <> '0');`, and the same on
    `workflow_steps` for `status = 'pending' and due_at is null`.
11. `20261024600000_workflow_wait_relative_months.sql`: the SQL wake of
    a Relative date Wait takes `months`. Ships with the code that offers
    months, or a months Wait keeps its old wake when a wedding moves.

**Code and migrations 20261023600000 onwards deploy together.** The
code calls functions these migrations create (`workflow_claim_step`,
`workflow_finish_wait`, `workflow_hold_wait`,
`workflow_merge_step_outputs`), reads and writes columns they add
(`due_held_at`, `steps_revision`, `skip_reason`: a branch skip writes
it, so new code on the old schema cannot pick a lane), and the four-argument
`set_workflow_template_status` the previous code called is dropped.
Old code against the new schema cannot turn a workflow on or off; new
code against the old schema cannot claim a step, so the tick runs
nothing. Promote the migrations and the app in the same release, and
check the tick's heartbeat on the Admin scheduler card straight after.

**N7: count before the deploy.** Branches the MC skipped before Task 36
fix round 2 left their lanes pending. Run this against production
before the deploy and keep the number:

```sql
with recursive under_skipped as (
  select s.id, s.instance_id
    from workflow_steps s
    join workflow_steps b on b.id = s.parent_step_id
   where b.type = 'branch' and b.status = 'skipped'
  union
  select c.id, c.instance_id
    from workflow_steps c
    join under_skipped u on c.parent_step_id = u.id
)
select count(distinct u.id)          as stranded_steps,
       count(distinct u.instance_id) as instances
  from under_skipped u
  join workflow_steps s    on s.id = u.id
  join workflow_instances i on i.id = u.instance_id
 where s.status in ('pending', 'waiting')
   and i.status in ('active', 'paused');
```

Zero means migration 6 does nothing. Otherwise migration 6 skips each of
those steps (an UPDATE, nothing deleted), writes one `step_skipped`
timeline row per branch with `via: 'deploy_fix'`, and marks the active
instances for the heal, which re-dates them and completes the ones with
nothing left within a few ticks. It is idempotent. After the deploy the
same query must return 0, and
`select count(*) from workflow_audit_log where detail->>'via' = 'deploy_fix'`
gives the branches it touched.

**Stop steps: count before the deploy.** Stop left the picker in this
phase. A Stop already saved keeps erroring when it comes due, now with
an honest sentence. Count them first, so the MC can be told:

```sql
select
  (select count(*)
     from workflow_template_steps ts
     join workflow_templates t on t.id = ts.template_id
    where ts.type = 'action' and ts.config->>'actionType' = 'stop'
      and t.status = 'active') as stops_on_live_workflows,
  (select count(*)
     from workflow_steps s
     join workflow_instances i on i.id = s.instance_id
    where s.type = 'action' and s.config->>'actionType' = 'stop'
      and s.status in ('pending', 'waiting', 'errored')
      and i.status in ('active', 'paused')) as stops_on_running_couples;
```

Zero on both means nothing to do. Otherwise each running one will show
as errored on the couple's workflow with "Stop isn't a step Zebri runs"
when it comes due; the MC skips it or stops the workflow, and removes
it from the template before turning that workflow on again (the Turn on
pre-flight refuses it).

**The e2e job stays out of required checks.** The `e2e` job runs on
every PR but is non-blocking (`cicd.md`, "E2E in CI"). The fix wave
edited `tests/e2e/workflows-builder.spec.ts` (the New workflow chooser,
and Live / Paused in place of On / Off) without running it; the first
CI run is its check. Do not add the three `E2E (...)` checks to branch
protection as part of this deploy.

## Deploy notes: send order after an early tick

`20261024700000_workflow_early_tick_stale_dates` ships **with** the
code change to `recomputeDueDates` (release is transitive up the
lane), never before it: the repair clears dates the old rule wrote,
and the old code would write them straight back.

It runs `_workflow_clear_early_tick_dates()` once. For every live
instance it nulls the `due_at` of a pending chained step (not
mid-retry) that has an earlier step in its lane still open, including
behind a finished wedding- or apply-dated step, and stamps
`needs_recompute_at` on those instances only. A null date is never
claimed, so the repair can only stop a send. The heal pass then
re-dates them with the new rule on the next ticks (200 instances a
tick), ahead of that tick's executor.

It is targeted rather than stamping every active instance on purpose:
stamping thousands would take many ticks to heal, and any stale step
not yet healed stays claimable in between (a kick can run the executor
between ticks). Nulling first closes that window.

Size it in production before the deploy; the number is the steps the
repair will hold:

```sql
select count(*) as steps, count(distinct s.instance_id) as instances
from public.workflow_steps s
join public.workflow_instances i on i.id = s.instance_id
where i.status in ('active', 'paused')
  and s.status = 'pending'
  and s.due_at is not null
  and coalesce(s.attempt_count, 0) = 0
  and coalesce(s.timing ->> 'mode', '') not in ('wedding_relative', 'apply_relative')
  and exists (
    select 1 from public.workflow_steps p
    where p.instance_id = s.instance_id
      and p.parent_step_id is not distinct from s.parent_step_id
      and p.branch_path is not distinct from s.branch_path
      and p.position < s.position
      and (p.status not in ('done', 'skipped') or p.completed_at is null)
  );
```

Not covered, by design: a stale step already `waiting` (parked by the
send limiter, a missing variable or an approval) or mid-retry keeps its
date, as `recomputeInstance` keeps it. Both were already claimed once.

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
  the wrong couple and a revoked token). The trust-remediation phase
  added `executor-claim.test.ts` (only one caller wins a race for the
  same step), `executor-retry.test.ts` (the 1-then-5-minute backoff, the
  backoff surviving a sibling's recompute, a `recoverable: false`
  failure buried on the first attempt, un-ticking a step clearing its
  spent attempt, and the final `errored` + `workflow_step_failed`), `executor-stuck.test.ts` (`sweepStuckSteps`
  recovers a step still `running` past the staleness window and writes
  its audit row), `executor-terminal-guard.test.ts` (a late write from a
  runner the sweep already gave up on lands nowhere, and neither do the
  audit rows, the branch skip or the recompute behind it),
  `executor-budget.test.ts` (the tick respects its deadline),
  `instantiate-dedupe.test.ts` (two concurrent applies to the same
  couple produce one instance), `retry-scope.test.ts` (a manual "Try
  again" retries only its own step, not every tenant's due steps;
  `retryStepAction` used to call the unscoped sweep), and
  `tick-lease.test.ts` (the lease grants to the first caller, refuses
  the second, lets the next minute's tick in once the previous run has
  released, refuses a release from a run that does not hold it, and
  grants again once expired).
  The Phase 6 fix wave added `date-hold.test.ts` (a step with its date
  taken off stays undated and unsent through a sibling tick, an engine
  tick, the heal, the wedding date moving and the claim itself, and
  ticking or skipping it clears the hold),
  `claim-requires-active.test.ts` (a pause or Turn off landing mid-pass
  stops the next step and a sleeping wait's finish),
  `merge-step-outputs.test.ts` (concurrent merges keep every key, and
  the heal fills only missing ones), `branch-reopen-and-fix.test.ts`
  (N7 data fix, N8 reopen, F3 a reopen never restores a step skipped
  for another reason, N9 one Skipped line), `steps-revision-guard.test.ts`
  (F1: no role but the trigger writes `steps_revision`) and
  `heal-marker-hygiene.test.ts` (the marker clears on completion, a
  failed heal backs off, a failed completion check is marked).
  The send paths have their own unit coverage:
  `post-event-send.test.ts` (the six pre-composed emails carry an
  idempotency key and report a rejected send),
  `send-email-retry-safety.test.ts` (a connected mailbox's failure is
  not retryable), `send-email-template.test.ts` (a missing template
  buries, a failed read stays retryable),
  `tests/unit/lib/workflows/step-overdue-deadline.test.ts` (the emitter
  reports stopping inside its last batch) and
  `tests/unit/lib/automations/time-emitters/pass-order.test.ts` (the
  unbounded emitter runs last, and skipped emitters are named).
- E2E: `tests/e2e/workflows-builder.spec.ts`,
  `tests/e2e/couple-workflow.spec.ts`, `tests/e2e/workflows-nav.spec.ts`,
  `tests/e2e/portal-package-workflow.spec.ts`.

`tests/integration/helpers/workflows.ts` seeds an `on_event` template
and reads back the instances it opened. The emitter suites use it, since
the far end of the "DB write → bus → dispatcher" chain is now an applied
instance rather than a run.
