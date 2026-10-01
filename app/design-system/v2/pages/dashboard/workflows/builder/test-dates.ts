import { TODAY, addDays, isoOf, shortDate } from '../../payments/dates';
import type { Enrolment, Step, Timing } from '../model';

/**
 * "Test with a client": the date every step would land on for one
 * client, as if the workflow started today. The same walk the engine
 * does: a relative step counts from the one before it, an event-relative
 * step from the client's date (no date, no answer, never a guess), and a
 * branch's steps count from the If. Minutes and hours round to the day;
 * months are calendar months, so "1 month before" 12 Dec is 12 Nov.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/builder/test-dates
 */

const DAYS = { minutes: 0, hours: 0, days: 1, weeks: 7 } as const;

function shift(iso: string, n: number, unit: keyof typeof DAYS | 'months'): string {
  if (unit !== 'months') return addDays(iso, n * DAYS[unit]);
  const d = new Date(`${iso}T00:00:00`);
  d.setMonth(d.getMonth() + n);
  return isoOf(d);
}

function land(t: Timing, from: string, event: string | null): string | null {
  if (t.mode === 'now') return from;
  if (t.mode === 'after') return shift(from, t.n, t.unit);
  if (!event) return null;
  return shift(event, t.mode === 'before-event' ? -t.n : t.n, t.unit);
}

/** Step id to its date in words ("Tue 29 Sep"), or "No event date yet". */
export function testDates(steps: Step[], client: Enrolment): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (list: Step[], start: string | null) => {
    let cursor = start;
    for (const s of list) {
      const at = cursor ? land(s.timing, cursor, client.event) : null;
      out.set(s.id, at ? (at === TODAY ? 'Today' : shortDate(at)) : 'No event date yet');
      if (s.kind === 'if') walk(s.then, at);
      if (at) cursor = at;
    }
  };
  walk(steps, TODAY);
  return out;
}
