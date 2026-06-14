# Automations

Source-of-truth doc for Phase 14a. Covers the engine, the event
bus, the trigger / action catalogue, the recipient model, the
variable resolver, and the recipe library. Read this before
touching anything under `lib/automations/`, `app/api/cron/automations-tick/`,
or `app/(dashboard)/automations/`.

## Scope cuts (locked)

- **The offered catalogue is `automations-review.md`.** That file is
  the **single source of truth** for which triggers, actions, and
  flow-control steps Zebri ships. This doc only describes what's in
  it. The code registries (`lib/automations/triggers.ts`,
  `lib/automations/actions/`) still carry extra types from earlier
  14a scaffolding; anything not in the review file is **out of
  scope** — hidden from the picker (`launch-catalogue.ts`) and not
  on the backlog. Do **not** build catalogue items that aren't in
  the review file.
- **14a** - engine + builder UI + the trigger / action subset that
  can be wired without third-party accounts.
- **14b (deferred)** - SMS / WhatsApp / IG, inbound email parsing,
  AI helpers (subject-line generation, tone rewrite), full
  questionnaire editor, run-as-batch.

## Mental model

```
DB write / webhook / manual fire / tick
                │
                ▼
   emit_automation_event  (SECURITY DEFINER RPC)
                │
                ▼
        automation_events     ← append-only bus
                │
                ▼
   tick cron (every minute)
        ├── dispatcher: open a run per matching automation
        └── runner:     advance each live run one action
                            │
                            ▼
        actions (messaging / CRUD / flow control)
```

Every node in an automation's DAG is an **action**. Action types
split into two families:

- **Registered actions** — `send_email`, `create_task`,
  `update_couple_stage`, etc. Each has a handler in
  `lib/automations/actions/`.
- **Flow-control actions** — `wait`, `branch`, `stop` (the only
  three in the review file). Evaluated directly by the runner via
  `lib/automations/conditions.ts`; they don't appear in the action
  registry. The runner also implements `sub_flow` and `approval`,
  but those are **out of scope** (not in `automations-review.md`)
  and should be hidden from the picker.

The runner switches on `action.type`. There's no nested
`actionType` field — the `type` column on `automation_actions` is
the discriminator, and the `config` jsonb holds the per-type
payload flat.

The engine is **stateless between ticks**. State lives in the bus
(events), the run rows, the wait rows, and the audit log. Everything
else is derived. A failed deploy can't corrupt the engine - the
next tick picks up where the previous one left off.

## Data model

Migrations:

- `20260604000000_create_automations_foundation.sql` - the 6 core
  tables + `couple_custom_fields` + `emit_automation_event()`.
- `20260604000100_create_automation_db_triggers.sql` - AFTER
  INSERT/UPDATE triggers on `couples`, `quotes`, `invoices`,
  `contracts`, `tasks`, `timeline_items`, `portal_*`,
  `couple_custom_fields`.
- `20260605000000_add_event_type_to_events.sql` - `events.event_type`
  free-form text (default `'ceremony'`) so the trigger picker can
  narrow event-based triggers (rehearsal vs ceremony vs reception).
- `20260605000100_extend_automation_db_triggers.sql` - extends the
  trigger surface to `events` (created / updated / deleted),
  `contacts` (created / updated), `couple_contacts`
  (`contact_linked_to_couple`), and `contracts` status flips
  (`revoked`, `expired`).

| Table | Purpose |
| --- | --- |
| `automations` | One user-authored recipe. Holds the trigger type/config + status. |
| `automation_actions` | DAG of actions. Linear by default; branches use `parent_action_id` + `branch_path = 'yes'\|'no'`. The `type` column is the action-type slug (`send_email`, `wait`, `branch`, …); the application registry is the source of truth, the DB has no CHECK so new action types can ship without a migration. |
| `automation_events` | Append-only event bus. The tick reads here. |
| `automation_runs` | One per `(automation, triggering event)`. Tracks lifecycle. `current_action_id` points at the action the run is currently sitting on. |
| `automation_waits` | Sleeping runs (wait actions, approval gates, quiet-hours defers). FK to `automation_actions.id` via `action_id`. |
| `automation_audit_log` | Durable per-action transition trail. Events: `run_started`, `action_started/completed/skipped/errored`, `run_completed/cancelled/errored`, `approval_*`, `quiet_hours_deferred`. |
| `couple_custom_fields` | Per-couple key/value bag for `custom_field_changed` + `update_custom_fields`. |

