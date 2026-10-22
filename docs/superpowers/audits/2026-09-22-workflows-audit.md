# Workflows audit (2026-09-22)

Scope: the whole Workflows / automations surface on branch
`fix/tick-every-minute` (commit 3d668079): engine (`lib/workflows`,
`lib/automations`), cron routes, builder, Upcoming queue, couple
Workflow tab, email pipeline, migrations. Method: six independent
read-only code reviews (engine, security, email, triggers, actions,
UI/UX), every Critical / High claim re-verified by hand against the
code, a live walk of the running app (builder, composer, couple
Workflow tab, Emails tab), and the existing test suites run on this
branch: 90 unit files / 988 tests green, 17 integration files / 134
tests green against local Supabase.

Nothing was changed. This document is findings only; each item has a
minimal fix so it can be ticketed.

Severity key: **Critical** = a couple can receive a wrong, duplicate
or unstoppable email, or another tenant can be affected. **High** = a
real business outcome is lost or invisible. **Medium** = a gap a
seasoned CRM would not have. **Low** = polish.

## Critical

### C1. A due step can run twice (double send)

`lib/workflows/executor.ts:282` claims a step with
`update({ status: 'running' }).eq('id', step.id)`: no status guard, no
returned-row check. The tick reads up to 200 candidates once
(`executor.ts:127-146`) and then loops over them for up to 30 seconds,
so a row's in-memory status is stale. `runStepNow` (`executor.ts:427`)
and `retryStepAction` check status in memory too.

Failure: an MC approves a held send at the same moment the per-minute
tick (or the immediate `scheduleKick` from a couple mutation) picks
the same step up. Both see `pending`, both set `running`, both call
Resend. The couple gets the email twice. With the tick now every
minute and the kick on every couple write, the overlap is routine, not
theoretical.

Fix: claim atomically. `update({ status: 'running' }).eq('id',
id).in('status', ['pending','waiting']).select('id')` and skip when
zero rows come back. Apply in `runOneStep` so every caller inherits it.
Add an integration test that runs `advanceDueSteps` and `runStepNow`
concurrently on one step and asserts one send.

### C2. `emit_automation_event` is callable by any signed-in user

`supabase/migrations/20260604000000_create_automations_foundation.sql:632`
grants EXECUTE to `authenticated`; the function is SECURITY DEFINER
and takes `p_user_id` from the caller with no `auth.uid()` check. Any
account can write events onto another tenant's bus and fire their
workflows (emails to their couples). The revoke exists only on the
unmerged `feature/r2-proposals-in-workflows` branch (migration
`20261002100000`). It is still live on dev and prod today.

Fix: ship that revoke ahead of, or with, everything else. Add a
cross-tenant integration test calling the RPC as user A with user B's
id.

### C3. "Turn off" does not stop emails already scheduled

The executor never reads the template's status (`executor.ts` has no
template lookup; `loadInstance` checks only `workflow_instances.status`).
`setTemplateStatusAction` (`app/(dashboard)/workflows/actions.ts:95`)
only flips the template row. So turning a workflow off stops new
applies, but every couple already inside it keeps receiving sends.
Nothing in the toggle, the card or the header says this (the delete
dialog does: "Couples already running it keep their steps").

There is also no account-wide pause. The only "stop" controls are the
per-couple "Stop everything" (`cancelCoupleWorkflowsAction`) and the
per-template toggle.

Fix: (a) on turn-off, also pause that template's active instances
(`workflow_instances.status = 'paused'`, resumable), or at minimum a
confirmation naming the N couples that will keep running; (b) a
"Pause all automation" switch in Settings / the Workflows header that
the executor and dispatcher check first.

### C4. Cancelled workflows can starve the executor for everyone

The due query (`executor.ts:127-146`) has no instance-status filter;
cancelled instances keep their pending steps with past `due_at`
(`cancelInstanceAction` only flips the instance). The query is
oldest-first, `limit 200`, and each dead row is skipped in code
(`executor.ts:193`). Once 200 such rows accumulate across all tenants,
every tick fills its budget with rows it cannot run and no real send
goes out, silently. The unscoped cron pass makes this cross-tenant.

