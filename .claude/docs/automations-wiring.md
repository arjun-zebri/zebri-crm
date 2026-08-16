# Automations — Triggers & Actions Wiring Plan

**Status:** Active roadmap. Sibling doc to `automations.md` (which is
the canonical "how the system works"). This doc is **time-bounded**:
each item ticks off as it ships to `staging`, and the doc is retired
once the catalogue is fully wired.

**Created:** 2026-06-07
**Owner:** Arjun
**Working batch:** [feedback_staging_only_batch](../../../.claude/projects/-Users-arjunpunekar-Documents-zebri-zebri-crm/memory/feedback_staging_only_batch.md) applies — all PRs land on `staging`; no per-PR `main` promotion.

## Context

The Phase 14a foundation is **complete**: 6 tables with RLS, the
`emit_automation_event()` RPC, the per-minute tick (dispatcher +
runner), the React Flow builder UI, recipient + variable resolution,
quiet hours, and the audit log are all live.

**Scope = `automations-review.md`.** That file is the agreed
catalogue of triggers, actions, and flow-control steps. This wiring
plan tracks **only** review-file items. The earlier "Bucket A–D"
plan (the `lead_inactive` / `portal_section_started_not_finished` /
`specific_date_reached` triggers, the Stripe-webhook bucket, the ~40
"extended actions", and the Phase-14b set) is **cut** — those types
stay defined in code so saved automations resolve, but they're
hidden from the picker and **must not be built**. Check the review
file before wiring anything.

## Done

- **A1–A5 time-emitters** — `quote_due`, `quote_overdue`,
  `invoice_due`, `invoice_overdue`, `task_overdue` are live on the
  shared time-emitter framework (`lib/automations/time-emitters/`),
  each firing once per (source, threshold, calendar day) with
  payload-based `match()` narrowing. Day boundaries are UTC.
  Per-row detail lives in `automations.md` → "Wired today".
- **Catalogue cleanup PR** — `lib/automations/launch-catalogue.ts`
  allowlist hides every non-review and not-yet-built type from both
  pickers; ⚠️ dead inputs stripped from the visible tiles' inspector
  forms. Detail in "Catalogue review outcome" below.
- **Trigger filter sweep — COMPLETE (2026-08-13).** Every
  launch-visible trigger is chip-driven with only data-backed,
  enforced filters; every visible action's config schema holds only
  fields its handler reads. Began trigger by trigger (`new_enquiry`
  2026-08-12, then `couple_stage_changed`, `booking_cancelled`
  retired, `invoice_created`), finished as one pass over the
  remaining 24 triggers + the action catalogue. Sections below.

## Remaining backlog (review-file scope)

The complete list of what's left to build. Each ships as its own PR
through `staging` per the recipe below, and **adds itself to the
`launch-catalogue.ts` allowlist in the same PR** (that's what
unhides it). Order is value-first.

| Status | ID  | Item                            | Notes                                                                                              |
| :----: | --- | ------------------------------- | -------------------------------------------------------------------------------------------------- |
|   ☑    | T1  | `time_before_event`             | Shipped — `lib/automations/time-emitters/time-before-event.ts`. Fires on `events.date = today + amount` days; cancelled events skipped. (`eventType` narrowing was removed in the 2026-08-13 sweep — the app never writes it.) **Day-grain only** (emitter ignores `unit != days`; inspector shows "Days before the event", no unit picker). Unit + integration tests green |
|   ☑    | T2  | `time_after_event`              | Shipped — `time-emitters/time-after-event.ts`. Mirror of T1 on `events.date = today − amount` days; day-grain only |
|   ☑    | T3  | `anniversary_of_event`          | Shipped — `time-emitters/anniversary-of-event.ts`. Fires on the MM-DD anniversary; `years` (or `years..maxYears` range) |
|   ☑    | P1  | `couple_uploaded_file`          | Shipped — AFTER INSERT trigger on `portal_files` (migration `20260615000000`). file_type/section/size filters dropped |
|   ☑    | P2  | `couple_added_song_to_playlist` | Shipped — AFTER INSERT trigger on `portal_songs` (migration `20260615000000`). playlistKey/songCount filters dropped |
|   ☑    | P3  | `couple_completed_vows`         | Shipped — full vows feature (migration `20260615000100`): `vows` table + RLS + `save_portal_vow` RPC + DB-trigger event + couple portal section + MC settings toggle. `who` filter (primary/spouse) |
|   ☑    | P4  | `questionnaire_completed`       | Shipped — AFTER UPDATE trigger on `couple_questionnaires` (migration `20260705000000`) fires on the status flip to `completed` (public submit or MC marking done). Optional `questionnaireTemplateId` filter; payload carries template_id/title/share_token so `{{questionnaire.title}}` / `{{questionnaire.link}}` resolve |
|   ☑    | AC1 | `generate_run_sheet_pdf`        | Shipped — emails the run-sheet (timeline) link instead of a server PDF (no PDF stack). Best-effort email + returns the link |
|   ☑    | AC2 | `create_invoice_from_quote`     | Shipped — drafts a `draft` invoice + line items from a quote; `paymentSchedule` seeds the deposit (50% default) |

Nothing else is on the backlog. `send_sms` stays a greyed
"coming soon" stub (not built). Flow control (`wait`, `branch`,
`stop`) is done; `sub_flow` / `approval` are **cut** (not in the
review file) — hide them from the picker.

## Catalogue review outcome (2026-06-14) — launch scope

A full audit (matchers in `triggers.ts`, handlers in
`lib/automations/actions/*`, DB-trigger payloads, and the real
schema) was run against `automations-review.md`. The picker today
surfaces **every** registry entry (~74 triggers, ~29 actions),
including ~40 triggers that never fire and several actions that
return ok without doing anything. Decisions locked with Arjun:

**The launch rule:** *a trigger/action is visible in the picker only
if it actually does something today.* Everything dead is **hidden
from the picker, not deleted from the registry** — deleting entries
would break saved automations that reference them. Hidden entries
get unhidden by their wiring PR.

**Mechanism (cleanup PR — shipped):**
- `lib/automations/launch-catalogue.ts` exports the VISIBLE
  allowlists + `isTriggerLaunchVisible` / `isActionLaunchVisible`;
  `trigger-picker.tsx` and `action-picker.tsx` filter on them (a
  currently-set trigger stays listed even if hidden). The registry
  is untouched, so saved automations on hidden types still resolve.
  `comingSoon` stays as the greyed label (only `send_sms` uses it).
- **Dead-input drop:** every ⚠️ field (the ones the matcher /
  handler never reads) was stripped from the inspector forms of the
  *visible* tiles. Zod schemas keep `.passthrough()` so previously
  saved configs still parse; the fields just leave the UI.

### Triggers — VISIBLE (28, fire today)

`new_enquiry`, `couple_stage_changed`, `invoice_created`,
`invoice_sent`, `payment_received`, `invoice_due`, `invoice_overdue`,
`contract_created`, `contract_sent`, `contract_signed`,
`contract_declined`, `contract_expired`, `event_created`,
`event_updated`, `section_completed`, `timeline_edited`,
`task_created`, `task_completed`, `task_overdue`, `contact_created`,
`contact_linked_to_couple`, `time_before_event`, `time_after_event`,
`anniversary_of_event`, `couple_uploaded_file`,
`couple_added_song_to_playlist`, `couple_completed_vows`,
`questionnaire_completed`.

