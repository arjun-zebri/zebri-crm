# Zebri Scheduler Phase D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the booking lifecycle: a booker can reschedule or cancel from a link in their confirmation email, both sides get emailed and the MC's calendar event follows, a daily cron sends 24-hour reminders, and past bookings roll to `completed` while `consultation_completed` and a new `booking_cancelled` reach the automations bus.

**Architecture:** The manage page follows the contract e-sign precedent exactly: a public capability-token page whose mutations go through rate-limited API routes wrapping SECURITY DEFINER RPCs (`cancel_booking`, `reschedule_booking`), with a derived state machine (active / cancelled / past). Reminders get their own cron mirroring `send-contract-reminders` (candidate RPC + `reminder_sent_at` marker), NOT the automations event bus, because a reminder is a product email rather than a user-configured automation. `consultation_completed` DOES belong on the bus and ships as a time emitter in the existing tick registry, where the status flip to `completed` is its own idempotency guard.

**Tech Stack:** Next.js 16 App Router, Supabase SECURITY DEFINER RPCs, Vercel cron + `isCronAuthorized`, Google Calendar / Microsoft Graph event update+delete, Resend/OAuth email.

**Spec:** `docs/superpowers/specs/2026-08-18-scheduler-design.md`

**Scope notes:**
- Phase E (calendar-view rebuild) is out of scope. Nothing here touches `couples-calendar.tsx`.
- `consultation_no_show` exists in the trigger union but stays unemitted; no UI for outcomes ships here.
- Hour-granularity reminders stay deferred (daily cron), exactly as the spec says.

## Global Constraints

