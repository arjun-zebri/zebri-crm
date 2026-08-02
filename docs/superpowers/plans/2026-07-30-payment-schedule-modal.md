# Payment Schedule Modal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the invoice builder's three-affordance payment-schedule block with a clear list-you-drill-into: a local invoice timeline plus a dedicated library modal that owns saved-schedule management.

**Architecture:** The invoice surface (`payment-schedule.tsx`) is local and presentational: it shows an empty state, a stage timeline, a running total, and one "Change" door into the library. The library modal (`schedule-library-modal.tsx`) owns list-or-editor mode and the unsaved-changes guard; the editor writes to the library only and never mutates the current invoice. A pure `describeSchedule` helper renders row summaries so they cannot drift from the stages. No schema change, no new server action: the existing `schedule-actions.ts` and `resolve-stages.ts` are reused unchanged.

**Tech Stack:** Next.js 16 · React 19 · Tailwind 4 (`@theme inline` tokens) · `@tanstack/react-query` · `@radix-ui/*` · `@dnd-kit` · Vitest 3 + React Testing Library · Playwright.

## Global Constraints

- Components ≤ ~150 lines each. Page/modal stays an orchestrator.
- Content is `text-sm` (`--text-body` ≡ 0.875rem). `text-caption` (0.75rem) only for true meta: "Paid 12 Jun", "Due 10 Sep", the uppercase section label, and the row summary line.
- Semantic tokens only: `bg-surface`, `bg-card`, `text-text`, `text-text-muted`, `text-text-subtle`, `border-border`. No arbitrary colour values (`bg-[#…]`).
- Shared primitives only for form controls: `Button`, `Input`, `Select`, `DatePicker`, `ConfirmDialog`, `Modal`, `RowActionsMenu`. No raw `<button>`/`<input>`/`<select>` for form controls (a plain `<button>` for a bespoke clickable row is acceptable where no primitive fits, following the existing `payment-stage-row.tsx` pattern).
- Lucide icons at `strokeWidth={1.5}`. Buttons `rounded-xl`. Every interactive element gets `cursor-pointer`.
- No boxes inside boxes. Stage rows sit directly on the surface, separated by the dashed timeline.
- No em dashes in copy or comments.
- TSDoc on every exported function/type/module; why-comments on non-obvious logic.
- No `any`; use the generated/domain types end to end.
- Works on desktop, Pixel 5, iPhone 12 with Tailwind responsive prefixes. No raw CSS media queries.
- Tests use semantic selectors: `getByRole` > `getByLabel` > `getByText` > `data-testid`.
- Gates that must stay green at every commit: `npm test` (unit), `npm run typecheck`, `npm run typecheck:strict`, `npm run lint:gate`.

---

## File Structure

**Create:**
- `lib/payments/describe-schedule.ts` — pure `describeSchedule(stages) => string`.
- `components/builders/parts/schedule-template-row.tsx` — one template stage editor row.
- `components/builders/parts/schedule-editor.tsx` — name field + template rows + Cancel/Save.
- `components/builders/parts/schedule-library-list.tsx` — schedule rows, overflow menu, New schedule.
- `components/builders/parts/schedule-library-modal.tsx` — modal shell: list-or-editor mode + unsaved guard + delete confirm.
- Tests: `tests/unit/lib/payments/describe-schedule.test.ts`, and `tests/unit/components/builders/{schedule-template-row,schedule-editor,schedule-library-list,schedule-library-modal}.test.tsx`.

**Modify:**
- `components/builders/parts/payment-schedule.tsx` — rewritten invoice section (empty state, timeline, running total, Change).
- `components/builders/parts/payment-stage-row.tsx` — restyle to `text-sm`; paid rows already lose remove control.
- `components/builders/parts/use-invoice-stages.ts` — expose `defaultSchedule`; replace library mutations with `createSchedule`/`updateSchedule`/`deleteSchedule`/`setDefaultSchedule`; drop `saveAsSchedule`/`updateApplied`/`renameSchedule`/`isModified`/`appliedScheduleId`.
- `components/builders/invoice-builder-modal.tsx` — update the `<PaymentSchedule>` call site to the new props.
- `tests/unit/components/builders/payment-schedule.test.tsx` — rewritten.
- `tests/unit/components/builders/payment-stage-row.test.tsx` — one class selector adapted.
- Docs: `.claude/docs/component-library.md`, `.claude/docs/payments.md`, `.claude/docs/testing.md`.

**Delete:**
- `components/builders/parts/schedule-picker.tsx`
- `tests/unit/components/builders/schedule-picker.test.tsx`

**Reused unchanged:** `app/(dashboard)/payments/schedule-actions.ts`, `lib/payments/resolve-stages.ts`, `types/payment-schedule.ts`, `components/ui/{modal,confirm-dialog,row-actions-menu,button,input,select,date-picker}.tsx`.

---

## Task 1: `describeSchedule` pure helper

**Files:**
- Create: `lib/payments/describe-schedule.ts`
- Test: `tests/unit/lib/payments/describe-schedule.test.ts`

**Interfaces:**
- Consumes: `TemplateStage` from `@/types/payment-schedule` (`{ label, amountType, amountValue, dueOffsetDays }`).
- Produces: `describeSchedule(stages: TemplateStage[]): string`. Used by the library list rows and the invoice empty-state summary.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/lib/payments/describe-schedule.test.ts
import { describe, expect, it } from 'vitest'

import { describeSchedule } from '@/lib/payments/describe-schedule'
import type { TemplateStage } from '@/types/payment-schedule'

const s = (
  amountType: TemplateStage['amountType'],
  amountValue: number | null,
): TemplateStage => ({ label: 'x', amountType, amountValue, dueOffsetDays: 0 })

