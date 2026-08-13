# Automations — Triggers & Actions Inventory + Recommendation

> **Outcome (2026-06-14):** decisions from this review are locked in
> `automations-wiring.md` → "Catalogue review outcome". The launch
> rule: a trigger/action is visible in the picker only if it does
> something today; everything dead is hidden (not deleted). Dead
> inputs are stripped from the visible tiles. This file stays as the
> per-row audit of record.

> Review artifact. Status: ✅ Live · ⏳ Live (cron/date) · 🔌 Live (manual) · ⛔ Stub (in picker, does nothing).
> Inputs marked ⚠️ = render in the form and save, but the engine ignores them.
> Recommendation: **KEEP** · **PROMOTE** (dead now, high value — wire it) · **CUT** (remove from picker) · **SIMPLIFY** (keep tile, delete the dead inputs).

## TRIGGERS

| # | Trigger | What it fires on | Inputs | Status | Recommendation |
|---|---|---|---|---|---|
| 1 | `new_enquiry` | A couple is added | `leadSource`, `daysUntilEvent`, `hasEventDate`, `dayOfWeek`, `eventMonth`, `season`, `initialStatus` | ✅ | **DONE (2026-08-12)** — every input above is now enforced in `match()`; `hasVenue`, `budgetTier`, `referralByContactId` deleted (no backing data). Filters render via the add-filter list, not as always-on selects |
| 4 | `couple_stage_changed` | Couple moves pipeline stage | `toStatus`, `fromStatus`, `leadSource`, `daysUntilEvent`, `hasEventDate`, `dayOfWeek`, `eventMonth`, `season` | ✅ | **DONE (2026-08-13)** — chip UI, every input enforced in `match()`; `timeInPreviousStage` + `triggeredBy` deleted (no backing data); `lead_source` added to the emit payload |
| 5 | ~~`booking_cancelled`~~ | Couple cancels | — | ❌ | **RETIRED (2026-08-13)** — never fired: its emit block tested `status in ('cancelled','lost')`, slugs absent from the seeded `couple_statuses` set. Folded into `couple_stage_changed` ("moved into <stage>"), which uses the MC's real stage names |
| 8 | ~~`quote_created`~~ | Quote drafted | — | ❌ | **GONE** — the quotes feature was dropped 2026-07-11; specs + catalogue entries removed with it |
| 9 | ~~`quote_sent`~~ | — | — | ❌ | **GONE** (quotes dropped) |
| 10 | ~~`quote_accepted`~~ | — | — | ❌ | **GONE** (quotes dropped) |
| 11 | ~~`quote_declined`~~ | — | — | ❌ | **GONE** (quotes dropped) |
| 12 | ~~`quote_due`~~ | — | — | ❌ | **GONE** (quotes dropped) |
| 13 | ~~`quote_overdue`~~ | — | — | ❌ | **GONE** (quotes dropped) |
| 15 | `invoice_created` | Invoice drafted | `amount` (on the **total**), `hasDiscount`, `hasDueDate`, `dueInDays`, + the wedding-date family | ✅ | **DONE (2026-08-13)** — chip UI, every input enforced. Amount now compares the computed total, not the raw subtotal. The 8 speculative fields on the shared amount schema deleted; `discountApplied` rebuilt as `hasDiscount` with real data |
| 16 | `invoice_sent` | Invoice share link goes live | same set as `invoice_created` | ✅ | **DONE (2026-08-13)** — chip UI sharing the invoice_created matcher. Its old amount filter compared a field the payload never carried, so a configured filter matched nothing; payload enriched (`20260813030000`) |
| 17 | `payment_received` | Couple makes a payment | `amount` (total) + wedding-date family | ✅ | **DONE (2026-08-13)** — chip UI; payload gains `total` + `event_date` |
| 18 | `invoice_due` | Invoice reaches due date | `days` (required chip), `isFinalBalance` | ✅ | **DONE (2026-08-13)** — chip UI; `notificationCount` + `respectQuietHours` deleted (nothing read them; quiet hours live on `wait` steps) |
| 19 | `invoice_overdue` | Invoice past due, unpaid | `daysOverdueMin` (required chip), `isFinalBalance` | ✅ | **DONE (2026-08-13)** — chip UI; `daysOverdueMax` deleted (exact-depth match made it redundant or unsatisfiable), `daysUntilEvent` deleted (no payload field) |
| 23 | `contract_created` | Contract drafted | wedding-date family | ✅ | **DONE (2026-08-13)** — chip UI; all 4 scaffolding filters deleted, `event_date` joined into the payload (`20260813040000`) |
| 24 | `contract_sent` | Contract emailed | wedding-date family | ✅ | **DONE (2026-08-13)** — as #23 |
| 25 | `contract_signed` | Couple signs | wedding-date family | ✅ | **DONE (2026-08-13)** — as #23; `timeToSign` + `signedByBoth` deleted (single-signer flow) |
| 26 | `contract_declined` | Couple declines | wedding-date family | ✅ | **DONE (2026-08-13)** — as #23 |
| 28 | `contract_expired` | Contract expires unsigned | wedding-date family | ✅ | **DONE (2026-08-13)** — as #23 |
| 30 | `event_created` | Ceremony/reception added | date family (on `events.date`), `hasVenue` | ✅ | **DONE (2026-08-13)** — chip UI. `eventType` deleted everywhere: the app never writes it, every row holds the `'ceremony'` default. `isDestination` + `guestCount` deleted (no columns) |
| 31 | `event_updated` | Event date/venue/details change | `changed` (any/date/venue) + created set | ✅ | **DONE (2026-08-13)** — chip UI |
| 33 | `time_before_event` | X days before the event | `amount` (required chip) + day/month/season buckets | ✅ | **DONE (2026-08-13)** — chip UI; `eventType` + the 7 scheduling extras deleted (nothing read them) |
| 34 | `time_after_event` | X days after the event | as #33 | ✅ | **DONE (2026-08-13)** — as #33 |
| 36 | `anniversary_of_event` | N years after the event | `years` (required chip), `maxYears` | ✅ | **DONE (2026-08-13)** — chip UI; `onlyIf*` deleted (no data) |
| 38 | `section_completed` | Couple adds a person / song / file to the portal | `section` + per-section: `personType` (people), `songCategory` (songs), `sizeBytes` (files) | ✅ | **DONE (2026-08-13)** — chip UI, relabelled **"Portal item added"** (it is an AFTER INSERT emitter: seven songs = seven fires, so the old "section completed" label promised a signal it never sent). **#41 and #42 folded in here**, retiring two picker entries that fired on the same INSERTs. Type string unchanged so saved automations resolve |
| 40 | `timeline_edited` | Timeline added to / changed | `change` (any/added/changed) | ✅ | **DONE (2026-08-13)** — chip UI backed by the payload's `op`; `editedBy` + item counts deleted |
| 41 | ~~`couple_uploaded_file`~~ | Couple adds a file | — | 🔕 | **FOLDED INTO #38 (2026-08-13)** — fired on the same `portal_files` INSERT as `section_completed`, so one upload lit up two picker entries and emitted two events. Existed only to carry a size filter, which now lives on "Portal item added" under section = Files. Spec + emitter retained, hidden from the picker, so saved automations keep firing |
| 42 | ~~`couple_added_song_to_playlist`~~ | Couple adds a song | — | 🔕 | **FOLDED INTO #38 (2026-08-13)** — as #41, for the playlist-slot filter under section = Songs |
| 43 | `couple_completed_vows` | Vow drafts submitted | `who` | ✅ | **DONE (2026-08-13)** — chip UI (already enforced) |
| 44 | `task_created` | A task is added | `taskPriority`, `taskType` (MC's own option names), `hasDueDate`, `dueInDays` | ✅ | **DONE (2026-08-13)** — chip UI; payload gains priority/type (`20260813050000`). The invented enums deleted |
| 45 | `task_completed` | A task is marked done | `taskPriority`, `taskType` | ✅ | **DONE (2026-08-13)** — as #44 |
| 46 | `task_overdue` | Task past due date | `daysOverdueMin` (required chip), `taskPriority`, `taskType` | ✅ | **DONE (2026-08-13)** — chip UI; priority/type now enforced, `daysOverdueMax` + `assignedTo` deleted |
| 47 | `contact_created` | Vendor/family added | `category`, `hasEmail`, `hasPhone` | ✅ | **DONE (2026-08-13)** — chip UI; all three enforced, `isPrimaryVendor` + `region` deleted |
| 49 | `contact_linked_to_couple` | Contact attached to a couple | `category` | ✅ | **DONE (2026-08-13)** — chip UI (the linked payload carries category only) |

## ACTIONS

| # | Action | What it does | Inputs | Status | Recommendation |
|---|---|---|---|---|---|
| 1 | `send_email` | Custom email with variables | `recipients`, `subject`, `body`, `wrap`, `replyToOverride`, `ccVendors`, `bccSelf`; ⚠️ attach/track/sendAt fields | ✅ | **KEEP** — the workhorse |
| 2 | `send_sms` | Text message | `recipients`, `body`, `senderId`, `truncateAt`… | ⛔ | **KEEP** (keep 1 greyed "coming soon" if desired) |
| 4 | `update_couple_stage` | Move pipeline status | `toStatus` | ✅ | **DONE (2026-08-13)** — `onlyIfCurrentStatus` + `addNote` deleted from the schema (never read) |
| 5 | `add_note` | Append a note to the couple | `text` | ✅ | **DONE (2026-08-13)** — `category` / `pinned` / `visibleToCouple` deleted (notes are one shared column) |
| 7 | `send_portal_link` | Share the portal link | `message` | ✅ | **DONE (2026-08-13)** — subject / expiry / section / recipient fields deleted (never read) |
| 8 | `request_information` | Ask couple to fill a section | `section`, `message` | ✅ | **DONE (2026-08-13)** — dueDate / reminderCadence / escalateAfterDays deleted (no machinery) |
| 9 | `create_couple` | Add a new couple | `name`, `email`, `phone`, `eventDate`, `leadSource` | ✅ | **DONE (2026-08-13)** — the 6 unread extras deleted |
| 10 | `pause_couple_automations` | Halt this couple's other flows | — | ✅ | **DONE (2026-08-13)** — the handler reads no config; scaffolding fields deleted |
| 11 | `create_task` | Add a task for the MC | `title`, `description`, `dueDate`, `relativeToEvent` | ✅ | **DONE (2026-08-13)** — category/priority/assign/linkedDoc deleted (invented enums, no columns) |
| 12 | `update_task` | Update a task | `taskId`, `status`, `title`, `description`, `dueDate`; ⚠️ append/reassign/push | ✅ | **KEEP** — simplify |
| 15 | ~~`send_quote`~~ | — | — | ❌ | **GONE** (quotes dropped) |
| 16 | `send_contract` | Email a contract to sign | `contractId`; ⚠️`templateId`, `signersRequired`, `expiryDays`, `customMessage` | ✅ | **KEEP** |
| 17 | `send_invoice` | Email an invoice | `invoiceId` | ✅ | **DONE (2026-08-13)** — paymentMethods / dueInDays / lateFee / customMessage deleted (the invoice is sent as saved) |
| 18 | ~~`trigger_payment_reminder`~~ | — | — | 🔕 | **FOLDED INTO #17 (2026-08-13)** — its handler delegated verbatim to send_invoice, and it never filtered to unpaid despite its label. Registry entry retained, hidden from the picker |
| 19 | ~~`generate_run_sheet_pdf`~~ | — | — | 🔕 | **FOLDED INTO #22 (2026-08-13)** — same run-sheet link, sent to the MC (+ optionally couple); now the sendToMe / sendToCouple checkboxes on "Send run sheet". Registry entry retained |
| 20 | `create_timeline_event` | Add a timeline item | `eventId`, `title`, `description`, `startTime`, `durationMin` | ✅ | **DONE (2026-08-13)** — category/vendor/cue/buffer deleted (no columns) |
| 22 | `send_timeline_to_vendors` | Email the run sheet link | `message`, `sendToVendors` / `sendToCouple` / `sendToMe` | ✅ | **DONE (2026-08-13)** — relabelled **"Send run sheet"**; absorbs #23 and #19/AC1 via recipient checkboxes. Pre-merge configs default to vendors-only, so nothing saved changes behaviour. The old RecipientsField here was a dead input (handler hardcoded vendors) |
| 23 | ~~`send_final_run_sheet`~~ | — | — | 🔕 | **FOLDED INTO #22 (2026-08-13)** — same handler with the MC's typed message silently replaced by canned copy, and it claimed "couple + vendors" while sending vendors only. Registry entry retained |
| 25 | `send_pre_event_checklist` | Countdown checklist email | `subject`, `body` | ✅ | **KEEP** |
| 26 | `send_thank_you_message` | Post-event thank-you | `subject`, `body` | ✅ | **KEEP** |
| 27 | `request_review` | Ask for a Google/vendor review | `subject`, `body` | ✅ | **DONE (2026-08-13)** — platforms / incentive / followUp deleted |
| 28 | `send_referral_request` | Ask for referrals | `subject`, `body` | ✅ | **DONE (2026-08-13)** — referralBonus / trackingLink deleted |
| 47 | ~~`create_invoice_from_quote`~~ | — | — | ❌ | **GONE** (quotes dropped) |

## FLOW CONTROL (runner-evaluated)

| Step | What it does | Inputs | Status | Recommendation |
|---|---|---|---|---|
| `wait` | Pause N time before the next step | duration; quiet-hours aware | ✅ | **KEEP** — essential |
| `branch` | If/else on a condition | condition (yes/no paths) | ✅ | **KEEP** — essential |
| `stop` | End the run | — | ✅ | **KEEP** |
