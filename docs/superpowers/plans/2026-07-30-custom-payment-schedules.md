# Custom Payment Schedules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an MC define reusable multi-stage payment schedules, apply one to an invoice, and have the couple pay each stage in turn, replacing the hardcoded deposit + final-balance model.

**Architecture:** A pure resolver (`lib/payments/resolve-stages.ts`) turns template stages plus an invoice total into resolved stage rows, and is the single source of truth shared by the builder preview and the server action. Three new tables hold saved schedules, their template stages, and the per-invoice snapshot. Authoring happens entirely inside the invoice builder via a Notion-style picker popover; there is no Schedules page. Two migrations land in the same PR: an additive one first so every consumer can be rewritten and tested against stage rows, then a guarded destructive one that drops the seven legacy columns and replaces three RPCs.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4 semantic tokens, Supabase (Postgres + RLS), `@radix-ui/react-popover`, `@tanstack/react-query`, `@dnd-kit`, Zod, Stripe, Vitest 3, React Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-28-custom-payment-schedules-design.md`

## Global Constraints

- **Branch:** `feature/custom-payment-schedules` (already created, spec committed at `d743fcc`). Ships as one PR onto `staging`, never straight to `main`.
- **No em dashes** anywhere in code, comments, copy, or commit messages.
- **TSDoc on every exported function, type and module**, plus why-comments on non-obvious logic. This overrides any default minimal-comment habit.
- **No `any`.** Use generated `Database` types from `types/database.ts` end to end. Regenerate after Migration A and again after Migration B.
- **`npm run typecheck` must stay at 0 errors.** `npm run typecheck:strict` and `npm run lint:gate` budgets must only ever decrease; ratchet them down when this work reduces them.
- **Design system only:** semantic tokens (`bg-surface`, `text-text-muted`, `border-border`), primitives from `components/ui/` instead of raw `<button>` / `<input>` / `<select>`, `rounded-xl` on buttons, `strokeWidth={1.5}` on Lucide icons, `cursor-pointer` on interactive elements, no inline `style={{}}` outside the public branded surfaces that already use it.
- **Components ~150 lines max.** Split when larger.
- **Migrations are the source of truth.** Deploy via CI `supabase db push` only, never the Supabase web SQL editor. Destructive SQL needs an `-- @ALLOW_DESTRUCTIVE: <reason>` marker or `scripts/check-migrations.sh` rejects the deploy.
- **Money is stored in dollars** on `invoices.subtotal` (numeric), but stage amounts resolve to **integer cents** in `invoice_payment_stages.amount_cents`. For `amount_type = 'fixed'`, `amount_value` is **dollars**. Do not mix the two units.
- **Local Supabase for tests:** `supabase start` (Docker). After any `supabase db reset`, run the DML-grant repair SQL or integration tests silently skip with permission-denied errors.
- **Fix the app, never patch the test.** A failing test is a bug in the app.
- Run `npm test` (unit + integration), `npm run typecheck`, `npm run lint:gate` before each commit.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `lib/payments/resolve-stages.ts` | Pure resolver, validation, and the save-direction inverse. No React, no DB. |
| `supabase/migrations/20260730000000_create_payment_schedules.sql` | Migration A: three tables, RLS, indexes, both backfills. Additive only. |
| `supabase/migrations/20260730000100_drop_legacy_deposit_columns.sql` | Migration B: backfill guard, seven column drops, three RPC replacements. |
| `app/(dashboard)/payments/schedule-actions.ts` | Server actions for saved-schedule CRUD and invoice stage persistence. |
| `components/builders/parts/schedule-picker.tsx` | The apply / rename / delete / set-default popover. |
| `components/builders/parts/payment-stage-row.tsx` | One editable stage row on the timeline. |
| `components/builders/parts/use-invoice-stages.ts` | Stage state, apply and save mutations for the invoice builder. |
| `types/payment-schedule.ts` | Shared domain types for schedules and stages. |
| `tests/unit/lib/payments/resolve-stages.test.ts` | Resolver coverage. |
| `tests/integration/payments/payment-schedules-rls.test.ts` | Cross-tenant denial on all three tables. |
| `tests/integration/payments/stage-backfill.test.ts` | Migration A backfill replayed from zero. |
| `tests/integration/payments/sign-contract-stages.test.ts` | `sign_contract` stamps the default schedule. |
| `tests/unit/components/builders/payment-stage-row.test.tsx` | Row editing behaviour. |
| `tests/e2e/payment-schedules.spec.ts` | Full couple-facing flow, desktop + Pixel 5 + iPhone 12. |

**Modified:**

| File | Change |
|---|---|
| `components/builders/parts/payment-schedule.tsx` | Two hardcoded rows become an N-row timeline shell. |
| `components/builders/invoice-builder-modal.tsx` | Four deposit state fields collapse into `stages` behind the hook; remove the lines 280-292 auto-save workaround. |
| `app/api/stripe/invoice-payment/route.ts` | `paymentType` becomes `'stage' \| 'remaining'`. |
| `app/api/stripe/webhook/route.ts` | `processInvoicePayment()` stamps stages and derives status. |
| `app/invoice/[token]/page.tsx` | `hasSchedule` and amounts come from stages. |
| `app/invoice/[token]/_components/public-invoice.ts` | `PublicInvoice` gains `stages`, loses five deposit keys. |
| `app/invoice/[token]/_components/invoice-payment-schedule.tsx` | Maps over stages. |
| `app/invoice/[token]/pay-with-card-button.tsx` | New `paymentType` values plus `stageId`. |
| `lib/branding/public-blocks/shared.ts` | `paymentSchedule` becomes a stages array. |
| `lib/branding/public-blocks/payment-schedule.tsx` | Maps over stages. |
| `app/(dashboard)/branding/blocks/block-toolbar.tsx` | Row style controls become row-generic. |
| `app/(dashboard)/branding/blocks/types.ts` | Block description and default props. |
| `app/branding/preview/[surface]/page.tsx` | Both sample invoices get three stages. |
| `lib/contracts/contract-variables.ts` | `deposit_amount` sources the first stage. |
| `lib/branding/document-variables.ts` | Redefine `deposit_amount` / `deposit_due_date`. |
| `app/api/email/send-contract/route.ts` | Drop the `user_metadata` deposit read. |
| `components/builders/contract-builder-modal.tsx` | Drop the `user_metadata` deposit read. |
| `lib/automations/time-emitters/invoice-due.ts` | Anchor on unpaid stage rows. |
| `lib/automations/time-emitters/invoice-overdue.ts` | Anchor on unpaid stage rows. |
| `lib/automations/triggers.ts` | Enforce `isFinalBalance`; update both match comments. |
| `lib/automations/conditions.ts` | `has_paid_deposit` reads the first stage. |
| `app/(dashboard)/automations/[id]/inspector-extended.tsx` | Expose the `isFinalBalance` checkbox. |
| `app/(dashboard)/payments/actions.ts` | Drop `deposit_percent` from invoice writes and the option copy. |
| `app/(dashboard)/payments/invoices-list.tsx` | Relabel `deposit_paid` to "Part paid". |
| `app/(dashboard)/templates/package-edit-form.tsx` | Remove the "Booking deposit" field. |
| `app/(dashboard)/templates/packages-manager.tsx` | Drop `deposit_percent` from row type, drafts, duplicate, preview. |
| `app/(dashboard)/templates/package-preview.tsx` | Drop the deposit line. |
| `components/builders/parts/proposal-option-card.tsx` | Drop the deposit terms chip. |
| `components/builders/parts/use-apply-sources.ts` | Drop `depositPercent` from both sources. |
| `lib/payments/proposal-view.ts` | Drop `deposit_percent`. |

---

### Task 1: The stage resolver

The pure heart of the feature. Everything else consumes it. No DB, no React, so it is fully unit-testable and gets written first.

**Files:**
- Create: `types/payment-schedule.ts`
- Create: `lib/payments/resolve-stages.ts`
- Test: `tests/unit/lib/payments/resolve-stages.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `StageAmountType = 'percent' | 'fixed' | 'remainder'`
  - `TemplateStage { label: string; amountType: StageAmountType; amountValue: number | null; dueOffsetDays: number }`
  - `ResolvedStage { position: number; label: string; amountType: StageAmountType; amountValue: number | null; amountCents: number; dueDate: string | null }`
  - `StageValidationError` discriminated union with `code` values `'multiple_remainders' | 'remainder_not_last' | 'sum_mismatch' | 'fixed_exceeds_total' | 'single_stage'`
  - `ResolveResult = { ok: true; stages: ResolvedStage[] } | { ok: false; errors: StageValidationError[] }`
  - `resolveStages(template: TemplateStage[], invoiceTotalCents: number, issueDate: string): ResolveResult`
  - `toTemplateStages(stages: ResolvedStage[], issueDate: string): TemplateStage[]`
  - `validateForSave(template: TemplateStage[]): StageValidationError[]`

- [ ] **Step 1: Write the shared types**

Create `types/payment-schedule.ts`:

```ts
/**
 * Shared domain types for custom payment schedules.
 *
 * A *template* stage lives on a saved `payment_schedules` row and stores a
 * relative due offset, so it is portable to any future invoice. A *resolved*
 * stage lives on `invoice_payment_stages` and stores a concrete date and an
 * integer cent amount, frozen at apply time so a paid stage cannot shift when
 * the MC later edits a line item.
 *
 * @module types/payment-schedule
 */

/** How a stage's amount is expressed. */
export type StageAmountType = 'percent' | 'fixed' | 'remainder'

/**
 * One stage on a saved, reusable schedule.
 *
 * `amountValue` is a percentage for `'percent'`, **dollars** for `'fixed'`, and
 * null for `'remainder'`. Dollars rather than cents because the rest of the
 * invoice surface (`invoices.subtotal`) is dollars; only the resolved
 * `amountCents` is in cents.
 */
export interface TemplateStage {
  label: string
  amountType: StageAmountType
  amountValue: number | null
  /** Days after the invoice issue date that this stage falls due. */
  dueOffsetDays: number
}

/** One stage stamped onto a specific invoice, with its amount frozen. */
export interface ResolvedStage {
  /** 1-based, contiguous, ascending. */
  position: number
  label: string
  amountType: StageAmountType
  amountValue: number | null
  amountCents: number
  /** ISO `YYYY-MM-DD`, or null when the stage carries no date. */
  dueDate: string | null
}

/** A saved schedule with its template stages. */
export interface PaymentSchedule {
  id: string
  name: string
  isDefault: boolean
  stages: TemplateStage[]
}

/** A stage row read back from `invoice_payment_stages`. */
export interface InvoiceStage extends ResolvedStage {
  id: string
  paidAt: string | null
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/unit/lib/payments/resolve-stages.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { resolveStages, toTemplateStages, validateForSave } from '@/lib/payments/resolve-stages'
import type { TemplateStage } from '@/types/payment-schedule'

const pct = (label: string, value: number, offset = 0): TemplateStage => ({
  label, amountType: 'percent', amountValue: value, dueOffsetDays: offset,
})
const fixed = (label: string, dollars: number, offset = 0): TemplateStage => ({
  label, amountType: 'fixed', amountValue: dollars, dueOffsetDays: offset,
})
const rest = (label: string, offset = 0): TemplateStage => ({
  label, amountType: 'remainder', amountValue: null, dueOffsetDays: offset,
})

const ISSUE = '2026-06-12'

describe('resolveStages', () => {
  it('resolves a percent-only schedule summing to 100', () => {
    const result = resolveStages([pct('Deposit', 30, 0), pct('Final', 70, 60)], 500_000, ISSUE)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.stages.map((s) => s.amountCents)).toEqual([150_000, 350_000])
    expect(result.stages.map((s) => s.position)).toEqual([1, 2])
  })

  it('adds due_offset_days to the issue date', () => {
    const result = resolveStages([pct('Deposit', 100, 7)], 100_000, ISSUE)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.stages[0]!.dueDate).toBe('2026-06-19')
  })

  it('resolves mixed fixed plus remainder', () => {
    // $500 fixed then the rest of a $5,000 invoice.
    const result = resolveStages([fixed('Booking fee', 500), rest('Balance', 90)], 500_000, ISSUE)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.stages.map((s) => s.amountCents)).toEqual([50_000, 450_000])
  })

  it('always totals the invoice to the cent under rounding', () => {
    // 3 x 33.333% of $1,000.01 cannot divide evenly; the last stage absorbs.
    const total = 100_001
    const result = resolveStages(
      [pct('One', 33.333), pct('Two', 33.333), pct('Three', 33.334)],
      total,
      ISSUE,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const sum = result.stages.reduce((acc, s) => acc + s.amountCents, 0)
    expect(sum).toBe(total)
  })

  it('rejects a fixed stage exceeding the total', () => {
    // The "$500 fixed on a $400 invoice" case.
    const result = resolveStages([fixed('Fee', 500), rest('Balance')], 40_000, ISSUE)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.map((e) => e.code)).toContain('fixed_exceeds_total')
  })

  it('rejects a remainder that is not last', () => {
    const result = resolveStages([rest('Balance'), pct('Deposit', 30)], 500_000, ISSUE)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.map((e) => e.code)).toContain('remainder_not_last')
  })

  it('rejects two remainder stages', () => {
    const result = resolveStages([rest('A'), rest('B')], 500_000, ISSUE)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.map((e) => e.code)).toContain('multiple_remainders')
  })

  it('rejects percents that do not reach the total without a remainder', () => {
    const result = resolveStages([pct('Deposit', 30), pct('Final', 60)], 500_000, ISSUE)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.map((e) => e.code)).toContain('sum_mismatch')
  })

  it('treats zero stages as a valid single-payment invoice', () => {
    const result = resolveStages([], 500_000, ISSUE)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.stages).toEqual([])
  })
})

describe('validateForSave', () => {
  it('rejects a one-stage schedule as equivalent to no schedule', () => {
    expect(validateForSave([pct('Everything', 100)]).map((e) => e.code)).toContain('single_stage')
  })

  it('accepts a two-stage schedule', () => {
    expect(validateForSave([pct('Deposit', 30), rest('Final')])).toEqual([])
  })
})

describe('toTemplateStages', () => {
  it('round-trips offsets across a different issue date', () => {
    const first = resolveStages([pct('Deposit', 25, 0), rest('Final', 90)], 400_000, ISSUE)
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const template = toTemplateStages(first.stages, ISSUE)
    expect(template.map((t) => t.dueOffsetDays)).toEqual([0, 90])

    // Applied to a later invoice, the offsets hold.
    const second = resolveStages(template, 800_000, '2026-08-01')
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.stages.map((s) => s.dueDate)).toEqual(['2026-08-01', '2026-10-30'])
    expect(second.stages.map((s) => s.amountCents)).toEqual([200_000, 600_000])
  })

  it('maps a null due date to offset 0', () => {
    const template = toTemplateStages(
      [{ position: 1, label: 'Deposit', amountType: 'percent', amountValue: 50, amountCents: 100, dueDate: null }],
      ISSUE,
    )
    expect(template[0]!.dueOffsetDays).toBe(0)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/lib/payments/resolve-stages.test.ts`
Expected: FAIL, "Failed to resolve import ... lib/payments/resolve-stages".

- [ ] **Step 4: Implement the resolver**

Create `lib/payments/resolve-stages.ts`:

```ts
/**
 * Pure resolution and validation for custom payment schedules.
 *
 * One module owns the maths so the builder preview and the server action cannot
 * disagree about what the couple will be charged. No React, no Supabase.
 *
 * @module lib/payments/resolve-stages
 */
import type { ResolvedStage, StageAmountType, TemplateStage } from '@/types/payment-schedule'

/** Why a schedule cannot be applied or saved. */
export type StageValidationError =
  | { code: 'multiple_remainders' }
  | { code: 'remainder_not_last'; position: number }
  | { code: 'sum_mismatch'; expectedCents: number; actualCents: number }
  | { code: 'fixed_exceeds_total'; position: number }
  | { code: 'single_stage' }

/** Outcome of resolving a template against a concrete invoice total. */
export type ResolveResult =
  | { ok: true; stages: ResolvedStage[] }
  | { ok: false; errors: StageValidationError[] }

/** Add whole days to an ISO `YYYY-MM-DD` date, returning the same format. */
function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  // UTC arithmetic throughout: a local-time Date would shift the calendar day
  // for anyone east of Greenwich, which is every Australian user.
  const base = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1))
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}

/** Whole-day difference between two ISO `YYYY-MM-DD` dates. */
function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`)
  const to = Date.parse(`${toIso}T00:00:00Z`)
  return Math.round((to - from) / 86_400_000)
}

/** Structural checks that do not depend on the invoice total. */
function structuralErrors(template: TemplateStage[]): StageValidationError[] {
  const errors: StageValidationError[] = []
  const remainderIndexes = template
    .map((s, i) => (s.amountType === 'remainder' ? i : -1))
    .filter((i) => i >= 0)

  if (remainderIndexes.length > 1) errors.push({ code: 'multiple_remainders' })
  const only = remainderIndexes[0]
  if (remainderIndexes.length === 1 && only !== template.length - 1) {
    errors.push({ code: 'remainder_not_last', position: (only ?? 0) + 1 })
  }
  return errors
}

/** Resolve one stage's cent amount, before rounding reconciliation. */
function stageCents(
  amountType: StageAmountType,
  amountValue: number | null,
  invoiceTotalCents: number,
): number {
  if (amountType === 'percent') {
    return Math.round(invoiceTotalCents * ((amountValue ?? 0) / 100))
  }
  if (amountType === 'fixed') {
    // amountValue is dollars on a fixed stage; everything downstream is cents.
    return Math.round((amountValue ?? 0) * 100)
  }
  return 0 // remainder is filled in afterwards
}

/**
 * Resolve template stages against an invoice total and issue date.
 *
 * Validation runs in stages and returns as soon as one fails: structure first,
 * then fixed-amount feasibility, then the sum check. Each stage's checks are
 * only meaningful once the earlier ones hold, so reporting them together would
 * produce noise. With two `remainder` stages, for instance, "what is left over"
 * has no answer, so no amount check can say anything useful.
 * `structuralErrors` does collect all of its own findings before returning.
 * Zero stages is valid and means a single-payment invoice.
 */
