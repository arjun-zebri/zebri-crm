# R2: Proposals in Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a workflow react to a proposal (sent, opened, accepted, declined, expired, expiring soon) and send a couple their draft proposal as a step, so automation works end to end on the v1 proposal data that exists today.

**Architecture:** One `security definer` DB trigger on `proposals` emits the five lifecycle events onto the existing `automation_events` bus with old-to-new guards, because three of the transitions happen inside RPCs the app never sees (L6). `proposal_expiring` is a tick-time emitter like `invoice_due`, and `expire_proposals()` gets its own pg_cron job through the R1 `cron_call` plumbing. The send logic is lifted out of `/api/email/send-proposal` into `lib/proposals/send.ts` so the route and the new `send_proposal` action share one guard set and one side-effect set. Six trigger specs live in their own file and spread into the registry; the shared wedding-date filter helpers move out of `triggers.ts` first so that file can be imported without a cycle.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres 17, pg_cron via the R1 `cron_call`), Zod 4, Vitest 3 (unit + integration against local Supabase), Playwright, React 19, Tailwind 4 tokens and `components/ui` primitives.

**Spec:** `docs/superpowers/specs/2026-09-20-proposals-completion-roadmap-design.md` section 5 (decisions L1, L6, L7, L8, L9, L13). Data model reference: `docs/superpowers/specs/2026-09-12-proposals-engine-design.md`.

## Global Constraints

- The user commits. No task runs `git commit`; each task ends with a checkpoint that reports changed files. Branching is fine. This work lives in the worktree `.claude/worktrees/r2-proposal-workflows` on branch `feature/r2-proposals-in-workflows` (off `origin/staging` 8a0d5f8a).
- All PRs go to `staging` only.
- No em dashes anywhere (code, comments, copy, docs). Use commas, colons or full stops.
- TSDoc on every exported function, type and module; why-comments on non-obvious logic.
- Design system: `components/ui` primitives only, tokens only (`text-body`, `text-text-muted`, `rounded-control`, `bg-surface-emphasis`). No `text-sm`, `text-xs`, `rounded-lg`, `text-gray-*`. Lucide icons `strokeWidth={1.5}`. Controls are all 32px (`h-8`); never hand-set a height.
- Files stay at about 150 lines; split when larger. `lib/automations/triggers.ts` is 1,870 lines already and this plan makes it shorter, not longer: new trigger specs go in `lib/automations/triggers/proposals.ts`.
- New SQL: `security definer` functions `set search_path = public`; revoke execute from `public, anon, authenticated` on anything a role should not call; destructive statements need `-- @ALLOW_DESTRUCTIVE: <reason>` (none are expected here; `drop trigger if exists` before `create trigger` is the replayable idiom the repo already uses and is not flagged).
- `npm run typecheck` must stay at 0. `npm run typecheck:strict` budget is 238 (`scripts/typecheck-strict-gate.mjs`) and `npm run lint:gate` budgets are 43 errors / 68 warnings (`scripts/lint-gate.mjs`); new code must be clean under both, and if a task lowers a count the budget is ratcheted down in the gate script.
- Never read entitlements from `user_metadata`; only `lib/auth/entitlements`. `business_name` / `display_name` are profile fields and stay readable from `user_metadata` (the send route does this today).
- Never reference `SUPABASE_SERVICE_ROLE_KEY` in a `'use client'` file.
- Migrations: local file, applied to local Supabase via `supabase migration up` (or `supabase db push --local`); CI does the remote push. Never the web SQL editor. No `types/database.ts` regeneration is needed in this phase: it adds a trigger function (excluded from generated types) and a cron job, no tables, columns or callable RPCs.
- Integration tests need local Supabase running (`supabase start`). After any `supabase db reset` run `scripts/repair-auth-grants.sql` or every suite skips with "permission denied". The shared local DB carries other worktrees' migrations, so `booking-rpcs` (14) and `branding-overhaul-migration` (1) fail there regardless of branch; ignore those two suites.
- Local `npm run dev` points at the REMOTE zebri-crm-dev project; the migration is not there until CI deploys it. Live checks of new SQL happen on an isolated dev server against local Supabase (memory: `isolated_dev_server_verification`).
- Payload vocabulary is a contract with the TS matchers: `proposal_id, couple_id, proposal_number, title, share_token, event_date` on every proposal event; the extras per event are listed in Task 3.

---

## File map

**New files**

| File | Responsibility |
|---|---|
| `lib/automations/triggers/event-date.ts` | The wedding-date filter family (`daysUntilEventShape`, `eventDateConfigShape`, `daysUntilEventMatches`, `eventDateMatches`, `EventDateConfig`), moved verbatim out of `triggers.ts` |
| `lib/automations/triggers/proposals.ts` | Six `TriggerSpec`s, `proposalMatch`, `proposalExpiringConfig`, `proposalTriggers` map |
| `tests/unit/lib/automations/proposal-triggers.test.ts` | Match narrowing, lead-time narrowing, legacy passthrough, registry + catalogue membership |
| `supabase/migrations/20261002000000_proposal_lifecycle_events.sql` | `tg_proposals_emit_lifecycle()`, the trigger, the `zebri:expire-proposals` pg_cron job |
| `tests/integration/proposals/lifecycle-events.test.ts` | Each guard emits exactly once, never on a touch; payload shape; cross-tenant read denial |
| `app/api/cron/expire-proposals/route.ts` | `isCronAuthorized`, admin client, `expire_proposals()`, `cron_job_failed` alert |
| `tests/unit/app/api/cron/expire-proposals.test.ts` | 401, count, alert + 500 on error |
| `lib/automations/time-emitters/proposal-expiring.ts` | Tick emitter for `proposal_expiring` |
| `tests/unit/lib/automations/time-emitters/proposal-expiring.test.ts` | Lead-time parsing and target-date maths |
| `tests/integration/automations/proposal-expiring-emitter.test.ts` | Emits at the configured lead time, dedupes per day, skips accepted / draft / declined, tenant-isolated |
| `lib/proposals/send.ts` | `SendableProposal`, `proposalSendBlock`, `sendProposalToCouple` |
| `tests/unit/lib/proposals/send.test.ts` | Guard order, the two flips, `couple_emails` source, failure stages |
| `lib/automations/actions/proposals.ts` | `send_proposal` action |
| `tests/unit/lib/automations/actions/send-proposal.test.ts` | Config schema, pick order, skip reasons, output shape |
| `tests/integration/automations/send-proposal-action.test.ts` | Draft flips and emits `proposal_sent`; non-draft skips; no email skips |
| `app/(dashboard)/workflows/[id]/proposal-filters.tsx` | `PROPOSAL_EXPIRING_FILTERS` (lead-time chip + wedding-date family) |
| `docs/superpowers/plans/2026-09-21-r2-proposals-in-workflows.md` | This plan |

**Modified files**

| File | Change |
|---|---|
| `lib/automations/triggers.ts` | Import the moved helpers; spread `proposalTriggers`; `TriggerUi.category` gains `'proposal'` |
| `types/automations.ts` | `TriggerType` + six; `ActionType` + `send_proposal`; `TRIGGER_CATEGORIES` + Proposals |
| `lib/automations/launch-catalogue.ts` | Six triggers + one action visible |
| `lib/automations/time-emitters/index.ts` | Register `proposalExpiringEmitter` |
| `lib/automations/actions/index.ts` | Spread `proposalActions` |
| `lib/automations/actions/ui.ts` | `send_proposal` metadata |
| `lib/automations/audit-log/narrate.ts` | `send_proposal` phrase + noun |
| `lib/automations/variables.ts` | `proposal` namespace, link label, catalogue rows |
| `lib/email/template-variables.ts` | Sample `proposal_link` / `proposal_number` / `proposal_title` for previews |
| `app/api/email/send-proposal/route.ts` | Delegates to `sendProposalToCouple` |
| `app/(dashboard)/workflows/[id]/apply-rule-card-body.tsx` | Chip mapping for the six triggers |
| `app/(dashboard)/workflows/[id]/inspector-panel.tsx` | `send_proposal` is zero-config with a preview modal |
| `app/(dashboard)/workflows/[id]/document-composer-modal.tsx` | `kind="proposal"` |
| `tests/integration/cron/scheduler.test.ts` | Expected job list gains `zebri:expire-proposals` |
| `tests/unit/app/workflows/trigger-filter-defs.test.ts` | Suites for the six triggers |
| `tests/unit/lib/automations/variables.test.ts` | `proposal.*` resolution |
| `tests/unit/lib/automations/audit-log/narrate.test.ts` | `send_proposal` lines |
| `tests/e2e/proposals.spec.ts` | Accept flow applies a "Proposal accepted" workflow |
| `.claude/docs/workflows.md`, `alerts.md`, `security.md`, `proposals.md`, `database-schema.md`, `testing.md` | Reality after R2 |

---

### Task 1: Move the wedding-date filter family out of `triggers.ts`

The six proposal specs need `daysUntilEventShape`, `eventDateConfigShape`, `daysUntilEventMatches` and `eventDateMatches`, which are module-private in `lib/automations/triggers.ts`. A file under `lib/automations/triggers/` that imports them from `../triggers` while `triggers.ts` imports the specs back is a runtime cycle. Moving the helpers into their own module removes it. This is a pure move: no behaviour changes, and the existing contract / event / new-enquiry unit tests are the proof.

**Files:**
- Create: `lib/automations/triggers/event-date.ts`
- Modify: `lib/automations/triggers.ts:107-205` (delete the moved block, add the import)
- Test: existing `tests/unit/lib/automations/swept-triggers.test.ts`, `new-enquiry-trigger.test.ts`, `couple-stage-trigger.test.ts`, `money-triggers.test.ts`

**Interfaces:**
- Produces (all exported from `lib/automations/triggers/event-date.ts`):
  - `daysFromNowMatches(date: string | null, op: ComparisonOp, value: number): boolean`
  - `daysUntilEventMatches(payload: Record<string, unknown>, op: ComparisonOp | undefined, value: number | undefined, field?: string): boolean`
  - `interface EventDateConfig { hasEventDate?: boolean | undefined; dayOfWeek?: DayOfWeekBucket | undefined; eventMonth?: string | undefined; season?: string | undefined }`
  - `eventDateMatches(payload: Record<string, unknown>, config: EventDateConfig, field?: string): boolean`
  - `eventDateConfigShape` and `daysUntilEventShape` (Zod field fragments, same values as today)

- [ ] **Step 1: Run the trigger unit tests to record the green baseline**

Run: `npx vitest run --project unit tests/unit/lib/automations/swept-triggers.test.ts tests/unit/lib/automations/new-enquiry-trigger.test.ts tests/unit/lib/automations/money-triggers.test.ts tests/unit/lib/automations/couple-stage-trigger.test.ts`
Expected: all PASS.

- [ ] **Step 2: Create `lib/automations/triggers/event-date.ts` with the moved code**

Copy the bodies verbatim from `triggers.ts` (lines 107 to 205 in the current file: the `daysFromNowMatches` TSDoc through the end of `daysUntilEventShape`). Add `export` to each and this module header:

```ts
/**
 * The wedding-date filter family shared by every trigger whose payload
 * carries an `event_date` (couple, invoice, contract and proposal
 * events) or a `date` (event rows).
 *
 * Lives in its own module so a trigger file under `triggers/` can
 * import it without importing the registry back (a cycle): the
 * registry in `../triggers` imports those files.
 *
 * @module lib/automations/triggers/event-date
 */

import { z } from 'zod'

import {
  COMPARISON_OPS,
  DAY_OF_WEEK_BUCKETS,
  MONTHS,
  SEASONS,
  compareNumber,
  dateMatchesDayOfWeek,
  monthOfDate,
  seasonOfDate,
  type ComparisonOp,
  type DayOfWeekBucket,
} from '../trigger-constants'
```

Then, in order, the exported `daysFromNowMatches`, `daysUntilEventMatches`, `EventDateConfig`, `eventDateMatches`, `eventDateConfigShape`, `daysUntilEventShape`, each keeping its existing TSDoc.

- [ ] **Step 3: Replace the block in `triggers.ts` with an import**

Delete lines 107 to 205 of `lib/automations/triggers.ts` (from the `/** Compare "days from now until ...` comment through the closing `}` of `daysUntilEventShape`). Add to the imports:

```ts
import {
  daysUntilEventMatches,
  daysUntilEventShape,
  eventDateConfigShape,
  eventDateMatches,
} from './triggers/event-date'
```

`daysFromNowMatches` is used only by `daysUntilEventMatches`, so it needs no import in `triggers.ts`. Remove any `trigger-constants` import that is now unused there (`npm run lint` reports `@typescript-eslint/no-unused-vars` per name; `compareNumber`, `DAY_OF_WEEK_BUCKETS`, `MONTHS`, `SEASONS` and `DayOfWeekBucket` are still used by other specs in the file, so expect to keep most of them).

- [ ] **Step 4: Run the baseline tests and the gates**

Run: the same vitest command as Step 1, then `npm run typecheck && npm run lint`.
Expected: tests PASS, typecheck 0 errors, no new lint findings in the two files.

- [ ] **Step 5: Checkpoint**

Report: `lib/automations/triggers/event-date.ts` (new), `lib/automations/triggers.ts` (shorter). Do not commit.

---

### Task 2: The six proposal trigger specs

**Files:**
- Create: `lib/automations/triggers/proposals.ts`
- Modify: `types/automations.ts:64-71` (union) and `:731` (categories), `lib/automations/triggers.ts` (category union + registry spread), `lib/automations/launch-catalogue.ts:40-88`
- Test: `tests/unit/lib/automations/proposal-triggers.test.ts`

**Interfaces:**
- Consumes: `TriggerSpec`, `TriggerUi` (type-only) from `../triggers`; the four helpers from `./event-date`.
- Produces:
  - `TriggerType` gains `'proposal_sent' | 'proposal_opened' | 'proposal_accepted' | 'proposal_declined' | 'proposal_expired' | 'proposal_expiring'`
  - `TriggerUi['category']` gains `'proposal'`; `TRIGGER_CATEGORIES` gains `{ slug: 'proposal', label: 'Proposals' }`
  - `export const proposalFilterSchema` (contract-shaped: wedding-date family, passthrough)
  - `export type ProposalFilterConfig`
  - `export function proposalMatch(event: AutomationEventRow, config: ProposalFilterConfig): boolean`
  - `export const proposalExpiringConfig` = `proposalFilterSchema` + `days: z.number().int().min(0).max(60).default(3)`
  - `export const proposalTriggers: Record<ProposalTriggerType, TriggerSpec<any>>`
  - Payload field the emitter (Task 5) must stamp: `days_until_expiry`.

- [ ] **Step 1: Write the failing unit test**

Create `tests/unit/lib/automations/proposal-triggers.test.ts`:

