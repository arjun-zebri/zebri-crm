# Zebri Scheduler Phase E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the MC's own calendar tell the truth about their time: a real hour grid for Day and Week showing bookings at their actual times, availability hours shaded behind them and external busy blocks drawn in, a booking detail panel with cancel and reschedule, a Bookings list tab, and the 1,132-line calendar monolith split into readable components.

**Architecture:** The split happens first so every later task edits small files. A new pure `lib/calendar/grid-layout.ts` owns all pixel and overlap math (no React, unit tested), and Day and Week compose the same primitives. Owner-scoped reads come from a `useBookings` hook plus a new authenticated busy-intervals route. The cancel and reschedule orchestration that Phase D put inline in the public routes is extracted into one shared server module so the dashboard and the booker's manage link cannot drift apart.

**Tech Stack:** Next.js 16 App Router, react-query, Supabase with RLS, the existing `SidePanel` primitive, pure TypeScript for layout math.

**Spec:** `docs/superpowers/specs/2026-08-18-scheduler-design.md` section 8.

**Spec correction that governs this phase:** section 8 assumed the Calendar tab already had a day/week/month *grid* to add overlays to. It does not. Every current view is date-bucketed, wedding events carry a date with no time, and there is no hour grid anywhere in `couples-calendar.tsx`. Building that grid is therefore part of Phase E, and it is the largest piece of work here. Month stays date-bucketed by design.

## Global Constraints

- **Never run `git commit` or `git push`. The user commits.** Work on `feature/scheduler-phase-e`, branched from `feature/scheduler-phase-d`. Phases A through D are all uncommitted in this same tree; the review baseline commit is `d876174`.
- No em dashes anywhere, in code, comments, copy or docs. This has been the most repeated review finding across four phases: check your own diff with `git diff d876174 -- <your files> | grep '^+' | grep '—'` before reporting.
- TSDoc on every export; why-comments on non-obvious logic.
- Components at most about 150 lines. Route, action and pure-lib files follow house norms, but the whole point of Task 1 is that nothing in this directory stays a monolith.
- `'use server'` files and route files export ONLY async functions; schemas live in plain sibling modules (`npm run check:server-action-exports`).
- Gates: `npm run typecheck` 0; `npm run typecheck:strict:gate` budget 262 (test files count toward it, so guard indexed access with `!`); `npm run check:no-service-role`; `npm run check:public-styling`.
- **Two gates are known-red and are NOT yours to fix**: `lint:gate` (111/110) and `check:public-styling` both fail solely on the user's untracked parallel work (`couple-modal.tsx`, `couples/actions.ts`, `portal/[token]/*`, `branding-editor.tsx`, `invoice-builder-modal.tsx`, `lib/automations/actions/messaging.ts`, `app/portal/[token]/package-selector.tsx`) plus two pre-existing branding files. Never edit those files, never raise a budget, and report the failure with that attribution. If your own files add a warning, that IS yours: run the per-file attribution before claiming otherwise.
- Design system: tokens and primitives only, Lucide at `strokeWidth={1.5}`, `<Button loading>` never label-swaps, non-button clickables need `cursor-pointer`.
- Quote parenthesised paths in shell commands.

---

### Task 1: Split `couples-calendar.tsx` (pure refactor, no behaviour change)

**Files:**
- Modify: `app/(dashboard)/calendar/_components/couples-calendar.tsx` (becomes the composing shell)
- Create: `_components/calendar-month-view.tsx`, `calendar-week-view.tsx`, `calendar-day-view.tsx`, `calendar-sidebar.tsx`, `calendar-header.tsx`, `calendar-skeleton.tsx`, `calendar-utils.ts`
- Test: `tests/unit/app/calendar/couples-calendar.test.tsx`

**Interfaces produced:** each view exported with explicit props (`events`/`eventsByDate`, `currentDate`, `onSelectCouple`, `isMobile` as needed); `calendar-utils.ts` exports `getMonthDays`, `getWeekStart`, `getWeekDays`, `formatDateKey`, `formatEventLabel`. Later tasks add grid props to Day and Week.

This is a refactor, not a redesign. The rendered output must be identical.

