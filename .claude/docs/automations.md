# Automations

Source-of-truth doc for Phase 14a. Covers the engine, the event
bus, the trigger / action catalogue, the recipient model, the
variable resolver, and the recipe library. Read this before
touching anything under `lib/automations/`, `app/api/cron/automations-tick/`,
or `app/(dashboard)/automations/`.

## Scope cuts (locked)

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
        └── runner:     advance each live run one step
                            │
                            ▼
        actions / waits / branches / approvals
```

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
| `automation_steps` | DAG of steps. Linear by default; branches use `parent_step_id` + `branch_path = 'yes'\|'no'`. |
| `automation_events` | Append-only event bus. The tick reads here. |
| `automation_runs` | One per `(automation, triggering event)`. Tracks lifecycle. |
| `automation_waits` | Sleeping runs (wait steps, approval gates, quiet-hours defers). |
| `automation_audit_log` | Durable per-step transition trail. |
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
   then advances up to 200 live runs by one step each. Per-tick
   step budget keeps the function under Vercel's timeout.

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
`anniversary_of_event`, `lead_inactive`, the `*_due` / `*_overdue`
variants, `task_overdue`, `quote_viewed_but_not_responded`,
`portal_section_started_not_finished`) are emitted by the tick
itself - there's no DB trigger that fires when a date crosses
the threshold. Wiring those tick-time emitters is a follow-up
work item (the registry entries exist; the tick body to compute
them does not yet).

### Categories (in picker order)

| Category | Triggers |
| --- | --- |
| Lead & enquiry | `new_enquiry` · `lead_inactive` · `custom_field_changed` |
| Pipeline | `couple_stage_changed` · `booking_cancelled` |
| Quotes, invoices & payments | `quote_created` · `quote_sent` · `quote_accepted` · `quote_declined` · `quote_due` · `quote_overdue` · `quote_viewed_but_not_responded` · `invoice_created` · `invoice_sent` · `payment_received` · `invoice_due` · `invoice_overdue` · `payment_failed` |
| Contracts | `contract_created` · `contract_sent` · `contract_signed` · `contract_declined` · `contract_revoked` · `contract_expired` · `document_signed` (alias) |
| Calendar & events | `event_created` · `event_updated` · `event_deleted` · `time_before_event` · `time_after_event` · `specific_date_reached` · `anniversary_of_event` |
| Client portal | `section_completed` · `portal_section_started_not_finished` · `timeline_edited` |
| Tasks | `task_created` · `task_completed` · `task_overdue` |
| Contacts | `contact_created` · `contact_updated` · `contact_linked_to_couple` |
| Manual | `manual_fire` |

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
- `custom_field_changed` narrows by `key` - once a custom-field
  key catalogue exists this can become a typed Select.

## Actions

Catalogue in `lib/automations/actions/`. Split by category:

- `messaging.ts` - `send_email` (Resend) + `send_sms` / `send_whatsapp`
  (14b stubs)
- `couple.ts` - stage update, note, custom fields, portal link,
  request information, create couple, pause couple automations
- `task.ts` - create / update task, calendar event, reminder
- `documents.ts` - send quote / invoice / contract, payment
  reminder, run-sheet PDF
- `timeline.ts` - create / update timeline event, send to vendors,
  final run sheet
- `post-event.ts` - onboarding pack, pre-event checklist, thank
  you, review request, referral request, anniversary

Each handler:

- Receives the runner-built `RunContext` (couple snapshot, MC
  snapshot, prior step outputs, triggering event).
- Validates its config via Zod (`spec.configSchema.safeParse`).
- Returns an `ActionResult`:
  - `{ kind: 'ok', output? }` - advance to next step
  - `{ kind: 'sleep', wakeAt, reason, token?, payload? }` -
    suspend (used by wait + approval + quiet-hours)
  - `{ kind: 'error', message, recoverable? }` - record + flip
    the run to errored

## Recipient model

`lib/automations/recipients.ts` exposes
`resolveRecipients(supabase, couple, spec)`.

Roles: `primary`, `spouse`, `family`, `vendor`, `custom`.
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
| `quote` / `invoice` / `contract` / `task` | populated from trigger payload + step results |

Filters: `friendly`, `friendly_long`, `iso`, `time`, `weekday`,
`default:VALUE`, `upper`, `lower`, `currency`.

Missing fields render as the configured default or empty string;
the resolver never throws.

`VARIABLE_CATALOGUE` is exported alongside as the source of truth
for the builder's right-rail variable reference.

## Quiet hours

`lib/automations/quiet-hours.ts` defers a wait step's `wakeAt`
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
- `app/(dashboard)/automations/[id]/step-picker.tsx` -
  categorised step-type picker
- `app/(dashboard)/automations/[id]/inspector-panel.tsx` - right
  drawer with typed config forms per trigger / step. Triggers
  with no extra parameters show a confirmation hint instead of
  an empty form
- `app/(dashboard)/couples/couple-automations.tsx` - couple-profile
  sub-tab showing runs touching this couple

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

- Tick-time emitters for the time-based triggers (calendar,
  inactivity, due/overdue). The `event_type` config on
  `time_before_event` / `time_after_event` is already in the
  registry; the tick body that joins `events` on `event_type` is
  still TODO.
- `contacts.tags` column for true custom-tag recipient matching.
- Drag-to-reorder steps in the builder (replace position math with
  dnd-kit, mirroring the branding block renderer).
- Full questionnaire editor.
- Custom-field key catalogue so `custom_field_changed` can offer
  a Select of known keys instead of a free-form text input.
- Inbound IG / email channel + outbound SMS / WhatsApp (14b).
- AI helpers: subject-line suggestions, "rewrite for tone", AI
  run-sheet generation.
- Run-as-batch: execute one automation against many couples at
  once.
