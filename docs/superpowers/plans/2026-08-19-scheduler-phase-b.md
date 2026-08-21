# Zebri Scheduler Phase B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the internal scheduling surface: `meeting_types` + `availability_rules` + `availability_overrides` tables, a pure slot-computation engine with real timezone/DST handling, and two new `/calendar` tabs (Meeting types, Availability) built on the existing CRUD idioms.

**Architecture:** Three new owned tables (migration + RLS + integration tests). A pure `lib/scheduling/` module: timezone helpers built on `Intl.DateTimeFormat` (no date library exists in the repo, keep it that way) and `computeSlots()` which subtracts busy intervals (from Phase A's `lib/calendar/free-busy`) from weekly rules + overrides. UI follows the Payments tab idiom and the couples CRUD idiom (server actions returning tagged results + react-query hooks + Modal). One new design-system primitive (`TimeSelect`) with its `/design-system` Spec entry in the same PR.

**Tech Stack:** Next.js 16 App Router, Supabase (local for tests), Vitest 3 + RTL, react-query, Radix Select, native `Intl` for timezones.

**Spec:** `docs/superpowers/specs/2026-08-18-scheduler-design.md`

**Scope notes:**
- The `bookings` table and the public `/book/[token]` page are Phase C. The slot engine takes bookings as a plain input array (empty until Phase C wires it).
- The Calendar tab keeps rendering the existing `CouplesCalendar` unchanged; its rebuild is Phase E.
- The MC's timezone does not exist anywhere today; this phase adds `user_public_settings.timezone` (text, IANA id) because that table is the existing one-row-per-user settings row and Phase C's public slot route can read it server-side.
- Overrides are ONE row per date (unique user_id+date): either a full-day block (`available=false`) or one custom window. Multiple windows per override date is deliberate YAGNI.
- Slot starts step every 30 minutes (spec locked).
- The video-provider choice (Meet vs Teams) when both calendars are connected is a Phase C concern (event push); `location_type='video'` needs no provider column now.

## Global Constraints

- **Never run `git commit` or `git push`. The user commits.** End each task by listing changed files. Work happens on a new branch `feature/scheduler-phase-b` created from `feature/scheduler-phase-a` (Phase A is not yet merged; this branch stacks on it. If Phase A HAS been merged to staging by execution time, branch from `staging` instead).
- No em dashes anywhere (code comments, copy, docs). Use commas, colons, parentheses.
- TSDoc on every exported function/type/module; why-comments on non-obvious logic.
- `npm run typecheck` must stay 0; new code clean under `npm run typecheck:strict:gate` (262 baseline, never raise); `npm run lint:gate` budget 54 errors / 111 warnings, never raise.
- `lib/` stays pure: no React, no server-only leaks into `'use client'` files.
- UI: `/design-system` primitives only; tokens only (`text-body`, `text-section`, `text-text-muted`, `border-border`, `rounded-control`, `text-danger`, `bg-surface-muted`); Lucide `strokeWidth={1.5}`; controls are h-8 via primitives; `<Button loading>` never label-swap; components ≤ ~150 lines; `cursor-pointer` on non-button interactive elements.
- **Select gotcha:** the shared Select crashes on `value=""` options; use sentinel values + placeholder. Under `exactOptionalPropertyTypes`, spread optional Radix props conditionally.
- Migrations: one new file, non-destructive, CI `supabase db push` deploys it. Local: `supabase migration up`; after any `db reset`, run the grant-repair SQL (memory: local_db_reset_grant_breakage).
- Integration tests against local Supabase; regenerate types with `npx supabase gen types typescript --local > types/database.ts` after the migration.
- Server actions: Zod via `@/lib/api/validate` or inline `z` (match `app/(dashboard)/couples/actions.ts` idiom), tagged `{ ok: true, data } | { ok: false, error }` results, `unwrap()` in hooks.

---

### Task 1: Branch + migration (3 tables + timezone column) + RLS integration tests + types regen

**Files:**
- Create: `supabase/migrations/20260819000000_create_scheduling_tables.sql`
- Create: `tests/integration/rls/scheduling-tables.test.ts`
- Modify: `types/database.ts` (regenerated)

**Interfaces:**
- Consumes: `tests/integration/helpers/supabase.ts` (`createTestUser`, `anonClient`, `TestUser`).
- Produces: tables `meeting_types`, `availability_rules`, `availability_overrides` (+ `user_public_settings.timezone text`); `Database` row types for all three, used by every later task.

- [ ] **Step 1: Create the branch**

Run: `git checkout -b feature/scheduler-phase-b` (from `feature/scheduler-phase-a`, or from `staging` if Phase A already merged).

- [ ] **Step 2: Write the failing RLS integration test**

Create `tests/integration/rls/scheduling-tables.test.ts`. Follow the structure of `tests/integration/rls/calendar-connections.test.ts` exactly (two pro users + anon). One `describe` per table, each covering: owner SELECT ok; cross-tenant SELECT returns `[]`; cross-tenant INSERT (a row with `user_id: userA.id` from userB's client) errors; cross-tenant UPDATE returns `[]`; cross-tenant DELETE leaves the row; anon sees nothing. Seed rows:

```ts
// meeting_types seed (userA)
{ user_id: userA.id, name: 'Intro call', duration_minutes: 30 }
// availability_rules seed (userA)
{ user_id: userA.id, weekday: 1, start_time: '10:00', end_time: '13:00' }
// availability_overrides seed (userA)
{ user_id: userA.id, date: '2026-12-14', available: false }
```

Also assert defaults on the meeting_types row read back by the owner: `active === true`, `reminder_enabled === true`, `location_type === 'video'`, `buffer_before_minutes === 0`, `buffer_after_minutes === 0`, `min_notice_hours === 24`, `max_advance_days === 60`, and `share_token` is a non-empty string. And one constraint probe per table: `availability_rules` insert with `start_time >= end_time` errors; `availability_overrides` second insert for the same `(user_id, date)` errors.

- [ ] **Step 3: Run to verify failure**

Run: `npm run test:integration -- rls/scheduling-tables`
Expected: FAIL, relations do not exist (local Supabase must be running).

- [ ] **Step 4: Write the migration**

Create `supabase/migrations/20260819000000_create_scheduling_tables.sql`:

```sql
-- Scheduler Phase B: meeting types + weekly availability + date overrides.
--
-- meeting_types: the Calendly-style bookable types (duration, location,
-- buffers, notice window) with a share_token for the Phase C public
-- booking page. availability_rules: the MC's ONE user-level weekly
-- schedule as (weekday, window) rows, times interpreted in the MC's
-- timezone (user_public_settings.timezone, added below).
-- availability_overrides: one row per date, either a full-day block
-- (available=false, times null) or one custom window.
--
-- Non-destructive migration: no @ALLOW_DESTRUCTIVE marker required.

create table meeting_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  location_type text not null default 'video'
    check (location_type in ('video', 'phone', 'in_person')),
  -- Physical address, only meaningful for in_person.
  address text,
  buffer_before_minutes integer not null default 0 check (buffer_before_minutes between 0 and 240),
  buffer_after_minutes integer not null default 0 check (buffer_after_minutes between 0 and 240),
  min_notice_hours integer not null default 24 check (min_notice_hours between 0 and 720),
  max_advance_days integer not null default 60 check (max_advance_days between 1 and 365),
  reminder_enabled boolean not null default true,
  active boolean not null default true,
  -- Capability token for the public /book page (Phase C). App code may
  -- rotate it with crypto.randomUUID(); the default covers creation.
  share_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meeting_types_user_id_idx on meeting_types(user_id);

create table availability_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (start_time < end_time),
  created_at timestamptz not null default now()
);
create index availability_rules_user_id_idx on availability_rules(user_id);

create table availability_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  available boolean not null,
  start_time time,
  end_time time,
  -- A custom window needs both ends; a block needs neither.
  check (
    (available and start_time is not null and end_time is not null and start_time < end_time)
    or (not available and start_time is null and end_time is null)
  ),
  unique (user_id, date),
  created_at timestamptz not null default now()
);
create index availability_overrides_user_id_idx on availability_overrides(user_id);

alter table meeting_types enable row level security;
alter table availability_rules enable row level security;
alter table availability_overrides enable row level security;

create policy "meeting_types_user_isolation" on meeting_types
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "availability_rules_user_isolation" on availability_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "availability_overrides_user_isolation" on availability_overrides
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The MC's IANA timezone; availability times are wall-clock in this
-- zone. Lives on the existing one-row-per-user settings table so Phase
-- C's public slot route can read it server-side. Null until the MC
-- first saves availability (the editor seeds it from the browser).
alter table public.user_public_settings
  add column if not exists timezone text;
```

- [ ] **Step 5: Apply locally**

Run: `supabase migration up` (grant-repair SQL only if you had to reset).

- [ ] **Step 6: Regenerate types, typecheck**

Run: `npx supabase gen types typescript --local > types/database.ts && npm run typecheck`
Expected: file regenerated, 0 type errors.

- [ ] **Step 7: Run the integration test**

Run: `npm run test:integration -- rls/scheduling-tables`
Expected: PASS (all tables, all probes).

- [ ] **Step 8: Checkpoint**

List changed files for the user (no commit).

---

### Task 2: Timezone helpers (`lib/scheduling/timezone.ts`)

**Files:**
- Create: `lib/scheduling/timezone.ts`
- Test: `tests/unit/lib/scheduling/timezone.test.ts`

**Interfaces:**
- Consumes: nothing (pure `Intl`).
- Produces (used by Task 3 and Phase C):
  - `function zonedTimeToUtc(date: string, time: string, timeZone: string): Date` ("2026-10-05" + "10:00" in "Australia/Sydney" to the exact UTC instant, DST-correct)
  - `function zonedDateParts(utc: Date, timeZone: string): { date: string; weekday: number }` (the wall-clock date "YYYY-MM-DD" and weekday 0=Sunday..6=Saturday at that instant in the zone)

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/lib/scheduling/timezone.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { zonedDateParts, zonedTimeToUtc } from '@/lib/scheduling/timezone';

describe('zonedTimeToUtc', () => {
  it('converts Sydney winter time (AEST, UTC+10)', () => {
    expect(zonedTimeToUtc('2026-07-15', '10:00', 'Australia/Sydney').toISOString()).toBe(
      '2026-07-15T00:00:00.000Z',
    );
  });

  it('converts Sydney summer time (AEDT, UTC+11)', () => {
    expect(zonedTimeToUtc('2026-12-15', '10:00', 'Australia/Sydney').toISOString()).toBe(
      '2026-12-14T23:00:00.000Z',
    );
  });

  it('is correct on the AEDT spring-forward day (2026-10-04)', () => {
    // DST starts 2026-10-04 02:00 AEST -> 03:00 AEDT in Australia/Sydney.
    // 10:00 that morning is already AEDT (UTC+11).
    expect(zonedTimeToUtc('2026-10-04', '10:00', 'Australia/Sydney').toISOString()).toBe(
      '2026-10-03T23:00:00.000Z',
    );
    // 01:00, before the jump, is still AEST (UTC+10).
    expect(zonedTimeToUtc('2026-10-04', '01:00', 'Australia/Sydney').toISOString()).toBe(
      '2026-10-03T15:00:00.000Z',
    );
  });

  it('handles a UTC zone and a negative-offset zone', () => {
    expect(zonedTimeToUtc('2026-03-01', '12:00', 'UTC').toISOString()).toBe(
      '2026-03-01T12:00:00.000Z',
    );
    expect(zonedTimeToUtc('2026-03-01', '12:00', 'America/New_York').toISOString()).toBe(
      '2026-03-01T17:00:00.000Z',
    );
  });
});

describe('zonedDateParts', () => {
  it('crosses the date line correctly', () => {
    // 14:30 UTC on Jan 5 is Jan 6, 01:30 in Sydney (AEDT).
    expect(zonedDateParts(new Date('2026-01-05T14:30:00Z'), 'Australia/Sydney')).toEqual({
      date: '2026-01-06',
      weekday: 2,
    });
  });

  it('maps weekdays 0..6 Sunday-first', () => {
    // 2026-01-04 is a Sunday in UTC.
    expect(zonedDateParts(new Date('2026-01-04T12:00:00Z'), 'UTC').weekday).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:unit -- lib/scheduling/timezone`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `lib/scheduling/timezone.ts`**

```ts
/**
 * Timezone conversion built on Intl.DateTimeFormat: the repo has no
 * date library and scheduling is the only consumer that needs zone
 * math, so these two helpers stay deliberately tiny. Availability
 * windows are wall-clock times in the MC's IANA zone; slots are UTC
 * instants; these convert between the two, DST-correct.
 *
 * @module lib/scheduling/timezone
 */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Offset of `timeZone` from UTC, in minutes, at the instant `utcDate`. */
function tzOffsetMinutes(utcDate: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(utcDate);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    // Intl emits hour "24" at midnight in some environments.
    get('hour') % 24,
    get('minute'),
    get('second'),
  );
  return (asUtc - utcDate.getTime()) / 60_000;
}

/**
 * The UTC instant of wall-clock `date` ("YYYY-MM-DD") + `time` ("HH:mm")
 * in `timeZone`. Two-pass offset lookup: the first guess can land on the
 * wrong side of a DST boundary, so the offset is re-read at the corrected
 * instant.
 */
export function zonedTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const naive = Date.UTC(y!, m! - 1, d!, hh!, mm!);
  const firstOffset = tzOffsetMinutes(new Date(naive), timeZone);
  const offset = tzOffsetMinutes(new Date(naive - firstOffset * 60_000), timeZone);
  return new Date(naive - offset * 60_000);
}

/**
 * The wall-clock date ("YYYY-MM-DD") and weekday (0=Sunday..6=Saturday)
 * at instant `utc` in `timeZone`.
 */
export function zonedDateParts(
  utc: Date,
  timeZone: string,
): { date: string; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(utc);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: WEEKDAYS.indexOf(get('weekday') as (typeof WEEKDAYS)[number]),
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test:unit -- lib/scheduling/timezone && npm run typecheck`
Expected: PASS, 0 errors.

- [ ] **Step 5: Checkpoint**

List changed files (no commit).

---

### Task 3: Slot engine (`lib/scheduling/slots.ts`)

**Files:**
- Create: `lib/scheduling/slots.ts`
- Test: `tests/unit/lib/scheduling/slots.test.ts`

**Interfaces:**
- Consumes: `zonedTimeToUtc`, `zonedDateParts` (Task 2); `BusyInterval` from `@/lib/calendar/intervals`.
- Produces (Phase C's slots route consumes this exactly):

```ts
export interface WeeklyRule { weekday: number; start_time: string; end_time: string }
export interface DateOverride {
  date: string; available: boolean;
  start_time: string | null; end_time: string | null;
}
export interface SlotEngineConfig {
  timezone: string;
  rules: WeeklyRule[];
  overrides: DateOverride[];
  /** Merged busy blocks: external calendars + (Phase C) confirmed bookings. */
  busy: BusyInterval[];
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minNoticeHours: number;
  maxAdvanceDays: number;
  /** Injected clock (no Date.now() in signatures; testability). */
  now: Date;
}
export interface Slot { start: string; end: string }
export function computeSlots(
  config: SlotEngineConfig,
  range: { start: Date; end: Date },
): Slot[]
```

Algorithm (implement exactly):
1. Effective window: `from = max(range.start, now + minNoticeHours)`, `to = min(range.end, now + maxAdvanceDays * 24h)`. If `from >= to`, return [].
2. Enumerate MC-timezone calendar days from `zonedDateParts(from).date` through `zonedDateParts(to).date` (step by adding 24h to a cursor starting at `from`, dedupe dates; a day may appear once).
3. Windows for a day: the override row for that date if one exists (`available=false` yields none; custom window yields exactly that one), else all weekly rules matching the weekday.
4. For each window, convert `start_time`/`end_time` to UTC instants with `zonedTimeToUtc(date, time, timezone)`. Slot starts at the window start and every 30 minutes after (`SLOT_STEP_MINUTES = 30`); a slot is `[s, s + duration]` and must fit fully inside the window.
5. Keep a slot only if `s >= from` and `s + duration <= to` and its buffered span `[s - bufferBefore, s + duration + bufferAfter]` overlaps no busy interval (overlap: `bufferedStart < busy.end && busy.start < bufferedEnd`, epoch-millis comparison).
6. Return slots sorted ascending, ISO UTC strings.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/lib/scheduling/slots.test.ts`. Base fixture:

```ts
import { describe, expect, it } from 'vitest';

import { computeSlots, type SlotEngineConfig } from '@/lib/scheduling/slots';

/** Monday 2026-07-13 in Sydney winter (AEST, UTC+10). */
const base: SlotEngineConfig = {
  timezone: 'Australia/Sydney',
  rules: [{ weekday: 1, start_time: '10:00', end_time: '12:00' }],
  overrides: [],
  busy: [],
  durationMinutes: 30,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  minNoticeHours: 0,
  maxAdvanceDays: 60,
  now: new Date('2026-07-12T00:00:00Z'),
};
const monday = {
  start: new Date('2026-07-12T14:00:00Z'),
  end: new Date('2026-07-13T14:00:00Z'),
};
```

Cases (each a small override of `base`):
1. **Happy path**: Monday 10:00-12:00 AEST, 30-min slots → exactly 4 slots starting `2026-07-13T00:00:00Z`, `00:30`, `01:00`, `01:30` (10:00-11:30 local); the 12:00 boundary slot is excluded because it would end outside the window.
2. **60-min duration**: same window → 3 slots (10:00, 10:30, 11:00 local starts; 11:30 doesn't fit).
3. **Busy block removes overlapping slots**: busy `[2026-07-13T00:30:00Z, 2026-07-13T01:00:00Z)` → slots at 00:00 and 01:00 and 01:30 remain (00:30 gone).
4. **Buffers widen the exclusion**: bufferBefore=15, bufferAfter=15 with the same busy block. Derive the surviving set by hand IN A TEST COMMENT (slot 00:00 has buffered span 23:45-00:45, overlapping busy 00:30-01:00, excluded; slot 01:00 has buffered span 00:45-01:45, overlapping busy end 01:00, excluded; slot 01:30 has buffered span 01:15-02:15, clear, kept) and assert the exact ISO list.
5. **Min notice**: `now = 2026-07-13T00:15:00Z`, minNoticeHours=1 → only slots at/after 01:15, so 01:30 only.
6. **Max advance**: maxAdvanceDays=0 is invalid per schema; use now far before and maxAdvanceDays=1 with a range 3 days out → [].
7. **Block override**: override `{ date: '2026-07-13', available: false, start_time: null, end_time: null }` → [].
8. **Custom-window override wins over weekly rules**: override `{ date: '2026-07-13', available: true, start_time: '14:00', end_time: '15:00' }` → 2 slots at 04:00Z and 04:30Z.
9. **DST spring-forward day**: rules weekday 0 (Sunday) 09:00-11:00, range covering 2026-10-04 Sydney → slot starts `2026-10-03T22:00:00Z` (09:00 AEDT) etc.: assert first slot is `22:00Z` proving the 11h offset, 4 slots total.
10. **Empty rules** → [].

For case 4, do the arithmetic in comments and assert the exact list (no "toHaveLength-only" assertions anywhere; every case asserts exact ISO strings).

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:unit -- lib/scheduling/slots`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `lib/scheduling/slots.ts`**

Implement the algorithm above. Keep it one exported function + small private helpers (`windowsForDate`, `overlapsBusy`), ≤150 lines, TSDoc on the exports, why-comments on the two-sided overlap check and the fit-inside-window rule. `SLOT_STEP_MINUTES = 30` as a named constant with a comment pointing at the spec decision.

- [ ] **Step 4: Run tests, gates**

Run: `npm run test:unit -- lib/scheduling && npm run typecheck && npm run typecheck:strict:gate`
Expected: all PASS, strict count not raised.

- [ ] **Step 5: Checkpoint**

List changed files (no commit).

---

### Task 4: `TimeSelect` primitive + design-system entry

**Files:**
- Create: `components/ui/time-select.tsx`
- Modify: `app/design-system/primitives-forms.tsx` (add the Spec entry)
- Test: `tests/unit/components/time-select.test.tsx`

**Interfaces:**
- Consumes: the shared `Select` primitive (`@/components/ui/select`).
- Produces: `<TimeSelect value onChange minuteStep={30} startHour={6} endHour={22} placeholder />` where `value` is `"HH:mm"` 24-hour, `onChange(value: string)`; renders options as 12-hour labels ("10:00 AM"). Used by Task 8's availability editor.

- [ ] **Step 1: Write the failing test**

RTL test: renders with `value="10:00"` showing "10:00 AM"; opening and choosing "1:30 PM" calls `onChange('13:30')`; respects `minuteStep`/`startHour`/`endHour` (option count). Use `getByRole('combobox')` and Radix select interaction idioms already used in existing component tests (find one under `tests/unit/components/` and copy its Radix interaction setup).

- [ ] **Step 2: Run to verify failure**, **Step 3: Implement**

Thin wrapper: generate times from `startHour` to `endHour` stepping `minuteStep`, map to `{ value: 'HH:mm', label: '12h' }`, delegate to `Select`. TSDoc explains why it exists (availability editor + timeline modal both need time choices; the timeline modal's private TimePicker is NOT migrated in this phase). ≤80 lines.

- [ ] **Step 4: Add the `/design-system` Spec entry**

In `app/design-system/primitives-forms.tsx`, add a `<Spec name="TimeSelect" file="components/ui/time-select.tsx" importPath="@/components/ui/time-select" description="...">` with a `<Rule>` (24h value, 12h label; never hand-roll time dropdowns) and a `<Demo>` rendering a working instance. Match the surrounding Spec entries' style exactly.

- [ ] **Step 5: Run tests + lint, checkpoint**

Run: `npm run test:unit -- components/time-select && npm run typecheck && npm run lint:gate`. List changed files (no commit).

---

### Task 5: `/calendar` tab bar

**Files:**
- Modify: `app/(dashboard)/calendar/page.tsx`
- Create: `app/(dashboard)/calendar/calendar-tabs.tsx`

**Interfaces:**
- Consumes: the Payments tab idiom (`app/(dashboard)/payments/payments-header.tsx` TabButton: read it and mirror), existing `CouplesCalendar`.
- Produces: `type CalendarTab = 'calendar' | 'meeting-types' | 'availability'`; `<CalendarTabs active onChange>`; page state `useState<CalendarTab>('calendar')`. Tabs render: `calendar` → existing `CouplesCalendar` block unchanged; `meeting-types` → `<MeetingTypesTab />` (Task 6); `availability` → `<AvailabilityTab />` (Task 8). Until Tasks 6/8 land, render the shared `Empty` primitive with copy "Coming in this phase" so the page compiles standalone; Tasks 6/8 replace those placeholders.

- [ ] **Step 1: Implement** the tab bar (labels: Calendar, Meeting types, Availability) below the PageHeader, mobile-friendly (horizontal scroll if needed, mirror payments-header responsive classes).
- [ ] **Step 2: Verify**: `npm run typecheck && npm run lint:gate`; existing calendar behaviour (couple click opens profile) unchanged by reading the diff.
- [ ] **Step 3: Checkpoint** (no commit).

---

### Task 6: Meeting types data layer + list tab

**Files:**
- Create: `app/(dashboard)/calendar/actions.ts` (server actions for meeting types AND availability, one file, ~150 lines; split into `availability-actions.ts` if it exceeds that)
- Create: `app/(dashboard)/calendar/use-meeting-types.ts`
- Create: `app/(dashboard)/calendar/meeting-types-tab.tsx`
- Modify: `app/(dashboard)/calendar/page.tsx` (swap placeholder)

**Interfaces:**
- Consumes: couples CRUD idiom (`app/(dashboard)/couples/actions.ts` + `use-couples.ts`: read both first and mirror the tagged-result + `unwrap` + invalidateQueries pattern); `Database['public']['Tables']['meeting_types']['Row']` as `MeetingType`.
- Produces:
  - Actions: `listMeetingTypesAction()`, `createMeetingTypeAction(input)`, `updateMeetingTypeAction(id, input)`, `deleteMeetingTypeAction(id)` where `input` is Zod-validated `{ name: string(1..120); description?: string(..500); duration_minutes: int 5..480; location_type: 'video'|'phone'|'in_person'; address?: string(..300); buffer_before_minutes: int 0..240; buffer_after_minutes: int 0..240; min_notice_hours: int 0..720; max_advance_days: int 1..365; reminder_enabled: boolean; active: boolean }`. All owner-scoped via the authed server client (RLS enforces).
  - Hooks: `useMeetingTypes()`, `useCreateMeetingType()`, `useUpdateMeetingType()`, `useDeleteMeetingType()` (queryKey `['meeting-types']`).
  - `<MeetingTypesTab />`: list rows (name, duration, location icon, active StatePill), a CopyButton copying `${window.location.origin}/book/${share_token}` (works after Phase C; TSDoc says so), RowActionsMenu (Edit, Delete via ConfirmDialog), header "New meeting type" Button, `Empty` state ("Create your first meeting type so couples can book you."), `Loading` and `ErrorState` states wired.

- [ ] **Step 1: Write failing hook/action tests** in `tests/unit/app/calendar/meeting-types.test.ts`: Zod schema unit tests (valid input passes; duration 3 rejected; address ignored/optional for video; unknown location_type rejected). Mirror how existing action schemas are unit-tested (search `tests/unit` for an actions schema test to copy; if none exists, export the Zod schema from actions.ts as `meetingTypeInputSchema` and test it directly).
- [ ] **Step 2: Implement actions + hooks** (mirror couples files).
- [ ] **Step 3: Implement the tab UI** (≤150 lines; extract `meeting-type-row.tsx` if needed).
- [ ] **Step 4: Verify**: `npm run test:unit -- app/calendar && npm run typecheck && npm run lint:gate && npm run check:no-service-role`.
- [ ] **Step 5: Checkpoint** (no commit).

---

### Task 7: Meeting type modal (create/edit)

**Files:**
- Create: `app/(dashboard)/calendar/meeting-type-modal.tsx`
- Modify: `app/(dashboard)/calendar/meeting-types-tab.tsx` (open modal for new/edit)

**Interfaces:**
- Consumes: `Modal` primitive (`isOpen onClose title footer size='md'`), `Input`, `Textarea`, `Select` (sentinel values, never `""`), `Checkbox`, `Button loading`, hooks from Task 6.
- Produces: `<MeetingTypeModal isOpen onClose meetingType={MeetingType | null} />` (null = create). Fields: name, description, duration (Select: 15/30/45/60/90/120 min), location (Select: Video call / Phone call / In person; address Input revealed only for in_person), buffers (two Selects 0/10/15/30/60), min notice (Select: 0/4/12/24/48h labelled "None/4 hours/..."), max advance (Select: 14/30/60/90/180 days), reminder Checkbox, active Checkbox. Footer: Cancel + Save (`<Button loading={isPending}>Save</Button>`). Seeds state from `meetingType` prop via `useEffect` on open (couple-modal idiom).

- [ ] **Step 1: Implement** (≤150 lines; extract a `meeting-type-fields.tsx` subcomponent if over).
- [ ] **Step 2: RTL test** `tests/unit/app/calendar/meeting-type-modal.test.tsx`: renders create mode with defaults (duration 30, location video); fills name and saves → create hook called with expected payload (mock the hooks module); edit mode seeds fields from the row.
- [ ] **Step 3: Verify** `npm run test:unit -- app/calendar && npm run typecheck && npm run lint:gate`.
- [ ] **Step 4: Checkpoint** (no commit).

---

### Task 8: Availability editor tab

**Files:**
- Create: `app/(dashboard)/calendar/use-availability.ts`
- Create: `app/(dashboard)/calendar/availability-tab.tsx`
- Create: `app/(dashboard)/calendar/availability-day-row.tsx`
- Create: `app/(dashboard)/calendar/availability-overrides.tsx`
- Modify: `app/(dashboard)/calendar/actions.ts` (availability + timezone actions; split file if >150 lines)
- Modify: `app/(dashboard)/calendar/page.tsx` (swap placeholder)

**Interfaces:**
- Consumes: `TimeSelect` (Task 4), `DatePicker`, `Checkbox`, `Button`, `ConfirmDialog`, `Empty/Loading/ErrorState`; `zonedDateParts` NOT needed client-side (editor edits wall-clock values only).
- Produces:
  - Actions: `getAvailabilityAction()` returns `{ rules, overrides, timezone }`; `saveAvailabilityRulesAction(rules: { weekday; start_time; end_time }[], timezone: string)` (replace-all semantics: delete own rows + bulk insert inside the action; Zod: weekday 0..6, HH:mm regex `^([01]\d|2[0-3]):[0-5]\d$`, start<end string compare is WRONG across midnight but windows can't cross midnight per schema, compare as minutes; timezone must be in `Intl.supportedValuesOf('timeZone')`); `upsertOverrideAction({ date, available, start_time, end_time })`; `deleteOverrideAction(date: string)`.
  - **PostgREST gotcha (memory-backed):** the bulk insert array must have IDENTICAL keys on every row, and the action must check `.error` and surface it; a silent partial insert here corrupts availability.
  - Hooks: `useAvailability()`, `useSaveAvailability()`, `useUpsertOverride()`, `useDeleteOverride()` (queryKey `['availability']`).
  - `<AvailabilityTab />`: timezone Select at top (options from `Intl.supportedValuesOf('timeZone')`, default = saved value else `Intl.DateTimeFormat().resolvedOptions().timeZone`); seven `<AvailabilityDayRow>` (Mon-first display order, weekday numbers stay 0=Sun), each: enabled Checkbox + one or more windows (`TimeSelect` pair) + add/remove window buttons (Lucide Plus/X, strokeWidth 1.5); Save button (`loading` overlay) persisting rules + timezone together; `<AvailabilityOverrides>`: list of override rows (date, "Blocked" or window, delete), "Block a date / custom hours" adder using DatePicker + Checkbox + TimeSelect pair.

- [ ] **Step 1: RTL test first** `tests/unit/app/calendar/availability-tab.test.tsx` (mock hooks): renders 7 day rows; toggling a day off removes its windows from the save payload; add-window produces a second TimeSelect pair; save calls `useSaveAvailability` with `{ rules, timezone }` shape exactly.
- [ ] **Step 2: Implement actions + hooks.** Replace-all save runs delete-then-insert sequentially and returns the first `.error` encountered.
- [ ] **Step 3: Implement the three components** (each ≤150 lines).
- [ ] **Step 4: Verify** `npm run test:unit -- app/calendar && npm run typecheck && npm run lint:gate && npm run check:no-service-role`.
- [ ] **Step 5: Checkpoint** (no commit).

---

### Task 9: Docs + gates + wrap-up

**Files:**
- Modify: `.claude/docs/database-schema.md` (three tables + timezone column)
- Modify: `.claude/docs/page-specs.md` (the /calendar page now has tabs; document each)
- Modify: `.claude/docs/security.md` (RLS matrix rows for the three tables, integration test ticked)
- Modify: `.claude/docs/frontend-design.md` (TimeSelect primitive) — the `/design-system` entry landed in Task 4
- Modify: `.claude/docs/production-readiness.md` (Phase B status line)

- [ ] **Step 1: Update the five docs**, mirroring each doc's existing style, no em dashes, nothing invented (public booking page is Phase C: do not document it as existing).
- [ ] **Step 2: Full gate suite**: `npm run typecheck && npm run typecheck:strict:gate && npm run lint:gate && npm run test:unit && npm run test:integration`. All green; ratchet gates DOWN only if counts dropped.
- [ ] **Step 3: Final checkpoint**: list every file changed in the phase; branch ready for user review/commit; PR stacks on Phase A (or targets staging if A merged).
