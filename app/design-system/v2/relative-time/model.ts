import { span, type TimeUnit } from '../pages/dashboard/journeys/timing';

/**
 * The value the relative time picker edits: a span counted from one of
 * three anchors (the step before being done, or before or after the
 * wedding), or nothing at all until the MC sends it. An amount of 0
 * means "as soon as" (or "on the day" for the wedding).
 *
 * @module app/design-system/v2/relative-time/model
 */

export type Anchor = 'previous' | 'before' | 'after';

export type RelTime = { anchor: Anchor; amount: number; unit: TimeUnit } | { anchor: 'manual' };

/** What "the step before is done" reads as in the demos. */
export const DONE = 'they sign the contract';

/** The anchors as a short choice reads them. */
export const ANCHORS: Record<Anchor, string> = {
  previous: 'After they sign',
  before: 'Before the event',
  after: 'After the event',
};

/** The units each anchor offers: minutes only from the step before, months only around the wedding. */
export const UNITS: Record<Anchor, TimeUnit[]> = {
  previous: ['minutes', 'days', 'weeks'],
  before: ['days', 'weeks', 'months'],
  after: ['days', 'weeks', 'months'],
};

/** The sentence the step dialog would show: "3 days after they sign the contract". */
export function readout(t: RelTime): string {
  if (t.anchor === 'manual') return 'Only when you send it';
  if (t.anchor === 'previous') return t.amount ? `${span(t.amount, t.unit)} after ${DONE}` : `As soon as ${DONE}`;
  if (!t.amount) return 'On the day of the event';
  return `${span(t.amount, t.unit)} ${t.anchor} the event`;
}

/** Same time, compared by value. */
export const same = (a: RelTime, b: RelTime) => readout(a) === readout(b);