- [ ] **Step 1:** `git checkout -b feature/scheduler-phase-e`
- [ ] **Step 2: Characterisation test first.** Write `tests/unit/app/calendar/couples-calendar.test.tsx` against the CURRENT component before touching it: mock the supabase client as a SINGLETON (a per-call mock caused infinite re-renders in Phase C and cost several rounds) and mock `useCouples`; assert month view renders a seeded event's label in the right day cell, switching to week and day renders it too, and clicking an event calls `onSelectCouple` with the couple id. Run it green against the unsplit file. This is your regression net.
- [ ] **Step 3: Split**, following the seams: MonthView (~100 lines), WeekView (~100), DayView (~105), sidebar with the mini month navigator and status filters and day timeline (~160, split further if it will not fit), header (~60), skeleton (~100), helpers into `calendar-utils.ts`. `formatDateKey` is currently duplicated in two places: keep exactly one. Thread `eventsByDate` and callbacks as explicit props; do not introduce a context for this.
- [ ] **Step 4:** The characterisation test must still pass UNCHANGED. If you had to edit the test to make it pass, you changed behaviour: revert and fix the split instead.
- [ ] **Step 5:** `npm run typecheck`, `npm run typecheck:strict:gate`, `npx eslint` on changed files, and `wc -l` every new file. **Step 6: Checkpoint** (list files, no commit).

---

### Task 2: Grid layout engine (`lib/calendar/grid-layout.ts`)

**Files:** Create `lib/calendar/grid-layout.ts`; test `tests/unit/lib/calendar/grid-layout.test.ts`

**Interfaces produced** (Tasks 6 and 7 consume these; pure functions, no React, no DOM):
- `interface GridConfig { startHour: number; endHour: number; pxPerMinute: number }`
- `function minutesFromGridStart(instant: Date, dayStart: Date): number`
- `function bandGeometry(interval: {start: string; end: string}, dayStart: Date, cfg: GridConfig): { topPx: number; heightPx: number } | null` returning null when the interval falls entirely outside the visible window, and CLAMPING when it straddles an edge (a booking running past `endHour` must render to the bottom, not overflow).
- `function layoutOverlaps<T extends {start: string; end: string}>(items: T[]): Array<{ item: T; col: number; totalCols: number }>` grouping genuinely overlapping items into columns. Read `computeColumns` in `components/events/event-day-calendar.tsx` and reuse the ALGORITHM, not the component; that file is coupled to dnd-kit.
- `function mergeAvailabilityBands(...)` if the availability windows need coalescing before drawing; only add it if Task 6 genuinely needs it.

- [ ] **Step 1: Failing unit tests first.** Derive every expected pixel value by hand in a comment: an interval inside the window; one straddling the top edge (clamped); one straddling the bottom; one entirely outside (null); a minimum-height case so a 15-minute booking stays readable; two overlapping items each getting `col` 0 and 1 with `totalCols` 2; three items where only two overlap; back-to-back items (touching, not overlapping) each getting a full-width column.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** Tests pass, typecheck 0, strict 262. **Step 5: Checkpoint.**

---

### Task 3: Owner-scoped bookings and busy intervals

**Files:** Create `app/(dashboard)/calendar/use-bookings.ts`, `app/api/calendar/busy/route.ts`, `app/api/calendar/busy-schema.ts`; test `tests/unit/app/api/calendar-busy.test.ts`

**Interfaces produced:**
- `useBookings()` and `useBookingsInRange(from: Date, to: Date)` modelled exactly on `useInvoices` in `app/(dashboard)/payments/use-payments-data.ts` (react-query, `createClient()`, `.eq('user_id', user.id)`, RLS does the real scoping). Select the booking columns plus `couple:couple_id(id, name)` and `meeting_type:meeting_type_id(id, name, location_type)`. Query key `['bookings', ...]`.
- `GET /api/calendar/busy?from=<ISO date>&to=<ISO date>` for the SIGNED-IN MC: session auth via the server supabase client (401 when absent), Zod-validated range capped at 31 days, returns `{ busy: BusyInterval[] }` from `getBusyIntervals`.

**Failure posture, and this is a deliberate inversion of the public surfaces:** when free/busy is unavailable the public booking flow fails CLOSED, because offering a slot we cannot verify risks a double booking. Here the MC is only looking at their own calendar, so this route fails SOFT: catch `FreeBusyUnavailableError` and return `200 { busy: [], unavailable: true }` so the grid still renders with a quiet notice instead of an error page. Write that reasoning as a why-comment; a future reader will otherwise assume it is an inconsistency.

- [ ] **Step 1:** Failing schema tests (valid range, inverted range rejected, over-31-days rejected) plus a hook shape test if the codebase tests hooks elsewhere; otherwise state that the hook is covered by Task 6's view tests.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** `npm run test:unit -- calendar-busy`, typecheck, strict, `check:server-action-exports`, `check:no-service-role`. **Step 5: Checkpoint.**