```ts
/**
 * Narrowing for the six proposal triggers (roadmap R2, spec 5.2).
 *
 * The five lifecycle triggers carry the contract triggers' chips: the
 * wedding date family, joined into every proposal payload by the DB
 * trigger. `proposal_expiring` adds the lead-time parameter and, like
 * `invoice_due`, only fires for the emitted `days_until_expiry` that
 * equals its own `days`.
 */
import { describe, expect, it } from 'vitest'

import { LAUNCH_VISIBLE_TRIGGERS } from '@/lib/automations/launch-catalogue'
import { triggerRegistry } from '@/lib/automations/triggers'
import { TRIGGER_CATEGORIES, type AutomationEventRow, type TriggerType } from '@/types/automations'

function event(payload: Record<string, unknown>): AutomationEventRow {
  return { payload } as unknown as AutomationEventRow
}

const LIFECYCLE = [
  'proposal_sent',
  'proposal_opened',
  'proposal_accepted',
  'proposal_declined',
  'proposal_expired',
] as const

describe('proposal lifecycle triggers', () => {
  it.each(LIFECYCLE)('%s narrows on the wedding date', (type) => {
    const spec = triggerRegistry[type]
    // 2027-03-06 is a Saturday in peak season.
    const march = event({ event_date: '2027-03-06' })
    expect(spec.match(march, {})).toBe(true)
    expect(spec.match(march, { eventMonth: 'mar' })).toBe(true)
    expect(spec.match(march, { eventMonth: 'dec' })).toBe(false)
    expect(spec.match(march, { season: 'peak' })).toBe(true)
    expect(spec.match(march, { dayOfWeek: 'saturday' })).toBe(true)
    expect(spec.match(event({ event_date: null }), { eventMonth: 'mar' })).toBe(false)
    expect(spec.match(event({ event_date: null }), { hasEventDate: false })).toBe(true)
  })

  it.each(LIFECYCLE)('%s sits in the proposal category and is launch-visible', (type) => {
    expect(triggerRegistry[type].ui.category).toBe('proposal')
    expect(LAUNCH_VISIBLE_TRIGGERS.has(type)).toBe(true)
  })

  it('has a picker label for the proposal category', () => {
    expect(TRIGGER_CATEGORIES.map((c) => c.slug)).toContain('proposal')
  })

  it('accepts an empty config and a config with unknown keys', () => {
    const schema = triggerRegistry.proposal_sent.configSchema
    expect(schema.safeParse({}).success).toBe(true)
    expect(schema.safeParse({ optionId: 'x' }).success).toBe(true)
  })
})

describe('proposal_expiring', () => {
  const spec = triggerRegistry.proposal_expiring

  it('defaults the lead time to 3 days', () => {
    const parsed = spec.configSchema.safeParse({})
    expect(parsed.success && (parsed.data as { days: number }).days).toBe(3)
  })

  it('rejects a lead time outside 0 to 60', () => {
    expect(spec.configSchema.safeParse({ days: -1 }).success).toBe(false)
    expect(spec.configSchema.safeParse({ days: 61 }).success).toBe(false)
    expect(spec.configSchema.safeParse({ days: 60 }).success).toBe(true)
  })

  it('fires only for the emitted lead time that equals its own', () => {
    expect(spec.match(event({ days_until_expiry: 3 }), { days: 3 })).toBe(true)
    expect(spec.match(event({ days_until_expiry: 0 }), { days: 3 })).toBe(false)
    expect(spec.match(event({}), { days: 3 })).toBe(false)
  })

  it('still narrows on the wedding date', () => {
    const e = event({ days_until_expiry: 3, event_date: '2027-03-06' })
    expect(spec.match(e, { days: 3, eventMonth: 'mar' })).toBe(true)
    expect(spec.match(e, { days: 3, eventMonth: 'dec' })).toBe(false)
  })

  it('is launch-visible', () => {
    expect(LAUNCH_VISIBLE_TRIGGERS.has('proposal_expiring' as TriggerType)).toBe(true)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project unit tests/unit/lib/automations/proposal-triggers.test.ts`
Expected: FAIL (`triggerRegistry.proposal_sent` is undefined; TS errors on the union).

- [ ] **Step 3: Extend the type unions**

In `types/automations.ts`, after the `document_signed` line inside `TriggerType`:

```ts
  // Proposals. The five lifecycle events are emitted by one DB trigger on
  // `proposals` (roadmap R2, decision L6); `proposal_expiring` is emitted
  // by the tick from `expires_at` and a configured lead time.
  | 'proposal_sent'
  | 'proposal_opened'
  | 'proposal_accepted'
  | 'proposal_declined'
  | 'proposal_expired'
  | 'proposal_expiring' // emitted by the tick
```

In `TRIGGER_CATEGORIES`, after the `contract` row:

```ts
  { slug: 'proposal', label: 'Proposals' },
```

In `lib/automations/triggers.ts`, add `| 'proposal'` to `TriggerUi['category']` right after `| 'contract'`.

- [ ] **Step 4: Write `lib/automations/triggers/proposals.ts`**

```ts
/**
 * Proposal triggers (roadmap R2, spec 5.2).
 *
 * The five lifecycle triggers are emitted by `tg_proposals_emit_lifecycle`
 * (migration `20261002000000_proposal_lifecycle_events.sql`), one per
 * old-to-new transition on `proposals`; `proposal_expiring` is emitted by
 * the tick (`lib/automations/time-emitters/proposal-expiring.ts`) with
 * the lead time it fired for in `payload.days_until_expiry`.
 *
 * Every payload carries the couple's `event_date`, so the specs share the
 * contract triggers' chips: the wedding-date family. No option or package
 * filter until R3 seeds real options (decision L9).
 *
 * Kept out of `../triggers` because that file is already 1,800 lines; the
 * registry spreads {@link proposalTriggers} in.
 *
 * @module lib/automations/triggers/proposals
 */

import { z } from 'zod'

import type { AutomationEventRow, TriggerType } from '@/types/automations'

import type { TriggerSpec } from '../triggers'

import {
  daysUntilEventMatches,
  daysUntilEventShape,
  eventDateConfigShape,
  eventDateMatches,
} from './event-date'

/** The trigger types this module owns. */
export type ProposalTriggerType = Extract<
  TriggerType,
  | 'proposal_sent'
  | 'proposal_opened'
  | 'proposal_accepted'
  | 'proposal_declined'
  | 'proposal_expired'
  | 'proposal_expiring'
>

/** Untyped payload read that is safe inside `match()` bodies. */
function payloadOf(event: AutomationEventRow): Record<string, unknown> {
  return (event.payload as Record<string, unknown>) ?? {}
}

/**
 * Shared schema for the lifecycle triggers: the wedding-date family and
 * nothing else. `.passthrough()` so a config saved with a key this
 * version does not know still parses rather than killing the workflow.
 */
export const proposalFilterSchema = z
  .object({
    ...daysUntilEventShape,
    ...eventDateConfigShape,
  })
  .passthrough()

export type ProposalFilterConfig = z.infer<typeof proposalFilterSchema>

/** Shared matcher: every proposal trigger narrows on the wedding date. */
export function proposalMatch(event: AutomationEventRow, config: ProposalFilterConfig): boolean {
  const payload = payloadOf(event)
  if (!daysUntilEventMatches(payload, config.daysUntilEventOp, config.daysUntilEventValue)) {
    return false
  }
  return eventDateMatches(payload, config)
}

function lifecycle(
  type: ProposalTriggerType,
  ui: TriggerSpec['ui'],
): TriggerSpec<ProposalFilterConfig> {
  return { type, configSchema: proposalFilterSchema, match: proposalMatch, ui }
}

/**
 * `proposal_expiring` adds the lead time. 3 days is the default because
 * a nudge on the day itself is too late for a couple to act on, and 60
 * is the ceiling because proposals rarely stay open longer than that.
 */
export const proposalExpiringConfig = z
  .object({
    days: z.number().int().min(0).max(60).default(3),
    ...daysUntilEventShape,
    ...eventDateConfigShape,
  })
  .passthrough()

export type ProposalExpiringConfig = z.infer<typeof proposalExpiringConfig>

const proposalExpiring: TriggerSpec<ProposalExpiringConfig> = {
  type: 'proposal_expiring',
  configSchema: proposalExpiringConfig,
  // The emitter stamps the lead time it fired for; narrowing on it means
  // a workflow with `days: 3` answers the 3-days-before event only, not
  // the `days: 0` event on the same proposal (the invoice_due lesson).
  match(event, config) {
    const emitted = Number(payloadOf(event).days_until_expiry)
    if (!Number.isFinite(emitted) || emitted !== config.days) return false
    return proposalMatch(event, config)
  },
  ui: {
    category: 'proposal',
    label: 'Proposal expiring',
    description: 'A set number of days before a proposal expires unanswered',
    icon: 'Hourglass',
  },
}

/** The six specs, keyed by type, for the registry to spread in. */
export const proposalTriggers: Record<ProposalTriggerType, TriggerSpec<any>> = {
  proposal_sent: lifecycle('proposal_sent', {
    category: 'proposal',
    label: 'Proposal sent',
    description: 'When a proposal is emailed to the couple',
    icon: 'Send',
  }),
  proposal_opened: lifecycle('proposal_opened', {
    category: 'proposal',
    label: 'Proposal opened',
    description: 'The first time the couple opens a proposal',
    icon: 'Eye',
  }),
  proposal_accepted: lifecycle('proposal_accepted', {
    category: 'proposal',
    label: 'Proposal accepted',
    description: 'When the couple accepts a proposal and signs',
    icon: 'CircleCheck',
  }),
  proposal_declined: lifecycle('proposal_declined', {
    category: 'proposal',
    label: 'Proposal declined',
    description: 'When the couple declines a proposal',
    icon: 'XCircle',
  }),
  proposal_expired: lifecycle('proposal_expired', {
    category: 'proposal',
    label: 'Proposal expired',
    description: 'When a proposal passes its expiry without an answer',
    icon: 'CalendarX',
  }),
  proposal_expiring: proposalExpiring,
}
```

- [ ] **Step 5: Spread the specs into the registry and the catalogue**

In `lib/automations/triggers.ts`, add `import { proposalTriggers } from './triggers/proposals'` and, inside `triggerRegistry` after the `document_signed: documentSigned,` line:

```ts
  // Proposals (specs in ./triggers/proposals)
  ...proposalTriggers,
```

In `lib/automations/launch-catalogue.ts`, inside `LAUNCH_VISIBLE_TRIGGERS` after the contracts block:

```ts
  // Proposals (R2: DB-trigger emitted, plus the tick-emitted expiring one)
  'proposal_sent',
  'proposal_opened',
  'proposal_accepted',
  'proposal_declined',
  'proposal_expired',
  'proposal_expiring',
```

- [ ] **Step 6: Run the test and the wider trigger suites**

Run: `npx vitest run --project unit tests/unit/lib/automations/` and `npm run typecheck`
Expected: PASS. `launch-catalogue.test.ts` and `action-ui-parity.test.ts` are the ones most likely to have opinions about new entries; if one asserts a fixed count, update the count with a one-line reason.

- [ ] **Step 7: Checkpoint**

Report: `lib/automations/triggers/proposals.ts`, `tests/unit/lib/automations/proposal-triggers.test.ts` (new); `types/automations.ts`, `lib/automations/triggers.ts`, `lib/automations/launch-catalogue.ts` (modified). Do not commit.

---

### Task 3: Lifecycle DB trigger and the expiry cron job (migration)

**Files:**
- Create: `supabase/migrations/20261002000000_proposal_lifecycle_events.sql`
- Modify: `tests/integration/cron/scheduler.test.ts:58-70`
- Test: `tests/integration/proposals/lifecycle-events.test.ts`

**Interfaces:**
- Consumes: `public.emit_automation_event(p_user_id uuid, p_source_table text, p_source_id uuid, p_event_type text, p_payload jsonb, p_couple_id uuid)` (migration `20260604000000`), `public.cron_call(p_path text)` (R1).
- Produces on the bus (`source_table = 'proposals'`, `source_id = proposals.id`, `couple_id = proposals.couple_id`):

| Event | Guard | Payload beyond the common keys |
|---|---|---|
| `proposal_sent` | `new.share_token_enabled and not old.share_token_enabled` | `expires_at` |
| `proposal_opened` | `new.first_viewed_at is not null and old.first_viewed_at is null` | none |
| `proposal_accepted` | `new.accepted_at is not null and old.accepted_at is null` | `accepted_option_id`, `option_title`, `total` |
| `proposal_declined` | `new.declined_at is not null and old.declined_at is null` | `declined_reason`, `declined_message` |
| `proposal_expired` | `new.status = 'expired' and old.status is distinct from 'expired'` | `expires_at` |