describe('describeSchedule', () => {
  it('joins a percent stage and a remainder with "then remainder"', () => {
    expect(describeSchedule([s('percent', 25), s('remainder', null)])).toBe('25%, then remainder')
  })

  it('joins several percent stages before the remainder', () => {
    expect(
      describeSchedule([s('percent', 25), s('percent', 25), s('remainder', null)]),
    ).toBe('25%, 25%, then remainder')
  })

  it('lists percentages that do not end in a remainder', () => {
    expect(describeSchedule([s('percent', 50), s('percent', 50)])).toBe('50%, 50%')
  })

  it('formats a fixed dollar stage', () => {
    expect(describeSchedule([s('fixed', 500), s('remainder', null)])).toBe('$500, then remainder')
  })

  it('describes a single stage without a "then"', () => {
    expect(describeSchedule([s('percent', 100)])).toBe('100%')
  })

  it('describes an empty schedule as a single payment', () => {
    expect(describeSchedule([])).toBe('Single payment')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lib/payments/describe-schedule.test.ts`
Expected: FAIL, cannot resolve `@/lib/payments/describe-schedule`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/payments/describe-schedule.ts
/**
 * Turn a saved schedule's template stages into a short, human summary such as
 * "25%, then remainder". The library list and the invoice empty state both
 * render this instead of prose stored in the database, so a summary can never
 * drift from the stages it describes.
 *
 * @module lib/payments/describe-schedule
 */
import type { TemplateStage } from '@/types/payment-schedule'

/** The amount portion of one stage: "25%", "$500", or "remainder". */
function token(stage: TemplateStage): string {
  if (stage.amountType === 'remainder') return 'remainder'
  if (stage.amountType === 'fixed') return `$${String(stage.amountValue ?? 0)}`
  return `${String(stage.amountValue ?? 0)}%`
}

/**
 * Summarise a schedule's shape from its stages.
 *
 * A trailing remainder reads as ", then remainder" so the common
 * deposit-plus-balance shape is obvious at a glance; everything else is a
 * plain comma-joined list. Zero stages means a single-payment invoice.
 */
export function describeSchedule(stages: TemplateStage[]): string {
  if (stages.length === 0) return 'Single payment'
  const tokens = stages.map(token)
  const last = stages[stages.length - 1]
  if (stages.length > 1 && last?.amountType === 'remainder') {
    return `${tokens.slice(0, -1).join(', ')}, then remainder`
  }
  return tokens.join(', ')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/lib/payments/describe-schedule.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/payments/describe-schedule.ts tests/unit/lib/payments/describe-schedule.test.ts
git commit -m "feat(payments): add describeSchedule summary helper"
```

---

## Task 2: `ScheduleTemplateRow` — one template stage editor row

**Files:**
- Create: `components/builders/parts/schedule-template-row.tsx`
- Test: `tests/unit/components/builders/schedule-template-row.test.tsx`

**Interfaces:**
- Consumes: `TemplateStage`, `StageAmountType` from `@/types/payment-schedule`; `Input`, `Select` primitives.
- Produces:
  ```ts
  interface ScheduleTemplateRowProps {
    stage: TemplateStage
    onChange: (patch: Partial<TemplateStage>) => void
    onRemove: () => void
  }
  export function ScheduleTemplateRow(props: ScheduleTemplateRowProps): JSX.Element
  ```
  Controlled row (parent editor holds the array). Switching to `remainder` clears `amountValue` to `null`; switching away restores `0`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/builders/schedule-template-row.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ScheduleTemplateRow } from '@/components/builders/parts/schedule-template-row'
import type { TemplateStage } from '@/types/payment-schedule'

const stage: TemplateStage = {
  label: 'Deposit',
  amountType: 'percent',
  amountValue: 25,
  dueOffsetDays: 7,
}

function setup(overrides: Partial<TemplateStage> = {}) {
  const props = { stage: { ...stage, ...overrides }, onChange: vi.fn(), onRemove: vi.fn() }
  render(<ScheduleTemplateRow {...props} />)
  return props
}

describe('ScheduleTemplateRow', () => {
  it('edits the label', async () => {
    const props = setup()
    const field = screen.getByLabelText(/stage label/i)
    await userEvent.type(field, '!')
    expect(props.onChange).toHaveBeenCalledWith({ label: 'Deposit!' })
  })

  it('edits the day offset', async () => {
    const props = setup()
    const field = screen.getByLabelText(/days after issue/i)
    await userEvent.clear(field)
    await userEvent.type(field, '30')
    expect(props.onChange).toHaveBeenLastCalledWith({ dueOffsetDays: 30 })
  })

  it('clears the value when switched to remainder', async () => {
    const props = setup()
    await userEvent.selectOptions(screen.getByLabelText(/stage amount type/i), 'remainder')
    expect(props.onChange).toHaveBeenCalledWith({ amountType: 'remainder', amountValue: null })
  })

  it('hides the value field for a remainder stage', () => {
    setup({ amountType: 'remainder', amountValue: null })
    expect(screen.queryByLabelText(/stage amount$/i)).not.toBeInTheDocument()
  })

  it('removes the row', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /remove deposit/i }))
    expect(props.onRemove).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/components/builders/schedule-template-row.test.tsx`
Expected: FAIL, cannot resolve the component.

> **Note on the Select test:** the shared `Select` renders a native `<select>` under the hood, so `userEvent.selectOptions(getByLabelText('Stage amount type'), 'remainder')` works. If the local `Select` is a Radix listbox rather than a native element, switch that one assertion to open the trigger and click the option; verify by reading `components/ui/select.tsx` before implementing.

- [ ] **Step 3: Write the implementation**

```tsx
// components/builders/parts/schedule-template-row.tsx
/**
 * One editable stage on a saved schedule's template.
 *
 * A template stage carries a relative day offset and no payment state, which is
 * why it is a separate component from `payment-stage-row.tsx` (a concrete,
 * possibly-paid invoice stage). Merging the two would mean one component with
 * two personalities and a pile of conditionals.
 *
 * @module components/builders/parts/schedule-template-row
 */
'use client'

import { X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { StageAmountType, TemplateStage } from '@/types/payment-schedule'

/** Props for {@link ScheduleTemplateRow}. */
export interface ScheduleTemplateRowProps {
  stage: TemplateStage
  onChange: (patch: Partial<TemplateStage>) => void
  onRemove: () => void
}

/** A single template stage: label, amount type, value, offset in days, remove. */
export function ScheduleTemplateRow({ stage, onChange, onRemove }: ScheduleTemplateRowProps) {
  const isRemainder = stage.amountType === 'remainder'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        size="sm"
        value={stage.label}
        onChange={(e) => onChange({ label: e.target.value })}
        aria-label="Stage label"
        className="w-40"
      />
      <Select
        value={stage.amountType}
        onValueChange={(v) => {
          const amountType = v as StageAmountType
          // A remainder carries no value; switching to it must clear one or the
          // SQL check constraint rejects the row. Switching away restores 0.
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
      {!isRemainder && (
        <Input
          size="sm"
          type="number"
          min={0}
          value={stage.amountValue ?? ''}
          onChange={(e) =>
            onChange({ amountValue: e.target.value === '' ? null : Number(e.target.value) })
          }
          aria-label="Stage amount"
          className="w-20 tabular-nums"
        />
      )}
      <div className="flex items-center gap-1.5">
        <Input
          size="sm"
          type="number"
          min={0}
          value={String(stage.dueOffsetDays)}
          onChange={(e) => onChange({ dueOffsetDays: Number(e.target.value) || 0 })}
          aria-label="Days after issue"
          className="w-16 tabular-nums"
        />
        <span className="text-caption text-text-muted">days</span>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${stage.label}`}
        className="ml-auto cursor-pointer text-text-subtle transition-colors hover:text-danger"
      >
        <X size={14} strokeWidth={1.5} />
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/components/builders/schedule-template-row.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add components/builders/parts/schedule-template-row.tsx tests/unit/components/builders/schedule-template-row.test.tsx
git commit -m "feat(payments): add schedule template stage row"
```

---

## Task 3: `ScheduleEditor` — name field, template rows, Cancel/Save

**Files:**
- Create: `components/builders/parts/schedule-editor.tsx`
- Test: `tests/unit/components/builders/schedule-editor.test.tsx`

**Interfaces:**
- Consumes: `ScheduleTemplateRow` (Task 2); `validateForSave` from `@/lib/payments/resolve-stages`; `Button`, `Input`; `TemplateStage`.
- Produces:
  ```ts
  interface ScheduleEditorProps {
    /** Existing schedule to edit, or null for a new one. */
    schedule: { id: string; name: string; stages: TemplateStage[] } | null
    saving: boolean
    onBack: () => void
    onDirtyChange: (dirty: boolean) => void
    onSave: (input: { name: string; stages: TemplateStage[] }) => void
  }
  export function ScheduleEditor(props: ScheduleEditorProps): JSX.Element
  ```
  Save is disabled with a stated reason when the template is invalid (empty name, fewer than two stages, two remainders, remainder not last, or percentages over 100). `onSave` receives plain `TemplateStage`s with any internal key stripped.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/builders/schedule-editor.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ScheduleEditor } from '@/components/builders/parts/schedule-editor'
import type { TemplateStage } from '@/types/payment-schedule'

const stages: TemplateStage[] = [
  { label: 'Deposit', amountType: 'percent', amountValue: 25, dueOffsetDays: 0 },
  { label: 'Final balance', amountType: 'remainder', amountValue: null, dueOffsetDays: 30 },
]

function setup(overrides: Partial<Parameters<typeof ScheduleEditor>[0]> = {}) {
  const props = {
    schedule: { id: 'sch-1', name: 'Default', stages },
    saving: false,
    onBack: vi.fn(),
    onDirtyChange: vi.fn(),
    onSave: vi.fn(),
    ...overrides,
  }
  render(<ScheduleEditor {...props} />)
  return props
}

describe('ScheduleEditor', () => {
  it('saves the name and stages of an existing schedule', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(props.onSave).toHaveBeenCalledWith({ name: 'Default', stages })
  })

  it('reports dirty when the name changes', async () => {
    const props = setup()
    await userEvent.type(screen.getByLabelText(/schedule name/i), 'x')
    expect(props.onDirtyChange).toHaveBeenCalledWith(true)
  })

  it('disables Save with a reason for two remainder stages', () => {
    setup({
      schedule: {
        id: 'sch-2',
        name: 'Broken',
        stages: [
          { label: 'A', amountType: 'remainder', amountValue: null, dueOffsetDays: 0 },
          { label: 'B', amountType: 'remainder', amountValue: null, dueOffsetDays: 0 },
        ],
      },
    })
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
    expect(screen.getByText(/only one stage can take the remaining balance/i)).toBeInTheDocument()
  })

  it('disables Save with a reason when percentages exceed 100', () => {
    setup({
      schedule: {
        id: 'sch-3',
        name: 'Over',
        stages: [
          { label: 'A', amountType: 'percent', amountValue: 70, dueOffsetDays: 0 },
          { label: 'B', amountType: 'percent', amountValue: 70, dueOffsetDays: 0 },
        ],
      },
    })
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
    expect(screen.getByText(/add up to more than 100/i)).toBeInTheDocument()
  })

  it('disables Save with a reason for a new empty schedule', () => {
    setup({ schedule: null })
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })

  it('adds a stage', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /add stage/i }))
    expect(props.onDirtyChange).toHaveBeenCalledWith(true)
    expect(screen.getAllByLabelText(/stage label/i)).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/components/builders/schedule-editor.test.tsx`
Expected: FAIL, cannot resolve the component.

- [ ] **Step 3: Write the implementation**

```tsx
// components/builders/parts/schedule-editor.tsx
/**
 * The focused editor for one saved schedule, reached from Edit or New schedule.
 *
 * Save writes to the library only; it never touches the current invoice. That
 * is the price of the explicit-library / local-invoice split: to adopt a new
 * shape on the invoice the MC re-applies the schedule from the list.
 *
 * @module components/builders/parts/schedule-editor
 */
'use client'

import { ArrowLeft, Plus } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { validateForSave } from '@/lib/payments/resolve-stages'
import type { StageAmountType, TemplateStage } from '@/types/payment-schedule'

import { ScheduleTemplateRow } from './schedule-template-row'

/** A template stage plus a stable list key that never leaves this component. */
type DraftStage = TemplateStage & { key: string }

/** Props for {@link ScheduleEditor}. */
export interface ScheduleEditorProps {
  schedule: { id: string; name: string; stages: TemplateStage[] } | null
  saving: boolean
  onBack: () => void
  onDirtyChange: (dirty: boolean) => void
  onSave: (input: { name: string; stages: TemplateStage[] }) => void
}

/**
 * Why this template cannot be saved yet, as a sentence, or null when it is
 * savable. Mirrors the server's `assertSavable`, plus a percent-over-100 check
 * the server only catches at resolve time, so the MC learns before the click.
 */
function saveBlockReason(name: string, stages: TemplateStage[]): string | null {
  if (name.trim() === '') return 'Name your schedule.'
  if (stages.length < 2) return 'A schedule needs at least two stages.'
  const errors = validateForSave(stages)
  if (errors.some((e) => e.code === 'multiple_remainders')) {
    return 'Only one stage can take the remaining balance.'
  }
  if (errors.some((e) => e.code === 'remainder_not_last')) {
    return 'The remaining-balance stage has to be last.'
  }
  const percentTotal = stages
    .filter((s) => s.amountType === 'percent')
    .reduce((acc, s) => acc + (s.amountValue ?? 0), 0)
  if (percentTotal > 100) return 'The percentages add up to more than 100%.'
  return null
}

/** Editor for a single saved schedule. See {@link ScheduleEditorProps}. */
export function ScheduleEditor({ schedule, saving, onBack, onDirtyChange, onSave }: ScheduleEditorProps) {
  const keyCounter = useRef(0)
  const nextKey = () => `k${String(keyCounter.current++)}`

  const [name, setName] = useState(schedule?.name ?? '')
  const [stages, setStages] = useState<DraftStage[]>(() =>
    (schedule?.stages ?? []).map((s) => ({ ...s, key: nextKey() })),
  )

  const markDirty = () => onDirtyChange(true)

  const patch = (key: string, p: Partial<TemplateStage>) => {
    setStages((cur) => cur.map((s) => (s.key === key ? { ...s, ...p } : s)))
    markDirty()
  }

  const addStage = () => {
    setStages((cur) => {
      const hasRemainder = cur.some((s) => s.amountType === 'remainder')
      const amountType: StageAmountType = hasRemainder ? 'percent' : 'remainder'
      return [
        ...cur,
        {
          key: nextKey(),
          label: `Payment ${String(cur.length + 1)}`,
          amountType,
          amountValue: hasRemainder ? 0 : null,
          dueOffsetDays: 0,
        },
      ]
    })
    markDirty()
  }

  const removeStage = (key: string) => {
    setStages((cur) => cur.filter((s) => s.key !== key))
    markDirty()
  }

  const reason = saveBlockReason(name, stages)

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text"
      >
        <ArrowLeft size={15} strokeWidth={1.5} /> Back
      </button>

      <div className="space-y-1.5">
        <label htmlFor="schedule-name" className="block text-caption font-medium text-text-muted">
          Name
        </label>
        <Input
          id="schedule-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            markDirty()
          }}
          aria-label="Schedule name"
          placeholder="e.g. 50 / 50"
        />
      </div>

      <div className="space-y-3">
        {stages.map((s) => (
          <ScheduleTemplateRow
            key={s.key}
            stage={s}
            onChange={(p) => patch(s.key, p)}
            onRemove={() => removeStage(s.key)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addStage}
        className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text"
      >
        <Plus size={15} strokeWidth={1.5} /> Add stage
      </button>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
        {reason && <span className="mr-auto text-caption text-text-subtle">{reason}</span>}
        <Button variant="ghost" size="sm" onClick={onBack}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          loading={saving}
          disabled={reason !== null}
          onClick={() =>
            onSave({ name: name.trim(), stages: stages.map(({ key: _key, ...s }) => s) })
          }
        >
          Save
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/components/builders/schedule-editor.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Run typecheck (base + strict)**

Run: `npm run typecheck && npm run typecheck:strict`
Expected: base 0 errors; strict budget not exceeded.

- [ ] **Step 6: Commit**

```bash
git add components/builders/parts/schedule-editor.tsx tests/unit/components/builders/schedule-editor.test.tsx
git commit -m "feat(payments): add saved-schedule editor"
```

---

## Task 4: `ScheduleLibraryList` — rows, overflow menu, New schedule

**Files:**
- Create: `components/builders/parts/schedule-library-list.tsx`
- Test: `tests/unit/components/builders/schedule-library-list.test.tsx`

**Interfaces:**
- Consumes: `describeSchedule` (Task 1); `RowActionsMenu` from `@/components/ui/row-actions-menu`; `PaymentSchedule`.
- Produces:
  ```ts
  interface ScheduleLibraryListProps {
    schedules: PaymentSchedule[]
    onApply: (schedule: PaymentSchedule) => void
    onEdit: (schedule: PaymentSchedule) => void
    onDuplicate: (schedule: PaymentSchedule) => void
    onSetDefault: (id: string) => void
    onDelete: (schedule: PaymentSchedule) => void
    onNew: () => void
  }
  export function ScheduleLibraryList(props: ScheduleLibraryListProps): JSX.Element
  ```
  Clicking a row body applies; the trailing overflow menu holds Edit, Duplicate, Set as default, Delete. Default row shows a star. Empty library shows a line and New schedule.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/builders/schedule-library-list.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ScheduleLibraryList } from '@/components/builders/parts/schedule-library-list'
import type { PaymentSchedule } from '@/types/payment-schedule'

const schedules: PaymentSchedule[] = [
  {
    id: 'a',
    name: 'Default',
    isDefault: true,
    stages: [
      { label: 'Deposit', amountType: 'percent', amountValue: 25, dueOffsetDays: 0 },
      { label: 'Final', amountType: 'remainder', amountValue: null, dueOffsetDays: 30 },
    ],
  },
]

function setup(overrides: Partial<Parameters<typeof ScheduleLibraryList>[0]> = {}) {
  const props = {
    schedules,
    onApply: vi.fn(),
    onEdit: vi.fn(),
    onDuplicate: vi.fn(),
    onSetDefault: vi.fn(),
    onDelete: vi.fn(),
    onNew: vi.fn(),
    ...overrides,
  }
  render(<ScheduleLibraryList {...props} />)
  return props
}

describe('ScheduleLibraryList', () => {
  it('applies a schedule when its row is clicked', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /default/i }))
    expect(props.onApply).toHaveBeenCalledWith(schedules[0])
  })

  it('renders the summary from describeSchedule', () => {
    setup()
    expect(screen.getByText('25%, then remainder')).toBeInTheDocument()
  })

  it('fires Edit from the overflow menu', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /row actions/i }))
    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    expect(props.onEdit).toHaveBeenCalledWith(schedules[0])
  })

  it('fires Delete from the overflow menu', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /row actions/i }))
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(props.onDelete).toHaveBeenCalledWith(schedules[0])
  })

  it('offers New schedule', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /new schedule/i }))
    expect(props.onNew).toHaveBeenCalled()
  })

  it('shows an empty-library line', () => {
    setup({ schedules: [] })
    expect(screen.getByText(/no saved schedules/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/components/builders/schedule-library-list.test.tsx`
Expected: FAIL, cannot resolve the component.

- [ ] **Step 3: Write the implementation**

```tsx
// components/builders/parts/schedule-library-list.tsx
/**
 * The list mode of the schedule library modal: one row per saved schedule.
 *
 * Clicking a row applies it (the common case, one tap). The trailing overflow
 * menu holds the management actions so Apply and management never sit side by
 * side inside a row, which is the ambiguity this redesign removes.
 *
 * @module components/builders/parts/schedule-library-list
 */
'use client'

import { Plus, Star } from 'lucide-react'

import { RowActionsMenu } from '@/components/ui/row-actions-menu'
import { describeSchedule } from '@/lib/payments/describe-schedule'
import type { PaymentSchedule } from '@/types/payment-schedule'

/** Props for {@link ScheduleLibraryList}. */
export interface ScheduleLibraryListProps {
  schedules: PaymentSchedule[]
  onApply: (schedule: PaymentSchedule) => void
  onEdit: (schedule: PaymentSchedule) => void
  onDuplicate: (schedule: PaymentSchedule) => void
  onSetDefault: (id: string) => void
  onDelete: (schedule: PaymentSchedule) => void
  onNew: () => void
}

/** New-schedule affordance, shared by the empty and populated states. */
function NewButton({ onNew }: { onNew: () => void }) {
  return (
    <button
      type="button"
      onClick={onNew}
      className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text"
    >
      <Plus size={15} strokeWidth={1.5} /> New schedule
    </button>
  )
}

/** Schedule rows with an overflow menu, or an empty-library line. */
export function ScheduleLibraryList({
  schedules,
  onApply,
  onEdit,
  onDuplicate,
  onSetDefault,
  onDelete,
  onNew,
}: ScheduleLibraryListProps) {
  if (schedules.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-text-muted">You have no saved schedules.</p>
        <NewButton onNew={onNew} />
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {schedules.map((s) => (
        <div
          key={s.id}
          className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface-muted"
        >
          <button
            type="button"
            onClick={() => onApply(s)}
            className="min-w-0 flex-1 cursor-pointer text-left"
          >
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium text-text">{s.name}</span>
              {s.isDefault && (
                <Star size={13} strokeWidth={1.5} className="shrink-0 text-brand-fg" aria-label="Default" />
              )}
            </span>
            <span className="block truncate text-caption text-text-muted">
              {describeSchedule(s.stages)}
            </span>
          </button>
          <RowActionsMenu
            alwaysVisible
            size="sm"
            actions={[
              { label: 'Edit', onSelect: () => onEdit(s) },
              { label: 'Duplicate', onSelect: () => onDuplicate(s) },
              { label: 'Set as default', onSelect: () => onSetDefault(s.id) },
              { label: 'Delete', destructive: true, onSelect: () => onDelete(s) },
            ]}
          />
        </div>
      ))}
      <div className="pt-1">
        <NewButton onNew={onNew} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/components/builders/schedule-library-list.test.tsx`
Expected: PASS (6 tests). If the `RowActionsMenu` trigger's accessible name differs from `/row actions/i`, read `components/ui/row-actions-menu.tsx` (its `aria-label="Row actions"`) and keep the selector in sync.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add components/builders/parts/schedule-library-list.tsx tests/unit/components/builders/schedule-library-list.test.tsx
git commit -m "feat(payments): add schedule library list"
```

---

## Task 5: `ScheduleLibraryModal` — modal shell, mode switching, unsaved guard

**Files:**
- Create: `components/builders/parts/schedule-library-modal.tsx`
- Test: `tests/unit/components/builders/schedule-library-modal.test.tsx`

**Interfaces:**
- Consumes: `Modal`, `ConfirmDialog`, `useToast`; `ScheduleLibraryList` (Task 4); `ScheduleEditor` (Task 3); `PaymentSchedule`, `TemplateStage`.
- Produces:
  ```ts
  interface ScheduleLibraryModalProps {
    open: boolean
    onClose: () => void
    schedules: PaymentSchedule[]
    loading: boolean
    error: string | null
    hasPaidStage: boolean
    onApply: (schedule: PaymentSchedule) => void
    onCreate: (input: { name: string; stages: TemplateStage[] }) => Promise<void>
    onUpdate: (input: { id: string; name?: string; stages?: TemplateStage[] }) => Promise<void>
    onDelete: (id: string) => Promise<void>
    onSetDefault: (id: string) => Promise<void>
  }
  export function ScheduleLibraryModal(props: ScheduleLibraryModalProps): JSX.Element
  ```
  Owns list-or-editor mode, the editor's dirty flag, a leave-confirm guard, a delete-confirm, and the saving flag. Applying a row calls `onApply` (the parent closes the modal). Editor Save routes to `onCreate` (new) or `onUpdate` (existing), toasts on failure, returns to the list on success. Duplicate creates a copy named `"<name> copy"`, never default.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/builders/schedule-library-modal.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ScheduleLibraryModal } from '@/components/builders/parts/schedule-library-modal'
import type { PaymentSchedule } from '@/types/payment-schedule'

vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

const schedules: PaymentSchedule[] = [
  {
    id: 'a',
    name: 'Default',
    isDefault: true,
    stages: [
      { label: 'Deposit', amountType: 'percent', amountValue: 25, dueOffsetDays: 0 },
      { label: 'Final', amountType: 'remainder', amountValue: null, dueOffsetDays: 30 },
    ],
  },
]

function setup(overrides: Partial<Parameters<typeof ScheduleLibraryModal>[0]> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    schedules,
    loading: false,
    error: null,
    hasPaidStage: false,
    onApply: vi.fn(),
    onCreate: vi.fn().mockResolvedValue(undefined),
    onUpdate: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onSetDefault: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  render(<ScheduleLibraryModal {...props} />)
  return props
}

describe('ScheduleLibraryModal', () => {
  it('applies a schedule when its row is clicked', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /default/i }))
    expect(props.onApply).toHaveBeenCalledWith(schedules[0])
  })

  it('shows a load error inline', () => {
    setup({ error: 'Could not load your saved schedules.' })
    expect(screen.getByText(/could not load your saved schedules/i)).toBeInTheDocument()
  })

  it('opens the editor from Edit and saves an update', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /row actions/i }))
    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(props.onUpdate).toHaveBeenCalledWith({
      id: 'a',
      name: 'Default',
      stages: schedules[0]!.stages,
    })
  })

  it('prompts before leaving the editor with unsaved changes', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /row actions/i }))
    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    await userEvent.type(screen.getByLabelText(/schedule name/i), 'x')
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.getByText(/discard/i)).toBeInTheDocument()
  })

  it('confirms before deleting', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /row actions/i }))
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(props.onDelete).toHaveBeenCalledWith('a')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/components/builders/schedule-library-modal.test.tsx`
Expected: FAIL, cannot resolve the component.

- [ ] **Step 3: Write the implementation**

```tsx
// components/builders/parts/schedule-library-modal.tsx
/**
 * The schedule library: a modal that manages the reusable set of saved
 * schedules. List mode applies a schedule in one tap or opens management via an
 * overflow menu; editor mode edits or creates one. Saving in the editor writes
 * to the library only and never touches the current invoice.
 *
 * @module components/builders/parts/schedule-library-modal
 */