Fix: filter in SQL (`workflow_instances!inner(status)` = active, as
`queue.ts:213` already does), and/or mark steps `cancelled` when the
instance is cancelled.

### C5. Applying a workflow to a couple fires every past-dated step at once

`computeDueAt` (`lib/workflows/timing.ts:107-113`) returns the wedding
date minus the offset with no "already passed" check, and the executor
runs anything with `due_at <= now`. Start a workflow whose steps are
"6 months before", "3 months before", "1 month before" on a couple
whose wedding is in five weeks, and the next tick sends the first two
emails back to back, then chains into whatever follows them. The same
happens when a trigger applies a template to an existing couple with a
near wedding date. Neither the couple tab's "Start" button
(`workflow-apply-picker.tsx`) nor the apply action warns; the dry run
would show it but is not on that path. Dubsado is infamous for exactly
this and now warns; HoneyBook skips past-dated steps on enrolment.

Fix: at apply time, mark automated steps whose computed `due_at` is
already past as `skipped` (with an audit line "date already passed"),
or hold them for approval; show the projected calendar (dry run) in
the Start dialog with the past rows flagged.

## High

### H1. The same workflow can be applied twice to one couple

`instantiate.ts:112-123` dedupes with a select-then-insert; the only
unique index is per trigger event
(`workflow_instances_unique_per_event_idx`). Two events for the same
couple in one tick (a stage move plus a note, a kick racing the cron)
create two instances and two sets of emails. Live: the test couple
"Michael and Tara" carries three identical "Contract signed: follow up
with couple" done steps stamped 6:47pm on 5 Sep, which is what this
race produces.

Fix: partial unique index on `(template_id, couple_id) where status
<> 'cancelled'` for templates with `allow_reapply = false`, and treat
the conflict as "already applied".

### H2. The MC never sees the email the couple actually gets

- The builder's Compose email modal has no preview at all (verified
  live; the run-sheet and questionnaire composers do have one).
- The review modal / step detail (`lib/workflows/review.ts:88,123`)
  renders the body through `docToText`, i.e. plain text. The send path
  renders the TipTap doc to HTML inside the branded shell with the
  MC's signature (`lib/automations/actions/messaging.ts:111`). Bold,
  lists, links, the shell, the signature and the footer are invisible
  before send.
- Nowhere shows From, Reply-To, the recipient address, attachments or
  the send time in the MC's timezone (`StepPreview` in `review.ts:49`
  has subject/body/unresolved only).

Dubsado / HoneyBook show a full envelope (From, To, time) over the
rendered HTML before the send button. Fix: one `EmailPreview`
(`[id]/email-preview.tsx` already exists) fed by the send renderer,
used by both the composer and the step modal, with an envelope line
built from `resolveSender` + `resolveRecipients` + `due_at`.

### H3. Automated emails leave no record the MC can find

`couple_emails` (the couple's Emails tab: subject, recipient, Sent,
date) is written only by the manual send routes
(`app/api/email/send-template`, `send-proposal`, the test send). The
workflow send path writes nothing there; the only trace is
`message_ids` inside `workflow_steps.output` and an audit line "Done:
<title>" with no recipient or time (verified live on the Activity
feed). There is no Resend bounce / delivery webhook anywhere in
`app/api`, so "did it arrive" is unanswerable.

Fix: write a `couple_emails` row from `messaging.ts` on success (and a
failed row on error); add the Resend events webhook and surface
delivered / bounced on that row.

### H4. Failures are quiet, unretried, and block everything behind them

