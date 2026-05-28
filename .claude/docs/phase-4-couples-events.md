# Phase 4 — Couples + Events (core CRM)

> **Status:** Plan draft 2026-05-28. Branch off `staging` (current
> hardening batch stays on staging only — see
> [[feedback_staging_only_batch]]).
> Roadmap §4 item 3 — the largest surface in the codebase
> (~12.4k LOC across 41 files). Sits between Payments (item 2,
> shipped) and Contracts (item 4, shipped); the core CRM that every
> other surface threads through.

## 1. Context

Couples + Events is the **central spine** of the product. Every
other surface — Payments, Contracts, Portal, Timeline, Calendar —
hangs off a couple row. It also has the longest contiguous run of
legacy code in the repo: the original `/couples` page predates the
layering conventions, the design system, the entitlements helper,
and the server-actions pattern. Almost nothing in it follows the
post-Phase-2 rules.

Phase 4 covers everything in the Couples + Events surface:

- **`/couples`** (`app/(dashboard)/couples/page.tsx`, 439 LOC) — list/kanban surface with bulk actions, deep-link modal, starter-cap-lock guard, multi-drag, CSV export. Toolbar/header/list/kanban each in their own file.
- **Couple Profile overlay (modal)** (`couple-profile.tsx`, 650 LOC) — a centered full-screen **modal** (not a slide-in drawer) with a 9-tab nav: Overview, Pulse, Tasks, Contacts, Timeline, Songs, Files, Payments, Contracts. Rendered as `fixed inset-0` with `animate-modal-in` — opens centred at ~90vw × 90vh on desktop, fills the viewport on mobile.
- **`/calendar`** (`app/(dashboard)/calendar/page.tsx`) — thin wrapper around `couples/couples-calendar.tsx` (1122 LOC, the single largest file in the surface).
- **`/events/[id]/timeline`** — standalone event-timeline route (the **only** live page under `events/` — everything else in that folder is a misfiled component module per recon §7.7).
- **Events module** — `app/(dashboard)/events/event-*.tsx` (8 files, ~2900 LOC total) consumed by both the standalone timeline route and the Couple Profile's Events / Timeline tabs.
- **MC Portal sections** (`couples/mc-portal-*.tsx`) — songs, files, contacts, names, runsheet. These are the MC-side mirrors of the public `/portal/[token]` surface that Phase 2D.2 already hardened on the read side.
- **Hooks** — `use-couples.ts`, `use-couple-statuses.ts`, `use-portal-data.ts`, `use-starter-cap-lock.ts`.
- **Database** — `couples`, `events`, `couple_statuses`, `couple_contacts`, `event_contacts`, `tasks`, `timeline_items`, `timeline_templates`, `timeline_template_items`, `portal_files`, `portal_people`, `portal_songs`, `portal_song_categories`.

**Audit findings (recon done 2026-05-28):**

- **Inline mutations everywhere.** Direct `supabase.from(...).insert/update/delete` calls live in ~14 of the component files (couple-events, couple-payments, couple-quotes, couple-invoices, couple-tasks, couple-timeline, mc-portal-files, mc-portal-contacts, mc-portal-songs, etc.). The §5 DoD requires mutations to live in `actions.ts`, not co-located components. This is the biggest single source of debt in the phase.
- **No couples-side server actions.** Compare to `app/(dashboard)/payments/actions.ts` (Phase 2C / 2C.2 / 3.1 / 3.2). Couples has nothing equivalent.
- **`couples-calendar.tsx` at 1122 LOC**, `couple-profile.tsx` at 650, `couples-list.tsx` at 743, `couple-events.tsx` at 534, `couple-timeline.tsx` at 489, `event-modal.tsx` at 486, `event-day-calendar.tsx` at 870, `event-timeline.tsx` at 466. **8 files break the 150-LOC component rule by 3-7×.**
- **Events module misfiled.** §7.7 of `production-readiness.md` flagged this for Phase 4: `app/(dashboard)/events/` contains 1 live route (`events/[id]/timeline/page.tsx`) and 8 component files that are imported by `couples/` via deep relative paths (`'../events/event-day-calendar'`, `'../events/event-timeline-modal'`). Components belong outside of route groups when they're shared.
- **Zero RLS integration tests** for `events`, `couple_statuses`, `couple_contacts`, `event_contacts`, `tasks`, `timeline_items`, `portal_files`, `portal_people`, `portal_songs`, `portal_song_categories`. Only `couples` has one (Phase 1, `tests/integration/rls/couples.test.ts`, 5 tests). Per §5 DoD, each table touched by the phase needs one.
- **No `set-state-in-effect` clean-up.** Three `useEffect`s in `couples/page.tsx` write state to drive deep-link / sync-from-cache behaviour. Each lives under an `// eslint-disable-next-line react-hooks/set-state-in-effect` comment — that's the pattern Phase 2D.2 ratcheted *out* of the public surfaces. Couples is the next place the rule is broken.
- **Calendar lives in two places.** `couples-calendar.tsx` is imported by the standalone `/calendar` route page, **not** by `/couples` itself (despite the file path). The `/couples` toolbar offers only `list | board` view modes. That mismatch is confusing; the calendar's home should be one canonical route.
- **MC Portal sections do direct table writes.** `mc-portal-contacts` writes `couple_contacts` + `contacts`; `mc-portal-files` writes `portal_files`; `mc-portal-songs` writes `portal_songs` + `portal_song_categories`. None of these go through validated server actions. The public `/portal/[token]` is hardened — the MC-side mirror that produces the data is not.
- **`couple-modal.tsx` (316 LOC)** still uses Radix Popover for status + lead-source pickers — fine — but the form-state lives in 7 `useState`s instead of a single object. Worth modernising while we're in there.
- **CSV export logic inline in `page.tsx`** (lines 307-332). Not security-critical but reinforces the "page is not an orchestrator" smell.

