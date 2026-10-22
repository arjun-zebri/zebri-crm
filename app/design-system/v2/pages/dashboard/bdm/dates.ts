import { isoOf, shortDate } from '../payments/dates';

import type { Paperwork } from './bdm-data';

/**
 * The dates a couple's paperwork turns on: the law's fourteen days to
 * lodge after the wedding, the wedding day itself, and today, in the
 * forms the demo writes them. Re-exported from `bdm-data`.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/dates
 */

/** Days the law gives to lodge after the wedding. */
export const LODGE_WITHIN_DAYS = 14;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The wedding as a local date, read from the client's "Sat 10 Oct 2026".
 * Parsed by hand: `new Date()` on that string is engine-specific, and the
 * Registry's date has to be exact.
 */
export function weddingDate(p: Paperwork): Date | null {
  const m = /(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})/.exec(p.date);
  const month = m ? MONTHS.indexOf(m[2] ?? '') : -1;
  return m && month >= 0 ? new Date(Number(m[3]), month, Number(m[1])) : null;
}

/** A local date as "YYYY-MM-DD", the only form the Registry takes (the shared helper). */
export { isoOf };

/** The wedding as "YYYY-MM-DD" (`DateOfMarriage`), or "" without a date. */
export const weddingIso = (p: Paperwork) => {
  const d = weddingDate(p);
  return d ? isoOf(d) : '';
};

/** The last day to lodge: fourteen days after the wedding. Null without a date. */
export function lodgeBy(p: Paperwork): Date | null {
  const at = weddingDate(p);
  if (!at) return null;
  at.setDate(at.getDate() + LODGE_WITHIN_DAYS);
  return at;
}

/** A date as the demo writes a day: "Sat 17 Oct". */
export const dayText = (d: Date) => shortDate(isoOf(d));

/** Whole days until a date, negative once it has passed. */
export const daysUntil = (d: Date, now = new Date()) => Math.ceil((d.getTime() - now.getTime()) / 86_400_000);

/** The wedding day without its year: "Sat 12 Dec". */
export const weddingDay = (p: Paperwork) => p.date.replace(/ \d{4}$/, '');

/** Today as "YYYY-MM-DD", for a date check. */
export const todayIso = () => isoOf(new Date());
