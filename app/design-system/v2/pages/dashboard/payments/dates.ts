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

/** "15 Sep", day first as Australians write it, for a date column. */
export const dayMonth = (iso: string) => `${Number(iso.slice(8))} ${monthShort(iso)}`;

/**
 * @deprecated Every v2 date is day first (ruling 2026-10-14); this was
 * "Oct 3" and now returns {@link dayMonth}'s "3 Oct". Kept so callers compile.
 */
export const monthDay = dayMonth;

/** "Saturday 21 November 2026": a date written out in full, as a document's prose has it. */
export const longDate = (iso: string) =>
  at(iso).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(',', '');

/** "14 Mar 2027": a date with its year, for anything outside this year or on a document. */
export const fullDate = (iso: string) => `${dayMonth(iso)} ${iso.slice(0, 4)}`;

/**
 * "9:00 am", "2:30 pm" from "09:00", "14:30" or a full ISO date-time.
 * Lower case with a space, the way the rest of the product writes times.
 */
export const timeOf = (time: string) => {
  const m = /(\d{1,2}):(\d{2})/.exec(time.includes('T') ? time.slice(time.indexOf('T') + 1) : time);
  if (!m) return time;
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'am' : 'pm'}`;
};

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;

/**
 * How long ago `iso` was, spelled out: "just now", "5 minutes ago",
 * "1 hour ago", "yesterday", "2 days ago", "3 weeks ago", then the day
 * itself ("14 Mar"). Takes a date ("2026-09-25", counted against
 * {@link TODAY}) or a date-time (counted against `now`).
 */
export const relativeTime = (iso: string, now: Date = new Date(`${TODAY}T12:00`)): string => {
  if (!iso.includes('T')) {
    const days = daysBetween(iso, TODAY);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 14) return `${plural(days, 'day')} ago`;
    if (days < 60) return `${plural(Math.floor(days / 7), 'week')} ago`;
    return dayMonth(iso);
  }
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${plural(minutes, 'minute')} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${plural(hours, 'hour')} ago`;
  return relativeTime(isoOf(new Date(iso)));
};

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