Common keys: `proposal_id, couple_id, proposal_number, title, share_token, event_date`. `share_token` is there so `{{proposal.link}}` can resolve on a lifecycle-triggered "Send email" nudge (L8) without a prior send step: the DB does not know the app origin, so the TS resolver builds the URL (Task 8). `total` is `invoices.subtotal` for the invoice `finalize_proposal_acceptance` writes in the same UPDATE as `accepted_at`, falling back to the option's `subtotal` when there is no invoice.

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/proposals/lifecycle-events.test.ts`:

```ts
/**
 * tg_proposals_emit_lifecycle: one bus event per old-to-new transition on
 * `proposals`, never on a touch (roadmap R2, spec 5.1). Runs against local
 * Supabase so the trigger, `emit_automation_event` and the RLS on
 * `automation_events` all execute for real.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

let user: TestUser;
let other: TestUser;
let coupleId: string;
let seq = 0;

interface BusRow {
  event_type: string;
  payload: Record<string, unknown>;
  couple_id: string | null;
  user_id: string;
}

async function seedProposal(overrides: Record<string, unknown> = {}): Promise<string> {
  seq += 1;
  const { data, error } = await user.client
    .from('proposals')
    .insert({
      user_id: user.id,
      couple_id: coupleId,
      proposal_number: `PR-L${seq}`,
      title: 'Wedding MC',
      status: 'draft',
      expires_at: '2027-01-15',
      ...overrides,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function eventsFor(proposalId: string, type?: string): Promise<BusRow[]> {
  let q = serviceClient()
    .from('automation_events')
    .select('event_type, payload, couple_id, user_id')
    .eq('source_table', 'proposals')
    .eq('source_id', proposalId);
  if (type) q = q.eq('event_type', type);
  const { data } = await q;
  return (data ?? []) as unknown as BusRow[];
}

async function patch(proposalId: string, values: Record<string, unknown>) {
  const { error } = await serviceClient().from('proposals').update(values).eq('id', proposalId);
  if (error) throw error;
}

beforeAll(async () => {
  user = await createTestUser();
  other = await createTestUser();
  const { data: c } = await user.client
    .from('couples')
    .insert({ user_id: user.id, name: 'A & B', status: 'new', event_date: '2027-03-06' })
    .select('id')
    .single();
  coupleId = c!.id;
});
afterAll(async () => {
  await user.cleanup();
  await other.cleanup();
});

describe('tg_proposals_emit_lifecycle', () => {
  it('emits nothing on insert', async () => {
    const id = await seedProposal();
    expect(await eventsFor(id)).toHaveLength(0);
  });

  it('emits proposal_sent once when the share link is enabled, with the common payload', async () => {
    const id = await seedProposal();
    await patch(id, { share_token_enabled: true, status: 'sent' });
    await patch(id, { share_token_enabled: true, updated_at: new Date().toISOString() });
    await patch(id, { version: 2 });
    const rows = await eventsFor(id, 'proposal_sent');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.couple_id).toBe(coupleId);
    expect(rows[0]!.user_id).toBe(user.id);
    expect(rows[0]!.payload).toMatchObject({
      proposal_id: id,
      couple_id: coupleId,
      proposal_number: expect.stringMatching(/^PR-L/),
      title: 'Wedding MC',
      event_date: '2027-03-06',
      expires_at: '2027-01-15',
    });
    expect(typeof rows[0]!.payload.share_token).toBe('string');
  });

  it('re-emits proposal_sent when a link is turned off and on again', async () => {
    const id = await seedProposal({ share_token_enabled: true, status: 'sent' });
    await patch(id, { share_token_enabled: false, status: 'draft' });
    await patch(id, { share_token_enabled: true, status: 'sent' });
    expect(await eventsFor(id, 'proposal_sent')).toHaveLength(1);
  });

  it('emits proposal_opened once when first_viewed_at is stamped', async () => {
    const id = await seedProposal({ share_token_enabled: true, status: 'sent' });
    const now = new Date().toISOString();
    await patch(id, { first_viewed_at: now, view_count: 1, status: 'viewed' });
    await patch(id, { view_count: 2, last_viewed_at: now });
    expect(await eventsFor(id, 'proposal_opened')).toHaveLength(1);
  });

  it('emits proposal_accepted once with the option and total when accepted_at is stamped', async () => {
    const id = await seedProposal({ share_token_enabled: true, status: 'sent' });
    const { data: opt } = await user.client
      .from('proposal_options')
      .insert({ proposal_id: id, user_id: user.id, position: 1, title: 'Reception MC', subtotal: 1400 })
      .select('id')
      .single();
    await patch(id, { accepted_option_id: opt!.id });
    await patch(id, { accepted_at: new Date().toISOString(), status: 'accepted' });
    await patch(id, { updated_at: new Date().toISOString() });
    const rows = await eventsFor(id, 'proposal_accepted');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.payload).toMatchObject({
      accepted_option_id: opt!.id,
      option_title: 'Reception MC',
      total: 1400,
    });
  });

  it('emits proposal_declined once with the reason and message', async () => {
    const id = await seedProposal({ share_token_enabled: true, status: 'sent' });
    await patch(id, {
      declined_at: new Date().toISOString(),
      declined_reason: 'price',
      declined_message: 'Over budget',
      status: 'declined',
    });
    await patch(id, { declined_message: 'Over budget, sorry' });
    const rows = await eventsFor(id, 'proposal_declined');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.payload).toMatchObject({ declined_reason: 'price', declined_message: 'Over budget' });
  });

  it('emits proposal_expired once when expire_proposals flips the status', async () => {
    const id = await seedProposal({ share_token_enabled: true, status: 'sent', expires_at: '2020-01-01' });
    await serviceClient().rpc('expire_proposals');
    await serviceClient().rpc('expire_proposals');
    const rows = await eventsFor(id, 'proposal_expired');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.payload).toMatchObject({ expires_at: '2020-01-01' });
  });

  it('never shows another tenant the emitted rows', async () => {
    const id = await seedProposal({ share_token_enabled: true, status: 'sent' });
    await patch(id, { first_viewed_at: new Date().toISOString() });
    const { data } = await other.client
      .from('automation_events')
      .select('id')
      .eq('source_table', 'proposals')
      .eq('source_id', id);
    expect(data ?? []).toHaveLength(0);
    const { data: own } = await user.client
      .from('automation_events')
      .select('id')
      .eq('source_table', 'proposals')
      .eq('source_id', id);
    expect((own ?? []).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project integration tests/integration/proposals/lifecycle-events.test.ts`
Expected: FAIL on every "emits" case (`toHaveLength(1)` receives 0); the insert and cross-tenant cases may pass already.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20261002000000_proposal_lifecycle_events.sql`:

```sql
-- supabase/migrations/20261002000000_proposal_lifecycle_events.sql
--
-- Proposal lifecycle events on the automation bus (roadmap spec R2, §5.1)
-- and the daily expiry job (§5.3).
--
-- One trigger emits all five events, from the DB and never from app
-- code, because three of the transitions (opened, accepted, declined)
-- happen inside security definer RPCs the app only sees the result of
-- (decision L6). Every guard compares old and new, so an `updated_at`
-- touch or a `version` bump never re-emits.
--
-- `proposal_accepted` fires when `accepted_at` is stamped, which the
-- finalize RPC does after the contract is signed, not when a package is
-- chosen (decision L7). Owner previews never stamp `first_viewed_at`
-- (only `get_public_proposal` does), so `proposal_opened` is couple-only.
--
-- `share_token` rides along on every payload: the DB does not know the
-- app origin, so the variable resolver builds `{{proposal.link}}` from
-- it (lib/automations/variables.ts). `automation_events` is owner-only
-- under RLS and the owner can already read the token from the row.
--
-- Not destructive. Deployed by CI `supabase db push` only.

create or replace function public.tg_proposals_emit_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_date      date;
  v_base            jsonb;
  v_option_title    text;
  v_option_subtotal numeric;
  v_invoice_total   numeric;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  -- Same enrichment the contract triggers carry (20260813040000): the
  -- wedding date is the one filter every proposal trigger narrows on.
  select c.event_date into v_event_date
  from public.couples c
  where c.id = new.couple_id;

  v_base := jsonb_build_object(
    'proposal_id', new.id,
    'couple_id', new.couple_id,
    'proposal_number', new.proposal_number,
    'title', new.title,
    'share_token', new.share_token,
    'event_date', v_event_date
  );

  -- Sent: the link becoming resolvable is the send. The send route and
  -- the send_proposal action both flip this flag; a proposal reverted to
  -- draft has it cleared, so re-sending re-emits, which is right.
  if new.share_token_enabled and not old.share_token_enabled then
    perform public.emit_automation_event(
      new.user_id, 'proposals', new.id, 'proposal_sent',
      v_base || jsonb_build_object('expires_at', new.expires_at),
      new.couple_id
    );
  end if;

  if new.first_viewed_at is not null and old.first_viewed_at is null then
    perform public.emit_automation_event(
      new.user_id, 'proposals', new.id, 'proposal_opened',
      v_base,
      new.couple_id
    );
  end if;

  if new.accepted_at is not null and old.accepted_at is null then
    select o.title, o.subtotal into v_option_title, v_option_subtotal
    from public.proposal_options o
    where o.id = new.accepted_option_id;
    -- finalize_proposal_acceptance writes invoice_id in the same UPDATE
    -- as accepted_at, and that invoice's subtotal is what the couple is
    -- paying (add-ons and loading included). The option subtotal is the
    -- fallback for an acceptance recorded without an invoice.
    select i.subtotal into v_invoice_total
    from public.invoices i
    where i.id = new.invoice_id;
    perform public.emit_automation_event(
      new.user_id, 'proposals', new.id, 'proposal_accepted',
      v_base || jsonb_build_object(
        'accepted_option_id', new.accepted_option_id,
        'option_title', v_option_title,
        'total', coalesce(v_invoice_total, v_option_subtotal)
      ),
      new.couple_id
    );
  end if;

  if new.declined_at is not null and old.declined_at is null then
    perform public.emit_automation_event(
      new.user_id, 'proposals', new.id, 'proposal_declined',
      v_base || jsonb_build_object(
        'declined_reason', new.declined_reason,
        'declined_message', new.declined_message
      ),
      new.couple_id
    );
  end if;

  if new.status = 'expired' and old.status is distinct from 'expired' then
    perform public.emit_automation_event(
      new.user_id, 'proposals', new.id, 'proposal_expired',
      v_base || jsonb_build_object('expires_at', new.expires_at),
      new.couple_id
    );
  end if;

  return new;
end;
$$;

-- Trigger functions are not callable as RPCs, but the default PUBLIC
-- execute grant is revoked anyway, matching the contract emitters.
revoke execute on function public.tg_proposals_emit_lifecycle() from public, anon, authenticated;

drop trigger if exists proposals_emit_lifecycle on public.proposals;
create trigger proposals_emit_lifecycle
  after update on public.proposals
  for each row
  execute function public.tg_proposals_emit_lifecycle();

-- ── Expiry job ──────────────────────────────────────────────────────
-- R1 owns the scheduler (20261001000000); this phase adds one job. Same
-- unschedule-then-schedule idiom so the migration replays cleanly, and
-- the same cron_call so the Vault secrets and the no-op-without-secrets
-- behaviour apply. 22:10 UTC sits between expire-contracts (22:00) and
-- send-contract-reminders (22:15).
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'zebri:expire-proposals';
  perform cron.schedule(
    'zebri:expire-proposals',
    '10 22 * * *',
    format('select public.cron_call(%L)', '/api/cron/expire-proposals')
  );
end;
$$;
```

- [ ] **Step 4: Apply it locally and run the test**

Run: `supabase migration up` (local stack must be running), then `npx vitest run --project integration tests/integration/proposals/lifecycle-events.test.ts`
Expected: PASS, 8 tests.

If `migration up` complains about a foreign version from another worktree, apply the file directly instead: `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/migrations/20261002000000_proposal_lifecycle_events.sql` and note it in the checkpoint.

- [ ] **Step 5: Update the scheduler expectation and run it**

In `tests/integration/cron/scheduler.test.ts`, the `registers every route as a zebri: job` assertion lists the jobs alphabetically. Insert `'zebri:expire-proposals|10 22 * * *',` between `zebri:expire-contracts` and `zebri:prune-stripe-events`.

Run: `npx vitest run --project integration tests/integration/cron/scheduler.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the existing proposal suites for regressions**

Run: `npx vitest run --project integration tests/integration/proposals/ tests/integration/rls/proposals.test.ts`
Expected: PASS. The accept / decline / finalize suites now also emit bus rows as a side effect; nothing in them asserts the bus is empty.

- [ ] **Step 7: Checkpoint**

Report the migration file, the new test, the scheduler test change. Do not commit.

---

### Task 4: `/api/cron/expire-proposals`

**Files:**
- Create: `app/api/cron/expire-proposals/route.ts`
- Test: `tests/unit/app/api/cron/expire-proposals.test.ts`

**Interfaces:**
- Consumes: `isCronAuthorized(request)` from `@/lib/api/cron-auth`; `createAdminClient()` from `@/lib/supabase/admin`; `sendAlert` from `@/lib/alerts/send-alert`; RPC `expire_proposals()` returning `setof uuid`.
- Produces: `GET` and `POST` handlers; JSON `{ ok: true, expired: number }`, `401`, or `500 { error }`.

- [ ] **Step 1: Write the failing unit test**

Create `tests/unit/app/api/cron/expire-proposals.test.ts`:

```ts
/**
 * The expiry cron route: bearer-gated, calls `expire_proposals()` with the
 * admin client (the RPC is revoked from `authenticated`), reports the
 * count, and alerts on failure so a silent cron never goes unnoticed.
 *
 * @module tests/unit/app/api/cron/expire-proposals.test
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api/cron-auth', () => ({
  isCronAuthorized: vi.fn().mockReturnValue(true),
}))

vi.mock('@/lib/alerts/send-alert', () => ({
  sendAlert: vi.fn(),
}))

const rpc = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc }),
}))

import { GET, POST } from '@/app/api/cron/expire-proposals/route'
import { sendAlert } from '@/lib/alerts/send-alert'
import { isCronAuthorized } from '@/lib/api/cron-auth'

function request() {
  return new NextRequest('https://zebri.test/api/cron/expire-proposals')
}

describe('/api/cron/expire-proposals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isCronAuthorized).mockReturnValue(true)
    rpc.mockResolvedValue({ data: ['a', 'b'], error: null })
  })

  it('rejects an unauthorised caller before touching the database', async () => {
    vi.mocked(isCronAuthorized).mockReturnValue(false)
    const res = await GET(request())
    expect(res.status).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('calls expire_proposals and reports how many it stamped', async () => {
    const res = await POST(request())
    expect(rpc).toHaveBeenCalledWith('expire_proposals')
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true, expired: 2 })
  })

  it('reports zero when nothing expired', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    const res = await GET(request())
    await expect(res.json()).resolves.toEqual({ ok: true, expired: 0 })
  })

  it('alerts and returns 500 when the RPC fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const res = await GET(request())
    expect(res.status).toBe(500)
    expect(sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'cron_job_failed', job: 'expire-proposals', errorMessage: 'boom' }),
    )
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project unit tests/unit/app/api/cron/expire-proposals.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the route**

Create `app/api/cron/expire-proposals/route.ts`:

```ts
/**
 * Daily proposal expiry (roadmap R2, spec 5.3).
 *
 * pg_cron calls this at 22:10 UTC (`zebri:expire-proposals`, registered in
 * `20261002000000_proposal_lifecycle_events.sql`). It runs
 * `expire_proposals()`, which flips every sent or viewed proposal past its
 * `expires_at` to `expired`; the lifecycle trigger then emits
 * `proposal_expired` for each one, so this route never touches the bus.
 *
 * The RPC is revoked from `authenticated`, hence the admin client: a cron
 * request has no user session anyway.
 *
 * @module app/api/cron/expire-proposals/route
 */
import { NextRequest, NextResponse } from 'next/server'

import { sendAlert } from '@/lib/alerts/send-alert'
import { isCronAuthorized } from '@/lib/api/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'