export function resolveStages(
  template: TemplateStage[],
  invoiceTotalCents: number,
  issueDate: string,
): ResolveResult {
  if (template.length === 0) return { ok: true, stages: [] }

  const errors = structuralErrors(template)
  if (errors.length > 0) return { ok: false, errors }

  const hasRemainder = template.some((s) => s.amountType === 'remainder')

  // Fixed amounts are absolute, so they are the only stages that can
  // individually exceed the invoice. Check before allocating anything.
  const fixedCents = template.reduce(
    (acc, s) => acc + (s.amountType === 'fixed' ? stageCents('fixed', s.amountValue, invoiceTotalCents) : 0),
    0,
  )
  if (fixedCents > invoiceTotalCents) {
    const offender = template.findIndex((s) => s.amountType === 'fixed')
    return { ok: false, errors: [{ code: 'fixed_exceeds_total', position: offender + 1 }] }
  }

  const cents = template.map((s) => stageCents(s.amountType, s.amountValue, invoiceTotalCents))
  const allocated = cents.reduce((a, b) => a + b, 0)

  if (hasRemainder) {
    const remainder = invoiceTotalCents - allocated
    if (remainder < 0) {
      const offender = template.findIndex((s) => s.amountType === 'fixed')
      return {
        ok: false,
        errors: [{ code: 'fixed_exceeds_total', position: (offender >= 0 ? offender : 0) + 1 }],
      }
    }
    cents[cents.length - 1] = remainder
  } else {
    // Each percent stage can round by at most a cent, so that is the only
    // drift we tolerate. Anything larger is a genuine declaration error
    // (for example percents that only add up to 90), not rounding.
    const percentCount = template.filter((s) => s.amountType === 'percent').length
    if (Math.abs(allocated - invoiceTotalCents) > percentCount) {
      return {
        ok: false,
        errors: [{ code: 'sum_mismatch', expectedCents: invoiceTotalCents, actualCents: allocated }],
      }
    }
    // The last stage absorbs the rounding difference so stages always sum
    // to the invoice total exactly.
    cents[cents.length - 1] = (cents[cents.length - 1] ?? 0) + (invoiceTotalCents - allocated)
  }

  return {
    ok: true,
    stages: template.map((s, i) => ({
      position: i + 1,
      label: s.label,
      amountType: s.amountType,
      amountValue: s.amountValue,
      amountCents: cents[i] ?? 0,
      dueDate: addDays(issueDate, s.dueOffsetDays),
    })),
  }
}

/**
 * Convert resolved invoice stages back into a portable template.
 *
 * This is the "Save this as a schedule" direction: concrete dates become
 * offsets from the invoice's issue date so the schedule can be applied to a
 * future invoice with a different issue date and total.
 */
export function toTemplateStages(stages: ResolvedStage[], issueDate: string): TemplateStage[] {
  return stages.map((s) => ({
    label: s.label,
    amountType: s.amountType,
    amountValue: s.amountValue,
    dueOffsetDays: s.dueDate ? daysBetween(issueDate, s.dueDate) : 0,
  }))
}

/**
 * Extra rule that applies only when persisting a reusable schedule: a
 * single-stage schedule is rejected because it is indistinguishable from having
 * no schedule at all, which the picker already offers as its own entry.
 */
