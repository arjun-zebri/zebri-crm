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
          className="w-20"
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
          className="w-16"
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
