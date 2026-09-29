# Slack Alerting

Zebri uses lightweight Slack alerting for operational visibility. All alerts flow through a single API gateway and are delivered to Slack via Incoming Webhook.

---

## Architecture (Phase 0.6)

Alerts flow through a typed event catalog and a single dispatcher:

```
                            ┌─ Slack webhook       (lib/alerts/slack.ts)
sendAlert(event) ──────────┤
  (lib/alerts/send-alert)   └─ logger (Vercel runtime logs + transports)
```

- **`lib/alerts/events.ts`** — discriminated-union catalog of every alert
  the app can dispatch. Adding a new alert means adding a variant here.
- **`lib/alerts/send-alert.ts`** — `sendAlert(event)` formats a Slack
  message and writes a structured log record at the matching severity.
- **`lib/alerts/logger.ts`** — structured logger (debug/info/warn/error
  + `.child({...})`). Writes to console; additional destinations plug in
  via `registerTransport`.
- **`lib/alerts/slack.ts`** — low-level Slack webhook transport (still
  available for one-off custom Block-Kit payloads). Owns the local-run
  suppression gate, `slackSuppressed()`.

### Local run suppression

**No Slack delivery ever leaves a local machine.** The gate lives in
`sendSlackAlert` (the transport), not in `sendAlert`, because several
call sites post to Slack directly and would otherwise bypass it:

- `app/api/stripe/webhook/route.ts`
- `app/api/email/send-contract/route.ts`
- `app/api/alerts/slack/route.ts`, which the client error boundaries
  (`app/error.tsx`, `app/global-error.tsx`, `app/providers.tsx`) POST to
  on every uncaught render or query error

`slackSuppressed()` returns true on two signals: `NODE_ENV ===
'development'` (the dev server) and a `NEXT_PUBLIC_APP_URL` pointing at
localhost / 127.0.0.1 / ::1 (catches a local production build run with
`npm run build && npm start`). Vercel always sets a real domain, so
neither fires in a deployed environment.

Structured log records are still written in every case; look for
`slack alert suppressed (local run)` in the console. Local checkouts
share the production webhook through `.env.local`, which is what makes
this gate necessary. To deliberately test Slack delivery from a local
server, set `ALERTS_DEV_SLACK=1` (it overrides both signals).