All tables are RLS-scoped to `user_id`. Writes to `automation_events`
go exclusively through the `SECURITY DEFINER`
`emit_automation_event(user_id, source_table, source_id, event_type, payload, couple_id)`
RPC.

## The tick

`app/api/cron/automations-tick/route.ts` fires every minute via
`vercel.json`. Bearer-auth via `isCronAuthorized`.

Each tick:

1. **Dispatcher** (`lib/automations/dispatcher.ts`) pulls up to 500
   unprocessed events. For each event it loads the user's active
   automations matching the event type, calls each trigger
   matcher, and opens runs. Idempotent via the
   `(automation_id, event_id)` unique constraint.
2. **Runner** (`lib/automations/runner.ts`) wakes any due waits,
   then advances up to 200 live runs by one action each. Per-tick
   action budget keeps the function under Vercel's timeout.

Slack alerts:

- `automation_tick_slow` if a tick takes >30s
- `automation_tick_backlog` if unprocessed events >1000
- `automation_failed` when a run errors

## Triggers

Catalogue in `lib/automations/triggers.ts`. Each trigger spec
exposes a Zod config schema, a `match()` predicate, and UI
metadata (category, label, icon).

The DB triggers in `20260604000100` + `20260605000100` emit the
canonical event-type slugs the registry keys on. Naming is
intentionally flat - `quote_accepted` rather than `quote.accepted`
- to mirror the slack alert event style + keep DB CHECKs simple.

Time-based triggers (`time_before_event`, `time_after_event`,
`anniversary_of_event`, the `*_due` / `*_overdue` variants,
`task_overdue`) are emitted by the tick
itself - there's no DB trigger that fires when a date crosses the
threshold. Each emitter lives under
`lib/automations/time-emitters/<trigger>.ts` and registers in the
shared `runTimeEmitters()` pass that the cron route runs before the
dispatcher. The framework is in place; per-trigger wiring proceeds
one at a time per `.claude/docs/automations-wiring.md`.

**Wired today:**

- `quote_due` (A1) — fires for `quotes` with `status = 'sent'` whose
  `expires_at` lands `config.days` from today. Emits one event per
  (quote, days-lead-time, calendar day); narrowing happens via
  `payload.days_until_due === config.days` in the trigger's
  `match()`.
- `quote_overdue` (A2) — fires once for `quotes` with
  `status = 'sent'` on the day they cross
  `max(1, daysOverdueMin ?? 1)` days past `expires_at` (a min of 0
  is clamped to 1 — the expiry day itself belongs to `quote_due`).
  Emits one event per (quote, threshold, calendar day); narrowing
  via `payload.days_overdue === threshold`, plus a `daysOverdueMax`
  window guard. `couplePreviouslyViewed` is accepted by the schema
  but **not enforced** — quote view tracking doesn't exist yet, and
  the inspector hides the checkbox until it does. Day boundaries
  are UTC (same caveat as `quote_due`).
- `invoice_due` (A3) — fires for `invoices` with `status = 'sent'`
  whose `due_date` lands `config.days` from today. Emits one event
  per (invoice, days-lead-time, calendar day); narrowing via
  `payload.days_until_due === config.days`. Anchored on the
  top-level `due_date` only — payment-schedule installment dates
  (`deposit_due_date` / `final_due_date`) and the `isFinalBalance`
  filter are accepted but **not enforced** yet. Day boundaries are
  UTC.
- `invoice_overdue` (A4) — fires once for `invoices` with
  `status = 'sent'` on the day they cross
  `max(1, daysOverdueMin ?? 1)` days past `due_date` (a min of 0 is
  clamped to 1 — the due date itself belongs to `invoice_due`).
  Emits one event per (invoice, threshold, calendar day); narrowing
  via `payload.days_overdue === threshold`, plus a `daysOverdueMax`
  window guard. `isFinalBalance` and the `daysUntilEvent*` filters
  are accepted but **not enforced** (same `due_date`-only anchor as
  `invoice_due`). Day boundaries are UTC.