---

### Task 4: Extract the booking lifecycle orchestration

**Files:** Create `lib/booking/lifecycle.ts`; modify `app/api/booking/cancel/route.ts` and `app/api/booking/reschedule/route.ts`; test `tests/unit/lib/booking/lifecycle.test.ts`

**Why:** Phase D put the post-RPC orchestration (calendar event delete or update, booker email, MC notification, alerting) inline in the two public routes. Task 5 needs the identical behaviour from the dashboard. Duplicating it guarantees the two paths drift, so extract once and have both call it.

**Interfaces produced:**
- `async function completeCancellation(admin, result: CancelRpcResult): Promise<void>` performing: `deleteBookingEvent` (an `EventPushError` alerts `booking_event_push_failed` and never throws on), booker cancellation email, MC notification with `kind: 'cancelled'`, fetching the MC address server-side.
- `async function completeReschedule(admin, result: RescheduleRpcResult): Promise<void>` doing the same with `updateBookingEvent`, the reschedule email carrying `previousStart`, and `kind: 'rescheduled'`.
- Both are best-effort by contract: they never throw, because the database mutation has already succeeded and the caller must not report failure to a user whose booking really was cancelled.

- [ ] **Step 1: Failing tests** (mock event-push and the email senders): cancellation calls delete then both emails; an `EventPushError` still sends both emails and raises the alert; a failing email does not prevent the other; reschedule passes `previousStart` through.
- [ ] **Step 2:** FAIL. **Step 3:** Implement, then refactor BOTH public routes to call it. Their observable behaviour must not change: same status codes, same ordering, same alerts. **Step 4:** `npm run test:unit -- lib/booking`, `npm run test:unit -- app/api/booking-manage`, typecheck, strict. **Step 5: Checkpoint.**

---

### Task 5: MC cancel and reschedule server actions

**Files:** Create `app/(dashboard)/calendar/booking-actions.ts`; test `tests/unit/app/calendar/booking-actions.test.ts`

**Interfaces produced:** `cancelBookingAction(bookingId: string)` and `rescheduleBookingAction(bookingId: string, startsAt: string, timezone: string)`, each returning the house tagged result `{ ok: true, data } | { ok: false, error }`.

**How ownership works, and this is the design decision to follow rather than improvise:** the action reads the booking through the RLS-scoped server client by `id`. RLS proves ownership: a booking belonging to another MC simply is not found. Having established ownership, the action reads that row's `manage_token` and calls the SAME `cancel_booking` / `reschedule_booking` RPC the public route uses, then hands off to Task 4's orchestration. This deliberately avoids writing owner-scoped duplicates of those RPCs: every guard, the exclusion-constraint catch, the `booking_cancelled` emission and the `reminder_sent_at` clearing then exist exactly once. The capability token never leaves the server. Write that as a why-comment.

Reschedule must re-verify the new slot exactly as the public route does, including `excludeBookingId` so the MC can move a booking to a time adjacent to its current slot.

- [ ] **Step 1: Failing tests:** ownership (a booking id the RLS client cannot see yields a not-found error, never a leak of its existence); cancel calls the RPC then the orchestration; reschedule re-verifies before the RPC and maps `slot_taken`; unauthenticated calls fail.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** tests, typecheck, strict, `check:server-action-exports` (the schemas belong in a sibling module if you add any), `check:no-service-role`. **Step 5: Checkpoint.**

---

### Task 6: Day view hour grid

**Files:** Modify `_components/calendar-day-view.tsx`; create `_components/grid-hour-column.tsx`, `grid-availability-bands.tsx`, `grid-booking-chip.tsx`, `grid-all-day-band.tsx`; test `tests/unit/app/calendar/day-grid.test.tsx`

Compose Task 2's math with Task 3's data:
- An hour rail from the MC's earliest availability hour minus one to their latest plus one, defaulting to 07:00-21:00 when they have no rules yet, so the grid is never a wall of empty night hours. Clamp to 00:00-24:00.
- Availability windows for that weekday, minus overrides, drawn as shaded background bands.
- External busy intervals drawn above the shading and below bookings, visually distinct (the MC must be able to tell "blocked by my Google calendar" from "booked through Zebri").
- Confirmed bookings as chips positioned by `starts_at`/`ends_at`, laid out with `layoutOverlaps`, showing the booker name and meeting type. Cancelled bookings are not drawn.
- Wedding events, which have no time, in an all-day band pinned above the grid. Clicking one still opens the couple profile exactly as today.
- Clicking a booking chip calls `onSelectBooking(booking)`, which Task 8 wires to the detail panel.
- The MC's own timezone governs the grid; bookings store the booker's timezone and must be converted, not displayed raw.

