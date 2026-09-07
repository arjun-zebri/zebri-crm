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
 * @module app/(dashboard)/workflows/[id]/timing-control
 */

import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { StepTiming } from '@/types/workflows'

/** The three anchors, in the order the select offers them. */
const MODE_OPTIONS = [
  { value: 'after_previous', label: 'After the step above' },
  { value: 'wedding_relative', label: 'Relative to the wedding date' },
  { value: 'apply_relative', label: 'After this workflow starts' },
]

const CHAIN_UNITS = [
  { value: 'hours', label: 'hours' },
  { value: 'days', label: 'days' },
]

const CALENDAR_UNITS = [
  { value: 'days', label: 'days' },
  { value: 'weeks', label: 'weeks' },
  { value: 'months', label: 'months' },
]

const DIRECTIONS = [
  { value: 'before', label: 'before the wedding' },
  { value: 'after', label: 'after the wedding' },
]

export interface TimingControlProps {
  value: StepTiming
  onChange: (next: StepTiming) => void
  /** Hidden for the first step of a workflow, which has nothing above it. */
  allowAfterPrevious?: boolean
}

/** Swap modes, keeping the number the MC already typed where it fits. */
function switchMode(current: StepTiming, mode: StepTiming['mode']): StepTiming {
  const amount =
    current.mode === 'after_previous' ? current.delayAmount : current.amount
  switch (mode) {
    case 'wedding_relative':
      return { mode, direction: 'before', amount, unit: 'weeks' }
    case 'apply_relative':
      return { mode, amount, unit: 'days' }
    case 'after_previous':
      // Hours only exist on this mode, and a "2 months" carried over from
      // a calendar mode would be nonsense as a chain delay.
      return { mode, delayAmount: amount, unit: 'days' }
  }
}

/**
 * The timing editor for one step. See {@link TimingControlProps}.
 *
 * Renders as a row of controls plus the sentence they produce, so the MC
 * reads back what they built rather than assembling it in their head.
 */
export function TimingControl({
  value,
  onChange,
  allowAfterPrevious = true,
}: TimingControlProps) {
  const amount = value.mode === 'after_previous' ? value.delayAmount : value.amount
  const modes = allowAfterPrevious
    ? MODE_OPTIONS
    : MODE_OPTIONS.filter((m) => m.value !== 'after_previous')

  /** Write a new amount, keeping the rest of the mode's shape intact. */
  function setAmount(next: number) {
    if (value.mode === 'after_previous') onChange({ ...value, delayAmount: next })
    else onChange({ ...value, amount: next })
  }

  /** Keep the unit inside the set its mode allows. */
  function setUnit(next: string) {
    if (value.mode === 'after_previous') {
      onChange({ ...value, unit: next === 'hours' ? 'hours' : 'days' })
      return
    }
    onChange({
      ...value,
      unit: next === 'weeks' || next === 'months' ? next : 'days',
    })
  }

  // One row, wrapping only where it has to: the anchor and the amount
  // are one sentence ("2 weeks before the wedding"), and stacking them
  // made a three-control question fill a modal. The amount and its unit
  // wrap as a pair - a "2" that has come away from its "weeks" is worse
  // than either arrangement.
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Select
        label="When"
        value={value.mode}
        options={modes}
        onValueChange={(next) => onChange(switchMode(value, next as StepTiming['mode']))}
        className="min-w-44 flex-1"
      />

      <div className="flex items-end gap-2">
        <Input
          type="number"
          min={0}
          aria-label="How many"
          value={String(amount)}
          onChange={(e) => setAmount(Math.max(0, Number(e.currentTarget.value) || 0))}
          className="w-16"
        />

        <Select
          ariaLabel="Unit"
          value={value.unit}
          options={value.mode === 'after_previous' ? CHAIN_UNITS : CALENDAR_UNITS}
          onValueChange={setUnit}
          className="w-28"
        />

        {value.mode === 'wedding_relative' ? (
          <Select
            ariaLabel="Before or after the wedding"
            value={value.direction}
            options={DIRECTIONS}
            onValueChange={(next) =>
              onChange({ ...value, direction: next === 'after' ? 'after' : 'before' })
            }
            className="w-44"
          />
        ) : null}
      </div>
    </div>
  )
}
