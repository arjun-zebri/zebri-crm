# Couple profile → Automations tab (redesign)

Reframe the couple profile's **Automations** tab from a passive run log
into an **activity + control** surface: what automation has done for this
couple, what's coming, what broke — and the ability to **run an automation
on demand** and intervene on individual runs.

> **Status: Phases 1–4 shipped (2026-06-16/17).** Activity feed +
> narration, per-run / per-automation controls, "Run an automation now",
> and the upcoming/summary band are live. Phase 5 (extra transparency) is
> still design; suppression awareness is deferred (no couple-level
> do-not-contact field exists yet). Source of truth for the phased
> implementation (§ Phased delivery). Sibling to `automations.md` (how the
> engine works) and `automations-wiring.md` (catalogue wiring). When a
> phase ships, update this doc + the cross-referenced docs in the same PR.

## Problem

The tab today (`app/(dashboard)/couples/couple-automations.tsx`) groups
`automation_runs` by automation and shows a status pill per run. In
practice it's a near-dead surface:

- **Every row reads "Untitled automation."** Automations are rarely named,
  so the only distinguishing signal is the grey trigger label. The MC
  can't tell what any row *does*.
- **It's a run log, not an activity story.** A "Completed" pill says an
  automation ran but never *what it did* — which email it sent, which task
  it created, which stage it moved. The single most valuable fact (the side
  effect) is the one thing not shown, even though the data exists
  (`automation_audit_log`, see § Data sources).
- **It's purely backward-looking.** No view of what's *waiting* (the
  "1 week to go" email that fires next Tuesday is invisible as upcoming),
  what's *paused*, or what *could* fire for this couple.
- **No agency.** The MC can't run an automation on demand, retry a failed
  run, or cancel a scheduled one. The only control is "Pause all," shown
  only when something is live.
- **Failures are quiet.** A run that errored because the couple has no
  email address is buried one expand-click deep, and nothing surfaces it on
  the Overview tab — a couple can silently receive no comms.

## Goals

- Show **what automation has done for this couple** as a human-readable
  activity feed (per-step, not per-run).
- Show **what's scheduled / waiting** and when it will fire.
- Let the MC **run an automation (or a single action) on demand** against
  this couple — the headline ask.
- Let the MC **act on individual runs**: retry a failed run, cancel a
  waiting one, pause/resume a single automation (not just "pause all").
- Make **failures loud** here and nudge them on Overview.
- One-click **jump to the automation's builder canvas**.

### Non-goals (deferred)

- Editing automation *design* from this tab — that stays on the canvas
  (`/automations/[id]`); we only link to it.
- A couple-scoped automation *builder* (creating new automations from the
  couple profile). Out of scope.
- Cross-couple analytics / reporting — lives on `/automations` home.
- Wiring any CUT trigger/action from `automations-wiring.md`. This tab only
  surfaces and controls what already exists.

## The redesign — three bands

### 1. Run an automation now (header action)

A primary **"Run automation"** button opens a picker of the MC's **active,
launch-visible** automations (filtered through
`isActionLaunchVisible` / `isTriggerLaunchVisible`). Selecting one queues a
run **against this couple**, bypassing the trigger condition. Optional
fast-path: a short list of common single actions (*Send portal link*,
*Send thank-you*, *Send review request*) that run that one action without a
saved automation.

This is the everyday use case: "couple just emailed asking for their portal
link — send it now" without waiting for a trigger to match.

**Mechanism — see § Manual trigger (open question).** The plumbing exists
(`emit_automation_event` is callable by authenticated users), but "run
*this specific* automation" is not a 1:1 with emitting a trigger event;
resolved below.

### 2. Activity feed (replaces the run rows)

Replace "Completed · 1 run" rows with a **per-step, human-readable feed**
built from `automation_audit_log` (already populated by the runner — see
§ Data sources). Each entry narrates the side effect:

