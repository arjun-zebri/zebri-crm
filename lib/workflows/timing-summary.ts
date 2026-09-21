/**
 * How a step's timing reads in the MC's own words.
 *
 * One module so the canvas chip, the inspector, the couple's checklist,
 * the dry run and the AI copilot all phrase a {@link StepTiming} the same
 * way. An MC thinks in wedding-relative time ("six weeks out"), so the
 * wording leads with the anchor, not the mode slug.
 *
 * @module lib/workflows/timing-summary
 */

import { DEFAULT_STEP_TIMING, type StepTiming } from '@/types/workflows';

import { SEND_TIME_PATTERN } from './timing-schema';

/** Singular or plural unit word for an amount. */
function plural(amount: number, unit: string): string {
  const n = Math.abs(amount);
  return `${n} ${n === 1 ? unit : `${unit}s`}`;
}

/** Maps unit to short form for chips, disambiguating minutes and months. */
const UNIT_SHORT_MAP: Record<StepTiming['unit'], string> = {
  minutes: 'm',
  hours: 'h',
  days: 'd',
  weeks: 'w',
  months: 'mo',
};

/**
 * `HH:MM` as an MC says it: `9:15am`, `1:00pm`, `12:00am`.
 *
 * Minutes are always shown, even `:00`, so a column of times lines up.
 */
export function formatSendTime(time: string): string {
  const [hh, mm] = time.split(':');
  const h = Number(hh);
  const suffix = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm}${suffix}`;
}

/** The " at 9:15am" tail, or nothing. */
function atTime(timing: StepTiming): string {
  return timing.mode !== 'after_previous' && timing.sendTime ? ` at ${formatSendTime(timing.sendTime)}` : '';
}

/** The ", 9:15am" tail for the chip, or nothing. */
function chipTime(timing: StepTiming): string {
  return timing.mode !== 'after_previous' && timing.sendTime ? `, ${formatSendTime(timing.sendTime)}` : '';
}

/**
 * Coerce stored jsonb into a {@link StepTiming}.
 *
 * A step saved before a mode existed, or by a hand-written migration,
 * must still render. Anything unrecognised reads as the default rather
 * than crashing the row it appears in.
 */
export function toStepTiming(raw: unknown): StepTiming {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_STEP_TIMING;
  const value = raw as Record<string, unknown>;
  const amount = typeof value['amount'] === 'number' ? Math.abs(value['amount']) : 0;
  const delay = typeof value['delayAmount'] === 'number' ? Math.abs(value['delayAmount']) : 0;
  const unit = typeof value['unit'] === 'string' ? value['unit'] : '';
  const calendarUnit = unit === 'weeks' || unit === 'months' ? unit : 'days';
  const delayUnit = unit === 'minutes' || unit === 'hours' ? unit : 'days';
  // A send time only survives on a calendar unit and on the grid; anything
  // else is dropped so the row still renders with the rest of its timing.
  const sendTime =
    typeof value['sendTime'] === 'string' &&
    SEND_TIME_PATTERN.test(value['sendTime']) &&
    !(unit === 'minutes' || unit === 'hours')
      ? { sendTime: value['sendTime'] }
      : {};

  switch (value['mode']) {
    case 'wedding_relative':
      return {
        mode: 'wedding_relative',
        direction: value['direction'] === 'after' ? 'after' : 'before',
        amount,
        unit: calendarUnit,
        ...sendTime,
      };
    case 'apply_relative':
      return {
        mode: 'apply_relative',
        amount,
        unit: unit === 'minutes' || unit === 'hours' ? unit : calendarUnit,
        ...sendTime,
      };
    case 'after_previous':
      return { mode: 'after_previous', delayAmount: delay, unit: delayUnit };
    default:
      return DEFAULT_STEP_TIMING;
  }
}

/**
 * The full sentence, for the inspector and the dry run.
 *
 * @example "2 weeks before the wedding"
 * @example "3 days after the workflow starts"
 * @example "Straight after the step above"
 */
export function describeTiming(timing: StepTiming): string {
  switch (timing.mode) {
    case 'wedding_relative':
      return timing.amount === 0
        ? `On the wedding day${atTime(timing)}`
        : `${plural(timing.amount, timing.unit.replace(/s$/, ''))} ${timing.direction} the wedding${atTime(timing)}`;
    case 'apply_relative':
      return timing.amount === 0
        ? `The day this workflow starts${atTime(timing)}`
        : `${plural(timing.amount, timing.unit.replace(/s$/, ''))} after the workflow starts${atTime(timing)}`;
    case 'after_previous':
      return timing.delayAmount === 0
        ? 'Straight after the step above'
        : `${plural(timing.delayAmount, timing.unit.replace(/s$/, ''))} after the step above`;
  }
}

/**
 * The compact form, for a chip on a canvas node or a checklist row.
 *
 * Drops the "after the step above" tail, which is the default and would
 * otherwise repeat on nearly every node.
 */
export function shortTiming(timing: StepTiming): string {
  const unitShort = UNIT_SHORT_MAP[timing.unit];
  switch (timing.mode) {
    case 'wedding_relative':
      return timing.amount === 0
        ? `Wedding day${chipTime(timing)}`
        : `${timing.amount}${unitShort} ${timing.direction} wedding${chipTime(timing)}`;
    case 'apply_relative':
      return timing.amount === 0
        ? `On start${chipTime(timing)}`
        : `${timing.amount}${unitShort} after start${chipTime(timing)}`;
    case 'after_previous':
      return timing.delayAmount === 0
        ? 'After previous'
        : `+${timing.delayAmount}${unitShort}`;
  }
}

/**
 * Is this the timing every step gets when nothing was chosen?
 *
 * The canvas hides the chip for the default so a workflow with no
 * deliberate scheduling does not read as if every step were configured.
 */
export function isDefaultTiming(timing: StepTiming): boolean {
  return timing.mode === 'after_previous' && timing.delayAmount === 0;
}
