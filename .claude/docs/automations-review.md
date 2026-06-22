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
| 1 | `new_enquiry` | A couple is added | `leadSource`; ⚠️`daysUntilEvent`, `hasEventDate`, `hasVenue`, `dayOfWeek`, `eventMonth`, `season`, `budgetTier`, `referralByContactId` | ✅ | **SIMPLIFY** — keep `leadSource` only, drop 8 dead inputs |
| 4 | `couple_stage_changed` | Couple moves pipeline stage | `toStatus`, `fromStatus`, `daysUntilEvent`; ⚠️`timeInPreviousStage`, `triggeredBy` | ✅ | **KEEP** — core. Drop the 2 dead inputs |
| 5 | `booking_cancelled` | Couple cancels | `daysUntilEvent`; ⚠️`cancellationReason`, `depositAlreadyPaid`, `daysSinceBooked` | ✅ | **KEEP** — simplify to no filters |
| 8 | `quote_created` | Quote drafted | `amountOp`+`amountValue`; ⚠️ 8 unwired fields: `tier`, `hasAddOns`, `discountApplied`, `versionNumber`, `isDeposit`, `isFinalBalance`, `isPartial`, `paymentMethod` | ✅ | **SIMPLIFY** — keep amount filter, drop 8 |
| 9 | `quote_sent` | Quote share link goes live | as above | ✅ | **KEEP** — simplify inputs |
| 10 | `quote_accepted` | Couple accepts a quote | as above | ✅ | **KEEP** — simplify inputs |
| 11 | `quote_declined` | Couple declines a quote | as above | ✅ | **KEEP** — simplify inputs |
| 12 | `quote_due` | Quote reaches expiry | `days`; ⚠️`notificationCount`, `respectQuietHours` | ⏳ | **KEEP** |
| 13 | `quote_overdue` | Quote past expiry, unaccepted | `daysOverdueMin/Max`; ⚠️`couplePreviouslyViewed` | ⏳ | **KEEP** |
| 15 | `invoice_created` | Invoice drafted | amount filter (as quote) | ✅ | **SIMPLIFY** |
| 16 | `invoice_sent` | Invoice share link goes live | amount filter | ✅ | **KEEP** — simplify |
| 17 | `payment_received` | Couple makes a payment | amount filter | ✅ | **KEEP** — simplify |
| 18 | `invoice_due` | Invoice reaches due date | `days`; ⚠️`notificationCount`, `respectQuietHours`, `isFinalBalance` | ⏳ | **KEEP** |
| 19 | `invoice_overdue` | Invoice past due, unpaid | `daysOverdueMin/Max`; ⚠️`isFinalBalance`, `daysUntilEvent` | ⏳ | **KEEP** |
| 23 | `contract_created` | Contract drafted | ⚠️ all 4 (`daysUntilEvent`, `templateUsed`, `versionNumber`, `signerRole`) | ✅ | **SIMPLIFY** — drop all filters |
| 24 | `contract_sent` | Contract emailed | ⚠️ as above | ✅ | **KEEP** — no filters |
| 25 | `contract_signed` | Couple signs | ⚠️ above + `timeToSign`, `signedByBoth` | ✅ | **KEEP** — no filters |
| 26 | `contract_declined` | Couple declines | ⚠️ as above | ✅ | **KEEP** — no filters |
| 28 | `contract_expired` | Contract expires unsigned | ⚠️ as above | ✅ | **KEEP** — no filters |
| 30 | `event_created` | Ceremony/reception added | `eventType`, `dayOfWeek`; ⚠️`month`, `season`, `daysUntilEvent`, `hasVenue`, `isDestination`, `guestCount` | ✅ | **KEEP** — keep `eventType`, drop 6 |
| 31 | `event_updated` | Event date/venue/details change | event filter + `changed` | ✅ | **KEEP** — keep `changed` (date/venue) only |
| 33 | `time_before_event` | X time before the wedding | `amount`+`unit`, `eventType`, `timeOfDay`, `dayOfWeek`, `skipIfPaused`, `eventStatus`, `respectPublicHolidays`, `onlyIfNoReviewPosted`, `onlyIfNotReferred` | ⛔ | **PROMOTE** — backbone of MC flows. Keep `amount`+`unit`+`eventType`, drop the rest |
| 34 | `time_after_event` | X time after the wedding | same as #33 | ⛔ | **PROMOTE** — thank-you / review. Same trim |
| 36 | `anniversary_of_event` | N years after the wedding | `years`, `maxYears`, `onlyIfMarriedByMe`, `onlyIfHadGoodOutcome` | ⛔ | **KEEP** — nice-to-have, defer |
| 38 | `section_completed` | Couple submits a portal section | `section`, `category` | ✅ | **KEEP** |
| 40 | `timeline_edited` | Timeline added to / changed | ⚠️`editedBy`, `itemsAdded/Removed` | ✅ | **KEEP** — no filters |
| 41 | `couple_uploaded_file` | Couple adds a file | `fileType`, `section`, `sizeBytes` | ⛔ | **KEEP** |
| 42 | `couple_added_song_to_playlist` | Couple adds a song | `playlistKey`, `songCount` | ⛔ | **KEEP** |
| 43 | `couple_completed_vows` | Vow drafts submitted | `who` | ⛔ | **KEEP** |
| 44 | `task_created` | A task is added | ⚠️`taskCategory`, `taskPriority`, `dueWithinDays` | ✅ | **KEEP** — no filters (no category/priority cols) |
| 45 | `task_completed` | A task is marked done | ⚠️ as above | ✅ | **KEEP** — no filters |
| 46 | `task_overdue` | Task past due date | `daysOverdueMin/Max`; ⚠️`assignedTo` + shared | ⏳ | **KEEP** |
| 47 | `contact_created` | Vendor/family added | `category`, `hasEmail`; ⚠️`hasPhone`, `isPrimaryVendor`, `region` | ✅ | **KEEP** — keep `category`, drop 3 |
| 49 | `contact_linked_to_couple` | Contact attached to a couple | as above | ✅ | **KEEP** — vendor coordination |

