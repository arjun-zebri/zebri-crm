# Automations — Triggers & Actions Wiring Plan

**Status:** Active roadmap. Sibling doc to `automations.md` (which is
the canonical "how the system works"). This doc is **time-bounded**:
each item ticks off as it ships to `staging`, and the doc is retired
once the catalogue is fully wired.

**Created:** 2026-06-07
**Owner:** Arjun
**Working batch:** [feedback_staging_only_batch](../../../.claude/projects/-Users-arjunpunekar-Documents-zebri-zebri-crm/memory/feedback_staging_only_batch.md) applies — all PRs land on `staging`; no per-PR `main` promotion.

## Context

Automations Phase 14a shipped to `staging` (commit `ee7ef8c` —
"Automations: expand trigger + action catalogue (UI-only)"). The
**foundation is complete**: 6 tables with RLS, the
`emit_automation_event()` RPC, the per-minute tick (dispatcher +
runner), the React Flow builder UI, recipient + variable resolution,
quiet hours, approval gates, and the audit log are all live.

What's **not** wired yet falls into four buckets. We work through
them **one item at a time** (one trigger or one action per PR), in a
clear order, with each PR small enough to review, gate, and ship.

## Current gap

The catalogues below come from `lib/automations/triggers.ts`,
`lib/automations/trigger-constants.ts`, `lib/automations/actions/*`,
and the Phase 14a `comingSoon: true` flag.

### Bucket A — Time-based trigger emitters (11)

Registry entries exist; the tick body that computes "what's due"
does not. Each needs: a matcher (already there in registry), an
emitter SQL/JS predicate that runs each tick, and a row in the
audit-log narrative.

| #   | Trigger                               | What "fires" means                                                         | Source of truth             |
| --- | ------------------------------------- | -------------------------------------------------------------------------- | --------------------------- |
| A1  | `quote_due`                           | Quote `expires_at` lands `config.days` from today, status still `sent`     | `quotes.expires_at`         |
| A2  | `quote_overdue`                       | `now() > expires_at + 1d`, status still `sent`                             | `quotes.expires_at`         |
| A3  | `invoice_due`                         | Invoice `due_date` reached, balance > 0                                    | `invoices`                  |
| A4  | `invoice_overdue`                     | `now() > due_date + 1d`, balance > 0                                       | `invoices`                  |
| A5  | `task_overdue`                        | `now() > tasks.due_at`, not completed                                      | `tasks`                     |
| A6  | `lead_inactive`                       | No couple/touchpoint activity in N days, status still `lead`               | `couples` + activity log    |
| A7  | `portal_section_started_not_finished` | Section started > N days ago, not complete                                 | `portal_section_progress`   |
| A8  | `time_before_event`                   | `now() = events.event_at - offset` (per-automation config)                 | `events.event_at`           |
| A9  | `time_after_event`                    | `now() = events.event_at + offset`                                         | `events.event_at`           |
| A10 | `anniversary_of_event`                | `to_char(now(), 'MM-DD') = to_char(event_at, 'MM-DD')`                     | `events.event_at`           |
| A11 | `specific_date_reached`               | `now() >= config.date`                                                     | per-automation config       |

### Bucket B — Stripe payment events (2)

| #   | Event              | Where it must be emitted                                                                                            |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| B1  | `payment_received` | `app/api/webhooks/stripe/route.ts` (or wherever Connect payment success lives) — call `emit_automation_event()`     |
| B2  | `payment_failed`   | Same webhook, on `payment_intent.payment_failed` branch                                                             |

### Bucket C — Extended action handlers (~40, comingSoon: true)

Grouped by domain so we can sequence by value, not file count:

- **C1. AU paperwork (HIGH)** — NOIM PDF, DONLIM PDF, marriage cert
  PDF, send NOIM to BDM, archive paperwork.
- **C2. Consultations (HIGH)** — create_consultation, cancel,
  reschedule, send slots, send reminder.
- **C3. Tags & segmentation (MED)** — add_tag, remove_tag,
  add_to_segment, remove_from_segment.
- **C4. Payment ops (MED)** — generate payment link, apply discount,
  apply credit, send refund.
- **C5. Drip campaigns (MED)** — enroll_in_drip, exit_drip,
  schedule_drip. (Largely duplicates `wait` + `send_email` — confirm
  whether we keep the abstraction or fold into existing primitives.)
- **C6. Calendar slots (LOW)** — publish_slot, unpublish_slot,
  block_slot.
- **C7. Misc external (LOW)** — Zapier webhook out, push
  notification, label printing.

### Bucket D — Phase 14b (out of scope here)

SMS / WhatsApp / IG, inbound email parsing, AI helpers. These are
**not wiring** — they are net-new third-party integrations and will
get their own brainstorm + spec.