async function handle(request: NextRequest) {
  // Constant-time bearer-token check via the shared helper.
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('expire_proposals')
  if (error) {
    await sendAlert({
      type: 'cron_job_failed',
      severity: 'error',
      job: 'expire-proposals',
      errorMessage: error.message,
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, expired: (data as string[] | null)?.length ?? 0 })
}

export const GET = handle
export const POST = handle
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run --project unit tests/unit/app/api/cron/expire-proposals.test.ts && npm run typecheck`
Expected: PASS, 4 tests; typecheck 0.

- [ ] **Step 5: Checkpoint**

Report the two new files. Do not commit.

---

### Task 5: `proposal_expiring` time emitter

**Files:**
- Create: `lib/automations/time-emitters/proposal-expiring.ts`
- Modify: `lib/automations/time-emitters/index.ts:52-77` (import + registry)
- Test: `tests/unit/lib/automations/time-emitters/proposal-expiring.test.ts`, `tests/integration/automations/proposal-expiring-emitter.test.ts`

**Interfaces:**
- Consumes: `TimeEmitter` from `./index`; `loadActiveTriggerConfigs(supabase, 'proposal_expiring')` from `@/lib/workflows/trigger-configs`; `getTriggerSpec('proposal_expiring')`.
- Produces: `export const proposalExpiringEmitter: TimeEmitter`; exported pure helpers for the unit test: `parseLeadDays(config: unknown): number | null`, `expiryDateForLeadDays(days: number, now?: Date): string`.
- Emits `proposal_expiring` with payload `proposal_id, couple_id, proposal_number, title, share_token, expires_at, event_date, days_until_expiry`. Dedupe key: `(source_id, event_type, days_until_expiry)` per UTC day.

- [ ] **Step 1: Write the failing unit test**

Create `tests/unit/lib/automations/time-emitters/proposal-expiring.test.ts`:

```ts
/**
 * Pure helpers of the proposal_expiring emitter: which lead times a
 * saved config asks for, and which calendar date that targets.
 */
import { describe, expect, it } from 'vitest'

import {
  expiryDateForLeadDays,
  parseLeadDays,
} from '@/lib/automations/time-emitters/proposal-expiring'

describe('parseLeadDays', () => {
  it('applies the schema default for an empty config', () => {
    expect(parseLeadDays({})).toBe(3)
    expect(parseLeadDays(null)).toBe(3)
  })

  it('reads a configured lead time', () => {
    expect(parseLeadDays({ days: 7 })).toBe(7)
    expect(parseLeadDays({ days: 0 })).toBe(0)
  })

  it('returns null for a config the trigger schema rejects', () => {
    expect(parseLeadDays({ days: 90 })).toBeNull()
    expect(parseLeadDays({ days: 'soon' })).toBeNull()
  })
})

describe('expiryDateForLeadDays', () => {
  it('targets today plus the lead time, as a Postgres date', () => {
    const now = new Date('2026-09-21T13:00:00Z')
    expect(expiryDateForLeadDays(0, now)).toBe('2026-09-21')
    expect(expiryDateForLeadDays(3, now)).toBe('2026-09-24')
    expect(expiryDateForLeadDays(10, now)).toBe('2026-10-01')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project unit tests/unit/lib/automations/time-emitters/proposal-expiring.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the emitter**

Create `lib/automations/time-emitters/proposal-expiring.ts`:

```ts
/**
 * `proposal_expiring` time-based emitter (roadmap R2, spec 5.3).
 *
 * A proposal that is still open (`sent` or `viewed`, not accepted) and
 * whose `expires_at` is exactly `days` from today fires once per
 * (proposal, lead time, calendar day). Lead times come from the active
 * `proposal_expiring` workflow templates, so nothing is published that no
 * workflow would match. Direct sibling of `invoice-due.ts`, anchored on
 * `proposals.expires_at` and without the payment-stage branch.
 *
 * The payload carries `days_until_expiry` so the trigger's `match()` can
 * narrow to its own lead time, and `share_token` so a "Send email" nudge
 * can resolve `{{proposal.link}}`.
 *
 * @module lib/automations/time-emitters/proposal-expiring
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { getTriggerSpec } from '@/lib/automations/triggers'
import { loadActiveTriggerConfigs } from '@/lib/workflows/trigger-configs'
import type { Database } from '@/types/database'

import type { TimeEmitter } from './index'

const EVENT_TYPE = 'proposal_expiring'

/** A proposal that could fire today for one lead time. */
interface Candidate {
  proposalId: string
  userId: string
  coupleId: string
  proposalNumber: string
  title: string
  shareToken: string
  expiresAt: string
  eventDate: string | null
}

/** Lower bound for "today" in UTC, for the per-day dedupe window. */
function startOfUtcDay(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
}

/**
 * The `expires_at` value (a Postgres `date`, `YYYY-MM-DD`) a proposal
 * must have to be `days` away from today.
 */
export function expiryDateForLeadDays(days: number, now: Date = new Date()): string {
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  target.setUTCDate(target.getUTCDate() + days)
  return target.toISOString().slice(0, 10)
}

/**
 * The lead time a saved trigger config asks for, through the trigger's
 * own schema so `.default(3)` applies to a config saved before the chip
 * wrote one. Null for a config the schema rejects: that workflow is
 * skipped rather than coerced.
 */
export function parseLeadDays(config: unknown): number | null {
  const spec = getTriggerSpec(EVENT_TYPE)
  if (!spec) return null
  const parsed = spec.configSchema.safeParse(config ?? {})
  if (!parsed.success) return null
  const days = (parsed.data as { days?: unknown }).days
  return typeof days === 'number' && Number.isFinite(days) ? Math.floor(days) : null
}

/** Every (user, lead time) pair an active workflow cares about. */
async function collectActiveLeadTimes(
  supabase: SupabaseClient<Database>,
): Promise<Map<string, Set<number>>> {
  const grouped = new Map<string, Set<number>>()
  for (const row of await loadActiveTriggerConfigs(supabase, EVENT_TYPE)) {
    const days = parseLeadDays(row.trigger_config)
    if (days === null) continue
    if (!grouped.has(row.user_id)) grouped.set(row.user_id, new Set())
    grouped.get(row.user_id)!.add(days)
  }
  return grouped
}

/** Open proposals of `userId` expiring exactly `days` from today. */
async function loadCandidates(
  supabase: SupabaseClient<Database>,
  userId: string,
  days: number,
): Promise<Candidate[]> {
  const { data, error } = await supabase
    .from('proposals')
    .select('id, user_id, couple_id, proposal_number, title, share_token, expires_at, couples(event_date)')
    .eq('user_id', userId)
    .in('status', ['sent', 'viewed'])
    .is('accepted_at', null)
    .eq('expires_at', expiryDateForLeadDays(days))
  if (error) throw new Error(`load proposals: ${error.message}`)

  return (data ?? []).map((row) => {
    const couple = (Array.isArray(row.couples) ? row.couples[0] : row.couples) as
      | { event_date: string | null }
      | null
    return {
      proposalId: row.id,
      userId: row.user_id,
      coupleId: row.couple_id,
      proposalNumber: row.proposal_number,
      title: row.title,
      shareToken: row.share_token,
      expiresAt: row.expires_at as string,
      eventDate: couple?.event_date ?? null,
    }
  })
}

/**
 * Already emitted today for this (proposal, lead time)? Narrowed by
 * payload field in JS; the per-day window per proposal is tiny.
 */
async function alreadyEmittedToday(
  supabase: SupabaseClient<Database>,
  proposalId: string,
  days: number,
  dayStart: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('automation_events')
    .select('payload')
    .eq('source_table', 'proposals')
    .eq('source_id', proposalId)
    .eq('event_type', EVENT_TYPE)
    .gte('created_at', dayStart)
    .limit(50)
  if (error) throw new Error(`dedupe lookup: ${error.message}`)
  return (data ?? []).some(
    (row) => Number((row.payload as { days_until_expiry?: unknown } | null)?.days_until_expiry) === days,
  )
}

async function emit(
  supabase: SupabaseClient<Database>,
  candidate: Candidate,
  days: number,
): Promise<void> {
  const { error } = await supabase.rpc('emit_automation_event', {
    p_user_id: candidate.userId,
    p_source_table: 'proposals',
    p_source_id: candidate.proposalId,
    p_event_type: EVENT_TYPE,
    p_payload: {
      proposal_id: candidate.proposalId,
      couple_id: candidate.coupleId,
      proposal_number: candidate.proposalNumber,
      title: candidate.title,
      share_token: candidate.shareToken,
      expires_at: candidate.expiresAt,
      event_date: candidate.eventDate,
      days_until_expiry: days,
    },
    p_couple_id: candidate.coupleId,
  })
  if (error) throw new Error(`emit ${EVENT_TYPE}: ${error.message}`)
}

/** The exported emitter: fan out per (user, lead time), dedupe per day. */
export const proposalExpiringEmitter: TimeEmitter = {
  type: EVENT_TYPE,
  async run(supabase) {
    const dayStart = startOfUtcDay()
    const grouped = await collectActiveLeadTimes(supabase)
    if (grouped.size === 0) return 0

    let emitted = 0
    for (const [userId, leadTimes] of grouped) {
      for (const days of leadTimes) {
        for (const candidate of await loadCandidates(supabase, userId, days)) {
          if (await alreadyEmittedToday(supabase, candidate.proposalId, days, dayStart)) continue
          await emit(supabase, candidate, days)
          emitted += 1
        }
      }
    }
    return emitted
  },
}
```

If the generated `Database` types make `supabase.rpc('emit_automation_event', {...})` or `.from('automation_events')` complain, use the `as never` casts exactly as `invoice-due.ts` does; do not loosen the client type.

- [ ] **Step 4: Register it**

In `lib/automations/time-emitters/index.ts`, import `{ proposalExpiringEmitter } from './proposal-expiring'` and append `proposalExpiringEmitter,` to `registry` after `invoiceOverdueEmitter`. Add `proposal_expiring` to the list of tick-computed triggers in the module TSDoc's second paragraph.

- [ ] **Step 5: Run the unit test and typecheck**

Run: `npx vitest run --project unit tests/unit/lib/automations/time-emitters/ && npm run typecheck`
Expected: PASS; 0 errors.

- [ ] **Step 6: Write the failing integration test**

Create `tests/integration/automations/proposal-expiring-emitter.test.ts`:

```ts
/**
 * Integration test for the `proposal_expiring` emitter against local
 * Supabase: reads the right proposals, fires at the configured lead time
 * only, dedupes across ticks, opens a workflow instance through the
 * dispatcher, and stays tenant-isolated.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { runTimeEmitters } from '@/lib/automations/time-emitters'
import { dispatchPendingEvents } from '@/lib/workflows/dispatcher'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'
import { instancesFor, seedEventTemplate } from '../helpers/workflows'

function isoDateOffset(days: number): string {
  const today = new Date()
  const target = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  target.setUTCDate(target.getUTCDate() + days)
  return target.toISOString().slice(0, 10)
}

let seq = 0

async function seedCouple(user: TestUser): Promise<string> {
  const { data, error } = await serviceClient()
    .from('couples')
    .insert({ user_id: user.id, name: 'Test Couple', email: 'couple@zebri.test', status: 'quoted' })
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed couple: ${error?.message}`)
  return data.id
}

async function seedProposal(
  user: TestUser,
  coupleId: string,
  expiresAt: string | null,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  seq += 1
  const { data, error } = await serviceClient()
    .from('proposals')
    .insert({
      user_id: user.id,
      couple_id: coupleId,
      proposal_number: `PR-X${seq}`,
      title: 'Wedding MC',
      status: 'sent',
      share_token_enabled: true,
      expires_at: expiresAt,
      ...overrides,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed proposal: ${error?.message}`)
  return data.id
}

async function expiringEventsFor(proposalId: string) {
  const { data } = await serviceClient()
    .from('automation_events')
    .select('id, payload, couple_id')
    .eq('source_table', 'proposals')
    .eq('source_id', proposalId)
    .eq('event_type', 'proposal_expiring')
  return (data ?? []) as Array<{ id: string; payload: Record<string, unknown>; couple_id: string | null }>
}

describe('proposal_expiring time-emitter', () => {
  let user: TestUser

  beforeEach(async () => {
    user = await createTestUser()
  })

  afterEach(async () => {
    await user?.cleanup()
  })

  it('emits nothing when no workflow listens', async () => {
    const coupleId = await seedCouple(user)
    const id = await seedProposal(user, coupleId, isoDateOffset(3))
    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.proposal_expiring).toBe(0)
    expect(await expiringEventsFor(id)).toHaveLength(0)
  })

  it('fires at the default 3-day lead time and stamps the payload', async () => {
    const coupleId = await seedCouple(user)
    await seedEventTemplate(user.id, 'proposal_expiring')
    const hit = await seedProposal(user, coupleId, isoDateOffset(3))
    const miss = await seedProposal(user, coupleId, isoDateOffset(2))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.proposal_expiring).toBe(1)
    const events = await expiringEventsFor(hit)
    expect(events).toHaveLength(1)
    expect(events[0]!.couple_id).toBe(coupleId)
    expect(events[0]!.payload).toMatchObject({
      proposal_id: hit,
      days_until_expiry: 3,
      expires_at: isoDateOffset(3),
    })
    expect(typeof events[0]!.payload.share_token).toBe('string')
    expect(await expiringEventsFor(miss)).toHaveLength(0)
  })

  it('does not emit twice on a second tick the same day', async () => {
    const coupleId = await seedCouple(user)
    await seedEventTemplate(user.id, 'proposal_expiring', { days: 0 })
    const id = await seedProposal(user, coupleId, isoDateOffset(0))
    await runTimeEmitters(serviceClient())
    const second = await runTimeEmitters(serviceClient())
    expect(second.emitted.proposal_expiring).toBe(0)
    expect(await expiringEventsFor(id)).toHaveLength(1)
  })

  it('skips draft, accepted, declined and undated proposals', async () => {
    const coupleId = await seedCouple(user)
    await seedEventTemplate(user.id, 'proposal_expiring', { days: 0 })
    const draft = await seedProposal(user, coupleId, isoDateOffset(0), { status: 'draft', share_token_enabled: false })
    const accepted = await seedProposal(user, coupleId, isoDateOffset(0), {
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    })
    const declined = await seedProposal(user, coupleId, isoDateOffset(0), {
      status: 'declined',
      declined_at: new Date().toISOString(),
    })
    const undated = await seedProposal(user, coupleId, null)
    const viewed = await seedProposal(user, coupleId, isoDateOffset(0), { status: 'viewed' })

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.proposal_expiring).toBe(1)
    for (const id of [draft, accepted, declined, undated]) {
      expect(await expiringEventsFor(id)).toHaveLength(0)
    }
    expect(await expiringEventsFor(viewed)).toHaveLength(1)
  })

  it('opens a workflow instance through the dispatcher', async () => {
    const coupleId = await seedCouple(user)
    const templateId = await seedEventTemplate(user.id, 'proposal_expiring', { days: 3 })
    await seedProposal(user, coupleId, isoDateOffset(3))
    await runTimeEmitters(serviceClient())
    await dispatchPendingEvents(serviceClient(), 500, { userId: user.id })
    expect(await instancesFor(templateId)).toHaveLength(1)
  })

  it('never fires another tenant\'s proposals', async () => {
    const other = await createTestUser()
    try {
      const coupleId = await seedCouple(other)
      await seedEventTemplate(user.id, 'proposal_expiring', { days: 0 })
      const id = await seedProposal(other, coupleId, isoDateOffset(0))
      await runTimeEmitters(serviceClient())
      expect(await expiringEventsFor(id)).toHaveLength(0)
    } finally {
      await other.cleanup()
    }
  })
})
```

- [ ] **Step 7: Run it**

Run: `npx vitest run --project integration tests/integration/automations/proposal-expiring-emitter.test.ts`
Expected: PASS, 6 tests. If `dispatchPendingEvents` opens nothing, check that the seeded template's `apply_rule_config.triggerConfig` parses through `proposalExpiringConfig` (it should: `{ days: 3 }`) and that the dispatcher's `match()` is reading `payload.days_until_expiry` as a number.

- [ ] **Step 8: Checkpoint**

Report the emitter, its two tests and the index registration. Do not commit.

---

### Task 6: Lift the send into `lib/proposals/send.ts`

**Files:**
- Create: `lib/proposals/send.ts`
- Modify: `app/api/email/send-proposal/route.ts:56-158`
- Test: `tests/unit/lib/proposals/send.test.ts`

**Interfaces:**
- Consumes: `sendProposalEmail` from `@/lib/email`; `logger` from `@/lib/alerts/logger`; `ResolvedSender` from `@/lib/email/sender-identity`; `PublicBranding` from `@/lib/branding/public-branding`.
- Produces:

```ts
export interface SendableProposal {
  id: string
  couple_id: string
  proposal_number: string
  title: string
  share_token: string
  share_token_enabled: boolean
  status: string
  expires_at: string | null
  contract_template_id: string | null
}
export type ProposalSendBlock = 'accepted' | 'no_contract_template' | 'no_primary_email'
export function proposalSendBlock(
  proposal: Pick<SendableProposal, 'status' | 'contract_template_id'>,
  coupleEmail: string | null,
): ProposalSendBlock | null
export interface ProposalSendInput {
  proposal: SendableProposal
  userId: string
  coupleEmail: string
  coupleName: string
  mcBusinessName: string
  sender: ResolvedSender
  branding: PublicBranding | null
  source: 'manual' | 'automation'
}
export type ProposalSendResult =
  | { ok: true; shareUrl: string }
  | { ok: false; stage: 'enable_link' | 'send'; error: string }
export async function sendProposalToCouple(
  supabase: SupabaseClient<Database>,
  input: ProposalSendInput,
): Promise<ProposalSendResult>
export const PROPOSAL_SEND_BLOCK_COPY: Record<ProposalSendBlock, string>
```

`sendProposalToCouple` does, in order: enable the link + flip draft to sent (one UPDATE, skipped when nothing changes), send the email, stamp `email_sent_at`, log a `couple_emails` row with `source`. Guard checking stays with the caller through `proposalSendBlock`, so the route can map each block to its own HTTP status and the action to its own skip reason.

- [ ] **Step 1: Write the failing unit test**

Create `tests/unit/lib/proposals/send.test.ts`:

```ts
/**
 * The shared proposal sender behind `/api/email/send-proposal` and the
 * `send_proposal` workflow action: the guard order both callers rely on,
 * the two flips, and the audit row.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendProposalEmail = vi.fn()
vi.mock('@/lib/email', () => ({
  sendProposalEmail: (...args: unknown[]) => sendProposalEmail(...args),
}))
vi.mock('@/lib/alerts/logger', () => ({ logger: { error: vi.fn() } }))

import { proposalSendBlock, sendProposalToCouple, type SendableProposal } from '@/lib/proposals/send'

const proposal: SendableProposal = {
  id: '7f2c1e58-0000-4000-8000-000000000001',
  couple_id: '7f2c1e58-0000-4000-8000-000000000002',
  proposal_number: 'PR-001',
  title: 'Wedding MC',
  share_token: '7f2c1e58-0000-4000-8000-000000000003',
  share_token_enabled: false,
  status: 'draft',
  expires_at: '2027-01-15',
  contract_template_id: '7f2c1e58-0000-4000-8000-000000000004',
}

const sender = { kind: 'default' } as never

/** A supabase double that records every update and insert. */
function makeSupabase() {
  const updates: Array<{ table: string; patch: Record<string, unknown> }> = []
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = []
  const from = vi.fn((table: string) => ({
    update: (patch: Record<string, unknown>) => {
      updates.push({ table, patch })
      return { eq: vi.fn(async () => ({ error: null })) }
    },
    insert: async (row: Record<string, unknown>) => {
      inserts.push({ table, row })
      return { error: null }
    },
  }))
  return { client: { from } as never, updates, inserts }
}

function input(overrides: Partial<Parameters<typeof sendProposalToCouple>[1]> = {}) {
  return {
    proposal,
    userId: 'u1',
    coupleEmail: 'couple@example.com',
    coupleName: 'Sam & Alex',
    mcBusinessName: 'Acme MC',
    sender,
    branding: null,
    source: 'manual' as const,
    ...overrides,
  }
}

describe('proposalSendBlock', () => {
  it('blocks an accepted proposal before anything else', () => {
    expect(proposalSendBlock({ status: 'accepted', contract_template_id: null }, null)).toBe('accepted')
  })
  it('blocks a proposal with no contract template', () => {
    expect(proposalSendBlock({ status: 'draft', contract_template_id: null }, 'a@b.c')).toBe('no_contract_template')
  })
  it('blocks a couple with no email', () => {
    expect(proposalSendBlock(proposal, null)).toBe('no_primary_email')
    expect(proposalSendBlock(proposal, '')).toBe('no_primary_email')
  })
  it('passes otherwise', () => {
    expect(proposalSendBlock(proposal, 'a@b.c')).toBeNull()
  })
})

describe('sendProposalToCouple', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.zebri.test'
    sendProposalEmail.mockResolvedValue({ ok: true })
  })

  it('enables the link, flips draft to sent, emails, stamps email_sent_at and logs the send', async () => {
    const { client, updates, inserts } = makeSupabase()
    const result = await sendProposalToCouple(client, input())
    expect(result).toEqual({ ok: true, shareUrl: `https://app.zebri.test/proposal/${proposal.share_token}` })
    expect(updates[0]).toEqual({ table: 'proposals', patch: { share_token_enabled: true, status: 'sent' } })
    expect(sendProposalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        coupleEmail: 'couple@example.com',
        proposalNumber: 'PR-001',
        expiresAt: '15 January 2027',
        shareUrl: `https://app.zebri.test/proposal/${proposal.share_token}`,
      }),
    )
    expect(updates[1]!.patch).toHaveProperty('email_sent_at')
    expect(inserts[0]).toMatchObject({
      table: 'couple_emails',
      row: { user_id: 'u1', couple_id: proposal.couple_id, template_name: 'Proposal', source: 'manual', to_email: 'couple@example.com' },
    })
  })

  it('skips the first update when the link is already on and the status is not draft', async () => {
    const { client, updates } = makeSupabase()
    await sendProposalToCouple(client, input({ proposal: { ...proposal, share_token_enabled: true, status: 'viewed' } }))
    expect(updates.map((u) => Object.keys(u.patch))).toEqual([['email_sent_at']])
  })

  it('records the automation source when a workflow sends', async () => {
    const { client, inserts } = makeSupabase()
    await sendProposalToCouple(client, input({ source: 'automation' }))
    expect(inserts[0]!.row.source).toBe('automation')
  })

  it('reports a failed send without stamping email_sent_at', async () => {
    sendProposalEmail.mockResolvedValue({ ok: false, error: 'resend down' })
    const { client, updates, inserts } = makeSupabase()
    const result = await sendProposalToCouple(client, input())
    expect(result).toEqual({ ok: false, stage: 'send', error: 'resend down' })
    expect(updates).toHaveLength(1)
    expect(inserts).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project unit tests/unit/lib/proposals/send.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `lib/proposals/send.ts`**

```ts
/**
 * Sending a proposal to its couple, shared by the manual route
 * (`/api/email/send-proposal`) and the `send_proposal` workflow action
 * (roadmap R2, spec 5.4, decision L8).
 *
 * Sending means three things, in this order: the share link becomes
 * resolvable (and a draft becomes `sent`), the email goes out, and the
 * send is stamped and logged. The first flip is what makes
 * `tg_proposals_emit_lifecycle` emit `proposal_sent`, so neither caller
 * touches the bus.
 *
 * Guards are a separate pure function so each caller can phrase the
 * refusal its own way: the route as an HTTP status and copy, the action
 * as a skip reason in the run log.
 *
 * @module lib/proposals/send
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { logger } from '@/lib/alerts/logger'
import type { PublicBranding } from '@/lib/branding/public-branding'
import { sendProposalEmail } from '@/lib/email'
import type { ResolvedSender } from '@/lib/email/sender-identity'
import type { Database } from '@/types/database'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.zebri.com.au'

/** The columns a send reads; both callers select exactly these. */
export interface SendableProposal {
  id: string
  couple_id: string
  proposal_number: string
  title: string
  share_token: string
  share_token_enabled: boolean
  status: string
  expires_at: string | null
  contract_template_id: string | null
}

/** Why a proposal cannot be sent right now. */
export type ProposalSendBlock = 'accepted' | 'no_contract_template' | 'no_primary_email'

/** Couple-facing copy per block, for the route's error responses. */
export const PROPOSAL_SEND_BLOCK_COPY: Record<ProposalSendBlock, string> = {
  accepted: 'This proposal has already been accepted.',
  no_contract_template: 'Choose a contract template before sending.',
  no_primary_email: 'No email on file for this couple. Add one in their profile.',
}

/**
 * The first reason a send must not happen, or null when it may.
 *
 * Accepted first: it is the one state no edit can fix. Then the contract
 * template, because accepting needs one. Then the email, which is the
 * couple's problem rather than the proposal's.
 */
export function proposalSendBlock(
  proposal: Pick<SendableProposal, 'status' | 'contract_template_id'>,
  coupleEmail: string | null,
): ProposalSendBlock | null {
  if (proposal.status === 'accepted') return 'accepted'
  if (!proposal.contract_template_id) return 'no_contract_template'
  if (!coupleEmail) return 'no_primary_email'
  return null
}

/** Everything a send needs beyond the proposal row. */
export interface ProposalSendInput {
  proposal: SendableProposal
  userId: string
  coupleEmail: string
  coupleName: string
  mcBusinessName: string
  sender: ResolvedSender
  branding: PublicBranding | null
  /** Logged on `couple_emails.source`, so the Emails tab can tell them apart. */
  source: 'manual' | 'automation'
}

export type ProposalSendResult =
  | { ok: true; shareUrl: string }
  | { ok: false; stage: 'enable_link' | 'send'; error: string }

/** `expires_at` as the email prints it, e.g. "15 January 2027". */
function formatExpiry(date: string | null): string | null {
  if (!date) return null
  return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Send `input.proposal` to the couple. The caller has already passed
 * {@link proposalSendBlock}; this function does not re-check.
 *
 * `supabase` is the caller's client: the route's user-scoped one (RLS
 * applies) or the action's admin one (a cron run has no session).
 */
export async function sendProposalToCouple(
  supabase: SupabaseClient<Database>,
  input: ProposalSendInput,
): Promise<ProposalSendResult> {
  const { proposal } = input

  // Sending implicitly says "the couple may view this" and "this is no
  // longer a draft". The two flips are independent: share_token_enabled
  // defaults to false so an unsent draft's link is dead, and a proposal
  // reverted to draft has the flag cleared while keeping its token.
  const updates: Record<string, unknown> = {}
  if (!proposal.share_token_enabled) updates.share_token_enabled = true
  if (proposal.status === 'draft') updates.status = 'sent'
  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('proposals').update(updates as never).eq('id', proposal.id)
    if (error) return { ok: false, stage: 'enable_link', error: error.message }
  }

  const shareUrl = `${APP_URL}/proposal/${proposal.share_token}`
  const result = await sendProposalEmail({
    coupleEmail: input.coupleEmail,
    coupleName: input.coupleName,
    proposalNumber: proposal.proposal_number,
    proposalTitle: proposal.title,
    expiresAt: formatExpiry(proposal.expires_at),
    shareUrl,
    mcBusinessName: input.mcBusinessName,
    sender: input.sender,
    branding: input.branding,
  })
  if (!result.ok) {
    logger.error('[proposals/send] resend failed', {
      userId: input.userId,
      proposalId: proposal.id,
      error: result.error,
    })
    return { ok: false, stage: 'send', error: result.error || 'Failed to send email' }
  }

  await supabase
    .from('proposals')
    .update({ email_sent_at: new Date().toISOString() } as never)
    .eq('id', proposal.id)

  // Best effort: a log failure must not fail an email that already went out.
  const { error: logErr } = await supabase.from('couple_emails').insert({
    user_id: input.userId,
    couple_id: proposal.couple_id,
    template_id: null,
    template_name: 'Proposal',
    subject: `A proposal from ${input.mcBusinessName} - ${proposal.proposal_number}`,
    to_email: input.coupleEmail,
    source: input.source,
    status: 'sent',
  } as never)
  if (logErr) {
    logger.error('[proposals/send] couple_emails log failed', {
      userId: input.userId,
      proposalId: proposal.id,
      error: logErr.message,
    })
  }

  return { ok: true, shareUrl }
}
```

- [ ] **Step 4: Run the unit test**

Run: `npx vitest run --project unit tests/unit/lib/proposals/send.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Make the route delegate**

Rewrite the body of `app/api/email/send-proposal/route.ts` from the proposal lookup onward (keep the auth, rate limit and Zod parts and the module TSDoc, adding "Delegates the send itself to `lib/proposals/send.ts`, shared with the `send_proposal` workflow action."):

```ts
  const { data: proposal, error } = await supabase
    .from('proposals')
    .select(
      'id, couple_id, proposal_number, title, share_token, share_token_enabled, status, expires_at, contract_template_id, couples(email, primary_email, name)',
    )
    .eq('id', proposalId)
    .eq('user_id', user.id)
    .single();
  if (error || !proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });

  const couple = Array.isArray(proposal.couples) ? proposal.couples[0] : proposal.couples;
  const coupleEmail = resolveCoupleEmail(couple);
  const block = proposalSendBlock(proposal, coupleEmail);
  if (block) {
    return NextResponse.json(
      { error: PROPOSAL_SEND_BLOCK_COPY[block] },
      { status: block === 'accepted' ? 409 : 400 },
    );
  }

  const mcBusinessName =
    (user.user_metadata?.business_name as string | undefined) ||
    (user.user_metadata?.display_name as string | undefined) ||
    `Your ${resolveVendorRole(user.user_metadata)}`;

  const result = await sendProposalToCouple(supabase, {
    proposal,
    userId: user.id,
    coupleEmail: coupleEmail!,
    coupleName: couple?.name || 'there',
    mcBusinessName,
    sender: await resolveSender(supabase, user.id, mcBusinessName),
    // Render the email with the sender's brand colors, fonts, and logo;
    // continues without branding if the fetch fails.
    branding: await emailBrandingForUser(supabase, user.id),
    source: 'manual',
  });
  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.stage === 'enable_link'
            ? 'Could not enable the proposal link. Please try again.'
            : result.error,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
```

Replace the imports of `sendProposalEmail` and `logger` with `import { PROPOSAL_SEND_BLOCK_COPY, proposalSendBlock, sendProposalToCouple } from '@/lib/proposals/send'`. The `couples(...)` embed makes `proposal` a superset of `SendableProposal`; if TS objects to the extra `couples` key, pass `{ ...proposal, couples: undefined }` is wrong (it keeps the key); instead destructure: `const { couples: _couples, ...row } = proposal` and pass `row`.

- [ ] **Step 6: Run the gates and the existing route consumers**

Run: `npm run typecheck && npx vitest run --project unit tests/unit/app/api/email/ tests/unit/lib/proposals/`
Expected: PASS; 0 type errors.

- [ ] **Step 7: Checkpoint**

Report `lib/proposals/send.ts`, its test, and the slimmer route. Do not commit.

---

### Task 7: The `send_proposal` action

**Files:**
- Create: `lib/automations/actions/proposals.ts`
- Modify: `types/automations.ts:197` (`ActionType`), `lib/automations/actions/index.ts:38-58`, `lib/automations/actions/ui.ts:127`, `lib/automations/audit-log/narrate.ts:74-102`, `lib/automations/launch-catalogue.ts:108-140`
- Test: `tests/unit/lib/automations/actions/send-proposal.test.ts`, `tests/integration/automations/send-proposal-action.test.ts`, `tests/unit/lib/automations/audit-log/narrate.test.ts`

**Interfaces:**
- Consumes: `ActionSpec` from `./index`; `RunContext`, `ActionType` from `@/types/automations`; `createAdminClient`; `resolveSender`; `sendProposalToCouple`, `proposalSendBlock`, `SendableProposal` from `@/lib/proposals/send`.
- Produces: `ActionType` gains `'send_proposal'`; `export const proposalActions: Partial<Record<ActionType, ActionSpec<any>>>`; config schema `{ proposalId?: uuid }` passthrough; output `{ proposal_id, proposal_link, proposal_number, proposal_title }`; skip outputs `{ skipped: 'no draft proposal' | 'no primary email' | 'no contract template' }`.
- Pick order (spec 5.4): explicit `config.proposalId` → `triggerEvent.payload.proposal_id` → any prior action's `proposal_id` → the couple's most recent `draft`. Whatever is picked must be a `draft`, or the step skips with `no draft proposal` (L8: draft only).

- [ ] **Step 1: Write the failing unit test**

Create `tests/unit/lib/automations/actions/send-proposal.test.ts`:

```ts
/**
 * `send_proposal` (roadmap R2, spec 5.4, decision L8): sends the couple's
 * most recent draft and skips with a reason otherwise. The pick order and
 * the skip reasons are the contract with the run log; the send itself is
 * `lib/proposals/send.ts`, covered separately.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RunContext } from '@/types/automations'

const sendProposalToCouple = vi.fn()
vi.mock('@/lib/proposals/send', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/proposals/send')>()),
  sendProposalToCouple: (...args: unknown[]) => sendProposalToCouple(...args),
}))
vi.mock('@/lib/email/sender-identity', () => ({
  resolveSender: vi.fn(async () => ({ kind: 'default' })),
}))

/** Rows the fake table returns, keyed by the filters the handler applies. */
const rows: Record<string, unknown>[] = []
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => {
      const filters: Record<string, unknown> = {}
      const chain = {
        select: () => chain,
        eq: (k: string, v: unknown) => ((filters[k] = v), chain),
        order: () => chain,
        limit: () => chain,
        single: async () => ({ data: rows.find((r) => r.id === filters.id) ?? null }),
        maybeSingle: async () => ({
          data:
            rows.find((r) => (filters.id ? r.id === filters.id : r.status === filters.status)) ??
            null,
        }),
      }
      return chain
    },
  }),
}))