`executor.ts:376-378`: an error marks the step `errored` and returns
before `recomputeInstance`, so followers keep `due_at = null`. There
is no automatic retry (a 30-second Resend blip is a permanently
stalled workflow until a human presses "Try again"). Only
`missing_variables` raises a Slack alert; provider errors do not.
`retryStepAction` (`instance-actions.ts:255`) then calls
`advanceDueSteps(admin)` with no `userId`, running every tenant's due
steps inside one MC's request, the opposite of the rule `kick.ts`
enforces.

Fix: retry transient errors with backoff (2 to 3 attempts, then
errored); `sendAlert` on every errored step; scope the retry to the
one step (`runStepNow`).

### H5. Editing a step on a couple can write a config the runner rejects

`updateStepConfigAction` (`instance-actions.ts:792`) accepts
`z.record(z.string(), z.unknown())` and writes it raw. The copilot
validates every write against the action's runner schema
(`ai-copilot/tool-schemas.ts`); the UI does not. A blanked subject
saves fine and dies at send time as an errored step.

Fix: `getActionSpec(actionType).configSchema.safeParse(next)` before
the update, returning the same friendly error `config-errors.ts`
produces.

## Medium

### M1. A step can get stuck in `running` forever

Status is set to `running` before the provider call and `done` after.
If the DB write after a successful send fails or the function is
killed at the budget, the row stays `running`: the tick only selects
`pending` / `waiting`, and "Try again" only accepts `errored`. Nothing
sweeps it, nothing alerts. Resend is also called without an
idempotency key (`lib/email/dispatch.ts:69`), so any future retry of
such a row is a duplicate.

Fix: pass `idempotencyKey: step.id` (or `${step.id}:${attempt}`) to
Resend; a tick sweep that flips `running` older than N minutes to
`errored` with a clear message.

### M2. HTML-only emails, no text/plain alternative

`dispatch.ts:69-80` (Resend) sends `html` only; the Gmail MIME builder
(`dispatch.ts:128`) and Graph (`:170`) are HTML-only too. Spam
scoring and text-only clients suffer. Fix: derive `text` from the
TipTap doc (`docToText` already exists) and send multipart/alternative.

### M3. Quiet hours do not apply to sends

`execute-step.ts:54-62` only shifts a `sleep` whose reason is `wait`.
A send timed 9:15pm goes at 9:15pm. `.claude/docs/workflows.md:126`
says the opposite. Quiet hours are only reachable through the wait
step's chip. Fix: either apply the window to a send's `due_at` at
recompute time, or correct the doc and label the chip "for this
wait".

### M4. Stale events are dropped silently

`dispatcher.ts` stamps anything older than 24h as `skipped: stale`
with no Slack alert and no count on the Admin card. After any outage
over a day (the June to September prod outage was exactly this) every
enquiry that arrived is dropped without a trace. Fix: `sendAlert` with
the count whenever `staleEvents > 0`; show it on the Scheduler card.

### M5. Header injection on the Gmail / Outlook transport

`dispatch.ts:117-124` builds raw `Subject:`, `To:`, `Cc:` lines;
`encodeHeaderWord` only encodes non-ASCII, so an ASCII `\r\n` in a
rendered subject (a couple name from a lead form, a contact email)
becomes an extra header. Resend's JSON path is not affected. Fix:
strip `\r` / `\n` from every header value in `buildMime`, and reject
newlines in couple / contact name and email inputs at the Zod
boundary.

### M6. Partial send failure looks like success

`messaging.ts:335-363`: one of two recipients failing still returns
`ok`, the step shows a green tick, and the failure lives only in
`output.last_error`. Fix: `errored` (or a visible warning state) when
any recipient fails; alert.

### M7. Nothing stops an unfinished workflow being turned on

No canvas validation: a template with zero steps, an unconfigured
email (no subject), a branch with no condition (`branchConfigSchema`
requires `predicate`; the builder saves `{}`), an appointment still
titled "Give it a name" (seen live), all activate. Steps with default
timing show no chip, so "sends immediately" is implicit. Fix:
pre-flight check on Turn on listing the problems; badge unconfigured
cards; show "Immediately" as the timing chip.

### M8. `invoice_overdue` accepts a filter it never enforces