## Ordering: one PR per row

The order is **risk × value**. Time-based triggers first because
they unlock proactive automations (the "set and forget" half of the
product) and they establish the tick-emitter pattern the rest of the
backlog leans on. Stripe second — bounded, money flow. Extended
actions third — by domain priority.

| Status | ID  | Item                                          | Notes                                                  |
| :----: | --- | --------------------------------------------- | ------------------------------------------------------ |
|   ☑    | A1  | `quote_due`                                   | Shipped with framework — `lib/automations/time-emitters/{index,quote-due}.ts` |
|   ☐    | A2  | `quote_overdue`                               |                                                        |
|   ☐    | A3  | `invoice_due`                                 |                                                        |
|   ☐    | A4  | `invoice_overdue`                             |                                                        |
|   ☐    | A5  | `task_overdue`                                |                                                        |
|   ☐    | A6  | `lead_inactive`                               | Open question — see below                              |
|   ☐    | A7  | `portal_section_started_not_finished`         | Open question — see below                              |
|   ☐    | A8  | `time_before_event`                           | Hour-granularity bucket                                |
|   ☐    | A9  | `time_after_event`                            |                                                        |
|   ☐    | A10 | `anniversary_of_event`                        |                                                        |
|   ☐    | A11 | `specific_date_reached`                       |                                                        |
|   ☐    | B1  | `payment_received`                            | Stripe webhook                                         |
|   ☐    | B2  | `payment_failed`                              | Stripe webhook                                         |
|   ☐    | C1  | AU paperwork (5 actions, may sub-slice)       |                                                        |
|   ☐    | C2  | Consultations (5 actions)                     |                                                        |
|   ☐    | C3  | Tags & segmentation (4 actions)               |                                                        |
|   ☐    | C4  | Payment ops (4 actions)                       |                                                        |
|   ☐    | C5  | Drip campaigns (3 actions)                    | Review necessity first                                 |
|   ☐    | C6  | Calendar slots (3 actions)                    |                                                        |
|   ☐    | C7  | Misc external (3 actions)                     |                                                        |

C-bucket rows are themselves multiple PRs (one per action), grouped
only here for planning.

## The per-item recipe (every PR)

Every wiring PR — trigger or action — must satisfy this checklist.
This **is** the per-page DoD (`production-readiness.md` §5)
translated to a per-feature DoD for automations.

### For a time-based trigger (Bucket A)

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
4. **Unit test** — `tests/unit/automations/time-emitters/<trigger>.test.ts`
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

### For an extended action (Bucket C)

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
  - Registry pattern matching `actions/index.ts` so adding A2…A11
    is "implement the emitter, add to the registry."
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

A2–A11 each follow the framework. Per-PR work shrinks to: write a
single `lib/automations/time-emitters/<trigger>.ts` file, register
it, write three tests, add a doc row. Estimated 1 PR / 1–2 hrs each
after A1.

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

1. **C5 drip campaigns** — do we keep this as a first-class action
   set, or fold into existing `wait` + `send_email` + `sub_flow`?
   Worth a 30-minute review during the B-bucket phase.
2. **A6 `lead_inactive`** — what defines "activity"? Couple-row
   update? Touchpoint log? We don't have a unified activity feed
   today. Likely needs a new `couple_activity` view or column.
   Flag before A6 starts.
3. **A7 portal section "started"** — does
   `portal_section_progress` already track `started_at`? Check
   schema before the PR.
4. **Idempotency bucket granularity** — day-granularity works for
   `_due` / `_overdue`, but `time_before_event.offset` could be
   hour-level. Decide bucket key during framework design in A1.
   **Resolved (A1):** day-grain bucket (UTC) is the default; per-day
   dedupe queries `automation_events` directly using `created_at` ≥
   `date_trunc('day', now())` and the matching `payload` field that
   identifies the bucket (e.g. `payload.days_until_due` for
   `quote_due`). Hour-grain emitters will swap in their own bucket
   key in their event payload when needed.

5. **Timezone for time-emitters (raised in A1)** — day boundaries
   are currently UTC, which means AU users see "today" tick over at
   ~11am local time. Acceptable for `_due` / `_overdue` style
   messaging, but `time_before_event` with sub-day offsets will need
   per-user timezone awareness (read from the couple/MC snapshot).
   Flag before A8 starts.

6. **E2E coverage for time-emitters** — A1 ships with unit +
   integration coverage but no Playwright e2e (there is no
   automations e2e harness today, and the cron route isn't a
   user-driven UI surface). A follow-up PR will add a shared
   automations e2e spec that's easy for A2–A11 to extend; first
   non-trivial e2e candidate is A8 because it intersects with the
   builder's per-config-form UX.