## 2. Decisions (locked)

| #   | Decision | Notes |
|-----|----------|-------|
| 1 | **PR split: 4A → 4D, four sub-phases.** Same shape as Phase 2 + 3. Each sub-phase stays under ~1500 LOC of changed code; reviewable in one sitting. | Bounded by surface area, not LOC alone — see §3 for the carve-up. |
| 2 | **Events module relocates to `components/events/` in 4A.** The 8 misfiled files (`event-overview`, `event-vendors`, `event-tasks`, `event-timeline`, `event-timeline-modal`, `event-timeline-share`, `event-day-calendar`, `event-profile`) move under `components/events/`. Imports under `couples/` switch from `'../events/foo'` to `'@/components/events/foo'`. The live route `app/(dashboard)/events/[id]/timeline/page.tsx` **stays put** (changing it is a URL change → product decision, not a refactor). | Closes the §7.7 deferral. Pure relocation; no behaviour change. Done as the first step of 4A so subsequent phases have a clean import path. |
| 3 | **Calendar stays on `/calendar` as its own route.** Don't try to fold it into `/couples` as a third view mode. The 1122-LOC calendar has its own header/sidebar/state machine; squeezing it under the couples-list toolbar would inflate the page page.tsx, not slim it down. The mismatch between the file's location (`couples/couples-calendar.tsx`) and its consumer (`/calendar`) is resolved by **moving the file** to `app/(dashboard)/calendar/_components/`. | Memory note `calendar_redesign.md` listed views (Day/Week/Month) + sidebar filters as current state — those stay; this is structural cleanup, not a redesign. |
| 4 | **Mutations lift to two action modules.** New: `app/(dashboard)/couples/actions.ts` for couple + event + task + portal mutations; `app/(dashboard)/couples/portal-actions.ts` for the larger portal-section writes (songs/files/people/contacts). Two files because Zod schemas otherwise pile up; matching the Payments precedent. All actions: Zod-validated input, RLS-scoped Supabase client, tagged `ActionResult<T>`, TSDoc. | The Couple Profile + every section component becomes pure composition. |
| 5 | **MC Portal sections are part of Phase 4, not Phase 8 (Client Portal).** Phase 8 covers what the **couple** sees on `/portal/[token]`; the MC-side editing UI is part of the Couple Profile and belongs here. | Confirms memory `feedback_couples_modal_design.md` — the portal lives "inside" the couple's profile. |
| 6 | **Couple Profile overlay (modal) keeps its 9-tab structure** (Overview, Pulse, Tasks, Contacts, Timeline, Songs, Files, Payments, Contracts). No tab-set redesign in 4C — that would mix UX scope into a structural refactor. | Two stale tabs (Pulse, Vendors) were considered for removal — both still used; keep them and let the next product cycle reassess. |
| 6a | **Couple Profile stays a centered modal — not a slide-in drawer.** Current implementation (`fixed inset-0` + `flex items-center justify-center` + `animate-modal-in`) is correct; we don't reshape it into a side-sheet during decomposition. | Locks the interaction model so a future structural PR can't accidentally turn it into a drawer. Mobile (≤ sm) fills the viewport; desktop centers at ~90vw × 90vh. |
| 7 | **`couple_statuses` table stays user-customisable.** Some MCs have renamed the default 4 statuses (`new → contacted → quoted → lost`); we preserve those rows on every migration. | Already true. Documented for clarity. |
| 8 | **`events.couple_id NOT NULL` stays.** Memory note `events_couples_consolidation.md` (Mar 11 2026) made events couple-owned; we don't re-introduce standalone events. | Confirmed by `20260310010000_create_events_table.sql`. |
| 9 | **No new entitlement gates.** Couples + Events are core CRM, available on every plan tier. Only the Starter-cap (10-couple limit, enforced by the existing `enforce_starter_couple_limit` trigger) and the `hasContractsAccess` check on the Contracts tab survive. | Phase 4 doesn't add gates; we audit the existing ones. |
| 10 | **Tests: full pyramid.** Target adds: +25 unit (server-action Zod + new section components), +9 integration (RLS test per owned table the phase touches: `events`, `couple_statuses`, `couple_contacts`, `event_contacts`, `tasks`, `timeline_items`, `portal_files`, `portal_people`, `portal_songs`), +2 e2e (kanban drag-and-drop on `tests/e2e/couples.spec.ts` already exists; add couple-profile-tabs + calendar-views specs). | `tests/integration/rls/couples.test.ts` from Phase 1 stays. |