`time-emitters/invoice-overdue.ts:49-56`: `daysUntilEvent*` is in the
schema and the chip list but `match()` ignores it. Fix: enforce or
remove the chip.

### M9. Copy and design drift

- 70 em dashes in builder copy (`inspector-panel.tsx` 11,
  `email-composer-modal.tsx` 9, ...), against the house rule.
- Jargon on screen: the composer's "Options: shell · branded" chip;
  the couple tab's "0 opens"; the queue tab and the sidebar item are
  both "Workflows" while the sidebar's "Templates" means email
  templates.
- `bg-white` in `email-preview.tsx`, `border-gray-100` in
  `command-palette.tsx`, inline `style={{}}` in `canvas-skeleton`,
  `command-palette`, `mobile-step-list`, `flow-node`.
- File sizes: `inspector-panel.tsx` 1597 lines, `inspector-extended.tsx`
  1130, `instance-actions.ts` 982, `[id]/page.tsx` 852,
  `email-composer-modal.tsx` 589 (rule is ~150).

### M10. The Done strip and Activity feed carry too little

Done rows show a struck title only (no time, no recipient); Activity
shows "4 Sept · Done" lines with empty titles and "Done: <title>" with
no time. A seasoned CRM's per-couple timeline reads "Sent 'Thanks for
reaching out' to sarah@... at 2:15pm, opened 3:40pm".

## Low

- L1. Graph `/sendMail` returns 202 with no id; `messageId` is empty
  for Outlook senders (`dispatch.ts:191`).
- L2. Instance status is checked before, not after, the provider call:
  a cancel during a running step still sends. Acceptable if documented.
- L3. `time-before-event.ts:152-162` dedupe is N+1 per event id.
- L4. No sidebar badge for steps needing the MC, no bulk select /
  bulk skip in the queue, no "sends in 12 min" countdown on a due row.

## Checked and sound

- RLS on all seven workflow tables plus `automation_events`, join table
  checks both sides, cross-tenant integration tests exist and pass.
- Every server action and both AI routes validate with Zod; AI routes
  have burst limits and a shared DB-backed daily cap; cron routes use
  constant-time, fail-closed `isCronAuthorized`; no service-role key
  reaches a client file.
- Rendered templates pass through `sanitizeHtml`; variables resolve by
  key with no prototype traversal; the copilot's writers validate
  against the runner schemas.
- All 28 picker-visible triggers have a real emitter; DB triggers fire
  on the right column changes (`is distinct from`); time emitters
  dedupe per UTC day and lead time; hidden / retired triggers still
  parse.
- Timing arithmetic composes the DST-safe timezone helpers; null
  wedding dates leave steps unscheduled rather than guessing; an
  events-date change recomputes wedding-relative steps via DB trigger.
- The kick is owner-scoped and windowed; the tick's executor-first
  budget, heartbeat and Postgres watchdog are as designed.
- Review-before-send gate, "Needs your OK" pill, per-couple "Stop
  everything", snooze, skip, reopen, keyboard navigation and the
  mobile list all work as documented.

## Feature inventory against HoneyBook, Dubsado, Studio Ninja, 17hats

Each row was checked in the code, not assumed. "Missing" means no
code path exists; "partial" means the engine has it but the MC cannot
reach it.

