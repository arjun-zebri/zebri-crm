/**
 * Option lists and pure state transitions for {@link TimingControl}.
 *
 * Kept out of the component so the rules ("minutes snap to 15", "a send
 * time only rides on a calendar unit", "switching mode drops what no
 * longer fits") are unit-tested without a Radix Select, which cannot be
 * driven in jsdom.
 *
 * @module app/(dashboard)/workflows/[id]/timing-units
 */
import { MAX_AMOUNT, MINUTE_STEP } from '@/lib/workflows/timing-schema'
import { formatSendTime } from '@/lib/workflows/timing-summary'
import type { CalendarUnit, DelayUnit, StepTiming } from '@/types/workflows'

/** The three anchors, in the order the select offers them. */
export const MODE_OPTIONS = [
  { value: 'after_previous', label: 'After the step above' },
  { value: 'wedding_relative', label: 'Relative to the wedding date' },
  { value: 'apply_relative', label: 'After this workflow starts' },
]

/** Units a chained ("after the step above") delay accepts. */
export const CHAIN_UNITS = [
  { value: 'minutes', label: 'minutes' },
  { value: 'hours', label: 'hours' },
  { value: 'days', label: 'days' },
]

/** Units a wedding-relative step accepts. */
export const CALENDAR_UNITS = [
  { value: 'days', label: 'days' },
  { value: 'weeks', label: 'weeks' },
  { value: 'months', label: 'months' },
]

/** "After this workflow starts" takes both delay and calendar units. */
export const START_UNITS = [...CHAIN_UNITS.slice(0, 2), ...CALENDAR_UNITS]

/** Which side of the wedding date a wedding-relative step lands on. */
export const DIRECTIONS = [
  { value: 'before', label: 'before the wedding' },
  { value: 'after', label: 'after the wedding' },
]

/** The shared Select cannot take `value=""`, so "no time" is a sentinel. */
export const NO_SEND_TIME = 'none'

/** "Start of day" plus every quarter hour, labelled as an MC reads it. */
export const SEND_TIME_OPTIONS: { value: string; label: string }[] = [
  { value: NO_SEND_TIME, label: 'Start of day' },
  ...Array.from({ length: 96 }, (_, i) => {
    const hh = String(Math.floor(i / 4)).padStart(2, '0')
    const mm = String((i % 4) * MINUTE_STEP).padStart(2, '0')
    const value = `${hh}:${mm}`
    return { value, label: formatSendTime(value) }
  }),
]

const SUB_DAY = new Set(['minutes', 'hours'])

/**
 * The largest multiple of {@link MINUTE_STEP} at or under {@link MAX_AMOUNT}
 * (990). Snapping up to the next 15-minute step can otherwise land past
 * the schema's max (e.g. 995 snaps to 1005), which is exactly the value
 * the UI must never be able to produce.
 */
const MAX_MINUTES = Math.floor(MAX_AMOUNT / MINUTE_STEP) * MINUTE_STEP

/** Can this timing carry a `sendTime`? Calendar-unit date-relative only. */
export function supportsSendTime(t: StepTiming): boolean {
  return t.mode !== 'after_previous' && !SUB_DAY.has(t.unit)
}

/** The number the MC typed, whatever the mode calls it. */
function amountOf(t: StepTiming): number {
  return t.mode === 'after_previous' ? t.delayAmount : t.amount
}

/** Minutes live on the tick's grid: round, never offer zero, cap at {@link MAX_MINUTES}. */
function snapMinutes(n: number): number {
  return Math.min(MAX_MINUTES, Math.max(MINUTE_STEP, Math.round(n / MINUTE_STEP) * MINUTE_STEP))
}

/**
 * Drop `sendTime` without ever writing `undefined` (strict optional types).
 *
 * Rebuilt field by field rather than rest-destructured: the omitted key
 * would otherwise be an unused binding, and a spread-then-delete cannot be
 * typed against the union.
 */
function stripSendTime(t: StepTiming): StepTiming {
  if (t.mode === 'after_previous' || t.sendTime === undefined) return t
  return t.mode === 'wedding_relative'
    ? { mode: t.mode, direction: t.direction, amount: t.amount, unit: t.unit }
    : { mode: t.mode, amount: t.amount, unit: t.unit }
}

/** Swap modes, keeping the number the MC already typed where it fits. */
export function switchMode(current: StepTiming, mode: StepTiming['mode']): StepTiming {
  const amount = amountOf(current)
  switch (mode) {
    case 'wedding_relative':
      return { mode, direction: 'before', amount, unit: 'weeks' }
    case 'apply_relative':
      return { mode, amount, unit: 'days' }
    case 'after_previous':
      // Only days survive a mode switch: "2 months" as a chain delay is
      // nonsense, and minutes from a calendar mode cannot happen.
      return { mode, delayAmount: amount, unit: 'days' }
  }
}

/**
 * Write a new amount, snapping to the grid when the unit is minutes.
 *
 * Clamped and rounded so this never hands the schema a value it refuses
 * (a pasted or scrolled-past-bounds number, decimals from a fractional
 * input step): non-minutes round to the nearest integer and clamp to
 * {@link MAX_AMOUNT}; minutes go through {@link snapMinutes}, which
 * already clamps to {@link MAX_MINUTES}.
 */
export function withAmount(current: StepTiming, next: number): StepTiming {
  const n = current.unit === 'minutes' ? snapMinutes(next) : Math.min(MAX_AMOUNT, Math.max(0, Math.round(next)))
  return current.mode === 'after_previous' ? { ...current, delayAmount: n } : { ...current, amount: n }
}

/** Change the unit inside what the mode allows; a sub-day unit drops the send time. */
export function withUnit(current: StepTiming, unit: string): StepTiming {
  switch (current.mode) {
    case 'after_previous': {
      const u: DelayUnit = unit === 'minutes' || unit === 'hours' ? unit : 'days'
      return { ...current, unit: u, delayAmount: u === 'minutes' ? snapMinutes(current.delayAmount) : current.delayAmount }
    }
    case 'apply_relative': {
      const u: DelayUnit | CalendarUnit =
        unit === 'minutes' || unit === 'hours' || unit === 'weeks' || unit === 'months' ? unit : 'days'
      const next = { ...current, unit: u, amount: u === 'minutes' ? snapMinutes(current.amount) : current.amount }
      return SUB_DAY.has(u) ? stripSendTime(next) : next
    }
    case 'wedding_relative': {
      const u: CalendarUnit = unit === 'weeks' || unit === 'months' ? unit : 'days'
      return { ...current, unit: u }
    }
  }
}

/** Set or clear the send time; ignored where the mode cannot carry one. */
export function withSendTime(current: StepTiming, time: string | null): StepTiming {
  if (!supportsSendTime(current)) return stripSendTime(current)
  if (current.mode === 'after_previous') return current
  return time ? { ...current, sendTime: time } : stripSendTime(current)
}
