/**
 * A Wait step has one number: how long it waits.
 *
 * Every step carries a generic start timing ("When: after the step above,
 * 2 days"), and a Wait also carries its own duration ("wait 1 day"). The
 * engine honoured both, one after the other, so the real delay was their
 * sum and the card showed two unrelated numbers. A Wait now always starts
 * straight after the step above ({@link WAIT_TIMING}), and anything that
 * would give it a start offset is folded into its duration instead, so
 * the total delay is unchanged. "Ask me before this runs" is cleared too:
 * a Wait sends nothing, so there is nothing to review.
 *
 * {@link normalizeWaitStep} is the one rule. The builder save, the step
 * card, and the AI copilot all run it, and the data fix
 * `20261024500000_workflow_wait_single_delay.sql` mirrors it in SQL
 * (`public._workflow_fold_wait_config`). A change to one is a change to
 * both.
 *
 * Pure and client-safe: no React, no database, no server-only imports,
 * because the step card uses it to show the folded duration.
 *
 * @module lib/workflows/wait-step
 */

import { DEFAULT_STEP_TIMING, type StepTiming } from '@/types/workflows';

/** The only timing a Wait has: straight after the step above. */
export const WAIT_TIMING: StepTiming = DEFAULT_STEP_TIMING;

/** The longest wait the runner's schema accepts (a year), in minutes. */
export const WAIT_MAX_MINUTES = 525_600;

/**
 * Minutes per timing unit. A month is 30 days: a start offset in months
 * has no exact length, and 30 days is the closest single number.
 */
const MINUTES_PER_UNIT: Record<string, number> = {
  minutes: 1,
  hours: 60,
  days: 60 * 24,
  weeks: 60 * 24 * 7,
  months: 60 * 24 * 30,
};

/** The units a `relative_to_event` wait can store, largest first. */
const RELATIVE_UNITS = ['weeks', 'days', 'hours', 'minutes'] as const;

/** A non-negative whole number read off a jsonb field, else 0. */
function wholeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

/** Minutes for `amount` of `unit`, or 0 for a unit the timing model lacks. */
function toMinutes(amount: unknown, unit: unknown): number {
  const per = typeof unit === 'string' ? MINUTES_PER_UNIT[unit] : undefined;
  return per === undefined ? 0 : wholeNumber(amount) * per;
}

/** The largest relative unit that divides `minutes` exactly. */
function relativeParts(minutes: number): { amount: number; unit: (typeof RELATIVE_UNITS)[number] } {
  for (const unit of RELATIVE_UNITS) {
    const per = MINUTES_PER_UNIT[unit]!;
    if (minutes >= per && minutes % per === 0) return { amount: minutes / per, unit };
  }
  return { amount: minutes, unit: 'minutes' };
}

/**
 * Is this the timing every Wait should have? Anything else is folded.
 *
 * @param timing - the stored or sent timing, unparsed
 */
export function isWaitTiming(timing: unknown): boolean {
  if (typeof timing !== 'object' || timing === null) return true;
  const t = timing as Record<string, unknown>;
  return t['mode'] === 'after_previous' && wholeNumber(t['delayAmount']) === 0;
}

/**
 * The wait config once the start timing has been folded into it.
 *
 * - A **duration** wait that started after a delay (`after_previous`, or
 *   `apply_relative`, which counts from the start of the workflow) waits
 *   that much longer instead, capped at {@link WAIT_MAX_MINUTES}.
 * - A **duration** wait anchored to the wedding date (`wedding_relative`)
 *   becomes a "Relative date" wait (`relative_to_event`) whose offset is the anchor
 *   plus the duration: the moment it ends is the same.
 * - A **date** wait (`until_date`, `relative_to_event`) is left alone:
 *   it ends on its own date whenever it starts, so a start offset only
 *   ever mattered when it ran past that date.
 *
 * @param config - the wait's config, unparsed
 * @param timing - the start timing being dropped, unparsed
 * @returns a new config object; the input is never mutated
 */
export function foldWaitConfig(config: unknown, timing: unknown): Record<string, unknown> {
  const base = { ...((config ?? {}) as Record<string, unknown>) };
  if (isWaitTiming(timing) || base['mode'] !== 'duration') return base;
  const t = timing as Record<string, unknown>;
  const duration = wholeNumber(base['durationMinutes']);

  if (t['mode'] === 'wedding_relative') {
    const sign = t['direction'] === 'after' ? 1 : -1;
    const signed = sign * toMinutes(t['amount'], t['unit']) + duration;
    const rest = { ...base };
    delete rest['durationMinutes'];
    return {
      ...rest,
      mode: 'relative_to_event',
      relative: {
        ...relativeParts(Math.abs(signed)),
        direction: signed >= 0 ? 'after' : 'before',
        anchor: 'event_date',
      },
    };
  }

  const offset =
    t['mode'] === 'after_previous'
      ? toMinutes(t['delayAmount'], t['unit'])
      : t['mode'] === 'apply_relative'
        ? toMinutes(t['amount'], t['unit'])
        : 0;
  return { ...base, durationMinutes: Math.min(WAIT_MAX_MINUTES, Math.max(1, duration + offset)) };
}

/** The parts of a step save that {@link normalizeWaitStep} may rewrite. */
export interface WaitStepSave {
  /** The stored step type (`wait`, `action`, `branch`, ...). */
  type: string;
  config: Record<string, unknown>;
  /** The start timing being saved, or undefined when the save omits it. */
  timing?: unknown;
  /** The review flag being saved, or undefined when the save omits it. */
  requiresApproval?: boolean;
}

/**
 * Normalise a step save so a Wait never lands with a start offset or a
 * review flag. Every other step type comes back untouched.
 *
 * A Wait's timing is folded into its config ({@link foldWaitConfig}) and
 * replaced with {@link WAIT_TIMING}; its review flag, when the save sets
 * one, becomes false. A save that omits timing leaves the stored timing
 * alone rather than zeroing an offset it cannot fold.
 *
 * @param save - the step as it is about to be written
 * @returns the step to write instead
 */
export function normalizeWaitStep<T extends WaitStepSave>(save: T): T {
  if (save.type !== 'wait') return save;
  const next: T = { ...save };
  if (save.timing !== undefined) {
    next.config = foldWaitConfig(save.config, save.timing);
    next.timing = WAIT_TIMING;
  }
  if (save.requiresApproval !== undefined) next.requiresApproval = false;
  return next;
}
