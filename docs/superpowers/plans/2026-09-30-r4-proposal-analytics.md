# R4: Proposal Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give MCs real proposal analytics: which v2 sections couples read and where they leave, how packages compare, what device they read on, how each template performs, and an account strip on `/proposals`, replacing every `SAMPLE_*` placeholder.

**Architecture:** The public tracker learns v2 section and page ids, so `section_viewed` rows exist for Layout v2 proposals (today they never do). Per-proposal aggregation stays pure TypeScript over `proposal_events` rows, moved into a new `features/proposals/analytics/` module. Cross-proposal figures (per template, per account) come from two new `security invoker` SQL functions, so RLS scopes them and nothing is computed from the fetched list.

**Tech Stack:** Next.js 16 App Router, React 19, TanStack Query, Supabase (Postgres, RLS), Zod, Vitest (unit + integration on local Supabase), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-20-proposals-completion-roadmap-design.md` §7 (R4), with the L-table in §2. Read both.

**Branch / worktree:** `feature/r4-proposal-analytics` in `.claude/worktrees/r4-analytics`, based on `fix/proposal-modal-templates` (R3 slice, PR #140), because R4 reads `proposals.template_id`, which only R3 writes. The PR targets `staging` once #140 merges; until then it is stacked on it.

## Global Constraints

- Design system is mandatory: tokens and `components/ui/` primitives only. No `text-sm`, `text-xs`, `rounded-lg`, raw grays or hex colours. Bars keep the existing token CSS-bar pattern (`bg-surface-muted` track, `bg-brand-fg` fill, width as the one inline style).
- **Charts:** the spec says "charts on the shared recharts patterns". The only recharts uses in the app (`dashboard-revenue-chart.tsx`, `metric-chart-card.tsx`) hardcode hex colours, which is off-token. This plan keeps the token CSS bars already on the detail page and adds no recharts chart. Every figure here is a ranked list or a small count, which a bar list shows better than a plotted chart anyway. Say so in the PR.
- TSDoc on every exported symbol; why-comments on non-obvious logic (`CONTRIBUTING.md`).
- No em dashes anywhere: copy, comments, docs, commit messages.
- Components at most about 150 lines; pages stay orchestrators.
- `npm run typecheck` stays at 0; `typecheck:strict:gate` 237 and `lint:gate` 43 errors / 67 warnings must not rise (ratchet down if they fall).
- Explicit loading, empty and error states on every new surface.
- Works at phone width.
- Anonymous input is hostile: every payload field read from `proposal_events` is read defensively (the existing `num` / `str` / `obj` helpers), never trusted as typed.
- The owner's own preview never counts. `record_proposal_events` already no-ops when `auth.uid()` owns the proposal. **Do not use `proposals.first_viewed_at` for time-to-open**: `get_public_proposal` stamps it with no owner check, so an MC previewing their own link would read as the couple opening it.
- Migration timestamp `20261025000000` (the highest in any worktree is `20261024800000`).
- The feature flag `NEXT_PUBLIC_PROPOSAL_LAYOUT_V2` (`app/(dashboard)/proposals/flags.ts`, `proposalLayoutV2Enabled()`) still gates the v2-only surfaces it gates today.
- Commit after each task (the user has allowed commits for this batch). Message style: `feat(proposals): ...`, ending with the `Co-Authored-By` trailer.

## Definitions (use these exact meanings everywhere)

- **Sent:** `status <> 'draft'`. Also true of a `sent` proposal whose email failed: the link is live.
- **Accepted:** `accepted_at is not null`.
- **Acceptance / win rate:** accepted ÷ sent, a whole percentage; `null` when sent is 0 (0/0 is not 0%).
- **Revenue accepted:** per accepted proposal, `coalesce(invoice subtotal, accepted option subtotal)`. This is the same expression R2's lifecycle trigger uses for `total` (`invoices.subtotal` where `id = invoice_id and user_id = proposal.user_id`, else `proposal_options.subtotal` where `id = accepted_option_id and proposal_id = proposal.id`).
- **Time to open:** first `opened` row in `proposal_events` for the proposal, minus `email_sent_at`. Proposals with no `email_sent_at`, or with no `opened` row, are left out. Negative gaps (an open before the email, i.e. a link shared by hand) are left out. Median, in seconds.
- **This month:** from the start of the calendar month in the MC's timezone (`user_public_settings.timezone`, default `Australia/Sydney`) to now.
- **Section reach:** among all sessions for the proposal, the share that viewed that section **or any later section** (reach can only fall down the page). Sessions = distinct `session_id` across all rows, the same rule `summarizeEngagement` uses.
- **Device:** read once per session from the `opened` payload's `device` (`phone` / `tablet` / `desktop`). Sessions without it count as `unknown`, which covers every v1-era row.

## Review Focus

1. **A proposal in "One at a time" step flow.** Every page is mounted (the layout renders all pages and snaps between them), so section observation works, but the `pageId` must come from the section's closest `[data-page-id]`. A section in scroll flow has no page and sends no `pageId`. Test both in Task 1.
2. **Rows from before this change.** v1 `section_viewed` rows carry `blockId` / `blockType`, and v1-era `opened` rows have `{}`. Every aggregation must accept both shapes. A v1 row must never crash the v2 section report, and an unknown section id (a section deleted after it was read) is dropped from the ordered report rather than shown as a nameless row. Tests in Tasks 2 and 5.
3. **A proposal nobody has opened yet, and a template never sent.** The report must render the empty state, never `NaN%`, `0%`, or a divide-by-zero. Tests in Tasks 2, 3 and 4.
4. **Another tenant's data.** Both new SQL functions are `security invoker`, so RLS scopes them. Integration tests prove that user B sees none of user A's proposals, and that `anon` cannot execute either one (Task 3).
5. **The MC previewing their own proposal.** The owner no-op means no rows. Time-to-open must not use `first_viewed_at` (see Global Constraints). Task 3 has a test where `first_viewed_at` is set but no `opened` event exists: time-to-open must be null.

---

## File map

**Create**
- `features/proposals/analytics/summary.ts`: `summarizeEngagement`, `sectionTotals`, row readers (moved from `lib/proposals/engagement.ts`).
- `features/proposals/analytics/sessions.ts`: `sessionTimelines` (moved from `lib/proposals/engagement-sessions.ts`).
- `features/proposals/analytics/labels.ts`: `blockTypeLabel`, `stepLabel`, `formatSeconds` (moved from `lib/proposals/engagement-labels.ts`).
- `features/proposals/analytics/types.ts`: `SectionEngagementRow`, `PackageEngagementRow`, `TemplateStats`, `DeviceSplit`, `AccountSummary`, `acceptanceRate`.
- `features/proposals/analytics/reports.ts`: `sectionReport`, `packageReport`, `deviceSplit`.
- `features/proposals/analytics/data.ts`: `'use server'` actions `getAccountSummaryAction`, `getTemplatePerformanceAction`.
- `features/proposals/analytics/index.ts`: nothing; the module is exported through `features/proposals/index.ts`.
- `supabase/migrations/20261025000000_proposal_analytics_rpcs.sql`
- `app/(dashboard)/proposals/use-proposal-analytics.ts`: React Query hooks.
- `app/(dashboard)/proposals/[id]/proposal-device-split.tsx`
- Tests listed per task.

**Modify**
- `lib/proposals/engagement-events.ts`: wire schema (v2 section payload, `opened.device`).
- `app/proposal/[token]/_components/engagement-tracker.tsx`: observe v2 sections, send device.
- `lib/proposals/engagement.ts`, `engagement-sessions.ts`, `engagement-labels.ts`: become one-line re-export shims (R5 deletes them).
- `features/proposals/index.ts`: export the analytics API.
- `app/(dashboard)/proposals/use-proposals.ts`: detail select gains `layout, accepted_option_id`.
- `app/(dashboard)/proposals/[id]/proposal-engagement.tsx`, `proposal-engagement-timeline.tsx`, `proposal-section-engagement.tsx`, `proposal-package-comparison.tsx`: real data.
- `app/(dashboard)/proposals/proposals-stats-row.tsx`, `page.tsx`: the account strip.
- `app/(dashboard)/proposals/proposal-templates-shortcut.tsx`, `templates/template-stats-chips.tsx`: real per-template figures.

**Delete**
- `app/(dashboard)/proposals/analytics-placeholders.ts` and its test `tests/unit/app/proposals/analytics-placeholders.test.tsx` (replace with tests of the real code).
- `app/(dashboard)/proposals/proposals-stats.ts` and `tests/unit/app/proposals/proposals-stats.test.ts`.

---

### Task 1: The tracker records v2 sections, page ids and device

**Files:**
- Modify: `lib/proposals/engagement-events.ts`
- Modify: `app/proposal/[token]/_components/engagement-tracker.tsx`
- Test: `tests/unit/lib/proposals/engagement-events.test.ts`, `tests/unit/app/proposal/engagement-tracker.test.tsx`, `tests/unit/app/api/proposal-events-route.test.ts`

**Interfaces:**
- Produces: `section_viewed` payload is **either** `{ blockId, blockType, seconds }` (v1) **or** `{ sectionId, sectionKind, pageId?, seconds }` (v2). `opened` payload is `{ device?: 'phone' | 'tablet' | 'desktop' }`. Exported type `DeviceKind = 'phone' | 'tablet' | 'desktop'` and `DEVICE_KINDS`.

Why no migration: `record_proposal_events` stores `payload` as given (it checks only size ≤ 2048 bytes and clamps `seconds`). The strict Zod in the route is the only gate that needs widening.

- [ ] **Step 1: Failing schema tests.** Add to `engagement-events.test.ts`:

```ts
it('accepts a v2 section_viewed with a page id', () => {
  const r = engagementEventSchema.safeParse({ id: 'e1', type: 'section_viewed', payload: { sectionId: 's-1', sectionKind: 'content', pageId: 'p-1', seconds: 4 } })
  expect(r.success).toBe(true)
})
it('accepts a v2 section_viewed without a page id (scroll flow)', () => {
  expect(engagementEventSchema.safeParse({ id: 'e1', type: 'section_viewed', payload: { sectionId: 's-1', sectionKind: 'faq', seconds: 4 } }).success).toBe(true)
})
it('still accepts a v1 section_viewed', () => {
  expect(engagementEventSchema.safeParse({ id: 'e1', type: 'section_viewed', payload: { blockId: 'b', blockType: 'hero', seconds: 1 } }).success).toBe(true)
})
it('rejects a section_viewed mixing v1 and v2 keys', () => {
  expect(engagementEventSchema.safeParse({ id: 'e1', type: 'section_viewed', payload: { blockId: 'b', sectionId: 's', blockType: 'hero', seconds: 1 } }).success).toBe(false)
})
it('accepts opened with a device, and with none', () => {
  expect(engagementEventSchema.safeParse({ id: 'e1', type: 'opened', payload: { device: 'phone' } }).success).toBe(true)
  expect(engagementEventSchema.safeParse({ id: 'e1', type: 'opened', payload: {} }).success).toBe(true)
})
it('rejects an unknown device', () => {
  expect(engagementEventSchema.safeParse({ id: 'e1', type: 'opened', payload: { device: 'fridge' } }).success).toBe(false)
})
```

- [ ] **Step 2: Run, expect failures.** `npx vitest run --project unit tests/unit/lib/proposals/engagement-events.test.ts`

- [ ] **Step 3: Implement.** In `engagement-events.ts`:

```ts
/** Coarse device class, read once per session from the viewport when the page opens. */
export const DEVICE_KINDS = ['phone', 'tablet', 'desktop'] as const
/** See {@link DEVICE_KINDS}. */
export type DeviceKind = (typeof DEVICE_KINDS)[number]
```

Change the union members:

```ts
  | { type: 'opened'; payload: { device?: DeviceKind } }
  | {
      type: 'section_viewed'
      payload:
        | { blockId: string; blockType: string; seconds: number }
        | { sectionId: string; sectionKind: string; pageId?: string; seconds: number }
    }
