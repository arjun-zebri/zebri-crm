/**
 * Presentation helpers shared by the Bookings tab and the booking detail
 * modal.
 *
 * Every string an MC reads about a booking is formed here so the list row,
 * the day heading and the modal cannot drift apart: one "4:30pm", one
 * "Fri 21 Aug 2026", one "Starts in 2 hours". Pure functions only, so they
 * are unit-testable without rendering anything.
 *
 * All formatting takes the MC's timezone explicitly. Bookings are stored as
 * UTC instants and the booker may sit in another zone, so the browser's local
 * zone is never the right default.
 *
 * @module app/(dashboard)/calendar/booking-display
 */

import { zonedDateParts } from '@/lib/scheduling/timezone';

import type { Booking } from './use-bookings';

/** How each meeting-type location reads in a sentence. */
const LOCATION_LABELS: Record<string, string> = {
  video: 'video call',
  phone: 'phone',
  in_person: 'in person',
};

/**
 * Human label for a meeting type's location.
 *
 * @param locationType - the raw `meeting_types.location_type` value
 * @returns e.g. `'video call'`; the raw value when it is unrecognised
 */
export function locationLabel(locationType: string | null | undefined): string {
  if (!locationType) return '';
  return LOCATION_LABELS[locationType] ?? locationType.replace(/_/g, ' ');
}

/**
 * Clock time with no space before the meridiem: `'4:30pm'`.
 *
 * `en-AU` renders "4:30 pm", which is correct prose but too airy for a
 * dense list column, so the space is squeezed out and the meridiem
 * lower-cased.
 */
export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(new Date(iso))
    .replace(/\s/g, '')
    .toLowerCase();
}

/**
 * The full span of a booking with its timezone abbreviation:
 * `'4:30pm–5:00pm AEST'`.
 */
export function formatTimeRange(startIso: string, endIso: string, timeZone: string): string {
  const zoneParts = new Intl.DateTimeFormat('en-AU', {
    timeZone,
    timeZoneName: 'short',
  }).formatToParts(new Date(startIso));
  const zone = zoneParts.find((part) => part.type === 'timeZoneName')?.value ?? '';
  return `${formatTime(startIso, timeZone)}–${formatTime(endIso, timeZone)}${zone ? ` ${zone}` : ''}`;
}

/** Long date for the modal heading: `'Fri 21 Aug 2026'`. */
export function formatFullDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
    .format(new Date(iso))
    .replace(/,/g, '');
}

/** Short date for meta lines: `'18 Aug'`. */
export function formatShortDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone,
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso));
}

/** Day heading for a list group: `'Fri 21 Aug'`, prefixed on the near days. */
export function formatDayHeading(iso: string, timeZone: string, now: Date): string {
  const day = new Intl.DateTimeFormat('en-AU', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(new Date(iso))
    .replace(/,/g, '');

  const bookingDate = zonedDateParts(new Date(iso), timeZone).date;
  const todayDate = zonedDateParts(now, timeZone).date;
  if (bookingDate === todayDate) return `Today · ${day}`;

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (bookingDate === zonedDateParts(tomorrow, timeZone).date) return `Tomorrow · ${day}`;

  return day;
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const relative = new Intl.RelativeTimeFormat('en-AU', { numeric: 'auto' });

/**
 * How far away a booking is, in words: `'Starts in 2 hours'`,
 * `'Happening now'`, `'Ended 3 days ago'`.
 *
 * Returns an empty string for a cancelled booking, where a countdown to a
 * meeting that will not happen is worse than no line at all.
 */
export function formatCountdown(booking: Pick<Booking, 'starts_at' | 'ends_at' | 'status'>, now: Date): string {
  if (booking.status === 'cancelled') return '';

  const start = new Date(booking.starts_at).getTime();
  const end = new Date(booking.ends_at).getTime();
  const nowMs = now.getTime();

  if (nowMs >= start && nowMs < end) return 'Happening now';

  const delta = start - nowMs;
  const past = delta < 0;
  const magnitude = Math.abs(past ? nowMs - end : delta);

  const [value, unit]: [number, Intl.RelativeTimeFormatUnit] =
    magnitude < HOUR_MS
      ? [Math.max(1, Math.round(magnitude / MINUTE_MS)), 'minute']
      : magnitude < DAY_MS
        ? [Math.round(magnitude / HOUR_MS), 'hour']
        : [Math.round(magnitude / DAY_MS), 'day'];

  const phrase = relative.format(past ? -value : value, unit);
  return past ? `Ended ${phrase}` : `Starts ${phrase}`;
}

/** A day's worth of bookings, ready to render as one group in the list. */
export interface BookingDayGroup {
  /** `YYYY-MM-DD` in the MC's timezone. Stable React key. */
  date: string;
  /** Heading text, e.g. `'Today · Fri 21 Aug'`. */
  heading: string;
  /** Whether this group is today in the MC's timezone. */
  isToday: boolean;
  bookings: Booking[];
}

/**
 * Split an already-sorted booking list into consecutive day groups.
 *
 * Grouping happens in the MC's timezone rather than UTC: a 9am Sydney
 * booking is stored as the previous UTC day for half the year, and an MC
 * looking at their diary does not care which day it was in London.
 */
export function groupByDay(bookings: Booking[], timeZone: string, now: Date): BookingDayGroup[] {
  const todayDate = zonedDateParts(now, timeZone).date;
  const groups: BookingDayGroup[] = [];

  for (const booking of bookings) {
    const date = zonedDateParts(new Date(booking.starts_at), timeZone).date;
    const last = groups[groups.length - 1];
    if (last && last.date === date) {
      last.bookings.push(booking);
      continue;
    }
    groups.push({
      date,
      heading: formatDayHeading(booking.starts_at, timeZone, now),
      isToday: date === todayDate,
      bookings: [booking],
    });
  }

  return groups;
}
