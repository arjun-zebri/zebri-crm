import { formatTime, parseTime } from '@/components/ui-v2/time-field';

import { isoOf } from '../payments/dates';

import { WEEKDAYS, minutesOf, type BookingLink, type DayHours, type DayOff, type Weekday } from './booking-data';

/**
 * The times a couple could book a booking type, worked out the way the
 * booking page will: inside the MC's hours for that weekday, never on a
 * day off, no sooner than the notice allows and no further out than
 * the type reaches. Each time is a booking's length long, with its
 * breaks kept free either side, so the next one starts after them.
 * Drives the live preview in a booking type's sheet. Pure; demo only.
 *
 * @module app/design-system/v2/pages/dashboard/booking/booking-slots
 */

export interface Availability {
  hours: Readonly<Record<Weekday, DayHours>>;
  daysOff: readonly DayOff[];
}

const weekdayOf = (d: Date): Weekday => WEEKDAYS[(d.getDay() + 6) % 7] ?? 'Monday';
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Start times ("9:00 am") a couple could pick on `day`, earliest first. */
export function slotsOn(link: BookingLink, a: Availability, day: Date, now: Date): string[] {
  const h = a.hours[weekdayOf(day)];
  const iso = isoOf(day);
  if (!h.on || a.daysOff.some((d) => iso >= d.from && iso <= d.to)) return [];
  // The last day it reaches, whole: a window of 3 months still takes that day's evening.
  const last = startOfDay(new Date(startOfDay(now).getTime() + minutesOf(link.window) * 60_000));
  if (startOfDay(day) > last) return [];
  const from = parseTime(h.from);
  const to = parseTime(h.to);
  const length = minutesOf(link.length);
  if (from === null || to === null || length <= 0) return [];
  const before = minutesOf(link.before);
  const after = minutesOf(link.after);
  const earliest = now.getTime() + minutesOf(link.notice) * 60_000;
  const out: string[] = [];
  // The break before comes out of the hours too, so the first booking starts after it.
  for (let t = from + before; t + length <= to; t += before + length + after) {
    const at = startOfDay(day).getTime() + t * 60_000;
    if (at >= earliest) out.push(formatTime(t));
  }
  return out;
}

/** The first day from today with a time to book, within `limit` days, or null. */
export function firstOpenDay(link: BookingLink, a: Availability, now: Date, limit = 120): Date | null {
  for (let i = 0; i <= limit; i += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    if (slotsOn(link, a, day, now).length) return day;
  }
  return null;
}