## ACTIONS

| # | Action | What it does | Inputs | Status | Recommendation |
|---|---|---|---|---|---|
| 1 | `send_email` | Custom email with variables | `recipients`, `subject`, `body`, `wrap`, `replyToOverride`, `ccVendors`, `bccSelf`; ⚠️ attach/track/sendAt fields | ✅ | **KEEP** — the workhorse |
| 2 | `send_sms` | Text message | `recipients`, `body`, `senderId`, `truncateAt`… | ⛔ | **KEEP** (keep 1 greyed "coming soon" if desired) |
| 4 | `update_couple_stage` | Move pipeline status | `toStatus`, `onlyIfCurrentStatus`, `addNote` | ✅ | **KEEP** |
| 5 | `add_note` | Append a note to the couple | `text`, `category`; ⚠️`pinned`, `visibleToCouple` | ✅ | **KEEP** |
| 7 | `send_portal_link` | Share the portal link | `message`, `subject`; ⚠️`expiresInDays`, `restrictToSection`, `magicLinkRecipient` | ✅ | **KEEP** |
| 8 | `request_information` | Ask couple to fill a section | `section`, `message`; ⚠️`dueDate`, `reminderCadence`, `escalateAfterDays` | ✅ | **KEEP** |
| 9 | `create_couple` | Add a new couple | `name`, `email`, `phone`, `eventDate`, `leadSource`; ⚠️ 6 more | ✅ | **KEEP** (for webhook/manual intake) |
| 10 | `pause_couple_automations` | Halt this couple's other flows | ⚠️`pauseForDays`, `pauseReason`, `pauseCategory` | ✅ | **KEEP** — simplify |
| 11 | `create_task` | Add a task for the MC | `title`, `description`, `dueDate`, `relativeToEvent`; ⚠️ category/priority/assign/linkedDoc/reminder | ✅ | **KEEP** — drop dead inputs |
| 12 | `update_task` | Update a task | `taskId`, `status`, `title`, `description`, `dueDate`; ⚠️ append/reassign/push | ✅ | **KEEP** — simplify |
| 15 | `send_quote` | Email the couple a quote | `quoteId`; ⚠️`templateId`, `expiryDays`, `customMessage`, `attach`, `cc` | ✅ | **KEEP** |
| 16 | `send_contract` | Email a contract to sign | `contractId`; ⚠️`templateId`, `signersRequired`, `expiryDays`, `customMessage` | ✅ | **KEEP** |
| 17 | `send_invoice` | Email an invoice | `invoiceId`; ⚠️`paymentMethods`, `dueInDays`, `latePaymentFee`, `customMessage` | ✅ | **KEEP** |
| 18 | `trigger_payment_reminder` | Re-send unpaid invoice (routes to #17) | invoice fields; ⚠️`tone`, `escalationLevel`, `attachLateFee` | ✅* | **KEEP** |
| 19 | `generate_run_sheet_pdf` | Produce a run-sheet PDF | `eventId`, `format`, `includeContacts`, `includeTimings`, `saveToFiles`, `emailToSelf` | ⛔ | **KEEP** (or PROMOTE — returns ok but makes nothing) |
| 20 | `create_timeline_event` | Add a timeline item | `eventId`, `title`, `description`, `startTime`, `durationMin`; ⚠️ category/vendor/cue/buffer | ✅ | **KEEP** — simplify |
| 22 | `send_timeline_to_vendors` | Email vendors the timeline link | `eventId`, `message`; ⚠️ filter/format/cc/attach/confirm | ✅ | **KEEP** — vendor coordination |
| 23 | `send_final_run_sheet` | Send final run sheet (routes to #22) | same as #22 | ✅* | **KEEP** |
| 25 | `send_pre_event_checklist` | Countdown checklist email | `subject`, `body` | ✅ | **KEEP** |
| 26 | `send_thank_you_message` | Post-event thank-you | `subject`, `body` | ✅ | **KEEP** |
| 27 | `request_review` | Ask for a Google/vendor review | `subject`, `body`; ⚠️`platforms`, `incentive`, `followUpIfIgnored` | ✅ | **KEEP** |
| 28 | `send_referral_request` | Ask for referrals | `subject`, `body`; ⚠️`referralBonus`, `trackingLink` | ✅ | **KEEP** |
| 47 | `create_invoice_from_quote` | Draft invoice from quote | `quoteId`, `paymentSchedule`, `dueDate` | ⛔ | **PROMOTE** — high value, real workflow |

## FLOW CONTROL (runner-evaluated)

| Step | What it does | Inputs | Status | Recommendation |
|---|---|---|---|---|
| `wait` | Pause N time before the next step | duration; quiet-hours aware | ✅ | **KEEP** — essential |
| `branch` | If/else on a condition | condition (yes/no paths) | ✅ | **KEEP** — essential |
| `stop` | End the run | — | ✅ | **KEEP** |
