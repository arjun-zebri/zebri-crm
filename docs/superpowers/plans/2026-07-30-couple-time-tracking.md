# Couple Time Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an MC/celebrant time the work they do on each couple, with a start/stop clock in the Couple Profile header, an always-visible running pill, a timesheet note plus category captured on stop, and a per-couple Time tab showing totals so they can charge accordingly.

**Architecture:** The running timer is a database row with a null `ended_at`, so elapsed time is derived from `started_at` and survives reloads and device switches. A partial unique index makes "one running timer per user" a database invariant. All writes go through Zod-validated server actions on the RLS-scoped Supabase client. Client state is React Query; a single app-level provider mounted in the dashboard layout owns the pill, the stop-note dialog, and the start/stop mutations, so any surface can start a timer without prop drilling.

**Tech Stack:** Next.js 16 App Router (server actions), React 19, Tailwind 4 semantic tokens, Supabase Postgres with RLS, `@tanstack/react-query`, `@radix-ui/react-popover`, `zod`, Vitest 3 (unit + integration), Playwright.

Spec: `docs/superpowers/specs/2026-07-30-couple-time-tracking-design.md`.

## Global Constraints

- Branch: `feature/custom-payment-schedules`. Do not open a PR to `main`; per the current batch rule, hardening/feature work stays on `staging` until the batch lands.
- **No em dashes** anywhere: code, comments, copy, commit messages, docs. Use commas, colons, or parentheses.
- TSDoc on every exported function, type, and module, plus why-comments on non-obvious logic. Module-level `@module` tag matching the file path, as in every neighbouring file.
- Components ≤ ~150 lines. Split rather than exceed.
- No `any`. Use generated `Database` types from `@/types/database`.
- Tailwind only, semantic tokens only (`text-text`, `text-text-muted`, `bg-surface`, `bg-card`, `border-border`, `text-success`, `text-danger`). No `style={{}}`, no `bg-[#hex]`.
- Use `components/ui/` primitives (`Button`, `Input`, `Modal`, `DatePicker`, `Tooltip`, `RowActionsMenu`, `Empty`). No raw `<button>`, `<input>`, `<select>` in new code.
- Lucide icons always `strokeWidth={1.5}`. Buttons `rounded-xl`, never `rounded-full`. Interactive elements get `cursor-pointer`.
- `npm run typecheck` must stay at 0 errors. New code must also be clean under `npm run typecheck:strict`.
- Never rename existing columns. Migrations are the source of truth; never apply schema changes through the Supabase web SQL editor.
- Every table gets `user_id uuid not null references auth.users(id) on delete cascade`, RLS enabled, and `auth.uid() = user_id` policies.
- Timer cap is **8 hours**. Categories are **plain text chips, no colours**. There are **no rates, no dollar amounts, no invoice line items** in this feature.
- Local Supabase for integration tests. Apply new migrations with `npx supabase migration up` (incremental), **not** `supabase db reset`: on this machine a reset leaves tables without DML grants and integration tests then report as skipped rather than failed.

---

### Task 1: Schema and generated types

**Files:**
- Create: `supabase/migrations/20260730000000_create_couple_time_tracking.sql`
- Modify: `types/database.ts` (regenerated, do not hand-edit)

**Interfaces:**
- Consumes: nothing.
- Produces: tables `public.time_categories` and `public.couple_time_entries`, column `public.user_public_settings.time_categories_seeded`. Generated row types `Database['public']['Tables']['couple_time_entries']['Row']` and `['time_categories']['Row']`.

One migration file rather than two, because `couple_time_entries.category_id` references `time_categories`, so ordering inside a single file is the simplest way to guarantee the FK target exists.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260730000000_create_couple_time_tracking.sql`:

```sql
-- Couple time tracking: per-couple work sessions plus the user's own
-- category vocabulary.
--
-- A session with ended_at = null is RUNNING. Duration is never stored,
-- it is always (ended_at - started_at), so "edit the duration" is
-- "move ended_at".

create table if not exists public.time_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- Case-insensitive uniqueness per user so "Travel" and "travel" cannot
-- both exist and the type-to-create picker can resolve a typed name to
-- an existing row.
create unique index if not exists time_categories_user_lower_name_key
  on public.time_categories (user_id, lower(name));

alter table public.time_categories enable row level security;

create policy "Users manage own time categories"
  on public.time_categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.couple_time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  category_id uuid references public.time_categories(id) on delete set null,
  note text,
  auto_stopped boolean not null default false,
  created_at timestamptz not null default now(),
  constraint couple_time_entries_ends_after_start
    check (ended_at is null or ended_at > started_at)
);

-- The Time tab reads one couple's sessions newest-first.
create index if not exists couple_time_entries_user_couple_started_idx
  on public.couple_time_entries (user_id, couple_id, started_at desc);

-- FK index (repo convention: every foreign key gets an index).
create index if not exists couple_time_entries_category_idx
  on public.couple_time_entries (category_id);

-- "One running timer per user" as a database invariant, not an
-- application convention: two tabs racing on Start makes the second
-- insert fail loudly instead of silently producing two live timers.
create unique index if not exists couple_time_entries_one_running_per_user
  on public.couple_time_entries (user_id)
  where ended_at is null;

alter table public.couple_time_entries enable row level security;

create policy "Users manage own time entries"
  on public.couple_time_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Seed-once marker for the starter category set. Without it, a user who
-- deletes all their categories would have them resurrected on the next
-- read.
alter table public.user_public_settings
  add column if not exists time_categories_seeded boolean not null default false;
```

- [ ] **Step 2: Apply it to local Supabase**

```bash
npx supabase migration up
```

Expected: the new migration applies with no error. If local Supabase is not running, `npx supabase start` first. Do **not** run `supabase db reset` (it breaks DML grants on this machine).

- [ ] **Step 3: Verify the running-timer invariant by hand**

```bash
npx supabase db psql -c "insert into public.time_categories (user_id, name) select id, 'Probe' from auth.users limit 1;"
```

If there are no auth users locally, skip this probe: Task 4's integration test covers the invariant properly. The point of this step is only to confirm the migration is syntactically live.

- [ ] **Step 4: Regenerate database types**

```bash
npx supabase gen types typescript --local --schema public > types/database.ts
npm run typecheck
```

Expected: `typecheck` passes, and `git diff types/database.ts` shows the two new tables plus `time_categories_seeded`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260730000000_create_couple_time_tracking.sql types/database.ts
git commit -m "feat(time): add couple_time_entries and time_categories tables"
```

---

### Task 2: Domain types and pure duration logic

**Files:**
- Create: `types/time-tracking.ts`
- Create: `lib/time-tracking/format.ts`
- Test: `tests/unit/lib/time-tracking/format.test.ts`

**Interfaces:**
- Consumes: `Database` from Task 1.
- Produces:
  - `TimeCategory = { id: string; name: string; position: number }`
  - `TimeEntry = { id: string; couple_id: string; started_at: string; ended_at: string | null; category_id: string | null; category_name: string | null; note: string | null; auto_stopped: boolean }`
  - `RunningTimer = { entry: TimeEntry; couple_name: string; server_now: string }`
  - `TIMER_CAP_MS: number`
  - `formatElapsed(ms: number): string`
  - `formatDuration(ms: number): string`
  - `entryDurationMs(entry: TimeEntry, nowMs: number): number`
  - `capReachedAt(startedAtIso: string): string`
  - `isOverCap(startedAtIso: string, nowMs: number): boolean`
  - `sumByCategory(entries: TimeEntry[]): { label: string; ms: number }[]`
  - `totalMs(entries: TimeEntry[]): number`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/lib/time-tracking/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  TIMER_CAP_MS,
  capReachedAt,
  entryDurationMs,
  formatDuration,
  formatElapsed,
  isOverCap,
  sumByCategory,
  totalMs,
} from '@/lib/time-tracking/format';
import type { TimeEntry } from '@/types/time-tracking';

/** Minimal entry factory so each test states only what it cares about. */
function entry(over: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 'e1',
    couple_id: 'c1',
    started_at: '2026-07-30T02:00:00.000Z',
    ended_at: '2026-07-30T02:48:00.000Z',
    category_id: null,
    category_name: null,
    note: null,
    auto_stopped: false,
    ...over,
  };
}

describe('formatElapsed', () => {
  it('renders zero as 00:00:00', () => {
    expect(formatElapsed(0)).toBe('00:00:00');
  });

  it('zero-pads hours, minutes and seconds', () => {
    expect(formatElapsed(12 * 60_000 + 47_000)).toBe('00:12:47');
  });

  it('keeps counting hours past 24 rather than wrapping', () => {
    expect(formatElapsed(26 * 3_600_000 + 61_000)).toBe('26:01:01');
  });

  it('clamps negative input to zero (clock skew must never show -1)', () => {
    expect(formatElapsed(-5_000)).toBe('00:00:00');
  });
});

describe('formatDuration', () => {
  it('renders sub-hour durations in minutes only', () => {
    expect(formatDuration(48 * 60_000)).toBe('48m');
  });

  it('renders hours and minutes', () => {
    expect(formatDuration(75 * 60_000)).toBe('1h 15m');
  });

  it('drops a zero minute part', () => {
    expect(formatDuration(2 * 3_600_000)).toBe('2h');
  });

  it('floors seconds into the minute below', () => {
    expect(formatDuration(59_000)).toBe('0m');
  });
});

describe('entryDurationMs', () => {
  it('uses ended_at for a finished entry and ignores now', () => {
    expect(entryDurationMs(entry(), Date.parse('2026-07-30T09:00:00Z'))).toBe(
      48 * 60_000,
    );
  });

  it('measures a running entry against now', () => {
    const running = entry({ ended_at: null });
    expect(
      entryDurationMs(running, Date.parse('2026-07-30T02:10:00Z')),
    ).toBe(10 * 60_000);
  });

  it('caps a running entry at the 8h cap', () => {
    const running = entry({ ended_at: null });
    expect(
      entryDurationMs(running, Date.parse('2026-07-31T02:00:00Z')),
    ).toBe(TIMER_CAP_MS);
  });
});

