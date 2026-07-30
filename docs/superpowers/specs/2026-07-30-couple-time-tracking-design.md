# Couple time tracking: design

**Date:** 2026-07-30
**Branch:** `feature/custom-payment-schedules`
**Status:** approved, ready for implementation plan

## Problem

An MC/celebrant has no way to see how much time they have sunk into a
given couple. Some couples need three site visits and forty emails,
others need one call. Without a record, the MC cannot justify or adjust
what they charge.

## Solution summary

A per-couple stopwatch. Start it from the Couple Profile header, it keeps
running server-side (surviving reloads and device switches), a floating
pill keeps it visible everywhere in the app, and stopping it prompts for a
timesheet-style note plus a category. Every session is listed in a new
**Time** tab on the couple profile with a grand total and a per-category
breakdown.

Money is deliberately out of scope: the MC reads the hours and charges
however they like.

## Locked decisions

| Decision | Choice |
|---|---|
| Start/stop control | Couple Profile overlay header (not the small Edit Couple form modal) |
| Persistence | Server-backed; `started_at` timestamp is the source of truth |
| Concurrency | One running timer per user; starting a second stops the first |
| Money | Total time only. No rates, no dollars, no invoice line items |
| Timesheet location | New **Time** tab in the couple profile nav |
| Stop flow | Session saves immediately, then an optional note + category dialog |
| Categories | Notion-style type-to-create, **plain text chips, no colours** |
| Category defaults | Seed Meeting / Call / Admin / Travel / Rehearsal / Ceremony once |
| Category required? | No. An unset category renders as "Uncategorised" |
| Row edits | Note, start/end times, delete, and manual entry all supported |
| Runaway timers | Auto-stop at **8 hours**, flag the row |
| Couples list / kanban | No changes |
| Shadow mode | Clock + pill hidden; Time tab readable |
| Export | None in this version |

## Data model

Two migrations plus one column on an existing table.

### `couple_time_entries`

One row per session, running or finished.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `user_id` | uuid not null | fk `auth.users(id)` on delete cascade |
| `couple_id` | uuid not null | fk `public.couples(id)` on delete cascade |
| `started_at` | timestamptz not null | |
| `ended_at` | timestamptz null | **null means running** |
| `category_id` | uuid null | fk `public.time_categories(id)` on delete set null |
| `note` | text null | timesheet description, max 2000 chars |
| `auto_stopped` | boolean not null default false | set when the 8h clamp fires |
| `created_at` | timestamptz not null default now() | |

Duration is never stored. It is always `ended_at - started_at`, so
"edit the duration" is really "move `ended_at`". A manual entry is just a
row where both timestamps are supplied up front.

Indexes:

- `(user_id, couple_id, started_at desc)`: the Time tab read.
- **`unique (user_id) where ended_at is null`**: makes "one running timer
  per user" a database invariant rather than an application convention. A
  race between two tabs fails loudly at the DB instead of silently
  producing two running timers.

RLS: enabled, `auth.uid() = user_id` for select/insert/update/delete.

### `time_categories`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid not null | fk `auth.users(id)` on delete cascade |
| `name` | text not null | max 40 chars |
| `position` | integer not null default 0 | creation order, used for display |
| `created_at` | timestamptz not null default now() | |

Unique index on `(user_id, lower(name))` so "Travel" and "travel" cannot
both exist. No colour column, since the chosen design is plain chips. RLS as
above.

Deleting a category leaves its sessions intact and uncategorised (the
`on delete set null` above), which is the non-destructive behaviour.

### `user_public_settings.time_categories_seeded`

`boolean not null default false`. Without it, an MC who deletes all six
starter categories would get them resurrected on the next read. The flag
makes seeding genuinely once-per-user, including for existing users, who
are seeded on their first read after deploy.

## Server actions

New file `app/(dashboard)/couples/time-actions.ts`. Every action validates
input with `@/lib/api/validate` (Zod) and returns the codebase's tagged
`{ ok: true, data } | { ok: false, error }` result, so the existing
React Query mutation `onError` Slack alert fires on failure without extra
wiring. These are ordinary authenticated data writes, not auth / money /
public / upload routes, so no rate limiting is required.

