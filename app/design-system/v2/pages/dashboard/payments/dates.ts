/**
 * Date helpers for the v2 Payments demo. Dates are local "YYYY-MM-DD"
 * strings and months "YYYY-MM", so they sort as text. "Today" is fixed
 * at Sun 27 Sep 2026, the date the demo copy is written against, so the
 * page reads the same whenever it is opened.
 *
 * @module app/design-system/v2/pages/dashboard/payments/dates
 */

export const TODAY = '2026-09-27';

const at = (iso: string) => new Date(`${iso}T00:00`);
const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-09-24" from a Date. */
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The date `n` days after `iso`. */
export const addDays = (iso: string, n: number) => {
  const d = at(iso);
  d.setDate(d.getDate() + n);
  return isoOf(d);
};

/** Whole days from `a` to `b`. */
export const daysBetween = (a: string, b: string) => Math.round((at(b).getTime() - at(a).getTime()) / 86_400_000);

// en-AU writes "Sept" and "June"; every other month is three letters, so these are trimmed to match.
const trim = (s: string) => s.replace('Sept', 'Sep').replace('June', 'Jun');

/** "Wed 24 Sep". */
export const shortDate = (iso: string) =>
  trim(at(iso).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', ''));

/** "Oct" for a date or a month. */
export const monthShort = (isoOrMonth: string) =>
  trim(at(`${isoOrMonth.slice(0, 7)}-01`).toLocaleDateString('en-AU', { month: 'short' }));

/** "Oct 2026" for a month. */
export const monthLong = (month: string) => `${monthShort(month)} ${month.slice(0, 4)}`;

/** "October 2026" for a month. */
export const monthFull = (month: string) =>
  at(`${month}-01`).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });

/** "Oct 3", month first, for a date column that scans by month. */
export const monthDay = (iso: string) => `${monthShort(iso)} ${Number(iso.slice(8))}`;

/** "15 Sep", day first as Australians write it, for a date column. */
export const dayMonth = (iso: string) => `${Number(iso.slice(8))} ${monthShort(iso)}`;

/** The month after `month`. */
export const nextMonth = (month: string) => {
  const d = at(`${month}-01`);
  d.setMonth(d.getMonth() + 1);
  return isoOf(d).slice(0, 7);
};

/** Every month from `from` to `to`, inclusive. */
export const monthsBetween = (from: string, to: string) => {
  const out: string[] = [];
  for (let m = from; m <= to; m = nextMonth(m)) out.push(m);
  return out;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "2027-03-26" from a client's display date ("Fri 26 Mar 2027"), or null
 * when it is not one ("Date to come"). Clients carry their date as shown,
 * and the invoice needs to count back from it.
 */
export const isoFromDisplay = (display: string): string | null => {
  const m = /(\d{1,2}) (\w{3}) (\d{4})/.exec(display);
  const month = m ? MONTHS.indexOf(m[2] ?? '') : -1;
  return m && month >= 0 ? `${m[3]}-${pad(month + 1)}-${pad(Number(m[1]))}` : null;
};

/** A length of time as people say it: "2 weeks", "3 months". */
export type Unit = 'days' | 'weeks' | 'months';
export interface Span {
  count: number;
  unit: Unit;
}

/** The date a span after `iso` (before it, with `sign` -1); months are calendar months. */
export const addSpan = (iso: string, { count, unit }: Span, sign: 1 | -1 = 1) => {
  if (unit !== 'months') return addDays(iso, sign * count * (unit === 'weeks' ? 7 : 1));
  const d = at(iso);
  d.setMonth(d.getMonth() + sign * count);
  return isoOf(d);
};

/** "1 week", "3 days". */
export const spanText = ({ count, unit }: Span) => `${count} ${count === 1 ? unit.slice(0, -1) : unit}`;