export function validateForSave(template: TemplateStage[]): StageValidationError[] {
  const errors = structuralErrors(template)
  if (template.length === 1) errors.push({ code: 'single_stage' })
  return errors
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/lib/payments/resolve-stages.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 6: Typecheck and commit**

```bash
npm run typecheck
git add types/payment-schedule.ts lib/payments/resolve-stages.ts tests/unit/lib/payments/resolve-stages.test.ts
git commit -m "feat(payments): add pure stage resolver for custom payment schedules"
```

---

### Task 2: Migration A, additive schema and backfill

Creates the three tables and moves existing data into them. Nothing is dropped, so every current consumer keeps working and the following tasks can be written and tested against real stage rows.

**Files:**
- Create: `supabase/migrations/20260730000000_create_payment_schedules.sql`
- Modify: `types/database.ts` (regenerated, do not hand-edit)
- Test: `tests/integration/payments/payment-schedules-rls.test.ts`
- Test: `tests/integration/payments/stage-backfill.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1 (SQL only).
- Produces: tables `payment_schedules`, `payment_schedule_stages`, `invoice_payment_stages` with the columns named in the spec's section 3, and a `Database` type regenerated to include them.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260730000000_create_payment_schedules.sql`:

```sql
-- Custom payment schedules: reusable multi-stage payment plans.
--
-- Additive only. Migration 20260730000100 drops the legacy two-stage columns
-- once every consumer reads stage rows, and guards itself on the backfill
-- below having landed.

create table if not exists public.payment_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_schedule_stages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  schedule_id uuid not null references public.payment_schedules(id) on delete cascade,
  position integer not null,
  label text not null,
  amount_type text not null check (amount_type in ('percent', 'fixed', 'remainder')),
  amount_value numeric,
  due_offset_days integer not null default 0,
  -- A remainder stage absorbs what is left, so it carries no value; every
  -- other type must carry one. Enforced in SQL as well as the resolver so a
  -- direct write cannot create a stage the resolver refuses to read.
  constraint payment_schedule_stages_value_shape check (
    (amount_type = 'remainder' and amount_value is null)
    or (amount_type <> 'remainder' and amount_value is not null)
  )
);

create table if not exists public.invoice_payment_stages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  position integer not null,
  label text not null,
  amount_type text not null check (amount_type in ('percent', 'fixed', 'remainder')),
  amount_value numeric,
  amount_cents integer not null,
  due_date date,
  paid_at timestamptz,
  stripe_payment_intent_id text,
  constraint invoice_payment_stages_value_shape check (
    (amount_type = 'remainder' and amount_value is null)
    or (amount_type <> 'remainder' and amount_value is not null)
  )
);

-- At most one default schedule per MC. Partial unique index rather than a
-- trigger so the database is the arbiter.
create unique index if not exists payment_schedules_one_default
  on public.payment_schedules (user_id) where is_default;

create index if not exists payment_schedule_stages_schedule_idx
  on public.payment_schedule_stages (schedule_id);
create index if not exists invoice_payment_stages_invoice_idx
  on public.invoice_payment_stages (invoice_id);
-- Carries the reminder emitters, which scan for stages falling due on a date.
create index if not exists invoice_payment_stages_due_date_idx
  on public.invoice_payment_stages (due_date);

alter table public.payment_schedules enable row level security;
alter table public.payment_schedule_stages enable row level security;
alter table public.invoice_payment_stages enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['payment_schedules', 'payment_schedule_stages', 'invoice_payment_stages']
  loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format(
      'create policy %1$s_select on public.%1$s for select using (auth.uid() = user_id)', t);
    execute format(
      'create policy %1$s_insert on public.%1$s for insert with check (auth.uid() = user_id)', t);
    execute format(
      'create policy %1$s_update on public.%1$s for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format(
      'create policy %1$s_delete on public.%1$s for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ── Backfill 1: legacy invoice schedules become stage rows ────────────────
--
-- An invoice "has a schedule" today when deposit_percent or deposit_paid_at is
-- set. coalesce(deposit_percent, 50) mirrors the runtime default at
-- app/api/stripe/invoice-payment/route.ts:133, so an invoice with a recorded
-- deposit payment but no percentage resolves the same way it charges today.
with legacy as (
  select
    i.id,
    i.user_id,
    round((i.subtotal + i.subtotal * coalesce(i.tax_rate, 0) / 100) * 100)::int as total_cents,
    coalesce(i.deposit_percent, 50) as deposit_pct,
    i.deposit_due_date,
    i.deposit_paid_at,
    i.final_due_date,
    i.final_paid_at
  from public.invoices i
  where (i.deposit_percent is not null or i.deposit_paid_at is not null)
    and not exists (
      select 1 from public.invoice_payment_stages s where s.invoice_id = i.id
    )
),
deposit_rows as (
  insert into public.invoice_payment_stages (
    user_id, invoice_id, position, label, amount_type, amount_value,
    amount_cents, due_date, paid_at
  )
  select
    l.user_id, l.id, 1, 'Deposit', 'percent', l.deposit_pct,
    round(l.total_cents * l.deposit_pct / 100)::int,
    l.deposit_due_date, l.deposit_paid_at
  from legacy l
  returning invoice_id, amount_cents
)
insert into public.invoice_payment_stages (
  user_id, invoice_id, position, label, amount_type, amount_value,
  amount_cents, due_date, paid_at
)
select
  l.user_id, l.id, 2, 'Final balance', 'remainder', null,
  l.total_cents - d.amount_cents,
  l.final_due_date, l.final_paid_at
from legacy l
join deposit_rows d on d.invoice_id = l.id;

-- ── Default schedule per MC: function, trigger, and backfill ─────────────
--
-- Three parts, mirroring seed_default_contract_template in
-- 20260525000000_recovery_phase3_phase4_schema_drift.sql:358-596, which is this
-- codebase's established pattern for per-user defaults. A one-off backfill
-- would only cover users who existed at migration time, so every new signup
-- would have no default schedule and sign_contract would spawn stageless
-- invoices for them. The auth.users trigger is what makes it forward-safe.
--
-- Every user, not only those with default_deposit_percent set. That key turns
-- out never to be written by the app: it is read in exactly two places, both
-- with a `?? 25` fallback, and no Settings UI sets it. Seeding only the users
-- who have it would leave nearly everyone without a default, so sign_contract
-- would spawn stageless invoices where it previously applied a hardcoded 25%.
-- This turns that implicit fallback into real data.
create or replace function public.seed_default_payment_schedule(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_schedule_id uuid;
  v_deposit_pct numeric;
begin
  -- Idempotent, so the trigger and the backfill loop below cannot produce a
  -- second schedule for the same user (the partial unique index would reject
  -- it anyway, but failing the whole signup transaction is not acceptable).
  if exists (select 1 from public.payment_schedules where user_id = p_user_id) then
    return;
  end if;

  select coalesce((raw_user_meta_data ->> 'default_deposit_percent')::numeric, 25)
    into v_deposit_pct
  from auth.users
  where id = p_user_id;

  insert into public.payment_schedules (user_id, name, is_default)
  values (p_user_id, 'Default', true)
  returning id into v_schedule_id;

  insert into public.payment_schedule_stages (
    user_id, schedule_id, position, label, amount_type, amount_value, due_offset_days
  ) values
    -- 7 days mirrors the `current_date + interval '7 days'` the older
    -- sign_contract used for deposit_due_date.
    (p_user_id, v_schedule_id, 1, 'Deposit', 'percent', coalesce(v_deposit_pct, 25), 7),
    (p_user_id, v_schedule_id, 2, 'Final balance', 'remainder', null, 30);
end $$;

revoke all on function public.seed_default_payment_schedule(uuid) from public;
revoke all on function public.seed_default_payment_schedule(uuid) from anon, authenticated;

create or replace function public.trigger_seed_payment_schedule()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.seed_default_payment_schedule(new.id); return new; end;
$$;

drop trigger if exists on_new_user_seed_payment_schedule on auth.users;
create trigger on_new_user_seed_payment_schedule
  after insert on auth.users for each row
  execute function public.trigger_seed_payment_schedule();

-- Back-fill every existing user.
do $$
declare r record;
begin
  for r in select id from auth.users loop
    perform public.seed_default_payment_schedule(r.id);
  end loop;
end $$;
```

- [ ] **Step 2: Reset the local database and verify the migration applies**

```bash
supabase db reset
```

Expected: no errors, all migrations apply. If integration tests later report "permission denied", apply the DML-grant repair SQL for the stale-CLI issue before continuing.

- [ ] **Step 3: Regenerate the database types**

```bash
npx supabase gen types typescript --local > types/database.ts
npm run typecheck
```

Expected: `types/database.ts` now contains `payment_schedules`, `payment_schedule_stages` and `invoice_payment_stages`. Typecheck passes, because nothing consumes them yet.

- [ ] **Step 4: Write the failing RLS integration test**

**Test helper API, verified against `tests/integration/helpers/supabase.ts`.** The pseudo-names in the test code below are placeholders; substitute these real ones mechanically:

| Placeholder in the code below | Real API |
|---|---|
| `adminClient()` | `serviceClient()` — service role, bypasses RLS, setup and teardown only |
| `createTestUser()` | `createTestUser(metadata, appMetadata)` returning `TestUser` |
| `clientFor(bob)` | `bob.client` — already signed in as that user |
| (teardown) | `await user.cleanup()` in `afterAll`, which cascades owned rows |

`TestUser` is `{ id, email, client, cleanup }`. Pass paid app metadata so the user looks like a real subscriber, matching `tests/integration/rls/couple-statuses.test.ts`:

```ts
const pro = { subscription_status: 'active', subscription_plan: 'pro' }
const userA = await createTestUser({}, pro)
```

**Put the RLS spec at `tests/integration/rls/payment-schedules.test.ts`**, not under `payments/`. Every existing RLS spec lives in `tests/integration/rls/` and is titled `describe('RLS: <table> tenant isolation')`. Follow that convention. Read `tests/integration/rls/couple-statuses.test.ts` first and mirror its shape.

Note the `on_new_user_seed_payment_schedule` trigger from Step 1: a freshly created test user already has a "Default" schedule before your test inserts anything. Account for it rather than asserting an empty table.

```ts
/**
 * Cross-tenant RLS denial for the three payment-schedule tables.
 *
 * Ticks the coverage matrix in `.claude/docs/security.md`. Runs against local
 * Supabase with real schema and real policies.
 */
import { beforeAll, describe, expect, it } from 'vitest'

import { createTestUser, clientFor, adminClient } from '../helpers/supabase'

describe('payment schedule RLS', () => {
  let alice: { id: string; email: string }
  let bob: { id: string; email: string }
  let aliceScheduleId: string
  let aliceStageId: string
  let aliceInvoiceStageId: string

  beforeAll(async () => {
    alice = await createTestUser()
    bob = await createTestUser()

    const admin = adminClient()

    const { data: schedule, error: scheduleError } = await admin
      .from('payment_schedules')
      .insert({ user_id: alice.id, name: '30 / 70 split', is_default: false })
      .select('id')
      .single()
    expect(scheduleError).toBeNull()
    aliceScheduleId = schedule!.id

    const { data: stage, error: stageError } = await admin
      .from('payment_schedule_stages')
      .insert({
        user_id: alice.id,
        schedule_id: aliceScheduleId,
        position: 1,
        label: 'Deposit',
        amount_type: 'percent',
        amount_value: 30,
        due_offset_days: 0,
      })
      .select('id')
      .single()
    expect(stageError).toBeNull()
    aliceStageId = stage!.id

    const { data: invoice } = await admin
      .from('invoices')
      .insert({ user_id: alice.id, title: 'Test', subtotal: 5000, status: 'draft' })
      .select('id')
      .single()

    const { data: invStage, error: invStageError } = await admin
      .from('invoice_payment_stages')
      .insert({
        user_id: alice.id,
        invoice_id: invoice!.id,
        position: 1,
        label: 'Deposit',
        amount_type: 'percent',
        amount_value: 30,
        amount_cents: 150_000,
        due_date: '2026-08-01',
      })
      .select('id')
      .single()
    expect(invStageError).toBeNull()
    aliceInvoiceStageId = invStage!.id
  })

  it('denies Bob select on Alice payment_schedules', async () => {
    const bobClient = await clientFor(bob)
    const { data } = await bobClient.from('payment_schedules').select('id').eq('id', aliceScheduleId)
    expect(data).toEqual([])
  })

  it('denies Bob select on Alice payment_schedule_stages', async () => {
    const bobClient = await clientFor(bob)
    const { data } = await bobClient.from('payment_schedule_stages').select('id').eq('id', aliceStageId)
    expect(data).toEqual([])
  })

  it('denies Bob select on Alice invoice_payment_stages', async () => {
    const bobClient = await clientFor(bob)
    const { data } = await bobClient
      .from('invoice_payment_stages')
      .select('id')
      .eq('id', aliceInvoiceStageId)
    expect(data).toEqual([])
  })

  it('denies Bob update on Alice invoice_payment_stages', async () => {
    const bobClient = await clientFor(bob)
    const { data } = await bobClient
      .from('invoice_payment_stages')
      .update({ paid_at: new Date().toISOString() })
      .eq('id', aliceInvoiceStageId)
      .select('id')
    expect(data ?? []).toEqual([])
  })

  it('denies Bob delete on Alice payment_schedules', async () => {
    const bobClient = await clientFor(bob)
    await bobClient.from('payment_schedules').delete().eq('id', aliceScheduleId)
    const admin = adminClient()
    const { data } = await admin.from('payment_schedules').select('id').eq('id', aliceScheduleId)
    expect(data).toHaveLength(1)
  })

  it('rejects a second default schedule for one user', async () => {
    const admin = adminClient()
    await admin
      .from('payment_schedules')
      .update({ is_default: true })
      .eq('id', aliceScheduleId)
    // Alice already has a seeded "Default" schedule from the backfill, so the
    // partial unique index must reject this second one.
    const { data } = await admin
      .from('payment_schedules')
      .select('id')
      .eq('user_id', alice.id)
      .eq('is_default', true)
    expect(data).toHaveLength(1)
  })
})
```

Before writing this, open two existing specs in `tests/integration/` and copy their actual fixture helper import path and signatures. The names above (`createTestUser`, `clientFor`, `adminClient`) must be replaced with whatever the repo already uses.

- [ ] **Step 5: Write the failing backfill test**

Create `tests/integration/payments/stage-backfill.test.ts`:

```ts
/**
 * Migration A's backfill, verified against a seeded legacy invoice.
 *
 * The migration runs at `supabase db reset`, so this spec seeds a legacy-shaped
 * invoice, re-runs the backfill statement, and asserts the resulting stage rows
 * match the old column values.
 */
import { beforeAll, describe, expect, it } from 'vitest'

import { createTestUser, adminClient } from '../helpers/supabase'

describe('legacy invoice backfill', () => {
  let user: { id: string }
  let invoiceId: string

  beforeAll(async () => {
    user = await createTestUser()
    const admin = adminClient()
    // $5,000 + 10% GST = $5,500 total. 30% deposit = $1,650, final = $3,850.
    const { data } = await admin
      .from('invoices')
      .insert({
        user_id: user.id,
        title: 'Legacy invoice',
        subtotal: 5000,
        tax_rate: 10,
        status: 'deposit_paid',
        deposit_percent: 30,
        deposit_due_date: '2026-07-01',
        deposit_paid_at: '2026-07-02T00:00:00Z',
        final_due_date: '2026-09-01',
      })
      .select('id')
      .single()
    invoiceId = data!.id

    await admin.rpc('backfill_invoice_payment_stages')
  })

  it('creates two stages carrying the legacy amounts and dates', async () => {
    const admin = adminClient()
    const { data } = await admin
      .from('invoice_payment_stages')
      .select('position, label, amount_type, amount_value, amount_cents, due_date, paid_at')
      .eq('invoice_id', invoiceId)
      .order('position')

    expect(data).toHaveLength(2)
    expect(data![0]).toMatchObject({
      position: 1,
      label: 'Deposit',
      amount_type: 'percent',
      amount_cents: 165_000,
      due_date: '2026-07-01',
    })
    expect(data![0]!.paid_at).not.toBeNull()
    expect(data![1]).toMatchObject({
      position: 2,
      label: 'Final balance',
      amount_type: 'remainder',
      amount_value: null,
      amount_cents: 385_000,
      due_date: '2026-09-01',
      paid_at: null,
    })
  })

  it('leaves invoices with no legacy schedule alone', async () => {
    const admin = adminClient()
    const { data: plain } = await admin
      .from('invoices')
      .insert({ user_id: user.id, title: 'No schedule', subtotal: 1000, status: 'draft' })
      .select('id')
      .single()

    await admin.rpc('backfill_invoice_payment_stages')

    const { data } = await admin
      .from('invoice_payment_stages')
      .select('id')
      .eq('invoice_id', plain!.id)
    expect(data).toEqual([])
  })

  it('seeds a brand-new signup a default schedule via the trigger', async () => {
    // The migration's backfill loop only covers users who existed when it ran.
    // This asserts the auth.users trigger covers everyone after that, which is
    // what stops sign_contract spawning stageless invoices for new MCs.
    const fresh = await createTestUser()
    const admin = adminClient()
    const { data } = await admin
      .from('payment_schedules')
      .select('id, name, is_default')
      .eq('user_id', fresh.id)
    expect(data).toHaveLength(1)
    expect(data![0]).toMatchObject({ name: 'Default', is_default: true })
    await fresh.cleanup()
  })

  it('is idempotent: seeding twice leaves one schedule', async () => {
    const admin = adminClient()
    await admin.rpc('seed_default_payment_schedule', { p_user_id: user.id })
    const { data } = await admin
      .from('payment_schedules')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_default', true)
    expect(data).toHaveLength(1)
  })

  it('seeds every user a default schedule with a remainder stage', async () => {
    const admin = adminClient()
    const { data: schedules } = await admin
      .from('payment_schedules')
      .select('id, name, is_default')
      .eq('user_id', user.id)
      .eq('is_default', true)
    expect(schedules).toHaveLength(1)

    const { data: stages } = await admin
      .from('payment_schedule_stages')
      .select('position, amount_type, amount_value, due_offset_days')
      .eq('schedule_id', schedules![0]!.id)
      .order('position')
    expect(stages).toEqual([
      { position: 1, amount_type: 'percent', amount_value: 25, due_offset_days: 7 },
      { position: 2, amount_type: 'remainder', amount_value: null, due_offset_days: 30 },
    ])
  })
})
```

- [ ] **Step 6: Extract the backfill into a callable function so the test can replay it**

The test calls `backfill_invoice_payment_stages()`. Add it to the same migration, above the two backfill statements, and have the migration call it instead of inlining the first backfill. Append to `20260730000000_create_payment_schedules.sql`, replacing the "Backfill 1" block:

```sql
-- Wrapped in a function, not inlined, so the integration suite can replay the
-- exact production backfill against a freshly seeded legacy invoice instead of
-- reimplementing the logic in test code (which would prove nothing).
create or replace function public.backfill_invoice_payment_stages()
returns integer language plpgsql security definer set search_path = public as $$
declare
  inserted integer;
begin
  with legacy as (
    select
      i.id,
      i.user_id,
      round((i.subtotal + i.subtotal * coalesce(i.tax_rate, 0) / 100) * 100)::int as total_cents,
      coalesce(i.deposit_percent, 50) as deposit_pct,
      i.deposit_due_date, i.deposit_paid_at, i.final_due_date, i.final_paid_at
    from public.invoices i
    where (i.deposit_percent is not null or i.deposit_paid_at is not null)
      and not exists (
        select 1 from public.invoice_payment_stages s where s.invoice_id = i.id
      )
  ),
  deposit_rows as (
    insert into public.invoice_payment_stages (
      user_id, invoice_id, position, label, amount_type, amount_value,
      amount_cents, due_date, paid_at
    )
    select l.user_id, l.id, 1, 'Deposit', 'percent', l.deposit_pct,
           round(l.total_cents * l.deposit_pct / 100)::int,
           l.deposit_due_date, l.deposit_paid_at
    from legacy l
    returning invoice_id, amount_cents
  ),
  final_rows as (
    insert into public.invoice_payment_stages (
      user_id, invoice_id, position, label, amount_type, amount_value,
      amount_cents, due_date, paid_at
    )
    select l.user_id, l.id, 2, 'Final balance', 'remainder', null,
           l.total_cents - d.amount_cents, l.final_due_date, l.final_paid_at
    from legacy l
    join deposit_rows d on d.invoice_id = l.id
    returning id
  )
  select count(*) into inserted from final_rows;
  return inserted;
end $$;

revoke all on function public.backfill_invoice_payment_stages() from public;
revoke all on function public.backfill_invoice_payment_stages() from anon, authenticated;

select public.backfill_invoice_payment_stages();
```

The `revoke` lines matter: this is a `security definer` function that writes rows for arbitrary users, so only the service role may call it. The integration test uses the admin client, which holds the service role.

- [ ] **Step 7: Reset, regenerate types, and run the integration tests**

```bash
supabase db reset
npx supabase gen types typescript --local > types/database.ts
npx vitest run --project integration tests/integration/payments/
```

Expected: PASS. If the RLS tests report permission-denied rather than empty results, apply the DML-grant repair SQL, then re-run.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260730000000_create_payment_schedules.sql types/database.ts tests/integration/payments/
git commit -m "feat(db): add payment schedule tables with RLS and legacy backfill"
```

---

### Task 3: Server actions for schedules and invoice stages

The data layer the builder calls. Written before the UI so the components have real signatures to consume.

**Files:**
- Create: `app/(dashboard)/payments/schedule-actions.ts`
- Test: `tests/integration/payments/schedule-actions.test.ts`

**Interfaces:**
- Consumes: `resolveStages`, `toTemplateStages`, `validateForSave` from Task 1; the three tables from Task 2.
- Produces:
  - `listSchedules(): Promise<PaymentSchedule[]>`
  - `createSchedule(input: { name: string; stages: TemplateStage[] }): Promise<{ id: string }>`
  - `updateSchedule(input: { id: string; name?: string; stages?: TemplateStage[] }): Promise<void>`
  - `deleteSchedule(id: string): Promise<void>`
  - `setDefaultSchedule(id: string): Promise<void>`
  - `replaceInvoiceStages(input: { invoiceId: string; stages: ResolvedStage[] }): Promise<void>`
  - `markStagePaid(stageId: string): Promise<void>`

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/payments/schedule-actions.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'

import { createSchedule, listSchedules, setDefaultSchedule, replaceInvoiceStages } from '@/app/(dashboard)/payments/schedule-actions'

import { createTestUser, actAs, adminClient } from '../helpers/supabase'

describe('schedule actions', () => {
  let user: { id: string }

  beforeAll(async () => {
    user = await createTestUser()
    await actAs(user)
  })

  it('creates a schedule with its stages', async () => {
    const { id } = await createSchedule({
      name: '25 / 50 / 25',
      stages: [
        { label: 'Deposit', amountType: 'percent', amountValue: 25, dueOffsetDays: 0 },
        { label: 'Progress', amountType: 'percent', amountValue: 50, dueOffsetDays: 90 },
        { label: 'Final', amountType: 'remainder', amountValue: null, dueOffsetDays: 180 },
      ],
    })
    const all = await listSchedules()
    const created = all.find((s) => s.id === id)
    expect(created?.name).toBe('25 / 50 / 25')
    expect(created?.stages).toHaveLength(3)
    expect(created?.stages[2]?.amountType).toBe('remainder')
  })

  it('rejects a one-stage schedule', async () => {
    await expect(
      createSchedule({
        name: 'Pointless',
        stages: [{ label: 'All of it', amountType: 'percent', amountValue: 100, dueOffsetDays: 0 }],
      }),
    ).rejects.toThrow(/single stage/i)
  })

  it('moves the default flag rather than adding a second one', async () => {
    const { id } = await createSchedule({
      name: '50 / 50',
      stages: [
        { label: 'Deposit', amountType: 'percent', amountValue: 50, dueOffsetDays: 0 },
        { label: 'Final', amountType: 'remainder', amountValue: null, dueOffsetDays: 60 },
      ],
    })
    await setDefaultSchedule(id)

    const admin = adminClient()
    const { data } = await admin
      .from('payment_schedules')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_default', true)
    expect(data).toHaveLength(1)
    expect(data![0]!.id).toBe(id)
  })

  it('replaces unpaid stages and never touches paid ones', async () => {
    const admin = adminClient()
    const { data: invoice } = await admin
      .from('invoices')
      .insert({ user_id: user.id, title: 'Replace test', subtotal: 1000, status: 'sent' })
      .select('id')
      .single()

    await replaceInvoiceStages({
      invoiceId: invoice!.id,
      stages: [
        { position: 1, label: 'Deposit', amountType: 'percent', amountValue: 50, amountCents: 50_000, dueDate: '2026-08-01' },
        { position: 2, label: 'Final', amountType: 'remainder', amountValue: null, amountCents: 50_000, dueDate: '2026-09-01' },
      ],
    })
    await admin
      .from('invoice_payment_stages')
      .update({ paid_at: '2026-08-02T00:00:00Z' })
      .eq('invoice_id', invoice!.id)
      .eq('position', 1)

    // A second replace drops the unpaid stage and keeps the paid one.
    await replaceInvoiceStages({
      invoiceId: invoice!.id,
      stages: [
        { position: 1, label: 'Deposit', amountType: 'percent', amountValue: 50, amountCents: 50_000, dueDate: '2026-08-01' },
        { position: 2, label: 'Renamed final', amountType: 'remainder', amountValue: null, amountCents: 50_000, dueDate: '2026-10-01' },
      ],
    })

    const { data } = await admin
      .from('invoice_payment_stages')
      .select('position, label, paid_at, due_date')
      .eq('invoice_id', invoice!.id)
      .order('position')
    expect(data).toHaveLength(2)
    expect(data![0]!.paid_at).not.toBeNull()
    expect(data![1]!.label).toBe('Renamed final')
  })
})
```

Replace `createTestUser` / `actAs` / `adminClient` with the repo's real integration helpers.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run --project integration tests/integration/payments/schedule-actions.test.ts`
Expected: FAIL, cannot resolve `schedule-actions`.

- [ ] **Step 3: Implement the actions**

Create `app/(dashboard)/payments/schedule-actions.ts`:

```ts
/**
 * Server actions for saved payment schedules and per-invoice stage rows.
 *
 * Every write goes through the authenticated server client, so RLS is the
 * authority on ownership; none of these actions filter by `user_id` in
 * application code beyond stamping it on insert.
 *
 * @module app/(dashboard)/payments/schedule-actions
 */
'use server'

import { z } from 'zod'

import { validateForSave } from '@/lib/payments/resolve-stages'
import { createClient } from '@/lib/supabase/server'
import type { PaymentSchedule, ResolvedStage, TemplateStage } from '@/types/payment-schedule'

const templateStageSchema = z.object({
  label: z.string().min(1).max(80),
  amountType: z.enum(['percent', 'fixed', 'remainder']),
  amountValue: z.number().nonnegative().nullable(),
  dueOffsetDays: z.number().int().min(0).max(3650),
})

const resolvedStageSchema = templateStageSchema
  .omit({ dueOffsetDays: true })
  .extend({
    position: z.number().int().min(1),
    amountCents: z.number().int().nonnegative(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  })

/** Throw the resolver's save-time validation as a readable error. */
function assertSavable(stages: TemplateStage[]): void {
  const errors = validateForSave(stages)
  if (errors.length === 0) return
  if (errors.some((e) => e.code === 'single_stage')) {
    throw new Error('A schedule needs at least two stages: a single stage is the same as no schedule.')
  }
  throw new Error(`Schedule is not valid: ${errors.map((e) => e.code).join(', ')}`)
}

/** Every saved schedule for the current MC, stages included, ordered by name. */
export async function listSchedules(): Promise<PaymentSchedule[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('payment_schedules')
    .select('id, name, is_default, payment_schedule_stages(position, label, amount_type, amount_value, due_offset_days)')
    .order('name')
  if (error) throw new Error(`Could not load schedules: ${error.message}`)

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    isDefault: row.is_default,
    stages: [...row.payment_schedule_stages]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({
        label: s.label,
        amountType: s.amount_type as TemplateStage['amountType'],
        amountValue: s.amount_value === null ? null : Number(s.amount_value),
        dueOffsetDays: s.due_offset_days,
      })),
  }))
}

/** Create a saved schedule from the stages currently on an invoice. */
export async function createSchedule(input: {
  name: string
  stages: TemplateStage[]
}): Promise<{ id: string }> {
  const parsed = z
    .object({ name: z.string().min(1).max(80), stages: z.array(templateStageSchema) })
    .parse(input)
  assertSavable(parsed.stages)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const { data: schedule, error } = await supabase
    .from('payment_schedules')
    .insert({ user_id: user.id, name: parsed.name, is_default: false })
    .select('id')
    .single()
  if (error || !schedule) throw new Error(`Could not create the schedule: ${error?.message ?? 'unknown'}`)

  await insertStages(supabase, user.id, schedule.id, parsed.stages)
  return { id: schedule.id }
}

/** Rename a schedule, replace its stages, or both. */
export async function updateSchedule(input: {
  id: string
  name?: string
  stages?: TemplateStage[]
}): Promise<void> {
  const parsed = z
    .object({
      id: z.string().uuid(),
      name: z.string().min(1).max(80).optional(),
      stages: z.array(templateStageSchema).optional(),
    })
    .parse(input)
  if (parsed.stages) assertSavable(parsed.stages)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  if (parsed.name !== undefined) {
    const { error } = await supabase
      .from('payment_schedules')
      .update({ name: parsed.name })
      .eq('id', parsed.id)
    if (error) throw new Error(`Could not rename the schedule: ${error.message}`)
  }

  if (parsed.stages) {
    // Template stages carry no payment state, so a wholesale replace is safe
    // here in a way it is not for invoice stages.
    await supabase.from('payment_schedule_stages').delete().eq('schedule_id', parsed.id)
    await insertStages(supabase, user.id, parsed.id, parsed.stages)
  }
}

/** Delete a saved schedule. Invoices already stamped from it are unaffected. */
export async function deleteSchedule(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('payment_schedules')
    .delete()
    .eq('id', z.string().uuid().parse(id))
  if (error) throw new Error(`Could not delete the schedule: ${error.message}`)
}

/**
 * Move the default flag onto one schedule.
 *
 * Clears every other flag first: the partial unique index would otherwise
 * reject the update, and clearing-then-setting is the only ordering that works
 * without a deferrable constraint.
 */
export async function setDefaultSchedule(id: string): Promise<void> {
  const scheduleId = z.string().uuid().parse(id)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  await supabase
    .from('payment_schedules')
    .update({ is_default: false })
    .eq('user_id', user.id)
    .eq('is_default', true)

  const { error } = await supabase
    .from('payment_schedules')
    .update({ is_default: true })
    .eq('id', scheduleId)
  if (error) throw new Error(`Could not set the default schedule: ${error.message}`)
}

/**
 * Persist the invoice's stage rows.
 *
 * Paid stages are never deleted or rewritten: money has moved against them, so
 * the incoming list only governs unpaid positions. Any unpaid row not present
 * in the incoming list is removed.
 */
export async function replaceInvoiceStages(input: {
  invoiceId: string
  stages: ResolvedStage[]
}): Promise<void> {
  const parsed = z
    .object({ invoiceId: z.string().uuid(), stages: z.array(resolvedStageSchema) })
    .parse(input)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const { data: existing } = await supabase
    .from('invoice_payment_stages')
    .select('id, position, paid_at')
    .eq('invoice_id', parsed.invoiceId)

  const paidPositions = new Set(
    (existing ?? []).filter((r) => r.paid_at !== null).map((r) => r.position),
  )

  const unpaidIds = (existing ?? []).filter((r) => r.paid_at === null).map((r) => r.id)
  if (unpaidIds.length > 0) {
    await supabase.from('invoice_payment_stages').delete().in('id', unpaidIds)
  }

  const rows = parsed.stages
    .filter((s) => !paidPositions.has(s.position))
    .map((s) => ({
      user_id: user.id,
      invoice_id: parsed.invoiceId,
      position: s.position,
      label: s.label,
      amount_type: s.amountType,
      amount_value: s.amountValue,
      amount_cents: s.amountCents,
      due_date: s.dueDate,
    }))

  if (rows.length === 0) return
  // Uniform keys on every row: supabase-js drops rows silently when the shape
  // varies across a bulk insert.
  const { error } = await supabase.from('invoice_payment_stages').insert(rows)
  if (error) throw new Error(`Could not save the payment schedule: ${error.message}`)
}

/** Record a manual (non-Stripe) payment against one stage. */
export async function markStagePaid(stageId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('invoice_payment_stages')
    .update({ paid_at: new Date().toISOString() })
    .eq('id', z.string().uuid().parse(stageId))
    .is('paid_at', null)
  if (error) throw new Error(`Could not mark the stage paid: ${error.message}`)
}

/** Shared insert for template stages, keeping key shape uniform. */
async function insertStages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  scheduleId: string,
  stages: TemplateStage[],
): Promise<void> {
  if (stages.length === 0) return
  const { error } = await supabase.from('payment_schedule_stages').insert(
    stages.map((s, i) => ({
      user_id: userId,
      schedule_id: scheduleId,
      position: i + 1,
      label: s.label,
      amount_type: s.amountType,
      amount_value: s.amountValue,
      due_offset_days: s.dueOffsetDays,
    })),
  )
  if (error) throw new Error(`Could not save the schedule stages: ${error.message}`)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run --project integration tests/integration/payments/schedule-actions.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck && npm run lint:gate
git add "app/(dashboard)/payments/schedule-actions.ts" tests/integration/payments/schedule-actions.test.ts
git commit -m "feat(payments): add server actions for saved schedules and invoice stages"
```

---

### Task 4: The schedule picker popover

**Files:**
- Create: `components/builders/parts/schedule-picker.tsx`
- Test: `tests/unit/components/builders/schedule-picker.test.tsx`

**Interfaces:**
- Consumes: `PaymentSchedule` from `@/types/payment-schedule`.
- Produces: `SchedulePicker` with props
  `{ schedules: PaymentSchedule[]; loading: boolean; error: string | null; onApply: (schedule: PaymentSchedule | null) => void; onRename: (id: string, name: string) => void; onDelete: (id: string) => void; onSetDefault: (id: string) => void }`.
  `onApply(null)` means "No schedule (single payment)".

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/builders/schedule-picker.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SchedulePicker } from '@/components/builders/parts/schedule-picker'
import type { PaymentSchedule } from '@/types/payment-schedule'

const schedules: PaymentSchedule[] = [
  {
    id: 'a',
    name: '30 / 70 split',
    isDefault: true,
    stages: [
      { label: 'Deposit', amountType: 'percent', amountValue: 30, dueOffsetDays: 0 },
      { label: 'Final', amountType: 'remainder', amountValue: null, dueOffsetDays: 60 },
    ],
  },
]

function setup(overrides: Partial<Parameters<typeof SchedulePicker>[0]> = {}) {
  const props = {
    schedules,
    loading: false,
    error: null,
    onApply: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onSetDefault: vi.fn(),
    ...overrides,
  }
  render(<SchedulePicker {...props} />)
  return props
}