| Action | Behaviour |
|---|---|
| `startCoupleTimerAction(coupleId)` | Stops any running session for the user, inserts a new running row. Returns the new entry **and** the stopped one, so the UI can open the note dialog for the session it just ended. |
| `stopCoupleTimerAction()` | Stops the user's running session. Returns the stopped entry plus its couple name for the dialog header. |
| `getRunningTimerAction()` | Returns the running entry, its couple name, and `server_now`. Applies the 8h clamp (see below). |
| `createCoupleTimeEntryAction(input)` | Manual entry: `couple_id`, `started_at`, `ended_at`, optional `category_id`, optional `note`. |
| `updateCoupleTimeEntryAction(input)` | Patch `started_at` / `ended_at` / `category_id` / `note` on one row. |
| `deleteCoupleTimeEntryAction(id)` | Delete one row. |
| `createTimeCategoryAction(name)` | Type-to-create. Rejects a case-insensitive duplicate by returning the existing row. |
| `renameTimeCategoryAction(id, name)` | |
| `deleteTimeCategoryAction(id)` | Sessions keep their history, category becomes null. |

Validation rules: `ended_at > started_at`; `started_at` not in the future;
a single entry cannot exceed 24h; note ≤ 2000 chars; category name
1–40 chars after trimming.

Overlapping entries are allowed. Manual back-fill legitimately overlaps
and policing it would create more friction than it prevents.

## The 8-hour clamp

No cron job. `getRunningTimerAction()` is a server action (a POST), so it
can write: when it sees a running row older than 8 hours it clamps
`ended_at` to `started_at + 8h`, sets `auto_stopped`, and returns "nothing
running". The result is identical to a sweeper (a session is only ever
observed as capped) without adding scheduled infrastructure. The row
renders with a small flag in the Time tab so the MC knows to correct it,
and the normal edit flow fixes it.

## Client architecture

**Pure logic** lives in `lib/time-tracking/format.ts`, React-free and
directly unit-testable:

- `formatElapsed(ms)` → `00:12:47` (the ticking pill display)
- `formatDuration(ms)` → `1h 15m` (list and totals display)
- `clampToCap(startedAt, now)` → the capped end instant
- `sumByCategory(entries, categories)` → breakdown rows

**Shared components** in `components/time-tracking/`:

- `use-timer.ts`: React Query hooks. Query key `['running-timer']`, plus
  start/stop mutations that invalidate it and the couple's entry list.
- `timer-pill.tsx`: the floating pill. Owns the single
  `setInterval(1000)`. Elapsed is derived from `started_at` versus now,
  offset by the client/server clock delta captured on fetch, so it never
  drifts and never accumulates error across a reload.
- `stop-note-dialog.tsx`: note textarea + category picker, Skip / Save.
- `time-category-picker.tsx`: type-to-create chip picker. Filters as you
  type; no match offers `Create "trav"`; each row has a `⋯` for rename
  and delete. Modelled on the interaction in `tasks/task-cells.tsx`
  `TaskTypeCell`, minus the colour rows.
- `timer-host.tsx`: client component mounted once in the dashboard
  layout. Renders the pill and the stop dialog, and renders nothing when
  shadowing or when no timer is running.

**Couple profile** files in `app/(dashboard)/couples/`:

- `couple-time.tsx`: the Time tab: totals, breakdown, list, "Add time".
- `couple-time-row.tsx`: one session row and its `⋯` menu.
- `couple-time-entry-modal.tsx`: manual add and edit (date + start time
  + end time, with the derived duration shown live).

Every file stays within the ~150-line rule; that is why the tab is three
files rather than one.

## UI

### The pill

Fixed viewport top-right, `z-[90]`, above every other layer: couple name,
ticking `00:12:47`, Stop. Desktop `top-3 right-3`; mobile below the fixed
56px top bar, clear of the hamburger.

### One timer control at a time

The Couple Profile overlay is nearly full-screen and its own top-right
corner holds ✕, so a permanently fixed pill would sit on top of the close
button. The rule that resolves it: **exactly one timer control is visible
at a time, in whichever surface is on top.** While the profile overlay is
open the pill hides and the profile header carries the ticking chip
instead:

