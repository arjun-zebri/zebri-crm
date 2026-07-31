/**
 * One row of the payment-schedule modal's timeline.
 *
 * A four-column grid (dot · name · amount · due) so every row lines up with its
 * neighbours and the column header, with fixed control widths so nothing wraps.
 * The amount type and time unit are dropdowns, never bare inputs. A paid stage
 * is locked: money has moved against it, so the only honest UI is read-only.
 *
 * @module components/builders/parts/schedule-stage-row
 */
'use client'

import { X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { OffsetUnit, StageAmountType } from '@/types/payment-schedule'

/**
 * Shared column template for the header + every row on `sm+`. Below `sm` the
 * row stacks (see the row's own classes), so this grid only applies at `sm`.
 */
export const STAGE_ROW_GRID =
  'sm:grid sm:grid-cols-[0.6rem_minmax(0,1fr)_11.5rem_11rem] sm:items-center sm:gap-2.5'

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
    <div
      className={`flex flex-col gap-2 border-b border-border pb-3 last:border-0 sm:border-0 sm:pb-0 ${STAGE_ROW_GRID}`}
    >
      <span
        aria-hidden
        className={`hidden h-2 w-2 justify-self-center rounded-full sm:block ${
          locked ? 'bg-success' : 'border-2 border-brand-fg bg-surface'
        }`}
      />

      <Input
        size="md"
        value={stage.label}
        onChange={(e) => onChange({ label: e.target.value })}
        aria-label="Stage label"
        className="min-w-0"
        disabled={locked}
      />

      {/* Amount: type select + value input (hidden for a remainder). */}
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-caption text-text-muted sm:hidden">Amount</span>
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
          className="w-[7.25rem] shrink-0"
          options={[
            { value: 'percent', label: '%' },
            { value: 'fixed', label: '$' },
            { value: 'remainder', label: 'Remainder' },
          ]}
        />
        {isRemainder ? (
          <span className="w-14" />
        ) : (
          <Input
            size="md"
            type="number"
            min={0}
            value={stage.amountValue ?? ''}
            onChange={(e) =>
              onChange({ amountValue: e.target.value === '' ? null : Number(e.target.value) })
            }
            aria-label="Amount"
            className="w-14 shrink-0 [&_input]:[appearance:textfield]"
            disabled={locked}
          />
        )}
      </div>

      {/* Due offset: value + unit, with the remove control trailing. */}
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-caption text-text-muted sm:hidden">Due after</span>
        <Input
          size="md"
          type="number"
          min={0}
          value={String(stage.offsetValue)}
          onChange={(e) => onChange({ offsetValue: Number(e.target.value) || 0 })}
          aria-label="Offset amount"
          className="w-12 shrink-0 [&_input]:[appearance:textfield]"
          disabled={locked}
        />
        <Select
          value={stage.offsetUnit}
          onValueChange={(v) => onChange({ offsetUnit: v as OffsetUnit })}
          aria-label="Offset unit"
          disabled={locked}
          className="w-[5.5rem] shrink-0"
          options={[
            { value: 'day', label: 'days' },
            { value: 'week', label: 'weeks' },
            { value: 'month', label: 'months' },
          ]}
        />
        {locked ? (
          <span className="w-5" aria-hidden />
        ) : (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${stage.label}`}
            className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center text-text-subtle transition-colors hover:text-danger"
          >
            <X size={15} strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  )
}
