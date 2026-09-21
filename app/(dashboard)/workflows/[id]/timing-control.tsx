'use client'

/**
 * When a step comes due.
 *
 * The engine has supported three anchors since the schema was written,
 * and the builder had no way to set any of them, so every step ever
 * built on the canvas ran "straight after the one above". That made
 * "send the run sheet two weeks before the wedding", the single most
 * common thing a wedding MC schedules, impossible to express.
 *
 * The control leads with the anchor rather than the mode slug, because
 * that is how an MC talks: "six weeks out", "three days after they
 * book", "once I have called them".
 *
 * The rules behind each control (minute snapping, which units carry a
 * send time, what survives a mode switch) live in `./timing-units` so
 * they are tested without driving a Radix Select in jsdom.
 *
 * @module app/(dashboard)/workflows/[id]/timing-control
 */

import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { MINUTE_STEP } from '@/lib/workflows/timing-schema'
import type { StepTiming } from '@/types/workflows'

import { SendTimeSelect } from './send-time-select'
import {
  CALENDAR_UNITS,
  CHAIN_UNITS,
  DIRECTIONS,
  MODE_OPTIONS,
  START_UNITS,
  supportsSendTime,
  switchMode,
  withAmount,
  withUnit,
} from './timing-units'
import { useDraftNumber } from './use-draft-number'

export interface TimingControlProps {
  value: StepTiming
  onChange: (next: StepTiming) => void
  /** Hidden for the first step of a workflow, which has nothing above it. */
  allowAfterPrevious?: boolean
}

/**
 * The timing editor for one step. See {@link TimingControlProps}.
 *
 * Renders as one row of controls; the sentence they produce is shown on
 * the canvas card by the page, via `shortTiming`.
 */
export function TimingControl({ value, onChange, allowAfterPrevious = true }: TimingControlProps) {
  const amount = value.mode === 'after_previous' ? value.delayAmount : value.amount
  const modes = allowAfterPrevious ? MODE_OPTIONS : MODE_OPTIONS.filter((m) => m.value !== 'after_previous')
  const units =
    value.mode === 'after_previous' ? CHAIN_UNITS : value.mode === 'apply_relative' ? START_UNITS : CALENDAR_UNITS
  // Typed digits stay local until blur or Enter, so the parent (and the
  // schema's multiple-of-15 rule) only ever sees a snapped amount.
  const amountField = useDraftNumber(amount, `${value.mode}:${value.unit}`, (n) => onChange(withAmount(value, n)))

  // One row, wrapping only where it has to: the anchor and the amount are
  // one sentence ("2 weeks before the wedding"). The amount and its unit
  // wrap as a pair; a "2" that has come away from its "weeks" is worse
  // than either arrangement. "Send at" joins the pair when it applies.
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Select
        label="When"
        value={value.mode}
        options={modes}
        onValueChange={(next) => onChange(switchMode(value, next as StepTiming['mode']))}
        className="min-w-44 flex-1"
      />

      <div className="flex flex-wrap items-end gap-2">
        <Input
          type="number"
          min={value.unit === 'minutes' ? MINUTE_STEP : 0}
          step={value.unit === 'minutes' ? MINUTE_STEP : 1}
          aria-label="How many"
          {...amountField}
          className="w-16"
        />

        <Select
          ariaLabel="Unit"
          value={value.unit}
          options={units}
          onValueChange={(next) => onChange(withUnit(value, next))}
          className="w-28"
        />

        {value.mode === 'wedding_relative' ? (
          <Select
            ariaLabel="Before or after the wedding"
            value={value.direction}
            options={DIRECTIONS}
            onValueChange={(next) => onChange({ ...value, direction: next === 'after' ? 'after' : 'before' })}
            className="w-44"
          />
        ) : null}

        {supportsSendTime(value) ? <SendTimeSelect value={value} onChange={onChange} /> : null}
      </div>
    </div>
  )
}
