/**
 * One row of the payment-schedule modal's timeline.
 *
 * Pared back to the three things a stage needs: its name, its share, and when
 * it falls due. The share unit (% or $) and the timing anchor are global to the
 * schedule, set above the timeline, so a row carries no type dropdowns of its
 * own. A stage flagged as the remainder shows "rest" instead of a share input.
 * A paid stage is locked: money has moved against it.
 *
 * @module components/builders/parts/schedule-stage-row
 */
'use client'

import { X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { OffsetAnchor, OffsetUnit, StageAmountType } from '@/types/payment-schedule'

/** Shared column template so the header and every row align on `sm+`. */
export const STAGE_ROW_GRID =
  'sm:grid sm:grid-cols-[0.5rem_minmax(0,1fr)_4.75rem_8.5rem_0.9rem] sm:items-center sm:gap-2'

// Hide the native number-input spinners in every engine: `appearance: textfield`
// covers Firefox, the `-webkit-*-spin-button` rules cover Chrome/Safari.
const NO_SPINNER =
  '[&_input]:[appearance:textfield] [&_input::-webkit-inner-spin-button]:appearance-none [&_input::-webkit-outer-spin-button]:appearance-none'

/** The editable shape of one timeline row. `paidAt` locks the row. */
export interface StageDraft {
  key: string
  label: string
  amountType: StageAmountType
  amountValue: number | null
  offsetValue: number
  offsetUnit: OffsetUnit
  offsetAnchor: OffsetAnchor
  paidAt: string | null
}

/** Fields a row edit can change. */
export type StageDraftPatch = Partial<Pick<StageDraft, 'label' | 'amountValue' | 'offsetValue' | 'offsetUnit'>>

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
  const unit = stage.amountType === 'fixed' ? '$' : '%'

  return (
    <div
      className={`flex flex-col gap-1.5 border-b border-border pb-2.5 last:border-0 sm:border-0 sm:pb-0 ${STAGE_ROW_GRID}`}
    >
      <span
        aria-hidden
        className={`hidden h-1.5 w-1.5 justify-self-center rounded-pill sm:block ${
          locked ? 'bg-success' : 'border-2 border-brand-fg bg-surface'
        }`}
      />

      <Input
        value={stage.label}
        onChange={(e) => onChange({ label: e.target.value })}
        aria-label="Stage label"
        className="min-w-0"
        disabled={locked}
      />

      {/* Amount: a value with its global unit, or "rest" for the remainder.
          The "rest" box matches the amount input width so it lines up with the
          numeric shares above it. */}
      <div className="flex items-center gap-1">
        <span className="sm:hidden text-body text-text-muted">Amount</span>
        {isRemainder ? (
          <span className="flex h-8 w-14 items-center justify-center rounded-control border border-dashed border-border text-body text-text-muted">
            Rest
          </span>
        ) : (
          <>
            <Input
              type="number"
              min={0}
              value={stage.amountValue ?? ''}
              onChange={(e) =>
                onChange({ amountValue: e.target.value === '' ? null : Number(e.target.value) })
              }
              aria-label="Amount"
              className={`w-14 ${NO_SPINNER}`}
              disabled={locked}
            />
            <span className="text-body text-text-muted">{unit}</span>
          </>
        )}
      </div>

      {/* Due offset: value + unit. */}
      <div className="flex items-center gap-1.5">
        <span className="sm:hidden text-body text-text-muted">Due</span>
        <Input
          type="number"
          min={0}
          value={String(stage.offsetValue)}
          onChange={(e) => onChange({ offsetValue: Number(e.target.value) || 0 })}
          aria-label="Offset amount"
          className={`w-12 ${NO_SPINNER}`}
          disabled={locked}
        />
        <Select
          value={stage.offsetUnit}
          onValueChange={(v) => onChange({ offsetUnit: v as OffsetUnit })}
          aria-label="Offset unit"
          disabled={locked}
          className="w-[4.75rem]"
          options={[
            { value: 'day', label: 'days' },
            { value: 'week', label: 'weeks' },
            { value: 'month', label: 'months' },
          ]}
        />
      </div>

      {locked ? (
        <span className="hidden w-5 sm:block" aria-hidden />
      ) : (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${stage.label}`}
          className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center self-start text-text-subtle transition-colors hover:text-danger sm:self-center sm:justify-self-center"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      )}
    </div>
  )
}