## 3. PR plan — 4 PRs

| PR    | Branch                                  | Scope                                                                                                                                  | Est. LOC |
|-------|------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------|----------|
| 4A   | `phase-4a-couples-list`                  | Events-module relocation + `couples/actions.ts` foundation + `/couples` page decomposition + list/kanban/header/toolbar hardening      | ~1500    |
| 4B   | `phase-4b-couple-profile`                | Couple Profile overlay (modal) decomposition (650 → orchestrator + per-tab sections) + Overview/Pulse/Tasks/Payments/Contracts tab hardening | ~1400    |
| 4C   | `phase-4c-events-calendar`               | Events module hardening (the relocated files from 4A) + `/calendar` route move + couple-events + couple-timeline tabs + event-day-calendar decomposition | ~1500    |
| 4D   | `phase-4d-mc-portal-sections`            | MC Portal sections (songs/files/contacts/people) hardening + `portal-actions.ts` + RLS integration tests for portal_*                  | ~1200    |

4A ships first because:
1. The events relocation has no UX risk and unblocks every subsequent phase's clean imports.
2. The `couples/actions.ts` module is the precondition for every following sub-phase to lift its mutations.
3. The `/couples` page is the most-hit surface; getting it on the new structure first lets us watch staging for regressions before we touch the deeper profile.

## 4. PR 4A — Foundation + couples list page

### Files