- timing the couple you are looking at → `■ 12:47` beside the clock;
- timing a *different* couple → `Alice & Ben 12:47 ■`, so the "you left a
  timer running elsewhere" signal is never lost.

Closing the profile brings the pill back.

### Couple Profile header

A `Timer` icon button in the desktop action row (`Clock` is already taken
by the Timeline tab). Idle state matches the existing ghost icon buttons;
active state matches the settings-mode treatment already in that header.
The mobile `⋯` overflow menu gets a matching "Start timing" /
"Stop timing (12:47)" row.

### Time tab

```
Time                              Total tracked  4h 12m
Meeting 2h 10m · Admin 1h 05m · Travel 45m · Uncategorised 12m
──────────────────────────────────────────────────────────────
30 Jul   2:14 pm → 3:02 pm    Meeting     48m    ⋯
         Venue walkthrough call
28 Jul   9:05 am → 10:20 am   Admin       1h 15m ⋯
         Drafted ceremony script
```

Loading, empty, and error states use the existing `CoupleTabShell` /
`CoupleTabEmpty` primitives the other tabs use, so it looks native
immediately.

The new `'time'` key is added to `CoupleProfileSection` and
`SECTION_KEYS`, which is all the tab-settings Zod schema and the
order-derive helpers need. Existing users have a stored `tab_order`
without the key, and `orderedTabKeys()` already appends unknown-to-stored
keys, so the tab simply shows up at the end of their nav, the same way
every previous tab addition behaved. New users get it in canonical
position after Tasks.

### Shadow mode

The dashboard layout already reads cookies server-side for
`ShadowBanner`. It reads `zebri_is_shadowing` once more and passes a
boolean into `timer-host.tsx` and down to the profile header, which hides
both controls. A support session therefore cannot write time onto a
paying MC's timesheet, while their existing sessions stay readable.

## Edge cases

| Case | Behaviour |
|---|---|
| Couple deleted while its timer runs | FK cascade removes the entries; the pill's query returns nothing and it disappears. |
| Reload before saving the note | The session is already saved (note empty). Annotate it later from the Time tab. |
| Two tabs both press Start | The partial unique index rejects the second; the UI refetches and shows the winner. |
| Timer started, browser closed for days | Read-time clamp caps it at 8h and flags it. |
| All categories deleted | They stay deleted; the seeded flag prevents resurrection. |
| Category deleted with sessions attached | Sessions survive as "Uncategorised". |
| Timezones | Displayed in the viewer's local time, `en-AU` formatting as elsewhere. |

## Testing

**Unit** (`tests/unit/`): the four `format.ts` functions including the
clamp; tab-key derivation appending `'time'` to a legacy config;
`TimeCategoryPicker` create / rename / delete via RTL; `StopNoteDialog`
skip-versus-save; `TimerPill` ticking under fake timers.

**Integration** (`tests/integration/`, local Supabase, real RLS):
cross-tenant denial on `couple_time_entries` and `time_categories` for
all four verbs (both new rows in the `security.md` matrix); the
one-running-timer partial unique index; start-stops-previous; couple
delete cascades entries; seed-once honours the flag; category delete
nulls `category_id` without deleting rows.

**E2E** (`tests/e2e/`, desktop + Pixel 5 + iPhone 12): start from the
profile header → pill appears → close the profile → pill survives
navigation → reload → still ticking → stop → note + category dialog →
save → Time tab shows the row, the total, and the breakdown. Plus manual
add, edit, and delete.

## Docs to update in the same PR

`database-schema.md` (two tables + the new column), `page-specs.md` (the
Time tab and the pill), `security.md` (two RLS matrix rows),
`component-library.md` (pill, stop dialog, category picker).

## Explicitly out of scope

Hourly rates and dollar totals · invoice or proposal line items from
tracked time · list, kanban, or calendar indicators · CSV or PDF export ·
attributing a session to a specific event · billable/non-billable flags ·
category colours · cross-couple reporting.
