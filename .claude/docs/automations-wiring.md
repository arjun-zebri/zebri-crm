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

## Remaining backlog (review-file scope)

The complete list of what's left to build. Each ships as its own PR
through `staging` per the recipe below, and **adds itself to the
`launch-catalogue.ts` allowlist in the same PR** (that's what
unhides it). Order is value-first.

| Status | ID  | Item                            | Notes                                                                                              |
| :----: | --- | ------------------------------- | -------------------------------------------------------------------------------------------------- |
|   ☑    | T1  | `time_before_event`             | Shipped — `lib/automations/time-emitters/time-before-event.ts`. Fires on `events.date = today + amount` days, narrowed by `eventType`; cancelled events skipped. **Day-grain only** (emitter ignores `unit != days`; inspector shows "Days before the event", no unit picker). Unit + integration tests green |
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

### Triggers — VISIBLE after cleanup (28, fire today)

`new_enquiry`, `couple_stage_changed`, `booking_cancelled`,
`quote_created`, `quote_sent`, `quote_accepted`, `quote_declined`,
`quote_due`, `quote_overdue`, `invoice_created`, `invoice_sent`,
`payment_received`, `invoice_due`, `invoice_overdue`,
`contract_created`, `contract_sent`, `contract_signed`,
`contract_declined`, `contract_expired`, `event_created`,
`event_updated`, `section_completed`, `timeline_edited`,
`task_created`, `task_completed`, `task_overdue`, `contact_created`,
`contact_linked_to_couple`.

### Triggers — HIDDEN

- **In review, not built yet (unhide when wired — backlog T1–T3 /
  P1–P3 above):** `time_before_event`, `time_after_event`,
  `anniversary_of_event`, `couple_uploaded_file`,
  `couple_added_song_to_playlist`, `couple_completed_vows`.
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
  actually wired (review implied dead); both still slated to drop
  per the simplify pass (daysUntilEvent is ~always empty at enquiry
  time).

## The per-item recipe (every PR)

Every wiring PR — trigger or action — must satisfy this checklist.
This **is** the per-page DoD (`production-readiness.md` §5)
translated to a per-feature DoD for automations.

### For a time-based trigger

1. **Predicate** — extend the time-based section of the tick route
   (or a new `lib/automations/time-emitters/<trigger>.ts`) with the
   "what's due" query. Must be idempotent: dedupe by
   `(user_id, source_table, source_id, event_type, bucket_date)`
   so the same quote doesn't re-fire every minute.
2. **Emit** — call the existing `emit_automation_event()` RPC with
   `source_table`, `source_id`, `event_type`, payload, `couple_id`.
3. **Matcher** — confirm `lib/automations/triggers.ts` matcher
   already exists; if not, add it. Zod schema for any
   per-automation config (e.g. `time_before_event.offset`).
4. **Unit test** — `tests/unit/lib/automations/time-emitters/<trigger>.test.ts`
   covering: not-due (no fire), just-due (fires once), past-due
   already-fired (no re-fire).
5. **Integration test** — `tests/integration/automations/<trigger>.test.ts`
   against local Supabase: seed a couple + matching source row,
   run the emitter, assert one row in `automation_events`, run
   again, assert still one row (idempotency under RLS).
6. **E2E** — extend the existing automations e2e to build an
   automation using this trigger + `send_email`, fast-forward via
   the tick test endpoint, assert the email was queued.
7. **Audit log narrative** — update
   `lib/automations/audit-log/narrate.ts` so the new event renders
   a human sentence in the run log.
8. **Doc** — append a row to the trigger table in
   `automations.md`, flip its "wired" column. Tick the row in this
   doc.
9. **TSDoc** on the exported emitter + Zod config schema.
10. **Slack alert** — confirm `automation_failed` already covers
    runtime errors. No new alert unless the emitter itself can
    silently no-op (e.g. missing column) — in which case add one
    `automation_emitter_skipped` warn.

### For an extended action

1. **Handler** — flip `comingSoon: false` in the action spec and
   implement the handler in `lib/automations/actions/<category>.ts`.
   Handler signature is already established
   (`RunContext` + config → `ActionResult`).
