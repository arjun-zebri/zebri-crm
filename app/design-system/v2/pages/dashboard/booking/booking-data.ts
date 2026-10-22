/**
 * What the Booking links block holds: the MC's booking types (each a
 * link couples book from) and the weekly hours they are free, shared by
 * every type, with days off on top. Settings' Booking links tab edits
 * it and the calendar popover lists the types to copy. Demo content.
 *
 * @module app/design-system/v2/pages/dashboard/booking/booking-data
 */

/** Where a booking happens. */
export type Where = 'video' | 'phone' | 'in-person';

export const WHERE: readonly Where[] = ['video', 'phone', 'in-person'];
export const WHERE_LABEL: Record<Where, string> = { video: 'Video call', phone: 'Phone call', 'in-person': 'In person' };

/** The units a span of time is set in. A month counts as 30 days. */
export type Unit = 'min' | 'hr' | 'day' | 'week' | 'month';

/** A span of time as the MC set it: any number, in the unit they chose. */
export interface Span {
  n: number;
  unit: Unit;
}

const UNIT_MINUTES: Record<Unit, number> = { min: 1, hr: 60, day: 1440, week: 10_080, month: 43_200 };
const UNIT_WORD: Record<Unit, [string, string]> = {
  min: ['min', 'min'],
  hr: ['hr', 'hrs'],
  day: ['day', 'days'],
  week: ['week', 'weeks'],
  month: ['month', 'months'],
};

/** A span in minutes, for working out times. */
export const minutesOf = (s: Span) => s.n * UNIT_MINUTES[s.unit];

/** "30 min", "1 hr 30 min", "2 hrs", "1 day", "3 months". */
export function spanLabel(s: Span): string {
  if (s.unit === 'min' && s.n >= 60) {
    const h = Math.floor(s.n / 60);
    const m = s.n % 60;
    return `${h} hr${h === 1 ? '' : 's'}${m ? ` ${m} min` : ''}`;
  }
  return `${s.n} ${UNIT_WORD[s.unit][s.n === 1 ? 0 : 1]}`;
}

/** The quick picks each setting offers above its own number; anything else is typed. */
export const LENGTH_PICKS: Span[] = [{ n: 15, unit: 'min' }, { n: 30, unit: 'min' }, { n: 45, unit: 'min' }, { n: 1, unit: 'hr' }];
export const NOTICE_PICKS: Span[] = [{ n: 4, unit: 'hr' }, { n: 1, unit: 'day' }, { n: 2, unit: 'day' }, { n: 1, unit: 'week' }];
export const WINDOW_PICKS: Span[] = [{ n: 2, unit: 'week' }, { n: 1, unit: 'month' }, { n: 3, unit: 'month' }, { n: 6, unit: 'month' }];

/** The units each setting can be typed in. */
export const LENGTH_UNITS: readonly Unit[] = ['min', 'hr'];
export const BREAK_UNITS: readonly Unit[] = ['min', 'hr'];
export const NOTICE_UNITS: readonly Unit[] = ['hr', 'day', 'week'];
export const WINDOW_UNITS: readonly Unit[] = ['day', 'week', 'month'];
export const UNIT_LABEL: Record<Unit, string> = { min: 'Minutes', hr: 'Hours', day: 'Days', week: 'Weeks', month: 'Months' };

/** One booking type: a link couples book from. */
export interface BookingLink {
  /** Its id in the store. */
  slug: string;
  /** The end of its link (`zebri.com/arjun/intro`); empty, it follows the name. */
  path: string;
  name: string;
  /** How long each booking lasts. */
  length: Span;
  where: Where;
  /** Where to meet, for an in-person booking. */
  address: string;
  /** Kept free before and after each booking, so nothing runs back to back. */
  before: Span;
  after: Span;
  /** How soon before it starts a booking can still be made. */
  notice: Span;
  /** How far ahead couples can book. */
  window: Span;
  /** What couples read on the booking page before they pick a time. */
  description: string;
}