```

and the schema members:

```ts
  z.object({ id, type: z.literal('opened'), payload: z.object({ device: z.enum(DEVICE_KINDS).optional() }).strict() }),
  z.object({
    id,
    type: z.literal('section_viewed'),
    // v1 (block tree) and v2 (Layout v2 sections) both ride this type, so
    // rows written before and after R4 aggregate together. `.strict()` on
    // each side stops a payload mixing the two shapes.
    payload: z.union([
      z.object({ blockId: id, blockType: id, seconds }).strict(),
      z.object({ sectionId: id, sectionKind: id, pageId: id.optional(), seconds }).strict(),
    ]),
  }),
```

Update the module doc's payload table.

- [ ] **Step 4: Tracker test (failing first).** In `engagement-tracker.test.tsx`, following its existing IntersectionObserver mock, render:

```tsx
<div data-page-id="p-1"><section data-section-id="s-1" data-section-kind="content" /></div>
<section data-section-id="s-2" data-section-kind="faq" />
```

Make `s-1` and `s-2` intersect at ratio 1, advance timers past `FLUSH_MS`, and assert the posted batch contains:

```ts
expect.objectContaining({ type: 'section_viewed', payload: { sectionId: 's-1', sectionKind: 'content', pageId: 'p-1', seconds: expect.any(Number) } })
expect.objectContaining({ type: 'section_viewed', payload: { sectionId: 's-2', sectionKind: 'faq', seconds: expect.any(Number) } })
```

and that the `opened` event carries `payload: { device: 'desktop' }` when `window.innerWidth` is 1280. Add a second case: `innerWidth = 390` gives `'phone'`, `innerWidth = 800` gives `'tablet'`. Keep the existing v1 `[data-block-id]` test passing unchanged.

- [ ] **Step 5: Implement in the tracker.**

```ts
/**
 * Coarse device class from the viewport width at open. Width, not user
 * agent: it is what decides the layout the couple actually saw, and it
 * needs no parsing. Breakpoints match Tailwind's `sm` (640) and `lg` (1024).
 */
