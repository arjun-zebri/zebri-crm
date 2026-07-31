/**
 * One row of the payment-schedule modal's timeline.
 *
 * Reads as a sentence: "<label>  <amount>  due <n> <unit> after issue". Every
 * number sits next to words so its meaning is unambiguous, and the amount type
 * and time unit are dropdowns rather than bare inputs. A paid stage is locked:
 * money has moved against it, so the only honest UI is read-only.
 *
 * @module components/builders/parts/schedule-stage-row
 */
'use client'

import { X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { OffsetUnit, StageAmountType } from '@/types/payment-schedule'
// A locked (paid) row is read-only; the resolved dollar amount lives on the
// invoice-surface timeline, not here, so this row shows shape only.

/** The editable shape of one timeline row. `paidAt` locks the row. */
export interface StageDraft {
  key: string
  label: string
  amountType: StageAmountType
  amountValue: number | null
  offsetValue: number
  offsetUnit: OffsetUnit
  paidAt: string | null
}

/** Fields a row edit can change. */
export type StageDraftPatch = Partial<Omit<StageDraft, 'key' | 'paidAt'>>

/** Props for {@link ScheduleStageRow}. */
export interface ScheduleStageRowProps {
  stage: StageDraft
  onChange: (patch: StageDraftPatch) => void
  onRemove: () => void
}

/** One editable (or locked) timeline row. See {@link ScheduleStageRowProps}. */
export function ScheduleStageRow({ stage, onChange, onRemove }: ScheduleStageRowProps) {
  const locked = stage.paidAt !== null
  const isRemainder = stage.amountType === 'remainder'

  return (
    <div className="relative">
      <span
        aria-hidden
        className={`absolute -left-[22px] top-2.5 inline-flex h-2.5 w-2.5 rounded-full ${
          locked ? 'bg-success' : 'border-2 border-brand-fg bg-surface'
        }`}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Input
          size="md"
          value={stage.label}
          onChange={(e) => onChange({ label: e.target.value })}
          aria-label="Stage label"
          className="w-28"
          disabled={locked}
        />
        <Select
          value={stage.amountType}
          onValueChange={(v) => {
            const amountType = v as StageAmountType
            onChange(
              amountType === 'remainder'
                ? { amountType, amountValue: null }
                : { amountType, amountValue: stage.amountValue ?? 0 },
            )
          }}
          aria-label="Amount type"
          disabled={locked}
          className="w-32"
          options={[
            { value: 'percent', label: '%' },
            { value: 'fixed', label: '$' },
            { value: 'remainder', label: 'Remaining balance' },
          ]}
        />
        {!isRemainder && (
          <Input
            size="md"
            type="number"
            min={0}
            value={stage.amountValue ?? ''}
            onChange={(e) =>
              onChange({ amountValue: e.target.value === '' ? null : Number(e.target.value) })
            }
            aria-label="Amount"
            className="w-16 [&_input]:[appearance:textfield]"
            disabled={locked}
          />
        )}
        <span className="text-caption text-text-muted">due</span>
        <Input
          size="md"
          type="number"
          min={0}
          value={String(stage.offsetValue)}
          onChange={(e) => onChange({ offsetValue: Number(e.target.value) || 0 })}
          aria-label="Offset amount"
          className="w-14 [&_input]:[appearance:textfield]"
          disabled={locked}
        />
        <Select
          value={stage.offsetUnit}
          onValueChange={(v) => onChange({ offsetUnit: v as OffsetUnit })}
          aria-label="Offset unit"
          disabled={locked}
          className="w-24"
          options={[
            { value: 'day', label: 'days' },
            { value: 'week', label: 'weeks' },
            { value: 'month', label: 'months' },
          ]}
        />
        <span className="text-caption text-text-muted">after issue</span>
        {locked ? (
          <span className="ml-auto text-caption text-success">Paid</span>
        ) : (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${stage.label}`}
            className="ml-auto cursor-pointer text-text-subtle transition-colors hover:text-danger"
          >
            <X size={15} strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  )
}