- `task_overdue` (A5) — fires once for `tasks` whose `status != 'done'`
  on the day they cross `max(1, daysOverdueMin ?? 1)` days past
  `due_date` (a min of 0 is clamped to 1 — a task due today isn't yet
  overdue). Emits one event per (task, threshold, calendar day);
  narrowing via `payload.days_overdue === threshold`, plus a
  `daysOverdueMax` window guard. The event's `couple_id` is the task's
  `related_couple_id` and may be null (tasks need not belong to a
  couple). `taskCategory` / `taskPriority` / `assignedTo` /
  `dueWithinDays*` are accepted but **not enforced** (`task_type` is a
  free-form per-user tag, not the `taskCategory` enum; there's no
  assignee column). Day boundaries are UTC.

**Not yet wired:** every other time-based trigger in the list above.
See `automations-wiring.md` for the running order.

### Categories (in picker order)

| Category | Triggers |
| --- | --- |
| Lead & enquiry | `new_enquiry` |
| Pipeline | `couple_stage_changed` · `booking_cancelled` |
| Quotes, invoices & payments | `quote_created` · `quote_sent` · `quote_accepted` · `quote_declined` · `quote_due` · `quote_overdue` · `invoice_created` · `invoice_sent` · `payment_received` · `invoice_due` · `invoice_overdue` |
| Contracts | `contract_created` · `contract_sent` · `contract_signed` · `contract_declined` · `contract_expired` |
| Calendar & events | `event_created` · `event_updated` · `time_before_event` · `time_after_event` · `anniversary_of_event` |
| Client portal | `section_completed` · `timeline_edited` · `couple_uploaded_file` · `couple_added_song_to_playlist` · `couple_completed_vows` |
| Tasks | `task_created` · `task_completed` · `task_overdue` |
| Contacts | `contact_created` · `contact_linked_to_couple` |

These 34 triggers **are** the agreed catalogue — they mirror
`automations-review.md` exactly. The code registry
(`lib/automations/triggers.ts`) still holds extra types from earlier
scaffolding (e.g. `lead_inactive`, `payment_failed`,
`quote_viewed_but_not_responded`, `contract_revoked`,
`event_deleted`, `specific_date_reached`,
`portal_section_started_not_finished`, `contact_updated`,
`manual_fire`, the Phase-14b set); all of those are **out of
scope** — hidden from the picker and not on the backlog.

### Launch visibility (what the picker offers today)

`lib/automations/launch-catalogue.ts` is the code allowlist for
which triggers/actions appear in the builder pickers. Two filters
stack: (1) it must be in the review-file catalogue, and (2) within
that, it must **actually do something today** — the review-file
items that aren't built yet (e.g. `time_before_event`,
`couple_completed_vows`, `generate_run_sheet_pdf`) stay hidden until
their wiring PR adds them to the allowlist. Out-of-scope registry
types stay defined (so saved automations still resolve) but are
never shown. The pickers filter on `isTriggerLaunchVisible` /
`isActionLaunchVisible`; a currently-set trigger stays listed even
if hidden. Dead config inputs (filters the matcher/handler never
reads) are stripped from the inspector forms of the visible tiles.
Full visible/hidden inventory + rationale: `automations-wiring.md` →
"Catalogue review outcome".

### MC-specific narrowing

The catalogue is designed so each trigger can be narrowed via
config to the MC use-case without inventing per-use-case slugs:

- `event_*` and `time_*_event` accept an optional `eventType` to
  scope to rehearsals / receptions / send-offs rather than the
  whole couple. The set of event types lives on
  `events.event_type` (free-form text - `ceremony`, `rehearsal`,
  `reception`, `send_off`, `engagement`, `other` are the
  defaults).
- `section_completed` narrows by section (`people` / `songs` /
  `files` / `timeline`) and - when section = `people` - by
  category (`partner` / `family` / `bridal_party`). That covers
  "couple finalised their music", "bridal party submitted",
  "files uploaded" without separate triggers.
- `contact_*` narrow by `category` (the same enum the contacts
  table enforces: `venue` / `celebrant` / `photographer` / etc.),
  so "photographer attached to a couple" or "celebrant updated"
  is a single trigger with config.