(The six `quote_*` triggers left this list when the quotes feature was
dropped on 2026-07-11; `booking_cancelled` was retired 2026-08-13.)

### Triggers — HIDDEN

- **CUT — not in the review file, never build:** `lead_inactive`,
  `portal_section_started_not_finished`, `specific_date_reached`,
  `payment_failed`, `quote_viewed_but_not_responded`,
  `contract_revoked`, `event_deleted`, `contact_updated`,
  `custom_field_changed`, `couple_set_do_not_contact`,
  `branding_published`, `manual_fire`, `automation_failed`
  (meta/internal), plus the entire Phase-14b set
  (`consultation_*`, `noim_*`, `donlim_*`,
  `marriage_certificate_issued`, `document_signed`, `rehearsal_*`,
  the `couple_*_email` engagement triggers, `tag_*`,
  `subscription_*`, `couple_birthday`,
  `payment_plan_milestone_reached`, `refund_issued`,
  `vendor_contact_assigned`, `team_member_added`,
  `webhook_received`). All stay defined in the registry but hidden.

### Actions — VISIBLE after cleanup (21)

`send_email`, `update_couple_stage`, `add_note`, `send_portal_link`,
`request_information`, `create_couple`, `pause_couple_automations`,
`create_task`, `update_task`, `send_quote`, `send_contract`,
`send_invoice`, `trigger_payment_reminder`, `create_timeline_event`,
`send_timeline_to_vendors`, `send_final_run_sheet`,
`send_pre_event_checklist`, `send_thank_you_message`,
`request_review`, `send_referral_request`, plus `send_sms`
(greyed `comingSoon`, kept per review). Flow control: `wait`,
`branch`, `stop` only — `sub_flow` and `approval` are cut (not in
the review file) and should be hidden from the picker's flow list.

### Actions — HIDDEN / CUT

- **CUT — not in the review file, never build:** `send_whatsapp`,
  `create_calendar_event`, `create_reminder`,
  `update_timeline_event`, `send_onboarding_pack`,
  `send_anniversary_message`, `update_custom_fields`.
- **In review, not built yet (unhide when wired — backlog AC1/AC2
  above):** `generate_run_sheet_pdf` (→ wire to `lib/pdf`),
  `create_invoice_from_quote` (PROMOTE).

### Review-doc corrections (verified in code)

- `events.event_type` **does exist** (migration `20260605000000`,
  free-form, default `'ceremony'`). The schema spot-check that
  claimed otherwise was wrong; `eventType` filters on
  `event_created` / `event_updated` are sound.
- `new_enquiry.daysUntilEvent` and `contact_created.hasEmail` are
  actually wired (review implied dead).

### `new_enquiry` filter pass (2026-08-12)

The trigger went the other way from the original "keep leadSource
only" plan: rather than cut filters to fit a cramped panel, the panel
learned to hide unset filters, so the trigger can offer everything its
payload supports.

- **Lead source is no longer its own enum.** `trigger-constants.ts`
  re-exports `LEAD_SOURCES` from `types/couple.ts`. The old automations
  list invented thirteen channels (Easy Weddings, TikTok, ABIA…) that
  nothing in the app can ever write: `couples.lead_source` is only set
  by the couple modal (which offers the six real values) and by
  `submit_lead()` (which hard-codes `'website'`). Filters on the
  invented values matched nothing, silently.
- **Every offered filter is enforced.** `leadSource`, `initialStatus`,
  `daysUntilEvent*`, `hasEventDate`, `dayOfWeek`, `eventMonth` and
  `season` all narrow in `match()`. Date-derived filters reject a
  couple with no `event_date` rather than passing them through.
- **`hasVenue`, `budgetTier`, `referralByContactId` are deleted.** No
  column or payload field backs them.
- **`leadSource` is `z.string()`, not an enum**, so an automation saved
  against a value that later leaves the list still parses (it just
  stops matching) instead of failing `configSchema.safeParse` in the
  dispatcher and disabling the automation outright.

The UI pattern (`trigger-filter-list.tsx` + a per-trigger filter
array) is the template for the remaining triggers: show only what's
set, offer the rest behind one "Add filter" menu. When migrating a
trigger, every default in `fieldFilter({...})` must satisfy that
trigger's Zod schema; the dispatcher re-parses the saved config on
every event, so a placeholder the schema rejects is a silently dead
automation.

### `couple_stage_changed` filter pass (2026-08-13)

Second trigger through the sweep, and the one that turned the
`new_enquiry` work into a reusable pattern rather than a one-off.

- **Two dead inputs deleted.** `timeInPreviousStage*` needed a
  stage-entry timestamp that nothing records, and `triggeredBy`
  (MC / automation / payment / portal) needed an actor the DB trigger
  cannot see. Both were declared in the Zod schema, rendered nowhere,
  and enforced nowhere.
- **The legacy form is gone for this trigger.** `CoupleStageFields`
  and the `CoupleStageChangedExtra` stub are deleted; the two stage
  selects are now `into` / `out of` chips.
- **`lead_source` joined the emit payload**
  (`20260813000000_add_lead_source_to_stage_payload.sql`), so both
  couple triggers filter on the same six real sources. That is the
  question behind most pipeline automations: a website enquiry
  reaching Booked wants a different follow-up from a referral doing
  the same thing.
- **The wedding-date family came along for free.** `event_date` was
  already in the payload, so has-a-date / day / month / season now
  narrow here too, with no schema change.

Shared filter definitions, so the next trigger is assembly:

- `event-date-filters.tsx` — `EVENT_DATE_FILTERS`, the five filters
  derived from `event_date`. Any trigger whose payload carries an
  `event_date` can spread it in.
- `couple-filters.tsx` — `leadSourceFilter` and `coupleStatusFilter()`,
  a factory because one trigger asks about stages three different ways
  ("lands in", "moves into", "moves out of") and the options are the
  MC's own `couple_statuses` rows.
- The per-trigger file is then just an ordered array:
  `new-enquiry-filters.tsx` and `couple-stage-filters.tsx` are both
  under 55 lines including TSDoc.
- `CHIP_TRIGGERS` in `trigger-card-body.tsx` went from a `Set` of
  types to a map of type → filter builder, so adding a trigger to the
  chip UI is one entry.

`tests/unit/app/automations/trigger-filter-defs.test.ts` walks every
filter in every migrated trigger and asserts that its "just added"
default and each of its options parse against that trigger's real
`configSchema`. That is the check that catches the sweep's recurring
failure mode before it reaches the dispatcher.

### `booking_cancelled` retired (2026-08-13)

The sweep reached this trigger and found it had never fired for
anybody. Its emit block tested:

```sql
if new.status in ('cancelled', 'lost') then
```

but `couples.status` holds a slug from the MC's own `couple_statuses`
rows, and the defaults the app seeds (`use-couple-statuses.ts`) are
`new`, `contacted`, `confirmed`, `paid`, `complete`. Neither hardcoded
slug is in that set. The trigger was launch-visible and offered four
filters the whole time.

This is the "Easy Weddings" rule one level up: the same reason a
filter must be backed by a field an app writes, a trigger must be
backed by a state the app can actually reach. Checking the emit
condition against real data, not just the payload's fields, is now
step one of migrating a trigger.