- [ ] **Step 1: Failing tests:** a booking at 10:00-10:30 renders at the expected offset; an availability band covers the right rows; a busy interval renders distinctly from a booking; a wedding event appears in the all-day band and not in the grid; a cancelled booking is absent; clicking a chip fires `onSelectBooking`; the empty-availability default range applies.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** tests, typecheck, strict, lint attribution, `wc -l`. **Step 5: Checkpoint.**

---

### Task 7: Week view hour grid

**Files:** Modify `_components/calendar-week-view.tsx`; test `tests/unit/app/calendar/week-grid.test.tsx`

Seven day columns sharing one hour rail, reusing Task 6's band, chip and all-day components unchanged. Per-column availability differs by weekday, so shading is computed per column. Horizontal scroll on mobile rather than a squeeze; the existing mobile behaviour that downgrades week to day may make this moot, so check what the split preserved and say which you kept.

- [ ] **Step 1: Failing tests:** a booking lands in the correct weekday column at the correct offset; two bookings on different days do not share a column layout; Monday shading differs from Sunday when the rules differ; the all-day band spans the week.
- [ ] **Step 2:** FAIL. **Step 3:** Implement, reusing rather than reimplementing. **Step 4:** tests, gates, `wc -l`. **Step 5: Checkpoint.**

---

### Task 8: Booking detail panel

**Files:** Create `app/(dashboard)/calendar/booking-detail-panel.tsx`; modify `app/(dashboard)/calendar/page.tsx`; test `tests/unit/app/calendar/booking-detail-panel.test.tsx`

Uses the `SidePanel` primitive (see `app/(dashboard)/tasks/task-side-panel.tsx` for the idiom). Shows booker name, email, phone, the meeting type, the time in the MC's timezone, the linked couple when there is one, notes, and the join link when present with `rel="noopener noreferrer"`. Actions: Reschedule (a slot picker or, if that proves large, a date and time control feeding `rescheduleBookingAction`) and Cancel behind an explicit confirmation step, both wired to Task 5.

Panel state is separate from the existing `selectedCouple` modal state; both may exist without colliding because `useOverlay` is depth-aware. Do not convert the couple profile to a panel.

- [ ] **Step 1: Failing tests:** panel renders the booking's details; cancel requires confirmation then calls the action and closes; a failed action surfaces an error and leaves the panel open; the join link carries the rel attribute.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** tests, gates. **Step 5: Checkpoint.**

---

### Task 9: Bookings tab

**Files:** Modify `app/(dashboard)/calendar/calendar-tabs.tsx` and `page.tsx`; create `app/(dashboard)/calendar/bookings-tab.tsx`, `booking-row.tsx`; test `tests/unit/app/calendar/bookings-tab.test.tsx`

Adds `'bookings'` to `CalendarTab`. Upcoming and past sections (past collapsed or secondary), each row showing time in the MC's timezone, booker, meeting type, status pill, and the linked couple; clicking a row opens Task 8's panel. Explicit loading, empty ("No bookings yet. Share a meeting type link and they will appear here.") and error states.

- [ ] **Step 1: Failing tests:** upcoming and past split at now; a cancelled booking shows its status; clicking a row opens the panel; the empty state renders with no bookings.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** tests, gates, `wc -l`. **Step 5: Checkpoint.**

---

### Task 10: Docs, gates, wrap-up

**Files:** `.claude/docs/page-specs.md`, `frontend-design.md`, `security.md`, `testing.md`, `production-readiness.md`, plus `component-library.md` if any new shared primitive emerged

- [ ] **Step 1: Docs.** The rebuilt `/calendar` and its four tabs; the hour-grid model and the fail-soft busy posture with its rationale; the new authenticated busy route and the MC booking actions in the security doc; the new suites in testing; a Phase E status line in the roadmap. Document only what shipped. No em dashes.
- [ ] **Step 2: Full gates:** `npm run typecheck && npm run typecheck:strict:gate && npm run check:server-action-exports && npm run check:no-service-role && npm run check:public-styling ; npm run lint:gate ; npm run test:unit && npm run test:integration`. Run the per-file lint attribution before describing any overage, and ratchet budgets DOWN only if a count legitimately dropped.
- [ ] **Step 3: Final checkpoint:** every file changed this phase, the final `wc -l` of the `_components` directory proving the monolith is gone, and an honest note on what was never executed locally (the e2e specs and the cron paths).