- `couple_stage_changed` loads the user's custom statuses from
  `couple_statuses` and offers them as Select options.

## Actions

Catalogue in `lib/automations/actions/`. Split by category:

- `messaging.ts` - `send_email` (Resend) + `send_sms` (14b stub,
  shown greyed "coming soon"). `send_email` honours: recipients, subject, body,
  branded-shell wrap, `replyToOverride`, `ccVendors` (deduped
  against direct recipients), `bccSelf`. The remaining Phase 14a
  scaffolding fields (attachments, per-email quiet hours,
  do-not-email, preview-before-send, track-opens, send-at) are
  schema-accepted but ignored and hidden from the inspector — the
  per-field blockers are documented on `sendEmailConfigSchema`.
  **Failure semantics:** if every addressable recipient is rejected
  by Resend, the handler returns `{ kind: 'error' }` so the runner
  errors the run + fires the `automations.runner` Slack alert —
  no more silent `sent: 0`. A partial failure stays `ok` (the
  successful sends can't be un-sent) but records `failed` +
  `last_error` in the run output. NB locally `send_email` hits the
  real Resend API (not Mailpit), so an unverified sender domain
  surfaces here as a run error.
- `couple.ts` - stage update, note, portal link, request
  information, create couple, pause couple automations
- `task.ts` - create / update task
- `documents.ts` - send quote / invoice / contract, payment
  reminder, run-sheet PDF, create invoice from quote
- `timeline.ts` - create timeline event, send to vendors,
  final run sheet
- `post-event.ts` - pre-event checklist, thank you, review request,
  referral request

> In-scope but **not yet built** (hidden until wired):
> `generate_run_sheet_pdf` and `create_invoice_from_quote` are stubs
> today. Out-of-scope action types still in the registry files
> (`send_whatsapp`, `update_custom_fields`, `create_calendar_event`,
> `create_reminder`, `update_timeline_event`, `send_onboarding_pack`,
> `send_anniversary_message`) are hidden and not on the backlog.

Each handler:

- Receives the runner-built `RunContext` (couple snapshot, MC
  snapshot, prior action outputs, triggering event).
- Validates its config via Zod (`spec.configSchema.safeParse`).
- Returns an `ActionResult`:
  - `{ kind: 'ok', output? }` - advance to next action
  - `{ kind: 'sleep', wakeAt, reason, token?, payload? }` -
    suspend (used by wait + approval + quiet-hours)
  - `{ kind: 'error', message, recoverable? }` - record + flip
    the run to errored

## Recipient model

`lib/automations/recipients.ts` exposes
`resolveRecipients(supabase, couple, spec, mc?)`.

Roles: `primary`, `spouse`, `family`, `vendor`, `custom`, `me`.
`me` resolves to the MC's own email from the `mc` snapshot
("Myself (your email)" in the picker) — call sites that don't
thread the MC through simply drop the role and the fallback rule
applies.
Spouse details come from `portal_people` where `category = 'partner'`.
Family / vendor matching reads `couple_contacts` joined to
`contacts.category`. Custom tag matching is currently aliased to
category matching - a dedicated `contacts.tags` column is a
follow-up.

Fallbacks (`spec.fallback`):

- `primary_only` (default) - if no requested roles resolve, send
  to the primary couple email
- `skip` - return empty list; the action no-ops
- `error` - throw; the runner records the run as errored

## Variable resolver

`lib/automations/variables.ts`: `renderTemplate(input, ctx)`.

Mustache-style `{{ namespace.key | filter[:arg] }}` with these
namespaces:

| Namespace | Keys |
| --- | --- |
| `couple` | `name`, `primary_name`, `spouse_name`, `email`, `phone`, `status` |
| `event` | `date`, `days_until`, `days_since`, `weekday` |
| `venue` | `name` |
| `mc` | `business_name`, `contact_name`, `email`, `phone` |
| `portal` | `link` |
| `quote` / `invoice` / `contract` / `task` | populated from trigger payload + prior action results |

Filters: `friendly`, `friendly_long`, `iso`, `time`, `weekday`,
`default:VALUE`, `upper`, `lower`, `currency`.

Missing fields render as the configured default or empty string;
the resolver never throws.

`VARIABLE_CATALOGUE` is exported alongside as the source of truth
for the builder's right-rail variable reference.

## Quiet hours

`lib/automations/quiet-hours.ts` defers a wait action's `wakeAt`
into the next allowed window when the requested time falls inside
the couple-local quiet block.

Workspace default: 21:00 – 08:00 in the couple's timezone (or the
MC's `user_metadata.timezone` fallback). Per-automation override
on the `automations` row.

## UI map

- `app/(dashboard)/automations/page.tsx` - list of the user's
  automations + empty state with a single "New automation" CTA.
  No tabs, no gallery - the builder is the product.
- `app/(dashboard)/automations/automations-list.tsx` - user
  automation rows
- `app/(dashboard)/automations/[id]/page.tsx` - builder
  orchestrator (canvas + inspector + pickers)
- `app/(dashboard)/automations/[id]/canvas-node.tsx` - React Flow
  node renderers (trigger card, action / wait / branch / etc.)
- `app/(dashboard)/automations/[id]/trigger-picker.tsx` -
  command-palette popover for choosing the trigger; on pick the
  inspector auto-opens for parameter config (no "Coming soon"
  states - every trigger in the registry is wired)
- `app/(dashboard)/automations/[id]/action-picker.tsx` -
  categorised action-type picker (flow control + every registered
  action)
- `app/(dashboard)/automations/[id]/inspector-panel.tsx` - right
  drawer with typed config forms per trigger / action. Triggers
  with no extra parameters show a confirmation hint instead of
  an empty form
- `app/(dashboard)/automations/[id]/runs-panel.tsx` - "Runs" button
  in the canvas header opens a read-only run-history drawer: recent
  `automation_runs` for this automation (RLS-scoped) with status,
  time and couple; an errored run names the failed step (resolved
  from `current_action_id` against the canvas actions) and shows the
  message via `friendlyRunError()`. This is the in-canvas answer to
  "did it run / where did it error" — the couple-profile tab only
  shows runs that touched a given couple
- `app/(dashboard)/couples/couple-automations.tsx` - couple-profile
  sub-tab: one row per automation that has touched this couple
  (live first, trigger label + headline status); the row expands
  to that automation's run history. Run errors are rendered via
  `lib/automations/config-errors.ts` `friendlyRunError()` - the
  runner stores plain-English config errors (`configErrorMessage()`)
  and legacy raw-Zod rows are translated at display time

The sidebar nav item is added in `app/components/sidebar.tsx`
(`Sparkles` icon, between Payments and Branding).

## API surface

- `POST /api/cron/automations-tick` - bearer-auth tick (Vercel Cron,
  every minute)
- `POST /api/automations/test-run` - rate-limited preview that
  renders templates against a real couple without sending
- `GET /api/automations/approve/[token]?decision=approve|deny` -
  consumes an approval-gate magic link, resumes or cancels the run

## Future work

These are the remaining **in-scope** (review-file) builds — see
`automations-wiring.md` → "Remaining backlog" for the canonical list:

- Tick-time emitters for `time_before_event` (T1), `time_after_event`
  (T2), `anniversary_of_event` (T3). The framework
  (`lib/automations/time-emitters/`) and A1–A5 (`quote_due`,
  `quote_overdue`, `invoice_due`, `invoice_overdue`, `task_overdue`)
  shipped.
- Portal triggers `couple_uploaded_file` (P1),
  `couple_added_song_to_playlist` (P2), `couple_completed_vows` (P3 —
  needs a `vows` table first).
- Stub actions `generate_run_sheet_pdf` (AC1 → wire to `lib/pdf`) and
  `create_invoice_from_quote` (AC2).

Engine/UX future work (not catalogue items):

- `contacts.tags` column for true custom-tag recipient matching.
- Drag-to-reorder actions in the builder (replace position math with
  dnd-kit, mirroring the branding block renderer).
- Full questionnaire editor.
- Inbound IG / email channel + outbound SMS / WhatsApp (14b).
- AI helpers: subject-line suggestions, "rewrite for tone", AI
  run-sheet generation.
- Run-as-batch: execute one automation against many couples at once.