Fixing it properly would mean deciding which of an MC's stages counts
as a cancellation, and nothing on `couple_statuses` records that. An
`is_lost` flag plus a toggle in the status editor was considered and
rejected as more surface than the case needs: `couple_stage_changed`
now filters on "moved into <stage>" using the MC's real stage names,
which is more accurate and visibly correct to the person setting it up.

What the retirement touched:

- Spec + registry entry, `LAUNCH_VISIBLE_TRIGGERS`, the `TriggerType`
  union, both inspector branches, and `CANCELLATION_REASONS` /
  `CANCELLATION_REASON_LABELS` (used by nothing else).
- `20260813010000_drop_booking_cancelled_trigger.sql` drops the emit
  block, so no new events land.
- Historical `automation_events` rows are left in place. They are
  inert: the dispatcher skips any event whose type has no registry
  entry, because `getTriggerSpec` returns null. Same for a saved
  automation still pointing at the type — the builder renders the raw
  slug as its title rather than crashing, and it can never open a run.

Deleting a registry entry goes against the catalogue rule above
("hidden, not deleted, so saved automations resolve"). The exception
holds here because the type could never have fired, so no automation
depending on it was ever doing anything.

### `invoice_created` filter pass (2026-08-13)

The first money trigger, and the first one where an existing filter
was matching the **wrong number** rather than nothing at all.

- **The amount filter now compares the total.** It compared
  `subtotal`, the raw sum of line items, before discount and before
  tax. Every couple-facing surface shows
  `(subtotal - discount) * (1 + tax_rate/100)`, and that is what an MC
  means by "invoices over $2,000". The emit site computes it
  (`20260813020000`) using the same formula as
  `lib/branding/public-blocks/variable-values.ts`; `subtotal` stays in
  the payload because variables read it. This does change what a saved
  threshold matches wherever a discount or tax rate applies.
- **`discountApplied` was rebuilt, not deleted.** It was the one field
  of the eight with real data behind it: `discount_type` /
  `discount_value` are written in the same insert as the rest of the
  invoice. Now `hasDiscount`, filtering on both. A row saying
  "percentage, 0" is not a discount, matching what the public totals
  block does before it renders a discount line.
- **The other seven are gone from the shared `amountFilter`.** No
  column backs a package tier or a revision number; `invoice_items`
  are inserted *after* the invoice row, so at INSERT-trigger time
  there are no items to inspect for add-ons; and deposit /
  final-balance / partial are properties of `invoice_payment_stages`
  rows that do not exist yet either. `payment_received` and
  `invoice_sent` share that schema and lost the same dead fields,
  though they keep their legacy forms until their own turn.
- **`BOOKING_TIERS` and `PAYMENT_METHODS` deleted** from
  `trigger-constants.ts` along with them. Both had no consumer left,
  and the five payment methods (cash, cheque, bank transfer…) are
  recorded nowhere in the schema.
- **No status filter.** `status` is in the payload but
  `saveInvoiceAction` hardcodes `'draft'` on insert, so it is the same
  value on every event.
- **The wedding-date family works here** via a `couples` lookup in the
  emit trigger for `event_date`. It is a primary-key read of the row
  the invoice already references.

Two mechanical notes for the next trigger:

- `DaysUntilEventControl` is now `ComparisonControl` with a `label`
  prop, because money and days need the same operator-plus-number
  popover with a different unit.
- **Derive the spec's config type with `z.infer`**, as
  `invoiceCreatedConfig` does, rather than hand-writing a twin
  interface. Under `exactOptionalPropertyTypes` Zod emits
  `?: T | undefined` and a hand-written `?: T` is not assignable to
  it, which is why almost every older spec carries a strict error.
  Doing it this way was the difference between the new spec adding one
  to the strict budget and being clean. Shared helper params want
  `?: T | undefined` for the same reason (see `EventDateConfig`).

### The full sweep (2026-08-13) — every remaining trigger + the actions

The remaining 24 visible triggers went through in one pass, using the
same rules the first four established. What each got is in the
`automations-review.md` table (every row now reads DONE with its
filter list); the structural notes:

- **`required` chips.** Triggers whose number is the point
  (`invoice_due` days, the overdue thresholds, calendar offsets,
  anniversary years) render it as a permanent chip: always present, no
  ✕, never in the "Add filter" menu (`TriggerFilterDef.required`).
  Their schemas carry a `.default()` matching what the chip displays,
  because a config holding only an optional filter must still parse —
  the generic defs test caught exactly that on the calendar triggers.
- **Shared filter modules.** `event-date-filters.tsx` now exports the
  family in parts (`EVENT_DATE_FILTERS`, `EVENT_ROW_DATE_FILTERS`
  without the has-a-date question, `DATE_BUCKET_FILTERS` without
  days-until for triggers whose firing time already fixes it).
  `eventDateMatches` / `daysUntilEventMatches` take a payload-field
  param (`'event_date'` for couple-shaped payloads, `'date'` for
  event rows). `filter-options.ts` holds the option-source hooks
  (statuses, task priorities/types, questionnaire templates) plus the
  fixed portal song slots.
- **Findings of the "can it ever fire / is it the right number" kind:**
  `invoice_sent`'s amount filter compared a field its payload never
  carried (a configured filter matched *nothing*, silently);
  `eventType` was offered on five triggers but the app never writes
  `events.event_type`, so every row holds the `'ceremony'` default;
  the old `playlistKey` values (entrance, exit…) were invented names,
  not the portal's real slot keys; `daysOverdueMax` with exact-depth
  matching was either redundant or unsatisfiable; task priority /
  category enums were invented while the real data
  (`task_priorities` / `task_types` names) sat unoffered.
- **Payload migrations:** `20260813030000` (invoice_sent +
  payment_received get total / discount / due_date / event_date),
  `20260813040000` (contracts get event_date, both emit functions),
  `20260813050000` (tasks get priority + task_type).
- **Actions:** the visible actions' schemas now declare only fields
  their handlers read (`.passthrough()` keeps old configs parsing) —
  trimmed on update_couple_stage, add_note, send_portal_link,
  request_information, create_couple, pause_couple_automations,
  create_task, create_timeline_event, send_timeline_to_vendors,
  send_invoice, trigger_payment_reminder (whose hint promised tone /
  escalation fields that no longer exist) and the four post-event
  sends. `send_email`'s deferred attach/track/sendAt fields stay, per
  the documented deferred-features block in `messaging.ts`.
- **Legacy forms:** the trigger side of `inspector-panel.tsx` /
  `inspector-extended.tsx` now serves only hidden types that old
  automations may still hold (`lead_inactive`,
  `custom_field_changed`, `event_deleted`, `contact_updated`,
  `portal_section_started_not_finished`, `specific_date_reached`,
  `manual_fire`, and the Phase-14b tail). Everything visible is chips.
- **Tests:** `trigger-filter-defs.test.ts` walks all 22 chip sets
  against their schemas; `swept-triggers.test.ts` +
  `money-triggers.test.ts` pin the new matchers and that configs
  saved against every deleted field still parse.

#### The action picker condensation (2026-08-13)

The same pass, applied to actions: 22 picker entries → 19. Merges,
each verified against the handlers rather than the labels:

- **`trigger_payment_reminder` → Send invoice.** Its handler was
  `return sendInvoice.handler(ctx, config)` — the same action under a
  second name — and its "most recent *unpaid* invoice" description was
  false: `pickInvoice` never checks paid status.