describe('SchedulePicker', () => {
  it('applies a saved schedule when picked', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /apply a saved schedule/i }))
    await userEvent.click(screen.getByRole('button', { name: /30 \/ 70 split/i }))
    expect(props.onApply).toHaveBeenCalledWith(schedules[0])
  })

  it('applies null for the single-payment entry', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /apply a saved schedule/i }))
    await userEvent.click(screen.getByRole('button', { name: /no schedule/i }))
    expect(props.onApply).toHaveBeenCalledWith(null)
  })

  it('shows an empty state that points at the builder', async () => {
    setup({ schedules: [] })
    await userEvent.click(screen.getByRole('button', { name: /apply a saved schedule/i }))
    expect(screen.getByText(/no saved schedules yet/i)).toBeInTheDocument()
  })

  it('shows a loading state', async () => {
    setup({ loading: true, schedules: [] })
    await userEvent.click(screen.getByRole('button', { name: /apply a saved schedule/i }))
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows an error state', async () => {
    setup({ error: 'Network down', schedules: [] })
    await userEvent.click(screen.getByRole('button', { name: /apply a saved schedule/i }))
    expect(screen.getByText(/network down/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/components/builders/schedule-picker.test.tsx`
Expected: FAIL, cannot resolve `schedule-picker`.

- [ ] **Step 3: Read the pattern being copied**

Open `app/(dashboard)/templates/category-picker-base.tsx` in full. `SchedulePicker` mirrors its anatomy: `Popover.Root` with controlled `open`, a `Popover.Trigger` styled as a Select, `Popover.Portal` + `Popover.Content` with `align="start"` and `sideOffset={6}`, a scrollable option list, and a bottom bar that toggles into a manage mode. Reuse its class strings so the two controls look identical. Do **not** copy the colour-swatch parts.

- [ ] **Step 4: Implement the picker**

Create `components/builders/parts/schedule-picker.tsx`:

```tsx
/**
 * Saved payment schedule picker for the invoice builder.
 *
 * Mirrors `app/(dashboard)/templates/category-picker-base.tsx` (the Notion
 * pattern): the trigger reads like a Select, the popover lists schedules to
 * apply, and an Edit mode renames, deletes and sets the default without
 * leaving the builder. There is deliberately no create form here. Schedules
 * are created by building stages on an invoice and saving them, so the library
 * cannot fill up with schedules the MC never actually used.
 *
 * @module components/builders/parts/schedule-picker
 */
'use client'

import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, Pencil, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PaymentSchedule } from '@/types/payment-schedule'

export interface SchedulePickerProps {
  schedules: PaymentSchedule[]
  loading: boolean
  error: string | null
  /** `null` selects the "No schedule (single payment)" entry. */
  onApply: (schedule: PaymentSchedule | null) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onSetDefault: (id: string) => void
}

/** One-line summary of a schedule's shape, for the option row. */
function summarise(schedule: PaymentSchedule): string {
  return schedule.stages
    .map((s) =>
      s.amountType === 'percent'
        ? `${String(s.amountValue ?? 0)}%`
        : s.amountType === 'fixed'
          ? `$${String(s.amountValue ?? 0)}`
          : 'rest',
    )
    .join(' · ')
}

export function SchedulePicker({
  schedules,
  loading,
  error,
  onApply,
  onRename,
  onDelete,
  onSetDefault,
}: SchedulePickerProps) {
  const [open, setOpen] = useState(false)
  const [managing, setManaging] = useState(false)

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setManaging(false)
      }}
    >
      <Popover.Trigger className="flex h-8 cursor-pointer items-center gap-2 rounded-control border border-border bg-surface px-2.5 text-left text-caption text-text transition-colors hover:border-border-strong focus:border-brand-fg focus:outline-none data-[state=open]:border-brand-fg">
        <span>Apply a saved schedule</span>
        <ChevronDown size={14} strokeWidth={1.5} className="shrink-0 text-text-subtle" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-[90] w-72 rounded-xl border border-border bg-card p-1 shadow-lg animate-fade-in"
        >
          {loading ? (
            <p className="px-2 py-3 text-caption text-text-subtle">Loading schedules…</p>
          ) : error ? (
            <p className="px-2 py-3 text-caption text-danger">{error}</p>
          ) : managing ? (
            <ManageList
              schedules={schedules}
              onRename={onRename}
              onDelete={onDelete}
              onSetDefault={onSetDefault}
              onDone={() => setManaging(false)}
            />
          ) : (
            <>
              <div className="max-h-64 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => {
                    onApply(null)
                    setOpen(false)
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-surface-muted"
                >
                  <span className="min-w-0 flex-1 truncate text-caption text-text">
                    No schedule (single payment)
                  </span>
                </button>
                {schedules.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onApply(s)
                      setOpen(false)
                    }}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-surface-muted"
                  >
                    <span className="min-w-0 flex-1 truncate text-caption text-text">{s.name}</span>
                    <span className="shrink-0 text-caption text-text-subtle tabular-nums">
                      {summarise(s)}
                    </span>
                    {s.isDefault && <Check size={12} strokeWidth={1.5} className="shrink-0 text-text" />}
                  </button>
                ))}
              </div>
              {schedules.length === 0 ? (
                <p className="px-2 py-3 text-caption text-text-subtle">
                  No saved schedules yet. Build one below and save it.
                </p>
              ) : (
                <div className="mt-1 border-t border-border pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-full justify-start gap-1.5 px-2 text-caption"
                    onClick={() => setManaging(true)}
                  >
                    <Pencil size={12} strokeWidth={1.5} />
                    Edit schedules
                  </Button>
                </div>
              )}
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** Rename / delete / set-default list, shown in the popover's Edit mode. */
function ManageList({
  schedules,
  onRename,
  onDelete,
  onSetDefault,
  onDone,
}: {
  schedules: PaymentSchedule[]
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onSetDefault: (id: string) => void
  onDone: () => void
}) {
  return (
    <>
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {schedules.map((s) => (
          <ManageRow
            key={s.id}
            schedule={s}
            onRename={onRename}
            onDelete={onDelete}
            onSetDefault={onSetDefault}
          />
        ))}
      </div>
      <div className="mt-1 border-t border-border pt-1">
        <Button size="sm" variant="ghost" className="h-7 w-full text-caption" onClick={onDone}>
          Done
        </Button>
      </div>
    </>
  )
}

/** One row in Edit mode: inline rename field plus default and delete actions. */
function ManageRow({
  schedule,
  onRename,
  onDelete,
  onSetDefault,
}: {
  schedule: PaymentSchedule
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onSetDefault: (id: string) => void
}) {
  const [name, setName] = useState(schedule.name)

  return (
    <div className="flex items-center gap-1 px-1">
      <Input
        size="sm"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          const next = name.trim()
          if (next && next !== schedule.name) onRename(schedule.id, next)
        }}
        aria-label={`Rename ${schedule.name}`}
      />
      <Button
        size="sm"
        variant="ghost"
        className="h-7 shrink-0 px-1.5"
        aria-label={`Set ${schedule.name} as default`}
        onClick={() => onSetDefault(schedule.id)}
      >
        <Star
          size={13}
          strokeWidth={1.5}
          className={schedule.isDefault ? 'text-brand-fg' : 'text-text-subtle'}
        />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 shrink-0 px-1.5"
        aria-label={`Delete ${schedule.name}`}
        onClick={() => onDelete(schedule.id)}
      >
        <Trash2 size={13} strokeWidth={1.5} className="text-text-subtle hover:text-danger" />
      </Button>
    </div>
  )
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/components/builders/schedule-picker.test.tsx`
Expected: PASS, 5 tests. If `Input` or `Button` reject a prop used above, read `components/ui/input.tsx` and `components/ui/button.tsx` and match their real APIs rather than changing the test.

- [ ] **Step 6: Commit**

```bash
npm run typecheck && npm run lint:gate
git add components/builders/parts/schedule-picker.tsx tests/unit/components/builders/schedule-picker.test.tsx
git commit -m "feat(payments): add saved schedule picker popover"
```

---

### Task 5: The N-stage timeline and stage row

Generalises the existing two-row timeline. The visual language (dots, dashed connector, state pills) is already right and must be preserved.

**Task 5 and Task 6 are one deliverable and share one commit**, made at the end of Task 6. Nothing is committed at the end of Task 5, because the modal still passes the old props until Task 6 rewires it and the Global Constraints require a green typecheck on every commit. An implementer given Task 5 continues into Task 6 without stopping.

**Files:**
- Create: `components/builders/parts/payment-stage-row.tsx`
- Modify: `components/builders/parts/payment-schedule.tsx`
- Test: `tests/unit/components/builders/payment-stage-row.test.tsx`

**Interfaces:**
- Consumes: `InvoiceStage` from `@/types/payment-schedule`; `SchedulePicker` from Task 4.
- Produces:
  - `PaymentStageRow` with props `{ stage: InvoiceStage; canEdit: boolean; isNextUnpaid: boolean; markPending: boolean; onChange: (patch: Partial<InvoiceStage>) => void; onRemove: () => void; onMarkPaid: () => void }`
  - `PaymentSchedule` rewritten to props `{ canEdit: boolean; stages: InvoiceStage[]; schedules: PaymentSchedule[]; schedulesLoading: boolean; schedulesError: string | null; validationError: string | null; markPendingStageId: string | null; onStagesChange: (stages: InvoiceStage[]) => void; onApplySchedule: (schedule: PaymentScheduleType | null) => void; onSaveAsSchedule: (name: string) => void; onUpdateApplied: (() => void) | null; onMarkPaid: (stageId: string) => void; onRenameSchedule: ...; onDeleteSchedule: ...; onSetDefaultSchedule: ... }`

Name the imported schedule type `PaymentScheduleType` inside this file to avoid colliding with the exported `PaymentSchedule` component.

- [ ] **Step 1: Write the failing row test**

Create `tests/unit/components/builders/payment-stage-row.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PaymentStageRow } from '@/components/builders/parts/payment-stage-row'
import type { InvoiceStage } from '@/types/payment-schedule'

const unpaid: InvoiceStage = {
  id: 's1', position: 1, label: 'Deposit', amountType: 'percent',
  amountValue: 30, amountCents: 150_000, dueDate: '2026-08-01', paidAt: null,
}
const paid: InvoiceStage = { ...unpaid, id: 's0', paidAt: '2026-07-02T00:00:00Z' }

function setup(stage: InvoiceStage, overrides = {}) {
  const props = {
    stage, canEdit: true, isNextUnpaid: true, markPending: false,
    onChange: vi.fn(), onRemove: vi.fn(), onMarkPaid: vi.fn(), ...overrides,
  }
  render(<PaymentStageRow {...props} />)
  return props
}

