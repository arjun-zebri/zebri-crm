/**
 * Timezone conversion built on Intl.DateTimeFormat: the repo has no
 * date library and scheduling is the only consumer that needs zone
 * math, so these two helpers stay deliberately tiny. Availability
 * windows are wall-clock times in the MC's IANA zone; slots are UTC
 * instants; these convert between the two, DST-correct.
 *
 * @module lib/scheduling/timezone
 */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Offset of `timeZone` from UTC, in minutes, at the instant `utcDate`. */
function tzOffsetMinutes(utcDate: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(utcDate);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    // Intl emits hour "24" at midnight in some environments.
    get('hour') % 24,
    get('minute'),
    get('second'),
  );
  return (asUtc - utcDate.getTime()) / 60_000;
}

/**
 * The UTC instant of wall-clock `date` ("YYYY-MM-DD") + `time` ("HH:mm")
 * in `timeZone`. Two-pass offset lookup: the first guess can land on the
 * wrong side of a DST boundary, so the offset is re-read at the corrected
 * instant.
 */
/**
 * Add whole days to a YYYY-MM-DD date string with calendar arithmetic.
 *
 * Why this exists: "the next local day" must never be computed by adding
 * 24 hours to a local-midnight instant. A DST fall-back day is 25 hours
 * long, so midnight + 24h is still 23:00 on the SAME local date; calendar
 * arithmetic on the date string is immune to offset changes.
 *
 * @param date - date string in YYYY-MM-DD form
 * @param days - whole days to add (may be negative)
 * @returns the shifted date string in YYYY-MM-DD form
 */
export function addDaysToDateString(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
}

/**
 * Add whole calendar months to a `YYYY-MM-DD` date string.
 *
 * Calendar months, not 30-day blocks: "one month before the wedding" for a
 * 14 November wedding is 14 October, whatever the month lengths in between.
 *
 * When the source day does not exist in the target month (31 March minus
 * one month), the result clamps to the last day of that month rather than
 * rolling into the next one, which is what `Date.UTC` would do on its own.
 *
 * @param date - date string in YYYY-MM-DD form
 * @param months - whole months to add (may be negative)
 * @returns the shifted date string in YYYY-MM-DD form
 */
export function addMonthsToDateString(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const targetMonthStart = new Date(Date.UTC(year!, month! - 1 + months, 1));
  // Day 0 of the following month is the last day of the target month.
  const lastDayOfTarget = new Date(
    Date.UTC(targetMonthStart.getUTCFullYear(), targetMonthStart.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const clampedDay = Math.min(day!, lastDayOfTarget);
  return new Date(
    Date.UTC(targetMonthStart.getUTCFullYear(), targetMonthStart.getUTCMonth(), clampedDay),
  )
    .toISOString()
    .slice(0, 10);
}

export function zonedTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const naive = Date.UTC(y!, m! - 1, d!, hh!, mm!);
  const firstOffset = tzOffsetMinutes(new Date(naive), timeZone);
  const offset = tzOffsetMinutes(new Date(naive - firstOffset * 60_000), timeZone);
  return new Date(naive - offset * 60_000);
}

/**
 * The wall-clock date ("YYYY-MM-DD") and weekday (0=Sunday..6=Saturday)
 * at instant `utc` in `timeZone`.
 */
export function zonedDateParts(
  utc: Date,
  timeZone: string,
): { date: string; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(utc);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: WEEKDAYS.indexOf(get('weekday') as (typeof WEEKDAYS)[number]),
  };
}