- **The run-sheet trio → one "Send run sheet"**
  (`send_timeline_to_vendors` relabelled, with `sendToVendors` /
  `sendToCouple` / `sendToMe` checkboxes). `send_final_run_sheet`
  delegated to the same handler while silently replacing the MC's
  typed message with canned copy and claiming "couple + vendors"
  (vendors only); `generate_run_sheet_pdf` sent the same link to the
  MC. Pre-merge configs carry no flags and default to vendors-only,
  so saved automations behave identically. The old form also passed a
  RecipientsField the handler ignored (vendors were hardcoded) — the
  checkboxes replace that dead input with ones the handler reads.
- All three retired types stay in the registry with working handlers,
  hidden from the picker; their legacy inspector forms are honest
  hints now ("Legacy step: identical to Send invoice…").
- The post-event four (checklist / thank-you / review / referral) are
  **not** merged: mechanically identical sends, but each ships its
  own pre-written copy via schema defaults — the same reasoning that
  kept vows / questionnaire as separate triggers.

#### Steps get the chip treatment too (2026-08-14)

The Wait card was the old world in miniature: a stacked form of eight
controls, five of which wrote keys the runner never reads
(`respectWeekend`, `respectPublicHolidays`, `windowStart`,
`windowEnd`, `maxWaitDays`). The runner's whole wait contract is
`mode` + that mode's value + `respectQuietHours`.

Wait is now two chips (`wait-chips.tsx`, rendered by the same
`TriggerFilterList` with `addLabel="Add option"`):

- **`wait · 1 day later`** — required. Its popover edits the current
  mode's value in the header (number + unit rows, or a date field)
  and offers the other modes as rows beneath, so switching from "a
  fixed amount of time" to "2 weeks before the event" never leaves
  the popover. Mode switches seed the schema's happy path — the
  dispatcher-side seeding lesson applies to the runner identically,
  and `wait-chips.test.ts` pins every writable value against
  `waitConfigSchema`.
- **`quiet hours · deferred / ignored`** — optional, behind
  "Add option". The default (defer) needs no chip; adding it exists
  to switch it off.

`stop` lost its three dead extras the same day (`markCoupleStatus`,
`tagCouple`, `notifyMc` — `evaluateStopAction` reads nothing).

The content-carrying actions followed on 2026-08-14 as **mixed
cards** (`action-chips.tsx`): prose stays a field, parameters become
chips.

- `update_couple_stage` — one required `move to · <stage>` chip.
- `request_information` — required `section` chip + the message field.
- `send_couple_questionnaire` — required `questionnaire` chip +
  optional title field.
- `create_task` — title/description fields + optional
  `due · 7 days before the event` chip (date or relative modes in one
  popover, like the wait chip).
- `update_task` — title/description fields + optional status and due
  chips. Its dead `appendNote` / `reassignTo` / `pushDueDateBy`
  schema fields deleted (the handler never read them).