2. **Zod config** — define / refine the per-action config schema.
3. **Inspector form** — update
   `app/(dashboard)/automations/[id]/inspector-panel.tsx` so the
   builder UI matches the new schema (not just a placeholder).
4. **Side-effect tests** — unit-test the handler with mocked
   primitives; integration-test the side effect against local
   Supabase (e.g. a tag write actually appears in `couple_tags`).
5. **E2E** — automation that fires the action end-to-end.
6. **Doc** — flip the row in `automations.md`'s action catalogue.
   Tick the row in this doc.
7. **TSDoc** + why-comments per CLAUDE.md.
8. **Rate-limit / cost guard** if the action calls an external
   billable API (Resend etc. already covered).

### Branch + PR conventions

- Branch: `automations/<bucket-id>-<short-name>` —
  e.g. `automations/A1-quote-due`.
- All wiring PRs land on `staging` (per
  `feedback_staging_only_batch.md` — no per-PR `main` promotion in
  this batch).
- PR title prefix: `Automations:` so they're easy to filter.
- PR body must show the doc diff (`automations.md` +
  `automations-wiring.md`) front-and-centre.
- Ratchet `scripts/typecheck-strict-gate.mjs` and
  `scripts/lint-gate.mjs` downward where the PR reduces them.

## Exemplar: A1 — `quote_due`

The first PR has more work than the others because it **builds the
time-based emitter framework**. Subsequent A-rows slot into the
framework with ~50 LoC each.

### Framework (built once, in A1)

- **New module:** `lib/automations/time-emitters/index.ts`
  - Exports `runTimeEmitters(ctx)` — called by the tick route
    once per minute, after the existing event dispatcher pass.
  - Per-emitter contract: `{ id, run(ctx): Promise<number> }` —
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
  the trigger logically fires for (e.g. the due_date) — prevents
  re-emit on every tick.

### A1-specific work (`quote_due`)

- **Predicate:** all quotes where `status = 'sent'` AND
  `due_date::date = current_date` AND not already emitted today.
- **Emit:** `emit_automation_event(user_id, 'quotes', quote.id,
  'quote_due', payload, couple_id)`.
- **Payload:** `{ quote_id, quote_number, due_date, amount_due,
  couple_id }` — keep small; runner can hydrate from DB.
- **Test seeds:** quote due today (fires), due yesterday (no
  fire — already-bucketed yesterday), due tomorrow (no fire),
  status `accepted` (no fire), status `draft` (no fire).

### After A1 lands

The remaining time-emitters (backlog T1–T3) follow the framework.
Per-PR work shrinks to: write a single
`lib/automations/time-emitters/<trigger>.ts` file, register it,
write three tests, add a doc row, and add the trigger to the
`launch-catalogue.ts` allowlist. Estimated 1 PR / 1–2 hrs each.

## Verification per PR

End-to-end check on every PR before requesting review:

1. `npm run typecheck` — must stay at 0.
2. `npm run typecheck:strict` — must not regress (ratchet down if
   improved).
3. `npm run lint:gate` — same rule.
4. `npm test` — unit + integration green.
5. `npx playwright test` — e2e green, desktop + mobile.
6. `supabase db reset && npm run test:integration` — fresh local
   Supabase, confirm RLS and emitter behaviour against the real
   schema.
7. Manual: build a tiny automation in the local dev app that uses
   the new trigger/action; trigger via the test endpoint; observe
   it run end-to-end in the audit log UI.

## Critical files (read before implementation begins)

- `.claude/docs/automations.md` — canonical doc; every PR diffs it.
- `.claude/docs/production-readiness.md` §5 (DoD), §1 (locked
  decisions), Phase 14a status.
- `app/api/cron/automations-tick/route.ts` — tick entrypoint;
  framework hooks here.
- `lib/automations/dispatcher.ts` — event → run-open path.
- `lib/automations/runner.ts` — run advancement.
- `lib/automations/triggers.ts` + `trigger-constants.ts` — matchers
  + UI metadata.
- `lib/automations/actions/index.ts` + the per-category files —
  action registry.