describe('cap helpers', () => {
  it('capReachedAt returns started_at plus 8h as ISO', () => {
    expect(capReachedAt('2026-07-30T02:00:00.000Z')).toBe(
      '2026-07-30T10:00:00.000Z',
    );
  });

  it('isOverCap is false at exactly the cap', () => {
    expect(
      isOverCap('2026-07-30T02:00:00.000Z', Date.parse('2026-07-30T10:00:00Z')),
    ).toBe(false);
  });

  it('isOverCap is true one millisecond past the cap', () => {
    expect(
      isOverCap(
        '2026-07-30T02:00:00.000Z',
        Date.parse('2026-07-30T10:00:00.001Z'),
      ),
    ).toBe(true);
  });
});

describe('totals', () => {
  const entries = [
    entry({ id: 'a', category_name: 'Meeting' }),
    entry({
      id: 'b',
      category_name: 'Meeting',
      started_at: '2026-07-28T00:00:00.000Z',
      ended_at: '2026-07-28T01:00:00.000Z',
    }),
    entry({
      id: 'c',
      category_name: null,
      started_at: '2026-07-27T00:00:00.000Z',
      ended_at: '2026-07-27T00:12:00.000Z',
    }),
  ];

  it('totalMs sums finished entries', () => {
    expect(totalMs(entries)).toBe(48 * 60_000 + 60 * 60_000 + 12 * 60_000);
  });

  it('sumByCategory groups by name, biggest first, uncategorised last', () => {
    expect(sumByCategory(entries)).toEqual([
      { label: 'Meeting', ms: 108 * 60_000 },
      { label: 'Uncategorised', ms: 12 * 60_000 },
    ]);
  });

  it('sumByCategory returns an empty list for no entries', () => {
    expect(sumByCategory([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run --project unit tests/unit/lib/time-tracking/format.test.ts`
Expected: FAIL, cannot resolve `@/lib/time-tracking/format`.

- [ ] **Step 3: Write the domain types**

Create `types/time-tracking.ts`:

```ts
/**
 * Shared domain types for per-couple time tracking.
 *
 * `TimeEntry` is the app-facing shape, not the raw DB row: the Time tab
 * and the pill both want the category *name* rather than a bare id, so
 * the server actions flatten the joined `time_categories(name)` into
 * `category_name` before returning.
 *
 * @module types/time-tracking
 */

/** One of the user's own work categories (plain text, no colour). */
export interface TimeCategory {
  id: string;
  name: string;
  position: number;
}

/** One work session against a couple. `ended_at === null` means running. */
export interface TimeEntry {
  id: string;
  couple_id: string;
  /** ISO 8601 instant. */
  started_at: string;
  /** ISO 8601 instant, or null while the timer runs. */
  ended_at: string | null;
  category_id: string | null;
  /** Flattened from the joined category row; null when uncategorised. */
  category_name: string | null;
  note: string | null;
  /** True when the 8h cap stopped this session rather than the user. */
  auto_stopped: boolean;
}

/**
 * The user's single running session, plus what the pill needs to render
 * it. `server_now` lets the client correct for clock skew: elapsed is
 * measured against the server's clock, not the device's.
 */
export interface RunningTimer {
  entry: TimeEntry;
  couple_name: string;
  /** ISO 8601 instant, the server's `now()` at read time. */
  server_now: string;
}
```

- [ ] **Step 4: Write the pure logic**

Create `lib/time-tracking/format.ts`:

```ts
/**
 * Pure duration maths and display formatting for time tracking.
 *
 * React-free and dependency-free so it can be unit-tested directly and
 * shared by the server actions (which apply the cap) and the client
 * (which renders it).
 *
 * @module lib/time-tracking/format
 */
import type { TimeEntry } from '@/types/time-tracking';

/**
 * Maximum length of a single running session, 8 hours. A timer left on
 * overnight is a mistake, not 14 hours of work, so reads clamp it here
 * and flag the row for correction.
 */
export const TIMER_CAP_MS = 8 * 60 * 60 * 1000;

/** Label used wherever an entry has no category. */
export const UNCATEGORISED_LABEL = 'Uncategorised';

/**
 * Ticking stopwatch display, `HH:MM:SS`, hours unbounded (`26:01:01` for
 * a long manual entry). Negative input clamps to zero so residual clock
 * skew can never render `-1`.
 */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return [
    pad(Math.floor(total / 3600)),
    pad(Math.floor((total % 3600) / 60)),
    pad(total % 60),
  ].join(':');
}

/**
 * Human duration for lists and totals: `48m`, `1h 15m`, `2h`. Seconds
 * are floored away, so a 59-second session reads `0m` rather than
 * pretending to be a minute.
 */
export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** The instant an 8h cap would stop a session started at `startedAtIso`. */
export function capReachedAt(startedAtIso: string): string {
  return new Date(Date.parse(startedAtIso) + TIMER_CAP_MS).toISOString();
}

/** Whether a session started at `startedAtIso` has passed the cap. */
export function isOverCap(startedAtIso: string, nowMs: number): boolean {
  return nowMs - Date.parse(startedAtIso) > TIMER_CAP_MS;
}

/**
 * Length of one entry. A finished entry measures itself; a running one
 * measures against `nowMs` and never reports more than the cap (the
 * server will have clamped it on the next read anyway, so showing more
 * would only be a lie the UI later retracts).
 */
export function entryDurationMs(entry: TimeEntry, nowMs: number): number {
  const start = Date.parse(entry.started_at);
  if (entry.ended_at) return Math.max(0, Date.parse(entry.ended_at) - start);
  return Math.min(TIMER_CAP_MS, Math.max(0, nowMs - start));
}

/** Sum of every entry, running ones measured to `nowMs`. */
export function totalMs(entries: TimeEntry[], nowMs = Date.now()): number {
  return entries.reduce((sum, e) => sum + entryDurationMs(e, nowMs), 0);
}

/**
 * Per-category totals for the Time tab sub-line, largest first with
 * uncategorised pinned last (it is a gap to fill in, not a category, so
 * it should not compete for the eye's first stop).
 */
export function sumByCategory(
  entries: TimeEntry[],
  nowMs = Date.now(),
): { label: string; ms: number }[] {
  const buckets = new Map<string, number>();
  for (const e of entries) {
    const label = e.category_name ?? UNCATEGORISED_LABEL;
    buckets.set(label, (buckets.get(label) ?? 0) + entryDurationMs(e, nowMs));
  }
  return [...buckets.entries()]
    .map(([label, ms]) => ({ label, ms }))
    .sort((a, b) => {
      if (a.label === UNCATEGORISED_LABEL) return 1;
      if (b.label === UNCATEGORISED_LABEL) return -1;
      return b.ms - a.ms;
    });
}
```

- [ ] **Step 5: Run the tests and make sure they pass**

Run: `npx vitest run --project unit tests/unit/lib/time-tracking/format.test.ts`
Expected: PASS, all cases green.

- [ ] **Step 6: Commit**

```bash
git add types/time-tracking.ts lib/time-tracking/format.ts tests/unit/lib/time-tracking/format.test.ts
git commit -m "feat(time): add time-tracking domain types and duration helpers"
```

---

### Task 3: Server actions

**Files:**
- Create: `app/(dashboard)/couples/time-actions.ts`
- Test: `tests/integration/couples/time-actions.test.ts`

**Interfaces:**
- Consumes: `TimeEntry`, `TimeCategory`, `RunningTimer`, `TIMER_CAP_MS`, `capReachedAt`, `isOverCap` from Task 2.
- Produces (every action returns `ActionResult<T>` = `{ ok: true; data: T } | { ok: false; error: string }`):
  - `getRunningTimerAction(): Promise<ActionResult<RunningTimer | null>>`
  - `startCoupleTimerAction(coupleId: string): Promise<ActionResult<{ started: TimeEntry; stopped: { entry: TimeEntry; couple_name: string } | null }>>`
  - `stopCoupleTimerAction(): Promise<ActionResult<{ entry: TimeEntry; couple_name: string } | null>>`
  - `listCoupleTimeEntriesAction(coupleId: string): Promise<ActionResult<TimeEntry[]>>`
  - `createCoupleTimeEntryAction(input: { couple_id: string; started_at: string; ended_at: string; category_id?: string | null; note?: string | null }): Promise<ActionResult<TimeEntry>>`
  - `updateCoupleTimeEntryAction(input: { id: string; patch: { started_at?: string; ended_at?: string; category_id?: string | null; note?: string | null } }): Promise<ActionResult<TimeEntry>>`
  - `deleteCoupleTimeEntryAction(id: string): Promise<ActionResult<null>>`
  - `listTimeCategoriesAction(): Promise<ActionResult<TimeCategory[]>>`
  - `createTimeCategoryAction(name: string): Promise<ActionResult<TimeCategory>>`
  - `renameTimeCategoryAction(input: { id: string; name: string }): Promise<ActionResult<TimeCategory>>`
  - `deleteTimeCategoryAction(id: string): Promise<ActionResult<null>>`

Note on `ActionResult`: `app/(dashboard)/couples/actions.ts` already exports `ActionResult`, `ActionSuccess`, `ActionFailure`. Import `ActionResult` from `./actions` rather than redeclaring it.

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/couples/time-actions.test.ts`. It exercises the DB contract directly (RLS, the running-timer invariant, cascade, seeding) because server actions themselves need a request context; the action logic that matters here is expressed as the same queries the actions issue.

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * Coverage for the time-tracking tables behind the Couple Profile
 * Time tab:
 *
 *   1. RLS: a second user cannot read or write the first user's
 *      entries or categories (all four verbs).
 *   2. The partial unique index enforces one RUNNING entry per user
 *      while allowing many finished ones.
 *   3. Deleting a couple cascades its entries away.
 *   4. Deleting a category leaves its entries intact, uncategorised.
 *   5. The ends-after-start CHECK rejects an inverted range.
 */
describe('time tracking tables', () => {
  let mc: TestUser;
  let other: TestUser;
  let coupleId: string;
  let categoryId: string;

  beforeAll(async () => {
    mc = await createTestUser({}, {
      account_type: 'vendor',
      subscription_status: 'active',
      subscription_plan: 'pro',
    });
    other = await createTestUser({}, {
      account_type: 'vendor',
      subscription_status: 'active',
      subscription_plan: 'pro',
    });

    const { data: couple, error: coupleError } = await mc.client
      .from('couples')
      .insert({ user_id: mc.id, name: 'Timer Couple', status: 'new' })
      .select('id')
      .single();
    expect(coupleError).toBeNull();
    coupleId = couple!.id;

    const { data: category, error: categoryError } = await mc.client
      .from('time_categories')
      .insert({ user_id: mc.id, name: 'Meeting' })
      .select('id')
      .single();
    expect(categoryError).toBeNull();
    categoryId = category!.id;
  });

  afterAll(async () => {
    await mc?.cleanup();
    await other?.cleanup();
  });

  it('rejects a duplicate category name case-insensitively', async () => {
    const { error } = await mc.client
      .from('time_categories')
      .insert({ user_id: mc.id, name: 'meeting' });
    expect(error).not.toBeNull();
  });

  it('allows many finished entries for one user', async () => {
    const { error } = await mc.client.from('couple_time_entries').insert([
      {
        user_id: mc.id,
        couple_id: coupleId,
        started_at: '2026-07-28T00:00:00Z',
        ended_at: '2026-07-28T01:00:00Z',
        category_id: categoryId,
        note: 'Ceremony script',
      },
      {
        user_id: mc.id,
        couple_id: coupleId,
        started_at: '2026-07-29T00:00:00Z',
        ended_at: '2026-07-29T00:30:00Z',
        category_id: null,
        note: null,
      },
    ]);
    expect(error).toBeNull();
  });

  it('rejects an entry whose end precedes its start', async () => {
    const { error } = await mc.client.from('couple_time_entries').insert({
      user_id: mc.id,
      couple_id: coupleId,
      started_at: '2026-07-29T02:00:00Z',
      ended_at: '2026-07-29T01:00:00Z',
    });
    expect(error).not.toBeNull();
  });

  it('allows exactly one running entry per user', async () => {
    const first = await mc.client
      .from('couple_time_entries')
      .insert({
        user_id: mc.id,
        couple_id: coupleId,
        started_at: new Date().toISOString(),
        ended_at: null,
      })
      .select('id')
      .single();
    expect(first.error).toBeNull();

    const second = await mc.client.from('couple_time_entries').insert({
      user_id: mc.id,
      couple_id: coupleId,
      started_at: new Date().toISOString(),
      ended_at: null,
    });
    expect(second.error).not.toBeNull();

    // Stopping the first frees the slot again.
    const stopped = await mc.client
      .from('couple_time_entries')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', first.data!.id);
    expect(stopped.error).toBeNull();

    const third = await mc.client.from('couple_time_entries').insert({
      user_id: mc.id,
      couple_id: coupleId,
      started_at: new Date().toISOString(),
      ended_at: null,
    });
    expect(third.error).toBeNull();
  });

  it('RLS: another user cannot SELECT the entries', async () => {
    const { data, error } = await other.client
      .from('couple_time_entries')
      .select('id');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('RLS: another user cannot SELECT the categories', async () => {
    const { data } = await other.client.from('time_categories').select('id');
    expect(data).toEqual([]);
  });

  it('RLS: another user cannot INSERT an entry against this couple', async () => {
    const { error } = await other.client.from('couple_time_entries').insert({
      user_id: other.id,
      couple_id: coupleId,
      started_at: '2026-07-30T00:00:00Z',
      ended_at: '2026-07-30T00:10:00Z',
    });
    // The couple belongs to `mc`, so the FK is visible but the row is
    // not theirs to own; either the policy or the FK must refuse it.
    expect(error).not.toBeNull();
  });

  it('RLS: another user cannot UPDATE or DELETE the entries', async () => {
    const { data: mine } = await mc.client
      .from('couple_time_entries')
      .select('id')
      .limit(1);
    const targetId = mine![0]!.id;

    const updated = await other.client
      .from('couple_time_entries')
      .update({ note: 'hijacked' })
      .eq('id', targetId)
      .select('id');
    expect(updated.data).toEqual([]);

    const deleted = await other.client
      .from('couple_time_entries')
      .delete()
      .eq('id', targetId)
      .select('id');
    expect(deleted.data).toEqual([]);

    const { data: still } = await mc.client
      .from('couple_time_entries')
      .select('id, note')
      .eq('id', targetId)
      .single();
    expect(still?.note).not.toBe('hijacked');
  });

  it('deleting a category leaves its entries, uncategorised', async () => {
    const { error } = await mc.client
      .from('time_categories')
      .delete()
      .eq('id', categoryId);
    expect(error).toBeNull();

    const { data } = await mc.client
      .from('couple_time_entries')
      .select('id, category_id, note')
      .eq('note', 'Ceremony script')
      .single();
    expect(data?.category_id).toBeNull();
  });

  it('deleting the couple cascades its entries away', async () => {
    const { error } = await mc.client
      .from('couples')
      .delete()
      .eq('id', coupleId);
    expect(error).toBeNull();

    const svc = serviceClient();
    const { data } = await svc
      .from('couple_time_entries')
      .select('id')
      .eq('couple_id', coupleId);
    expect(data).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx supabase status >/dev/null || npx supabase start
npx vitest run --project integration tests/integration/couples/time-actions.test.ts
```

Expected: FAIL. If the tables are missing it fails on the first insert. If every test reports as *skipped* instead, the local DML grants are broken: apply the grant-repair SQL (grant all DML on all tables and sequences plus execute on all functions in `public` to `anon`, `authenticated`, `service_role`; fix `alter default privileges for role postgres`; then re-revoke `_user_branding`, `_user_branding_blocks`, and `emit_automation_event`).

- [ ] **Step 3: Write the actions file**

Create `app/(dashboard)/couples/time-actions.ts`:

```ts
/**
 * Server actions for per-couple time tracking.
 *
 * Every action is Zod-validated, runs on the RLS-scoped Supabase client
 * (never the service-role key), and returns the couples surface's tagged
 * `ActionResult`, so the React Query mutation wrapper in
 * `components/time-tracking/use-timer.ts` can pattern-match and the
 * provider-level `onError` Slack alert fires on failure.
 *
 * The single running timer is expressed as a row with `ended_at is null`,
 * guarded by a partial unique index, so "start" is an atomic
 * stop-then-insert rather than a client-side invariant.
 *
 * @module app/(dashboard)/couples/time-actions
 */
'use server';

import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { createClient } from '@/lib/supabase/server';
import { capReachedAt, isOverCap } from '@/lib/time-tracking/format';
import type {
  RunningTimer,
  TimeCategory,
  TimeEntry,
} from '@/types/time-tracking';

import type { ActionResult } from './actions';

/** Columns every entry read selects, including the flattened category. */
const ENTRY_SELECT =
  'id, couple_id, started_at, ended_at, category_id, note, auto_stopped, time_categories(name)';

/** Shape PostgREST returns for {@link ENTRY_SELECT}. */
interface EntryRow {
  id: string;
  couple_id: string;
  started_at: string;
  ended_at: string | null;
  category_id: string | null;
  note: string | null;
  auto_stopped: boolean;
  time_categories: { name: string } | { name: string }[] | null;
}

/**
 * Flatten a joined row into the app-facing {@link TimeEntry}. PostgREST
 * types an embedded to-one relation as either an object or a one-element
 * array depending on how it infers the relationship, so normalise both.
 */
function toEntry(row: EntryRow): TimeEntry {
  const joined = Array.isArray(row.time_categories)
    ? row.time_categories[0]
    : row.time_categories;
  return {
    id: row.id,
    couple_id: row.couple_id,
    started_at: row.started_at,
    ended_at: row.ended_at,
    category_id: row.category_id,
    category_name: joined?.name ?? null,
    note: row.note,
    auto_stopped: row.auto_stopped,
  };
}

const uuid = z.uuid();
const noteSchema = z.string().trim().max(2000).nullable().optional();
const categoryName = z.string().trim().min(1, 'Name is required').max(40);

const createEntrySchema = z
  .object({
    couple_id: uuid,
    started_at: z.string().datetime(),
    ended_at: z.string().datetime(),
    category_id: uuid.nullable().optional(),
    note: noteSchema,
  })
  .refine((v) => Date.parse(v.ended_at) > Date.parse(v.started_at), {
    message: 'End must be after start',
    path: ['ended_at'],
  })
  .refine((v) => Date.parse(v.started_at) <= Date.now(), {
    message: 'Start cannot be in the future',
    path: ['started_at'],
  })
  .refine(
    (v) => Date.parse(v.ended_at) - Date.parse(v.started_at) <= 24 * 3_600_000,
    { message: 'A single entry cannot exceed 24 hours', path: ['ended_at'] },
  );

const updateEntrySchema = z.object({
  id: uuid,
  patch: z
    .object({
      started_at: z.string().datetime().optional(),
      ended_at: z.string().datetime().optional(),
      category_id: uuid.nullable().optional(),
      note: noteSchema,
    })
    .refine((p) => Object.keys(p).length > 0, {
      message: 'Patch must contain at least one field',
    }),
});

export type CreateTimeEntryInput = z.input<typeof createEntrySchema>;
export type UpdateTimeEntryInput = z.input<typeof updateEntrySchema>;

/** Resolve the signed-in user, or a tagged failure. */
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/**
 * The user's running session, or null.
 *
 * This read is also where the 8h cap is enforced: a session older than
 * the cap is clamped to `started_at + 8h`, flagged `auto_stopped`, and
 * reported as "nothing running". Doing it here rather than in a cron
 * keeps the behaviour identical (a capped session is only ever observed
 * as capped) with no scheduled infrastructure to own.
 */
export async function getRunningTimerAction(): Promise<
  ActionResult<RunningTimer | null>
> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('couple_time_entries')
    .select(`${ENTRY_SELECT}, couples(name)`)
    .is('ended_at', null)
    .maybeSingle();

  if (error) {
    logger.error('[couples/time-actions] getRunningTimerAction failed', error, {
      userId: user.id,
    });
    return { ok: false, error: 'Could not read the running timer.' };
  }
  if (!data) return { ok: true, data: null };

  const row = data as unknown as EntryRow & {
    couples: { name: string } | { name: string }[] | null;
  };

  if (isOverCap(row.started_at, Date.now())) {
    const { error: capError } = await supabase
      .from('couple_time_entries')
      .update({ ended_at: capReachedAt(row.started_at), auto_stopped: true })
      .eq('id', row.id);
    if (capError) {
      logger.error('[couples/time-actions] cap clamp failed', capError, {
        userId: user.id,
        entryId: row.id,
      });
    }
    return { ok: true, data: null };
  }

  const couple = Array.isArray(row.couples) ? row.couples[0] : row.couples;
  return {
    ok: true,
    data: {
      entry: toEntry(row),
      couple_name: couple?.name ?? 'Couple',
      server_now: new Date().toISOString(),
    },
  };
}

/**
 * Stop whatever is running (if anything) and start a new session on
 * `coupleId`. The stopped session is returned so the caller can offer
 * its note dialog: switching couples must not silently swallow the
 * chance to annotate the work just finished.
 */
export async function startCoupleTimerAction(coupleId: string): Promise<
  ActionResult<{
    started: TimeEntry;
    stopped: { entry: TimeEntry; couple_name: string } | null;
  }>
> {
  if (!uuid.safeParse(coupleId).success) {
    return { ok: false, error: 'Invalid couple.' };
  }
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const previous = await stopCoupleTimerAction();
  if (!previous.ok) return { ok: false, error: previous.error };

  const { data, error } = await supabase
    .from('couple_time_entries')
    .insert({
      user_id: user.id,
      couple_id: coupleId,
      started_at: new Date().toISOString(),
    })
    .select(ENTRY_SELECT)
    .single();

  if (error || !data) {
    logger.error('[couples/time-actions] startCoupleTimerAction failed', error, {
      userId: user.id,
      coupleId,
    });
    return { ok: false, error: 'Could not start the timer.' };
  }

  return {
    ok: true,
    data: {
      started: toEntry(data as unknown as EntryRow),
      stopped: previous.data,
    },
  };
}

/** Stop the user's running session, returning it (or null if none ran). */
export async function stopCoupleTimerAction(): Promise<
  ActionResult<{ entry: TimeEntry; couple_name: string } | null>
> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('couple_time_entries')
    .update({ ended_at: new Date().toISOString() })
    .is('ended_at', null)
    .select(`${ENTRY_SELECT}, couples(name)`)
    .maybeSingle();

  if (error) {
    logger.error('[couples/time-actions] stopCoupleTimerAction failed', error, {
      userId: user.id,
    });
    return { ok: false, error: 'Could not stop the timer.' };
  }
  if (!data) return { ok: true, data: null };

  const row = data as unknown as EntryRow & {
    couples: { name: string } | { name: string }[] | null;
  };
  const couple = Array.isArray(row.couples) ? row.couples[0] : row.couples;
  return {
    ok: true,
    data: { entry: toEntry(row), couple_name: couple?.name ?? 'Couple' },
  };
}

/** One couple's sessions, newest first. */
export async function listCoupleTimeEntriesAction(
  coupleId: string,
): Promise<ActionResult<TimeEntry[]>> {
  if (!uuid.safeParse(coupleId).success) {
    return { ok: false, error: 'Invalid couple.' };
  }
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('couple_time_entries')
    .select(ENTRY_SELECT)
    .eq('couple_id', coupleId)
    .order('started_at', { ascending: false });

  if (error || !data) {
    logger.error('[couples/time-actions] listCoupleTimeEntriesAction failed', error, {
      userId: user.id,
      coupleId,
    });
    return { ok: false, error: 'Could not load tracked time.' };
  }
  return { ok: true, data: (data as unknown as EntryRow[]).map(toEntry) };
}

/** Log a session that was never timed live. */
export async function createCoupleTimeEntryAction(
  input: CreateTimeEntryInput,
): Promise<ActionResult<TimeEntry>> {
  const parsed = createEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid entry.' };
  }
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('couple_time_entries')
    .insert({
      user_id: user.id,
      couple_id: parsed.data.couple_id,
      started_at: parsed.data.started_at,
      ended_at: parsed.data.ended_at,
      category_id: parsed.data.category_id ?? null,
      note: parsed.data.note ?? null,
    })
    .select(ENTRY_SELECT)
    .single();

  if (error || !data) {
    logger.error('[couples/time-actions] createCoupleTimeEntryAction failed', error, {
      userId: user.id,
    });
    return { ok: false, error: 'Could not add the entry.' };
  }
  return { ok: true, data: toEntry(data as unknown as EntryRow) };
}

/** Patch one session: its times, its category, or its note. */
export async function updateCoupleTimeEntryAction(
  input: UpdateTimeEntryInput,
): Promise<ActionResult<TimeEntry>> {
  const parsed = updateEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid patch.' };
  }
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('couple_time_entries')
    .update(parsed.data.patch)
    .eq('id', parsed.data.id)
    .select(ENTRY_SELECT)
    .single();

  if (error || !data) {
    logger.error('[couples/time-actions] updateCoupleTimeEntryAction failed', error, {
      userId: user.id,
      entryId: parsed.data.id,
    });
    return { ok: false, error: 'Could not save the entry.' };
  }
  return { ok: true, data: toEntry(data as unknown as EntryRow) };
}

/** Delete one session. */
export async function deleteCoupleTimeEntryAction(
  id: string,
): Promise<ActionResult<null>> {
  if (!uuid.safeParse(id).success) return { ok: false, error: 'Invalid entry.' };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('couple_time_entries')
    .delete()
    .eq('id', id);
  if (error) {
    logger.error('[couples/time-actions] deleteCoupleTimeEntryAction failed', error, {
      userId: user.id,
      entryId: id,
    });
    return { ok: false, error: 'Could not delete the entry.' };
  }
  return { ok: true, data: null };
}

/** The six categories every user starts with, in display order. */
const STARTER_CATEGORIES = [
  'Meeting',
  'Call',
  'Admin',
  'Travel',
  'Rehearsal',
  'Ceremony',
] as const;

/**
 * The user's categories, seeding the starter set exactly once.
 *
 * The `time_categories_seeded` flag is what makes it "once": keying off
 * an empty table instead would resurrect the starter six for a user who
 * had deliberately deleted them all.
 */
export async function listTimeCategoriesAction(): Promise<
  ActionResult<TimeCategory[]>
> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data: settings } = await supabase
    .from('user_public_settings')
    .select('time_categories_seeded')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!settings?.time_categories_seeded) {
    const { error: seedError } = await supabase.from('time_categories').insert(
      STARTER_CATEGORIES.map((name, position) => ({
        user_id: user.id,
        name,
        position,
      })),
    );
    // A duplicate-name collision here means a concurrent seed already
    // ran; that is fine, the flag write below still closes the door.
    if (seedError) {
      logger.error('[couples/time-actions] category seed failed', seedError, {
        userId: user.id,
      });
    }
    await supabase
      .from('user_public_settings')
      .upsert(
        { user_id: user.id, time_categories_seeded: true },
        { onConflict: 'user_id' },
      );
  }

  const { data, error } = await supabase
    .from('time_categories')
    .select('id, name, position')
    .order('position', { ascending: true });

  if (error || !data) {
    logger.error('[couples/time-actions] listTimeCategoriesAction failed', error, {
      userId: user.id,
    });
    return { ok: false, error: 'Could not load categories.' };
  }
  return { ok: true, data };
}

/**
 * Create a category, or return the existing one when the name already
 * exists (case-insensitively). Type-to-create must never fail just
 * because the MC retyped something they already have.
 */
export async function createTimeCategoryAction(
  name: string,
): Promise<ActionResult<TimeCategory>> {
  const parsed = categoryName.safeParse(name);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid name.' };
  }
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data: existing } = await supabase
    .from('time_categories')
    .select('id, name, position')
    .ilike('name', parsed.data)
    .maybeSingle();
  if (existing) return { ok: true, data: existing };

  // Position is computed server-side so two concurrent creates cannot
  // collide on a stale client-side max.
  const { data: last } = await supabase
    .from('time_categories')
    .select('position')
    .order('position', { ascending: false })
    .limit(1);
  const position = last && last.length > 0 ? (last[0]?.position ?? 0) + 1 : 0;

  const { data, error } = await supabase
    .from('time_categories')
    .insert({ user_id: user.id, name: parsed.data, position })
    .select('id, name, position')
    .single();

  if (error || !data) {
    logger.error('[couples/time-actions] createTimeCategoryAction failed', error, {
      userId: user.id,
    });
    return { ok: false, error: 'Could not create the category.' };
  }
  return { ok: true, data };
}

/** Rename one category. */
export async function renameTimeCategoryAction(input: {
  id: string;
  name: string;
}): Promise<ActionResult<TimeCategory>> {
  const parsed = z.object({ id: uuid, name: categoryName }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid name.' };
  }
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('time_categories')
    .update({ name: parsed.data.name })
    .eq('id', parsed.data.id)
    .select('id, name, position')
    .single();

  if (error || !data) {
    logger.error('[couples/time-actions] renameTimeCategoryAction failed', error, {
      userId: user.id,
      categoryId: parsed.data.id,
    });
    return { ok: false, error: 'Could not rename the category.' };
  }
  return { ok: true, data };
}

/**
 * Delete one category. Sessions that referenced it survive and read as
 * uncategorised (`on delete set null`): deleting a label must never
 * destroy tracked time.
 */
export async function deleteTimeCategoryAction(
  id: string,
): Promise<ActionResult<null>> {
  if (!uuid.safeParse(id).success) {
    return { ok: false, error: 'Invalid category.' };
  }
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase.from('time_categories').delete().eq('id', id);
  if (error) {
    logger.error('[couples/time-actions] deleteTimeCategoryAction failed', error, {
      userId: user.id,
      categoryId: id,
    });
    return { ok: false, error: 'Could not delete the category.' };
  }
  return { ok: true, data: null };
}
```

- [ ] **Step 4: Run the integration tests and make sure they pass**

Run: `npx vitest run --project integration tests/integration/couples/time-actions.test.ts`
Expected: PASS, every case green. A failure here is a schema or policy bug: fix the migration (add a new migration file if the first is already pushed), never weaken the test.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck && npm run typecheck:strict`
Expected: `typecheck` 0 errors. `typecheck:strict` must show no new errors attributable to the new files.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/couples/time-actions.ts" tests/integration/couples/time-actions.test.ts
git commit -m "feat(time): add time-tracking server actions with RLS coverage"
```

---

### Task 4: Category picker

**Files:**
- Create: `components/time-tracking/time-category-picker.tsx`
- Create: `components/time-tracking/use-time-categories.ts`
- Test: `tests/unit/components/time-tracking/time-category-picker.test.tsx`

**Interfaces:**
- Consumes: `listTimeCategoriesAction`, `createTimeCategoryAction`, `renameTimeCategoryAction`, `deleteTimeCategoryAction` (Task 3); `TimeCategory` (Task 2).
- Produces:
  - `useTimeCategories(): { categories: TimeCategory[]; isLoading: boolean; create: (name: string) => Promise<TimeCategory | null>; rename: (id: string, name: string) => void; remove: (id: string) => void }`
  - `TimeCategoryPicker({ value, onChange }: { value: string | null; onChange: (categoryId: string | null) => void })`

Interaction model, mirroring `app/(dashboard)/tasks/task-cells.tsx` `TaskTypeCell` minus the colour rows: a Radix `Popover` whose trigger shows the selected chip or a "Add category" placeholder; the content has a filter `Input` at the top, matching rows below, a `Create "<typed>"` row when nothing matches exactly, a "Clear" row when a value is set, and per-row rename/delete affordances.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/time-tracking/time-category-picker.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TimeCategoryPicker } from '@/components/time-tracking/time-category-picker';

const listMock = vi.fn();
const createMock = vi.fn();
const renameMock = vi.fn();
const deleteMock = vi.fn();

vi.mock('@/app/(dashboard)/couples/time-actions', () => ({
  listTimeCategoriesAction: () => listMock(),
  createTimeCategoryAction: (name: string) => createMock(name),
  renameTimeCategoryAction: (input: { id: string; name: string }) =>
    renameMock(input),
  deleteTimeCategoryAction: (id: string) => deleteMock(id),
}));

function renderPicker(props: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TimeCategoryPicker {...props} />
    </QueryClientProvider>,
  );
}

describe('TimeCategoryPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue({
      ok: true,
      data: [
        { id: 'cat-1', name: 'Meeting', position: 0 },
        { id: 'cat-2', name: 'Travel', position: 1 },
      ],
    });
  });

  it('lists the user categories when opened', async () => {
    renderPicker({ value: null, onChange: vi.fn() });
    await userEvent.click(screen.getByRole('button', { name: /category/i }));
    expect(await screen.findByText('Meeting')).toBeInTheDocument();
    expect(screen.getByText('Travel')).toBeInTheDocument();
  });

  it('selecting a category reports its id', async () => {
    const onChange = vi.fn();
    renderPicker({ value: null, onChange });
    await userEvent.click(screen.getByRole('button', { name: /category/i }));
    await userEvent.click(await screen.findByText('Travel'));
    expect(onChange).toHaveBeenCalledWith('cat-2');
  });

  it('filters as you type', async () => {
    renderPicker({ value: null, onChange: vi.fn() });
    await userEvent.click(screen.getByRole('button', { name: /category/i }));
    await userEvent.type(await screen.findByPlaceholderText(/search/i), 'trav');
    expect(screen.getByText('Travel')).toBeInTheDocument();
    expect(screen.queryByText('Meeting')).not.toBeInTheDocument();
  });

  it('offers Create for an unmatched name and selects the new category', async () => {
    createMock.mockResolvedValue({
      ok: true,
      data: { id: 'cat-3', name: 'Vows', position: 2 },
    });
    const onChange = vi.fn();
    renderPicker({ value: null, onChange });
    await userEvent.click(screen.getByRole('button', { name: /category/i }));
    await userEvent.type(await screen.findByPlaceholderText(/search/i), 'Vows');
    await userEvent.click(screen.getByRole('button', { name: /create "vows"/i }));
    await waitFor(() => expect(createMock).toHaveBeenCalledWith('Vows'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('cat-3'));
  });

  it('does not offer Create when the typed name already exists', async () => {
    renderPicker({ value: null, onChange: vi.fn() });
    await userEvent.click(screen.getByRole('button', { name: /category/i }));
    await userEvent.type(
      await screen.findByPlaceholderText(/search/i),
      'meeting',
    );
    expect(
      screen.queryByRole('button', { name: /create "meeting"/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the selected category on the trigger', async () => {
    renderPicker({ value: 'cat-1', onChange: vi.fn() });
    expect(await screen.findByRole('button', { name: /meeting/i })).toBeInTheDocument();
  });

  it('clearing the selection reports null', async () => {
    const onChange = vi.fn();
    renderPicker({ value: 'cat-1', onChange });
    await userEvent.click(await screen.findByRole('button', { name: /meeting/i }));
    await userEvent.click(await screen.findByRole('button', { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('deleting a category calls the action', async () => {
    deleteMock.mockResolvedValue({ ok: true, data: null });
    renderPicker({ value: null, onChange: vi.fn() });
    await userEvent.click(screen.getByRole('button', { name: /category/i }));
    await userEvent.click(
      await screen.findByRole('button', { name: /delete meeting/i }),
    );
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith('cat-1'));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project unit tests/unit/components/time-tracking/time-category-picker.test.tsx`
Expected: FAIL, cannot resolve `@/components/time-tracking/time-category-picker`.

- [ ] **Step 3: Write the hook**

Create `components/time-tracking/use-time-categories.ts`:

```ts
/**
 * React Query access to the user's time categories.
 *
 * Reads and writes both go through the server actions so validation and
 * the seed-once rule live in one place. `create` resolves to the new (or
 * already-existing) category so the caller can select it immediately,
 * which is what makes type-to-create feel instant.
 *
 * @module components/time-tracking/use-time-categories
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createTimeCategoryAction,
  deleteTimeCategoryAction,
  listTimeCategoriesAction,
  renameTimeCategoryAction,
} from '@/app/(dashboard)/couples/time-actions';
import type { TimeCategory } from '@/types/time-tracking';

/** Query key for the category list. */
export const TIME_CATEGORIES_KEY = ['time-categories'] as const;

export function useTimeCategories() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: TIME_CATEGORIES_KEY,
    queryFn: async (): Promise<TimeCategory[]> => {
      const result = await listTimeCategoriesAction();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: TIME_CATEGORIES_KEY });

  const createMutation = useMutation({
    mutationFn: async (name: string): Promise<TimeCategory> => {
      const result = await createTimeCategoryAction(name);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: invalidate,
  });

  const renameMutation = useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const result = await renameTimeCategoryAction(input);
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteTimeCategoryAction(id);
      if (!result.ok) throw new Error(result.error);
    },
    // Entries keep their history and read as uncategorised, so every
    // couple's entry list has to be refetched too.
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['couple-time-entries'] });
    },
  });

  return {
    categories: data ?? [],
    isLoading,
    create: async (name: string): Promise<TimeCategory | null> => {
      try {
        return await createMutation.mutateAsync(name);
      } catch {
        return null;
      }
    },
    rename: (id: string, name: string) => renameMutation.mutate({ id, name }),
    remove: (id: string) => removeMutation.mutate(id),
  };
}
```

- [ ] **Step 4: Write the picker**

Create `components/time-tracking/time-category-picker.tsx`. Requirements the test pins down:

- Trigger is a `button` whose accessible name is the selected category name, or contains "category" when nothing is selected (placeholder "Add category").
- Content contains an `Input` with placeholder "Search categories".
- Rows render `category.name` as clickable text; clicking calls `onChange(category.id)` and closes the popover.
- A `Create "<typed>"` button appears only when the trimmed query is non-empty and no category matches it case-insensitively. Clicking it awaits `create(query)` then calls `onChange(created.id)`.
- A "Clear" button appears only when `value` is non-null and calls `onChange(null)`.
- Each row carries a rename control (inline `Input` on click, commits on Enter or blur, calls `rename`) and a delete control whose accessible name is `Delete <name>` and which calls `remove`.
- Chips are plain: `rounded-lg bg-surface-emphasis px-2 py-0.5 text-caption text-text-muted`. No colours, per the locked decision.
- Keep the file under 150 lines: put the row (chip + rename input + delete button) in the same file only if it fits, otherwise extract `time-category-row.tsx`.

- [ ] **Step 5: Run the tests and make sure they pass**

Run: `npx vitest run --project unit tests/unit/components/time-tracking/time-category-picker.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/time-tracking tests/unit/components/time-tracking
git commit -m "feat(time): add type-to-create time category picker"
```

---

### Task 5: Timer provider, pill, and stop-note dialog

**Files:**
- Create: `components/time-tracking/use-timer.ts`
- Create: `components/time-tracking/timer-provider.tsx`
- Create: `components/time-tracking/timer-pill.tsx`
- Create: `components/time-tracking/stop-note-dialog.tsx`
- Modify: `app/(dashboard)/layout.tsx`
- Test: `tests/unit/components/time-tracking/timer-pill.test.tsx`

**Interfaces:**
- Consumes: `getRunningTimerAction`, `startCoupleTimerAction`, `stopCoupleTimerAction`, `updateCoupleTimeEntryAction` (Task 3); `formatElapsed`, `entryDurationMs` (Task 2); `TimeCategoryPicker` (Task 4).
- Produces:
  - `useRunningTimer(): { running: RunningTimer | null; clockOffsetMs: number; isLoading: boolean }`
  - `TimerProvider({ shadowing, children }: { shadowing: boolean; children: ReactNode })`
  - `useTimerSurface(): { shadowing: boolean; running: RunningTimer | null; clockOffsetMs: number; isRunningFor: (coupleId: string) => boolean; start: (coupleId: string) => void; stop: () => void; claimSurface: () => () => void }`
  - `TimerPill({ hidden }: { hidden: boolean })`
  - `StopNoteDialog({ pending, onClose }: { pending: { entry: TimeEntry; couple_name: string } | null; onClose: () => void })`

Ownership rule: the provider owns the start/stop mutations and the pending-note state, so any surface can start a timer and the note dialog always has somewhere to appear. `claimSurface()` increments a counter and returns its release function; the pill hides while the count is above zero, which is how the Couple Profile takes over the timer control while it is open.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/time-tracking/timer-pill.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TimerProvider } from '@/components/time-tracking/timer-provider';

const getRunningMock = vi.fn();
const stopMock = vi.fn();

vi.mock('@/app/(dashboard)/couples/time-actions', () => ({
  getRunningTimerAction: () => getRunningMock(),
  startCoupleTimerAction: vi.fn(),
  stopCoupleTimerAction: () => stopMock(),
  updateCoupleTimeEntryAction: vi.fn(),
  listTimeCategoriesAction: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  createTimeCategoryAction: vi.fn(),
  renameTimeCategoryAction: vi.fn(),
  deleteTimeCategoryAction: vi.fn(),
}));

const START = '2026-07-30T02:00:00.000Z';
const NOW = '2026-07-30T02:12:47.000Z';

function runningPayload() {
  return {
    ok: true,
    data: {
      entry: {
        id: 'entry-1',
        couple_id: 'couple-1',
        started_at: START,
        ended_at: null,
        category_id: null,
        category_name: null,
        note: null,
        auto_stopped: false,
      },
      couple_name: 'Sarah & Tom',
      server_now: NOW,
    },
  };
}

function renderProvider(shadowing = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TimerProvider shadowing={shadowing}>
        <div>page</div>
      </TimerProvider>
    </QueryClientProvider>,
  );
}

describe('TimerPill via TimerProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when no timer is running', async () => {
    getRunningMock.mockResolvedValue({ ok: true, data: null });
    renderProvider();
    expect(await screen.findByText('page')).toBeInTheDocument();
    expect(screen.queryByTestId('timer-pill')).not.toBeInTheDocument();
  });

  it('shows the couple name and elapsed time while running', async () => {
    getRunningMock.mockResolvedValue(runningPayload());
    renderProvider();
    expect(await screen.findByTestId('timer-pill')).toBeInTheDocument();
    expect(screen.getByText('Sarah & Tom')).toBeInTheDocument();
    expect(screen.getByText('00:12:47')).toBeInTheDocument();
  });

  it('ticks forward every second', async () => {
    getRunningMock.mockResolvedValue(runningPayload());
    renderProvider();
    await screen.findByText('00:12:47');
    await vi.advanceTimersByTimeAsync(2000);
    expect(screen.getByText('00:12:49')).toBeInTheDocument();
  });

  it('stopping calls the stop action', async () => {
    getRunningMock.mockResolvedValue(runningPayload());
    stopMock.mockResolvedValue({ ok: true, data: null });
    renderProvider();
    await userEvent.click(
      await screen.findByRole('button', { name: /stop timing/i }),
    );
    expect(stopMock).toHaveBeenCalled();
  });

  it('renders nothing in shadow mode even with a running timer', async () => {
    getRunningMock.mockResolvedValue(runningPayload());
    renderProvider(true);
    expect(await screen.findByText('page')).toBeInTheDocument();
    expect(screen.queryByTestId('timer-pill')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project unit tests/unit/components/time-tracking/timer-pill.test.tsx`
Expected: FAIL, cannot resolve `@/components/time-tracking/timer-provider`.

- [ ] **Step 3: Write the running-timer hook**

Create `components/time-tracking/use-timer.ts`:

```ts
/**
 * React Query access to the user's single running timer.
 *
 * The hook also derives a clock offset: elapsed time is measured
 * against the server's clock (`server_now` at read time) rather than the
 * device's, so a phone with a skewed clock cannot show a wrong or
 * negative duration.
 *
 * `refetchOnWindowFocus` matters here: the timer may have been stopped
 * on another device, and coming back to the tab should reconcile.
 *
 * @module components/time-tracking/use-timer
 */
'use client';

import { useQuery } from '@tanstack/react-query';

import { getRunningTimerAction } from '@/app/(dashboard)/couples/time-actions';
import type { RunningTimer } from '@/types/time-tracking';

/** Query key for the running timer. */
export const RUNNING_TIMER_KEY = ['running-timer'] as const;

export function useRunningTimer(enabled: boolean) {
  const { data, isLoading } = useQuery({
    queryKey: RUNNING_TIMER_KEY,
    enabled,
    // The row is the source of truth and other devices can change it,
    // so never serve it from a stale cache.
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<{
      running: RunningTimer | null;
      clockOffsetMs: number;
    }> => {
      const result = await getRunningTimerAction();
      if (!result.ok) throw new Error(result.error);
      if (!result.data) return { running: null, clockOffsetMs: 0 };
      return {
        running: result.data,
        clockOffsetMs: Date.parse(result.data.server_now) - Date.now(),
      };
    },
  });

  return {
    running: data?.running ?? null,
    clockOffsetMs: data?.clockOffsetMs ?? 0,
    isLoading,
  };
}
```

- [ ] **Step 4: Write the provider**

Create `components/time-tracking/timer-provider.tsx`. Contract:

- Client component. Props `{ shadowing: boolean; children: ReactNode }`.
- Calls `useRunningTimer(!shadowing)`, so shadow sessions issue no timer reads at all.
- Holds `pending: { entry; couple_name } | null` for the stop-note dialog, and `claims: number`.
- `start(coupleId)`: mutation on `startCoupleTimerAction`; on success invalidates `RUNNING_TIMER_KEY` plus `['couple-time-entries', coupleId]`, and if `data.stopped` is non-null sets `pending` to it and toasts `Stopped timing ${stopped.couple_name}`. Starting while shadowing is a no-op.
- `stop()`: mutation on `stopCoupleTimerAction`; on success invalidates the same keys (use `data.entry.couple_id` for the entry list) and sets `pending` to the stopped session.
- `isRunningFor(coupleId)` compares against `running?.entry.couple_id`.
- `claimSurface()` increments `claims` and returns a release function that decrements it. Use a counter, not a boolean, so two nested surfaces cannot release each other's claim.
- Renders `{children}`, then `<TimerPill hidden={claims > 0} />`, then `<StopNoteDialog pending={pending} onClose={() => setPending(null)} />`.
- Exports `useTimerSurface()`, which throws a clear error when used outside the provider.
- Context value must be memoised so consumers do not re-render every tick.

- [ ] **Step 5: Write the pill**

Create `components/time-tracking/timer-pill.tsx`. Contract:

- Reads `useTimerSurface()`. Returns `null` when `shadowing`, when there is no running timer, or when `hidden`.
- Owns the only `setInterval(1000)`; it exists solely to force a re-render, elapsed is always recomputed from `entryDurationMs(entry, Date.now() + clockOffsetMs)`.
- Root: `data-testid="timer-pill"`, `fixed right-3 top-16 z-[90] md:top-3` (mobile clears the 56px top bar), `flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 shadow-lg`.
- Contents: `Timer` icon (`size={14} strokeWidth={1.5}`), couple name (`truncate max-w-[10rem] text-caption text-text`), elapsed in `font-mono text-body text-text tabular-nums`, and a Stop `Button` (`size="sm" variant="secondary"`) whose accessible name is "Stop timing".
- Clean the interval up on unmount.

- [ ] **Step 6: Write the stop-note dialog**

Create `components/time-tracking/stop-note-dialog.tsx`. Contract:

- Props `{ pending, onClose }`. Renders the `Modal` primitive with `size="sm"`, `isOpen={Boolean(pending)}`.
- Title: `Stopped · <duration> · <couple_name>` using `formatDuration(entryDurationMs(entry, Date.now()))`. Note: use a middot, not an em dash.
- Body: a "What did you work on?" `textarea` (`rows={3}`) plus `<TimeCategoryPicker>`.
- Footer: "Skip" (`variant="ghost"`, just `onClose`) and "Save" (`variant="primary"`), which calls `updateCoupleTimeEntryAction({ id, patch: { note, category_id } })`, invalidates `['couple-time-entries', entry.couple_id]`, toasts "Time saved", and closes.
- Local note/category state resets whenever `pending?.entry.id` changes, so a second stop never inherits the first one's text.
- Both fields are optional; Save with both empty is allowed and simply closes.

- [ ] **Step 7: Mount the provider in the dashboard layout**

Modify `app/(dashboard)/layout.tsx`. It is a server component, so it can read the shadow cookie directly, the same signal `ShadowBanner` uses:

```tsx
import { cookies } from 'next/headers';

import { ShadowBanner } from '@/app/components/shadow-banner';
import { SidebarLayout } from '@/app/components/sidebar-layout';
import { TimerProvider } from '@/components/time-tracking/timer-provider';

import { WelcomeGate } from './onboarding/welcome-gate';

export default async function DashboardLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  // Shadow sessions must not be able to write time onto the MC's
  // timesheet, so the flag is resolved here (server-side, same cookie
  // ShadowBanner reads) and the provider hides every control.
  const cookieStore = await cookies();
  const shadowing = cookieStore.get('zebri_is_shadowing')?.value === '1';

  return (
    <SidebarLayout>
      <ShadowBanner />
      <WelcomeGate />
      <TimerProvider shadowing={shadowing}>
        <div className="flex-1 overflow-hidden min-h-0">{children}</div>
        {modal}
      </TimerProvider>
    </SidebarLayout>
  );
}
```

- [ ] **Step 8: Run the tests and make sure they pass**

Run: `npx vitest run --project unit tests/unit/components/time-tracking && npm run typecheck`
Expected: PASS and 0 typecheck errors.

- [ ] **Step 9: Commit**

```bash
git add components/time-tracking "app/(dashboard)/layout.tsx" tests/unit/components/time-tracking/timer-pill.test.tsx
git commit -m "feat(time): add timer provider, running pill and stop-note dialog"
```

---

### Task 6: Time tab

**Files:**
- Create: `app/(dashboard)/couples/couple-time.tsx`
- Create: `app/(dashboard)/couples/couple-time-row.tsx`
- Create: `app/(dashboard)/couples/couple-time-entry-modal.tsx`
- Create: `app/(dashboard)/couples/use-couple-time.ts`
- Modify: `app/(dashboard)/couples/couple-profile-types.ts`
- Modify: `app/(dashboard)/couples/couple-profile.tsx`
- Modify: `app/(dashboard)/couples/couple-profile-body.tsx`
- Test: `tests/unit/app/couples/couple-time.test.tsx`
- Test: extend the existing tab-derivation unit test if one exists for `couple-profile-tabs`, otherwise add `tests/unit/app/couples/couple-profile-tabs-time.test.ts`

**Interfaces:**
- Consumes: `listCoupleTimeEntriesAction`, `createCoupleTimeEntryAction`, `updateCoupleTimeEntryAction`, `deleteCoupleTimeEntryAction` (Task 3); `totalMs`, `sumByCategory`, `formatDuration`, `entryDurationMs` (Task 2); `TimeCategoryPicker` (Task 4); `CoupleTabShell`, `CoupleTabEmpty`, `tabStat` (existing).
- Produces:
  - `useCoupleTime(coupleId: string): { entries: TimeEntry[]; isLoading: boolean; isError: boolean; create: (input: CreateTimeEntryInput) => Promise<boolean>; update: (input: UpdateTimeEntryInput) => Promise<boolean>; remove: (id: string) => void }` with query key `['couple-time-entries', coupleId]`
  - `CoupleTime({ coupleId }: { coupleId: string })`
  - `CoupleTimeRow({ entry, onEdit, onDelete }: { entry: TimeEntry; onEdit: () => void; onDelete: () => void })`
  - `CoupleTimeEntryModal({ isOpen, onClose, coupleId, entry, onSaved }: { isOpen: boolean; onClose: () => void; coupleId: string; entry?: TimeEntry | undefined; onSaved: () => void })`
  - `'time'` added to `CoupleProfileSection` and `SECTION_KEYS`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/app/couples/couple-time.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoupleTime } from '@/app/(dashboard)/couples/couple-time';
import { SECTION_KEYS } from '@/app/(dashboard)/couples/couple-profile-types';
import { orderedTabKeys } from '@/app/(dashboard)/couples/couple-profile-tabs';

const listMock = vi.fn();

vi.mock('@/app/(dashboard)/couples/time-actions', () => ({
  listCoupleTimeEntriesAction: (id: string) => listMock(id),
  createCoupleTimeEntryAction: vi.fn(),
  updateCoupleTimeEntryAction: vi.fn(),
  deleteCoupleTimeEntryAction: vi.fn(),
  listTimeCategoriesAction: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  createTimeCategoryAction: vi.fn(),
  renameTimeCategoryAction: vi.fn(),
  deleteTimeCategoryAction: vi.fn(),
}));

function renderTab() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CoupleTime coupleId="couple-1" />
    </QueryClientProvider>,
  );
}

describe('CoupleTime', () => {
  beforeEach(() => vi.clearAllMocks());

  it('registers "time" as a profile tab key', () => {
    expect(SECTION_KEYS).toContain('time');
  });

  it('appends "time" to a stored tab order that predates it', () => {
    const keys = orderedTabKeys({ hidden_tabs: [], tab_order: ['overview', 'tasks'] });
    expect(keys).toContain('time');
  });

  it('shows the empty state when nothing is tracked', async () => {
    listMock.mockResolvedValue({ ok: true, data: [] });
    renderTab();
    expect(await screen.findByText(/no time tracked yet/i)).toBeInTheDocument();
  });

  it('shows an error state when the read fails', async () => {
    listMock.mockResolvedValue({ ok: false, error: 'boom' });
    renderTab();
    expect(await screen.findByText(/could not load tracked time/i)).toBeInTheDocument();
  });

  it('renders the total, the category breakdown and the rows', async () => {
    listMock.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'e1',
          couple_id: 'couple-1',
          started_at: '2026-07-30T02:00:00.000Z',
          ended_at: '2026-07-30T02:48:00.000Z',
          category_id: 'c1',
          category_name: 'Meeting',
          note: 'Venue walkthrough call',
          auto_stopped: false,
        },
        {
          id: 'e2',
          couple_id: 'couple-1',
          started_at: '2026-07-28T02:00:00.000Z',
          ended_at: '2026-07-28T03:15:00.000Z',
          category_id: null,
          category_name: null,
          note: null,
          auto_stopped: false,
        },
      ],
    });
    renderTab();
    expect(await screen.findByText('2h 3m')).toBeInTheDocument();
    expect(screen.getByText(/Meeting 48m/)).toBeInTheDocument();
    expect(screen.getByText(/Uncategorised 1h 15m/)).toBeInTheDocument();
    expect(screen.getByText('Venue walkthrough call')).toBeInTheDocument();
  });

  it('flags an auto-stopped session', async () => {
    listMock.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'e3',
          couple_id: 'couple-1',
          started_at: '2026-07-30T02:00:00.000Z',
          ended_at: '2026-07-30T10:00:00.000Z',
          category_id: null,
          category_name: null,
          note: null,
          auto_stopped: true,
        },
      ],
    });
    renderTab();
    expect(await screen.findByText(/auto-stopped/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project unit tests/unit/app/couples/couple-time.test.tsx`
Expected: FAIL, cannot resolve `couple-time` and `SECTION_KEYS` has no `'time'`.

- [ ] **Step 3: Register the tab**

In `app/(dashboard)/couples/couple-profile-types.ts`, add `| 'time'` to `CoupleProfileSection` and `'time'` to `SECTION_KEYS`, positioned directly after `'tasks'` in both. No other change is needed: `orderedTabKeys()` already appends keys missing from a stored order, so existing users pick the tab up at the end of their nav.

In `app/(dashboard)/couples/couple-profile.tsx`, add to `NAV_ITEMS` after the `tasks` entry:

```tsx
  {
    key: 'time',
    label: 'Time',
    icon: <Timer size={18} strokeWidth={1.5} />,
  },
```

Import `Timer` from `lucide-react`. Use `Timer`, not `Clock`: `Clock` is already the Timeline tab's icon and two identical icons in one nav is a usability bug.

In `app/(dashboard)/couples/couple-profile-body.tsx`, add the branch and its import:

```tsx
      {activeSection === 'time' && <CoupleTime coupleId={couple.id} />}
```

- [ ] **Step 4: Write the data hook**

Create `app/(dashboard)/couples/use-couple-time.ts`: a React Query hook keyed `['couple-time-entries', coupleId]` reading `listCoupleTimeEntriesAction`, with `create` / `update` / `remove` mutations that invalidate that key plus `['running-timer']` (editing a session cannot change what is running, but deleting the running one can). `create` and `update` resolve `true` on success and `false` on failure so the modal can keep itself open and show the error.

- [ ] **Step 5: Write the row**

Create `app/(dashboard)/couples/couple-time-row.tsx`: one session as a `group` flex row, matching the visual rhythm of `couple-tasks` rows (no bordered box-in-box, per the house style):

- Left: date (`toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })`), then `start → end` times (`toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })`), then the category chip or nothing, then the note on a second line in `text-text-muted`.
- Right: duration in `tabular-nums`, an "Auto-stopped" `text-caption text-danger` marker when `entry.auto_stopped`, and a `RowActionsMenu` with Edit and a destructive Delete.
- A running entry (`ended_at === null`) renders its end as "running" and has no `⋯`: it is stopped from the pill or the header, not edited mid-flight.

- [ ] **Step 6: Write the entry modal**

Create `app/(dashboard)/couples/couple-time-entry-modal.tsx`: `Modal size="sm"`, titled "Add time" or "Edit time". Fields: `DatePicker` for the date, two `Input type="time"` controls for start and end, `TimeCategoryPicker`, and a note textarea. Show the derived duration live under the time inputs via `formatDuration`. Combine date and time into an instant with `new Date(\`${date}T${time}\`).toISOString()`, which interprets the input in the viewer's timezone (the intended reading: an MC types the local time they worked). Save is disabled until date, start, and end are set and end is after start; a failed save keeps the modal open and renders the action's error message.

- [ ] **Step 7: Write the tab**

Create `app/(dashboard)/couples/couple-time.tsx`, an orchestrator only:

- `CoupleTabShell` with `title="Time"`, `stats` built from `formatDuration(totalMs(entries))` plus `sumByCategory(entries)` mapped to `` `${label} ${formatDuration(ms)}` ``, and `actions={<Button size="sm" onClick={openAdd}>Add time</Button>}`.
- Loading: a skeleton consistent with the other tabs. Empty: `<CoupleTabEmpty icon={Timer} title="No time tracked yet" description="Start the timer from the header, or add an entry manually." />`. Error: the copy `Could not load tracked time.` rendered through the shared `ErrorState` primitive.
- Rows mapped to `CoupleTimeRow`; a `ConfirmDialog` for delete; `CoupleTimeEntryModal` for add and edit.

- [ ] **Step 8: Run the tests and make sure they pass**

Run: `npx vitest run --project unit tests/unit/app/couples/couple-time.test.tsx && npm run typecheck`
Expected: PASS and 0 typecheck errors.

- [ ] **Step 9: Commit**

```bash
git add "app/(dashboard)/couples" tests/unit/app/couples/couple-time.test.tsx
git commit -m "feat(time): add couple profile Time tab with totals and manual entries"
```

---

### Task 7: Profile header clock

**Files:**
- Modify: `app/(dashboard)/couples/couple-profile-header.tsx`
- Modify: `app/(dashboard)/couples/couple-profile.tsx`
- Test: `tests/unit/app/couples/couple-profile-timer.test.tsx`

**Interfaces:**
- Consumes: `useTimerSurface` (Task 5).
- Produces: no new exports. `CoupleProfileHeader` gains the clock control; `CoupleProfile` claims the timer surface while it is open.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/app/couples/couple-profile-timer.test.tsx`. Mock `@/components/time-tracking/timer-provider` so `useTimerSurface` returns a controllable stub, render `CoupleProfileHeader` with a minimal `couple` and empty `statuses`, and assert:

```tsx
it('shows a Start timing control when nothing is running', () => {
  // useTimerSurface stub: { shadowing: false, running: null, isRunningFor: () => false, start, stop, claimSurface }
  expect(screen.getByRole('button', { name: /start timing/i })).toBeInTheDocument();
});

it('starting calls start with the couple id', async () => {
  await userEvent.click(screen.getByRole('button', { name: /start timing/i }));
  expect(start).toHaveBeenCalledWith('couple-1');
});

it('shows elapsed time and a stop control for this couple', () => {
  // stub isRunningFor: (id) => id === 'couple-1', running entry started 12m47s ago
  expect(screen.getByRole('button', { name: /stop timing/i })).toBeInTheDocument();
  expect(screen.getByText('00:12:47')).toBeInTheDocument();
});

it('names the other couple when the timer belongs elsewhere', () => {
  // stub running.couple_name = 'Alice & Ben', isRunningFor: () => false
  expect(screen.getByText(/Alice & Ben/)).toBeInTheDocument();
});

it('renders no timer control in shadow mode', () => {
  // stub shadowing: true
  expect(screen.queryByRole('button', { name: /timing/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project unit tests/unit/app/couples/couple-profile-timer.test.tsx`
Expected: FAIL, no timing control exists yet.

- [ ] **Step 3: Add the control to the header**

In `app/(dashboard)/couples/couple-profile-header.tsx`:

- Call `useTimerSurface()`. When `shadowing`, render no timer control at all.
- Desktop: insert a control into the inline action row, in the group next to the settings and delete buttons. Idle: a `Timer` icon button styled like its neighbours (`p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer`) wrapped in `Tooltip label="Start timing"`, `aria-label="Start timing"`. Running for this couple: the same button in the active treatment already used for settings mode (`bg-gray-100 text-gray-900`) with `00:12:47` beside it in `font-mono text-caption tabular-nums`, `aria-label="Stop timing"`. Running for another couple: the same active chip prefixed with that couple's name, truncated, still `aria-label="Stop timing"`.
- Mobile: add a matching row to the `⋯` overflow menu, above the portal-links divider, reading "Start timing" or "Stop timing (12:47)".
- The elapsed string comes from `formatElapsed(entryDurationMs(running.entry, Date.now() + clockOffsetMs))`. The header re-renders on the provider's tick; do **not** add a second `setInterval` here. If the provider does not already re-render consumers each second, expose its tick through the context value rather than starting a new interval.

- [ ] **Step 4: Claim the timer surface while the profile is open**

In `app/(dashboard)/couples/couple-profile.tsx`, claim the surface for as long as a couple is open, so the pill yields to the header (the pill would otherwise land on top of the overlay's close button):

```tsx
  // While the profile overlay is open it owns the timer control: the
  // pill is fixed to the viewport's top-right, which is exactly where
  // this overlay puts its close button.
  const { claimSurface } = useTimerSurface();
  useEffect(() => {
    if (!couple) return;
    return claimSurface();
  }, [couple, claimSurface]);
```

`claimSurface` must be stable (wrapped in `useCallback` in the provider) or this effect will thrash.

- [ ] **Step 5: Run the tests and make sure they pass**

Run: `npx vitest run --project unit tests/unit/app/couples && npm run typecheck`
Expected: PASS and 0 typecheck errors.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/couples/couple-profile-header.tsx" "app/(dashboard)/couples/couple-profile.tsx" tests/unit/app/couples/couple-profile-timer.test.tsx
git commit -m "feat(time): add start/stop clock to the couple profile header"
```

---

### Task 8: End-to-end coverage, docs, and gates

**Files:**
- Create: `tests/e2e/couple-time.spec.ts`
- Modify: `tests/e2e/helpers.ts` (add `startCoupleTimer` / `stopCoupleTimer` helpers)
- Modify: `.claude/docs/database-schema.md`
- Modify: `.claude/docs/page-specs.md`
- Modify: `.claude/docs/security.md`
- Modify: `.claude/docs/component-library.md`
- Modify: `.claude/docs/testing.md` (only if new selectors or helpers need documenting)

**Interfaces:**
- Consumes: everything from Tasks 1 to 7.
- Produces: no code exports.

Note on e2e targets: `npm run dev` points at the **remote** Supabase, which will not have this migration until CI deploys it. Run these specs against a dev server wired to local Supabase (the isolated-verification setup, `playwright.iso.config.ts`), or after the migration has been deployed.

- [ ] **Step 1: Write the e2e spec**

Create `tests/e2e/couple-time.spec.ts`, following the shape of `tests/e2e/couple-profile.spec.ts` (login, `addCouple`, `openCoupleProfile` in `beforeEach`; `deleteCouple` in `afterEach`):

```ts
test('start shows the pill, and it survives closing the profile', async ({ page }) => {
  await page.getByRole('button', { name: /start timing/i }).click();
  await expect(page.getByRole('button', { name: /stop timing/i })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('timer-pill')).toBeVisible();
  await expect(page.getByTestId('timer-pill')).toContainText(coupleName);
});

test('the running timer survives a reload', async ({ page }) => {
  await page.getByRole('button', { name: /start timing/i }).click();
  await page.keyboard.press('Escape');
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByTestId('timer-pill')).toBeVisible();
});

test('the pill survives navigating to another page', async ({ page }) => {
  await page.getByRole('button', { name: /start timing/i }).click();
  await page.keyboard.press('Escape');
  await page.goto('/tasks', { waitUntil: 'networkidle' });
  await expect(page.getByTestId('timer-pill')).toBeVisible();
});

test('stopping captures a note and a new category, which land in the Time tab', async ({ page }) => {
  await page.getByRole('button', { name: /start timing/i }).click();
  await page.keyboard.press('Escape');
  await page.getByTestId('timer-pill').getByRole('button', { name: /stop timing/i }).click();
  await page.getByPlaceholder(/what did you work on/i).fill('Venue walkthrough call');
  await page.getByRole('button', { name: /category/i }).click();
  await page.getByPlaceholder(/search categories/i).fill('Site visit');
  await page.getByRole('button', { name: /create "site visit"/i }).click();
  await page.getByRole('button', { name: /^save$/i }).click();

  await openCoupleProfile(page, coupleName);
  await navigateToProfileTab(page, 'Time');
  const panel = page.locator('[data-testid="couple-profile-panel"]');
  await expect(panel).toContainText('Venue walkthrough call');
  await expect(panel).toContainText('Site visit');
});

test('a manual entry can be added, edited and deleted', async ({ page }) => {
  await navigateToProfileTab(page, 'Time');
  // Add 30 minutes, assert the total, edit the note, then delete the row
  // and assert the empty state returns.
});

test('starting on a second couple stops the first', async ({ page }) => {
  // Start on couple A, close, open couple B, start, and assert the pill
  // names couple B while the note dialog offers couple A's session.
});
```

Add `startCoupleTimer(page)` and `stopCoupleTimer(page)` helpers to `tests/e2e/helpers.ts` if the same two lines repeat more than twice.

- [ ] **Step 2: Run the e2e suite**

```bash
npx playwright test tests/e2e/couple-time.spec.ts
```

Expected: PASS on desktop, Pixel 5, and iPhone 12. Any failure is an app bug: fix the app, never loosen the assertion. On mobile, verify by screenshot that the pill clears the top bar and does not cover the hamburger.

- [ ] **Step 3: Update the docs**

- `database-schema.md`: add `time_categories` and `couple_time_entries` with their columns, indexes (naming the partial unique index and why it exists), RLS policy, and the new `user_public_settings.time_categories_seeded` column.
- `page-specs.md`: document the Couple Profile Time tab, the header clock, and the pill, including the one-control-at-a-time rule and the 8h cap.
- `security.md`: add both tables to the RLS coverage matrix and tick the integration-test column, referencing `tests/integration/couples/time-actions.test.ts`.
- `component-library.md`: document `TimerPill`, `StopNoteDialog`, and `TimeCategoryPicker`, noting that categories are colourless by design.

- [ ] **Step 4: Run every gate**

```bash
npm run typecheck
npm run typecheck:strict
npm run lint:gate
npm test
```

Expected: `typecheck` 0 errors; `typecheck:strict` no new errors from these files; `lint:gate` within budget (if the new files reduce the count, ratchet the budget down in `scripts/lint-gate.mjs`); the full Vitest run green.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e .claude/docs
git commit -m "test(time): add e2e coverage for couple time tracking and update docs"
```

---

## Self-review

**Spec coverage:** every locked decision maps to a task. Schema, cap column, and seed flag → Task 1. Duration and formatting logic → Task 2. All eleven server actions, validation rules, cap clamp, seed-once, and RLS proof → Task 3. Colourless type-to-create categories → Task 4. Server-backed persistence, single running timer, pill placement, stop-note flow, shadow mode → Task 5. Time tab with total, breakdown, rows, manual add, edit, delete, auto-stop flag → Task 6. Header clock and the one-control-at-a-time rule → Task 7. E2E, docs, gates → Task 8. Out-of-scope items (rates, line items, list indicators, export, event attribution, billable flags, cross-couple reporting) appear in no task.

**Deviation from the spec, deliberate:** the spec says "two migrations"; this plan uses one file, because `couple_time_entries.category_id` references `time_categories` and a single ordered file is the simplest guarantee the FK target exists.

**Type consistency:** `TimeEntry`, `TimeCategory`, and `RunningTimer` are defined once in Task 2 and used with the same field names throughout. `ActionResult` is imported from the existing `./actions`, not redeclared. Query keys are fixed strings used identically across tasks: `['running-timer']`, `['time-categories']`, `['couple-time-entries', coupleId]`. `claimSurface()` returns its own release function in both the provider (Task 5) and the consumer (Task 7). `entryDurationMs` and `formatElapsed` are the only elapsed-time paths in the pill, the header, and the dialog.