export function deviceKind(width: number): DeviceKind {
  if (width < 640) return 'phone'
  if (width < 1024) return 'tablet'
  return 'desktop'
}
```

Queue `opened` as `{ id: newEventId(), type: 'opened', payload: { device: deviceKind(window.innerWidth) } }`.

Add a second section ledger for v2 (`v2Sections = visibleSecondsLedger()`, `visibleV2 = new Set<string>()`, `v2Meta = new Map<string, { kind: string; pageId?: string }>()`), observed with:

```ts
const disconnectV2 = observe('[data-section-id]', 'data-section-id', 0.5, v2Sections, visibleV2, (id, el) => {
  const pageId = el.closest('[data-page-id]')?.getAttribute('data-page-id') ?? undefined
  v2Meta.set(id, { kind: el.getAttribute('data-section-kind') ?? 'unknown', ...(pageId ? { pageId } : {}) })
})
```

In `flush`, drain it into `section_viewed` events with `payload: { sectionId: s.id, sectionKind: meta.kind, ...(meta.pageId ? { pageId: meta.pageId } : {}), seconds: s.seconds }`. Spreading `pageId` conditionally keeps the payload valid under `exactOptionalPropertyTypes`. Pause and resume it in `onVisibility` like the other two ledgers, and disconnect it on cleanup. A v1 page has no `[data-section-id]` and a v2 page has no `[data-block-id]`, so the two never double-count. Keep the file at or under about 150 lines: move `deviceKind` into `engagement-session.ts` if it tips over.

- [ ] **Step 6: Route test.** In `proposal-events-route.test.ts`, add a case posting one v2 `section_viewed` and asserting the RPC mock receives it unchanged.

- [ ] **Step 7: Run.** `npx vitest run --project unit tests/unit/lib/proposals tests/unit/app/proposal tests/unit/app/api/proposal-events-route.test.ts`, then expect PASS. Run `npm run typecheck`.

- [ ] **Step 8: Commit.** `feat(proposals): record v2 section, page and device engagement`

---

### Task 2: The analytics module and its pure reports

**Files:**
- Create: `features/proposals/analytics/{summary,sessions,labels,types,reports}.ts`
- Modify: `lib/proposals/engagement.ts`, `lib/proposals/engagement-sessions.ts`, `lib/proposals/engagement-labels.ts` (shims), `features/proposals/index.ts`
- Test: `tests/unit/features/proposals/analytics/reports.test.ts`, `tests/unit/features/proposals/analytics/summary.test.ts` (move `tests/unit/lib/proposals/engagement.test.ts` here, and `engagement-labels.test.ts` to `labels.test.ts`, updating imports)

**Interfaces:**
- Consumes: the Task 1 payload shapes.
- Produces (all exported from `@/features/proposals`):

```ts
export interface SectionSeconds { id: string; kind: string; seconds: number }   // replaces { blockId, blockType, seconds }
export function sectionTotals(rows: EngagementRow[]): SectionSeconds[]
export function summarizeEngagement(rows: EngagementRow[]): EngagementSummary      // sections: SectionSeconds[]
export function sessionTimelines(rows: EngagementRow[], limit?: number): SessionTimeline[]
export interface SectionEngagementRow { id: string; label: string; seconds: number; reachPct: number }
export interface PackageEngagementRow { optionId: string; title: string; views: number; seconds: number; chosen: boolean }
export interface TemplateStats { sent: number; accepted: number; revenue: number; medianOpenSeconds: number | null }
export interface DeviceSplit { phone: number; tablet: number; desktop: number; unknown: number }
export interface AccountSummary { sent: number; accepted: number; acceptancePct: number | null; medianOpenSeconds: number | null; revenueThisMonth: number }
export function acceptanceRate(stats: Pick<TemplateStats, 'sent' | 'accepted'>): number | null
export function sectionReport(rows: EngagementRow[], sections: ReadonlyArray<{ id: string; label: string }>): SectionEngagementRow[]
export function packageReport(rows: EngagementRow[], options: ReadonlyArray<{ id: string; title: string; position: number }>, acceptedOptionId: string | null): PackageEngagementRow[]
export function deviceSplit(rows: EngagementRow[]): DeviceSplit
export { blockTypeLabel, stepLabel, formatSeconds } from './labels'
export type { EngagementRow, EngagementSummary, SessionTimeline }
```

- [ ] **Step 1: Move the files with `git mv`** so history follows: `lib/proposals/engagement.ts` to `features/proposals/analytics/summary.ts`, `engagement-sessions.ts` to `sessions.ts`, `engagement-labels.ts` to `labels.ts`. Recreate each `lib/proposals/engagement*.ts` as a shim:

```ts
/**
 * Moved to `features/proposals/analytics` (R4). Kept as a re-export so
 * callers outside the proposals feature keep compiling; R5 deletes it.
 *
 * @module lib/proposals/engagement
 */