| Capability | Where the others have it | Zebri | Evidence |
|---|---|---|---|
| Rendered email preview with From / To / time before it sends | all four | missing | H2 |
| Send a test of a workflow email to yourself from the composer | HoneyBook, Dubsado, Studio Ninja | missing in the builder (only the couple Emails tab has "Test"); the action has a test mode nobody can reach | `messaging.ts:257`, no "test" in `email-composer-modal.tsx` |
| Skip or warn on steps whose date has already passed when enrolling | HoneyBook skips, Dubsado warns | missing, fires them all | C5 |
| Pause and resume a workflow on one couple | HoneyBook, Dubsado, Studio Ninja | partial: `resumeInstanceAction` exists, the couple tab only offers Stop, nothing offers Resume | grep of `couple-workflow*.tsx` |
| Account-wide "pause all automations" | 17hats, HubSpot, ActiveCampaign | missing | C3 |
| Turning a workflow off pauses its live enrolments | HoneyBook, Dubsado | missing, they keep sending | C3 |
| Exit / unenrolment rules ("stop this workflow when the couple becomes Lost or Booked") | HubSpot goals, ActiveCampaign goals, Dubsado end-workflow triggers | missing: a couple marked Lost keeps receiving the nurture sequence | no cancel path in `dispatcher.ts` or `apply-rules.ts` |
| Suppress a template email the couple already received, or cap automated emails per couple per day | HubSpot, ActiveCampaign | missing | no such check in `messaging.ts` / `executor.ts` |
| Re-enrolment control visible to the MC | HubSpot, Dubsado (apply again) | partial: `allow_reapply` exists on the table and in `actions.ts`, no builder control; the couple tab's "Start again" warns correctly | grep `allowReapply` in `app/` |
| Reschedule a scheduled send to an exact date and time | all four | partial: date picker only on manual steps; sends get Tomorrow / Next week | `step-detail-edit.tsx:52`, `upcoming-list.tsx:221` |
| Per-couple log of every automated email with recipient, time, delivered / opened / bounced | HoneyBook, Studio Ninja, 17hats | missing for automated sends; no open tracking anywhere | H3, no `opened_at` in `couple_emails` |
| Notify the MC when an automated email goes out (not only a morning digest) | HoneyBook, Dubsado (optional) | missing | only `workflow-digest` |
| Business-hours / weekday-only sending for automated steps | 17hats, HubSpot | missing: `sendTime` on two timing modes, quiet hours only on waits, weekend fields deleted as dead | M3 |
| Pending-approval queue | all four | present ("Needs your OK" on Upcoming) | sound |
| Bulk-apply a workflow to many couples (a stage's worth) | Dubsado | missing, one couple at a time | `use-couple-workflows.ts:106` |
| Validation that blocks activating a broken workflow | HubSpot, ActiveCampaign | missing | M7 |
| Automatic retry on provider failure | HubSpot, ActiveCampaign | missing | H4 |
| Branching / conditions | 17hats (limited), HubSpot | present | sound |
| Template edits do not disturb couples mid-workflow | Dubsado (yes), Studio Ninja (no, resets) | present, by design | sound |
| Variable fallback values (`{{couple.venue}}` else "your venue") | HubSpot, ActiveCampaign | missing: unresolved renders blank | `templates.ts:227-238` |
| Template gallery / marketplace | HoneyBook, Dubsado | removed on purpose 2026-09-06 | not a gap |

## Suggested fix order

1. Engine safety, one PR: atomic claim (C1), active-instance filter in
   the due query (C4), unique enrolment index (H1), scoped retry (H4),
   stuck-running sweep + Resend idempotency key (M1). Integration tests
   for each race.
2. Ship the `emit_automation_event` revoke (C2) by merging R2 or
   cherry-picking its migration.
3. Stop controls and enrolment safety: skip or hold past-dated steps
   on apply with the projection shown in the Start dialog (C5), pause
   instances on Turn off with a confirmation, account-wide pause,
   cancelled steps marked cancelled, Resume exposed on the couple tab,
   exit rules on Lost / Booked (C3 and the inventory).
4. Email fidelity: HTML preview with envelope in composer and modal
   (H2), `couple_emails` logging + Resend webhook (H3), text/plain
   (M2), partial-failure state (M6), header hardening (M5).
5. Failure visibility: retry with backoff + Slack alert on every
   errored step (H4), stale-event alert (M4).
6. Validation: runner-schema parse on instance edits (H5), canvas
   pre-flight on Turn on (M7), `invoice_overdue` filter (M8).
7. Copy, tokens, file splits (M9, M10), quiet-hours doc or behaviour
   (M3).