/** "15 min · Video call". */
export const linkDetail = (b: BookingLink) => `${spanLabel(b.length)} · ${WHERE_LABEL[b.where]}`;

/** "At least 4 hrs' notice", "At least 1 day's notice". */
export const noticeLabel = (s: Span) => `At least ${spanLabel(s)}${s.n === 1 ? "'s" : "'"} notice`;

/** "Up to 3 months ahead". */
export const windowLabel = (s: Span) => `Up to ${spanLabel(s)} ahead`;

/** "10 min break after", "15 min breaks", "10 min before, 15 min after", or undefined for none. */
export function breakLabel({ before, after }: Pick<BookingLink, 'before' | 'after'>): string | undefined {
  const b = minutesOf(before);
  const a = minutesOf(after);
  if (!b && !a) return undefined;
  if (b === a) return `${spanLabel(before)} breaks`;
  if (!b) return `${spanLabel(after)} break after`;
  if (!a) return `${spanLabel(before)} break before`;
  return `${spanLabel(before)} before, ${spanLabel(after)} after`;
}

/** The MC's public booking page. */
export const BOOKING_HOST = 'zebri.com/arjun';

/** "Venue walkthrough" to "venue-walkthrough". */
const slugify = (name: string) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** A type's link: its own path, else made from its name, so a new type's link reads like what it is. */
export const linkUrl = (b: BookingLink) => `https://${BOOKING_HOST}/${b.path || slugify(b.name) || b.slug}`;

export const SEED_LINKS: BookingLink[] = [
  { slug: 'intro', path: 'intro', name: 'Intro call', length: { n: 15, unit: 'min' }, where: 'video', address: '', before: { n: 0, unit: 'min' }, after: { n: 10, unit: 'min' }, notice: { n: 4, unit: 'hr' }, window: { n: 3, unit: 'month' }, description: 'A quick hello to see if we are the right fit for your day.' },
  { slug: 'planning', path: 'planning', name: 'Planning consultation', length: { n: 45, unit: 'min' }, where: 'video', address: '', before: { n: 10, unit: 'min' }, after: { n: 15, unit: 'min' }, notice: { n: 1, unit: 'day' }, window: { n: 6, unit: 'month' }, description: 'We go through the running order, the people and the moments that matter.' },
  { slug: 'walkthrough', path: 'walkthrough', name: 'Venue walkthrough', length: { n: 1, unit: 'hr' }, where: 'in-person', address: 'At their venue', before: { n: 30, unit: 'min' }, after: { n: 30, unit: 'min' }, notice: { n: 1, unit: 'week' }, window: { n: 6, unit: 'month' }, description: '' },
];

/** A fresh booking type, as New booking type makes it. */
export const blankLink = (slug: string): BookingLink => ({
  slug,
  path: '',
  name: '',
  length: { n: 30, unit: 'min' },
  where: 'video',
  address: '',
  before: { n: 0, unit: 'min' },
  after: { n: 10, unit: 'min' },
  notice: { n: 1, unit: 'day' },
  window: { n: 3, unit: 'month' },
  description: '',
});

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** One weekday's hours; `from` and `to` as a TimeField shows them ("9:00 am"). */
export interface DayHours {
  on: boolean;
  from: string;
  to: string;
}

/** Weekdays nine to five, weekends off: an MC's weekends are the events themselves. */
export const SEED_HOURS: Record<Weekday, DayHours> = Object.fromEntries(
  WEEKDAYS.map((d, i) => [d, { on: i < 5, from: '9:00 am', to: '5:00 pm' }]),
) as Record<Weekday, DayHours>;

/** A day or run of days off, "YYYY-MM-DD"; `to` equals `from` for one day. */
export interface DayOff {
  from: string;
  to: string;
}

export const SEED_DAYS_OFF: DayOff[] = [
  { from: '2026-12-24', to: '2026-12-26' },
  { from: '2027-01-12', to: '2027-01-12' },
];

/** "9:00 am" (as a TimeField keeps it) shown the house way, "9:00 am". */
export const spacedTime = (t: string) => t.replace(/\s*(am|pm)$/i, ' $1');