import { actionRegistry } from '@/lib/automations/actions'

const spec = actionRegistry.send_proposal!

const draft = {
  id: '7f2c1e58-0000-4000-8000-000000000001',
  couple_id: 'c1',
  proposal_number: 'PR-001',
  title: 'Wedding MC',
  share_token: 'tok',
  share_token_enabled: false,
  status: 'draft',
  expires_at: null,
  contract_template_id: 'tpl',
}
const sent = { ...draft, id: '7f2c1e58-0000-4000-8000-000000000002', status: 'sent', share_token_enabled: true }

function ctx(overrides: Partial<RunContext> = {}): RunContext {
  return {
    userId: 'u1',
    automationId: 'a',
    runId: 'r',
    instanceId: 'r',
    stepId: 's',
    coupleId: 'c1',
    triggerEvent: { payload: {} } as never,
    couple: { id: 'c1', name: 'Sam & Alex', email: 'sam@example.com' } as never,
    invoice: null,
    mc: { userId: 'u1', businessName: 'Acme MC', branding: null } as never,
    actionResults: {},
    ...overrides,
  }
}

describe('send_proposal config', () => {
  it('accepts an empty config and an explicit proposal id', () => {
    expect(spec.configSchema.safeParse({}).success).toBe(true)
    expect(spec.configSchema.safeParse({ proposalId: draft.id }).success).toBe(true)
    expect(spec.configSchema.safeParse({ proposalId: 'latest' }).success).toBe(false)
  })
})