export * from '@/features/proposals/analytics/summary'
```

(`lib/**` is exempt from the feature-module import rule.) Leave `lib/proposals/engagement-events.ts` where it is: it is the wire contract shared with the public route.

- [ ] **Step 2: Generalise `sectionTotals`.** In `summary.ts`, read either shape:

```ts
// v1 rows name the block, v2 rows the Layout v2 section. Both are "a
// section of the page" to the MC, so they fold into one id / kind pair.
const id = str(p.sectionId) ?? str(p.blockId)
if (!id) continue
const kind = str(p.sectionKind) ?? str(p.blockType) ?? 'unknown'
```

Rename the fields to `{ id, kind, seconds }`. Update `sessions.ts` and every consumer (`proposal-engagement.tsx`, `proposal-engagement-timeline.tsx`): `s.blockId` becomes `s.id`, `s.blockType` becomes `s.kind`. Run `npm run typecheck` to find them all.

- [ ] **Step 3: Write `types.ts`**, moving `SectionEngagementRow`, `PackageEngagementRow`, `TemplateStats` and `acceptanceRate` out of `app/(dashboard)/proposals/analytics-placeholders.ts` (add `medianOpenSeconds` to `TemplateStats`, and add `DeviceSplit`, `AccountSummary`). Do not delete the placeholders file yet: Tasks 4 and 5 remove its last users.

- [ ] **Step 4: Failing tests for the reports** (`reports.test.ts`). The fixture helper:

```ts
const row = (session_id: string, type: string, payload: unknown, created_at = '2026-09-30T00:00:00Z'): EngagementRow => ({ session_id, type, payload, created_at })
const sections = [{ id: 'a', label: 'Cover' }, { id: 'b', label: 'Packages' }, { id: 'c', label: 'FAQ' }]
```

Cases:
- `sectionReport` over sessions S1 (viewed a, b, c), S2 (viewed a, b), S3 (viewed a) returns rows in page order `a, b, c` with `reachPct` 100, 67, 33 and summed seconds.
- A session that viewed only `c` counts as reaching `a` and `b` too (reach is "this or any later section").
- A row for a section id not in `sections` is ignored; a v1 row (`blockId`) is ignored by the v2 report without throwing.
- No rows: every section gets `seconds: 0, reachPct: 0`.
- Malformed payloads (`null`, a string, `seconds: -5`, `seconds: 'x'`) count 0 seconds and never throw.
- `packageReport`: `views` = distinct sessions with a `package_viewed` for the option; `seconds` summed; `chosen` true only for `acceptedOptionId`; when `acceptedOptionId` is null, `chosen` is the option of the latest `package_selected` row, else none. Rows come back in `position` order and include options nobody viewed (views 0).
- `deviceSplit`: counts **sessions** by their `opened` row's `device`; a session with two `opened` rows counts once; sessions with no device, or no `opened` row at all, are `unknown`.
- `acceptanceRate({ sent: 0, accepted: 0 })` is `null`; `{ sent: 3, accepted: 1 }` is `33`.

- [ ] **Step 5: Implement `reports.ts`.**

```ts
/**
 * Reading depth by section for one v2 proposal, in page order. `reachPct`
 * is the share of sessions that saw this section or any later one: a
 * reader who jumped straight to the packages still scrolled past the
 * cover, and counting them there keeps reach falling down the page, so
 * the biggest step down is where readers really leave.
 */