| File                                                              | Treatment                                                                                                              |
|-------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------|
| `app/(dashboard)/events/event-*.tsx` (8 files, ~2900 LOC)          | **Relocate** to `components/events/`. Pure move; no edits. Update every `'../events/...'` and `'./event-...'` import. |
| `app/(dashboard)/events/[id]/timeline/page.tsx`                    | Stays put (live route). Re-point its `'../../event-day-calendar'` import to `'@/components/events/event-day-calendar'`. |
| `app/(dashboard)/couples/actions.ts` (new, ~400 LOC)               | New server-action module. Initial set: `createCoupleAction`, `updateCoupleAction`, `deleteCoupleAction`, `bulkMoveCouplesAction`, `bulkUpdateStatusAction`, `bulkDeleteCouplesAction`. Lifts every mutation currently in `use-couples.ts`. All Zod-validated; tagged `ActionResult<T>`. |
| `app/(dashboard)/couples/page.tsx` (439 LOC)                       | **Decompose** to orchestrator (~200 LOC). Lift CSV export to `lib/utils/csv.ts`; lift deep-link + cache-sync `useEffect`s into a `useCoupleProfileSync()` hook in `app/(dashboard)/couples/use-couple-profile-sync.ts`. Drop the three `eslint-disable react-hooks/set-state-in-effect` comments — the hook does the sync correctly. |
| `app/(dashboard)/couples/couples-header.tsx` (292 LOC)             | Hardening pass: tokens for all colours (currently has raw `gray-*`), Input/Button primitives where it's using raw HTML. Target ≤ 200 LOC. |
| `app/(dashboard)/couples/couples-toolbar.tsx`                      | Already small; tokens-only pass.                                                                                       |
| `app/(dashboard)/couples/couples-list.tsx` (743 LOC)               | Largest file in 4A. **Split** into orchestrator + `couples-list-row.tsx` + `couples-list-table-header.tsx` + `couples-list-skeleton.tsx` + `couples-list-empty.tsx`. Lift sort/filter logic to a `useCouplesView()` hook. Target main file ≤ 250 LOC. |
| `app/(dashboard)/couples/couples-kanban.tsx` (254 LOC) + `kanban-card.tsx` + `kanban-column.tsx` | Tokens + primitives pass; multi-drag state moves into the existing hook structure. |
| `app/(dashboard)/couples/bulk-action-bar.tsx`                      | Tokens-only pass; switch raw `<button>` to `<Button>` primitive.                                                       |
| `app/(dashboard)/couples/use-couples.ts` (195 LOC)                 | **Thin out.** Currently does inline `supabase.from(...).upsert(...)` in every mutation hook. Replace each mutation with a call to the matching `actions.ts` function. The hook keeps the React Query cache invalidation; the action does the DB work. |
| `app/(dashboard)/couples/couple-modal.tsx` (316 LOC)               | Refactor 7 local `useState`s → single form-state object. Add Zod schema sharable with the action. Modernise picker affordances (the inline Popovers stay but with the Phase 2C state-pill styling). Target ≤ 220 LOC. |
| `app/(dashboard)/couples/starter-cap-lock-modal.tsx`               | Tokens-only pass.                                                                                                      |
| `tests/integration/rls/events.test.ts` (new)                       | RLS denial proof for `events` table. Owner reads ok / other tenant cannot SELECT/UPDATE/DELETE / anon cannot read. ~5 tests. |
| `tests/integration/rls/couple-statuses.test.ts` (new)              | Same shape for `couple_statuses`. ~5 tests.                                                                            |
| `tests/integration/couples/save-couple-action.test.ts` (new)       | Integration test against local Supabase — `createCoupleAction` happy path + cross-tenant denial + Starter-cap trigger denial. ~4 tests. |
| `tests/integration/couples/bulk-actions.test.ts` (new)             | Bulk move/update/delete actions against real RLS. ~3 tests.                                                            |
| `tests/unit/app/(dashboard)/couples/actions.test.ts` (new)         | Zod rejection branches + auth gate + happy path with mocked Supabase. ~8 tests.                                        |
| `tests/e2e/couples.spec.ts`                                        | Extend existing spec to cover: search + status filter + sort + bulk select + bulk delete confirm. ~3 new cases.        |
| `.claude/docs/database-schema.md`                                  | No schema changes; add an "Owned by couples" table list note for clarity.                                              |
| `.claude/docs/page-specs.md`                                       | Refresh `/couples` page section.                                                                                       |
| `.claude/docs/security.md`                                         | Tick the RLS matrix for `events` + `couple_statuses`.                                                                  |
| `.claude/docs/production-readiness.md`                             | Phase 4A status block.                                                                                                 |

### Architecture — new file layout (after 4A)

```
app/(dashboard)/couples/
  page.tsx                          (orchestrator, ~200 LOC)
  actions.ts                        NEW
  use-couple-profile-sync.ts        NEW (lifted from page.tsx effects)
  use-couples.ts                    THINNED (calls actions.ts)
  use-couple-statuses.ts            unchanged
  use-starter-cap-lock.ts           unchanged
  couples-header.tsx                hardened
  couples-toolbar.tsx               hardened
  couples-list.tsx                  thinned
  couples-list-row.tsx              NEW
  couples-list-table-header.tsx     NEW
  couples-list-skeleton.tsx         NEW
  couples-list-empty.tsx            NEW
  couples-kanban.tsx                hardened
  kanban-card.tsx                   hardened
  kanban-column.tsx                 hardened
  bulk-action-bar.tsx               hardened
  couple-modal.tsx                  refactored
  starter-cap-lock-modal.tsx        hardened
  [profile + sections stay for 4B+]

components/events/                  NEW (relocated from app/(dashboard)/events/)
  event-overview.tsx
  event-vendors.tsx
  event-tasks.tsx
  event-timeline.tsx
  event-timeline-modal.tsx
  event-timeline-share.tsx
  event-day-calendar.tsx
  event-profile.tsx

app/(dashboard)/events/
  [id]/timeline/page.tsx            unchanged path; imports updated
```