describe('send_proposal handler', () => {
  beforeEach(() => {
    rows.length = 0
    vi.clearAllMocks()
    sendProposalToCouple.mockResolvedValue({ ok: true, shareUrl: 'https://app.zebri.test/proposal/tok' })
  })

  it("sends the couple's most recent draft and returns the link", async () => {
    rows.push(sent, draft)
    const result = await spec.handler(ctx(), {})
    expect(sendProposalToCouple).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ proposal: draft, source: 'automation', coupleEmail: 'sam@example.com' }),
    )
    expect(result).toEqual({
      kind: 'ok',
      output: {
        proposal_id: draft.id,
        proposal_link: 'https://app.zebri.test/proposal/tok',
        proposal_number: 'PR-001',
        proposal_title: 'Wedding MC',
      },
    })
  })

  it('prefers the proposal named in the trigger payload', async () => {
    rows.push(draft, { ...draft, id: '7f2c1e58-0000-4000-8000-000000000009', proposal_number: 'PR-009' })
    const result = await spec.handler(
      ctx({ triggerEvent: { payload: { proposal_id: '7f2c1e58-0000-4000-8000-000000000009' } } as never }),
      {},
    )
    expect(result).toMatchObject({ output: { proposal_number: 'PR-009' } })
  })

  it("prefers a prior step's proposal over the couple's latest draft", async () => {
    rows.push(draft, { ...draft, id: '7f2c1e58-0000-4000-8000-000000000008', proposal_number: 'PR-008' })
    const result = await spec.handler(
      ctx({ actionResults: { s0: { proposal_id: '7f2c1e58-0000-4000-8000-000000000008' } } }),
      {},
    )
    expect(result).toMatchObject({ output: { proposal_number: 'PR-008' } })
  })

  it('skips when the picked proposal is not a draft', async () => {
    rows.push(sent)
    const result = await spec.handler(ctx(), { proposalId: sent.id })
    expect(result).toEqual({ kind: 'ok', output: { skipped: 'no draft proposal' } })
    expect(sendProposalToCouple).not.toHaveBeenCalled()
  })

  it('skips when the couple has no draft', async () => {
    rows.push(sent)
    expect(await spec.handler(ctx(), {})).toEqual({ kind: 'ok', output: { skipped: 'no draft proposal' } })
  })

  it('skips when the couple has no email', async () => {
    rows.push(draft)
    const result = await spec.handler(ctx({ couple: { id: 'c1', name: 'Sam', email: null } as never }), {})
    expect(result).toEqual({ kind: 'ok', output: { skipped: 'no primary email' } })
  })

  it('skips when the draft has no contract template', async () => {
    rows.push({ ...draft, contract_template_id: null })
    expect(await spec.handler(ctx(), {})).toEqual({ kind: 'ok', output: { skipped: 'no contract template' } })
  })

  it('surfaces a failed send as a recoverable error', async () => {
    rows.push(draft)
    sendProposalToCouple.mockResolvedValue({ ok: false, stage: 'send', error: 'resend down' })
    expect(await spec.handler(ctx(), {})).toEqual({ kind: 'error', message: 'resend down', recoverable: true })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project unit tests/unit/lib/automations/actions/send-proposal.test.ts`
Expected: FAIL (`actionRegistry.send_proposal` undefined).

- [ ] **Step 3: Add the type and write the action**

In `types/automations.ts`, inside `ActionType` after `| 'send_invoice'`:

```ts
  | 'send_proposal'
```

Create `lib/automations/actions/proposals.ts`:

```ts
/**
 * Proposal actions (roadmap R2, spec 5.4).
 *
 * send_proposal  emails the couple their most recent draft proposal,
 *                enabling its share link. Draft only (decision L8): a
 *                resend nudge is a "Send email" step with
 *                `{{proposal.link}}`, so this step never re-mails a
 *                proposal the couple already has.
 *
 * @module lib/automations/actions/proposals
 */

import { z } from 'zod'

import { resolveSender } from '@/lib/email/sender-identity'
import {
  proposalSendBlock,
  sendProposalToCouple,
  type ProposalSendBlock,
  type SendableProposal,
} from '@/lib/proposals/send'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionType, RunContext } from '@/types/automations'

import type { ActionSpec } from './index'

const COLUMNS =
  'id, couple_id, proposal_number, title, share_token, share_token_enabled, status, expires_at, contract_template_id'

/** Only the id that overrides the pick; there is nothing else to configure. */
const sendProposalSchema = z.object({ proposalId: z.string().uuid().optional() }).passthrough()

/** Run-log phrasing per block. */
const SKIP_REASON: Record<ProposalSendBlock, string> = {
  accepted: 'no draft proposal',
  no_contract_template: 'no contract template',
  no_primary_email: 'no primary email',
}

/**
 * Resolve the proposal to send: explicit id → the triggering proposal →
 * a proposal a prior step produced (R3's create_proposal, decision L10)
 * → the couple's most recent draft.
 */
async function pickProposal(
  supabase: ReturnType<typeof createAdminClient>,
  ctx: RunContext,
  explicitId?: string,
): Promise<SendableProposal | null> {
  if (explicitId) {
    const { data } = await supabase
      .from('proposals')
      .select(COLUMNS)
      .eq('id', explicitId)
      .eq('user_id', ctx.userId)
      .single()
    return (data as SendableProposal | null) ?? null
  }
  const payload = (ctx.triggerEvent.payload as Record<string, unknown>) ?? {}
  if (typeof payload['proposal_id'] === 'string') return pickProposal(supabase, ctx, payload['proposal_id'])
  for (const actionId of Object.keys(ctx.actionResults)) {
    const r = ctx.actionResults[actionId] as Record<string, unknown> | null
    if (typeof r?.['proposal_id'] === 'string') return pickProposal(supabase, ctx, r['proposal_id'])
  }
  if (!ctx.couple) return null
  const { data } = await supabase
    .from('proposals')
    .select(COLUMNS)
    .eq('couple_id', ctx.couple.id)
    .eq('user_id', ctx.userId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as SendableProposal | null) ?? null
}

const sendProposal: ActionSpec<z.infer<typeof sendProposalSchema>> = {
  type: 'send_proposal',
  configSchema: sendProposalSchema,
  async handler(ctx, config) {
    const supabase = createAdminClient()
    const proposal = await pickProposal(supabase, ctx, config.proposalId)
    // A picked proposal that is no longer a draft (already sent, accepted,
    // declined, expired) is the same skip as no proposal at all: L8 says
    // this step sends drafts and nothing else.
    if (!proposal || proposal.status !== 'draft') {
      return { kind: 'ok', output: { skipped: 'no draft proposal' } }
    }
    const coupleEmail = ctx.couple?.email ?? null
    const block = proposalSendBlock(proposal, coupleEmail)
    if (block) return { kind: 'ok', output: { skipped: SKIP_REASON[block] } }

    const result = await sendProposalToCouple(supabase, {
      proposal,
      userId: ctx.userId,
      coupleEmail: coupleEmail!,
      coupleName: ctx.couple?.name ?? 'there',
      mcBusinessName: ctx.mc.businessName,
      sender: await resolveSender(supabase, ctx.userId, ctx.mc.businessName),
      branding: ctx.mc.branding ?? null,
      source: 'automation',
    })
    if (!result.ok) return { kind: 'error', message: result.error, recoverable: true }

    return {
      kind: 'ok',
      output: {
        proposal_id: proposal.id,
        proposal_link: result.shareUrl,
        proposal_number: proposal.proposal_number,
        proposal_title: proposal.title,
      },
    }
  },
  ui: {
    category: 'payments',
    label: 'Send proposal',
    description: "Email the couple their draft proposal",
    icon: 'FileText',
  },
}

export const proposalActions: Partial<Record<ActionType, ActionSpec<any>>> = {
  send_proposal: sendProposal,
}
```

- [ ] **Step 4: Register it everywhere the parity tests look**

- `lib/automations/actions/index.ts`: `import { proposalActions } from './proposals'` and `...proposalActions,` after `...documentActions,`.
- `lib/automations/actions/ui.ts`: after the `"send_invoice"` entry add

```ts
    "send_proposal": {
      "category": "payments",
      "label": "Send proposal",
      "description": "Email the couple their draft proposal",
      "icon": "FileText"
    },
```

- `lib/automations/audit-log/narrate.ts`: `send_proposal: 'Sent proposal',` in `COMPLETED_PHRASE` after `send_contract`; `send_proposal: 'Proposal',` in `ACTION_NOUN`.
- `lib/automations/launch-catalogue.ts`: `'send_proposal',` after `'send_invoice',` in `LAUNCH_VISIBLE_ACTIONS`.

- [ ] **Step 5: Extend the narrate test**

In `tests/unit/lib/automations/audit-log/narrate.test.ts`, add next to the existing `send_contract` / `send_invoice` cases (match the file's helper names):

```ts
  it('narrates a sent proposal and its skip reasons', () => {
    expect(narrateAuditEntry({ event: 'action_completed', actionType: 'send_proposal', actionLabel: null, details: {} }))
      .toMatchObject({ tone: 'success', text: 'Sent proposal' })
    expect(narrateAuditEntry({ event: 'action_completed', actionType: 'send_proposal', actionLabel: null, details: { skipped: 'no draft proposal' } }))
      .toMatchObject({ tone: 'warning', text: 'Proposal not sent — no draft proposal' })
  })
```

(The em dash in that expectation is the existing narrate output format, not new copy; do not change `narrate.ts`'s separator in this phase.)

- [ ] **Step 6: Run the unit suites**

Run: `npx vitest run --project unit tests/unit/lib/automations/ && npm run typecheck`
Expected: PASS including `action-ui-parity.test.ts` and `launch-catalogue.test.ts`.

- [ ] **Step 7: Write the failing integration test**

Create `tests/integration/automations/send-proposal-action.test.ts`:

```ts
/**
 * `send_proposal` on a real local DB: the draft flips (link on, status
 * sent, email_sent_at stamped), the lifecycle trigger emits
 * `proposal_sent`, a couple_emails row is logged as an automation send,
 * and a non-draft skips untouched. No RESEND_API_KEY in tests, so the
 * email transport is mocked; everything else is real.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const sendProposalEmail = vi.fn()
vi.mock('@/lib/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email')>()),
  sendProposalEmail: (...args: unknown[]) => sendProposalEmail(...args),
}))

import { actionRegistry } from '@/lib/automations/actions'
import type { RunContext } from '@/types/automations'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

let user: TestUser
let coupleId: string
let templateId: string
let seq = 0

async function seedProposal(overrides: Record<string, unknown> = {}): Promise<string> {
  seq += 1
  const { data, error } = await user.client
    .from('proposals')
    .insert({
      user_id: user.id,
      couple_id: coupleId,
      proposal_number: `PR-S${seq}`,
      title: 'Wedding MC',
      status: 'draft',
      contract_template_id: templateId,
      ...overrides,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

function ctx(overrides: Partial<RunContext> = {}): RunContext {
  return {
    userId: user.id,
    automationId: 'a',
    runId: 'r',
    instanceId: 'r',
    stepId: 's',
    coupleId,
    triggerEvent: { payload: {} } as never,
    couple: { id: coupleId, name: 'Anna & Jake', email: 'anna@example.com' } as never,
    invoice: null,
    mc: { userId: user.id, businessName: 'Acme MC', branding: null } as never,
    actionResults: {},
    ...overrides,
  }
}

beforeAll(async () => {
  user = await createTestUser()
  const { data: c } = await user.client
    .from('couples')
    .insert({ user_id: user.id, name: 'Anna & Jake', email: 'anna@example.com', status: 'quoted' })
    .select('id')
    .single()
  coupleId = c!.id
  const { data: t } = await user.client
    .from('contract_templates')
    .insert({ user_id: user.id, name: 'Standard', content: { type: 'doc', content: [] }, position: 1000 })
    .select('id')
    .single()
  templateId = t!.id
})
afterAll(async () => {
  await user.cleanup()
})
beforeEach(() => {
  sendProposalEmail.mockReset().mockResolvedValue({ ok: true })
})

describe('send_proposal action', () => {
  it('sends the latest draft: flips it, emits proposal_sent, logs the email', async () => {
    const older = await seedProposal()
    const id = await seedProposal()
    const result = await actionRegistry.send_proposal!.handler(ctx(), {})
    expect(result).toMatchObject({ kind: 'ok', output: { proposal_id: id, proposal_number: `PR-S${seq}` } })
    expect(sendProposalEmail).toHaveBeenCalledTimes(1)

    const { data: row } = await user.client
      .from('proposals')
      .select('status, share_token_enabled, email_sent_at')
      .eq('id', id)
      .single()
    expect(row).toMatchObject({ status: 'sent', share_token_enabled: true })
    expect(row!.email_sent_at).not.toBeNull()

    const { data: untouched } = await user.client.from('proposals').select('status').eq('id', older).single()
    expect(untouched!.status).toBe('draft')

    const { data: events } = await serviceClient()
      .from('automation_events')
      .select('event_type')
      .eq('source_table', 'proposals')
      .eq('source_id', id)
    expect(events!.map((e) => e.event_type)).toEqual(['proposal_sent'])

    const { data: log } = await user.client
      .from('couple_emails')
      .select('source, template_name')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    expect(log).toEqual({ source: 'automation', template_name: 'Proposal' })
  })

  it('skips a proposal that is not a draft and changes nothing', async () => {
    const id = await seedProposal({ status: 'sent', share_token_enabled: true })
    const result = await actionRegistry.send_proposal!.handler(ctx(), { proposalId: id })
    expect(result).toEqual({ kind: 'ok', output: { skipped: 'no draft proposal' } })
    expect(sendProposalEmail).not.toHaveBeenCalled()
    const { data: events } = await serviceClient()
      .from('automation_events')
      .select('id')
      .eq('source_table', 'proposals')
      .eq('source_id', id)
    expect(events).toHaveLength(0)
  })

  it('skips when the couple has no email', async () => {
    await seedProposal()
    const result = await actionRegistry.send_proposal!.handler(
      ctx({ couple: { id: coupleId, name: 'Anna & Jake', email: null } as never }),
      {},
    )
    expect(result).toEqual({ kind: 'ok', output: { skipped: 'no primary email' } })
  })
})
```

- [ ] **Step 8: Run it**

Run: `npx vitest run --project integration tests/integration/automations/send-proposal-action.test.ts`
Expected: PASS, 3 tests. `createAdminClient()` reads `SUPABASE_SERVICE_ROLE_KEY` from `.env.test`, the same way `generate-run-sheet.test.ts` runs its handler.

- [ ] **Step 9: Checkpoint**

Report the action, the two tests, and the registry / ui / narrate / catalogue / type edits. Do not commit.

---

### Task 8: `{{proposal.*}}` variables

**Files:**
- Modify: `lib/automations/variables.ts:27` (namespace list in TSDoc), `:130` (`LINK_LABELS`), `:159` (`LINK_LABELS_BY_ROUTE`), `:222` (`readPath`), `:498-508` (catalogue); `lib/email/template-variables.ts:92-95`
- Test: `tests/unit/lib/automations/variables.test.ts`

**Interfaces:**
- Produces: `{{proposal.link}}` (label "View your proposal"), `{{proposal.number}}`, `{{proposal.title}}`.
- Resolution order: `proposal_<key>` on the trigger payload (a preview stuffs these) → `proposal_<key>` in any prior action's output (`send_proposal`) → for an event whose `source_table` is `proposals`, `link` from `payload.share_token`, `title` from `payload.title`. Exact keys only: a `title` on a contract-triggered payload is not the proposal's.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/lib/automations/variables.test.ts` (reuse the file's existing context builder if it has one; otherwise build a `RunContext` the way the file's other tests do):

```ts
describe('proposal variables', () => {
  const base = {
    userId: 'u1', automationId: 'a', runId: 'r', instanceId: 'r', stepId: 's', coupleId: 'c1',
    couple: null, invoice: null,
    mc: { userId: 'u1', businessName: 'Acme MC', contactName: 'Charlie', email: 'c@acme.test', phone: null, brandColor: null, logoUrl: null, quietHoursStart: null, quietHoursEnd: null, quietHoursTimezone: 'Australia/Sydney' },
    actionResults: {},
  }
  function withEvent(source_table: string, payload: Record<string, unknown>, actionResults = {}) {
    return { ...base, actionResults, triggerEvent: { source_table, payload } as never } as unknown as RunContext
  }

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.zebri.test'
  })

  it('builds the link from a lifecycle payload share token', () => {
    const ctx = withEvent('proposals', { share_token: 'tok', proposal_number: 'PR-001', title: 'Wedding MC' })
    expect(renderTemplate('{{proposal.link}}', ctx)).toBe('https://app.zebri.test/proposal/tok')
    expect(renderTemplate('{{proposal.number}}', ctx)).toBe('PR-001')
    expect(renderTemplate('{{proposal.title}}', ctx)).toBe('Wedding MC')
  })

  it("prefers a send_proposal step's output", () => {
    const ctx = withEvent('proposals', { share_token: 'old' }, {
      s1: { proposal_link: 'https://app.zebri.test/proposal/new', proposal_title: 'Fresh' },
    })
    expect(renderTemplate('{{proposal.link}}', ctx)).toBe('https://app.zebri.test/proposal/new')
    expect(renderTemplate('{{proposal.title}}', ctx)).toBe('Fresh')
  })

  it('does not borrow a title from a non-proposal payload', () => {
    const ctx = withEvent('contracts', { title: 'MC agreement', share_token: 'x' })
    expect(renderTemplate('{{proposal.title}}', ctx)).toBe('')
    expect(renderTemplate('{{proposal.link}}', ctx)).toBe('')
  })

  it('labels the link for email bodies', () => {
    expect(linkLabel('proposal.link')).toBe('View your proposal')
    expect(linkLabelForUrl('https://app.zebri.test/proposal/tok')).toBe('View your proposal')
  })

  it('lists the three variables in the catalogue', () => {
    const tokens = VARIABLE_CATALOGUE.flatMap((g) => g.variables.map((v) => v.token))
    expect(tokens).toEqual(expect.arrayContaining(['{{proposal.link}}', '{{proposal.number}}', '{{proposal.title}}']))
  })
})
```

The file already imports `linkLabel`, `linkLabelForUrl`, `renderTemplate` and `VARIABLE_CATALOGUE` from `@/lib/automations/variables` and `RunContext` from `@/types/automations`; add `beforeEach` to its `vitest` import.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project unit tests/unit/lib/automations/variables.test.ts`
Expected: the five new cases FAIL.

- [ ] **Step 3: Implement**

In `lib/automations/variables.ts`:

1. TSDoc namespace list (line 27 area): add `*   - `proposal.*` link, number, title`.
2. `LINK_LABELS`: add `'proposal.link': 'View your proposal',` after `contract.link`.
3. `LINK_LABELS_BY_ROUTE`: add `['proposal', 'View your proposal'],` after `contract`.
4. `readPath`: add `case 'proposal': return readProposal(ctx, key)` before the `invoice` / `contract` / `task` group.
5. Add the resolver next to `readEventField`:

```ts
/**
 * `{{proposal.*}}`. A `send_proposal` step's output (`proposal_link`,
 * `proposal_number`, `proposal_title`) or a preview payload stuffed the
 * same way wins. Otherwise, for an event the proposal trigger emitted,
 * the DB payload has the token (it cannot know this app's origin, so the
 * URL is built here) and the title under its own column name. Exact
 * keys only: the `title` on a contract payload is not the proposal's.
 */
function readProposal(ctx: RunContext, key: string): string {
  const payload = (ctx.triggerEvent.payload as Record<string, unknown>) ?? {}
  const stamped = payload[`proposal_${key}`]
  if (stamped != null) return String(stamped)
  for (const actionId of Object.keys(ctx.actionResults)) {
    const r = ctx.actionResults[actionId] as Record<string, unknown> | null
    const v = r?.[`proposal_${key}`]
    if (v != null) return String(v)
  }
  if (ctx.triggerEvent.source_table !== 'proposals') return ''
  switch (key) {
    case 'link':
      return typeof payload['share_token'] === 'string' ? `${APP_URL}/proposal/${payload['share_token']}` : ''
    case 'title':
      return payload['title'] != null ? String(payload['title']) : ''
    default:
      return ''
  }
}
```

(`number` is covered by the `proposal_number` read above the switch.)

6. Catalogue: in the `Links` group add `{ token: '{{proposal.link}}', label: 'Proposal link', example: 'https://zebri.app/proposal/…' },` after `contract.link`; in `Document Numbers & Totals` add `{ token: '{{proposal.number}}', label: 'Proposal number', example: 'PR-001' },` and `{ token: '{{proposal.title}}', label: 'Proposal title', example: 'Wedding MC proposal' },`.

In `lib/email/template-variables.ts`, next to the `contract_link` sample add:

```ts
        proposal_link: 'https://app.zebri.com.au/proposal/sample',
        proposal_number: 'PR-001',
        proposal_title: 'Wedding MC proposal',
```

- [ ] **Step 4: Run the test and the email preview tests**

Run: `npx vitest run --project unit tests/unit/lib/automations/variables.test.ts tests/unit/lib/email/ && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Checkpoint**

Report the two modified files and the test. Do not commit.

---

### Task 9: Builder UI, chips and the step preview

**Files:**
- Create: `app/(dashboard)/workflows/[id]/proposal-filters.tsx`
- Modify: `app/(dashboard)/workflows/[id]/apply-rule-card-body.tsx:79-118`, `app/(dashboard)/workflows/[id]/inspector-panel.tsx:163-170` and `:888-896`, `app/(dashboard)/workflows/[id]/document-composer-modal.tsx`
- Test: `tests/unit/app/workflows/trigger-filter-defs.test.ts`

**Interfaces:**
- Consumes: `ComparisonControl` from `./filter-controls`; `EVENT_DATE_FILTERS` from `./event-date-filters`; `fieldFilter`, `FilterConfig`, `TriggerFilterDef` from `./filter-list`; `proposalHtml` from `@/lib/email/html`.
- Produces: `export const PROPOSAL_EXPIRING_FILTERS: TriggerFilterDef[]`; `DocumentKind` gains `'proposal'`.

- [ ] **Step 1: Extend the chip test**

In `tests/unit/app/workflows/trigger-filter-defs.test.ts`, import `PROPOSAL_EXPIRING_FILTERS` from `@/app/(dashboard)/workflows/[id]/proposal-filters` and add to `SUITES`:

```ts
  { trigger: 'proposal_sent', filters: EVENT_DATE_FILTERS },
  { trigger: 'proposal_accepted', filters: EVENT_DATE_FILTERS },
  { trigger: 'proposal_expiring', filters: PROPOSAL_EXPIRING_FILTERS },
```

Run: `npx vitest run --project unit tests/unit/app/workflows/trigger-filter-defs.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 2: Write the chip file**

Create `app/(dashboard)/workflows/[id]/proposal-filters.tsx`:

```tsx
/**
 * Filter chips for the proposal triggers (roadmap R2, spec 5.2).
 *
 * The five lifecycle triggers use `EVENT_DATE_FILTERS` directly (see
 * `apply-rule-card-body.tsx`). `proposal_expiring` has one required
 * parameter, the lead time, rendered with the same numeric control as
 * the invoice_due chip, plus the wedding-date family.
 *
 * @module app/(dashboard)/workflows/[id]/proposal-filters
 */
'use client'

import { EVENT_DATE_FILTERS } from './event-date-filters'
import { ComparisonControl } from './filter-controls'
import { fieldFilter, type FilterConfig, type TriggerFilterDef } from './filter-list'

/** Matches `proposalExpiringConfig` in `lib/automations/triggers/proposals.ts`. */
const DEFAULT_DAYS = 3
const MAX_DAYS = 60

/** Label for the lead time, e.g. "3 days before it expires". */
function expiryLeadLabel(config: FilterConfig): string {
  const days = typeof config['days'] === 'number' ? config['days'] : DEFAULT_DAYS
  return days === 0 ? 'on the day it expires' : `${days} day${days === 1 ? '' : 's'} before it expires`
}

/**
 * The lead time is the trigger's required parameter (which emitted event
 * this workflow answers), so its chip is permanent. The value is clamped
 * to the schema's range here so a typo cannot save a config the
 * dispatcher would reject, which is a silently dead workflow.
 */
const expiryLeadFilter: TriggerFilterDef = {
  key: 'days',
  label: 'When it fires',
  chipLabel: 'fires',
  required: true,
  ...fieldFilter({ days: DEFAULT_DAYS }),
  valueLabel: expiryLeadLabel,
  summary: (config) => `Fires ${expiryLeadLabel(config)}`,
  render: (config, setConfig) => (
    <ComparisonControl
      value={(config['days'] as number | undefined) ?? DEFAULT_DAYS}
      unit="days"
      hint="Days before the proposal expires. 0 fires on the day itself."
      onChange={(_op, value) =>
        setConfig({ ...config, days: Math.max(0, Math.min(MAX_DAYS, Math.floor(value))) })
      }
    />
  ),
}

/** Filters for Proposal expiring: the lead time, then the wedding date. */
export const PROPOSAL_EXPIRING_FILTERS: TriggerFilterDef[] = [expiryLeadFilter, ...EVENT_DATE_FILTERS]
```

- [ ] **Step 3: Map the triggers to chips**

In `apply-rule-card-body.tsx`, import `PROPOSAL_EXPIRING_FILTERS` from `./proposal-filters` and add to `CHIP_TRIGGERS` after the contracts block:

```ts
  // Proposals carry the same wedding-date payload as contracts; expiring
  // adds its lead time.
  proposal_sent: () => EVENT_DATE_FILTERS,
  proposal_opened: () => EVENT_DATE_FILTERS,
  proposal_accepted: () => EVENT_DATE_FILTERS,
  proposal_declined: () => EVENT_DATE_FILTERS,
  proposal_expired: () => EVENT_DATE_FILTERS,
  proposal_expiring: () => PROPOSAL_EXPIRING_FILTERS,
```

- [ ] **Step 4: Zero-config step with a preview**

In `document-composer-modal.tsx`:

```ts
/** Which document the step sends. */
export type DocumentKind = 'contract' | 'invoice' | 'proposal'

const COPY: Record<DocumentKind, { title: string; number: string; docTitle: string; subject: string; what: string }> = {
  contract: { title: 'Send contract', number: 'CTR-001', docTitle: 'Wedding MC agreement', subject: 'Contract', what: 'most recent contract' },
  invoice: { title: 'Send invoice', number: 'INV-001', docTitle: 'Wedding MC services', subject: 'Invoice', what: 'most recent invoice' },
  proposal: { title: 'Send proposal', number: 'PR-001', docTitle: 'Wedding MC proposal', subject: 'A proposal', what: 'most recent draft proposal' },
}
```

Update the module TSDoc's first line to name all three steps. In `previewHtml`, turn the ternary into a `switch (kind)` with a `proposal` branch:

```ts
      case 'proposal':
        return proposalHtml(
          { ...shared, proposalNumber: copy.number, proposalTitle: copy.docTitle, expiresAt: null },
          identity?.branding ?? null,
        )
```

(import `proposalHtml` alongside `contractHtml, invoiceHtml`). Replace the body copy `Sends the couple's most recent {kind}` with `Sends the couple's {copy.what}`, and the subject with `${copy.subject} from ${businessName} - ${copy.number}` so the proposal preview reads "A proposal from Acme MC - PR-001", which is the real subject line. `frameTitle` and `caption` keep using `kind`.

In `inspector-panel.tsx`: add `'send_proposal',` to the zero-config set next to `'send_invoice',` and extend the case:

```tsx
    case 'send_contract':
    case 'send_invoice':
    case 'send_proposal': {
      const kind =
        actionType === 'send_contract' ? 'contract' : actionType === 'send_invoice' ? 'invoice' : 'proposal'
      return modal ? (
        <DocumentComposerModal isOpen={modal.open} onClose={modal.onClose} kind={kind} />
      ) : (
        <Hint>
          {kind === 'proposal'
            ? 'This action sends the most recent draft proposal for the triggering couple.'
            : `This action sends the most recent ${kind} for the triggering couple.`}
        </Hint>
      )
    }
```

If the inspector or the canvas has a separate list of "modal-only" step types (search `inspector-panel.tsx` and `flow-node.tsx` for `send_invoice`), add `send_proposal` to each such list.

- [ ] **Step 5: Run the tests and gates**

Run: `npx vitest run --project unit tests/unit/app/workflows/ tests/unit/app/\(dashboard\)/workflows/ && npm run typecheck && npm run lint:gate && npm run typecheck:strict:gate`
Expected: PASS; both gates within budget with no new findings in the touched files.

- [ ] **Step 6: Look at it**

Start the dev server (the remote dev DB has no R2 migration yet, but the picker, chips and step modal are client-side) and open a workflow canvas. Confirm: the "When does this apply?" palette has a **Proposals** group with six rules; picking "Proposal expiring" shows a permanent "fires: 3 days before it expires" chip and the wedding-date filters in "Add filter"; the step palette offers "Send proposal" under Payments and opening it shows the email preview with the "A proposal from … - PR-001" subject. Take a screenshot of each for the checkpoint.

- [ ] **Step 7: Checkpoint**

Report the new chip file, the three modified builder files, the test, and the screenshots. Do not commit.

---

### Task 10: E2E: accepting a proposal applies a workflow

The spec asks for "proposal accepted → apply workflow through the public accept flow in a logged-out context". The accept flow ends in a signature, which is what stamps `accepted_at` (L7), so the test signs.

**Files:**
- Modify: `tests/e2e/proposals.spec.ts`

**Interfaces:**
- Consumes: `login`, `uniqueName` from `./helpers`; env `TEST_PROPOSAL_TOKEN` (a sent, unaccepted proposal owned by the e2e login user, with at least one option and a contract template, on the target DB) and `CRON_SECRET`.
- The proposal is consumed by the run (it becomes accepted). This test is opt-in, like the existing sent-proposal one, and the run book for setting the token lives in `testing.md` (Task 11).

- [ ] **Step 1: Add the test**

Append inside the `test.describe('proposals', ...)` block:

```ts
  test('accepting a proposal applies a "Proposal accepted" workflow', async ({ page, browser }) => {
    test.skip(!process.env.TEST_PROPOSAL_TOKEN, 'needs a sent, unaccepted proposal token on the target DB')
    test.skip(!process.env.CRON_SECRET, 'needs CRON_SECRET to drive the tick')

    // 1. Build and activate the workflow as the MC.
    await login(page)
    const name = uniqueName('Proposal accepted')
    await page.goto('/workflows?tab=templates', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /New workflow|Build your first workflow/ }).first().click()
    await page.waitForURL(/\/workflows\/[0-9a-f-]{36}/, { timeout: 20000 })
    const canvasUrl = page.url()
    const nameInput = page.getByPlaceholder('Untitled workflow')
    await nameInput.fill(name)
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/workflows/')),
      nameInput.blur(),
    ])
    await page.getByText('When does this start?').click()
    const rules = page.getByRole('dialog', { name: 'When does this apply?' })
    await rules.getByPlaceholder('Find a rule…').fill('Proposal accepted')
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/workflows/')),
      rules.getByRole('button', { name: /Proposal accepted/ }).first().click(),
    ])
    await page.getByRole('button', { name: 'Turn on' }).click()
    await expect(page.getByRole('button', { name: 'Turn off' })).toBeVisible({ timeout: 10000 })

    // 2. The couple, logged out, chooses a package and signs.
    const context = await browser.newContext()
    const visitor = await context.newPage()
    await visitor.goto(`/proposal/${process.env.TEST_PROPOSAL_TOKEN}`)
    const cards = visitor.locator('article[data-option-id]')
    await cards.first().getByRole('button').first().click()
    await visitor.getByRole('button', { name: 'Accept and sign' }).click()
    await visitor.getByLabel('Your full legal name').fill('Sam Test')
    await visitor.getByLabel(/I agree to the terms above/).check()
    await visitor.getByRole('button', { name: 'Sign and confirm' }).click()
    // The pay step is optional; bank transfer skips it.
    const payLater = visitor.getByRole('button', { name: 'Pay by bank transfer later' })
    if (await payLater.isVisible({ timeout: 15000 }).catch(() => false)) await payLater.click()
    await expect(visitor.getByText('Your date is confirmed')).toBeVisible({ timeout: 20000 })
    await context.close()

    // 3. One tick applies the workflow; the canvas's "Running on" drawer shows it.
    const tick = await page.request.post('/api/cron/automations-tick', {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    })
    expect(tick.status()).toBe(200)
    await page.goto(canvasUrl, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Running on' }).click()
    await expect(page.getByText('Not applied yet')).toHaveCount(0, { timeout: 10000 })
    await expect(page.getByRole('heading', { name: 'Applied to' })).toBeVisible()
    await expect(page.locator('li').filter({ hasText: /Running|Completed|Waiting/ }).first()).toBeVisible()
  })
