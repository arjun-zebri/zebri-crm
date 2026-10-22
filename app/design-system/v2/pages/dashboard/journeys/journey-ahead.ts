import { addDays, shortDate } from '../payments/dates';

import type { Journey } from './journeys-data';
import { waitOf } from './line-rules';
import { timingOf } from './timing';

/**
 * What a journey still has to do for one couple, as dates: each step
 * timed from the event, from today up to the day itself, with whether
 * Zebri does it on its own. The booked celebration draws these as the
 * line carrying on past what the MC just did, and the client's Overview
 * lists them on its timeline, so the two show the same dates.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/journey-ahead
 */

/** One dated step ahead. */
export interface AheadStep {
  id: string;
  /** The step's name ("Questionnaire"); the event itself is "The day". */
  label: string;
  /** "YYYY-MM-DD". */
  iso: string;
  /** "12 Feb". */
  when: string;
  /** Zebri does it on its own, nothing asked of the MC. */
  zebri: boolean;
  /** The event itself, the last stop. */
  day: boolean;
}

const DAYS = { minutes: 0, days: 1, weeks: 7, months: 30 } as const;

/** "Sat 12 Feb" as "12 Feb", for a column of dates. */
const dayMonth = (iso: string) => shortDate(iso).split(' ').slice(1).join(' ');

/**
 * The steps of `journey` still ahead on `today` for an event on `event`
 * (both "YYYY-MM-DD"), in date order, ending at the day. Steps after the
 * day (the thank-you) and steps counted from another step are left out:
 * only what has a date before the event is ahead in this sense.
 */
export function stepsAhead(journey: Journey, event: string, today: string): AheadStep[] {
  return journey.steps
    .flatMap((step, i): AheadStep[] => {
      if (step.kind === 'day') return [{ id: step.id, label: 'The day', iso: event, when: dayMonth(event), zebri: false, day: true }];
      const t = timingOf(step);
      if (t.at !== 'wedding' || t.side !== 'before') return [];
      const iso = addDays(event, -t.amount * DAYS[t.unit]);
      if (iso < today) return [];
      return [{ id: step.id, label: step.name, iso, when: dayMonth(iso), zebri: waitOf(step, journey.steps[i - 1]) === 'auto', day: false }];
    })
    .sort((a, b) => a.iso.localeCompare(b.iso));
}