## 5. PR 4B — Couple Profile overlay (modal)

### Files

| File                                                              | Treatment                                                                                                              |
|-------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------|
| `app/(dashboard)/couples/couple-profile.tsx` (650 LOC)             | **Decompose** to orchestrator (~250 LOC) + a `couple-profile-nav.tsx` (the 9-tab nav) + `couple-profile-header.tsx` (name + status pill + share-link + overflow menu). |
| `app/(dashboard)/couples/couple-overview.tsx` (246 LOC)            | Pure composition; tokens pass. Inline mutations (status change) → `actions.ts`. |
| `app/(dashboard)/couples/couple-pulse.tsx` (229 LOC)               | Tokens + primitives pass. No mutations.                                                                                |
| `app/(dashboard)/couples/couple-tasks.tsx` (179 LOC)               | Lift `supabase.from('tasks').insert/update/delete` → `createCoupleTaskAction`, `updateCoupleTaskAction`, `deleteCoupleTaskAction` in `actions.ts`. |
| `app/(dashboard)/couples/contact-picker.tsx` (253 LOC)             | Shared by couple-events Contacts tab + mc-portal-contacts. Tokens + primitives.                                        |
| `app/(dashboard)/couples/couple-payments.tsx` (375 LOC)            | Inline `quotes` + `invoices` writes already go through builder modals (Phase 2C.2); only the delete buttons mutate directly → lift to `deleteQuoteAction` / `deleteInvoiceAction` (already exist on `payments/actions.ts`). |
| `app/(dashboard)/couples/couple-quotes.tsx` (183 LOC) + `couple-invoices.tsx` (187 LOC) | Legacy tab implementations; check whether they're still referenced or whether `couple-payments` superseded them. **Delete if dead.** Memory `payments_consolidation.md` says "Couple profile still has Quotes/Invoices tabs that open modals for editing" — confirm against current shape. |
| `app/(dashboard)/couples/couple-contracts.tsx`                     | Lift inline `generate_contract_number` RPC call → action. Other writes already go through the contract-builder modal (Phase 3.1). |
| `app/(dashboard)/couples/couple-vendors.tsx` (266 LOC)             | Legacy name for "contacts" — memory says contacts replaced vendors. Check live-ness; delete or rename.                 |
| `app/(dashboard)/couples/actions.ts`                               | Add: `createCoupleTaskAction`, `updateCoupleTaskAction`, `deleteCoupleTaskAction`, `linkContactToCoupleAction`, `unlinkContactFromCoupleAction`, `rotateCouplePortalTokenAction`. |
| `tests/integration/rls/tasks.test.ts` (new)                        | RLS denial proof. ~5 tests.                                                                                            |
| `tests/integration/rls/couple-contacts.test.ts` (new)              | RLS denial proof. ~4 tests.                                                                                            |
| `tests/integration/couples/task-actions.test.ts` (new)             | Happy path + cross-tenant denial. ~4 tests.                                                                            |
| `tests/unit/app/(dashboard)/couples/actions.test.ts`               | Extend with task + contact-link Zod cases. ~8 new tests.                                                               |
| `tests/e2e/couple-profile.spec.ts`                                 | Existing — extend to cover task add/edit/delete + tab navigation. ~3 new cases.                                        |

### Tab-by-tab matrix

| Tab        | File                          | Mutations source                  | Status after 4B |
|------------|-------------------------------|-----------------------------------|-----------------|
| Overview   | `couple-overview.tsx`         | `actions.ts`                      | ≤ 200 LOC       |
| Pulse      | `couple-pulse.tsx`            | none                              | ≤ 200 LOC       |
| Tasks      | `couple-tasks.tsx`            | `actions.ts`                      | ≤ 150 LOC       |
| Contacts   | (via `mc-portal-contacts`)    | `portal-actions.ts` (Phase 4D)    | unchanged in 4B |
| Timeline   | `couple-timeline.tsx`         | `events/actions.ts` (Phase 4C)    | unchanged in 4B |
| Songs      | `mc-portal-songs.tsx`         | `portal-actions.ts` (Phase 4D)    | unchanged in 4B |
| Files      | `mc-portal-files.tsx`         | `portal-actions.ts` (Phase 4D)    | unchanged in 4B |
| Payments   | `couple-payments.tsx`         | `payments/actions.ts`             | ≤ 250 LOC       |
| Contracts  | `couple-contracts.tsx`        | builder modal + `actions.ts`      | ≤ 200 LOC       |