```

- [ ] **Step 2: Run it against the isolated local stack**

Follow the memory recipe `isolated_dev_server_verification` (rsync + APFS clone, `next dev` on `127.0.0.1` on a free port, `.env.local` pointed at local Supabase, `rm -rf .next/dev` if CSS looks stale). Seed a proposal for the e2e user through the app (create it on a couple with an email, pick a contract template, add a package option, "Send to couple" needs Resend so instead flip `share_token_enabled = true, status = 'sent'` in local SQL as the file header describes) and export its token:

Run: `TEST_PROPOSAL_TOKEN=<token> CRON_SECRET=<local secret> PLAYWRIGHT_BASE_URL=http://127.0.0.1:<port> npx playwright test tests/e2e/proposals.spec.ts --project=chromium`
Expected: the new test PASSES; the others keep their existing skip / pass status. Run once more with `--project="Mobile Chrome"` (or whichever Pixel 5 project name `playwright.config.ts` uses) with a fresh token.

- [ ] **Step 3: Checkpoint**

Report the test, the two run results (desktop + mobile), and the seeding steps you used. Do not commit.

---

### Task 11: Docs, gates, whole-branch review, live check

**Files:**
- Modify: `.claude/docs/workflows.md`, `.claude/docs/alerts.md`, `.claude/docs/security.md`, `.claude/docs/proposals.md`, `.claude/docs/database-schema.md`, `.claude/docs/testing.md`, `.claude/docs/automations-wiring.md` (the VISIBLE lists it says mirror the catalogue 1:1)