export function sectionReport(rows: EngagementRow[], sections: ReadonlyArray<{ id: string; label: string }>): SectionEngagementRow[] {
  const index = new Map(sections.map((s, i) => [s.id, i]))
  const seconds = new Array<number>(sections.length).fill(0)
  const deepest = new Map<string, number>()
  const sessions = new Set<string>()
  for (const r of rows) {
    sessions.add(r.session_id)
    if (r.type !== 'section_viewed') continue
    const p = obj(r.payload)
    const at = index.get(str(p.sectionId) ?? '')
    if (at === undefined) continue
    seconds[at] = (seconds[at] ?? 0) + num(p.seconds)
    deepest.set(r.session_id, Math.max(deepest.get(r.session_id) ?? -1, at))
  }
  const total = sessions.size
  return sections.map((s, i) => {
    let reached = 0
    for (const d of deepest.values()) if (d >= i) reached += 1
    return { id: s.id, label: s.label, seconds: seconds[i] ?? 0, reachPct: total === 0 ? 0 : Math.round((reached / total) * 100) }
  })
}
```

`num`, `str` and `obj` move into a small `features/proposals/analytics/read.ts` shared by `summary.ts` and `reports.ts`, with the existing why-comment. Write `packageReport` and `deviceSplit` to the cases in Step 4.

- [ ] **Step 6: Export from `features/proposals/index.ts`** under a new `// analytics/` group, with the names in the Interfaces block. Update that file's header line "Later phases add the builder and analytics".

- [ ] **Step 7: Run** `npx vitest run --project unit tests/unit/features/proposals/analytics tests/unit/app/proposals`, then `npm run typecheck` and `npm run lint:gate`.

- [ ] **Step 8: Commit.** `feat(proposals): analytics module with section, package and device reports`

---

### Task 3: Per-template and account SQL functions

**Files:**
- Create: `supabase/migrations/20261025000000_proposal_analytics_rpcs.sql`
- Test: `tests/integration/proposals/analytics-rpcs.test.ts`
- Modify: `types/database.ts` (regenerate; see Step 4)

**Interfaces:**
- Produces:
  - `proposal_template_performance()` returns `table (template_id uuid, sent int, accepted int, revenue numeric, median_open_seconds numeric)`, one row per `template_id` the caller has sent at least one proposal from.
  - `proposal_account_summary()` returns `table (sent int, accepted int, revenue_this_month numeric, median_open_seconds numeric)`, exactly one row.

