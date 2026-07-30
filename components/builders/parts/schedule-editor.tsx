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
  /** Existing schedule to edit, or null for a new one. */
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
  // Initial keys are index-derived so the initializer never reads the ref
  // during render; the ref counter only issues keys for stages added later,
  // from event handlers, where reading it is safe.
  const [stages, setStages] = useState<DraftStage[]>(() =>
    (schedule?.stages ?? []).map((s, i) => ({ ...s, key: `init-${String(i)}` })),
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
            onSave({
              name: name.trim(),
              // Strip the internal list key back to a plain TemplateStage.
              stages: stages.map((s) => ({
                label: s.label,
                amountType: s.amountType,
                amountValue: s.amountValue,
                dueOffsetDays: s.dueOffsetDays,
              })),
            })
          }
        >
          Save
        </Button>
      </div>
    </div>
  )
}