## 6. PR 4C — Events module + calendar route

### Files

| File                                                              | Treatment                                                                                                              |
|-------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------|
| `app/(dashboard)/couples/couples-calendar.tsx` (1122 LOC)          | **Relocate** to `app/(dashboard)/calendar/_components/` + decompose. Split per view: `calendar-day-view.tsx`, `calendar-week-view.tsx`, `calendar-month-view.tsx`, `calendar-sidebar.tsx`, `calendar-header.tsx`. Shared state machine into a `useCalendarView()` hook. Target each file ≤ 250 LOC; orchestrator ≤ 200 LOC. |
| `app/(dashboard)/calendar/page.tsx`                                | Already thin; minor tokens pass + update imports to the new `_components/` paths.                                       |
| `components/events/event-day-calendar.tsx` (870 LOC)               | Decompose: `event-day-calendar-grid.tsx`, `event-day-calendar-block.tsx`, `event-day-calendar-toolbar.tsx`. Lift dnd state machine into `useEventDayCalendar()` hook. Target main file ≤ 250 LOC. |
| `components/events/event-timeline.tsx` (466 LOC) + `event-timeline-modal.tsx` (348 LOC) + `event-timeline-share.tsx` | Tokens + primitives pass. Modal sub-300 LOC; timeline sub-300 LOC.                                                     |
| `components/events/event-overview.tsx` + `event-tasks.tsx` + `event-vendors.tsx` + `event-profile.tsx` | Tokens + primitives. Lift inline `events` + `event_contacts` + `tasks` writes → `events-actions.ts`. |
| `app/(dashboard)/couples/couple-events.tsx` (534 LOC)              | **Decompose** to: `couple-events-list.tsx` (the list), `couple-events-empty.tsx`, `couple-events-card.tsx`. Lift `event_contacts` + `timeline_items` inserts → `events-actions.ts`. Target main file ≤ 250 LOC. |
| `app/(dashboard)/couples/couple-timeline.tsx` (489 LOC)            | **Decompose** to: `couple-timeline-event-picker.tsx`, `couple-timeline-share.tsx`. Lift inline `timeline_items` + `event_contacts` writes → `events-actions.ts`. Target main file ≤ 250 LOC. |
| `app/(dashboard)/couples/event-modal.tsx` (486 LOC)                | Pull the form schema into Zod (shared with action). Form-state → single object. Target ≤ 300 LOC. |
| `lib/events/actions.ts` (new, ~350 LOC)                            | `createEventAction`, `updateEventAction`, `deleteEventAction`, `saveEventTimelineAction`, `linkContactToEventAction`, `unlinkContactFromEventAction`. |
| `tests/integration/rls/event-contacts.test.ts` (new)               | RLS denial proof. ~4 tests.                                                                                            |
| `tests/integration/rls/timeline-items.test.ts` (new)               | RLS denial proof. ~5 tests.                                                                                            |
| `tests/integration/events/save-event-action.test.ts` (new)         | Happy path + cross-tenant denial. ~4 tests.                                                                            |
| `tests/unit/lib/events/actions.test.ts` (new)                      | Zod rejection branches. ~8 tests.                                                                                      |
| `tests/e2e/calendar.spec.ts` (new)                                 | Calendar view switching + sidebar filter + clicking a couple opens the profile. ~3 cases.                              |

## 7. PR 4D — MC Portal sections

### Files