'use client'

import { useState } from 'react'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import type { PaymentSchedule, TemplateStage } from '@/types/payment-schedule'

import { ScheduleEditor } from './schedule-editor'
import { ScheduleLibraryList } from './schedule-library-list'

/** Which view the modal is showing. */
type Mode = { kind: 'list' } | { kind: 'editor'; schedule: PaymentSchedule | null }

/** Props for {@link ScheduleLibraryModal}. */
export interface ScheduleLibraryModalProps {
  open: boolean
  onClose: () => void
  schedules: PaymentSchedule[]
  loading: boolean
  error: string | null
  hasPaidStage: boolean
  onApply: (schedule: PaymentSchedule) => void
  onCreate: (input: { name: string; stages: TemplateStage[] }) => Promise<void>
  onUpdate: (input: { id: string; name?: string; stages?: TemplateStage[] }) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onSetDefault: (id: string) => Promise<void>
}

/** The saved-schedule library modal. See {@link ScheduleLibraryModalProps}. */
export function ScheduleLibraryModal({
  open,
  onClose,
  schedules,
  loading,
  error,
  hasPaidStage,
  onApply,
  onCreate,
  onUpdate,
  onDelete,
  onSetDefault,
}: ScheduleLibraryModalProps) {
  const { toast } = useToast()
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [leaveConfirm, setLeaveConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PaymentSchedule | null>(null)

  const toList = () => {
    setMode({ kind: 'list' })
    setDirty(false)
    setLeaveConfirm(false)
  }

  // The editor is the only mode that can hold unsaved work, so the guard only
  // fires there.
  const leaveEditor = () => {
    if (mode.kind === 'editor' && dirty) setLeaveConfirm(true)
    else toList()
  }

  const close = () => {
    if (mode.kind === 'editor' && dirty) {
      setLeaveConfirm(true)
      return
    }
    toList()
    onClose()
  }

  const save = async (input: { name: string; stages: TemplateStage[] }) => {
    if (mode.kind !== 'editor') return
    setSaving(true)
    try {
      if (mode.schedule) await onUpdate({ id: mode.schedule.id, ...input })
      else await onCreate(input)
      toList()
    } catch {
      // Leave the editor open with values intact so nothing is retyped.
      toast('Could not save the schedule. Try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const duplicate = async (s: PaymentSchedule) => {
    try {
      await onCreate({ name: `${s.name} copy`, stages: s.stages })
    } catch {
      toast('Could not duplicate the schedule. Try again.', 'error')
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await onDelete(deleteTarget.id)
    } catch {
      toast('Could not delete the schedule. Try again.', 'error')
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <>
      <Modal
        isOpen={open}
        onClose={close}
        title="Payment schedule"
        size="md"
        nested
      >
        <div className="p-5">
          {loading ? (
            <div className="space-y-3" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-surface-muted" />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-danger">{error}</p>
          ) : mode.kind === 'editor' ? (
            <ScheduleEditor
              schedule={mode.schedule}
              saving={saving}
              onBack={leaveEditor}
              onDirtyChange={setDirty}
              onSave={save}
            />
          ) : (
            <div className="space-y-4">
              <ScheduleLibraryList
                schedules={schedules}
                onApply={onApply}
                onEdit={(s) => setMode({ kind: 'editor', schedule: s })}
                onDuplicate={duplicate}
                onSetDefault={onSetDefault}
                onDelete={setDeleteTarget}
                onNew={() => {
                  setDirty(false)
                  setMode({ kind: 'editor', schedule: null })
                }}
              />
              {hasPaidStage && (
                <p className="text-caption text-text-subtle">
                  Applying a different schedule keeps any stage that is already paid.
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={leaveConfirm}
        title="Discard changes?"
        description="This schedule has unsaved changes. Leaving will discard them."
        confirmLabel="Discard"
        loadingLabel="Discarding..."
        onCancel={() => setLeaveConfirm(false)}
        onConfirm={toList}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete schedule?"
        description="Invoices already using this schedule keep their stages. This only removes it from your library."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/components/builders/schedule-library-modal.test.tsx`
Expected: PASS (6 tests). If two `Delete` buttons collide in the delete-confirm assertion (the row menu item and the ConfirmDialog primary both read "Delete"), the menu closes on select so only the dialog's button remains; if the test still finds two, scope the final click with `within(screen.getByRole('dialog'))`.

- [ ] **Step 5: Run typecheck (base + strict)**

Run: `npm run typecheck && npm run typecheck:strict`
Expected: base 0 errors; strict budget not exceeded.

- [ ] **Step 6: Commit**

```bash
git add components/builders/parts/schedule-library-modal.tsx tests/unit/components/builders/schedule-library-modal.test.tsx
git commit -m "feat(payments): add schedule library modal shell"
```

---

## Task 6: Restyle `PaymentStageRow` to `text-sm`

**Files:**
- Modify: `components/builders/parts/payment-stage-row.tsx:77-86`
- Test: `tests/unit/components/builders/payment-stage-row.test.tsx:50`

**Interfaces:**
- Consumes/Produces: unchanged `PaymentStageRowProps`. This is a typography-only change: the amount/percent line moves from `text-caption` to `text-sm`; the due/paid line and the "Remaining balance" hint stay `text-caption` (true meta).

- [ ] **Step 1: Update the amount line to `text-sm`**

In `components/builders/parts/payment-stage-row.tsx`, change the percentage-plus-amount span (currently `className="text-caption text-text-muted tabular-nums"` around line 79) to `text-sm`:

```tsx
        <span className="text-sm text-text-muted tabular-nums">
          {stage.amountType === 'remainder' ? 'remainder' : `${String(stage.amountValue ?? 0)}${unit}`}
          {' · '}
          {formatCurrency(stage.amountCents)}
        </span>
```

Leave the label span as-is (`text-body font-medium`, which equals `text-sm`) and leave the due/paid span at `text-caption`.

- [ ] **Step 2: Adapt the one class-based assertion**

In `tests/unit/components/builders/payment-stage-row.test.tsx`, the remainder-hint assertion pins `selector: 'span.text-caption'`. The inline "Remaining balance" hint (line 155 of the component) is unchanged and remains `text-caption`, so this assertion still holds. Run the suite to confirm; only change it if it fails:

```tsx
    expect(screen.getByText('Remaining balance', { selector: 'span.text-caption' })).toBeInTheDocument()
```

- [ ] **Step 3: Run the stage-row tests**

Run: `npx vitest run tests/unit/components/builders/payment-stage-row.test.tsx`
Expected: PASS (all existing tests green).

- [ ] **Step 4: Commit**

```bash
git add components/builders/parts/payment-stage-row.tsx tests/unit/components/builders/payment-stage-row.test.tsx
git commit -m "style(payments): raise invoice stage amount to text-sm"
```

---

## Task 7: Rewrite `PaymentSchedule` — empty state, timeline, running total, Change

**Files:**
- Modify (rewrite): `components/builders/parts/payment-schedule.tsx`
- Test (rewrite): `tests/unit/components/builders/payment-schedule.test.tsx`

**Interfaces:**
- Consumes: `PaymentStageRow` (Task 6); `ScheduleLibraryModal` (Task 5); `describeSchedule` (Task 1); `Button`; `@dnd-kit`; `InvoiceStage`, `PaymentSchedule as PaymentScheduleType`, `TemplateStage`.
- Produces:
  ```ts
  interface PaymentScheduleProps {
    canEdit: boolean
    stages: InvoiceStage[]
    totalCents: number
    defaultSchedule: PaymentScheduleType | null
    schedules: PaymentScheduleType[]
    schedulesLoading: boolean
    schedulesError: string | null
    validationError: string | null
    markPendingStageId: string | null
    onStagesChange: (stages: InvoiceStage[]) => void
    onApplySchedule: (schedule: PaymentScheduleType | null) => void
    onMarkPaid: (stageId: string) => void
    onCreateSchedule: (input: { name: string; stages: TemplateStage[] }) => Promise<void>
    onUpdateSchedule: (input: { id: string; name?: string; stages?: TemplateStage[] }) => Promise<void>
    onDeleteSchedule: (id: string) => Promise<void>
    onSetDefaultSchedule: (id: string) => Promise<void>
  }
  export function PaymentSchedule(props: PaymentScheduleProps): JSX.Element
  ```
  Owns the library modal's open state. Empty state (no stages): a line, a primary "Apply <defaultName>" button (or "Add payment schedule" when there is no default), and a "Choose another schedule" link. Applied state: header with a Change button, the drag-reorder timeline, "+ Add stage", and an always-visible running total that warns when the stage sum does not equal the invoice total.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/builders/payment-schedule.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PaymentSchedule } from '@/components/builders/parts/payment-schedule'
import type { InvoiceStage, PaymentSchedule as PaymentScheduleType } from '@/types/payment-schedule'

vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

const defaultSchedule: PaymentScheduleType = {
  id: 'def',
  name: 'Default',
  isDefault: true,
  stages: [
    { label: 'Deposit', amountType: 'percent', amountValue: 25, dueOffsetDays: 0 },
    { label: 'Final', amountType: 'remainder', amountValue: null, dueOffsetDays: 30 },
  ],
}

const stageA: InvoiceStage = {
  id: 's1', position: 1, label: 'Deposit', amountType: 'percent',
  amountValue: 25, amountCents: 140_000, dueDate: '2026-08-01', paidAt: null,
}
const stageB: InvoiceStage = {
  id: 's2', position: 2, label: 'Final', amountType: 'remainder',
  amountValue: null, amountCents: 420_000, dueDate: '2026-09-01', paidAt: null,
}

function setup(overrides: Partial<Parameters<typeof PaymentSchedule>[0]> = {}) {
  const props = {
    canEdit: true,
    stages: [stageA, stageB],
    totalCents: 560_000,
    defaultSchedule,
    schedules: [defaultSchedule],
    schedulesLoading: false,
    schedulesError: null,
    validationError: null,
    markPendingStageId: null,
    onStagesChange: vi.fn(),
    onApplySchedule: vi.fn(),
    onMarkPaid: vi.fn(),
    onCreateSchedule: vi.fn().mockResolvedValue(undefined),
    onUpdateSchedule: vi.fn().mockResolvedValue(undefined),
    onDeleteSchedule: vi.fn().mockResolvedValue(undefined),
    onSetDefaultSchedule: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  render(<PaymentSchedule {...props} />)
  return props
}

describe('PaymentSchedule', () => {
  it('offers the default schedule by name in the empty state', () => {
    setup({ stages: [] })
    expect(screen.getByRole('button', { name: /apply .*default/i })).toBeInTheDocument()
    expect(screen.getByText('25%, then remainder')).toBeInTheDocument()
  })

  it('applies the default when the primary button is clicked', async () => {
    const props = setup({ stages: [] })
    await userEvent.click(screen.getByRole('button', { name: /apply .*default/i }))
    expect(props.onApplySchedule).toHaveBeenCalledWith(defaultSchedule)
  })

  it('offers Add payment schedule when there is no default', () => {
    setup({ stages: [], defaultSchedule: null })
    expect(screen.getByRole('button', { name: /add payment schedule/i })).toBeInTheDocument()
  })

  it('shows a matching running total', () => {
    setup()
    expect(screen.getByText(/stages total .*\$5,600\.00 of \$5,600\.00/i)).toBeInTheDocument()
  })

  it('warns when the stage total is short of the invoice total', () => {
    setup({ totalCents: 600_000, validationError: 'The stages do not add up to the invoice total.' })
    expect(screen.getByText(/do not add up/i)).toBeInTheDocument()
  })

  it('opens the library from Change', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /change/i }))
    // The library modal renders its own title.
    expect(screen.getByRole('heading', { name: /payment schedule/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/components/builders/payment-schedule.test.tsx`
Expected: FAIL (new props shape / new markup not present yet).

- [ ] **Step 3: Write the rewrite**

```tsx
// components/builders/parts/payment-schedule.tsx
/**
 * The invoice builder's payment-schedule section: a local, presentational view
 * of this invoice's stages plus one door into the reusable library.
 *
 * The library is explicit and the invoice is local: editing a saved schedule
 * never changes this invoice, and tweaking a stage here never changes the
 * library. "Change" is the only route into the library, so the MC always knows
 * which surface a control affects.
 *
 * @module components/builders/parts/payment-schedule
 */
'use client'

import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { describeSchedule } from '@/lib/payments/describe-schedule'
import type {
  InvoiceStage,
  PaymentSchedule as PaymentScheduleType,
  TemplateStage,
} from '@/types/payment-schedule'

import { PaymentStageRow } from './payment-stage-row'
import { ScheduleLibraryModal } from './schedule-library-modal'

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100)
}

/** Props for {@link PaymentSchedule}. */
export interface PaymentScheduleProps {
  canEdit: boolean
  stages: InvoiceStage[]
  totalCents: number
  defaultSchedule: PaymentScheduleType | null
  schedules: PaymentScheduleType[]
  schedulesLoading: boolean
  schedulesError: string | null
  validationError: string | null
  markPendingStageId: string | null
  onStagesChange: (stages: InvoiceStage[]) => void
  onApplySchedule: (schedule: PaymentScheduleType | null) => void
  onMarkPaid: (stageId: string) => void
  onCreateSchedule: (input: { name: string; stages: TemplateStage[] }) => Promise<void>
  onUpdateSchedule: (input: { id: string; name?: string; stages?: TemplateStage[] }) => Promise<void>
  onDeleteSchedule: (id: string) => Promise<void>
  onSetDefaultSchedule: (id: string) => Promise<void>
}

/** The invoice payment-schedule section. See {@link PaymentScheduleProps}. */
export function PaymentSchedule(props: PaymentScheduleProps) {
  const {
    canEdit,
    stages,
    totalCents,
    defaultSchedule,
    schedules,
    schedulesLoading,
    schedulesError,
    validationError,
    markPendingStageId,
    onStagesChange,
    onApplySchedule,
    onMarkPaid,
    onCreateSchedule,
    onUpdateSchedule,
    onDeleteSchedule,
    onSetDefaultSchedule,
  } = props

  const [libraryOpen, setLibraryOpen] = useState(false)

  const nextUnpaidId = stages.find((s) => !s.paidAt)?.id ?? null
  const hasPaidStage = stages.some((s) => s.paidAt)
  const stageSumCents = stages.reduce((acc, s) => acc + s.amountCents, 0)
  const totalMatches = stageSumCents === totalCents

  const patchStage = (id: string, patch: Partial<InvoiceStage>) => {
    onStagesChange(stages.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  const addStage = () => {
    const hasRemainder = stages.some((s) => s.amountType === 'remainder')
    onStagesChange([
      ...stages,
      {
        // Client-only id until persisted; replaceInvoiceStages keys on position.
        id: `new-${String(stages.length + 1)}`,
        position: stages.length + 1,
        label: `Payment ${String(stages.length + 1)}`,
        amountType: hasRemainder ? 'percent' : 'remainder',
        amountValue: hasRemainder ? 0 : null,
        amountCents: 0,
        dueDate: null,
        paidAt: null,
      },
    ])
  }

  const applyFromModal = (schedule: PaymentScheduleType) => {
    onApplySchedule(schedule)
    setLibraryOpen(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-caption font-medium uppercase tracking-wide text-text-muted">
          Payment schedule
        </h4>
        {canEdit && stages.length > 0 && (
          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            className="cursor-pointer text-sm text-text-muted transition-colors hover:text-text"
          >
            Change
          </button>
        )}
      </div>

      {stages.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-text-muted">The couple pays this invoice in one payment.</p>
          {canEdit &&
            (defaultSchedule ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Button variant="primary" size="sm" onClick={() => onApplySchedule(defaultSchedule)}>
                  Apply “{defaultSchedule.name}”
                </Button>
                <span className="text-caption text-text-muted">
                  {describeSchedule(defaultSchedule.stages)}
                </span>
              </div>
            ) : (
              <Button variant="primary" size="sm" onClick={() => setLibraryOpen(true)}>
                Add payment schedule
              </Button>
            ))}
          {canEdit && defaultSchedule && (
            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              className="block cursor-pointer text-sm text-text-muted transition-colors hover:text-text"
            >
              Choose another schedule
            </button>
          )}
        </div>
      ) : (
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={(event: DragEndEvent) => {
            const { active, over } = event
            if (!over || active.id === over.id) return
            const ids = stages.map((s) => s.id)
            onStagesChange(
              arrayMove(stages, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))),
            )
          }}
        >
          <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
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
          </SortableContext>
        </DndContext>
      )}

      {stages.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {canEdit ? (
            <button
              type="button"
              onClick={addStage}
              className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text"
            >
              <Plus size={15} strokeWidth={1.5} /> Add stage
            </button>
          ) : (
            <span />
          )}
          <span
            className={`text-sm tabular-nums ${totalMatches ? 'text-text-muted' : 'text-warning'}`}
          >
            Stages total {formatCurrency(stageSumCents)} of {formatCurrency(totalCents)}
          </span>
        </div>
      )}

      {validationError && <p className="text-sm text-danger">{validationError}</p>}

      <ScheduleLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        schedules={schedules}
        loading={schedulesLoading}
        error={schedulesError}
        hasPaidStage={hasPaidStage}
        onApply={applyFromModal}
        onCreate={onCreateSchedule}
        onUpdate={onUpdateSchedule}
        onDelete={onDeleteSchedule}
        onSetDefault={onSetDefaultSchedule}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/components/builders/payment-schedule.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Run typecheck (base + strict) and lint gate**

Run: `npm run typecheck && npm run typecheck:strict && npm run lint:gate`
Expected: base 0 errors; strict budget not exceeded; lint budget not exceeded. (This file no longer imports `Input`/`SchedulePicker`; the rewrite drops the inline naming form entirely.)

- [ ] **Step 6: Commit**

```bash
git add components/builders/parts/payment-schedule.tsx tests/unit/components/builders/payment-schedule.test.tsx
git commit -m "feat(payments): rewrite invoice payment-schedule section"
```

---

## Task 8: Wire the hook + call site; delete the picker

**Files:**
- Modify: `components/builders/parts/use-invoice-stages.ts`
- Modify: `components/builders/invoice-builder-modal.tsx:889-908` (the `<PaymentSchedule>` call site)
- Delete: `components/builders/parts/schedule-picker.tsx`
- Delete: `tests/unit/components/builders/schedule-picker.test.tsx`

**Interfaces:**
- Consumes: existing server actions `createSchedule`, `updateSchedule`, `deleteSchedule`, `setDefaultSchedule`, `listSchedules`, `markStagePaid`, `replaceInvoiceStages`.
- Produces (new/changed on the hook's return object):
  - `defaultSchedule: PaymentSchedule | null`
  - `createSchedule: (input: { name: string; stages: TemplateStage[] }) => Promise<void>`
  - `updateSchedule: (input: { id: string; name?: string; stages?: TemplateStage[] }) => Promise<void>`
  - `deleteSchedule: (id: string) => Promise<void>`
  - `setDefaultSchedule: (id: string) => Promise<void>`
  - Removed: `saveAsSchedule`, `updateApplied`, `renameSchedule`, `isModified`, `appliedScheduleId`.
  - Unchanged and still returned: `stages`, `setStages`, `schedules`, `schedulesLoading`, `schedulesError`, `validationError`, `applySchedule`, `markPaid`, `markPendingStageId`, `persist`.

- [ ] **Step 1: Update the hook's mutations and return object**

In `components/builders/parts/use-invoice-stages.ts`:

Replace the `saveAsMutation`, `updateAppliedMutation`, and `renameMutation` blocks with library mutations keyed to explicit editor input:

```ts
  const createMutation = useMutation({
    mutationFn: (input: { name: string; stages: TemplateStage[] }) => createSchedule(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['payment-schedules'] }),
  })
  const updateMutation = useMutation({
    mutationFn: (input: { id: string; name?: string; stages?: TemplateStage[] }) => updateSchedule(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['payment-schedules'] }),
  })
```

Keep `deleteMutation`, `defaultMutation`, and `markPaidMutation` as they are.

Remove the now-unused state: delete the `appliedScheduleId`/`setAppliedScheduleId` and `isModified`/`setIsModified` declarations, and drop the `setAppliedScheduleId(...)`/`setIsModified(...)`/`setIsModified(false)` calls inside `applySchedule` and `changeStages`. `applySchedule` becomes:

```ts
  const applySchedule = useCallback(
    (schedule: PaymentSchedule | null) => {
      if (!schedule) {
        setDraft((current) => current.filter((s) => s.paidAt))
        return
      }
      const next = resolveStages(schedule.stages, totalCents, issueDate)
      if (!next.ok) return
      setDraft(
        next.stages.map((s) => ({
          ...s,
          id: `applied-${String(s.position)}`,
          paidAt: null,
        })),
      )
    },
    [totalCents, issueDate],
  )
```

and `changeStages` drops its `setIsModified(true)`:

```ts
  const changeStages = useCallback((next: InvoiceStage[]) => {
    setDraft(next.map((s, i) => ({ ...s, position: i + 1 })))
  }, [])
```

Update the return object: remove `appliedScheduleId`, `isModified`, `saveAsSchedule`, `updateApplied`, `renameSchedule`; add `defaultSchedule` and the async wrappers:

```ts
  return {
    stages,
    setStages: changeStages,
    schedules: schedulesQuery.data ?? [],
    schedulesLoading: schedulesQuery.isLoading,
    schedulesError: schedulesQuery.error ? 'Could not load your saved schedules.' : null,
    defaultSchedule: (schedulesQuery.data ?? []).find((s) => s.isDefault) ?? null,
    validationError,
    applySchedule,
    markPaid: (stageId: string) => markPaidMutation.mutate(stageId),
    markPendingStageId: markPaidMutation.isPending ? (markPaidMutation.variables ?? null) : null,
    createSchedule: (input: { name: string; stages: TemplateStage[] }) =>
      createMutation.mutateAsync(input).then(() => undefined),
    updateSchedule: (input: { id: string; name?: string; stages?: TemplateStage[] }) =>
      updateMutation.mutateAsync(input).then(() => undefined),
    deleteSchedule: (id: string) => deleteMutation.mutateAsync(id).then(() => undefined),
    setDefaultSchedule: (id: string) => defaultMutation.mutateAsync(id).then(() => undefined),
    persist,
  }
```

Ensure `createSchedule`, `updateSchedule` are still imported from `@/app/(dashboard)/payments/schedule-actions` (they already are). Remove the now-unused module docstring reference to `saveAsMutation` if present (there is none).

- [ ] **Step 2: Update the `<PaymentSchedule>` call site**

In `components/builders/invoice-builder-modal.tsx`, replace the `<PaymentSchedule ... />` block (lines ~889-908) with the new props:

```tsx
          <PaymentSchedule
            canEdit={canEdit}
            stages={invoiceStages.stages}
            totalCents={Math.round(total * 100)}
            defaultSchedule={invoiceStages.defaultSchedule}
            schedules={invoiceStages.schedules}
            schedulesLoading={invoiceStages.schedulesLoading}
            schedulesError={invoiceStages.schedulesError}
            validationError={invoiceStages.validationError}
            markPendingStageId={invoiceStages.markPendingStageId}
            onStagesChange={(stages) => {
              invoiceStages.setStages(stages);
              setDirty(true);
            }}
            onApplySchedule={(schedule) => {
              invoiceStages.applySchedule(schedule);
              setDirty(true);
            }}
            onMarkPaid={invoiceStages.markPaid}
            onCreateSchedule={invoiceStages.createSchedule}
            onUpdateSchedule={invoiceStages.updateSchedule}
            onDeleteSchedule={invoiceStages.deleteSchedule}
            onSetDefaultSchedule={invoiceStages.setDefaultSchedule}
          />
```

(`setDirty(true)` is added to `onApplySchedule` because applying a schedule changes the invoice's stages and must mark the builder dirty, a role the removed footer links no longer cover.)

- [ ] **Step 3: Delete the picker and its test**

```bash
git rm components/builders/parts/schedule-picker.tsx tests/unit/components/builders/schedule-picker.test.tsx
```

- [ ] **Step 4: Typecheck, lint gate, and full unit run**

Run: `npm run typecheck && npm run typecheck:strict && npm run lint:gate && npm test`
Expected: base 0 errors; strict budget not exceeded; lint budget not exceeded; all unit tests green (no remaining reference to `schedule-picker`, `saveAsSchedule`, `updateApplied`, or `renameSchedule`).

- [ ] **Step 5: Ratchet the gate budgets if they dropped**

If deleting `schedule-picker.tsx` (a popover with raw controls) reduced the ESLint warning count or the strict-tsc count, lower the budgets in `scripts/lint-gate.mjs` and `scripts/typecheck-strict-gate.mjs` to lock the gain in, per the ratchet rule.

- [ ] **Step 6: Commit**

```bash
git add components/builders/parts/use-invoice-stages.ts components/builders/invoice-builder-modal.tsx scripts/lint-gate.mjs scripts/typecheck-strict-gate.mjs
git commit -m "feat(payments): wire schedule library modal into invoice builder"
```

---

## Task 9: Playwright flow + docs

**Files:**
- Create: `tests/e2e/payment-schedule-modal.spec.ts`
- Modify: `.claude/docs/component-library.md`, `.claude/docs/payments.md`, `.claude/docs/testing.md`

**Interfaces:**
- Consumes: the running app (Invoice builder reached from `/payments`). Follows the existing e2e selector conventions in `.claude/docs/testing.md`.

- [ ] **Step 1: Write the e2e flow**

Create `tests/e2e/payment-schedule-modal.spec.ts` covering, on the project's configured devices (desktop, Pixel 5, iPhone 12): open the invoice builder, apply the default schedule from the empty state, click Change to open the library, edit a schedule and Save (returns to the list), click the row to re-apply, and assert the invoice timeline reflects it and the running total reads "of" the invoice total. Model the file on an existing spec in `tests/e2e/` (match its fixture/auth setup and selector style, e.g. `getByRole('button', { name: /change/i })`).

```ts
// tests/e2e/payment-schedule-modal.spec.ts — skeleton; fill selectors from an
// existing payments spec's auth + navigation fixture.
import { expect, test } from '@playwright/test'

test('apply default, change schedule, edit, and reflect on the invoice', async ({ page }) => {
  // 1. Sign in + open the invoice builder (reuse the existing helper/fixture).
  // 2. Empty state: click the "Apply <default>" primary button.
  // 3. Assert stage rows render and the running total reads "of $<total>".
  // 4. Click "Change" → library modal (heading "Payment schedule").
  // 5. Overflow menu → Edit → change a day offset → Save → back to the list.
  // 6. Click the row to re-apply; assert the timeline reflects the change.
  await expect(page.getByRole('heading', { name: /payment schedule/i })).toBeVisible()
})
```

- [ ] **Step 2: Run the e2e flow**

Run: `npx playwright test tests/e2e/payment-schedule-modal.spec.ts`
Expected: PASS on all three devices.

> **Environment note:** `npm run dev` points at the REMOTE Supabase, and the `payment_schedules` tables ship in migration `20260730000000_create_payment_schedules.sql`, which only reaches remote via the CI `supabase db push` deploy. If the remote DB does not yet have these tables, run this spec against the isolated local-Supabase dev-server recipe (rsync + APFS clone against `supabase start`) rather than the user's dev server, per the project's live-verification memory. Do not point e2e at a DB missing the schema.

- [ ] **Step 3: Update the docs**

- `.claude/docs/component-library.md`: document the new parts (`schedule-library-modal`, `schedule-library-list`, `schedule-editor`, `schedule-template-row`, `payment-schedule` rewrite) and note `schedule-picker` was removed.
- `.claude/docs/payments.md`: describe the redesigned surface (explicit library vs local invoice, "Change" as the single door, running total, describeSchedule summaries) and that no schema/server-action changed.
- `.claude/docs/testing.md`: list the new unit specs and the e2e flow; note the removed `schedule-picker.test.tsx`.

- [ ] **Step 4: Full gate run**

Run: `npm test && npm run typecheck && npm run typecheck:strict && npm run lint:gate`
Expected: all green; budgets not exceeded.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/payment-schedule-modal.spec.ts .claude/docs/component-library.md .claude/docs/payments.md .claude/docs/testing.md
git commit -m "test(payments): e2e schedule modal flow; update docs"
```

---

## Self-Review

**Spec coverage:**

- Empty state (primary Apply-default, name + summary, "Choose another", "Add payment schedule" fallback) → Task 7.
- Applied state (Change door, resolved dollar beside percent via `PaymentStageRow`, always-visible running total with warning, paid stage no remove) → Tasks 6, 7.
- Drag-to-reorder restricted to unpaid → preserved in Task 7 (DnD) + existing `PaymentStageRow` disabled-on-paid logic.
- Modal list (rows apply + close, overflow Edit/Duplicate/Set-default/Delete, star, New schedule, describeSchedule summaries) → Tasks 4, 5.
- Editor (Back, Name, template rows, Add stage, Cancel/Save, Save writes library only, unsaved-changes guard, Save-disabled reasons) → Tasks 3, 5.
- Duplicate appends " copy", never default → Task 5 `duplicate`.
- Delete confirm + "invoices keep their stages" copy → Task 5 `ConfirmDialog`.
- Re-apply preserves paid stages note when `hasPaidStage` → Task 5.
- `describeSchedule` pure helper → Task 1.
- Data flow: expose `defaultSchedule`; library writes via existing actions + invalidate `['payment-schedules']` → Task 8.
- States: loading skeleton, empty library, load failure inline, save failure toast, invalid-template Save disabled with reason, resolver validation drives running-total warning → Tasks 5, 3, 7.
- Styling: `text-sm` content, `text-caption` meta only, tokens, primitives, `rounded-xl`, `strokeWidth={1.5}`, `cursor-pointer`, no boxes-in-boxes → all component tasks + Global Constraints.
- Components list + `schedule-picker.tsx` deletion → Tasks 1-8.
- Testing (describeSchedule cases, running total match/short/over, empty offers default by name, paid stage no remove, modal behaviours) → Tasks 1, 6, 7, 5; one Playwright flow → Task 9.
- Out of scope (event-date anchoring, Settings manager, reordering saved schedules, stageless-invoice status) → not implemented, correctly.

**Placeholder scan:** e2e spec (Task 9) is intentionally a skeleton because its auth/navigation fixture must be copied from an existing spec that this plan cannot see verbatim; Step 1 states exactly what to fill and where from. All other steps carry real code.

**Type consistency:** `describeSchedule(stages: TemplateStage[]): string` used identically in Tasks 4 and 7. Hook outputs in Task 8 (`defaultSchedule`, `createSchedule`, `updateSchedule`, `deleteSchedule`, `setDefaultSchedule`) match `PaymentScheduleProps` inputs in Task 7 one-to-one. `ScheduleEditor.onSave` payload `{ name, stages }` matches `ScheduleLibraryModal.save` which maps to `onCreate({ name, stages })` / `onUpdate({ id, ...input })`, matching the hook wrappers and the server actions' signatures.