Covered by `tests/unit/alerts/slack-transport-suppression.test.ts` (the
transport gate) and `tests/unit/alerts/send-alert-suppression.test.ts`
(the dispatcher's log-and-return behaviour).

> **Observability stack:** Vercel runtime logs (captures every logger
> write) + Slack alerts via `sendAlert()` + the existing global error
> boundaries (`app/error.tsx`, `app/global-error.tsx`, `app/providers.tsx`)
> which already Slack on uncaught errors. **Sentry is deferred** —
> roadmap §1 amended to "Slack-only (Sentry deferred)".

The Slack webhook URL is server-only and never exposed to the client (`SLACK_WEBHOOK_URL`, not `NEXT_PUBLIC_`).

---

## PII policy (Phase 4, Task 27)

**No couple-side PII in a Slack payload.** A couple's name, and any
couple, contact, vendor or guest email, name or phone number, stays out
of every `AlertEvent`. Where the alert used to name who a send or
event was about, it now carries the id instead (`coupleId`,
`contactId`, `bookingId`, …), and support looks the couple up in the
app from the id rather than reading it off Slack.

**MC account emails stay.** The MC is Zebri's own paying customer, not
the person the alert is protecting; `email` / `targetEmail` /
`reporter` name the MC's own Zebri account on the specific events
listed in the allowlist below, and the founder's signup and billing
alerts depend on being able to read them. This is the T27 ruling:
strip couple-side PII, keep MC-side.

What changed to get there:

| Event | Before | After |
|---|---|---|
| `resend_send_failed` | `to` (recipient address), `subject` (rendered subject line) | both dropped; no id was threaded to this (unused) call site |
| `resend_bounced` | `to` (recipient address), `subject` (rendered subject line) | `userId` (the tenant whose `email_suppression` row this wrote); `subject` dropped, not replaced (fix round 1, I2) |
| `automation_paused_missing_variables` | `coupleName` | `coupleId` |
| `workflow_email_sent` | `to` (recipient address), `coupleName`, `subject` (rendered subject line) | `coupleId` (unchanged), `contactId` (the resolved recipient's `couple_contacts` row id, null for the couple's own primary/spouse address), `stepTitle` in place of `subject` (fix round 1, I2, Q2: the step's own display title, `stepDisplayTitle()` in `lib/workflows/step-label.ts`, never carries per-couple interpolation the way a rendered subject can) |
| `proposal_accepted` / `proposal_opened` / `proposal_declined` | `coupleName` | `coupleId` |
| `booking_created` | `bookerName` | `bookingId` |

**Enforcement, two layers:**

1. **Compile-time.** `lib/alerts/events.ts` exports two type-level
   assertions (`assertNoCoupleNameKey`, `assertNoBookerNameKey`) built
   from a `KeysOf<AlertEvent>` distribution over the union. If
   `coupleName` or `bookerName` ever reappears on any `AlertEvent`
   member, the file fails to typecheck.
2. **Runtime.** `assertNoCouplePii()` in `lib/alerts/send-alert.ts` runs
   on every event `sendAlert()` dispatches, before the log record and
   the Slack line are built. It scans every field, recursively into
   arrays and plain objects up to a small depth cap (fix round 1, M1: no
   current field nests that deep, but the guard's job is to catch the
   next regression, not just today's shapes). A field not allowlisted
   for that exact `${type}:${field}` pair (fix round 1, I1: the
   allowlist is keyed by event type *and* field, not field name alone,
   so a future event that happens to reuse the name `email` for a
   couple address is not waved through by a same-named MC-side field on
   a different event) that looks like an email address means a call
   site regressed. In the test environment (`NODE_ENV === 'test'`) it
   throws, so the regression fails the suite that introduced it;
   everywhere else it redacts the field to `[redacted]` in place rather
   than dropping the alert, since an incident is still worth knowing
   about with one field masked.

Covered by `tests/unit/lib/alerts/no-couple-pii.test.ts`: one
representative payload per `AlertEvent` type (built from a mapped type
keyed by `AlertEvent['type']`, so a new variant with no fixture fails
to compile), asserting none carries couple-side PII and that
`assertNoCouplePii` passes every one through untouched, plus direct
coverage of the type+field keying and the nested-array/object recursion
(fix round 1, I1 and M1).

Known residual risks, not fixed here:

- A free-text field rendered from a template can still contain a
  couple's name if the MC's own template interpolates one. This applied
  to `workflow_email_sent.subject` and identically to
  `resend_send_failed.subject` / `resend_bounced.subject` (fix round 1,
  I2); all three now either drop `subject` or replace it with the
  step's stored `stepTitle`, which is written once in the builder and
  never carries per-couple interpolation. The guard only catches an
  *email-shaped* string, not a name inside free text, so a template
  that still spelled out a couple's name in some other surviving field
  would not be caught. None do today.
- The changed formatters give an id (`coupleId`, `contactId`,
  `bookingId`) but no clickable app link, so a name that used to make
  the Slack line self-explanatory now takes a manual lookup. No
  app-URL-building helper exists in `lib/alerts/send-alert.ts` today
  (checked for one during fix round 1, M2); adding a first one and
  wiring couple deep links through it is a follow-up, not attempted
  here to keep this fix mechanical.

---

## Alert matrix

1:1 with `AlertEvent` in `lib/alerts/events.ts`. Severity drives the
default emoji and routing.

| `type` | Severity | When | Source (target) |
|---|---|---|---|
| `signup_completed` | info | New MC completes signup | `app/(auth)/signup` |
| `subscription_created` | info | Stripe sub starts | `/api/stripe/webhook` |
| `subscription_cancelled` | warn | Sub cancelled | `/api/stripe/webhook` |
| `subscription_churn` | warn | Paid → free / lapsed | `/api/stripe/webhook` |
| `payment_failed` | error | Charge / invoice failure | `/api/stripe/webhook` |
| `stripe_webhook_failed` | error | Signature invalid / handler threw / payload schema fails | `/api/stripe/webhook` |
| `stripe_webhook_replay` | warn | Same event ID delivered ≥ 3× within 60s (Phase 2A) | `/api/stripe/webhook` |
| `stripe_rate_limit_hit` | warn | Per-route rate limit hit (checkout/portal/billingHistory/invoicePayment) | `/api/stripe/*` (Phase 2A) |
| `stripe_events_prune_high` | warn | Daily prune deleted > 5,000 ledger rows (Phase 2A) | `/api/cron/prune-stripe-events` |
| `stripe_connect_onboarding_failed` | warn | Connect onboarding errored | `/api/stripe/connect/*` |
| `stripe_connect_disabled` | warn | `account.updated` webhook reported a non-null `requirements.disabled_reason` — Stripe paused some capability and the MC needs to action it (Phase 2D.1) | `/api/stripe/webhook` (Connect branch) |
| `stripe_connect_deauthorized` | warn | MC removed our platform from their Stripe account via the Stripe Dashboard (Phase 2D.1) | `/api/stripe/webhook` (Connect branch) |
| `email_rate_limit_hit` | warn | Per-user send-proposal / send-invoice / send-template limit hit (Phase 2C; `action` discriminates) | `/api/email/send-{proposal,invoice,template}` |
| `automation_paused_missing_variables` | warn | A `send_email` step using a saved template hit an unresolved variable for a couple. The step parks on a far-future wake time and never resumes by itself, so this alert is the only signal the email did not send; the MC fixes the data and retries the step from the couple's Workflow tab. `automationId` carries the template id (or the instance id for an ad-hoc workflow), `runId` the instance id, `coupleId` the couple (ids only, T27, never the couple's name) | `lib/workflows/executor.ts` |
| `automation_emitters_skipped` | warn | The time-emitter pass ran out of its slice of the tick (`EMITTERS_BUDGET_MS`) before every emitter had a turn. Not the same as a truncated tick: `step_overdue` defers safely, but `time_before_event`, `time_after_event`, `anniversary_of_event`, `invoice_due` and `invoice_overdue` all fire on a date being exactly so many days out, so an emitter that never ran has missed that day for every couple it would have matched and nothing replays it. `step_overdue` runs last precisely so it is the one that gets cut. If this fires, find out what is taking the slice. Carries `skipped` (trigger types, in registry order) and `ran` | `lib/automations/time-emitters/index.ts` |
| `automation_overdue_scan_capped` | warn | The `step_overdue` time emitter stopped early and left overdue steps unprocessed. `reason` says which ceiling it hit: `row_ceiling` (more than `MAX_ROWS_PER_RUN` overdue steps, which is a runaway rather than a busy day) or `deadline` (the emitter pass ran out of its slice of the tick, `EMITTERS_BUDGET_MS`). Either way the rest wait for the next run, a quarter hour later. Nothing to do on a one-off. If it fires every run, the overdue backlog is outgrowing what one pass can drain: check why so many steps are stuck, then raise the ceiling or the slice. Carries `reason`, `scanned` and `ceiling` | `lib/workflows/emitters/step-overdue.ts` |
| `automation_overdue_read_failed` | error | A read the `step_overdue` emitter depends on failed, or came back holding rows that could not be trusted. `stage` says which: `scan` (the page-through read errored, so the run does not know what it missed), `dedupe` (the dedupe read errored, so a batch of steps was skipped rather than risk re-nagging a couple), `dedupe_truncated` (the dedupe read came back holding exactly its row cap, indistinguishable on the wire from a genuinely complete read). Check Postgres/PostgREST health; the emitter should recover on its own on a later run. Carries `stage`, `count`, `errorMessage` | `lib/workflows/emitters/step-overdue.ts` |
| `workflow_step_stuck` | error | The tick's stuck-step sweep (`sweepStuckSteps`, first thing every tick) recovered one or more steps that were claimed (`running`) by a function that then died or failed to write, and had sat past the 10-minute staleness window. Each is errored: the send may or may not have left, so the MC should check the couple before pressing Try again (which resets the attempt count). No couple names or email addresses, just step ids. Carries `count` and up to ten `stepIds` | `lib/workflows/executor.ts` |
| `workflow_step_failed` | error | An automated step exhausted its attempts and the executor buried it `errored`; everything gated behind it stays stuck until it is retried. Usually three attempts (1-minute then 5-minute backoff), but one when the action reported the failure as unrecoverable: a setting only the MC can fix, or a send through a connected Gmail / Microsoft mailbox, where a retry cannot be deduplicated and would risk a second copy reaching the couple. Open the step, read `message`, fix whatever is wrong, then Try again. Carries `stepId`, `instanceId`, `attempts`, `message` | `lib/workflows/executor.ts` |
| `workflow_email_sent` | info | Fires once per delivered recipient right after a successful `send_email` dispatch, so the owner sees automated sends as they happen instead of discovering them later from a message id buried in `workflow_steps.output`. No recipient address, couple name or rendered subject line (T27, and fix round 1 I2: the recipient is always a couple, contact or vendor, never Zebri's own customer, and a rendered subject can carry the couple's name through `{{...}}` interpolation); carries `stepTitle` (the step's own display title, `stepDisplayTitle()` in `lib/workflows/step-label.ts`, written once in the builder and never per-couple), `coupleId`, `contactId` (the resolved recipient's `couple_contacts` row id, null for the couple's own primary/spouse address), `stepId`, `messageId`. A handful a day at current volumes; if it becomes noise the fix is a per-tick digest, not a filter | `lib/automations/actions/messaging.ts` |
| `workflows_account_paused` | warn | An MC pressed the account-wide workflow stop, or lifted it (Task 18). A stop usually means a workflow just did something the MC did not expect. Carries `userId`, `action` (`paused` or `resumed`) | `pauseAccountWorkflowsAction` / `resumeAccountWorkflowsAction` in `app/(dashboard)/workflows/account-pause-actions.ts` |
| `workflow_exit_failed` | error | The dispatcher's exit-rule call (`exit_workflow_instances_for_stage`) failed for a couple's stage change (Task 21), so a workflow that should have stopped for that couple is still running. The event's applies still ran; the event is left unprocessed and retried whole every tick (the exit only matches running and paused instances, and an apply is unique per template and event, so the retry is idempotent) until it works or turns stale after 24h. Deduped to one alert per tenant per hour in `lib/workflows/exit-dispatch.ts`. Check Postgres/PostgREST health; if it persists, stop the couple's workflow by hand. Carries `userId`, `coupleId`, `eventId`, `toStatus`, `message` | `lib/workflows/exit-dispatch.ts` (`reportExitFailure`), called by `lib/workflows/dispatcher.ts` |
| `workflow_chain_failed` | warn / error | One workflow could not hand a couple on to the next (`lib/workflows/chain.ts`). `depth_limit` (warn): a chain opened more than `MAX_CHAIN_DEPTH` (5) workflows in a row, almost certainly workflows starting each other in a loop; the Start workflow step errors with the reason, or the dispatcher opens nothing for that `workflow_completed` event. Look at the MC's Start workflow steps and Workflow completed triggers for a cycle. `emit_failed` (error): a workflow completed but its `workflow_completed` bus event could not be written, so anything set to start after it did not; the completion itself stands. Check Postgres/PostgREST health and start the next workflow on that couple by hand. Carries `userId`, `coupleId`, `instanceId`, `reason`, `message` (never a name) | `start_workflow` in `lib/automations/actions/workflow.ts`, `reportChainCapped` in `lib/workflows/dispatcher.ts`, `lib/workflows/emitters/workflow-completed.ts` |
| `workflow_send_rate_limited` | warn | A tenant's automated sends hit the per-tenant `WORKFLOW_SEND_BURST_LIMIT` (20/min) or `WORKFLOW_SEND_DAILY_CAP` (500/day) in `lib/api/rate-limit.ts` (Task 15, workflows trust remediation). `scope` says which. The step is deferred (`kind: 'sleep'`, `reason: 'send_rate_limited'`), not failed, so nothing was lost, it wakes on its own once the window resets. The burst limit is in memory; the daily cap counts the tenant's automated `couple_emails` rows from the last 24 hours that actually left (`sent`, `delivered`, `bounced`, `complained`, `deferred`; never `failed`, Phase 5 fix wave M1) (Task 30), so it holds across cold starts and is shared by the tick and approve-and-send, and its `retryAfterMs` is when the row that has to age out for this step to fit does (`automatedSendWindowReopensAt`: with `count` rows in the window, `count + weight - max` must go, oldest first), at least a minute. A daily count that cannot be read defers the step a minute under its own reason and raises `workflow_send_cap_unreadable` instead. The daily cap counts `transport = 'resend'` rows only. Deduped in `checkWorkflowSendLimit` to one alert per tenant per threshold per window, so a large legitimate bulk send does not spam the channel. Carries `userId`, `scope`, `attempted`, `retryAfterMs` | `enforceWorkflowSendLimit` in `lib/email/automation-send.ts`, called by the send gate (every gated automated action) and by `send_email` (shared-domain sends only) |
| `resend_send_failed` | error | Resend API rejected / errored. No `to` and no `subject` (T27, and fix round 1 I2: the recipient is a couple, contact or vendor, never Zebri's own customer, and the rendered subject line carries the same interpolation risk); this call path is currently unused, so there is no id to carry instead | `/api/email/*` |
| `workflow_send_cap_unreadable` | error | The per-tenant daily send count (`couple_emails`) could not be read, so `checkWorkflowSendLimit` held the send (fail closed, Task 30 fix round 1). Nothing hit a limit: the step parks with reason `send_check_unavailable`, narrated "sending check unavailable, retrying automatically", and re-checks every minute. A persistent failure holds every shared-domain automated send while the tick looks healthy, hence an error. Carries `userId` and `code` (the database / PostgREST error code, never a message). Deduped to one per tenant per ten minutes | `enforceWorkflowSendLimit` in `lib/email/automation-send.ts` |
| `workflow_events_stale` | error | The dispatcher stamped bus events older than 24 hours (`STALE_EVENT_MS`) as `skipped: stale` instead of dispatching them (Task 36, audit M4). After any outage over a day every enquiry that arrived during it goes this way, and before this alert nothing said so. Raised from the stale sweep itself, so both the cron tick and the per-MC kick report it. Carries `count` (this batch), `suppressed` (events earlier batches skipped inside the dedupe window without an alert of their own, so none goes uncounted) and `userId` (the MC for a kick, null for the cron sweep). Deduped in memory to one per scope per ten minutes, like `workflow_send_cap_unreadable`. Each batch also stamps the `workflow-stale-events` heartbeat row with its count, which the Admin Scheduler card shows | `skipStaleEvents` in `lib/workflows/dispatcher.ts` |
| `workflow_reads_failed` | error | Reads failed inside a tick pass that carried on (Task 36). `executor` counts steps or instances `advanceDueSteps` left unrun or unfinished (the step stays due, a woken wait stays asleep, or a finished step's bookkeeping was left for the heal pass); `dispatch` counts events left unprocessed for the next tick; `heal` counts marked instances the heal pass could not fix (they keep the marker and are retried). `site` names the first failing read (e.g. `executor.load_instance`), a code path and never data (review M2). A whole pass that throws is `app_error` from the tick's guard instead, awaited like this alert so the function is not frozen before Slack is posted (Phase 6 review I2). Counts and the site only. Deduped to one per ten minutes (`lib/workflows/tick-alerts.ts`), and the dedupe is stamped only once Slack confirmed delivery (`sendAlert` resolves `true`), so a failed post is retried on the next tick rather than silenced for ten minutes. The tick awaits it before writing the heartbeat. The heartbeat still records every tick's `failedReads` and the first `failedReadSite`, which the Admin scheduler card shows | `app/api/cron/automations-tick/route.ts` |
| `workflow_step_unsettled` | error | A step finished (its completion write landed) but the bookkeeping after it failed: merging its output, skipping the branch not taken, re-dating the steps behind it, or completing the instance (Task 36 fix round 1, review I1). The executor marks the instance (`needs_recompute_at`), and the tick's heal pass (`lib/workflows/heal.ts`) finds it on the next tick and redoes it. Carries `instanceId`, `stepId`, `site` and `marked`. `stepId` is null when the failure was the closing per-instance completion check (`site: executor.completion_check`, Phase 6 review M1), not one step's bookkeeping. `marked: false` means the marker write failed too, so the heal will not find the instance: re-date it by hand (tick and untick a step on it). Deduped to one per instance per ten minutes | `settleAfterCompletion` in `lib/workflows/executor.ts` |
| `workflow_apply_failed` | error | An apply failed after its instance row was created (snapshot, dating or go-live). The instance is cancelled as `setup_interrupted` and shows on the couple's Stopped strip with "Start it again instead"; the dispatcher marks the event handled because the per-event unique index would refuse a retry. Carries `userId`, `templateId`, `coupleId`, `instanceId`, `triggerEventId`. Deduped to one per workflow per ten minutes | `applyTemplate` in `lib/workflows/instantiate.ts` |
| `workflow_send_partial_failure` | warn | A workflow send step reached some of its recipients and failed on others (Task 31, audit M6): `send_email`, the run sheet to vendors (`send_timeline_to_vendors`, and `send_final_run_sheet` which delegates to it and reports under that name), and the run sheet link (`generate_run_sheet_pdf`, couple copy plus the MC's own copy). The step stays `done`, because re-running it would double-send everyone it reached, so without this the engine looks healthy while someone never got the email; the MC sees a warning on the step and each failed recipient has a `failed` row on the Emails tab. A send where nothing went out is not this alert: it errors the step (`workflow_step_failed`). Carries `userId`, `coupleId`, `stepId`, `instanceId`, `actionType`, `sent`, `failed` and `code` (the transport's `DispatchResult.code`, e.g. `validation_error` or `ErrorInvalidRecipients`, never the provider's message, which can quote the address). Deduped in memory to one per tenant per ten minutes, like `workflow_send_cap_unreadable`, and its await is bounded to two seconds so a slow Slack cannot stall the tick | `alertPartialSendFailure` in `lib/email/partial-send-alert.ts`, called by the three actions above |
| `automated_send_log_failed` | error | An automated email went out (or failed) but its `couple_emails` row could not be written (Task 30). The send itself stands: logging is strictly after it and never fails or repeats it. Lost: the Emails-tab record, the webhook's delivery status for that message, and one unit of the tenant's daily-cap count. Ids only: `userId`, `coupleId`, `stepId`, `instanceId`, `outcome` (`sent` or `failed`, which row was lost), `code` (the Postgres error code, null when the client threw). A retried message is absorbed in SQL (`log_automated_send` upserts on the attempt key), so every error that reaches the logger, a unique violation on another key included, is alerted. Deduped in memory to one per tenant per ten minutes | `logAutomatedSend` in `lib/email/send-log.ts`, called by the send gate and by `send_email` |
| `mailbox_disconnected` | warn | An MC's connected Gmail or Outlook mailbox is dead for good (Phase 5 fix wave, M7): the token refresh answered `invalid_grant` (revoked, expired, password changed) or a stored token cannot be decrypted. `oauth_status` was flipped from `connected` to `failed` (with a reason in `oauth_last_error`, shown in Settings), so their automated email now goes from the shared Zebri address until they reconnect, and the step envelope says so. Fires only from the call that flipped the row (the update is conditional on `connected`), so it is deduped across processes. A transient failure (the settings read, any other refresh error) raises nothing here: the step errors instead and the MC sees it. Carries `userId`, `provider`, `reason` (`grant_revoked` or `token_unreadable`) | `resolveSenderForSend` in `lib/email/sender-identity.ts` (every send as the MC: automated steps and the MC-present paths) |
| `app_error` (`source: 'resend_webhook_delivery'`) | error | The Resend webhook could not write a delivery status (delivered, delayed, bounced, complained) to a `couple_emails` row (Task 30 fix round 1). Suppression is never affected: it runs first and regardless. A transient failure answers 500 so Resend retries the event; a schema-shaped one (42703, 42P01, 42501, PGRST204, PGRST205: the app deployed ahead of its migration, or a missing grant) answers 200 so the endpoint is not walked towards being disabled. The message carries the step (`status` or `timestamp`) and the error code only. Deduped route-wide to one per ten minutes. Not raised for an automated message whose row does not exist yet (M3): that answers 500 for up to ten minutes with no alert, since the only lasting cause, a failed log write, already raised `automated_send_log_failed` | `app/api/resend/webhook/route.ts` |
| `resend_bounced` | warn | Hard bounce or complaint reported. No `to` and no `subject` (T27, fix round 1 I2, same reasoning); carries `userId` (the tenant whose `email_suppression` row this wrote) so the address and message can still be found from the app | `/api/resend/webhook` (Phase 2, Task 14). `reason` discriminates: `bounced` for hard (`Permanent`) bounces, `complained` for spam complaints. A transient or untyped bounce writes nothing and raises `app_error` (`source: 'resend_webhook'`) instead. Fires only when a new suppression row is inserted (idempotent against replays). OAuth mailbox sends never touch Resend, so their bounces stay invisible. Events on the MC's own copy of a `send_email` step (tagged `mc_copy`, Phase 5 fix wave) never suppress anyone and never raise this. |
| `cron_job_failed` | error | Cron handler threw | `/api/cron/*` |
| — (no alert) | — | The morning digest deliberately alerts on nothing. A failed send leaves `daily_digest_last_sent_on` unstamped so the next hourly run retries it, and the route returns `{considered, sent, skippedEmpty, failed}` for the cron log. A per-MC digest failure is not an incident | `/api/cron/workflow-digest` |
| `cron_job_missed` | warn | Expected run did not arrive | `workflow-digest` route, when the tick heartbeat is older than 5 min (`TICK_STALE_MS`) |
| — (Postgres, not `sendAlert()`) | warn | **Tick watchdog.** `tick_watchdog()` (pg_cron `zebri:tick-watchdog`, every 5 min) posts to the Slack webhook through pg_net when the tick heartbeat is missing or older than 5 min, once an hour while it stays down, and once more when it recovers. Runs without the app, so it is the alert that fires when the deployment itself is unreachable. Silent until `slack_webhook_url` is in Vault (Admin "Sync scheduler" with `SLACK_WEBHOOK_URL` set) | `supabase/migrations/20261001200000_tick_every_minute.sql` |
| `admin_shadow_exit_refused` | warn | `exitShadow` refused to mint an admin session: no signed-in user, no valid signed shadow grant, a grant for another user, an admin cookie that does not match the grant, or an admin who is no longer one. Carries `reason`, `sessionUserId` and `claimedAdminId` only, never emails or names. Any occurrence outside a stale pre-hotfix shadow session is a takeover attempt | `app/admin/actions.ts` |
| none (Postgres, not `sendAlert()`) | error | **Shadow session wrote after it ended** (Task 25). `log_shadow_mutation()` saw a write from a recorded shadow session id after the admin exited or the 8h session expired: a kept or copied target token. Once an hour per session (`admin_shadow_sessions.after_end_alerted_at`). Ids, table and operation only. Posted through `shadow_alert_slack()` (pg_net, Vault `slack_webhook_url`; silent without it) | `supabase/migrations/20261017000000_shadow_logging_coverage.sql` |
| none (Postgres, not `sendAlert()`) | warn | **Bank details or email changed during a shadow session** (Task 25). `log_shadow_auth_user_change()` saw a `user_metadata.bank_*`, `email` or `email_change` change on an MC with an open shadow session. Ids and key names only, never values; key names sanitised and capped (`shadow_slack_key_list`). The database cannot tell whether the admin or the MC made it | same migration; `20261018000000` |
| none (Postgres, not `sendAlert()`) | error | **Bank details or email changed through a shadow session after it ended** (Task 25 fix round 2). Same as above, but no shadow session is open and the change came while a recorded shadow session's target auth session was still live (not revoked on exit): likely a kept or copied token | `supabase/migrations/20261018000000_shadow_logging_hardening.sql` |
| none (Postgres, not `sendAlert()`) | warn | **Shadow-mode account-change logging failed** (Task 25 fix round 2). The guarded `auth.users` / `auth.mfa_factors` trigger body hit an error; the change itself was saved, unlogged. Carries the user id and SQLSTATE only | same migration |
| `app_error` (`source: 'admin.enterShadow'` / `'admin.exitShadow'`) | error | enterShadow could not record the shadow session (entry refused), or exitShadow's close matched no open row or failed | `app/admin/actions.ts` |
| `auth_anomaly` | warn | Failed-login spike, token reuse, … | middleware (Phase 0.8) |
| `auth_rate_limit_hit` | warn | Per-action rate limit hit (login/signup/reset/update/change password; since Phase 4 Task 23 also `redeemRecoveryCode` and `issueRecoveryCodes`, both keyed per user with `ip: 'session'`, and `verifyTotpUser` / `verifyTotpIp`, naming which key of the authenticator-code limit tripped, with the real IP) | `app/(auth)/actions.ts` + `app/(dashboard)/settings/account/actions.ts` (Phase 1); `app/(auth)/login/mfa/actions.ts`, `app/(auth)/login/mfa/totp-attempt.ts` + `app/(dashboard)/settings/account/two-factor-actions.ts` (Phase 4) |
| `mfa_recovery_code_used` | warn | An MC got past the second-factor screen with a recovery code instead of their authenticator app (Phase 4 Task 23). The code is spent, their TOTP factor removed and their sessions ended, so the account is password-only until they turn 2FA back on. Worth a look if the MC did not expect it, since whoever did it also held the password. Carries `userId` and `factorsRemoved` only, no name or email. The MC is also emailed at their own address (`lib/email/account-security.ts`) | `app/(auth)/login/mfa/actions.ts` (`redeemRecoveryCodeAction`) |
| `rls_denied_spike` | warn | Cluster of RLS denials in a window | logs aggregator (Phase 0.8) |
| `proposal_accepted` | info | A couple accepted a proposal option; the MC is emailed and gets a Slack heads-up with the total. Carries `coupleId`, not the couple's name (T27) | `lib/proposals/notify.ts` (Proposals Phase C) |
| `proposal_opened` | info | A couple opened the proposal's public page for the first time; the MC is emailed and gets a Slack heads-up. Carries `coupleId`, not the couple's name (T27) | `lib/proposals/notify-opened.ts`, `app/api/proposal/events/route.ts` (Proposals Phase D) |
| `proposal_declined` | info | A couple declined a proposal, with a reason and optional message. Carries `coupleId`, not the couple's name (T27) | `lib/proposals/notify.ts` (Proposals Phase C) |
| `proposal_close_failed` | error | A step of the accept/decline/finalize close sequence failed (`accept_rpc`, `publish`, or `finalize`); the couple-side row/signature already stands, this just flags a side effect (rendered contract, or booking) for a human to check | `app/api/proposal/accept/route.ts`, `lib/contracts/after-sign.ts` (Proposals Phase C) |
| `lead_blocked_plan_limit` | warn | A website lead-capture submission was blocked by the MC's Starter couple cap; the MC is emailed to upgrade so the lead is not lost | `app/api/lead/submit/route.ts` (ZEB-2) |
| `lead_new_enquiry` | info | A new website-form enquiry was received and a couple created; a Slack heads-up alongside the MC email so the team channel sees inbound leads | `app/api/lead/submit/route.ts` (Website form) |
| `booking_created` | info | A new public booking was received (via /book/[token] form). Carries `bookingId`, not the booker's name (T27); the MC's own email (allowlisted) and the manage token ride along too | `app/api/booking/submit/route.ts` (Scheduler Phase C) |
| `booking_created_without_calendar` | warn | A booking was confirmed while the MC has NO connected calendar: the slot was offered without checking their real calendar, the booking will never appear on it, and a `video` meeting type produced no join link for the couple. The booking stands | `app/api/booking/submit/route.ts` |
| `booking_event_push_failed` | warn | The calendar event push (Google Calendar or Microsoft Graph) failed after a confirmed booking; the booking stands, the MC should add it to their calendar manually or reconnect the integration | `app/api/booking/submit/route.ts` (Scheduler Phase C) |
| `booking_video_link_missing` | warn | A `video` booking's calendar event was created but the provider minted no join link, so the couple's confirmation says "link to follow". Carries the provider's own answer (`diagnostic`): for Microsoft, the event's `isOnlineMeeting` / `onlineMeetingProvider` and the calendar's `allowedOnlineMeetingProviders` (empty means the account cannot host Teams meetings: personal accounts, or a tenant without Teams); for Google, the Meet `createRequest` status. The event was already re-read once before alerting | `app/api/booking/submit/route.ts` |
| `bug_report_submitted` | info | An MC sent feedback from the in-app pill; carries the ZEB- reference, title, type, `reporter` ("Name (email)", always the logged-in MC's own account, allowlisted, T27), the page they were on, and a link to the Notion task | `lib/bug-reports/submit.ts` |
| `bug_report_notion_sync_failed` | error | The `bug_reports` row saved but the Notion push failed. There is no retry, so this alert repeats the full title and description: it is the only copy anyone will read when re-filing the ticket by hand | `lib/bug-reports/submit.ts` |
| `bug_report_screenshot_upload_failed` | warn | The Notion File Upload step failed. The ticket was still filed, just without its screenshot | `lib/bug-reports/submit.ts` |
| `app_error` | error | Catch-all / uncaught errors. Carries a `source` string so the channel line reads `<source>: <message>`. The unsubscribe routes use `unsubscribe` when an opt-out could not be recorded (a legal opt-out failing, so it pages rather than only logging). Zebri AI uses `ai-copilot` (usage-counter failure) and `ai-draft-email` (usage-counter failure, or the model call failing after the MC pressed Rewrite) | global error boundaries, `/api/ai/*` |

Wiring each row to its source happens during that surface's hardening
phase — the dispatcher and matrix land here, the call sites follow
per-page (consistent with the ratchets).

### Default emoji

| Severity | Emoji |
|---|---|
| `info` | `:information_source:` |
| `warn` | `:warning:` |
| `error` | `:rotating_light:` |

---

## Setup

### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create an App** → **From scratch**
3. Name: "Zebri CRM"
4. Workspace: Select your workspace
5. Click **Create App**

### 2. Enable Incoming Webhooks

1. In the left sidebar, click **Incoming Webhooks**
2. Toggle **Activate Incoming Webhooks** to **On**
3. Click **Add New Webhook to Workspace**
4. Select the channel (e.g. `#zebri-alerts`)
5. Click **Allow**
6. Copy the **Webhook URL** (starts with `https://hooks.slack.com/services/...`)

### 3. Add to Environment

Add to `.env.local`:

```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

---

## Implementation Details

### `lib/alerts/send-alert.ts`

The canonical entry point. Type-checked event in → Slack message out +
structured log record. Server-only. Never throws to the caller.

```ts
import { sendAlert } from '@/lib/alerts'

await sendAlert({
  type: 'stripe_webhook_failed',
  severity: 'error',
  eventType: event.type,
  errorMessage: err.message,
})
```

**Capability tokens are masked in the log record.** The Slack line is built
by hand from `describe()`, so it only ever contains what that function
prints. The structured log record is the whole event spread into a context
object, which put live share tokens into the platform logs: `manageToken` on
`booking_created` is enough to open, reschedule or cancel someone's booking,
and `invoiceToken` had the same shape. `sendAlert` now masks any field whose
name ends in `token` down to its first 8 characters before logging. That
prefix still lets one token be followed across log lines during an incident
and is far too short to guess the rest of a UUID.

If you add an event that carries a secret under a name that does NOT end in
`token`, mask it at the call site: the sweep is deliberately narrow rather
than a guess at what looks sensitive.

### `lib/alerts/slack.ts`

Low-level Slack transport. Never throws  -  failures are swallowed and
logged. Silently no-ops if `SLACK_WEBHOOK_URL` is unset (safe for local
dev). Each post is bounded by `SLACK_TIMEOUT_MS` (3 seconds, Task 36):
the fetch carries an abort signal, and a post that times out is logged
and dropped like any other failure, never thrown to the caller. Before
that the fetch had no timeout, so a hung webhook held every site that
awaits an alert for as long as the platform allowed. Three seconds is
several times Slack's normal round trip and a small slice of the 15
seconds the tick keeps after its budget. The send path's own two-second
settles (`settleAlertsWithDeadline` in
`lib/automations/actions/messaging.ts`, `alertPartialSendFailure`) are
kept: they are tighter than the transport's bound and are the send
step's own budget. Still available for custom Block-Kit payloads:

```ts
export async function sendSlackAlert(payload: SlackPayload): Promise<void>
```

### `app/api/alerts/slack/route.ts`

Thin API gateway. Receives JSON from client, forwards to `sendSlackAlert`. No authentication (read-only operation; abuse prevention via middleware rate-limiting).

### Client-side Alerts

All client-side alerts use fire-and-forget fetch:

```ts
fetch("/api/alerts/slack", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ... }),
}).catch(() => {}) // never blocks UX
```

Failures are silently ignored  -  alerts should never degrade the user experience.

### Server-side Alerts

Server routes use the typed dispatcher:

```ts
import { sendAlert } from "@/lib/alerts"
await sendAlert({ type: ..., severity: ..., ...payload })
```

Only fall back to `sendSlackAlert` (under `@/lib/alerts/slack`) for
one-off custom Block-Kit messages that don't fit the matrix.

---

## Adding New Alerts

1. **Add a variant to `lib/alerts/events.ts`** — give it a `type`,
   `severity`, and the typed payload fields you need.
2. **Add a `describe()` case in `lib/alerts/send-alert.ts`** so the
   Slack message reads well.
3. **Document the row** in the matrix above.
4. **Call `sendAlert({ type: ..., ... })`** from the source.

Tests under `tests/unit/lib/alerts/` cover the dispatcher + formatter.

> Bare Slack payloads (`sendSlackAlert(...)`) are only for genuine
> one-off messages outside the alert taxonomy — prefer extending the
> typed catalog so the matrix and code stay 1:1.

---

## Block Kit Reference

Alerts use Slack's Block Kit formatting. Common blocks:

### Header
```ts
{
  type: "header",
  text: { type: "plain_text", text: "Title" },
}
```

### Section with Fields
```ts
{
  type: "section",
  fields: [
    { type: "mrkdwn", text: "*Bold:*\nValue" },
    { type: "mrkdwn", text: "*Bold:*\nValue" },
  ],
}
```

### Context (gray text)
```ts
{
  type: "context",
  elements: [
    { type: "mrkdwn", text: "Info text" },
  ],
}
```

See [Slack Block Kit docs](https://api.slack.com/block-kit) for more.

---

## Monitoring

Check the Slack channel for alerts. If alerts aren't arriving:

1. Verify `SLACK_WEBHOOK_URL` is set in `.env.local`
2. Check browser DevTools Network tab for POST to `/api/alerts/slack`
3. Check server logs for `[slack] Failed to send alert` errors
4. Verify Slack webhook is still active (tokens can expire if workspace settings change)

---

## Safety

- Alerts never contain sensitive data (passwords, API keys, tokens)
- Alerts never contain couple-side PII, see [PII policy](#pii-policy-phase-4-task-27) above (T27). MC account emails are the one allowed exception, listed with their reasoning in [`security.md`](./security.md#fixed-in-task-27-2026-09-25-slack-alerts-leaked-couple-pii)
- Webhook URL is server-only (`SLACK_WEBHOOK_URL` has no `NEXT_PUBLIC_` prefix)
- Failed alerts are logged but never shown to users
- Alerts use fire-and-forget pattern  -  failures don't degrade UX