```
✓  Sent “Invoice overdue reminder” email                    11 Jun, 4:03 pm
✓  Created task “Chase final payment”                        11 Jun, 4:03 pm
⏳  Waiting — will send “1 week to go” email                 → 22 Jun
✗  “Quote follow-up” failed — couple has no email address   · Retry
↻  Skipped “Send SMS” — action disabled                     11 Jun
```

- Group by automation (keep today's collapse-for-history affordance), but
  the **collapsed row leads with the outcome**, not the status word.
- Narration comes from a new `lib/automations/audit-log/narrate.ts` helper
  (referenced in `automations-wiring.md`'s recipe; not yet built) that maps
  `(event, action_type, details)` → one human sentence, reusing action spec
  labels.
- Errored steps show `friendlyRunError(...)` (already used) + a **Retry**
  affordance.

### 3. Upcoming + control

- **Upcoming** section surfacing `waiting` runs with their fire date
  (resolved from the `wait` step / time-emitter bucket).
- **Per-run actions:** retry a failed run, cancel a waiting run, pause /
  resume a single automation for this couple. Keep the existing
  **Pause all** as the bulk escape hatch.
- **Summary strip** at the top: e.g. *"3 active · 1 waiting · 1 failed in
  30d"* for an instant health read.
- **Suppression / paused awareness:** if the couple is in a do-not-contact
  / unsubscribed state, or automations are paused for them, show it
  prominently rather than letting runs silently no-op. (Surface only — the
  `couple_set_do_not_contact` / `couple_unsubscribed` triggers themselves
  are CUT per the wiring doc; this reads whatever couple-level state exists.)

### Bonus transparency (stretch)

- **"Eligible but not yet fired"** — list active automations whose trigger
  *could* match this couple but haven't, to close the "I thought I set this
  up" gap.

## Data sources (reuse map — minimal new schema)

| Need | Source | Status |
|---|---|---|
| Run list + status per couple | `automation_runs` (`couple_id` scoped) | ✅ exists, already read |
| **Per-step activity (the feed)** | `automation_audit_log` — `event`, `action_id`, `details jsonb`, `run_id`; RLS `select` own | ✅ **already populated by the runner** |
| Action labels for narration | action registry `lib/automations/actions/*` + `automation_actions` rows | ✅ exists |
| Trigger labels | `getTriggerSpec()` | ✅ exists |
| Picker of runnable automations | `automations` (status `active`) ∩ `launch-catalogue` allowlist | ✅ exists |
| Friendly error copy | `friendlyRunError()` | ✅ exists |
| Pause runs | `pauseCoupleRunsAction()` | ✅ exists (bulk only) |

**Key point:** the activity feed needs **no migration** — the per-step trail
is already written. The work is a narrate helper + a read + UI. New schema
is only needed if § Manual trigger picks the "direct run-open" path *and* we
want a manual-source marker on the run.

## Manual trigger — open question (resolve before that phase)

"Run automation X for this couple now" has two implementations:

1. **Emit a synthetic event** via `emit_automation_event(user_id,
   'manual', couple_id, <trigger_type>, payload, couple_id)` and let the
   dispatcher match. *Problem:* it fires **every** automation on that
   trigger, not the one the MC picked, and only works if the automation's
   trigger matches the synthetic event. Wrong fit for "run *this* one."
2. **Direct run-open (recommended):** a server action that inserts an
   `automation_runs` row for the chosen `automation_id` + `couple_id` at the
   first action, status `running`, then lets the existing runner advance it
   on the next tick (or runs it inline). Bypasses the trigger predicate by
   design — the MC is the trigger. Optionally stamp `source = 'manual'` on
   the run (small migration) so the activity feed can label it
   *"Run manually by you."*

**Resolved (shipped Phase 3):** option 2, via `runAutomationForCoupleAction`
— **and no migration was needed.** After verifying ownership with the user
(RLS) client, the action uses the service-role client to write a synthetic
`manual_fire` event with `processed_at` pre-stamped (so the dispatcher never
opens a second run), opens a run at the automation's first action, then
calls `advanceRunNow(adminClient, runId)` (new export in
`lib/automations/runner.ts`) to drive that one run to completion/sleep
**inline** — so the MC sees the result immediately instead of waiting for
the daily cron tick. The `source = 'manual'` column was **not** added; the
synthetic event's `source_table = 'manual_fire'` already marks manual runs
if the feed ever wants to label them.

## New server actions (all in `app/(dashboard)/automations/actions.ts`)

Each Zod-validated, RLS-scoped, returning the tagged `ActionResult`:

- ✅ `runAutomationForCoupleAction({ automationId, coupleId })` — § Manual
  trigger option 2 (inline-executed via `advanceRunNow`). Per-user
  rate-limited (20/min) since a manual run can fan out a real send.
  `loadRunnableAutomationsAction()` backs the picker (active automations).
- ✅ `testAutomationForCoupleAction({ automationId, coupleId })` — same
  path with a `test_mode: true` flag on the synthetic event. Actions run
  for real, but `send_email` reads the flag and routes any email to the
  **MC's own address** (subject tagged `[Test]`) instead of the couple, so
  the MC can preview the email without contacting them. Both wrap a shared
  `openManualRun(input, testMode)` helper.
- ✅ `retryRunAction({ runId })` — re-open an `errored` run; flips it back to
  `running` and clears `error_message`/`completed_at`. The runner left
  `current_action_id` on the failed step, so the next tick re-attempts it.
- ✅ `cancelRunAction({ runId })` — `waiting`/`paused` → `cancelled`, and
  consumes any pending wait so the wake loop can't resurrect it.
- ✅ `pauseAutomationForCoupleAction({ automationId, coupleId })` — scoped
  variant of the bulk pause (`running`/`waiting` → `paused`).
- ✅ `resumeAutomationForCoupleAction({ automationId, coupleId })` —
  `paused` → `waiting` if the run still has an unconsumed wait, else
  `running` (see `partitionResume`).

**Rate-limit:** none on these — they're authenticated, RLS-scoped,
single-user server actions, matching the codebase convention
(`payments/actions.ts` §header). The billable-send guard lives inside the
action handlers (e.g. `send_email`'s recipient check), so a retry can't
fan out mail. The Phase-3 manual-run will re-evaluate this since it can
deliberately trigger a send.

## UI surfaces / components

Page stays an orchestrator; split into ≤150-line components co-located with
the couple profile (as shipped):

- `couple-automations.tsx` — orchestrator: fetch + compose only.
- `couple-automations-header.tsx` — summary strip + Run / Pause-all.
- `couple-automations-group.tsx` — one automation's collapsible row.
- `couple-automations-feed.tsx` — a group's runs + group Pause/Resume.
- `couple-automations-run-row.tsx` — one run's lines + Retry/Cancel + the
  "Next step …" wake line.
- `couple-automations-run-picker.tsx` — the "Run automation now" popover
  (Radix, matching the couple header's links/actions popover; loads active
  automations via React Query, runs the picked one inline).
- `couple-automations-loader.ts` — RLS-scoped IO (runs + audit + waits).
- `couple-automations-data.ts` — pure shaping (narrate, group, summarize).
- `lib/automations/audit-log/narrate.ts` — pure audit-row → line narration.
- `lib/automations/run-controls.ts` — pure `partitionResume`.

Design-system: tokens + `components/ui/*` primitives only; `StatePill`,
`Button`, `Empty`, `Loading`, `ErrorState`. Explicit **loading / empty /
error** states (empty = "No automation has touched this couple yet" with the
Run button still available).

## Security & testing checklist (per `security.md`)

- Zod on every new server action; rate-limit the manual-run + retry paths.
- All reads RLS-scoped via the user's client (audit log is `select` own);
  no service-role key in any `'use client'` file.
- Integration test proving **cross-tenant denial**: MC A cannot run,
  retry, cancel, or read activity for MC B's couple / runs.
- Manual-run respects suppression/do-not-contact (short-circuit + clear
  message, mirroring automated-send guards).
- Unit: narrate helper for every `event` × representative `action_type`.
- Integration: `runAutomationForCoupleAction` opens exactly one run; retry
  re-opens from the failed step; cancel only affects `waiting`.
- E2E: open a couple → run an automation → see it appear in the feed →
  retry a seeded failure. Desktop + mobile (Pixel 5 + iPhone 12).
- `sendAlert()` already covers runner errors (`automation_failed`); no new
  alert unless manual-run introduces a new silent-failure path.

## Phased delivery (build order)

Each phase is its own PR through `staging` (per
`feedback_staging_only_batch`), meeting the § 5 DoD in
`production-readiness.md`.

1. ✅ **Activity feed + narration (shipped 2026-06-16).** `narrate.ts` +
   read `automation_audit_log` + redesigned feed (outcome-first rows, silent
   no-ops surfaced as warnings). No schema change. Files: `narrate.ts`,
   `couple-automations-{data,feed,run-row,group}.tsx`, orchestrator rewrite.
2. ✅ **Per-run control (shipped 2026-06-16).** `retryRunAction`,
   `cancelRunAction`, `pauseAutomationForCoupleAction`,
   `resumeAutomationForCoupleAction` + Retry / Cancel / Pause / Resume
   affordances in the feed. Resume re-derives waiting-vs-running per run
   (`lib/automations/run-controls.ts` `partitionResume`, unit-tested) so a
   pending scheduled wait isn't skipped. No schema change.
3. ✅ **Run an automation now (shipped 2026-06-17).**
   `runAutomationForCoupleAction` (direct run-open + inline
   `advanceRunNow`, no migration) + `CoupleRunPicker` popover +
   `loadRunnableAutomationsAction`. Per-user rate-limited. Includes a
   **Test** variant (`testAutomationForCoupleAction`): actions run for
   real, but `send_email` routes any email to the MC (tagged `[Test]`)
   instead of the couple. Header shows both a Test and a Run popover.
4. ✅ **Upcoming + summary strip (shipped 2026-06-17).** `summarizeRuns`
   header strip (active / waiting / failed-30d), `wakeAt` surfaced on
   waiting runs ("Next step …") from `automation_waits`.
   **Suppression awareness deferred** — no `couples.do_not_contact` field
   exists; revisit if/when one is added.
5. **(Stretch) "Eligible but not fired" transparency** + Overview-tab
   failure nudge.

## Docs to update as phases land

| Phase touches | Update |
|---|---|
| Couple-profile page behaviour | `page-specs.md` |
| New server actions / manual-run mechanism | `automations.md` |
| Any new column (`source`) / RLS | `database-schema.md`, `security.md` |
| Rate-limit on manual-run/retry | `security.md` |
| Tests / selectors | `testing.md` |

## Related files (reuse map)

- `app/(dashboard)/couples/couple-automations.tsx` — current tab (replaced).
- `app/(dashboard)/automations/[id]/runs-panel.tsx` — existing canvas-side
  run drawer; same RLS read pattern, same `friendlyRunError` usage.
- `app/(dashboard)/automations/actions.ts` — server-action home;
  `pauseCoupleRunsAction` is the pattern to mirror.
- `lib/automations/runner.ts` — writes `automation_audit_log`; the `audit()`
  helper (line ~403) defines the `event` + `details` shape narration reads.
- `lib/automations/launch-catalogue.ts` — visibility allowlist for the run
  picker.
- `lib/automations/config-errors.ts` — `friendlyRunError`.
- `supabase/migrations/20260604000000_create_automations_foundation.sql` —
  `automation_audit_log` shape + `emit_automation_event` signature.
- `types/automations.ts` — `AutomationRunRow`, `RunStatus`,
  `RUN_STATUS_LABELS`.