| File                                                              | Treatment                                                                                                              |
|-------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------|
| `app/(dashboard)/couples/mc-portal-contacts.tsx` (312 LOC)         | Lift `couple_contacts` + `contacts` writes → `portal-actions.ts`. Tokens + primitives. Target ≤ 220 LOC.               |
| `app/(dashboard)/couples/mc-portal-songs.tsx` (314 LOC)            | Lift `portal_songs` + `portal_song_categories` writes → `portal-actions.ts`. Tokens + primitives. Target ≤ 220 LOC.    |
| `app/(dashboard)/couples/mc-portal-files.tsx` (202 LOC)            | Lift `portal_files` writes + Storage upload to `portal-actions.ts` (Storage upload stays client-side but mediated by an action that returns the signed URL). Tokens + primitives. |
| `app/(dashboard)/couples/mc-portal-names.tsx` + `mc-portal-runsheet.tsx` | Tokens + primitives. Mutations lift.                                                                                  |
| `app/(dashboard)/couples/portal-modals.tsx` (316 LOC)              | Two modals (Person, Song). Split into `portal-person-modal.tsx` + `portal-song-modal.tsx`. Zod-validated forms. Target each ≤ 180 LOC. |
| `app/(dashboard)/couples/portal-section-nav.tsx`                   | Tokens pass.                                                                                                            |
| `app/(dashboard)/couples/use-portal-data.ts` (277 LOC)             | **Thin out** — currently does inline reads with embedded mutations in callbacks. Reads stay (React Query); mutations all call `portal-actions.ts`. Target ≤ 180 LOC. |
| `app/(dashboard)/couples/portal-actions.ts` (new, ~500 LOC)        | `addPortalPersonAction`, `updatePortalPersonAction`, `deletePortalPersonAction`, `addPortalSongAction`, `updatePortalSongAction`, `deletePortalSongAction`, `addPortalSongCategoryAction`, `updatePortalSongCategoryAction`, `deletePortalSongCategoryAction`, `uploadPortalFileAction`, `deletePortalFileAction`, `addCoupleContactAction`, `deleteCoupleContactAction`, `updateContactAction`. |
| `tests/integration/rls/portal-files.test.ts` (new)                 | RLS denial proof. ~4 tests.                                                                                            |
| `tests/integration/rls/portal-people.test.ts` (new)                | RLS denial proof. ~4 tests.                                                                                            |
| `tests/integration/rls/portal-songs.test.ts` (new)                 | RLS denial proof on `portal_songs` + `portal_song_categories`. ~5 tests.                                               |
| `tests/integration/couples/portal-actions.test.ts` (new)           | Happy path + cross-tenant denial for the most-used actions. ~5 tests.                                                  |
| `tests/unit/app/(dashboard)/couples/portal-actions.test.ts` (new)  | Zod rejection branches + auth gate. ~12 tests.                                                                         |
| `tests/e2e/couple-profile.spec.ts`                                 | Extend with: add song + add person + upload file flows. ~3 cases.                                                      |

## 8. Reused existing code