- `send_email` — the whole step is a **modal** (see "The email
  composer" below). Only the branded-shell and reply-to extras are
  left as "Add option" chips. The reply-to chip surfaced a run-killer:
  it seeds `''`, which `z.string().email()` rejected, so the schema
  now unions `''` (= unset) and the handler treats `''` as absent.
  `action-chips.test.ts` pins every chip against the runner schemas.

#### The email composer (2026-08-14)

Writing an email is a document, not a row of controls in a 380px node,
so `send_email` has no inline body at all: its node carries
`modalOnly`, clicking it opens `email-composer-modal.tsx` directly
(no expand, no chevron, no "Edit email" button in between), and
closing the modal collapses the node. The wiring is a
`modal: { open, onClose }` prop threaded `StepConfigForm` →
`ActionConfigForm` → `ActionFields` → `EmailContentSummary`; every
other step is untouched.

The modal is the same three controls as the template editor
(`SubjectField`, `RichTextEditor`, `TemplateAttachments`) plus
addressing above them: a **Send to** multi-select, and **CC** / **BCC**
dropdowns that hold typed addresses (Enter or comma commits one, ✕
removes one) over a standing toggle — the couple's own vendor contacts
for CC, yourself for BCC. Typed addresses store as `ccEmails` /
`bccEmails` arrays of plain `z.string()`, never `z.email()`: a config
that fails to parse is a silently dead automation, so a half-typed
address is dropped at send time instead of rejected at load time.
`DispatchPayload.bcc` widened to `string | string[]` for this.

**A template is a starting point, never a live link.** Picking one in
the composer copies its subject + TipTap content into the step's own
fields and stores the id as display-only `sourceTemplateId`; the
runtime `templateId` is cleared, including on a config saved before
the composer, which is materialised the first time it opens. Showing a
subject and body the runner would then ignore in favour of a linked
template is how you mail the wrong email.

The pre-composed sends (`send_onboarding_pack`,
`send_pre_event_checklist`, `send_thank_you_message`,
`send_anniversary_message`, `request_review`, `send_referral_request`)
use the same modal with `showRecipients={false} showOptions={false}` —
their handlers address the couple directly and read none of the
delivery options. They keep their inline card, since
`PostEventExtraFields` still has content.

**Mustache text is not a variable in the composer.** The plain-text
`body` path renders `{{couple.name}}` as mustache, but the composer's
path resolves **mention nodes only** — so lifting a saved body
verbatim turned every variable into literal text that would be mailed
as `Hi {{couple.primary_name}},`. The action picker's own default body
did exactly this. `initialContent` now parses `{{…}}` runs into
mention nodes (filters preserved, so `event.date | friendly` survives),
which fixes every automation seeded before the composer as it opens.

Two gotchas: the shared `Modal` had to be portalled to `document.body`
(a React Flow node's `transform` creates a containing block, so
`position: fixed` inside one renders at the node's own size), and
popovers inside the modal need `z-[90]`, the shared popover tier above
the modal panel's `z-[60]`.

#### The chip-popover shape (2026-08-15)

Every compound chip popover now follows the branch's: **pick the
shape, then fill that shape in**, with a back row naming the current
one. The due chip was the last holdout — five preset day counts, then
a Days/Weeks list, then a Before/After list, then two mode rows, all
flat, read as ten unrelated choices rather than one date.

Unit and direction are **one list** there (`days before the event`,
`weeks after the event`, …): "7" plus "days before the event" is a
single thought, and splitting it made two decisions out of one. Two
things fell out of the rebuild — the preset counts are gone, so any
number can be typed, and `unit: 'weeks'` became reachable at all (the
schema always took it; the old popover only ever wrote `days`).

**Clicking the canvas collapses whatever is open** (`onPaneClick`).
An expanded card overlaps the steps beneath it, and hunting for the
chevron you opened it with is not how anyone dismisses something.
Popovers inside a card portal to the body, so a click in one is not a
pane click and cannot collapse the card mid-edit.

#### SMS, tasks and the Textarea primitive (2026-08-15)

**`send_sms` cannot be picked or opened.** It was listed with a
"(coming soon)" label but still selectable, so an MC could add a step
that fails at run time. The picker row is `disabled` now (the command
palette already supported it — the picker just never set it), the node
carries `noConfig`, and the collapsed card says "Not enabled yet —
this step will not run", since it can no longer be opened to find
that out.

**`update_task` is out of the picker** (2026-08-15). It edits "the
most recent task created by an earlier action", or one pasted UUID —
neither is a rule an MC can reason about while looking at the canvas.
Registered and running for saved automations; its card says so.

**`add_note` opens a modal** too (`note-composer-modal.tsx`): a
paragraph written five rows at a time in a 380px node is prose through
a letterbox. Plain text, not the rich editor — the handler appends the
rendered string to `couples.notes`, a text column, so formatting would
be discarded on the way in. The variable tokens are click-to-append
chips rather than a caret insert: a textarea loses its selection the
moment a button takes focus, and inserting in the wrong place is worse
than appending.

**`create_task` opens a modal**, like the email actions:
`task-composer-modal.tsx`, with the title, the description and the
due chip. `EMAIL_MODAL_ACTIONS` became `MODAL_ACTIONS` — the rule is
"the step's whole config is a modal", not "the step is an email".

That modal needed a prose field, and there was no primitive for one:
`components/ui/textarea.tsx` now exists (Input's chrome, height from
`rows`, vertical resize only) with unit tests and a `/design-system`
entry. The seven hand-rolled `<textarea>` call sites in
`inspector-panel.tsx` moved onto it, deleting the local copy that had
been drifting from `Input`.

#### Stop and pause (2026-08-15)

**`stop` has no config and no expand.** Its only field was a reason
that went into an audit-log entry nobody asked for; the card existed
to hold it. The node carries `noConfig` now — no chevron, no panel,
and the header does not respond to a click, because an expand that
opens onto nothing is a promise the card cannot keep. `stopConfigSchema`
still accepts `reason`, so a saved one parses and still narrates.

**`pause_couple_automations` is out of the picker.** Pausing every
other automation on a couple from inside one of them is a rule nobody
can reason about looking at the canvas. Its spec stays registered and
its handler still runs, so saved automations are unaffected; the card
says it is a legacy step. `PAUSE_CATEGORIES` / `PAUSE_CATEGORY_LABELS`
went with it — nothing ever read them.

#### The step-card audit (2026-08-14)

A pass over every launch-visible action's card, asking the sweep's
questions of the *inputs* rather than the schema:

- **Every email action is modal-only.** `PostEventExtraFields` had
  already been reduced to `() => null`, so the six pre-composed sends
  were a summary box and an "Edit email" button inside an expanded
  node. They now open the composer directly, like `send_email`, with
  the action's own label as the modal title.
- **"Send run sheet"**: its three recipient checkboxes are one
  required `send to · vendors, me` chip. The phrase comes from
  `runSheetAudience()` in `step-summary.ts`, which the collapsed card
  uses too, so the card and its chip can never describe the same
  config differently. Vendors read as on when the key is absent — the
  runner defaults them on for configs saved before the merge.
- **`create_couple`**: name stays a field (it is the one thing the
  action cannot run without); email, phone, event date and lead source
  are chips. Its `email` had to widen to `z.union([z.string().email(),
  z.literal('')])` first — the chip seeds `''` when added, which the
  bare `.email()` rejected. Same run-killer the reply-to chip found.
- **`create_timeline_event`**: the "Event ID (optional)" input is
  gone. It asked the MC to paste a UUID no screen in the app shows,
  and the handler already falls back to the couple's own event.
- **14 dead `*ExtraFields` components deleted** — six unreferenced,
  eight rendering `null` at a live call site.
- `update_timeline_event` and `update_custom_fields` keep their
  paste-a-UUID / free-key forms, and both are already hidden from the
  picker. `update_timeline_event` cannot be made sane as-is: one
  hardcoded item id means an automation firing for every couple would
  edit one specific couple's timeline row.

**The bug this pass found.** Every chip row was wired to the *merging*
setter (`updateInner`, which spreads a patch over the config). A
`fieldFilter` chip's `remove` **deletes** its keys, so merging spread
them straight back: the chip disappeared from the card while the
runner kept acting on the value. Chip-hosting forms now take a
`replaceConfig` prop alongside `updateConfig`
(`ChipHostProps`), and `step-config-chips.test.tsx` pins removal
through a real step card. The task due chip survived the old wiring
only because it writes `undefined` instead of deleting.

#### Branch (2026-08-14)

The last step on the old stacked form. Now a chip row like a
trigger's — **one pill per condition**, saying the whole condition:

    if [wedding is at most 60 days away]
    if [stage is Booked] and [the deposit is paid] [+ Add condition]

One pill, not three. Splitting a single condition across a subject
pill, an operator pill and a value pill made one thought look like
three settings and wrapped onto two lines in a 380px node. The pill's
popover is two steps instead — the subject list, then that subject's
own control, with a back row between them — so no popover is longer
than a menu. A subject with nothing to configure ("the deposit is
paid") opens straight onto the list. The days control is the trigger
filters' own `ComparisonControl`, not a lookalike: same layout, same
commit-on-blur, same digit-only field.

**A branch starts empty**, on the "Add condition" button alone — no
default predicate guessing which condition was meant. That menu *is*
the condition list, so picking a row creates that condition outright
rather than adding a placeholder to open and choose inside. The
runner rejects a branch with no predicate, and
`config-errors.ts` phrases it as "no condition chosen" rather than
"Predicate: Invalid input". `TriggerFilterList` also adds the last
remaining filter outright now: with one choice left, the menu was a
single row repeating the button that opened it. A def can set
`openAfterAdd` when the chip to open afterwards isn't itself (the
branch's conditions are keyed by index).

**Conditions chain.** `evaluatePredicate` has always understood
`and` / `or` groups — nothing ever offered them, so a branch could
only test one thing. "Add condition" rewrites the config into a
group and the join pill flips the whole group between "every
condition must match" and "any condition can match" (one join for the
group, which is the only shape the runner's `and` / `or` has). A
one-condition branch collapses back to a bare predicate on save, so
nothing saved before chaining changes shape on disk just because it
was opened. The last condition's ✕ disappears: a branch with nothing
to test cannot split.

**Conditions offered:** how far away the wedding is; stage, lead
source, venue, wedding date, couple name, email or phone; the contract
is signed; the deposit is paid; the invoice is paid in full. That is
everything the run context can answer without a new query — the
remaining candidates (questionnaire completed, portal section done,
tasks outstanding) all need a DB read, and `evaluatePredicate` is
synchronous.

What the audit changed underneath it:

- **Two new conditions, both backed by data that was already there.**
  `has_paid_invoice` reads the invoice's own status (`InvoiceSnapshot`
  gained `status`), which is the question `has_paid_deposit` does not
  answer — that one only asks about the first stage. And `lead_source`
  joins the couple fields: the column has been on `couples` all along,
  `readCoupleField` just had no case for it.

- **`has_signed_contract` could never be true.** It read
  `actionResults.contract_signed_at` and a payload `contract_signed`,
  neither of which anything writes (the emitter's key is `signed_at`).
  The run context now carries `contractSignedAt`, loaded from the
  couple's most recently signed contract, and the predicate reads
  that first.
- **`is_set` / `is_unset` killed the branch they were on.** `value:
  z.any()` is *non-optional* in Zod 4, so a predicate saved without an
  operand failed the union parse. Both `value` fields are
  `.optional()` now, in the schema and in `BranchPredicate`.
- **Numeric comparisons on a couple field are gone from the UI.**
  Every readable couple field is a string, and `compare()` turns a
  non-numeric operand into `null` and returns false — so `>`/`<` on
  one was a branch that always took "no".
- **The couple field is a list, not a free-text box.** It offered
  `lead_source` as a placeholder example; `readCoupleField` supports
  status, name, email, phone, venue and event_date only, so that
  example never matched.
- **`custom_field` is retired from the picker** (it reads action
  results nothing writes; `couple_custom_fields` has no UI at all)
  and **`groupOperator` is deleted** — AND/OR scaffolding the runner
  has never evaluated. Content fields everywhere else are the
design-system `TextInput`/`TextArea` and stay as they are.

#### The chip popover for numbers

`ComparisonControl` was a wrapping row of operator pills over a
bordered `Input`. Two problems, both visible the moment a filter had
more than three operators: the pills broke across two ragged lines,
and the number field carried the browser's native spinner arrows —
wrong height, wrong colour, and a second way to change a value that
already commits on blur.

It now follows the trigger picker's shape: a borderless number field
in a bordered header, then `MenuItem` rows for the operators, so a
compound popover and an option-list popover read as the same control.
Notes:

- The field is `type="text"` with `inputMode="numeric"`, not
  `type="number"`. A text input has no spinner arrows to hide, still
  raises the numeric keypad on mobile, and — the reason it had to
  change — allows `setSelectionRange`, which a number input rejects.
- **Non-digits are dropped as they are typed** (`replace(/\D/g, '')`
  in `onChange`), not repaired on blur: a letter should never be able
  to appear in a field that only holds a whole number. It also cleans
  up a pasted `$1,000`. Clearing the box and leaving it restores the
  previous value rather than committing 0, because clearing is how
  you start retyping; an explicit `0` still commits 0.
  `tests/unit/app/automations/comparison-control.test.tsx` pins all
  of this.
- **Three operators, not five.** `OFFERED_COMPARISON_OPS` in
  `trigger-constants.ts` is `['lte', 'gte', 'eq']` — "at most", "at
  least", "exactly". Only `gt` / `lt` were dropped, as off-by-one
  twins of the first two: nobody distinguishes $2,000 from $2,000.01,
  and showing both makes a reader work out whether the boundary is
  included. `eq` was proposed for removal too (on a date it only
  matches when the triggering activity lands on precisely the
  configured day) and Arjun kept it deliberately — it pins an exact
  figure such as a fixed package price. `COMPARISON_OPS` still holds
  all five, so a config saved against `gt` / `lt` keeps parsing, keeps
  matching, and still renders its label in the chip — they left the
  picker, not the engine.
- **The value is not selected on open.** Radix's focus scope focuses
  the first tabbable element with `select: true`, so the popover
  opened with the whole number highlighted as though it were about to
  be overwritten. An effect collapses that to a caret at the end,
  one frame after mount (Radix focuses after the child mounts).
- `prefix` / `unit` sit either side of the number (`$ 1000`,
  `90 days`), replacing the old field label.
- One operator (or none) renders the field alone plus an optional
  `hint` line — that is the shape every `required` chip uses, where
  the number is a parameter rather than a comparison.
- The field's bottom border doubles as the separator above the rows
  and is dropped when there are none, so it never dangles.
- `activeFilterSummary` counts `required` filters unconditionally.
  Their `isActive` is false until the config is first written, so
  keying off it alone left a fresh "Days before event" card reading
  its generic description while its own chip said "7 days before"
  underneath. The generic defs test now pins this.

### Builder: canvas kept, config moved into the node (2026-08-13)

The zoomable React Flow canvas stays: nodes drag freely, the canvas
zooms, edges follow. What changed is where a step's settings live.
The 340px right-hand inspector is gone; clicking a node expands it in
place to hold its filter chips or action form.

Why the rail went: it was serving two content sizes and fitting
neither. A trigger with two filters left roughly 700px of empty rail,
while `send_email` had to fit a subject, body, recipients and template
picker into 340px.

A flow-list variant was built first and then reverted, because a
single column cannot offer free node placement or zoom. That history
matters mainly as a warning: the drag people want on this page is
positional, not reordering.

Shape of the builder:

- `page.tsx` is the orchestrator: loads the automation + actions,
  derives nodes/edges, owns `expandedId`, persists drags.
- `flow-node.tsx` is the node: header, expandable body, handles.
- `trigger-card-body.tsx` holds the filter chips.
- `ai-copilot-bar.tsx` is the copilot as a bottom bar; its transcript
  expands upward only once there's a conversation.
- `auto-layout.ts` places nodes that have no persisted x/y.

Things worth knowing:

- **Node x/y is presentation only.** Run order is `position`; edges
  are `parent_action_id` + `branch_path`. Dragging a node never
  changes what runs when, and never has.
- **Anything the node renders inside its body needs `nodrag`
  `nowheel`.** Without them a drag inside a text field pans the node
  and scrolling a long form zooms the canvas.
- **Hooks feeding the node array must return stable references.**
  `useTriggerFilters` originally rebuilt its array every render; the
  node memo then recomputed forever and React Flow's store threw
  "Maximum update depth exceeded". It is `useMemo`d, with a shared
  constant for the empty case.
- **Nothing inside a filter chip's popover may portal.** A nested
  Radix portal (the design-system `Select`) registers as an outside
  interaction and dismisses the popover on first click. Compound
  controls use plain buttons; see `filter-controls.tsx`.
- `ROW_GAP` in `auto-layout.ts` is 200 so a node opened for editing
  does not immediately overlap the one beneath it.
- **Node `zIndex` is explicit**, because React Flow otherwise stacks by
  array order: the dashed add-placeholder sat in front of an opened
  card. Placeholder 0 < resting card 1 < opened card 20.
- **Nodes never auto-expand.** Picking a trigger or adding a step
  leaves the card closed; opening is always a deliberate click.
- **The copilot's outside-press dismissal is bound in the capture
  phase.** The React Flow pane stops `mousedown` propagation for
  panning, so a bubble-phase listener never sees a press that lands on
  the canvas, which is most of them.
- **Cards animate open with `grid-template-rows` 0fr→1fr.** The
  wrapper is always in the DOM so the transition has something to run
  on, but the config form inside mounts lazily: the page tracks which
  nodes have been opened, so a canvas of twenty steps does not build
  twenty forms nobody looked at.
- **The copilot panel is bottom-anchored, so any height change moves
  its top edge.** Shrinking the composer on blur slid the header (and
  its minimise button) down between mousedown and mouseup: the click
  was swallowed, and the next one landed on whatever had moved into
  that spot, including the destructive clear button. The composer now
  holds its grown height for as long as the transcript is open. The
  transcript itself collapses via `grid-template-rows` so minimising
  animates rather than snaps, and it stays mounted throughout, so
  folding it away never touches the conversation. The collapsing box
  is `justify-end`, so the oldest lines clip first and the newest turn
  is the last to go; clipping from the bottom instead made the panel
  look like it was falling behind the composer. There is no clear
  control and no reset: the conversation lives for the life of the
  page and a reload starts over. Focusing the composer brings the
  history back, so minimising needs no counterpart button. The
  transcript pins to its last turn, which is why
  `CopilotConversation` takes a `visible` prop.

### Copilot typing + scroll

Assistant turns arrive from the stream as whole messages, not token
deltas, so the typewriter is a client-side reveal in
`copilot-conversation.tsx`. It runs for one entry only (the newest
assistant turn, tracked in `typedIds`) so reopening the panel or
sending another message never retypes the history.

It reveals **word by word, not character by character** (each tick
runs on to the next whitespace). A token stream never splits a word,
and stopping mid-word is the tell that it is a character animation
rather than a reply arriving. Rate is ~25 words a second, with
`MAX_REVEAL_MS` capping a very long answer so nobody waits half a
minute. `prefers-reduced-motion` is read inside the reveal effect
rather than held in state, which avoids both a hydration mismatch and
a setState-in-effect.

Scrolling is CSS, not JavaScript. The transcript scroller is
`flex-col-reverse`, which makes the browser anchor the scroll position
to the newest turn itself. Two JavaScript approaches were tried first
and neither held up: scrolling from an effect lost the race with that
effect's own cleanup (the rAF was cancelled before it ran, so on a
fast reveal it simply never scrolled), and a ResizeObserver did not
fire dependably either. With a reversed column there is no scheduling
to get wrong, and scrolling up by hand still works. Note that
`scrollTop === 0` means *pinned to the newest turn* in this mode: the
axis is inverted.

The panel itself never animates height, and that is the important
constraint to preserve. It is anchored to the bottom of the viewport,
so growing it moves its top edge, which caused two separate bugs: the
minimise button slid out from under the cursor between mousedown and
mouseup (swallowing the click, and putting the next one on whatever
had moved into that spot), and the scroll container's maximum offset
shrank every frame so the browser clamped the position down as the box
opened, giving two movements in opposite directions. The transcript is
now a fixed-height card that fades and rises like a modal, floating
just above the composer, and the composer is one row that never grows.

### ConfirmDialog leaked clicks to its ancestors (fixed 2026-08-13)

`ConfirmDialog` is fixed-position but not portalled, so it stays a DOM
descendant of whatever opened it. Rendered inside a clickable table
row, confirming a delete also fired the row's `onClick`: deleting an
automation navigated to the automation that had just been deleted.

Fixed in the primitive rather than the call site, since a modal must
never leak clicks upward and `couples/page.tsx` had the same shape.
Both surfaces stop propagation on the bubble (never capture, which
would swallow the dialog's own buttons). Covered by three tests in
`tests/unit/components/ui/confirm-dialog.test.tsx`.

Deleted by this work: `canvas-node.tsx` (superseded by
`flow-node.tsx`) and the `InspectorPanel` drawer export. That module
is still live for `StepConfigForm`, which is every per-action form.

## The per-item recipe (every PR)

Every wiring PR; trigger or action; must satisfy this checklist.
This **is** the per-page DoD (`production-readiness.md` §5)
translated to a per-feature DoD for automations.

### For a time-based trigger

1. **Predicate**; extend the time-based section of the tick route
   (or a new `lib/automations/time-emitters/<trigger>.ts`) with the
   "what's due" query. Must be idempotent: dedupe by
   `(user_id, source_table, source_id, event_type, bucket_date)`
   so the same quote doesn't re-fire every minute.
2. **Emit**; call the existing `emit_automation_event()` RPC with
   `source_table`, `source_id`, `event_type`, payload, `couple_id`.
3. **Matcher**; confirm `lib/automations/triggers.ts` matcher
   already exists; if not, add it. Zod schema for any
   per-automation config (e.g. `time_before_event.offset`).
4. **Unit test**; `tests/unit/lib/automations/time-emitters/<trigger>.test.ts`
   covering: not-due (no fire), just-due (fires once), past-due
   already-fired (no re-fire).
5. **Integration test**; `tests/integration/automations/<trigger>.test.ts`
   against local Supabase: seed a couple + matching source row,
   run the emitter, assert one row in `automation_events`, run
   again, assert still one row (idempotency under RLS).
6. **E2E**; extend the existing automations e2e to build an
   automation using this trigger + `send_email`, fast-forward via
   the tick test endpoint, assert the email was queued.
7. **Audit log narrative**; update
   `lib/automations/audit-log/narrate.ts` so the new event renders
   a human sentence in the run log.
8. **Doc**; append a row to the trigger table in
   `automations.md`, flip its "wired" column. Tick the row in this
   doc.
9. **TSDoc** on the exported emitter + Zod config schema.
10. **Slack alert**; confirm `automation_failed` already covers
    runtime errors. No new alert unless the emitter itself can
    silently no-op (e.g. missing column); in which case add one
    `automation_emitter_skipped` warn.

### For an extended action

1. **Handler**; flip `comingSoon: false` in the action spec and
   implement the handler in `lib/automations/actions/<category>.ts`.
   Handler signature is already established
   (`RunContext` + config → `ActionResult`).
2. **Zod config**; define / refine the per-action config schema.
3. **Inspector form**; update
   `app/(dashboard)/automations/[id]/inspector-panel.tsx` so the
   builder UI matches the new schema (not just a placeholder).
4. **Side-effect tests**; unit-test the handler with mocked
   primitives; integration-test the side effect against local
   Supabase (e.g. a tag write actually appears in `couple_tags`).
5. **E2E**; automation that fires the action end-to-end.
6. **Doc**; flip the row in `automations.md`'s action catalogue.
   Tick the row in this doc.
7. **TSDoc** + why-comments per CLAUDE.md.
8. **Rate-limit / cost guard** if the action calls an external
   billable API (Resend etc. already covered).

### Branch + PR conventions

- Branch: `automations/<bucket-id>-<short-name>` ,
  e.g. `automations/A1-quote-due`.
- All wiring PRs land on `staging` (per
  `feedback_staging_only_batch.md`; no per-PR `main` promotion in
  this batch).
- PR title prefix: `Automations:` so they're easy to filter.
- PR body must show the doc diff (`automations.md` +
  `automations-wiring.md`) front-and-centre.
- Ratchet `scripts/typecheck-strict-gate.mjs` and
  `scripts/lint-gate.mjs` downward where the PR reduces them.

## Exemplar: A1; `quote_due`

The first PR has more work than the others because it **builds the
time-based emitter framework**. Subsequent A-rows slot into the
framework with ~50 LoC each.

### Framework (built once, in A1)

- **New module:** `lib/automations/time-emitters/index.ts`
  - Exports `runTimeEmitters(ctx)`; called by the tick route
    once per minute, after the existing event dispatcher pass.
  - Per-emitter contract: `{ id, run(ctx): Promise<number> }` ,
    returns count emitted, for tick metrics.
  - Registry pattern matching `actions/index.ts` so adding the
    remaining emitters is "implement the emitter, add to the registry."
- **Tick integration:** edit
  `app/api/cron/automations-tick/route.ts` to call
  `runTimeEmitters()` between the dispatcher and runner passes.
  Wrap in its own timing block so the existing
  `automation_tick_slow` alert still works.
- **Idempotency helper:** `lib/automations/time-emitters/dedupe.ts`
  exporting `alreadyEmitted({ source_table, source_id, event_type,
  bucket })` that checks `automation_events`. `bucket` is the date
  the trigger logically fires for (e.g. the due_date); prevents
  re-emit on every tick.

### A1-specific work (`quote_due`)

- **Predicate:** all quotes where `status = 'sent'` AND
  `due_date::date = current_date` AND not already emitted today.
- **Emit:** `emit_automation_event(user_id, 'quotes', quote.id,
  'quote_due', payload, couple_id)`.
- **Payload:** `{ quote_id, quote_number, due_date, amount_due,
  couple_id }`; keep small; runner can hydrate from DB.
- **Test seeds:** quote due today (fires), due yesterday (no
  fire; already-bucketed yesterday), due tomorrow (no fire),
  status `accepted` (no fire), status `draft` (no fire).

### After A1 lands

The remaining time-emitters (backlog T1–T3) follow the framework.
Per-PR work shrinks to: write a single
`lib/automations/time-emitters/<trigger>.ts` file, register it,
write three tests, add a doc row, and add the trigger to the
`launch-catalogue.ts` allowlist. Estimated 1 PR / 1–2 hrs each.

## Verification per PR

End-to-end check on every PR before requesting review:

1. `npm run typecheck`; must stay at 0.
2. `npm run typecheck:strict`; must not regress (ratchet down if
   improved).
3. `npm run lint:gate`; same rule.
4. `npm test`; unit + integration green.
5. `npx playwright test`; e2e green, desktop + mobile.
6. `supabase db reset && npm run test:integration`; fresh local
   Supabase, confirm RLS and emitter behaviour against the real
   schema.
7. Manual: build a tiny automation in the local dev app that uses
   the new trigger/action; trigger via the test endpoint; observe
   it run end-to-end in the audit log UI.

## Critical files (read before implementation begins)

- `.claude/docs/automations.md`; canonical doc; every PR diffs it.
- `.claude/docs/production-readiness.md` §5 (DoD), §1 (locked
  decisions), Phase 14a status.
- `app/api/cron/automations-tick/route.ts`; tick entrypoint;
  framework hooks here.
- `lib/automations/dispatcher.ts`; event → run-open path.
- `lib/automations/runner.ts`; run advancement.
- `lib/automations/triggers.ts` + `trigger-constants.ts`; matchers
  + UI metadata.
- `lib/automations/actions/index.ts` + the per-category files ,
  action registry.
- `supabase/migrations/20260604000000_create_automations_foundation.sql`
 ; table shapes + RPC signature.
- `supabase/migrations/20260604000100_create_automation_db_triggers.sql`
  + `20260605000100_extend_automation_db_triggers.sql`; the DB
  triggers that already emit `automation_events` (so the
  time-emitter framework follows the same payload shape).

## What this plan does NOT cover

- Phase 14b (SMS / WhatsApp / IG / AI helpers); separate
  brainstorm + spec.
- Builder UX changes (drag-to-reorder, full questionnaire editor,
  custom-field catalogue UI); listed as "future work" in
  `automations.md`; tracked there, not here.
- Backfilling automation runs for historic data; out of scope;
  triggers only fire forward.
- New trigger categories beyond the existing catalogue; if we want
  e.g. "lead source changed", that's a separate add (new DB
  trigger or new emitter), and gets brainstormed first.

## Open questions (resolve before the relevant PR begins)

1. **Idempotency bucket granularity**; day-granularity works for
   `_due` / `_overdue`, but `time_before_event.offset` could be
   hour-level. **Resolved (A1):** day-grain bucket (UTC) is the
   default; per-day dedupe queries `automation_events` directly
   using `created_at` ≥ `date_trunc('day', now())` and the matching
   `payload` field that identifies the bucket (e.g.
   `payload.days_until_due`). Hour-grain emitters will swap in their
   own bucket key in their event payload when needed.

2. **Timezone for time-emitters**; day boundaries are UTC, so AU
   users see "today" tick over at ~11am local time. Since T1/T2 are
   **day-grain only** (decided; no sub-day offsets), this is the
   only timezone effect, same as `_due` / `_overdue`. Per-user
   timezone awareness is only needed if sub-day offsets are ever
   added; not now.

3. **E2E coverage for time-emitters**; A1–A5 shipped with unit +
   integration coverage but no Playwright e2e (no automations e2e
   harness today, and the cron route isn't a user-driven UI
   surface). A follow-up PR will add a shared automations e2e spec;
   first non-trivial candidate is T1 because it intersects the
   builder's per-config-form UX.

4. **Cron frequency**; Vercel Hobby caps the cron schedule at once
   per day. `vercel.json` is `0 1 * * *` (1 am UTC daily). Fine for
   every day-bucketed trigger (A1–A5). **Decision (2026-06-14):
   T1/T2 stay day-grain only** (offsets in days), so the daily cron
   is sufficient and we are **not** upgrading to Vercel Pro yet.
   Sub-day offsets / "within the hour" reminders are deferred until
   there's a concrete reason to pay for Pro.

## A1 lessons (recorded for future items)

End-to-end manual testing of A1 on the cloud dev project surfaced
**seven pre-existing bugs** the local integration suite hadn't
caught; none in A1 itself, all in the surrounding builder, runtime,
and migration history. Worth being aware of before A2:

1. **`/api/email/send-quote` gated the `draft → sent` status flip
   on `share_token_enabled` being false.** A later migration
   defaulted that flag to `true` on insert, silently killing the
   transition. Fixed in this PR.
2. **Trigger picker wrote `triggerConfig: {}`** instead of seeding
   the Zod-schema defaults; every trigger with a `.default()`
   field was skipped by the emitters and dispatcher. Picker,
   emitter, and dispatcher all now defaults-parse via the spec
   schema. Fixed.
3. **Dispatcher coerced caught errors as the literal string
   `'unknown'`.** Supabase JS errors aren't `Error` instances, so
   PGRST / RLS / constraint failures lost their diagnostic info
   inside the try/catch. Fixed with a `describeError` helper.
4. **Inspector `ActionFields` read `actionType` from
   `config['type']`** which is always undefined; the action's
   type lives at the row level. Every registered action's
   inspector rendered as an empty panel. Fixed.
5. **Quote modal `sendEmail` didn't invalidate `couple-quotes`**,
   so sending from a couple profile left the parent list showing
   `draft` until manual refresh. Fixed.
6. **Foundation migration column was renamed in source
   (`current_step_id → current_action_id`) without a column-rename
   migration.** Envs that applied the foundation migration before
   the rename kept the old name + a legacy `automation_steps` FK
   target. Two remediation migrations (`20260609000000`,
   `20260609000100`) rename the column and re-point the FK,
   guarded so fresh envs are no-ops.
7. **Cloud ledger drift**; `supabase db push` reported "up to
   date" but the tables didn't exist (foundation migration died
   mid-flight previously). Resolved with
   `supabase migration repair --status reverted ...` + idempotency
   guards (`drop policy if exists`, `drop trigger if exists`) on
   every non-idempotent CREATE in the three foundation migrations.

### Implications for the remaining emitters (T1–T3)

- **Every trigger with `.default()` fields needs a unit test for
  `match()` narrowing**, especially if the predicate uses strict
  equality.
- **The runtime trio (picker / emitter / dispatcher) must agree on
  how config defaults are applied.** Centralised on
  `spec.configSchema.safeParse(...)`; follow the pattern without
  inventing new defaulting logic.
- **Migration deploy hygiene:** never edit a shipped migration to
  rename a column. Add a rename migration instead. The §7.9 ledger
  rule was already documented; this PR adds idempotency guards on
  the foundation migration as belt-and-braces for any future
  drift incident.
