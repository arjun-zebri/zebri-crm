/**
 * Timezone utilities for calendar grid positioning.
 *
 * Converts UTC dates to local midnight in the MC's timezone, which is needed
 * to establish the day-start reference for grid positioning. Bookings store
 * absolute instants (UTC), but the grid must position them relative to the
 * MC's local midnight, not UTC midnight.
 *
 * Reuses DST-correct helpers from lib/scheduling/timezone.
 *
 * @module lib/calendar/timezone
 */

import { addDaysToDateString, zonedDateParts, zonedTimeToUtc } from '@/lib/scheduling/timezone';

/**
 * Get the local midnight (00:00) of a date in a given timezone.
 *
 * Takes a Date (UTC instant) and a timezone string, then computes what
 * 00:00:00 in that timezone is as a UTC Date. For example, if the input
 * is "2026-08-20 15:30 UTC" and timezone is "Australia/Melbourne" (UTC+10),
 * the local date there is "2026-08-21 01:30", so local midnight is
 * "2026-08-21 00:00 Melbourne time", which is "2026-08-20 14:00 UTC".
 *
 * Used by the day-view grid to set the anchor point for positioning bookings.
 * Bookings are positioned from this local midnight reference.
 *
 * @param date - UTC instant
 * @param timeZone - IANA timezone string (e.g., "Australia/Melbourne")
 * @returns midnight (00:00) on that date in the given timezone, as a UTC Date
 *
 * @example
 * const utcDate = new Date('2026-08-20T15:30:00Z');
 * const melb = getLocalDayStart(utcDate, 'Australia/Melbourne');
 * // melb is "2026-08-20T14:00:00Z" (21:00 AEST = 00:00 next day local)
 */
export function getLocalDayStart(date: Date, timeZone: string): Date {
  // Get the local calendar date at this instant in the MC's zone
  const { date: localDate } = zonedDateParts(date, timeZone);
  // Return that date's local midnight as a UTC instant (DST-correct)
  return zonedTimeToUtc(localDate, '00:00', timeZone);
}

/**
 * Get the exclusive end of a date's local day: the NEXT local midnight.
 *
 * Companion to getLocalDayStart. The pair brackets one full local calendar
 * day as [start, end). The end is derived by calendar arithmetic on the
 * local date, not by adding 24 hours, so DST changeover days keep their
 * real length: a 25-hour fall-back day ends 25 elapsed hours after it
 * starts, and a 23-hour spring-forward day ends after 23.
 *
 * @param date - UTC instant anywhere inside the local day
 * @param timeZone - IANA timezone string (e.g., "Australia/Melbourne")
 * @returns midnight (00:00) of the FOLLOWING local day, as a UTC Date
 */
export function getLocalDayEnd(date: Date, timeZone: string): Date {
  const { date: localDate } = zonedDateParts(date, timeZone);
  return zonedTimeToUtc(addDaysToDateString(localDate, 1), '00:00', timeZone);
}

/**
 * Wall-clock minutes since local midnight for an instant, plus whole days.
 *
 * Returns the position of `instant` on a wall-clock timeline anchored at
 * midnight of `referenceDayStart`'s local day. Same-day instants land in
 * 0-1439; an instant a day later lands 1440 higher, and so on.
 *
 * Why not simply subtract the two instants: elapsed time and wall-clock time
 * are different scales, and they come apart on daylight saving changeover
 * days. Sydney's 4 October 2026 is 23 hours long, so 10:00 that morning is
 * only 9 elapsed hours after midnight. The calendar grid labels its rows with
 * wall-clock hours, so a band placed by elapsed time is drawn a full row off
 * for the rest of the day. Reading the hour and minute back out of the
 * formatter keeps the band on the row its label claims, whatever the offset
 * did in between.
 *
 * @param instant - the moment to place
 * @param referenceDayStart - UTC instant of local midnight for the grid's day
 * @param timeZone - IANA timezone the grid is rendered in
 * @returns minutes from the reference day's local midnight, on a wall clock
 */
export function wallClockMinutesFrom(
  instant: Date,
  referenceDayStart: Date,
  timeZone: string,
): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);

  // Intl renders midnight as hour 24 in some locales/engines under hour12:false.
  const hour = get('hour') % 24;
  const minutesIntoDay = hour * 60 + get('minute') + get('second') / 60;

  const { date: instantDate } = zonedDateParts(instant, timeZone);
  const { date: referenceDate } = zonedDateParts(referenceDayStart, timeZone);
  const dayOffset = wholeDaysBetween(referenceDate, instantDate);

  return minutesIntoDay + dayOffset * 24 * 60;
}

/**
 * Whole calendar days from `fromDate` to `toDate`, both `YYYY-MM-DD`.
 *
 * Parsed as UTC midnights purely as a counting device: both sides carry the
 * same fictional offset, so it cancels and no timezone maths leaks in.
 */
function wholeDaysBetween(fromDate: string, toDate: string): number {
  const from = Date.parse(`${fromDate}T00:00:00Z`);
  const to = Date.parse(`${toDate}T00:00:00Z`);
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}

/**
 * Format an instant as `HH:MM` on a 24-hour clock in the given timezone.
 *
 * Always pass the MC's timezone explicitly. Reading the hour off a Date with
 * `getHours()` silently uses whatever timezone the browser happens to be in,
 * so an MC travelling, or simply working across a state border, would see
 * their own agenda labelled with the wrong times.
 *
 * @param instant - ISO 8601 string or Date
 * @param timeZone - IANA timezone
 * @returns zero-padded `HH:MM`
 */
export function formatTimeInZone(instant: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(typeof instant === 'string' ? new Date(instant) : instant);
}