- `supabase/migrations/20260604000000_create_automations_foundation.sql`
  — table shapes + RPC signature.
- `supabase/migrations/20260604000100_create_automation_db_triggers.sql`
  + `20260605000100_extend_automation_db_triggers.sql` — the DB
  triggers that already emit `automation_events` (so the
  time-emitter framework follows the same payload shape).

## What this plan does NOT cover

- Phase 14b (SMS / WhatsApp / IG / AI helpers) — separate
  brainstorm + spec.
- Builder UX changes (drag-to-reorder, full questionnaire editor,
  custom-field catalogue UI) — listed as "future work" in
  `automations.md`; tracked there, not here.
- Backfilling automation runs for historic data — out of scope;
  triggers only fire forward.
- New trigger categories beyond the existing catalogue — if we want
  e.g. "lead source changed", that's a separate add (new DB
  trigger or new emitter), and gets brainstormed first.

## Open questions (resolve before the relevant PR begins)

1. **Idempotency bucket granularity** — day-granularity works for
   `_due` / `_overdue`, but `time_before_event.offset` could be
   hour-level. **Resolved (A1):** day-grain bucket (UTC) is the
   default; per-day dedupe queries `automation_events` directly
   using `created_at` ≥ `date_trunc('day', now())` and the matching
   `payload` field that identifies the bucket (e.g.
   `payload.days_until_due`). Hour-grain emitters will swap in their
   own bucket key in their event payload when needed.

2. **Timezone for time-emitters** — day boundaries are UTC, so AU
   users see "today" tick over at ~11am local time. Since T1/T2 are
   **day-grain only** (decided — no sub-day offsets), this is the
   only timezone effect, same as `_due` / `_overdue`. Per-user
   timezone awareness is only needed if sub-day offsets are ever
   added; not now.

3. **E2E coverage for time-emitters** — A1–A5 shipped with unit +
   integration coverage but no Playwright e2e (no automations e2e
   harness today, and the cron route isn't a user-driven UI
   surface). A follow-up PR will add a shared automations e2e spec;
   first non-trivial candidate is T1 because it intersects the
   builder's per-config-form UX.

4. **Cron frequency** — Vercel Hobby caps the cron schedule at once
   per day. `vercel.json` is `0 1 * * *` (1 am UTC daily). Fine for
   every day-bucketed trigger (A1–A5). **Decision (2026-06-14):
   T1/T2 stay day-grain only** (offsets in days), so the daily cron
   is sufficient and we are **not** upgrading to Vercel Pro yet.
   Sub-day offsets / "within the hour" reminders are deferred until
   there's a concrete reason to pay for Pro.

## A1 lessons (recorded for future items)

End-to-end manual testing of A1 on the cloud dev project surfaced
**seven pre-existing bugs** the local integration suite hadn't
caught — none in A1 itself, all in the surrounding builder, runtime,
and migration history. Worth being aware of before A2:

1. **`/api/email/send-quote` gated the `draft → sent` status flip
   on `share_token_enabled` being false.** A later migration
   defaulted that flag to `true` on insert, silently killing the
   transition. Fixed in this PR.
2. **Trigger picker wrote `triggerConfig: {}`** instead of seeding
   the Zod-schema defaults — every trigger with a `.default()`
   field was skipped by the emitters and dispatcher. Picker,
   emitter, and dispatcher all now defaults-parse via the spec
   schema. Fixed.
3. **Dispatcher coerced caught errors as the literal string
   `'unknown'`.** Supabase JS errors aren't `Error` instances, so
   PGRST / RLS / constraint failures lost their diagnostic info
   inside the try/catch. Fixed with a `describeError` helper.
4. **Inspector `ActionFields` read `actionType` from
   `config['type']`** which is always undefined — the action's
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
7. **Cloud ledger drift** — `supabase db push` reported "up to
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
  `spec.configSchema.safeParse(...)` — follow the pattern without
  inventing new defaulting logic.
- **Migration deploy hygiene:** never edit a shipped migration to
  rename a column. Add a rename migration instead. The §7.9 ledger
  rule was already documented; this PR adds idempotency guards on
  the foundation migration as belt-and-braces for any future
  drift incident.