- [ ] **Step 1: Docs**

Each entry is a short, factual addition under the most relevant existing heading:

- `workflows.md`: under the apply-rules / triggers section, a "Proposals (R2)" subsection: the six triggers, which DB trigger / emitter emits each, the payload keys, the `days` lead time (0 to 60, default 3), the `send_proposal` step (draft only, pick order, the three skip reasons), and the `{{proposal.link}}` / `.number` / `.title` variables. In "The cron sweep" list the `proposal_expiring` emitter.
- `automations-wiring.md`: add the six triggers and `send_proposal` to the VISIBLE lists.
- `alerts.md`: `cron_job_failed` now also fires with `job: 'expire-proposals'`.
- `security.md`: cron-route table row for `/api/cron/expire-proposals` (`isCronAuthorized`, admin client, RPC revoked from `authenticated`); RLS matrix row for `automation_events` gains "+ `tests/integration/proposals/lifecycle-events.test.ts` (proposal rows, cross-tenant read denial)"; the `expire_proposals()` row's "the cron route is pending (Task 6)" becomes "called by `/api/cron/expire-proposals` (pg_cron `zebri:expire-proposals`, 22:10 UTC)". Note `tg_proposals_emit_lifecycle` under the security-definer function inventory if one exists there.
- `proposals.md`: under "Status machine", which transition emits which bus event; under the send section, that `lib/proposals/send.ts` is shared by the route and the workflow step; a "Workflows" subsection pointing to `workflows.md`.
- `database-schema.md`: `tg_proposals_emit_lifecycle` in the trigger inventory with its guards and payload; the `zebri:expire-proposals` job in the scheduled-jobs table (with the R1 jobs).
- `testing.md`: the new integration and unit files; the `TEST_PROPOSAL_TOKEN` run book for the accept e2e (the token must be a sent, unaccepted proposal of the e2e user with an option and a contract template, and is consumed by the run).

No em dashes in any of it.

- [ ] **Step 2: Full gates**

Run, in order:

```
npm run typecheck
npm run typecheck:strict:gate
npm run lint:gate
npx vitest run --project unit
npx vitest run --project integration
```

Expected: 0 type errors; strict and lint within budget (ratchet the budget DOWN in the gate script if a count fell); unit all green; integration green except the two known-foreign suites (`booking-rpcs`, `branding-overhaul-migration`). Paste the last lines of each into the checkpoint.

- [ ] **Step 3: Whole-branch review**

Dispatch a fresh reviewer (the `security-reviewer` agent for the migration, the cron route, the action and the send helper; a general reviewer for the rest) over `git diff origin/staging...HEAD` plus the untracked files. The per-task reviews have missed seam bugs on every proposals phase so far (memory `sdd_seam_bugs`), so this pass looks specifically at: the payload keys the SQL emits versus what `proposals.ts`, `proposal-expiring.ts` and `variables.ts` read; the pick order in `send_proposal` versus the R3 `create_proposal` output name (`proposal_id`); `SendableProposal` versus both callers' `select` strings; the `couple_emails.source` value; and anything that reads entitlements from `user_metadata`. Every finding gets fixed and re-verified by the reviewer.

- [ ] **Step 4: Live check on the isolated stack**

On the isolated dev server against local Supabase (Task 10's setup), with the R2 migration applied:

1. `/admin` → Scheduler card shows `zebri:expire-proposals` at `10 22 * * *`.
2. Build a workflow "Proposal accepted" → "Send email" with `{{proposal.link}}` and `{{proposal.title}}` in the body; turn it on. Accept a seeded proposal as a logged-out visitor; tick; open the couple's Workflow tab and the run log: the email step ran (or paused for quiet hours), and its rendered body links "View your proposal" to `/proposal/<token>`.
3. Build "Proposal expiring, 3 days" → "Send email". Seed a sent proposal with `expires_at = today + 3`; tick twice; exactly one `proposal_expiring` row on the bus, one instance.
4. Build a manual workflow with a "Send proposal" step; apply it to a couple with a draft proposal and an email; run it: the proposal flips to sent with the link on, the run log says "Sent proposal", the couple's Emails tab shows the Proposal row; apply it again: the run log says "Proposal not sent — no draft proposal".
5. `curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:<port>/api/cron/expire-proposals` on a proposal with `expires_at` yesterday: `{ ok: true, expired: 1 }` and one `proposal_expired` bus row.
6. No console errors on the canvas, the picker, the step modal, or the public proposal page (desktop and a 400px viewport).

Screenshots of 2, 3 and 4 in the checkpoint.

- [ ] **Step 5: Hand-off checkpoint**

Report: every changed file grouped by task; the gate outputs; the review findings and their fixes; the live-check results. Remind the user of the post-merge steps for zebri-crm-dev and production: CI deploys the migration (`supabase db push`); the new job picks up the Vault secrets the R1 "Sync scheduler" wrote, so nothing to press unless that project was never synced; confirm with `select jobname, schedule from cron.job where jobname = 'zebri:expire-proposals'`. Do not commit.

---

## Self-review

**Spec coverage (section 5):**

| Spec item | Task |
|---|---|
| 5.1 one trigger, five events, guards, common payload, `event_date` join, no INSERT branch | 3 |
| 5.1 extra payload per event | 3 (table) |
| 5.2 `TriggerType` + six, `TriggerCategory` + `proposal` | 2 |
| 5.2 specs in `triggers/proposals.ts`, spread into the registry, shared matcher, `days` 0 to 60 default 3 | 1, 2 |
| 5.2 launch catalogue (picker, copilot schemas, copilot prompt all derive from it) | 2 |
| 5.2 category label where `contract`'s lives (`TRIGGER_CATEGORIES`) | 2 |
| 5.2 lead-time chip reusing the invoice_due control | 9 |
| 5.3 cron route: `isCronAuthorized`, admin client, `expire_proposals()`, alert + 500 | 4 |
| 5.3 pg_cron job `10 22 * * *` in the 5.1 migration; not in `vercel.json` | 3 |
| 5.3 emitter: lead times from `loadActiveTriggerConfigs`, candidates sent/viewed + `accepted_at is null` + date match, payload `days_until_expiry` + `expires_at`, per-day dedupe | 5 |
| 5.4 `sendProposalToCouple` lifted, route keeps auth / rate limit / Zod / HTTP copy, shared guards | 6 |
| 5.4 action pick order, three skip reasons, flips + DB emits `proposal_sent`, output keys | 7 |
| 5.4 inspector zero-config, `DocumentComposerModal kind="proposal"`, catalogue + narrate | 7, 9 |
| 5.5 `case 'proposal'`, `{{proposal.link}}` label "View your proposal", number, title, link from send output or payload | 8 |
| 5.6 integration: guards once / never on touch, cross-tenant denial, emitter dedupe, action on real DB | 3, 5, 7 |
| 5.6 unit: trigger match, chip config, variable resolution, narrate | 2, 9, 8, 7 |
| 5.6 e2e accept → apply, logged out | 10 |
| 5.6 six docs | 11 |
| §9 security checklist, whole-branch review, live verification | 11 |

Deliberate deviations, all recorded in the task text: the shared filter helpers move to `triggers/event-date.ts` (needed to avoid an import cycle the spec did not anticipate); `share_token` rides on the payloads so the L8 nudge case resolves `{{proposal.link}}` (the spec's "dispatcher's denormalised payload" does not exist for contracts today either; this is the equivalent); `total` is the accepted invoice's subtotal with the option subtotal as fallback; the send helper's guard is a separate pure function so each caller keeps its own phrasing.

**Placeholder scan:** no TBD / TODO / "similar to Task N"; every code step has the code; the narrate test note explains the one em dash it asserts on (existing output, unchanged).

**Type consistency:** `SendableProposal` fields match both `select` strings (Tasks 6 and 7, `COLUMNS`); `proposalSendBlock` signature is the same in Tasks 6 and 7; `days_until_expiry` is the payload key in Tasks 2, 5 and the chip key `days` in Tasks 2, 5, 9; `proposal_id` / `proposal_link` / `proposal_number` / `proposal_title` are the output keys in Task 7 and the `proposal_${key}` reads in Task 8; `proposalExpiringEmitter` is the export in Task 5 and the registry entry; the pg_cron job name `zebri:expire-proposals` is the same in Tasks 3 and 11 and the scheduler test.