- [ ] **Step 1: Failing integration test.** Copy the setup of `tests/integration/proposals/record-proposal-events.test.ts` (`createTestUser`, a couple, `seed`). Two users, A and B. For A, seed through `user.client`:
  - a template T (insert into `proposal_templates` the way `tests/integration/proposals/create-from-template.test.ts` does);
  - P1: `template_id T`, `status 'accepted'`, `email_sent_at` = now minus 2 hours, `accepted_at` = now, one option with `subtotal 1000` set as `accepted_option_id`, no invoice;
  - P2: `template_id T`, `status 'sent'`, `email_sent_at` = now minus 1 hour;
  - P3: `template_id T`, `status 'draft'`;
  - P4: no template, `status 'viewed'`, `first_viewed_at` set, `email_sent_at` set, and **no** `opened` event.

  Record `opened` events through `anonClient().rpc('record_proposal_events', ...)` for P1 (one hour after its `email_sent_at` is not settable, since the row's `created_at` is now, so assert on what now implies: P1's gap is about 2 hours, P2's about 1 hour).

  Assert, calling as A:
  - `proposal_template_performance()` returns one row for T: `sent 2, accepted 1, revenue 1000`, `median_open_seconds` between 5000 and 5900 (the median of about 7200 and about 3600).
  - `proposal_account_summary()`: `sent 3, accepted 1, revenue_this_month 1000`; P4 contributes nothing to the median.
  - Called as B: template performance has no rows; account summary is `sent 0, accepted 0, revenue_this_month 0, median_open_seconds null`.
  - Called with `anonClient()`: both return an error (permission denied).
  - Revenue prefers the invoice: give P1 an invoice with `subtotal 1200` (insert one owned by A, set `invoice_id`), and revenue becomes 1200.

- [ ] **Step 2: Run, expect failure.** `npx vitest run --project integration tests/integration/proposals/analytics-rpcs.test.ts` (functions do not exist). If every test reports "permission denied" on plain table inserts, the local DB has lost its grants: see memory note `local_db_reset_grant_breakage` and run its repair SQL.

- [ ] **Step 3: Write the migration.**

```sql
-- R4: cross-proposal analytics for the /proposals page.
--
-- Both functions are SECURITY INVOKER: they read only through the caller's
-- RLS (proposals, proposal_options, invoices, proposal_events are all
-- owner-scoped), so there is no tenant filter to get wrong here and no
-- second-factor ratchet entry (require-mfa-coverage only tracks DEFINER).
--
-- Time to open is the first `opened` row in proposal_events, never
-- proposals.first_viewed_at: get_public_proposal stamps that column with
-- no owner check, so an MC previewing their own link would read as the
-- couple opening it, while record_proposal_events already drops the
-- owner's own events.

create or replace function public._proposal_open_gaps()
returns table (proposal_id uuid, template_id uuid, gap_seconds numeric)
language sql stable security invoker set search_path = public
as $$
  select p.id, p.template_id,
         extract(epoch from (min(e.created_at) - p.email_sent_at))
  from public.proposals p
  join public.proposal_events e on e.proposal_id = p.id and e.type = 'opened'
  where p.email_sent_at is not null
  group by p.id, p.template_id, p.email_sent_at
  -- A negative gap is a link shared by hand before the email went out;
  -- it says nothing about how fast the email was opened.
  having min(e.created_at) >= p.email_sent_at
$$;

create or replace function public._proposal_revenue()
returns table (proposal_id uuid, template_id uuid, accepted_at timestamptz, revenue numeric)
language sql stable security invoker set search_path = public
as $$
  -- Same expression as R2's proposal_accepted `total`: the invoice the
  -- acceptance produced when there is one, else the chosen package.
  select p.id, p.template_id, p.accepted_at,
         coalesce(
           (select i.subtotal from public.invoices i where i.id = p.invoice_id and i.user_id = p.user_id),
           (select o.subtotal from public.proposal_options o where o.id = p.accepted_option_id and o.proposal_id = p.id),
           0)
  from public.proposals p
  where p.accepted_at is not null
$$;

create or replace function public.proposal_template_performance()
returns table (template_id uuid, sent int, accepted int, revenue numeric, median_open_seconds numeric)
language sql stable security invoker set search_path = public
as $$
  select p.template_id,
         count(*) filter (where p.status <> 'draft')::int,
         count(*) filter (where p.accepted_at is not null)::int,
         coalesce((select sum(r.revenue) from public._proposal_revenue() r where r.template_id = p.template_id), 0),
         (select percentile_cont(0.5) within group (order by g.gap_seconds)
            from public._proposal_open_gaps() g where g.template_id = p.template_id)::numeric
  from public.proposals p
  where p.template_id is not null
  group by p.template_id
  having count(*) filter (where p.status <> 'draft') > 0
$$;

create or replace function public.proposal_account_summary()
returns table (sent int, accepted int, revenue_this_month numeric, median_open_seconds numeric)
language sql stable security invoker set search_path = public
as $$
  with tz as (
    select coalesce(
      (select s.timezone from public.user_public_settings s where s.user_id = auth.uid()),
      'Australia/Sydney') as name
  ),
  month_start as (
    -- The MC's calendar month, not UTC's: "this month" on the 1st at 9am
    -- in Sydney must not still be last month.
    select (date_trunc('month', now() at time zone tz.name) at time zone tz.name) as at from tz
  )
  select
    (select count(*) from public.proposals p where p.status <> 'draft')::int,
    (select count(*) from public.proposals p where p.accepted_at is not null)::int,
    coalesce((select sum(r.revenue) from public._proposal_revenue() r, month_start m where r.accepted_at >= m.at), 0),
    (select percentile_cont(0.5) within group (order by g.gap_seconds) from public._proposal_open_gaps() g)::numeric
$$;

revoke all on function public._proposal_open_gaps() from public, anon;
revoke all on function public._proposal_revenue() from public, anon;
revoke all on function public.proposal_template_performance() from public, anon;
revoke all on function public.proposal_account_summary() from public, anon;
grant execute on function public._proposal_open_gaps() to authenticated;
grant execute on function public._proposal_revenue() to authenticated;
grant execute on function public.proposal_template_performance() to authenticated;
grant execute on function public.proposal_account_summary() to authenticated;
```

`user_public_settings.timezone` is free text (`20260819000000_create_scheduling_tables.sql:81`), and `at time zone` raises on an unknown name, which would break the whole strip for that MC. So the `tz` CTE must only take the stored value when `exists (select 1 from pg_timezone_names n where n.name = s.timezone)`, else `'Australia/Sydney'`. Add an integration case that sets A's timezone to `'Not/AZone'` and still gets a row back. Owner select on `user_public_settings` is `20260621000000_create_user_public_settings.sql:59`.

- [ ] **Step 4: Apply locally and regenerate types.** Apply with `supabase migration up --local` (or the method in `.claude/docs/cicd.md`). Regenerate `types/database.ts` per the memory note `supabase_cli_partial_reset`: generate to a temp file with `--db-url`, then diff. Only the new functions should appear. Another session's migrations on the shared local DB may add unrelated entries: strip those from the diff by hand.

- [ ] **Step 5: Run** the integration test, expect PASS. Also run `tests/integration/rls/require-mfa-coverage.test.ts`: it must still pass (these are invoker functions).

- [ ] **Step 6: Docs.** Add both functions to `.claude/docs/database-schema.md` (proposals section) and to the RPC table in `.claude/docs/security.md` with "invoker, RLS-scoped, anon revoked".

- [ ] **Step 7: Commit.** `feat(proposals): per-template and account analytics functions`

---

### Task 4: Account strip and real template figures on /proposals

**Files:**
- Create: `features/proposals/analytics/data.ts`, `app/(dashboard)/proposals/use-proposal-analytics.ts`
- Modify: `app/(dashboard)/proposals/proposals-stats-row.tsx`, `app/(dashboard)/proposals/page.tsx`, `app/(dashboard)/proposals/proposal-templates-shortcut.tsx`, `app/(dashboard)/proposals/templates/template-stats-chips.tsx`, `features/proposals/index.ts`
- Delete: `app/(dashboard)/proposals/proposals-stats.ts`, `tests/unit/app/proposals/proposals-stats.test.ts`, `SAMPLE_TEMPLATE_STATS` (and its test cases)
- Test: `tests/unit/app/proposals/proposals-stats-row.test.tsx`, `tests/unit/app/proposals/template-stats-chips.test.tsx`

**Interfaces:**
- Consumes: Task 3 functions; `AccountSummary`, `TemplateStats`, `acceptanceRate` from Task 2.
- Produces:

```ts
// features/proposals/analytics/data.ts ('use server')
export async function getAccountSummaryAction(): Promise<{ ok: true; summary: AccountSummary } | Fail>
export async function getTemplatePerformanceAction(): Promise<{ ok: true; byTemplate: Record<string, TemplateStats> } | Fail>
// app/(dashboard)/proposals/use-proposal-analytics.ts
export function useAccountSummary(): UseQueryResult<AccountSummary>
export function useTemplatePerformance(): UseQueryResult<Record<string, TemplateStats>>
```

Follow `features/proposals/data/templates.ts` for the action shape (the `Fail` type, `createClient()` from `@/lib/supabase/server`, no client parameter, and no Zod: these take no input). Convert `numeric` columns with `Number(...)` and round revenue to whole dollars. The hooks throw on `ok: false` so React Query's `error` drives the ErrorState. Query keys `['proposal-analytics', 'account']` and `['proposal-analytics', 'templates']`. Invalidate both wherever the proposals list is invalidated after a send (grep `PROPOSALS_QUERY_KEY` invalidations).

- [ ] **Step 1: Failing component tests.**
  - `ProposalsStatsRow` given `summary = { sent: 3, accepted: 1, acceptancePct: 33, medianOpenSeconds: 5400, revenueThisMonth: 1000 }` renders "33%" labelled "Acceptance rate", "1h 30m" labelled "Median time to open", "$1,000" labelled "Accepted this month".
  - With `acceptancePct: null` and `medianOpenSeconds: null` it renders an en dash placeholder "–" (not "0%" or "0s") with a tooltip "Nothing sent yet" / "No opens yet".
  - `loading` renders the existing skeleton; `error` renders `ErrorState` with a retry.
  - `TemplateStatsChips` with `{ sent: 2, accepted: 1, revenue: 1000, medianOpenSeconds: 5400 }` renders the three existing chips plus a clock chip labelled "Opened in 1h 30m (median)". It renders nothing with `sent: 0`, and no clock chip when `medianOpenSeconds` is null.

- [ ] **Step 2: Implement.** Replace `CARDS` in `proposals-stats-row.tsx` with three cards (Acceptance rate: `CircleCheck`, success tone; Median time to open: `Clock`, info tone; Accepted this month: `DollarSign`, success tone). The grid becomes `grid-cols-1 sm:grid-cols-3`. Props become `{ summary: AccountSummary | undefined; loading: boolean; error: unknown; onRetry: () => void }`. Add a duration formatter to `features/proposals/analytics/labels.ts`:

```ts
/** "45m", "1h 30m", "2d 4h": a time-to-open, coarse on purpose (seconds are noise at this scale). */
export function formatDuration(seconds: number): string
```

with its own unit tests (0 gives "0m", 59 gives "0m", 5400 gives "1h 30m", 190000 gives "2d 4h").

In `page.tsx`, replace `computeProposalStats(...)` with `useAccountSummary()`. The flag gate stays.

In `proposal-templates-shortcut.tsx`, call `useTemplatePerformance()` and pass `stats={perf.data?.[t.id] ?? EMPTY_STATS}`. When the performance query fails, pass `EMPTY_STATS` (the card grid must not fail because the figures did), log nothing, and let the chips simply not render. Delete the placeholder comment and `SAMPLE_TEMPLATE_STATS`. Update the `TemplateStatsChips` module doc (it is real data now).

- [ ] **Step 3: Delete** `proposals-stats.ts` and its test.

- [ ] **Step 4: Run** `npx vitest run --project unit tests/unit/app/proposals tests/unit/features/proposals`, `npm run typecheck`, `npm run lint:gate`.

- [ ] **Step 5: Commit.** `feat(proposals): real account strip and per-template figures`

---

### Task 5: Per-proposal drill-down on v2

**Files:**
- Modify: `app/(dashboard)/proposals/use-proposals.ts` (detail select gains `layout, accepted_option_id`; `ProposalDetailRow` gains `layout: Json | null; accepted_option_id: string | null`)
- Modify: `app/(dashboard)/proposals/[id]/proposal-engagement.tsx`, `proposal-section-engagement.tsx`, `proposal-package-comparison.tsx`, `proposal-engagement-timeline.tsx`
- Create: `app/(dashboard)/proposals/[id]/proposal-device-split.tsx`
- Delete: `app/(dashboard)/proposals/analytics-placeholders.ts` and `tests/unit/app/proposals/analytics-placeholders.test.tsx`
- Test: `tests/unit/app/proposals/proposal-engagement.test.tsx` (extend), `tests/unit/app/proposals/proposal-device-split.test.tsx`

**Interfaces:**
- Consumes: `sectionReport`, `packageReport`, `deviceSplit`, `sectionLabel` (`features/proposals/model/section-labels.ts`, exported from `@/features/proposals`; export it if it is not), and the layout parser the design page already uses to read `proposals.layout` (find it with `grep -rn "parseLayout\|layoutSchema" features/proposals/model`).

- [ ] **Step 1: Failing tests** in `proposal-engagement.test.tsx` (mock `useProposalEvents` as the file already does):
  - A v2 proposal (layout with sections `Cover` content, `Your options` packages, a `pageBreak`, `FAQ` faq) and rows from two sessions renders "Reading by section" with the rows `Cover`, `Your options`, `FAQ` in that order (the page break is excluded), with real seconds and reach, and **no** "Sample data" pill.
  - The packages list uses the proposal's option titles, marks `accepted_option_id` "Chosen", and has no "Sample data" pill.
  - A device line reads "2 sessions: 1 phone, 1 desktop" (omit zero buckets; show "unknown" only when it is non-zero).
  - A v1 proposal (`layout: null`) keeps today's top-four bars labelled by `blockTypeLabel`, and shows no "Reading by section" block.
  - A v2 proposal with no rows shows the existing "No opens yet" empty state and no section or package blocks (never a table of zeros).

- [ ] **Step 2: Implement.**
  - `proposal-engagement.tsx`: parse `proposal.layout` once with the existing parser (`useMemo`). If it parses, build `sections = layout.sections.filter(s => s.kind !== 'pageBreak').map(s => ({ id: s.id, label: sectionLabel(s) }))` and render `ProposalSectionEngagement rows={sectionReport(rows, sections)}`, `ProposalPackageComparison rows={packageReport(rows, proposal.proposal_options, proposal.accepted_option_id)}` and `ProposalDeviceSplit split={deviceSplit(rows)}` in place of the flag-gated sample block. For a layout-less proposal, keep today's top-sections bars. All three new blocks render only in the loaded, non-empty branch.
  - Drop the `sample` prop and the "Sample data" pill from `ProposalSectionEngagement` and `ProposalPackageComparison`, and update their module docs (no longer placeholders). Their row types now import from `@/features/proposals`.
  - `ProposalDeviceSplit`: one `text-body text-text-muted` line, `Monitor` / `Smartphone` / `Tablet` Lucide icons at `strokeWidth={1.5}`, under the same heading style as the other two (`text-body font-medium text-text`, "Devices"). About 40 lines.
  - `proposal-engagement-timeline.tsx`: label a v2 section by its layout label when one is passed in (`sectionLabels?: Record<string, string>` prop), else by `blockTypeLabel(kind)`.
  - Keep `proposal-engagement.tsx` within about 150 lines: move `EngagementBody`'s v2 branch into `proposal-engagement-v2.tsx` if needed.

- [ ] **Step 3: Delete** `analytics-placeholders.ts` and its test. `grep -rn "analytics-placeholders\|SAMPLE_" app features` must return nothing.

- [ ] **Step 4: Run** `npx vitest run --project unit tests/unit/app/proposals`, `npm run typecheck`, `npm run typecheck:strict:gate`, `npm run lint:gate`.

- [ ] **Step 5: Commit.** `feat(proposals): real section, package and device drill-down`

---

### Task 6: End-to-end proof, docs, live check

**Files:**
- Create: `tests/e2e/proposal-analytics.spec.ts`
- Modify: `.claude/docs/proposals.md`, `.claude/docs/page-specs.md`, `.claude/docs/testing.md`, `.claude/docs/production-readiness.md`

- [ ] **Step 1: E2E spec.** Model it on `tests/e2e/proposals.spec.ts:129` (skipped unless `TEST_PROPOSAL_TOKEN` is set; that token must belong to a v2 proposal owned by the e2e login).
  1. In a fresh `browser.newContext()` (logged out; a shared context carries the owner's cookies and the owner no-op would swallow every event, see memory `playwright_shared_context_auth`), open `/proposal/<token>`, scroll to the bottom, wait 3 seconds, then close the page, which fires `pagehide` and the beacon flush.
  2. In the authenticated context, open the proposal's detail page and expect `getByRole('heading', { name: 'Reading by section' })` to be visible, and the first section row to show a reach of at least 1%.
  Run on desktop, Pixel 5 and iPhone 12 (the config's projects).

- [ ] **Step 2: Docs.**
  - `proposals.md`: new "R4 analytics" section covering the Definitions block above, the tracker payloads, both SQL functions, and the no-recharts ruling with its reason.
  - `page-specs.md`: `/proposals` (account strip, template chips) and `/proposals/[id]` (drill-down).
  - `testing.md`: the new e2e spec and its env var.
  - `production-readiness.md`: R4 status line.

- [ ] **Step 3: Live check on an isolated dev server** (memory `isolated_dev_server_verification`: a second `next dev` on local Supabase at `127.0.0.1`, a free port, not :3000). Send a proposal from a template, open it logged out on a phone-sized viewport, read a few sections, choose a package, then check:
  - the detail page's sections, reach, packages and device line;
  - `/proposals` strip and the template card chips.
  Screenshot each. Fix anything the unit tests missed, with a test.

- [ ] **Step 4: Full gates.** `npm run typecheck`, `npm run typecheck:strict:gate`, `npm run lint:gate`, `npx vitest run --project unit`, `npx vitest run --project integration tests/integration/proposals tests/integration/rls`. Ratchet the budgets down if they fell.

- [ ] **Step 5: Commit.** `test(proposals): analytics e2e, docs and live check`

- [ ] **Step 6: Whole-branch review** (every proposals phase so far had seam bugs only this caught). Then push and open the PR to `staging`, noting it is stacked on #140 and carries migration `20261025000000`.
