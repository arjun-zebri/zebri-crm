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

/** Singular or plural unit word for an amount. */
function plural(amount: number, unit: string): string {
  const n = Math.abs(amount);
  return `${n} ${n === 1 ? unit : `${unit}s`}`;
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
  const amount = typeof value['amount'] === 'number' ? value['amount'] : 0;
  const delay = typeof value['delayAmount'] === 'number' ? value['delayAmount'] : 0;

  switch (value['mode']) {
    case 'wedding_relative':
      return {
        mode: 'wedding_relative',
        direction: value['direction'] === 'after' ? 'after' : 'before',
        amount: Math.abs(amount),
        unit:
          value['unit'] === 'weeks' || value['unit'] === 'months'
            ? value['unit']
            : 'days',
      };
    case 'apply_relative':
      return {
        mode: 'apply_relative',
        amount: Math.abs(amount),
        unit:
          value['unit'] === 'weeks' || value['unit'] === 'months'
            ? value['unit']
            : 'days',
      };
    case 'after_previous':
      return {
        mode: 'after_previous',
        delayAmount: Math.abs(delay),
        unit: value['unit'] === 'hours' ? 'hours' : 'days',
      };
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
        ? 'On the wedding day'
        : `${plural(timing.amount, timing.unit.replace(/s$/, ''))} ${timing.direction} the wedding`;
    case 'apply_relative':
      return timing.amount === 0
        ? 'The day this workflow starts'
        : `${plural(timing.amount, timing.unit.replace(/s$/, ''))} after the workflow starts`;
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
  switch (timing.mode) {
    case 'wedding_relative':
      return timing.amount === 0
        ? 'Wedding day'
        : `${timing.amount}${timing.unit[0]} ${timing.direction} wedding`;
    case 'apply_relative':
      return timing.amount === 0
        ? 'On start'
        : `${timing.amount}${timing.unit[0]} after start`;
    case 'after_previous':
      return timing.delayAmount === 0
        ? 'After previous'
        : `+${timing.delayAmount}${timing.unit[0]}`;
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
