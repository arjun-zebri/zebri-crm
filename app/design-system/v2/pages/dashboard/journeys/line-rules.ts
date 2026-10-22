import { eventParts, type Journey, type JourneyStep } from './journeys-data';
import { shortTiming, timingOf } from './timing';

/**
 * Readings of a journey's line that the page draws: the few words beside
 * each step, who each step is waiting on before it goes, and steps whose
 * timing puts them before a step drawn above them.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/line-rules
 */

/**
 * Who a step waits on. `you`: the MC sends it, or OKs it first. `them`:
 * it goes once the client has done the step before (accepted, signed,
 * paid). `auto`: a date, or an email going out, sets it off.
 */
export type WaitsOn = 'auto' | 'them' | 'you';

/** What each kind of wait is called in the legend, and its dot. */
export const WAIT_LABEL: Record<WaitsOn, string> = {
  auto: 'Automatic',
  them: 'Waits on client',
  you: 'Needs you',
};

/** Each wait's dot: green, a hollow ring, amber. */
export const WAIT_DOT: Record<WaitsOn, string> = {
  auto: 'bg-grass-500',
  them: 'ring-1 ring-inset ring-zebra-400',
  you: 'bg-warning',
};

/** Who `step` waits on, given the step before it. */
export function waitOf(step: JourneyStep, prev: JourneyStep | undefined): WaitsOn {
  const t = timingOf(step);
  // A to-do is the MC's own job, so it always waits on them; so does a step that counts from one.
  if (step.kind === 'todo' || t.at === 'manual' || step.approve || (t.at === 'previous' && prev?.kind === 'todo')) return 'you';
  // Counting from the step before only waits on the couple when that step asks something of them.
  if (t.at === 'previous' && prev && prev.kind !== 'email' && prev.kind !== 'day') return 'them';
  return 'auto';
}

/** Days from the wedding, negative before it; null for a step not timed from the wedding. */
function fromWedding(step: JourneyStep): number | null {
  if (step.kind === 'day') return 0;
  const t = timingOf(step);
  if (t.at !== 'wedding') return null;
  const days = t.amount * (t.unit === 'weeks' ? 7 : t.unit === 'months' ? 30 : t.unit === 'minutes' ? 0 : 1);
  return t.side === 'before' ? -days : days;
}

/**
 * The ids of steps timed from the wedding that would go out before a
 * wedding-timed step drawn above them (a "14 days before" step dragged
 * above an "8 weeks before" one). The line reads top to bottom, so the
 * MC should see where the order and the dates disagree.
 */
export function outOfOrder(steps: JourneyStep[]): Set<string> {
  const out = new Set<string>();
  let latest = -Infinity;
  for (const s of steps) {
    const at = fromWedding(s);
    if (at === null) continue;
    if (at < latest) out.add(s.id);
    else latest = at;
  }
  return out;
}

/**
 * The few words beside step `i` on the line: "On enquiry", "Once signed",
 * "6 weeks before", the event's date beside the event. Worded from the
 * step before, so moving a step rewords it. The first step says how
 * clients arrive: on enquiry for the journey new enquiries start on,
 * otherwise when the MC adds them.
 */
export function lineWhen(journey: Journey, i: number): string {
  const { steps } = journey;
  const s = steps[i];
  if (!s) return '';
  if (s.kind === 'day') return eventParts(s.detail).date ?? 'The day';
  const t = timingOf(s);
  if (t.at === 'start' && !journey.starts) return 'When you add them';
  // An invoice going with the contract is on the contract's page.
  if (s.withPrev && steps[i - 1]?.kind === 'contract') return 'With the contract';
  return shortTiming(t, steps[i - 1]);
}