describe('PaymentStageRow', () => {
  it('shows the resolved amount', () => {
    setup(unpaid)
    expect(screen.getByText(/\$1,500\.00/)).toBeInTheDocument()
  })

  it('commits a label edit on blur', async () => {
    const props = setup(unpaid)
    const field = screen.getByLabelText(/stage label/i)
    await userEvent.clear(field)
    await userEvent.type(field, 'Booking fee')
    await userEvent.tab()
    expect(props.onChange).toHaveBeenCalledWith({ label: 'Booking fee' })
  })

  it('commits an amount change on blur', async () => {
    const props = setup(unpaid)
    const field = screen.getByLabelText(/stage amount/i)
    await userEvent.clear(field)
    await userEvent.type(field, '40')
    await userEvent.tab()
    expect(props.onChange).toHaveBeenCalledWith({ amountValue: 40 })
  })

  it('hides the amount field for a remainder stage', () => {
    setup({ ...unpaid, amountType: 'remainder', amountValue: null })
    expect(screen.queryByLabelText(/stage amount/i)).not.toBeInTheDocument()
    expect(screen.getByText(/remaining balance/i)).toBeInTheDocument()
  })

  it('locks a paid stage: no editing, no remove', () => {
    setup(paid)
    expect(screen.queryByLabelText(/stage label/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument()
    expect(screen.getByText(/paid/i)).toBeInTheDocument()
  })

  it('only offers Mark paid on the next unpaid stage', () => {
    setup(unpaid, { isNextUnpaid: false })
    expect(screen.queryByRole('button', { name: /mark paid/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/components/builders/payment-stage-row.test.tsx`
Expected: FAIL, cannot resolve `payment-stage-row`.

- [ ] **Step 3: Implement the row**

Create `components/builders/parts/payment-stage-row.tsx`. Lift `FIELD_CLS`, `formatCurrency` and `formatDateShort` out of the current `payment-schedule.tsx` and reuse them verbatim so the two files stay visually identical:

```tsx
/**
 * One editable stage on the invoice builder's payment timeline.
 *
 * Unpaid stages edit inline (label, amount type, value, date). Paid stages
 * lock completely: money has moved against them, so the only honest UI is
 * read-only. `isNextUnpaid` gates the Mark-paid button because couples settle
 * stages in order, and letting the MC record stage 3 before stage 2 would put
 * the invoice into a state the public page cannot represent.
 *
 * @module components/builders/parts/payment-stage-row
 */
'use client'

import { GripVertical, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { DatePicker } from '@/components/ui/date-picker'
import { Select } from '@/components/ui/select'
import { StatePill } from '@/components/ui/state-pill'
import type { InvoiceStage, StageAmountType } from '@/types/payment-schedule'

const FIELD_CLS =
  'h-9 inline-flex items-center rounded-xl border border-border bg-surface px-3 text-sm text-text transition-colors'

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100)
}

function formatDateShort(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export interface PaymentStageRowProps {
  stage: InvoiceStage
  canEdit: boolean
  /** True for the earliest unpaid stage, which is the only payable one. */
  isNextUnpaid: boolean
  markPending: boolean
  onChange: (patch: Partial<InvoiceStage>) => void
  onRemove: () => void
  onMarkPaid: () => void
}

export function PaymentStageRow({
  stage,
  canEdit,
  isNextUnpaid,
  markPending,
  onChange,
  onRemove,
  onMarkPaid,
}: PaymentStageRowProps) {
  const paid = Boolean(stage.paidAt)
  const editable = canEdit && !paid

  // Local text state so the parent is not re-resolved on every keystroke;
  // both fields commit on blur.
  const [label, setLabel] = useState(stage.label)
  const [amount, setAmount] = useState(String(stage.amountValue ?? ''))
  useEffect(() => setLabel(stage.label), [stage.label])
  useEffect(() => setAmount(String(stage.amountValue ?? '')), [stage.amountValue])

  const unit = stage.amountType === 'percent' ? '%' : '$'

  return (
    <div className="relative">
      <span
        aria-hidden
        className={`absolute -left-7 top-1 inline-flex h-3 w-3 rounded-full ${
          paid ? 'bg-success' : 'border-2 border-warning bg-surface'
        }`}
      />
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-body font-medium text-text">{stage.label}</span>
        <span className="text-caption text-text-muted tabular-nums">
          {stage.amountType === 'remainder' ? 'remainder' : `${String(stage.amountValue ?? 0)}${unit}`}
          {' · '}
          {formatCurrency(stage.amountCents)}
        </span>
        <span className="text-caption text-text-muted">
          {paid ? `Paid ${formatDateShort(stage.paidAt) ?? ''}` : `Due ${formatDateShort(stage.dueDate) ?? '—'}`}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <StatePill
            label={paid ? 'Paid' : 'Due'}
            tone={paid ? 'success' : 'warning'}
            dot={paid ? 'filled' : 'hollow'}
          />
          {editable && (
            <>
              <span aria-hidden className="cursor-grab text-text-subtle">
                <GripVertical size={14} strokeWidth={1.5} />
              </span>
              <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove ${stage.label}`}
                className="cursor-pointer text-text-subtle transition-colors hover:text-danger"
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            </>
          )}
        </span>
      </div>

      {editable && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => {
              const next = label.trim()
              if (next && next !== stage.label) onChange({ label: next })
            }}
            aria-label="Stage label"
            className={`${FIELD_CLS} w-32 focus:outline-none`}
          />
          <Select
            value={stage.amountType}
            onChange={(v) => {
              const amountType = v as StageAmountType
              // A remainder carries no value; switching to it must clear one or
              // the SQL check constraint rejects the row.
              onChange(
                amountType === 'remainder'
                  ? { amountType, amountValue: null }
                  : { amountType, amountValue: stage.amountValue ?? 0 },
              )
            }}
            aria-label="Stage amount type"
            options={[
              { value: 'percent', label: '%' },
              { value: 'fixed', label: '$' },
              { value: 'remainder', label: 'Remaining balance' },
            ]}
          />
          {stage.amountType === 'remainder' ? (
            <span className="text-caption text-text-muted">Remaining balance</span>
          ) : (
            <div className={`${FIELD_CLS} gap-1`}>
              <input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onBlur={() => {
                  const next = Number(amount)
                  if (Number.isFinite(next) && next !== stage.amountValue) {
                    onChange({ amountValue: next })
                  }
                }}
                aria-label="Stage amount"
                className="w-14 bg-transparent text-sm text-text tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-sm text-text-muted">{unit}</span>
            </div>
          )}
          <DatePicker
            value={stage.dueDate ?? ''}
            onChange={(v) => onChange({ dueDate: v || null })}
            iconPosition="left"
          />
          {isNextUnpaid && (
            <button
              type="button"
              onClick={onMarkPaid}
              disabled={markPending}
              className="h-9 inline-flex cursor-pointer items-center rounded-xl bg-success px-3 text-sm font-medium text-text-inverse transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {markPending ? 'Saving…' : 'Mark paid'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the row tests**

Run: `npx vitest run tests/unit/components/builders/payment-stage-row.test.tsx`
Expected: PASS, 6 tests. Read `components/ui/select.tsx` first and match its real prop names; if it does not accept an `options` array, adapt the call site, not the test's `getByLabelText` queries.

- [ ] **Step 5: Rewrite the timeline shell**

Replace the body of `components/builders/parts/payment-schedule.tsx` entirely. Keep the module TSDoc but update it to describe N stages. The shell renders the header row with the picker, the dashed connector, a `PaymentStageRow` per stage, then the footer with "Add stage" and the save affordance:

```tsx
/**
 * Vertical N-stage payment timeline for the Invoice builder.
 *
 * ```
 * Payment schedule              [ Apply a saved schedule ▾ ]
 * ● Deposit    25% · $1,400   Paid 12 Jun            ✓
 * ┊
 * ○ Progress   50% · $2,800   Due 10 Sep  [Mark paid]
 * ┊
 * ○ Final      rem · $1,400   Due 09 Dec
 * + Add stage                Save this as a schedule ↗
 * ```
 *
 * The stage rows are the authoring surface for saved schedules: there is no
 * separate schedule editor anywhere in the app, so this component plus
 * {@link SchedulePicker} is the whole feature's UI.
 *
 * @module components/builders/parts/payment-schedule
 */
'use client'

import { Plus } from 'lucide-react'

import type { InvoiceStage, PaymentSchedule as PaymentScheduleType } from '@/types/payment-schedule'

import { PaymentStageRow } from './payment-stage-row'
import { SchedulePicker } from './schedule-picker'

export interface PaymentScheduleProps {
  canEdit: boolean
  stages: InvoiceStage[]
  schedules: PaymentScheduleType[]
  schedulesLoading: boolean
  schedulesError: string | null
  /** Resolver validation message, shown inline and blocking save. */
  validationError: string | null
  markPendingStageId: string | null
  onStagesChange: (stages: InvoiceStage[]) => void
  onApplySchedule: (schedule: PaymentScheduleType | null) => void
  /** Name comes from the inline footer form; see Step 7. */
  onSaveAsSchedule: (name: string) => void
  /** Present only when an applied schedule has been modified. */
  onUpdateApplied: (() => void) | null
  onMarkPaid: (stageId: string) => void
  onRenameSchedule: (id: string, name: string) => void
  onDeleteSchedule: (id: string) => void
  onSetDefaultSchedule: (id: string) => void
}

export function PaymentSchedule({
  canEdit,
  stages,
  schedules,
  schedulesLoading,
  schedulesError,
  validationError,
  markPendingStageId,
  onStagesChange,
  onApplySchedule,
  onSaveAsSchedule,
  onUpdateApplied,
  onMarkPaid,
  onRenameSchedule,
  onDeleteSchedule,
  onSetDefaultSchedule,
}: PaymentScheduleProps) {
  const nextUnpaidId = stages.find((s) => !s.paidAt)?.id ?? null

  const patchStage = (id: string, patch: Partial<InvoiceStage>) => {
    onStagesChange(stages.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  const addStage = () => {
    onStagesChange([
      ...stages,
      {
        // Client-only id until the row is persisted; replaceInvoiceStages keys
        // on position, not id, so a temporary value is safe here.
        id: `new-${String(stages.length + 1)}`,
        position: stages.length + 1,
        label: `Payment ${String(stages.length + 1)}`,
        amountType: stages.some((s) => s.amountType === 'remainder') ? 'percent' : 'remainder',
        amountValue: stages.some((s) => s.amountType === 'remainder') ? 0 : null,
        amountCents: 0,
        dueDate: null,
        paidAt: null,
      },
    ])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-caption font-medium uppercase tracking-wide text-text-muted">
          Payment schedule
        </h4>
        {canEdit && (
          <SchedulePicker
            schedules={schedules}
            loading={schedulesLoading}
            error={schedulesError}
            onApply={onApplySchedule}
            onRename={onRenameSchedule}
            onDelete={onDeleteSchedule}
            onSetDefault={onSetDefaultSchedule}
          />
        )}
      </div>

      {stages.length === 0 ? (
        <p className="text-caption text-text-subtle">
          No schedule. The couple pays this invoice in one payment.
        </p>
      ) : (
        <div className="relative space-y-6 pl-7">
          <div
            aria-hidden
            className="absolute left-2.5 top-3 bottom-3 w-px border-l border-dashed border-border"
          />
          {stages.map((stage) => (
            <PaymentStageRow
              key={stage.id}
              stage={stage}
              canEdit={canEdit}
              isNextUnpaid={stage.id === nextUnpaidId}
              markPending={markPendingStageId === stage.id}
              onChange={(patch) => patchStage(stage.id, patch)}
              onRemove={() => onStagesChange(stages.filter((s) => s.id !== stage.id))}
              onMarkPaid={() => onMarkPaid(stage.id)}
            />
          ))}
        </div>
      )}

      {validationError && <p className="text-caption text-danger">{validationError}</p>}

      {canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={addStage}
            className="inline-flex cursor-pointer items-center gap-1.5 text-caption text-text-muted transition-colors hover:text-text"
          >
            <Plus size={13} strokeWidth={1.5} />
            Add stage
          </button>
          {stages.length > 1 && (
            <span className="flex items-center gap-3">
              {onUpdateApplied && (
                <button
                  type="button"
                  onClick={onUpdateApplied}
                  className="cursor-pointer text-caption text-text-muted transition-colors hover:text-text"
                >
                  Update saved schedule
                </button>
              )}
              <button
                type="button"
                onClick={onSaveAsSchedule}
                className="cursor-pointer text-caption text-text-muted transition-colors hover:text-text"
              >
                Save this as a schedule
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Wire drag-reorder with dnd-kit**

The row renders a `GripVertical` handle, so it has to actually reorder. Follow the pattern already in `app/(dashboard)/templates/category-picker-base.tsx` (`DndContext` + `SortableContext` + `arrayMove`).

In `payment-stage-row.tsx`, make the row sortable:

```tsx
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// …inside PaymentStageRow, before the return:
const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
  id: stage.id,
  // A paid stage cannot move: its position is part of the payment record.
  disabled: !editable,
})
```

Apply `ref={setNodeRef}` and `style={{ transform: CSS.Transform.toString(transform), transition }}` to the row's outer `div`, add `opacity-50` while `isDragging`, and spread `{...attributes} {...listeners}` onto the handle span, changing it from `aria-hidden` to a real control:

```tsx
<span
  {...attributes}
  {...listeners}
  aria-label={`Reorder ${stage.label}`}
  className="cursor-grab text-text-subtle active:cursor-grabbing"
>
  <GripVertical size={14} strokeWidth={1.5} />
</span>
```

This is the one place the plan permits an inline `style={{}}`: dnd-kit computes a live transform per frame, so it cannot be a Tailwind class.

In `payment-schedule.tsx`, wrap the row list:

```tsx
<DndContext
  collisionDetection={closestCenter}
  onDragEnd={(event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = stages.map((s) => s.id)
    // onStagesChange renumbers position from array order, so moving the item
    // is the whole operation.
    onStagesChange(
      arrayMove(stages, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))),
    )
  }}
>
  <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
    {/* existing stages.map(...) */}
  </SortableContext>
</DndContext>
```

Add to the row test file:

```tsx
it('exposes a reorder handle on an editable stage', () => {
  setup(unpaid)
  expect(screen.getByLabelText(/reorder deposit/i)).toBeInTheDocument()
})

it('has no reorder handle on a paid stage', () => {
  setup(paid)
  expect(screen.queryByLabelText(/reorder/i)).not.toBeInTheDocument()
})
```

A remainder dragged out of last place trips the existing `remainder_not_last` validation, which already surfaces inline through `validationError`. No extra handling needed.

- [ ] **Step 7: Add the save-as-schedule name prompt**

`useInvoiceStages` exposes `saveAsSchedule(name: string)`, so the timeline has to collect a name. Use an inline footer form, mirroring the inline create form in `category-picker-base.tsx` rather than opening a dialog over the modal. Change the prop to `onSaveAsSchedule: (name: string) => void` and replace the plain "Save this as a schedule" button with:

```tsx
const [naming, setNaming] = useState(false)
const [newName, setNewName] = useState('')

// …in the footer, in place of the save button:
{naming ? (
  <span className="flex items-center gap-2">
    <Input
      size="sm"
      value={newName}
      onChange={(e) => setNewName(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commitName()
        }
        if (e.key === 'Escape') setNaming(false)
      }}
      placeholder="Schedule name"
      aria-label="Schedule name"
      autoFocus
    />
    <Button size="sm" variant="secondary" className="h-7 text-caption" onClick={commitName}>
      Save
    </Button>
  </span>
) : (
  <button
    type="button"
    onClick={() => setNaming(true)}
    className="cursor-pointer text-caption text-text-muted transition-colors hover:text-text"
  >
    Save this as a schedule
  </button>
)}
```

where `commitName` is:

```tsx
const commitName = () => {
  const name = newName.trim()
  if (!name) return
  onSaveAsSchedule(name)
  setNaming(false)
  setNewName('')
}
```

Add to the timeline's own test coverage (create `tests/unit/components/builders/payment-schedule.test.tsx` if it does not exist):

```tsx
it('collects a name before saving a schedule', async () => {
  const props = setup({ stages: [stageA, stageB] })
  await userEvent.click(screen.getByRole('button', { name: /save this as a schedule/i }))
  await userEvent.type(screen.getByLabelText(/schedule name/i), '30 / 70 split')
  await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
  expect(props.onSaveAsSchedule).toHaveBeenCalledWith('30 / 70 split')
})

it('does not save an empty name', async () => {
  const props = setup({ stages: [stageA, stageB] })
  await userEvent.click(screen.getByRole('button', { name: /save this as a schedule/i }))
  await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
  expect(props.onSaveAsSchedule).not.toHaveBeenCalled()
})
```

- [ ] **Step 8: Continue straight into Task 6, then commit once**

Do **not** commit here. The modal still passes the old deposit props, so the tree does not typecheck until Task 6's rewiring lands, and the Global Constraints require typecheck at 0 on every commit. Task 5 and Task 6 are one deliverable ("the builder edits N stages") and share a single commit, made at the end of Task 6.

Run `npx vitest run --project unit tests/unit/components/builders/` and confirm the new component tests pass before moving on. A typecheck failure confined to `invoice-builder-modal.tsx` is expected at this point.

---

### Task 6: The stage state hook and builder wiring

Restores a green typecheck and makes the builder work end to end.

**Files:**
- Create: `components/builders/parts/use-invoice-stages.ts`
- Modify: `components/builders/invoice-builder-modal.tsx`

**Interfaces:**
- Consumes: `resolveStages`, `toTemplateStages` (Task 1); every action from Task 3; `PaymentSchedule` component (Task 5).
- Produces: `useInvoiceStages({ invoiceId, totalCents, issueDate })` returning
  `{ stages, setStages, schedules, schedulesLoading, schedulesError, validationError, appliedScheduleId, isModified, applySchedule, saveAsSchedule, updateApplied, markPaid, markPendingStageId, persist }`.

- [ ] **Step 1: Write the hook**

Create `components/builders/parts/use-invoice-stages.ts`:

```ts
/**
 * Stage state for the invoice builder.
 *
 * Owns the stage array, the saved-schedule list, and every mutation the
 * timeline needs. Extracted from `invoice-builder-modal.tsx` because that file
 * is already 986 lines and this feature would otherwise add another hundred.
 *
 * Amounts re-resolve whenever the invoice total changes, except on paid stages,
 * which are frozen: money has moved against them.
 *
 * @module components/builders/parts/use-invoice-stages
 */
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  markStagePaid,
  replaceInvoiceStages,
  setDefaultSchedule,
  updateSchedule,
} from '@/app/(dashboard)/payments/schedule-actions'
import { resolveStages, toTemplateStages } from '@/lib/payments/resolve-stages'
import type { InvoiceStage, PaymentSchedule, TemplateStage } from '@/types/payment-schedule'

/** Human-readable text for a resolver validation failure. */
function messageFor(code: string): string {
  switch (code) {
    case 'multiple_remainders':
      return 'Only one stage can take the remaining balance.'
    case 'remainder_not_last':
      return 'The remaining-balance stage has to be last.'
    case 'sum_mismatch':
      return 'The stages do not add up to the invoice total.'
    case 'fixed_exceeds_total':
      return 'A fixed amount is larger than the invoice total.'
    case 'single_stage':
      return 'A schedule needs at least two stages.'
    default:
      return 'This schedule is not valid yet.'
  }
}

export function useInvoiceStages(input: {
  invoiceId: string | null
  totalCents: number
  issueDate: string
  initialStages: InvoiceStage[]
}) {
  const { invoiceId, totalCents, issueDate, initialStages } = input
  const queryClient = useQueryClient()

  const [stages, setStages] = useState<InvoiceStage[]>(initialStages)
  const [appliedScheduleId, setAppliedScheduleId] = useState<string | null>(null)
  const [isModified, setIsModified] = useState(false)

  const schedulesQuery = useQuery({ queryKey: ['payment-schedules'], queryFn: listSchedules })

  /** Template view of the current stages, for re-resolution and saving. */
  const template = useMemo<TemplateStage[]>(
    () => toTemplateStages(stages, issueDate),
    [stages, issueDate],
  )

  const resolved = useMemo(
    () => resolveStages(template, totalCents, issueDate),
    [template, totalCents, issueDate],
  )

  const validationError = resolved.ok ? null : messageFor(resolved.errors[0]?.code ?? '')

  // Re-resolve amounts when the invoice total moves. Paid stages keep their
  // frozen amount and date; only unpaid ones follow the new total.
  useEffect(() => {
    if (!resolved.ok) return
    setStages((current) =>
      current.map((s, i) => {
        if (s.paidAt) return s
        const next = resolved.stages[i]
        return next ? { ...s, amountCents: next.amountCents } : s
      }),
    )
    // resolved is derived from stages, so depending on it directly would loop.
    // Keying on the total is what we actually mean by "the total changed".
  }, [totalCents]) // eslint-disable-line react-hooks/exhaustive-deps

  const applySchedule = useCallback(
    (schedule: PaymentSchedule | null) => {
      setAppliedScheduleId(schedule?.id ?? null)
      setIsModified(false)
      if (!schedule) {
        setStages((current) => current.filter((s) => s.paidAt))
        return
      }
      const next = resolveStages(schedule.stages, totalCents, issueDate)
      if (!next.ok) return
      setStages(
        next.stages.map((s) => ({
          ...s,
          id: `applied-${String(s.position)}`,
          paidAt: null,
        })),
      )
    },
    [totalCents, issueDate],
  )

  const changeStages = useCallback((next: InvoiceStage[]) => {
    setStages(next.map((s, i) => ({ ...s, position: i + 1 })))
    setIsModified(true)
  }, [])

  const saveAsMutation = useMutation({
    mutationFn: async (name: string) => createSchedule({ name, stages: template }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['payment-schedules'] }),
  })

  const updateAppliedMutation = useMutation({
    mutationFn: async (id: string) => updateSchedule({ id, stages: template }),
    onSuccess: () => {
      setIsModified(false)
      void queryClient.invalidateQueries({ queryKey: ['payment-schedules'] })
    },
  })

  const markPaidMutation = useMutation({
    mutationFn: async (stageId: string) => markStagePaid(stageId),
    onSuccess: (_data, stageId) => {
      setStages((current) =>
        current.map((s) => (s.id === stageId ? { ...s, paidAt: new Date().toISOString() } : s)),
      )
    },
  })

  const renameMutation = useMutation({
    mutationFn: async (v: { id: string; name: string }) => updateSchedule(v),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['payment-schedules'] }),
  })
  const deleteMutation = useMutation({
    mutationFn: deleteSchedule,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['payment-schedules'] }),
  })
  const defaultMutation = useMutation({
    mutationFn: setDefaultSchedule,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['payment-schedules'] }),
  })

  /** Persist the current stages. Called by the modal's Save handler. */
  const persist = useCallback(async () => {
    if (!invoiceId) return
    if (!resolved.ok) throw new Error(validationError ?? 'Schedule is not valid')
    await replaceInvoiceStages({ invoiceId, stages: resolved.stages })
  }, [invoiceId, resolved, validationError])

  return {
    stages,
    setStages: changeStages,
    schedules: schedulesQuery.data ?? [],
    schedulesLoading: schedulesQuery.isLoading,
    schedulesError: schedulesQuery.error ? 'Could not load your saved schedules.' : null,
    validationError,
    appliedScheduleId,
    isModified,
    applySchedule,
    saveAsSchedule: (name: string) => saveAsMutation.mutate(name),
    updateApplied: appliedScheduleId && isModified
      ? () => updateAppliedMutation.mutate(appliedScheduleId)
      : null,
    markPaid: (stageId: string) => markPaidMutation.mutate(stageId),
    markPendingStageId: markPaidMutation.isPending ? (markPaidMutation.variables ?? null) : null,
    renameSchedule: (id: string, name: string) => renameMutation.mutate({ id, name }),
    deleteSchedule: (id: string) => deleteMutation.mutate(id),
    setDefaultSchedule: (id: string) => defaultMutation.mutate(id),
    persist,
  }
}
```

- [ ] **Step 2: Rewire the invoice builder modal**

In `components/builders/invoice-builder-modal.tsx`:

1. Delete the four state declarations at lines 154-155 and their `depositDueDate` / `finalDueDate` siblings, plus `hasDepositSchedule` at line 229 and `depositAmount` at line 315.
2. Add `const invoiceStages = useInvoiceStages({ invoiceId: invoice?.id ?? null, totalCents: Math.round(total * 100), issueDate: (invoice?.created_at ?? new Date().toISOString()).slice(0, 10), initialStages: mapStageRows(invoice?.invoice_payment_stages ?? []) })`, where `mapStageRows` converts snake_case rows to `InvoiceStage`.
3. Replace `hasDepositSchedule` with `invoiceStages.stages.length > 0` at both line 229 and line 641.
4. Delete the `deposit_percent` / `deposit_due_date` / `final_due_date` fields from the save payload at lines 430-432.
5. Delete the auto-save-before-mark-paid workaround at lines 280-292 and the comment at line 487 that explains it. Stages persist independently of the Save button now, so the case it guarded cannot arise.
6. Replace the `final_paid_at` write in the mark-fully-paid mutation at line 525 with a plain `{ status: 'paid', paid_at: now }`.
7. Replace the whole `depositEnabled ? <PaymentSchedule .../> : <button>Add payment schedule</button>` block at lines 858-900 with a single always-rendered `<PaymentSchedule />` passing the hook's values. The "+ Add payment schedule" affordance is gone: the timeline now shows its own empty state and the Add stage button.
8. In the modal's Save handler, `await invoiceStages.persist()` after the invoice row update.
9. Replace `paymentSchedule: depositEnabled ? {...}` in the preview payload at line 704 with the stages array shape Task 10 defines.

- [ ] **Step 3: Verify the build is green again**

```bash
npm run typecheck
npx vitest run --project unit
```
Expected: PASS. Both should be clean for the first time since Task 5.

- [ ] **Step 4: Verify in the running app**

Start the dev server, open a couple, go to the Payments tab, open an invoice. Confirm: the picker lists the seeded "Default" schedule, applying it stamps two rows, Add stage appends a third, changing a line item re-resolves the unpaid amounts, and Save persists. Remember `npm run dev` points at the **remote** Supabase, which does not have these migrations until CI deploys them, so use the isolated local-Supabase dev server recipe for this check.

- [ ] **Step 5: Commit**

```bash
npm run typecheck && npm run lint:gate
# One commit for Tasks 5 and 6 together: the components and the rewiring are a
# single deliverable, and the tree does not typecheck between them.
git add components/builders/parts/payment-stage-row.tsx \
        components/builders/parts/payment-schedule.tsx \
        components/builders/parts/use-invoice-stages.ts \
        components/builders/invoice-builder-modal.tsx \
        tests/unit/components/builders/
git commit -m "feat(payments): edit N-stage payment schedules in the invoice builder"
```

---

### Task 7: Stripe checkout route

**Files:**
- Modify: `app/api/stripe/invoice-payment/route.ts`
- Test: `tests/unit/app/api/stripe/invoice-payment.test.ts`

**Interfaces:**
- Consumes: `invoice_payment_stages` from Task 2.
- Produces: request body `{ invoiceId: string; shareToken: string; paymentType: 'stage' | 'remaining'; stageId?: string }`; Checkout session metadata gains `stage_ids` (comma-separated).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/app/api/stripe/invoice-payment.test.ts`. Mock `@/lib/supabase/admin` and `@/lib/payments/stripe`, following whatever mocking style the existing API-route unit tests in `tests/unit/app/api/` use:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock modules before importing the route.
const createSession = vi.fn().mockResolvedValue({ url: 'https://checkout.test/s' })
vi.mock('@/lib/payments/stripe', () => ({ stripe: { checkout: { sessions: { create: createSession } } } }))

const stages = [
  { id: 'st1', position: 1, label: 'Deposit', amount_cents: 150_000, paid_at: null },
  { id: 'st2', position: 2, label: 'Final', amount_cents: 350_000, paid_at: null },
]

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: invoiceRow, error: null }) }),
          order: async () => ({ data: stages, error: null }),
        }),
      }),
    }),
    auth: { admin: { getUserById: async () => ({ data: { user: mcUser }, error: null }) } },
  }),
}))

let invoiceRow: Record<string, unknown>
let mcUser: Record<string, unknown>

beforeEach(() => {
  createSession.mockClear()
  invoiceRow = {
    id: 'inv1', title: 'Wedding', subtotal: 5000, tax_rate: 0, status: 'sent',
    stripe_payment_enabled: true, share_token: 'tok-12345678', user_id: 'mc1', couple_id: 'c1',
  }
  mcUser = { id: 'mc1', app_metadata: { stripe_connect_account_id: 'acct_1', stripe_connect_enabled: true } }
})

async function post(body: Record<string, unknown>) {
  const { POST } = await import('@/app/api/stripe/invoice-payment/route')
  return POST(new Request('http://localhost/api/stripe/invoice-payment', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as never)
}

describe('POST /api/stripe/invoice-payment', () => {
  it('charges one stage and records its id in metadata', async () => {
    const res = await post({ invoiceId: 'inv1', shareToken: 'tok-12345678', paymentType: 'stage', stageId: 'st1' })
    expect(res.status).toBe(200)
    const args = createSession.mock.calls[0]![0]
    expect(args.line_items[0].price_data.unit_amount).toBe(150_000)
    expect(args.metadata.stage_ids).toBe('st1')
  })

  it('rejects paying a later stage before the earliest unpaid one', async () => {
    const res = await post({ invoiceId: 'inv1', shareToken: 'tok-12345678', paymentType: 'stage', stageId: 'st2' })
    expect(res.status).toBe(400)
    expect(createSession).not.toHaveBeenCalled()
  })

  it('charges every unpaid stage for a remaining payment', async () => {
    const res = await post({ invoiceId: 'inv1', shareToken: 'tok-12345678', paymentType: 'remaining' })
    expect(res.status).toBe(200)
    const args = createSession.mock.calls[0]![0]
    expect(args.line_items[0].price_data.unit_amount).toBe(500_000)
    expect(args.metadata.stage_ids).toBe('st1,st2')
  })

  it('rejects a stage payment with no stageId', async () => {
    const res = await post({ invoiceId: 'inv1', shareToken: 'tok-12345678', paymentType: 'stage' })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/app/api/stripe/invoice-payment.test.ts`
Expected: FAIL. The current route rejects `paymentType: 'stage'` at the Zod schema.

- [ ] **Step 3: Change the route**

In `app/api/stripe/invoice-payment/route.ts`:

Replace the body schema:

```ts
const bodySchema = z
  .object({
    invoiceId: z.string().uuid('Invoice ID must be a UUID'),
    shareToken: z.string().min(8, 'Share token is too short').max(200),
    paymentType: z.enum(['stage', 'remaining']).default('remaining'),
    stageId: z.string().uuid().optional(),
  })
  // A stage payment without a stage is meaningless, and defaulting it to the
  // first unpaid stage would silently charge a different amount than the
  // button the couple pressed.
  .refine((v) => v.paymentType !== 'stage' || v.stageId !== undefined, {
    message: 'stageId is required for a stage payment',
    path: ['stageId'],
  })
```

Drop `deposit_percent, deposit_paid_at` from the invoice select at line 84. Delete the `paymentType === 'final'` guard at lines 106-111. Replace the amount block at lines 132-146:

```ts
const { data: stageRows, error: stagesError } = await admin
  .from('invoice_payment_stages')
  .select('id, position, label, amount_cents, paid_at')
  .eq('invoice_id', invoiceId)
  .order('position')

if (stagesError) {
  logger.error('[stripe/invoice-payment] stage load failed', undefined, { invoiceId })
  return NextResponse.json({ error: 'Payment setup failed' }, { status: 502 })
}

const unpaid = (stageRows ?? []).filter((s) => s.paid_at === null)

let amountCents: number
let productName: string
let stageIds: string[]

if (unpaid.length === 0) {
  // No schedule at all: a single-payment invoice for the whole total.
  const total = invoice.subtotal + invoice.subtotal * ((invoice.tax_rate ?? 0) / 100)
  amountCents = Math.round(total * 100)
  productName = invoice.title || 'Invoice'
  stageIds = []
} else if (paymentType === 'stage') {
  // Only the earliest unpaid stage is payable. This generalises the old
  // "final is blocked until the deposit is paid" rule to N stages, and the
  // assertion lives server-side so a tampered request cannot skip ahead.
  const earliest = unpaid[0]!
  if (earliest.id !== stageId) {
    return NextResponse.json(
      { error: 'Earlier payments must be settled first' },
      { status: 400 },
    )
  }
  amountCents = earliest.amount_cents
  productName = `${earliest.label} - ${invoice.title || 'Invoice'}`
  stageIds = [earliest.id]
} else {
  amountCents = unpaid.reduce((acc, s) => acc + s.amount_cents, 0)
  productName = `Remaining balance - ${invoice.title || 'Invoice'}`
  stageIds = unpaid.map((s) => s.id)
}
```

Then add `stage_ids: stageIds.join(',')` to the session `metadata` object alongside the existing keys.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/app/api/stripe/invoice-payment.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
npm run typecheck && npm run lint:gate
git add app/api/stripe/invoice-payment/route.ts tests/unit/app/api/stripe/invoice-payment.test.ts
git commit -m "feat(payments): charge individual stages via Stripe checkout"
```

---

### Task 8: Webhook stage settlement

**Files:**
- Modify: `app/api/stripe/webhook/route.ts`
- Test: `tests/unit/lib/payments/webhook-events.test.ts` (extend)

**Interfaces:**
- Consumes: `stage_ids` metadata from Task 7.
- Produces: `processInvoicePayment()` stamps each listed stage and derives invoice status from how many stages remain unpaid.

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/lib/payments/webhook-events.test.ts` (match the file's existing mocking and helper style):

```ts
describe('processInvoicePayment stage settlement', () => {
  it('sets status deposit_paid when some stages remain', async () => {
    const { status } = await runWebhook({
      stageIds: 'st1',
      stagesAfter: [
        { id: 'st1', paid_at: '2026-07-02T00:00:00Z' },
        { id: 'st2', paid_at: null },
      ],
    })
    expect(status).toBe('deposit_paid')
  })

  it('sets status paid when every stage is settled', async () => {
    const { status, eventPriceMirrored } = await runWebhook({
      stageIds: 'st1,st2',
      stagesAfter: [
        { id: 'st1', paid_at: '2026-07-02T00:00:00Z' },
        { id: 'st2', paid_at: '2026-07-02T00:00:00Z' },
      ],
    })
    expect(status).toBe('paid')
    expect(eventPriceMirrored).toBe(true)
  })

  it('marks a stageless invoice paid', async () => {
    const { status } = await runWebhook({ stageIds: '', stagesAfter: [] })
    expect(status).toBe('paid')
  })

  it('alerts when a stage id in metadata does not exist', async () => {
    const { alerts } = await runWebhook({
      stageIds: 'st1,ghost',
      stagesAfter: [{ id: 'st1', paid_at: '2026-07-02T00:00:00Z' }],
      knownStageIds: ['st1'],
    })
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatch(/stage/i)
  })
})
```

Write the `runWebhook` helper in the same file: it builds a `checkout.session.completed` event with `metadata.stage_ids`, stubs the admin client's stage update and re-read, captures `sendAlert` calls, and returns the resulting status.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/lib/payments/webhook-events.test.ts`
Expected: FAIL, the new cases.

- [ ] **Step 3: Rewrite `processInvoicePayment`**

Replace the body of `processInvoicePayment` in `app/api/stripe/webhook/route.ts` (lines 300-343):

```ts
async function processInvoicePayment(
  session: Extract<ParsedStripeEvent, { type: 'checkout.session.completed' }>['data'],
  invoiceId: string,
  adminClient: AdminClient,
): Promise<void> {
  const now = new Date().toISOString()
  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : null

  const stageIds = (session.metadata?.stage_ids ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (stageIds.length > 0) {
    const { data: stamped, error: stampError } = await adminClient
      .from('invoice_payment_stages')
      .update({ paid_at: now, stripe_payment_intent_id: paymentIntentId })
      .in('id', stageIds)
      .is('paid_at', null)
      .select('id')
    if (stampError) {
      logger.error('[stripe/webhook] stage stamp failed', { error: stampError, invoiceId })
    }

    // Money has already moved by the time this webhook runs, so a mismatch
    // between the session's stage ids and the rows we could stamp needs a
    // human rather than a silent partial write.
    const stampedIds = new Set((stamped ?? []).map((r) => r.id))
    const missing = stageIds.filter((id) => !stampedIds.has(id))
    if (missing.length > 0) {
      await sendAlert({
        title: 'Invoice payment stage mismatch',
        message:
          `Checkout session for invoice ${invoiceId} listed stage ids that could not be stamped: ` +
          `${missing.join(', ')}. The payment succeeded, so these stages need reconciling by hand.`,
        severity: 'error',
      })
    }
  }

  // Derive the invoice status from how many stages remain, rather than
  // hardcoding it per payment type. A stageless invoice has nothing left to
  // pay, so it is fully paid.
  const { data: remaining } = await adminClient
    .from('invoice_payment_stages')
    .select('id')
    .eq('invoice_id', invoiceId)
    .is('paid_at', null)

  const fullyPaid = (remaining ?? []).length === 0

  await adminClient
    .from('invoices')
    .update(
      fullyPaid
        ? { status: 'paid' as const, paid_at: now, stripe_payment_intent_id: paymentIntentId }
        : { status: 'deposit_paid' as const },
    )
    .eq('id', invoiceId)

  if (!fullyPaid) return

  const { data: invoice } = await adminClient
    .from('invoices')
    .select('couple_id, subtotal, tax_rate')
    .eq('id', invoiceId)
    .single()

  if (invoice) {
    const total = invoice.subtotal + invoice.subtotal * ((invoice.tax_rate || 0) / 100)
    await adminClient.from('events').update({ price: total }).eq('couple_id', invoice.couple_id)
  }
}
```

Add the `sendAlert` import from `@/lib/alerts`. Check that module's real export name and signature first and match it; the shape above assumes `{ title, message, severity }`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/lib/payments/webhook-events.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run typecheck && npm run lint:gate
git add app/api/stripe/webhook/route.ts tests/unit/lib/payments/webhook-events.test.ts
git commit -m "feat(payments): settle stages and derive invoice status in the webhook"
```

---

### Task 9: Public invoice page

**Files:**
- Modify: `app/invoice/[token]/_components/public-invoice.ts`
- Modify: `app/invoice/[token]/_components/invoice-payment-schedule.tsx`
- Modify: `app/invoice/[token]/page.tsx`
- Modify: `app/invoice/[token]/pay-with-card-button.tsx`

**Interfaces:**
- Consumes: `stages` from `get_public_invoice` (added in Task 16; until then the field is absent at runtime, so code defensively with `?? []`).
- Produces: `PublicInvoiceStage { id: string; position: number; label: string; amount_cents: number; due_date: string | null; paid_at: string | null }` exported from `public-invoice.ts`; `PublicInvoice.stages: PublicInvoiceStage[]`.

- [ ] **Step 1: Update the type**

In `app/invoice/[token]/_components/public-invoice.ts`, delete `deposit_percent`, `deposit_due_date`, `deposit_paid_at`, `final_due_date`, `final_paid_at` and add:

```ts
/** One payment stage on a public invoice, as returned by `get_public_invoice`. */
export interface PublicInvoiceStage {
  id: string
  position: number
  label: string
  amount_cents: number
  due_date: string | null
  paid_at: string | null
}
```

plus `stages: PublicInvoiceStage[]` on `PublicInvoice`.

- [ ] **Step 2: Rewrite the schedule component**

Replace the two hardcoded blocks in `invoice-payment-schedule.tsx` with a map. Keep every inline `style={{}}` exactly as it is: this is a branded public surface where app tokens do not apply. New props:

```tsx
export interface InvoicePaymentScheduleProps {
  invoice: PublicInvoice
  /** Id of the earliest unpaid stage, the only one with a live Pay button. */
  nextPayableStageId: string | null
  showPayButtons: boolean
  branding: PublicBranding
  actionStyle: { color: string; radius: number } | null
}
```

The row body keeps the existing markup, driven by `stage.label`, `formatCurrency(stage.amount_cents / 100)`, `stage.due_date` and `stage.paid_at`. Each row renders one of three things beneath it:

```tsx
{showPayButtons && actionStyle && stage.id === nextPayableStageId ? (
  <div className="mt-2">
    <PayWithCardButton
      invoiceId={invoice.id}
      shareToken={invoice.share_token}
      branding={branding}
      actionStyle={actionStyle}
      paymentType="stage"
      stageId={stage.id}
      label={`Pay ${stage.label.toLowerCase()}`}
    />
  </div>
) : !stage.paid_at && stage.id !== nextPayableStageId ? (
  <span
    className="mt-2 block"
    style={{
      fontSize: `${finePrintDefaults.fontSize}px`,
      color: finePrintDefaults.color,
      fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
      fontWeight: finePrintDefaults.fontWeight,
      lineHeight: finePrintDefaults.lineHeight,
    }}
  >
    Available once the previous payment clears
  </span>
) : null}
```

Apply the existing `borderColorHalf` bottom border to every row except the last.

Below the list, add the pay-in-full action when more than one stage is unpaid:

```tsx
{showPayButtons && actionStyle && unpaidCount > 1 ? (
  <div className="pt-2">
    <PayWithCardButton
      invoiceId={invoice.id}
      shareToken={invoice.share_token}
      branding={branding}
      actionStyle={actionStyle}
      paymentType="remaining"
      label="Pay remaining balance"
    />
  </div>
) : null}
```

- [ ] **Step 3: Update the pay button**

In `pay-with-card-button.tsx`, change the `paymentType` prop type to `'stage' | 'remaining'`, add an optional `stageId?: string`, and include `stageId` in the POST body it sends.

- [ ] **Step 4: Update the page**

In `app/invoice/[token]/page.tsx`, replace lines 98-100:

```ts
const stages = invoice?.stages ?? []
const hasSchedule = stages.length > 0
const nextPayableStageId = stages.find((s) => !s.paid_at)?.id ?? null
```

Pass `nextPayableStageId` and `showPayButtons` (the existing Connect and status conditions) into `InvoicePaymentSchedule`, and delete the `depositAmount` / `finalAmount` computations and the `showDepositButton` / `showFinalButton` props.

- [ ] **Step 5: Verify**

```bash
npm run typecheck && npx vitest run --project unit
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "app/invoice/[token]"
git commit -m "feat(payments): render N payment stages on the public invoice page"
```

---

### Task 10: Branding payment-schedule block

**Files:**
- Modify: `lib/branding/public-blocks/shared.ts`
- Modify: `lib/branding/public-blocks/payment-schedule.tsx`
- Modify: `app/(dashboard)/branding/blocks/types.ts`
- Modify: `app/(dashboard)/branding/blocks/block-toolbar.tsx`
- Modify: `app/branding/preview/[surface]/page.tsx`

**Interfaces:**
- Consumes: `PublicInvoiceStage` shape from Task 9.
- Produces: `PublicDocProps.paymentSchedule?: { stages: Array<{ label: string; amountCents: number; dueDate: string | null; paidAt: string | null }> } | null`.

- [ ] **Step 1: Change the shared prop shape**

In `lib/branding/public-blocks/shared.ts`, replace the `paymentSchedule` block (lines 66-76) with:

```ts
  /**
   * Invoice payment stages. When present, the `paymentSchedule` block renders
   * one row per stage. Null or undefined means no schedule, so the block
   * renders nothing. Previously a fixed deposit + final pair.
   */
  paymentSchedule?: {
    stages: Array<{
      label: string
      amountCents: number
      dueDate: string | null
      paidAt: string | null
    }>
  } | null
```

- [ ] **Step 2: Map over stages in the block renderer**

In `lib/branding/public-blocks/payment-schedule.tsx`, replace the hardcoded two-element array at line 46 with `schedule.stages.map((s) => ({ label: s.label, amount: s.amountCents / 100, due: s.dueDate, paid: s.paidAt }))` and render the existing row markup per element. Delete `block.depositLabel` and any `finalLabel` usage: labels now come from the data, because the MC named each stage in the builder.

- [ ] **Step 3: Make the toolbar row controls row-generic**

At `app/(dashboard)/branding/blocks/block-toolbar.tsx:1748`, the controls target the deposit and final rows individually. Collapse them into one set that applies to all rows. Remove the now-dead `depositLabel` / `finalLabel` props from the block's type in `app/(dashboard)/branding/blocks/types.ts` and from any default-props factory, and update the block description at `types.ts:494` from "Deposit & final balance (live invoice data)" to "Payment stages (live invoice data)".

- [ ] **Step 4: Grow both preview samples to three stages**

`app/branding/preview/[surface]/page.tsx` has `deposit_percent: 50` at **two** sites, lines 56 and 71. Replace both with a three-stage sample so MCs styling the block see a realistic multi-stage layout:

```ts
paymentSchedule: {
  stages: [
    { label: 'Deposit', amountCents: 125_000, dueDate: '2026-08-01', paidAt: '2026-08-02T00:00:00Z' },
    { label: 'Progress payment', amountCents: 250_000, dueDate: '2026-10-30', paidAt: null },
    { label: 'Final balance', amountCents: 125_000, dueDate: '2027-01-28', paidAt: null },
  ],
},
```

- [ ] **Step 5: Verify and commit**

```bash
npm run typecheck && npm run lint:gate && npx vitest run --project unit
git add lib/branding/public-blocks "app/(dashboard)/branding/blocks" "app/branding/preview"
git commit -m "feat(branding): render N payment stages in the paymentSchedule block"
```

---

### Task 11: Contract and document variables

**Files:**
- Modify: `lib/contracts/contract-variables.ts`
- Modify: `lib/branding/document-variables.ts`
- Modify: `app/api/email/send-contract/route.ts`
- Modify: `components/builders/contract-builder-modal.tsx`
- Test: `tests/unit/lib/contracts/contract-variables.test.ts`

**Interfaces:**
- Consumes: `payment_schedules` + `payment_schedule_stages` from Task 2.
- Produces: `buildContractVariables` takes `firstStage: { amountCents: number; dueDate: string | null } | null` in place of `proposal.depositPercent` and `depositPercent`.

- [ ] **Step 1: Write the failing test**

Create or extend `tests/unit/lib/contracts/contract-variables.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { buildContractVariables } from '@/lib/contracts/contract-variables'

const base = {
  couple: { name: 'Sam and Alex', email: 'sam@example.com' },
  firstEvent: { date: '2027-03-14', venue: 'The Barn' },
  userMeta: { business_name: 'Zebri MC' },
}

describe('buildContractVariables deposit_amount', () => {
  it('uses the first stage amount', () => {
    const vars = buildContractVariables({
      ...base,
      proposal: { total: 5000 },
      firstStage: { amountCents: 125_000, dueDate: '2026-08-01' },
    })
    expect(vars.deposit_amount).toBe('$1,250.00')
  })

  it('falls back to a dash when there is no schedule at all', () => {
    const vars = buildContractVariables({ ...base, proposal: { total: 5000 }, firstStage: null })
    expect(vars.deposit_amount).toBe('-')
  })

  it('falls back to a dash when there is no money source', () => {
    const vars = buildContractVariables({ ...base, proposal: null, firstStage: null })
    expect(vars.deposit_amount).toBe('-')
    expect(vars.total_amount).toBe('-')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/lib/contracts/contract-variables.test.ts`
Expected: FAIL, `firstStage` is not a recognised input.

- [ ] **Step 3: Change the builder**

In `lib/contracts/contract-variables.ts`, replace the input type and the deposit computation:

```ts
export function buildContractVariables(input: {
  couple: { name: string; email: string | null }
  firstEvent: { date: string | null; venue: string | null } | null
  /** Linked ACCEPTED proposal. `total` is the recorded selection's subtotal. */
  proposal?: { total: number } | null
  /**
   * First stage of the schedule that will govern this contract's invoice.
   * Sourced from the invoice's stages when one exists, otherwise from the MC's
   * default saved schedule resolved against the proposal total. Null means the
   * MC has no schedule at all, in which case the contract cannot state a
   * deposit figure and renders a dash.
   */
  firstStage: { amountCents: number; dueDate: string | null } | null
  userMeta: Record<string, unknown>
}): ContractVariableValues {
  const total = input.proposal ? Number(input.proposal.total) || 0 : 0
  const hasMoneySource = !!input.proposal

  return {
    // …unchanged fields…
    total_amount: hasMoneySource ? formatCurrency(total) : '-',
    deposit_amount:
      hasMoneySource && input.firstStage
        ? formatCurrency(input.firstStage.amountCents / 100)
        : '-',
    // …unchanged fields…
  }
}
```

Update the `deposit_amount` description at line 19 from "Deposit owed (default 25% of total)" to "First payment on the schedule".

- [ ] **Step 4: Update both callers**

In `app/api/email/send-contract/route.ts`, delete the `user_metadata.default_deposit_percent` read at line 113. Load the MC's default schedule instead and resolve its first stage against the proposal total using `resolveStages`:

```ts
const { data: defaultSchedule } = await admin
  .from('payment_schedules')
  .select('id, payment_schedule_stages(position, label, amount_type, amount_value, due_offset_days)')
  .eq('user_id', userId)
  .eq('is_default', true)
  .maybeSingle()
```

Map those rows to `TemplateStage[]`, call `resolveStages(template, Math.round(total * 100), issueDate)`, and pass `firstStage: resolved.ok ? resolved.stages[0] ?? null : null`. Do the same in `components/builders/contract-builder-modal.tsx`, replacing its line 313 read.

- [ ] **Step 5: Redefine the document variables**

In `lib/branding/document-variables.ts:56-57`, change the two `source` strings to "The first payment on the invoice's schedule." and "The first payment's due date." Leave the ids alone: renaming them would break every saved contract template that already references them.

- [ ] **Step 6: Verify and commit**

```bash
npx vitest run tests/unit/lib/contracts/ && npm run typecheck && npm run lint:gate
git add lib/contracts/contract-variables.ts lib/branding/document-variables.ts app/api/email/send-contract/route.ts components/builders/contract-builder-modal.tsx tests/unit/lib/contracts/contract-variables.test.ts
git commit -m "feat(contracts): source deposit_amount from the schedule's first stage"
```

---

### Task 12: `invoice_due` emitter on stages

**Files:**
- Modify: `lib/automations/time-emitters/invoice-due.ts`
- Test: `tests/integration/automations/invoice-due-emitter.test.ts` (extend)

**Interfaces:**
- Consumes: `invoice_payment_stages` from Task 2.
- Produces: `invoice_due` payload gains `stage_id`, `stage_label`, `stage_position`, `stage_count`, `stage_amount_cents`.

- [ ] **Step 1: Write the failing integration tests**

Append to `tests/integration/automations/invoice-due-emitter.test.ts`, following the file's existing seeding helpers:

```ts
it('still emits for later stages after the first is paid', async () => {
  // The live bug: status flips to deposit_paid on first payment and the old
  // emitter's .eq('status','sent') filter stopped matching the invoice at all.
  const invoiceId = await seedInvoice({ status: 'deposit_paid', dueDate: null })
  await seedStage({ invoiceId, position: 1, dueDate: daysFromToday(-30), paidAt: '2026-07-01T00:00:00Z' })
  await seedStage({ invoiceId, position: 2, dueDate: daysFromToday(3), paidAt: null })
  await seedAutomation({ trigger: 'invoice_due', days: 3 })

  const emitted = await invoiceDueEmitter.run(admin)
  expect(emitted).toBe(1)

  const events = await loadEvents(invoiceId, 'invoice_due')
  expect(events).toHaveLength(1)
  expect(events[0]!.payload.stage_position).toBe(2)
  expect(events[0]!.payload.stage_count).toBe(2)
})

it('emits one event per stage when two fall due the same day', async () => {
  const invoiceId = await seedInvoice({ status: 'sent', dueDate: null })
  await seedStage({ invoiceId, position: 1, dueDate: daysFromToday(3), paidAt: null })
  await seedStage({ invoiceId, position: 2, dueDate: daysFromToday(3), paidAt: null })
  await seedAutomation({ trigger: 'invoice_due', days: 3 })

  const emitted = await invoiceDueEmitter.run(admin)
  expect(emitted).toBe(2)
})

it('does not emit for a paid stage', async () => {
  const invoiceId = await seedInvoice({ status: 'sent', dueDate: null })
  await seedStage({ invoiceId, position: 1, dueDate: daysFromToday(3), paidAt: '2026-07-01T00:00:00Z' })
  await seedAutomation({ trigger: 'invoice_due', days: 3 })

  expect(await invoiceDueEmitter.run(admin)).toBe(0)
})

it('still emits off the invoice due_date when there are no stages', async () => {
  const invoiceId = await seedInvoice({ status: 'sent', dueDate: daysFromToday(3) })
  await seedAutomation({ trigger: 'invoice_due', days: 3 })

  const emitted = await invoiceDueEmitter.run(admin)
  expect(emitted).toBe(1)
  const events = await loadEvents(invoiceId, 'invoice_due')
  expect(events[0]!.payload.stage_id).toBeNull()
})

it('does not re-emit the same stage twice in one day', async () => {
  const invoiceId = await seedInvoice({ status: 'sent', dueDate: null })
  await seedStage({ invoiceId, position: 1, dueDate: daysFromToday(3), paidAt: null })
  await seedAutomation({ trigger: 'invoice_due', days: 3 })

  await invoiceDueEmitter.run(admin)
  expect(await invoiceDueEmitter.run(admin)).toBe(0)
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run --project integration tests/integration/automations/invoice-due-emitter.test.ts`
Expected: FAIL on the new cases.

- [ ] **Step 3: Rewrite the candidate loader and emitter**

In `lib/automations/time-emitters/invoice-due.ts`:

Replace `CandidateInvoice` with a candidate that carries optional stage fields:

```ts
/** An invoice-or-stage that could fire today. */
interface Candidate {
  invoiceId: string
  userId: string
  coupleId: string | null
  invoiceNumber: string | null
  subtotal: number | null
  dueDate: string | null
  /** Null for a stageless invoice firing off its own due_date. */
  stageId: string | null
  stageLabel: string | null
  stagePosition: number | null
  stageCount: number | null
  stageAmountCents: number | null
}
```

Replace `loadCandidates`:

```ts
/**
 * Candidates for `userId` at the given lead-time.
 *
 * Two sources, because both must keep working:
 *
 *  1. Unpaid stage rows falling due on the target date, on invoices that are
 *     still `sent` or part paid. `deposit_paid` is included deliberately: the
 *     old `status = 'sent'` filter meant an invoice went silent the moment its
 *     first payment landed, so the balance was never chased.
 *  2. Invoices with no stage rows at all, firing off their own `due_date`
 *     exactly as before. A single-payment invoice has no stage to anchor on.
 */
async function loadCandidates(
  supabase: SupabaseClient<Database>,
  userId: string,
  days: number,
): Promise<Candidate[]> {
  const targetDate = dueDateForLeadDays(days)

  const { data: stageRows, error: stageError } = await supabase
    .from('invoice_payment_stages')
    .select(
      'id, invoice_id, position, label, amount_cents, due_date, invoices!inner(id, user_id, couple_id, invoice_number, subtotal, status)',
    )
    .eq('user_id', userId)
    .is('paid_at', null)
    .eq('due_date', targetDate)
  if (stageError) throw new Error(`load invoice stages: ${stageError.message}`)

  const eligible = (stageRows ?? []).filter((row) => {
    const status = (row.invoices as { status: string }).status
    return status === 'sent' || status === 'deposit_paid'
  })

  // stage_count is needed for the isFinalBalance narrowing in triggers.ts.
  const counts = new Map<string, number>()
  if (eligible.length > 0) {
    const { data: allStages } = await supabase
      .from('invoice_payment_stages')
      .select('invoice_id')
      .in('invoice_id', [...new Set(eligible.map((r) => r.invoice_id))])
    for (const row of allStages ?? []) {
      counts.set(row.invoice_id, (counts.get(row.invoice_id) ?? 0) + 1)
    }
  }

  const fromStages: Candidate[] = eligible.map((row) => {
    const inv = row.invoices as {
      user_id: string
      couple_id: string | null
      invoice_number: string | null
      subtotal: number | null
    }
    return {
      invoiceId: row.invoice_id,
      userId: inv.user_id,
      coupleId: inv.couple_id,
      invoiceNumber: inv.invoice_number,
      subtotal: inv.subtotal,
      dueDate: row.due_date,
      stageId: row.id,
      stageLabel: row.label,
      stagePosition: row.position,
      stageCount: counts.get(row.invoice_id) ?? 1,
      stageAmountCents: row.amount_cents,
    }
  })

  const { data: stageless, error: statelessError } = await supabase
    .from('invoices')
    .select('id, user_id, couple_id, invoice_number, due_date, subtotal')
    .eq('user_id', userId)
    .eq('status', 'sent')
    .eq('due_date', targetDate)
  if (statelessError) throw new Error(`load invoices: ${statelessError.message}`)

  const withStages = new Set<string>()
  if ((stageless ?? []).length > 0) {
    const { data } = await supabase
      .from('invoice_payment_stages')
      .select('invoice_id')
      .in('invoice_id', (stageless ?? []).map((i) => i.id))
    for (const row of data ?? []) withStages.add(row.invoice_id)
  }

  const fromInvoices: Candidate[] = (stageless ?? [])
    .filter((i) => !withStages.has(i.id))
    .map((i) => ({
      invoiceId: i.id,
      userId: i.user_id,
      coupleId: i.couple_id,
      invoiceNumber: i.invoice_number,
      subtotal: i.subtotal,
      dueDate: i.due_date,
      stageId: null,
      stageLabel: null,
      stagePosition: null,
      stageCount: null,
      stageAmountCents: null,
    }))

  return [...fromStages, ...fromInvoices]
}
```

Change `alreadyEmittedToday` to take `stageId: string | null` and compare it alongside `days_until_due`:

```ts
    if (
      Number(row.payload?.days_until_due) === daysUntilDue &&
      (row.payload?.stage_id ?? null) === stageId
    ) {
      return true
    }
```

Widen its payload row type to `{ days_until_due?: unknown; stage_id?: unknown } | null`. Without the `stage_id` half, two stages due the same day collapse into one event.

Extend `emit`'s payload with the five new keys, keeping every existing key so templates that reference them keep rendering:

```ts
      stage_id: candidate.stageId,
      stage_label: candidate.stageLabel,
      stage_position: candidate.stagePosition,
      stage_count: candidate.stageCount,
      stage_amount_cents: candidate.stageAmountCents,
```

Update the module TSDoc: delete the "Known limitations" bullet about installment dates not being wired, and describe the two-source model instead.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run --project integration tests/integration/automations/invoice-due-emitter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run typecheck && npm run lint:gate
git add lib/automations/time-emitters/invoice-due.ts tests/integration/automations/invoice-due-emitter.test.ts
git commit -m "fix(automations): chase every unpaid stage, not just sent invoices"
```

---

### Task 13: `invoice_overdue` emitter, `isFinalBalance`, and the inspector

**Files:**
- Modify: `lib/automations/time-emitters/invoice-overdue.ts`
- Modify: `lib/automations/triggers.ts`
- Modify: `app/(dashboard)/automations/[id]/inspector-extended.tsx`
- Test: `tests/integration/automations/invoice-overdue-emitter.test.ts` (extend)
- Test: `tests/unit/lib/automations/time-emitters/invoice-due.test.ts` (extend)

**Interfaces:**
- Consumes: the `Candidate` shape and payload keys from Task 12.
- Produces: `isFinalBalance` enforced in both triggers' `match()`.

- [ ] **Step 1: Write the failing trigger match tests**

Append to `tests/unit/lib/automations/time-emitters/invoice-due.test.ts`:

```ts
describe('invoice_due isFinalBalance narrowing', () => {
  const spec = getTriggerSpec('invoice_due')

  function stageEvent(position: number, count: number): AutomationEventRow {
    return {
      ...makeEvent(3),
      payload: { invoice_id: 'i', days_until_due: 3, stage_position: position, stage_count: count } as never,
    }
  }

  it('fires for the last stage when isFinalBalance is set', () => {
    expect(spec!.match(stageEvent(3, 3), { days: 3, isFinalBalance: true })).toBe(true)
  })

  it('does not fire for an earlier stage when isFinalBalance is set', () => {
    expect(spec!.match(stageEvent(2, 3), { days: 3, isFinalBalance: true })).toBe(false)
  })

  it('fires for any stage when isFinalBalance is unset', () => {
    expect(spec!.match(stageEvent(2, 3), { days: 3 })).toBe(true)
  })

  it('fires for a stageless invoice when isFinalBalance is set', () => {
    // No stages means the whole invoice is the final balance.
    expect(spec!.match(makeEvent(3), { days: 3, isFinalBalance: true })).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/lib/automations/time-emitters/invoice-due.test.ts`
Expected: FAIL, `isFinalBalance` is currently ignored so the second case returns true.

- [ ] **Step 3: Enforce `isFinalBalance` in both triggers**

In `lib/automations/triggers.ts`, add a shared helper above `invoiceDue`:

```ts
/**
 * Does this event's stage satisfy an `isFinalBalance` filter?
 *
 * A stageless invoice has no `stage_position`, and the whole invoice is
 * effectively its own final balance, so it passes. Otherwise only the last
 * stage does. This field has been in the config schema since the trigger
 * shipped but was never read, because the emitters anchored on the invoice's
 * own due_date and had no notion of a stage.
 */
function matchesFinalBalance(payload: Record<string, unknown>, isFinalBalance?: boolean): boolean {
  if (!isFinalBalance) return true
  const position = Number(payload.stage_position)
  const count = Number(payload.stage_count)
  if (!Number.isFinite(position) || !Number.isFinite(count)) return true
  return position === count
}
```

In `invoiceDue.match`, after the existing lead-time check:

```ts
    return (
      Number.isFinite(emitted) &&
      emitted === config.days &&
      matchesFinalBalance(payload, config.isFinalBalance)
    )
```

In `invoiceOverdue.match`, add `if (!matchesFinalBalance(payload, config.isFinalBalance)) return false` before the final `return true`. Update both match comments: delete the "accepted but not yet enforced" sentences about `isFinalBalance`, keeping the ones about `daysUntilEvent*`, which stay unenforced.

- [ ] **Step 4: Mirror Task 12's changes into the overdue emitter**

Apply the same rewrite to `lib/automations/time-emitters/invoice-overdue.ts`: the same `Candidate` type, the same two-source `loadCandidates` (comparing `due_date` against `dueDateForOverdueDays(daysOverdue)`), the same `stage_id` addition to `alreadyEmittedToday`, and the same five payload keys. Keep `days_overdue` as the narrowing field.

- [ ] **Step 5: Extend the overdue integration test**

Append to `tests/integration/automations/invoice-overdue-emitter.test.ts` the direct equivalents of Task 12's five cases, using overdue offsets (`daysFromToday(-threshold)`) instead of lead times.

- [ ] **Step 6: Add the inspector checkbox**

In `app/(dashboard)/automations/[id]/inspector-extended.tsx`, add a checkbox for `isFinalBalance` to both the `invoice_due` and `invoice_overdue` config panels, labelled "Only the final payment", with helper text "Skip the earlier stages and only chase the last one." Use the existing checkbox primitive the file already uses for `respectQuietHours`.

- [ ] **Step 7: Verify and commit**

```bash
npx vitest run --project unit tests/unit/lib/automations/
npx vitest run --project integration tests/integration/automations/
npm run typecheck && npm run lint:gate
git add lib/automations tests/unit/lib/automations tests/integration/automations "app/(dashboard)/automations"
git commit -m "feat(automations): stage-level overdue reminders and isFinalBalance filter"
```

---

### Task 14: `has_paid_deposit` condition

**Files:**
- Modify: `lib/automations/conditions.ts`
- Test: `tests/unit/lib/automations/conditions.test.ts` (extend)

**Interfaces:**
- Consumes: nothing new. Reads the run context.
- Produces: `has_paid_deposit` resolves against the first stage.

- [ ] **Step 1: Confirm the suspected bug first**

Run: `grep -rn "deposit_paid_at" lib/automations/ types/automations.ts` and inspect the `couples` table columns in `types/database.ts`. The spec expects `ctx.couple` to have no `deposit_paid_at`, making the condition always false. Record what you find; if it does exist, the fix below still applies but the "always false today" framing in the spec is wrong and the spec needs correcting.

- [ ] **Step 2: Write the failing test**

Append to `tests/unit/lib/automations/conditions.test.ts`:

```ts
describe('has_paid_deposit', () => {
  it('is true when the first stage is paid', () => {
    expect(
      evaluatePredicate(
        { type: 'has_paid_deposit' },
        makeContext({ firstStagePaidAt: '2026-07-02T00:00:00Z' }),
      ),
    ).toBe(true)
  })

  it('is false when the first stage is unpaid', () => {
    expect(
      evaluatePredicate({ type: 'has_paid_deposit' }, makeContext({ firstStagePaidAt: null })),
    ).toBe(false)
  })

  it('is false when there is no schedule', () => {
    expect(evaluatePredicate({ type: 'has_paid_deposit' }, makeContext({}))).toBe(false)
  })
})
```

Extend the file's `makeContext` helper to accept `firstStagePaidAt` and place it wherever the run context actually carries invoice data. Read `RunContext` in `lib/automations/` first: if it has no invoice stage field, add one and populate it where the context is built, rather than reaching into `ctx.couple`.

- [ ] **Step 3: Run to verify failure, then implement**

Run: `npx vitest run tests/unit/lib/automations/conditions.test.ts`
Expected: FAIL.

Then replace line 175:

```ts
    case 'has_paid_deposit':
      // "Deposit paid" now means the first stage of the invoice's schedule is
      // settled. The previous implementation read ctx.couple.deposit_paid_at,
      // a column the couples table does not have, so it never returned true.
      return Boolean(ctx.invoice?.firstStagePaidAt)
```

- [ ] **Step 4: Verify and commit**

```bash
npx vitest run tests/unit/lib/automations/conditions.test.ts && npm run typecheck
git add lib/automations/conditions.ts tests/unit/lib/automations/conditions.test.ts
git commit -m "fix(automations): has_paid_deposit reads the first payment stage"
```

---

### Task 15: Remove payment terms from packages and proposals

**Files:**
- Modify: `app/(dashboard)/templates/package-edit-form.tsx`
- Modify: `app/(dashboard)/templates/packages-manager.tsx`
- Modify: `app/(dashboard)/templates/package-preview.tsx`
- Modify: `components/builders/parts/proposal-option-card.tsx`
- Modify: `components/builders/parts/use-apply-sources.ts`
- Modify: `lib/payments/proposal-view.ts`
- Modify: `app/(dashboard)/payments/actions.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: no `depositPercent` anywhere in the package or proposal surface. The columns still exist in the database until Task 16.

- [ ] **Step 1: Remove the package deposit field**

In `package-edit-form.tsx`, delete `deposit_percent` from both type declarations (lines 37 and 53), the `depositPercent` state at line 94, its inclusion in the save payload at line 111, and the "Booking deposit" input at lines 236-237.

- [ ] **Step 2: Remove it from the manager and preview**

In `packages-manager.tsx`, delete `deposit_percent` from the row type at line 61, the two save payloads at 277 and 312, the duplicate payload at 375, the draft mapping at 444, the empty draft at 485, and the `depositPercent` prop passed at 685. In `package-preview.tsx`, delete the prop and the line that renders it.

- [ ] **Step 3: Remove it from the proposal surface**

In `proposal-option-card.tsx`, delete `depositPercent` from the option type at line 30 and the terms push at line 72. In `use-apply-sources.ts`, delete `depositPercent` from both the package and proposal source shapes. In `lib/payments/proposal-view.ts`, delete `deposit_percent` at line 36.

- [ ] **Step 4: Remove it from the payments actions**

In `app/(dashboard)/payments/actions.ts`, delete `deposit_percent` from the invoice write at line 135, the option insert at 494, the select list at 587, and the option copy at 631.

- [ ] **Step 5: Verify and commit**

```bash
npm run typecheck && npm run lint:gate && npx vitest run --project unit
```
Expected: PASS. Any test asserting a "% deposit" chip on an option card or a deposit field on the package form is now testing removed behaviour: delete those assertions, since the removal is the intended change, not a regression.

```bash
git add "app/(dashboard)/templates" "app/(dashboard)/payments/actions.ts" components/builders/parts lib/payments/proposal-view.ts
git commit -m "refactor(payments): remove payment terms from packages and proposals"
```

---

### Task 16: Migration B, drops and RPC replacements

The destructive half. Runs last because everything above now reads stage rows, so nothing breaks when the columns disappear.

**Files:**
- Create: `supabase/migrations/20260730000100_drop_legacy_deposit_columns.sql`
- Modify: `types/database.ts` (regenerated)
- Modify: `app/(dashboard)/payments/invoices-list.tsx`
- Test: `tests/integration/payments/sign-contract-stages.test.ts`

**Interfaces:**
- Consumes: every table and function from Task 2.
- Produces: `get_public_invoice` returns `stages`; `sign_contract` stamps the default schedule; the seven legacy columns are gone.

- [ ] **Step 1: Write the failing sign_contract test**

Create `tests/integration/payments/sign-contract-stages.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'

import { createTestUser, adminClient } from '../helpers/supabase'

describe('sign_contract stamps the default schedule', () => {
  let user: { id: string }
  let contractId: string
  let coupleId: string

  beforeAll(async () => {
    user = await createTestUser()
    const admin = adminClient()
    // Seed couple, a $5,000 accepted proposal, and a sent contract linked to
    // it. Follow the seeding helpers the contracts integration specs already
    // use rather than inlining inserts here.
    ;({ contractId, coupleId } = await seedSignableContract(admin, user.id, 5000))
  })

  it('spawns an invoice for the full proposal subtotal with stages', async () => {
    const admin = adminClient()
    await admin.rpc('sign_contract', {
      p_contract_id: contractId,
      p_signer_name: 'Sam',
      p_signer_ip: '127.0.0.1',
    })

    const { data: invoice } = await admin
      .from('invoices')
      .select('id, subtotal, title')
      .eq('couple_id', coupleId)
      .single()

    // Full subtotal, not the deposit figure. The old function inserted
    // 25% of the proposal and then also set deposit_percent, so the public
    // page charged 25% of 25%.
    expect(Number(invoice!.subtotal)).toBe(5000)
    expect(invoice!.title).toMatch(/^Invoice for/)

    const { data: stages } = await admin
      .from('invoice_payment_stages')
      .select('position, label, amount_type, amount_cents, due_date')
      .eq('invoice_id', invoice!.id)
      .order('position')

    expect(stages).toHaveLength(2)
    expect(stages![0]).toMatchObject({ position: 1, amount_type: 'percent', amount_cents: 125_000 })
    expect(stages![1]).toMatchObject({ position: 2, amount_type: 'remainder', amount_cents: 375_000 })
  })

  it('spawns a stageless invoice when the MC has no default schedule', async () => {
    const admin = adminClient()
    const other = await createTestUser()
    await admin.from('payment_schedules').delete().eq('user_id', other.id)
    const seeded = await seedSignableContract(admin, other.id, 3000)

    await admin.rpc('sign_contract', {
      p_contract_id: seeded.contractId,
      p_signer_name: 'Alex',
      p_signer_ip: '127.0.0.1',
    })

    const { data: invoice } = await admin
      .from('invoices')
      .select('id, subtotal')
      .eq('couple_id', seeded.coupleId)
      .single()
    expect(Number(invoice!.subtotal)).toBe(3000)

    const { data: stages } = await admin
      .from('invoice_payment_stages')
      .select('id')
      .eq('invoice_id', invoice!.id)
    expect(stages).toEqual([])
  })
})
```

Write `seedSignableContract` in the same file, copying the fixture shape from the existing contracts integration specs.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/20260730000100_drop_legacy_deposit_columns.sql`:

```sql
-- Retire the two-stage deposit model.
--
-- Split from 20260730000000 so every application consumer could be rewritten
-- and tested against stage rows while the old columns still existed. The guard
-- below replaces the single-transaction safety that split gives up: this
-- migration refuses to drop anything unless the backfill actually landed.

do $$
declare
  unmigrated integer;
begin
  select count(*) into unmigrated
  from public.invoices i
  where (i.deposit_percent is not null or i.deposit_paid_at is not null)
    and not exists (
      select 1 from public.invoice_payment_stages s where s.invoice_id = i.id
    );

  if unmigrated > 0 then
    raise exception
      'Refusing to drop legacy deposit columns: % invoice(s) have no stage rows. Re-run backfill_invoice_payment_stages() first.',
      unmigrated;
  end if;
end $$;

-- @ALLOW_DESTRUCTIVE: payment terms move to payment_schedules; packages and
-- proposals no longer carry them at all (see spec section 2, decision 3).
alter table public.packages drop column if exists deposit_percent;
alter table public.proposal_options drop column if exists deposit_percent;

-- @ALLOW_DESTRUCTIVE: replaced by invoice_payment_stages, backfilled in
-- migration 20260730000000 and asserted by the guard above.
alter table public.invoices drop column if exists deposit_percent;
alter table public.invoices drop column if exists deposit_due_date;
alter table public.invoices drop column if exists deposit_paid_at;
alter table public.invoices drop column if exists final_due_date;
alter table public.invoices drop column if exists final_paid_at;
```

Then, in the same file, re-declare the three functions. `get_public_invoice` keeps every key from `20260726000000_add_event_date_venue_to_public_rpcs.sql` except the five deposit ones, and gains:

```sql
    'stages', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'position', s.position,
          'label', s.label,
          'amount_cents', s.amount_cents,
          'due_date', s.due_date,
          'paid_at', s.paid_at
        ) order by s.position
      )
      from public.invoice_payment_stages s
      where s.invoice_id = i.id
    ), '[]'::jsonb),
```

Copy the whole function body from that migration rather than writing a fresh one, so no other key is accidentally dropped. Do the same for `get_public_proposal`, deleting only `deposit_percent`.

For `sign_contract`, copy the body from `20260711000000_drop_quotes_feature.sql` and replace the invoice-spawn block (lines 108-124) with:

```sql
        insert into public.invoices (
          user_id, couple_id, proposal_id, title, status,
          invoice_number, subtotal, share_token, share_token_enabled
        ) values (
          v_proposal.user_id,
          v_proposal.couple_id,
          v_proposal.id,
          'Invoice for ' || coalesce(v_proposal.title, v_proposal.proposal_number),
          'draft',
          public.generate_invoice_number(v_proposal.user_id),
          -- Full subtotal. The previous version inserted only the deposit
          -- figure AND set deposit_percent, so the public page charged a
          -- percentage of a percentage.
          v_proposal.subtotal,
          gen_random_uuid(),
          true
        ) returning id into v_invoice_id;

        -- Stamp the MC's default schedule onto the new invoice. Percent
        -- stages resolve against the subtotal; the remainder stage takes what
        -- is left so the rows always sum to the invoice exactly. No default
        -- schedule means no stages, and the invoice behaves as a single
        -- payment.
        insert into public.invoice_payment_stages (
          user_id, invoice_id, position, label, amount_type, amount_value,
          amount_cents, due_date
        )
        select
          v_proposal.user_id,
          v_invoice_id,
          ts.position,
          ts.label,
          ts.amount_type,
          ts.amount_value,
          case
            when ts.amount_type = 'percent'
              then round(v_proposal.subtotal * 100 * ts.amount_value / 100)::int
            when ts.amount_type = 'fixed'
              then round(ts.amount_value * 100)::int
            else round(v_proposal.subtotal * 100)::int - coalesce((
              select sum(
                case
                  when x.amount_type = 'percent'
                    then round(v_proposal.subtotal * 100 * x.amount_value / 100)::int
                  else round(x.amount_value * 100)::int
                end
              )
              from public.payment_schedule_stages x
              where x.schedule_id = ts.schedule_id
                and x.amount_type <> 'remainder'
            ), 0)
          end,
          current_date + ts.due_offset_days
        from public.payment_schedule_stages ts
        join public.payment_schedules ps on ps.id = ts.schedule_id
        where ps.user_id = v_proposal.user_id and ps.is_default
        order by ts.position;
```

- [ ] **Step 3: Reset, regenerate types, run everything**

```bash
supabase db reset
npx supabase gen types typescript --local > types/database.ts
npm run typecheck
npx vitest run
```

Expected: typecheck passes because Tasks 6 through 15 already removed every reference to the dropped columns. If typecheck reports a leftover reference, that is a real miss from an earlier task: fix the reference, do not restore the column.

- [ ] **Step 4: Relabel the invoice status badge**

In `app/(dashboard)/payments/invoices-list.tsx`, change the `deposit_paid` badge label to "Part paid". Leave the stored value alone: renaming it would break the automations conditions and any saved filters.

- [ ] **Step 5: Verify the migration gate accepts the file**

Run: `bash scripts/check-migrations.sh`
Expected: PASS. If it rejects a drop, the `@ALLOW_DESTRUCTIVE` marker is in the wrong position relative to the statement: read the script to see what proximity it requires.

- [ ] **Step 6: Commit**

```bash
npm run lint:gate
git add supabase/migrations/20260730000100_drop_legacy_deposit_columns.sql types/database.ts "app/(dashboard)/payments/invoices-list.tsx" tests/integration/payments/sign-contract-stages.test.ts
git commit -m "feat(db): drop the legacy two-stage deposit columns"
```

---

### Task 17: End-to-end coverage, docs, and gates

**Files:**
- Create: `tests/e2e/payment-schedules.spec.ts`
- Modify: `.claude/docs/database-schema.md`
- Modify: `.claude/docs/page-specs.md`
- Modify: `.claude/docs/payments.md`
- Modify: `.claude/docs/security.md`
- Modify: `.claude/docs/alerts.md`
- Modify: `.claude/docs/testing.md`
- Modify: `.claude/docs/production-readiness.md`
- Modify: `scripts/typecheck-strict-gate.mjs`, `scripts/lint-gate.mjs`

**Interfaces:**
- Consumes: everything.
- Produces: a green pyramid and ratcheted gates.

- [ ] **Step 1: Write the e2e spec**

Create `tests/e2e/payment-schedules.spec.ts`. Follow the existing e2e specs for auth setup and project configuration so it runs on desktop, Pixel 5 and iPhone 12:

```ts
import { expect, test } from '@playwright/test'

test('build, save, reuse and pay a three-stage schedule', async ({ page }) => {
  // 1. Build three stages on a fresh invoice.
  await page.goto('/payments')
  await page.getByRole('button', { name: /new invoice/i }).click()
  // …fill title, couple and a $5,000 line item…
  await page.getByRole('button', { name: /add stage/i }).click()
  await page.getByRole('button', { name: /add stage/i }).click()
  await page.getByRole('button', { name: /add stage/i }).click()
  // …set 25% / 50% / remainder with dates…
  await expect(page.getByText('$1,250.00')).toBeVisible()

  // 2. Save it as a schedule, then confirm it is offered on a second invoice.
  await page.getByRole('button', { name: /save this as a schedule/i }).click()
  await page.getByLabel(/schedule name/i).fill('25 / 50 / 25')
  await page.getByRole('button', { name: /^save$/i }).click()

  await page.getByRole('button', { name: /new invoice/i }).click()
  await page.getByRole('button', { name: /apply a saved schedule/i }).click()
  await expect(page.getByRole('button', { name: '25 / 50 / 25' })).toBeVisible()
  await page.getByRole('button', { name: '25 / 50 / 25' }).click()
  await expect(page.getByText(/remainder/i)).toBeVisible()

  // 3. Send it and open the public page.
  await page.getByRole('button', { name: /send/i }).click()
  const shareUrl = await page.getByTestId('invoice-share-url').inputValue()
  await page.goto(shareUrl)

  // 4. Only the first stage is payable; later ones are locked.
  await expect(page.getByRole('button', { name: /pay deposit/i })).toBeVisible()
  await expect(page.getByText(/available once the previous payment clears/i)).toHaveCount(2)
})
```

Payment itself needs Stripe test-mode Checkout. If the existing e2e suite has no Stripe helper, assert up to the button state here and cover settlement with the integration tests instead, then note the gap in `testing.md` rather than leaving a silently partial spec.

- [ ] **Step 2: Run the full pyramid**

```bash
npm test
npm run typecheck
npm run typecheck:strict
npm run lint:gate
npx playwright test tests/e2e/payment-schedules.spec.ts
```

Fix the app for any failure. Never edit a test to make it pass.

- [ ] **Step 3: Update the docs**

- `database-schema.md`: the three new tables, their RLS, the partial unique index, and the seven removed columns.
- `security.md`: tick the RLS coverage matrix for all three tables; note the `security definer` backfill function and its `revoke`.
- `payments.md`: the stage model, `'stage' | 'remaining'`, the `stage_ids` metadata contract, the derived status table, and the `sign_contract` amount change.
- `page-specs.md`: the invoice builder's schedule section and the picker; state explicitly that there is no Schedules page.
- `alerts.md`: the new stage-mismatch alert from Task 8.
- `testing.md`: the new specs, plus the Stripe e2e gap if step 1 left one.
- `production-readiness.md`: mark the feature and record the two behaviour changes for release notes (reminders now firing for later stages, and the spawned invoice amount).

- [ ] **Step 4: Ratchet the gates**

Read the current budgets in `scripts/typecheck-strict-gate.mjs` and `scripts/lint-gate.mjs`, run both commands to get the new counts, and lower the budgets to match. Only ever decrease them.

- [ ] **Step 5: Commit and open the PR**

```bash
git add tests/e2e/payment-schedules.spec.ts .claude/docs scripts
git commit -m "test(payments): e2e coverage for custom payment schedules; update docs and gates"
git push -u origin feature/custom-payment-schedules
gh pr create --base staging --title "feat(payments): custom payment schedules" --body "…"
```

The PR body must call out the two production behaviour changes: reminders now fire for stages after the first (repairing a live bug where they went silent), and the invoice `sign_contract` spawns is now the full proposal amount with a schedule rather than the deposit figure.

---

## Self-Review

**Spec coverage.** Every section maps to a task: §3 data model to Task 2; §4 resolver to Task 1; §5 payment flow to Tasks 7 and 8; §6 reminders to Tasks 12, 13 and 14; §7 authoring to Tasks 3, 4, 5 and 6; §8 rendering to Tasks 9, 10 and 11; §9 migration to Tasks 2 and 16; §10 fallout to Tasks 9, 10, 11, 15 and 16; §11 testing to Tasks 1, 2, 3, 12, 13 and 17; §13 definition of done to Task 17.

**Three gaps found in the first self-review, all now closed in the plan text:**

1. **Drag-reorder was specced but not built.** Closed: Task 5 Step 6 wires `@dnd-kit` sortable into the row and the timeline, reusing the `category-picker-base.tsx` pattern, with two new row tests.
2. **The "Save as schedule" name prompt had no component**, and `onSaveAsSchedule()` did not match the hook's `saveAsSchedule(name)`. Closed: Task 5 Step 7 adds the inline footer form and the prop is now `(name: string) => void`.
3. **Task 5 ended on a commit that fails typecheck**, contradicting the Global Constraint that typecheck stays at 0. Closed: Tasks 5 and 6 are one deliverable sharing one commit at the end of Task 6, so no broken commit enters the branch.

**Type consistency.** `InvoiceStage` is used by the row, the timeline and the hook; `TemplateStage` by the resolver, the actions and the hook; `ResolvedStage` by the resolver and `replaceInvoiceStages`. `PaymentSchedule` is both a type and a component, so Task 5 aliases the type to `PaymentScheduleType` at its import. `Candidate` is shared verbatim between the two emitters.

**Sequencing.** Tasks 5 and 6 run as one dispatch and one commit, so the tree never lands in a state that fails typecheck. Migration B lands at Task 16, after every consumer reads stages, which is what keeps Tasks 7 through 15 green.
