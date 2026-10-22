import type { JourneyStep, StepKind } from './journeys-data';

/**
 * When a journey step goes out, as data, and how to say it. A journey is
 * one client's way from first enquiry to thank you, so a step only ever
 * counts from one of four things:
 *
 * - `start`: the journey itself starting, when a new enquiry comes in.
 *   Only the first step can use it.
 * - `previous`: the step before it being done, right away or a set time
 *   later. "Done" depends on what that step was: a proposal accepted, a
 *   contract signed, an invoice paid, a questionnaire finished. This is
 *   what keeps a journey in order: a contract never goes before the
 *   proposal it follows is accepted.
 * - `wedding`: a set time before or after the wedding day.
 * - `manual`: nothing goes out until the MC sends it from the client.
 *
 * Labels are worked out from the step before, never stored, so moving a
 * step rewords it ("As soon as they sign the contract" becomes "As soon
 * as they pay the deposit" when it moves under the deposit).
 *
 * @module app/design-system/v2/pages/dashboard/journeys/timing
 */

/** `minutes` only counts from the step before ("20 minutes after"); everything timed from the event is days or longer. */
export type TimeUnit = 'minutes' | 'days' | 'weeks' | 'months';

export type Timing =
  | { at: 'start' }
  | { at: 'previous'; amount?: number | undefined; unit?: TimeUnit | undefined }
  | { at: 'wedding'; side: 'before' | 'after'; amount: number; unit: TimeUnit }
  | { at: 'manual' };

/** "1 weeks" reads wrong: one drops the plural. */
export const span = (amount: number, unit: TimeUnit) => `${amount} ${amount === 1 ? unit.slice(0, -1) : unit}`;

/** What the client does to finish a step, mid-sentence after "they". */
const DONE: Partial<Record<StepKind, (s: JourneyStep) => string>> = {
  proposal: () => 'accept the proposal',
  contract: () => 'sign the contract',
  invoice: (s) => `pay the ${s.name.toLowerCase()}`,
  questionnaire: () => 'finish the questionnaire',
  runSheet: () => 'approve the run sheet',
};

/** The step before, being done: "they sign the contract", or "the enquiry reply goes out" for an email. */
export function doneOf(prev: JourneyStep) {
  if (prev.kind === 'day') return 'the event';
  if (prev.kind === 'todo') return `you tick off "${prev.detail}"`;
  const done = DONE[prev.kind];
  return done ? `they ${done(prev)}` : `the ${prev.name.toLowerCase()} goes out`;
}

/** The short word beside the line for "previous" with no delay: "Once signed". */
const ONCE: Partial<Record<StepKind, string>> = {
  proposal: 'Once accepted',
  contract: 'Once signed',
  invoice: 'Once paid',
  questionnaire: 'Once finished',
  runSheet: 'Once approved',
  todo: 'Once done',
};

/**
 * A step's timing. Journeys saved before timing was data kept it in
 * words (`when`); those read back here, so nobody's journey breaks.
 */
export function timingOf(step: JourneyStep): Timing {
  if (step.timing) return step.timing;
  const w = step.when ?? '';
  if (w === 'On enquiry') return { at: 'start' };
  if (w === 'When you send it') return { at: 'manual' };
  const m = /^(\d+) (day|week|month)s? (before|after)/.exec(w);
  if (m && !w.includes('last step')) return { at: 'wedding', side: m[3] as 'before' | 'after', amount: Number(m[1]), unit: `${m[2]}s` as TimeUnit };
  return { at: 'previous' };
}

/** The full sentence, for the step dialog: "As soon as they sign the contract", "8 weeks before the event". */
export function timingLabel(t: Timing, prev: JourneyStep | undefined): string {
  switch (t.at) {
    case 'start':
      return 'As soon as they enquire';
    case 'manual':
      return 'Only when you send it';
    case 'wedding':
      return `${span(t.amount, t.unit)} ${t.side} the event`;
    case 'previous':
      if (!prev) return 'As soon as they enquire';
      return t.amount && t.unit ? `${span(t.amount, t.unit)} after ${doneOf(prev)}` : `As soon as ${doneOf(prev)}`;
  }
}

/** The few words beside the journey's line: "Once signed", "3 days after", "8 weeks before". */
export function shortTiming(t: Timing, prev: JourneyStep | undefined): string {
  switch (t.at) {
    case 'start':
      return 'On enquiry';
    case 'manual':
      return 'When you send it';
    case 'wedding':
      return `${span(t.amount, t.unit)} ${t.side}`;
    case 'previous':
      if (!prev) return 'On enquiry';
      if (t.amount && t.unit) return `${span(t.amount, t.unit)} after`;
      return ONCE[prev.kind] ?? 'Right after';
  }
}