- **Never run `git commit` or `git push`. The user commits.** Work on `feature/scheduler-phase-d`, branched from `feature/scheduler-phase-c` (A, B and C are all uncommitted in this same tree; base commit is `d876174`).
- No em dashes anywhere, in code, comments, copy or docs.
- TSDoc on every export; why-comments on non-obvious logic.
- **`'use server'` files and route files export ONLY async functions** (plus Next.js route config). Zod schemas shared with tests live in plain sibling modules. `npm run check:server-action-exports` must pass.
- Gates: `npm run typecheck` 0; `npm run typecheck:strict:gate` budget 262; `npm run lint:gate` budget 54 errors / **110** warnings (ratcheted down in Phase C); `npm run check:no-service-role`; `npm run check:public-styling` currently FAILS on three out-of-scope files (`lib/branding/public-blocks/footer.tsx`, `hint-bubble.tsx`, and the user's untracked `app/portal/[token]/package-selector.tsx`). Do not touch them; report the failure with that attribution.
- Components ≤ ~150 lines. Route and action files follow house norms (long is acceptable, cohesive is required).
- Public routes: `inMemoryLimiter` + `ipOf`, Zod validation, `recordInvalidTokenAttempt()` on bad tokens.
- Migrations non-destructive; local `supabase migration up`; after any `db reset` run the grant-repair SQL; regenerate `types/database.ts` after schema changes.
- Quote parenthesised paths in shell commands (a prior agent created a stray `app/\(dashboard\)` directory by escaping them).

---

### Task 1: Branch + lifecycle migration (reminder column + three RPCs) + integration tests

**Files:**
- Create: `supabase/migrations/20260821000000_booking_lifecycle.sql`
- Create: `tests/integration/booking/booking-lifecycle.test.ts`
- Modify: `types/database.ts` (regenerated)

**Interfaces:**
- Consumes: `bookings`, `meeting_types` (Phase C), `emit_automation_event` (automations foundation), `_user_branding(uuid)`.
- Produces (Tasks 5-9 consume these):
  - column `bookings.reminder_sent_at timestamptz`
  - `get_booking_by_manage_token(token uuid) returns jsonb` (null when unknown): `{booking_id, status, starts_at, ends_at, timezone, name, email, video_join_url, business_name, meeting_type: {id, name, description, duration_minutes, location_type, address}, share_token}` merged with `_user_branding(user_id)`. **Never returns `user_id` or the MC's email.**
  - `cancel_booking(p_manage_token uuid) returns jsonb`: `{ok:true, booking_id, user_id, starts_at, ends_at, timezone, name, email, business_name, external_event_ids, meeting_type_name}` or `{error:'not_found'|'already_cancelled'|'past'}`. Sets `status='cancelled'`, `cancelled_at=now()`, and emits `booking_cancelled` via `emit_automation_event`.
  - `reschedule_booking(p_manage_token uuid, p_starts_at timestamptz, p_ends_at timestamptz) returns jsonb`: `{ok:true, booking_id, user_id, previous_starts_at, starts_at, ends_at, timezone, name, email, business_name, external_event_ids, meeting_type_name}` or `{error:'not_found'|'cancelled'|'past'|'slot_taken'|'invalid'}`. Updates the row in place (exclusion constraint checks it against *other* confirmed rows only), clears `reminder_sent_at` so the new time gets its own reminder, and emits nothing (a reschedule is not a new booking; Phase E may revisit).
  - `bookings_due_for_reminder() returns setof jsonb`: confirmed bookings whose meeting type has `reminder_enabled`, `starts_at` between `now()` and `now() + interval '36 hours'`, `reminder_sent_at is null`. Each row: `{booking_id, user_id, name, email, starts_at, ends_at, timezone, video_join_url, business_name, meeting_type_name, location_type, address}`.
  - `mark_booking_reminder_sent(p_booking_id uuid) returns void` (sets `reminder_sent_at = now()`).
- Grants: `get_booking_by_manage_token`, `cancel_booking`, `reschedule_booking` to `anon` (capability-token gated). `bookings_due_for_reminder` and `mark_booking_reminder_sent` to `service_role` ONLY (cron uses the admin client; anon must never enumerate upcoming bookings).

- [ ] **Step 1: Create the branch**

Run: `git checkout -b feature/scheduler-phase-d`

- [ ] **Step 2: Write the failing integration tests**

Create `tests/integration/booking/booking-lifecycle.test.ts`, mirroring `tests/integration/booking/booking-rpcs.test.ts` (service client seeds a user + meeting type + availability + bookings; `anonClient()` calls the public RPCs). Cases:

- `get_booking_by_manage_token`: valid token returns the booking and meeting type; unknown token returns null; **the payload contains no `user_id` key and no MC email** (assert explicitly).
- `cancel_booking`: flips status to `cancelled` and sets `cancelled_at`; a second call returns `{error:'already_cancelled'}`; unknown token `{error:'not_found'}`; a booking whose `ends_at` is in the past returns `{error:'past'}`; **an `automation_events` row with `event_type='booking_cancelled'` exists afterwards** (service client) carrying the booking id.
- **Cancelling frees the slot**: after cancel, inserting a confirmed booking over the same range for the same user succeeds (proves the partial exclusion constraint releases cancelled rows).
- `reschedule_booking`: moves the row and returns `previous_starts_at`; sets `reminder_sent_at` back to null (seed it non-null first); rescheduling onto a range occupied by ANOTHER confirmed booking returns `{error:'slot_taken'}`; rescheduling a cancelled booking returns `{error:'cancelled'}`; `starts_at >= ends_at` returns `{error:'invalid'}`; a past target time returns `{error:'invalid'}`.
- **Reschedule onto its own current range succeeds** (the row must not conflict with itself).
- `bookings_due_for_reminder`: returns a confirmed booking 20 hours out with `reminder_enabled`; excludes one already marked (`reminder_sent_at` set), one 5 days out, one cancelled, and one whose meeting type has `reminder_enabled = false`. `mark_booking_reminder_sent` makes a due booking stop appearing.

- [ ] **Step 3: Run to verify failure**

Run: `npm run test:integration -- booking/booking-lifecycle`
Expected: FAIL, functions do not exist.

- [ ] **Step 4: Write the migration**

Create `supabase/migrations/20260821000000_booking_lifecycle.sql`. Model every function on the Phase C RPCs in `20260820001000_booking_rpcs.sql` (SECURITY DEFINER, `set search_path = public, auth`, jsonb returns, null-on-missing, `_user_branding` merge, explicit grants). Specifics:

```sql
alter table bookings add column if not exists reminder_sent_at timestamptz;
```

`cancel_booking` guards in order: row exists (else `not_found`), `status = 'cancelled'` (else `already_cancelled`), `ends_at <= now()` (else `past`), then update + `emit_automation_event(user_id, 'bookings', booking_id, 'booking_cancelled', jsonb_build_object('booking_id', ..., 'couple_id', ..., 'meeting_type_id', ..., 'booker_name', ..., 'booker_email', ..., 'starts_at', ..., 'ends_at', ..., 'timezone', ...), couple_id)`.

`reschedule_booking` guards: exists / not cancelled / not past / valid range (`p_starts_at < p_ends_at`, `p_starts_at > now()`, duration within 60 seconds of the meeting type's `duration_minutes`) then `update ... set starts_at, ends_at, reminder_sent_at = null, updated_at = now()` inside `begin ... exception when exclusion_violation then return '{"error":"slot_taken"}'::jsonb; end`.

Why-comments required on: the partial exclusion constraint releasing cancelled rows, the self-update not conflicting with itself, and clearing `reminder_sent_at`.

- [ ] **Step 5: Apply, regenerate types, verify**

Run: `supabase migration up`, then `npx supabase gen types typescript --local > types/database.ts`, then `npm run typecheck` (0).

- [ ] **Step 6: Run the tests**

Run: `npm run test:integration -- booking/booking-lifecycle`
Expected: PASS.

- [ ] **Step 7: Checkpoint** (list files, no commit).

---

### Task 2: `booking_cancelled` automation trigger

**Files:**
- Modify: `types/automations.ts` (add `'booking_cancelled'` to the `TriggerType` union)
- Modify: `lib/automations/triggers.ts` (spec + registry entry)
- Test: `tests/unit/lib/automations/booking-cancelled-trigger.test.ts` (or extend the existing triggers test file if one exists: search `tests/unit` for triggers coverage and prefer extending)

**Interfaces:**
- Consumes: `TriggerSpec`, the consultation spec idiom at `lib/automations/triggers.ts` (~line 1252) and the registry (~line 1662).
- Produces: trigger id `booking_cancelled`, category `consultation`, label "Booking cancelled", icon a Lucide name consistent with the neighbours (`CalendarX`), config schema `z.object({ withinDaysOfStart: z.number().int().min(1).max(365).optional() })` with a `match` that returns true when no config is set and otherwise compares the payload's `starts_at` to the event's `created_at`. Keep it minimal: the payload keys are fixed by Task 1.

- [ ] **Step 1:** Read the two consultation specs and the registry block in full before editing; mirror their structure exactly.
- [ ] **Step 2: Failing unit test:** the registry resolves `booking_cancelled`; `configSchema` accepts `{}` and `{withinDaysOfStart: 7}` and rejects `{withinDaysOfStart: 0}`; `match` returns true for an empty config; `match` respects `withinDaysOfStart` for a payload inside and outside the window.
- [ ] **Step 3:** Implement. **Step 4:** Tests pass, `npm run typecheck` 0 (the union change may surface exhaustive-switch errors elsewhere: fix them properly, do not cast).
- [ ] **Step 5: Checkpoint.**

---

### Task 3: Calendar event update + delete

**Files:**
- Modify: `lib/calendar/event-push.ts`
- Test: `tests/unit/lib/calendar/event-push.test.ts` (extend)

**Interfaces:**
- Consumes: existing module internals (`listActiveConnections`, `getFreshAccessToken`, `EventPushError`, `toNaiveUtc`, the provider-preference helper).
- Produces:
  - `async function updateBookingEvent(supabase, userId, externalEventIds: Record<string, string>, details: { summary: string; description: string; start: Date; end: Date }): Promise<void>` — PATCHes the stored event on whichever provider holds it. Google: `PATCH https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events/{eventId}?sendUpdates=all` with start/end. Microsoft: `PATCH https://graph.microsoft.com/v1.0/me/events/{eventId}` with naive-UTC start/end. Conference data and attendees are left untouched so the existing join link survives.
  - `async function deleteBookingEvent(supabase, userId, externalEventIds: Record<string, string>): Promise<void>` — Google `DELETE .../events/{eventId}?sendUpdates=all`; Microsoft `DELETE /me/events/{eventId}`. Treat 404/410 as success (already gone).
  - Both no-op when `externalEventIds` is empty or the matching connection is missing; both throw `EventPushError(provider, status)` on other non-2xx.

- [ ] **Step 1: Failing unit tests** (extend the existing file's fetch-mock harness): update PATCHes the right URL per provider and sends naive UTC for Microsoft; update leaves conferenceData out of the body; delete issues DELETE and swallows 404 and 410; both no-op on empty ids; non-2xx (500) throws `EventPushError` carrying provider + status.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** `npm run test:unit -- lib/calendar/event-push`, `npm run typecheck`, `npm run typecheck:strict:gate`. **Step 5: Checkpoint.**

---

### Task 4: Lifecycle emails (+ manage link on the confirmation)

**Files:**
- Modify: `lib/email/booking.ts`, `lib/email/html.ts`, `lib/email/index.ts`
- Modify: `app/api/booking/submit/route.ts` (pass the manage URL)
- Test: `tests/unit/lib/email/booking.test.ts` (extend)

**Interfaces:**
- Consumes: `resolveSender`, `dispatchEmail`, the Phase C templates and `escapeHtmlText`.
- Produces:
  - `sendBookingConfirmationEmail` gains a required `manageUrl: string` option; the template renders a "Need to change it? Reschedule or cancel" line linking to it. **This is the Phase C ruling being paid off**: the link only ships now that the page exists.
  - `sendBookingRescheduledEmail(supabase, opts)` — booker-facing, same shape as the confirmation plus `previousStart: Date`; renders the old time struck through or labelled "was", the new time, and the manage link.
  - `sendBookingCancelledEmail(supabase, opts)` — booker-facing confirmation that it is cancelled, with the meeting name and the cancelled time; no manage link.
  - `sendBookingChangeNotificationEmail(opts)` — the MC ops email for BOTH reschedule and cancel, taking `kind: 'rescheduled' | 'cancelled'`; mirrors `sendBookingNotificationEmail` (DEFAULT_FROM, replyTo booker, table layout), rendering times in the MC's timezone.
- All booker-controlled strings escaped, all times rendered in the relevant party's timezone, no em dashes in copy.

- [ ] **Step 1: Failing unit tests:** confirmation contains the manage URL; reschedule email shows both old and new times and the manage link; cancellation email has no manage link and states the cancelled time; MC notification differs by `kind` in subject and body; escaping still holds for a booker name containing `<script>`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement, updating the submit route to build `${NEXT_PUBLIC_APP_URL}/book/manage/${manage_token}` from the RPC's `manage_token`. **Step 4:** `npm run test:unit -- lib/email/booking && npm run test:unit -- app/api/booking-submit && npm run typecheck`. **Step 5: Checkpoint.**

---

### Task 5: Slot listing for a reschedule (self-exclusion)

**Files:**
- Modify: `lib/booking/availability.ts`
- Modify: `app/api/booking/slots/route.ts`, `app/api/booking/slots-schema.ts`
- Test: `tests/unit/lib/booking/availability.test.ts` (extend), `tests/unit/app/api/booking-slots.test.ts` (extend)

**Interfaces:**
- Produces:
  - `loadBookingContextByManageToken(supabase, manageToken): Promise<{ ctx: BookingContext; bookingId: string; startsAt: string; endsAt: string; status: string } | null>` — resolves the booking, then builds the same `BookingContext` the share-token path builds (refactor the existing loader so both paths share one internal that takes a resolved meeting-type row; do not duplicate the rules/overrides/timezone queries).
  - `getBookableSlots` and `isSlotBookable` gain an optional `excludeBookingId?: string` in their options, filtered out of the confirmed-bookings busy set.
  - The slots route accepts EITHER `token` (share token, unchanged) OR `manageToken`; exactly one is required. With `manageToken` it derives the context from the booking and passes `excludeBookingId` so **the booker's own current slot is offered rather than shown as busy**. The share token is never returned to the client.

- [ ] **Step 1: Failing tests.** Unit: with `excludeBookingId`, the excluded booking's window is bookable while another confirmed booking's window is not; `loadBookingContextByManageToken` returns null for an unknown token and carries the booking's own times. Schema: exactly one of `token`/`manageToken` required (both present rejected, neither rejected).
- [ ] **Step 2:** FAIL. **Step 3:** Implement (route stays ≤ house norms; keep the 31-day cap, the rate limit, and both fail-closed error mappings unchanged). **Step 4:** `npm run test:unit -- lib/booking && npm run test:unit -- app/api/booking-slots && npm run typecheck && npm run typecheck:strict:gate && npm run check:server-action-exports`. **Step 5: Checkpoint.**

---

### Task 6: Cancel + reschedule API routes

**Files:**
- Create: `app/api/booking/cancel/route.ts`, `app/api/booking/cancel-schema.ts`
- Create: `app/api/booking/reschedule/route.ts`, `app/api/booking/reschedule-schema.ts`
- Test: `tests/unit/app/api/booking-manage.test.ts` (schemas)

**Interfaces:**
- Consumes: Task 1 RPCs, Task 3 event update/delete, Task 4 emails, Task 5 context loader, `createAdminClient`, rate limiting, `recordInvalidTokenAttempt`, `sendAlert`.
- Produces:
  - `POST /api/booking/cancel` body `{ manageToken }`. Flow: rate limit 5/min/IP, Zod, `cancel_booking` RPC, map `not_found` 404 (+ record attempt) / `already_cancelled` 409 / `past` 409, then `deleteBookingEvent` (failure alerts `booking_event_push_failed`, never fails the request), then booker cancellation email + MC notification (`kind:'cancelled'`), then 200 `{ ok: true }`.
  - `POST /api/booking/reschedule` body `{ manageToken, startsAt (ISO), timezone }`. Flow: rate limit 5/min/IP, Zod (timezone validated against `Intl.supportedValuesOf('timeZone')`), `loadBookingContextByManageToken` (404 + record attempt when null), compute `end` from the meeting type duration, `isSlotBookable(..., { excludeBookingId })` re-verification (409 `slot_taken` when false; 503 on `FreeBusyUnavailableError` or `BookingsUnavailableError`), `reschedule_booking` RPC with the same error mapping plus `cancelled`/`past` 409, then `updateBookingEvent` (alert on failure, non-blocking), then booker reschedule email + MC notification (`kind:'rescheduled'`), then 200 `{ ok: true, start, end, timezone }`.
- Both route files export only their async POST; schemas live in the plain sibling modules.

- [ ] **Step 1: Failing schema tests** (valid bodies; bad uuid; bad timezone; non-ISO `startsAt`). **Step 2:** FAIL. **Step 3:** Implement, mirroring `app/api/booking/submit/route.ts` structure. **Step 4:** `npm run test:unit -- app/api/booking-manage && npm run typecheck && npm run check:server-action-exports && npm run check:no-service-role`. **Step 5: Checkpoint.**

---

### Task 7: Manage page (`/book/manage/[manage_token]`)

**Files:**
- Create: `app/book/manage/[manage_token]/page.tsx` (orchestrator, ≤150 lines)
- Create: `app/book/manage/[manage_token]/use-manage-booking.ts`, `manage-views.tsx`
- Modify: `middleware.ts` only if `/book` does not already cover this path (it should: verify and say so in the report)
- Test: `tests/unit/app/book/manage-booking.test.tsx`

**Interfaces:**
- Consumes: `get_booking_by_manage_token` via the anon browser client (mirror the `/book/[token]` page's RPC + branding idiom), `/api/booking/slots?manageToken=`, the cancel and reschedule routes, and the existing `BookingSlotPicker` component (reuse it, do not fork it).
- Produces a state machine: `loading -> active | cancelledAlready | past | notFound | error`, and from `active`: `confirmCancel -> cancelled`, or `pickNewTime -> rescheduling -> rescheduled`. Renders the booking summary (meeting name, current time in the booking's stored timezone, join link when present), a "Reschedule" button, and a "Cancel booking" button behind a confirmation step. Slot-taken on reschedule returns to the picker with the same notice idiom as `/book`.
- Branding scalars applied exactly as on `/book`; `npm run check:public-styling` must stay clean for `app/book/**`.

- [ ] **Step 1: Failing tests** (mock the supabase client as a SINGLETON: a non-singleton mock caused infinite re-renders in Phase C; mock fetch): active booking renders its time and both actions; cancel flow posts to `/api/booking/cancel` and shows the cancelled state; reschedule picks a slot, posts to `/api/booking/reschedule`, shows the rescheduled state; a 409 on reschedule returns to the picker with the notice; an already-cancelled booking renders the cancelled state with no actions.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** `npm run test:unit -- app/book && npm run typecheck && npm run lint:gate && npm run check:public-styling`. **Step 5: Checkpoint.**

---

### Task 8: Reminder cron

**Files:**
- Create: `app/api/cron/booking-reminders/route.ts`
- Modify: `vercel.json` (add `{ "path": "/api/cron/booking-reminders", "schedule": "30 22 * * *" }`)
- Modify: `lib/email/booking.ts`, `lib/email/html.ts` (the reminder template + sender)
- Test: `tests/unit/lib/email/booking.test.ts` (extend for the reminder email)

**Interfaces:**
- Consumes: `isCronAuthorized`, `createAdminClient`, `resolveSender`, Task 1's `bookings_due_for_reminder` + `mark_booking_reminder_sent`, `sendAlert`.
- Produces: `sendBookingReminderEmail(supabase, opts)` (booker-facing, "your meeting is tomorrow", time in the booker's timezone, join link or location line, manage link) and the cron route, which mirrors `app/api/email/send-contract-reminders/route.ts`: unauthorized 401, loop candidates, send, mark sent only on `ok`, return `{ ok: true, sent, failed }`, and `sendAlert` on a failure batch.
- The 36-hour window plus the `reminder_sent_at` marker means a daily run reminds each booking exactly once; write that reasoning as a why-comment in the route.

- [ ] **Step 1: Failing test** for the reminder email content (tomorrow phrasing, booker timezone, manage link, join link when present). **Step 2:** FAIL. **Step 3:** Implement route + email + vercel entry. **Step 4:** `npm run test:unit -- lib/email/booking && npm run typecheck && npm run check:server-action-exports`. **Step 5: Checkpoint** (note in the report that the cron cannot be exercised locally).

---

### Task 9: `consultation_completed` emitter + docs + gates

**Files:**
- Create: `lib/automations/time-emitters/consultation-completed.ts`
- Modify: `lib/automations/time-emitters/index.ts` (registry)
- Test: `tests/unit/lib/automations/consultation-completed-emitter.test.ts`
- Modify docs: `.claude/docs/database-schema.md`, `page-specs.md`, `security.md`, `alerts.md` (if new alert types were added), `automations.md`, `testing.md`, `cicd.md` (the new cron entry), `production-readiness.md`
- Optionally extend: `tests/e2e/booking.spec.ts` (manage flow), only if it can be written honestly against real selectors

**Interfaces:**
- Consumes: the `TimeEmitter` interface and the dedup idiom in `lib/automations/time-emitters/` (read `time-before-event.ts` and `invoice-due.ts` first).
- Produces: an emitter that selects `confirmed` bookings with `ends_at < now()`, flips them to `completed`, and emits `consultation_completed` with the booking payload. **The status flip is the idempotency guard**: a completed row is never selected again, so no date-bucket dedup is needed. Say that in a why-comment.

- [ ] **Step 1: Failing unit test** (mock supabase): a past confirmed booking is flipped and emitted; a future one is untouched; an already-completed one is not re-emitted; a cancelled one is ignored; an emit failure does not abort the remaining rows.
- [ ] **Step 2:** FAIL. **Step 3:** Implement + register.
- [ ] **Step 4: Docs**, mirroring each file's existing style; document only what shipped (no `consultation_no_show`, no outcomes UI).
- [ ] **Step 5: Full gates:** `npm run typecheck && npm run typecheck:strict:gate && npm run lint:gate && npm run check:server-action-exports && npm run check:no-service-role && npm run check:public-styling ; npm run test:unit && npm run test:integration`. Ratchet budgets DOWN only if they legitimately dropped. Report the attributed `check:public-styling` failure verbatim.
- [ ] **Step 6: Final checkpoint:** every file changed this phase, prod prerequisites unchanged, and the fact that the e2e and cron paths were not executed locally.