- `components/ui/{button,input,select,modal,confirm-dialog,toast,popover,badge}` — every primitive the redesign touches.
- `@radix-ui/react-popover` — kept for the existing status/lead-source pickers.
- `@dnd-kit/{core,sortable,utilities}` — kept for kanban + timeline reorder.
- `@/lib/api/validate` (Zod helpers) — every new action.
- `@/lib/supabase/server` — every new action's RLS-scoped client.
- `@/lib/auth/entitlements` — `hasContractsAccess` on the Contracts tab; no new gates.
- `@/types/couple` + `@/types/event` — shared shapes (extend as needed; don't fork).
- `tests/integration/helpers/supabase.ts` — `createTestUser` + `serviceClient` for every new integration test.

## 9. Database considerations

- **No destructive migrations in Phase 4.** The schema is sound; the cleanup is application-layer only.
- **No new tables.** Every mutation lifts into actions that write the existing tables via RLS.
- **One additive migration** worth considering: the `couples` table check constraint on `status` (`'new', 'contacted', 'quoted', 'lost'`) drifts away from the customisable `couple_statuses` table for users who renamed statuses. We don't enforce a foreign key today. Decision: **leave it.** A FK would break existing rows for users mid-migration; the constraint at the app layer is sufficient.
- The Starter-cap trigger (`enforce_starter_couple_limit`) stays as the canonical 10-couple enforcement — exercise it in `tests/integration/couples/save-couple-action.test.ts`.

## 10. Verification (each PR)

```bash
npm run typecheck                    # 0 errors (must stay 0)
npm run typecheck:strict:gate        # ratchet DOWN per PR
npm run lint:gate                    # ratchet DOWN per PR
npm run test:unit                    # add per the matrix above
supabase start && npm run test:integration   # add per the matrix
npm run build                        # exit 0
npx playwright test tests/e2e/{couples,couple-profile,calendar}.spec.ts
```

Manual smoke on each PR before merging the sub-phase to staging:

1. **4A** — `/couples`: load, search, filter, sort, multi-select, bulk move via drag, bulk delete, CSV export, Starter-cap-lock modal (toggle in dev). Mobile (iPhone 12 viewport): kanban scrolls horizontally, bulk bar stacks correctly.
2. **4B** — Couple Profile: open from kanban; cycle every tab; add/edit/delete a task; rotate portal token; check the share-link copy affordance.
3. **4C** — `/calendar`: switch Day/Week/Month; sidebar filter by status; click a couple → profile opens. Couple Profile → Events tab: add an event, add a timeline item, share the timeline link.
4. **4D** — Couple Profile → Songs/Files/Contacts: add a person, add a song, upload a file. On `/portal/[token]` (incognito): confirm the same data appears.

## 11. Out of scope (for Phase 4)

- **Tasks page hardening** (Phase 6). The Tasks tab inside Couple Profile gets cleaned up here; the standalone `/tasks` page is a separate phase.
- **Timeline page hardening** (Phase 10) — the standalone `/timeline` route (if it exists; needs confirming in Phase 6 recon). The Timeline tab inside Couple Profile is in 4C.
- **Public Portal hardening** (Phase 8 — `/portal/[token]`). The **MC-side** mirror is in 4D; the **couple-side** read surface is its own phase.
- **Calendar UX changes** — sticking to the existing Day/Week/Month design.
- **Couple-modal field reshape** — name/email/phone/status/notes/lead_source are the existing fields; we modernise the form structure but don't add/remove fields.
- **Status-customisation UX** (Settings → Statuses). Touched only if it breaks during the actions lift.
- **Currency / locale work** — stays AU-only.
- **Workflows / automation triggers off couple-status changes** (Phase 14).

## 12. Risks + mitigations

| Risk                                                              | Mitigation                                                                                                              |
|-------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------|
| **Events relocation breaks deep imports.** The 8 files have ~30 callsites between them. | Pure relocation as the FIRST commit in 4A; CI typecheck catches every missed path before behaviour changes land. |
| **Bulk-action server actions diverge from current optimistic UI behaviour.** Kanban multi-drag currently optimistically reorders on the client. | Keep the optimistic mutation pattern in the React Query hook; the action becomes the canonical write but the cache update stays. |
| **Storage uploads in `mc-portal-files`** — client-side `supabase.storage.from('portal-files').upload(...)` currently. | Storage upload itself stays client-side (the file blob never round-trips through the server); the action wraps the *DB-row insert* + returns the signed URL the client uses. Same trust boundary as today. |
| **Starter-cap trigger** fires inside Postgres on insert; surfacing the error meaningfully through a server action needs care. | Pattern already exists in `use-couples.ts` (`StarterLimitError`); the action's `ActionResult` carries the typed error code so the UI keeps the existing redirect-to-billing behaviour. |
| **1122-LOC calendar decomposition** risks regression in the most-visually-complex surface in the app. | Add the e2e spec (calendar.spec.ts) FIRST in 4C; refactor second. Failing tests pin behaviour. |
| **Phase 4 is the biggest by volume.** ~12.4k LOC under reorganisation across 41 files. | Strict 4-PR split; each ≤ ~1500 LOC of changed code. Each ships to staging independently before the next starts. |

## 13. PR + branch flow

- **4A:** branch off `staging` as `phase-4a-couples-list`. Target `staging`.
- **4B:** branch off `phase-4a-couples-list` (after merge to staging) as `phase-4b-couple-profile`. Target `staging`.
- **4C:** branch off `phase-4b-couple-profile` (after merge) as `phase-4c-events-calendar`. Target `staging`.
- **4D:** branch off `phase-4c-events-calendar` (after merge) as `phase-4d-mc-portal-sections`. Target `staging`.

Per the current staging-only batch (locked feedback note
[[feedback_staging_only_batch]]): **no `main` promotion** between
sub-phases. Phase 4 promotes to `main` together with every other
phase in the current hardening batch when the batch closes.

## 14. Doc updates (each PR)

| Phase | Docs touched                                                                                          |
|-------|--------------------------------------------------------------------------------------------------------|
| 4A    | `page-specs.md` (Couples), `security.md` (RLS matrix: events, couple_statuses), `production-readiness.md`, `component-library.md` (new `components/events/`). |
| 4B    | `page-specs.md` (Couple Profile), `security.md` (RLS matrix: tasks, couple_contacts), `production-readiness.md`. |
| 4C    | `page-specs.md` (Calendar + Couple Events/Timeline tabs), `security.md` (RLS matrix: event_contacts, timeline_items), `database-schema.md` (no schema change; relocation note), `production-readiness.md`. |
| 4D    | `page-specs.md` (MC Portal sections), `security.md` (RLS matrix: portal_files, portal_people, portal_songs), `production-readiness.md`. |

After 4D lands, the §4 roadmap order moves to **Phase 5: Contacts**.
