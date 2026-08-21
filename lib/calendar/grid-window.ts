/**
 * Compute the visible hour range for the day-view grid.
 *
 * Derives the start and end hours from the MC's availability rules,
 * applying 1-hour buffers and clamping to 00:00-24:00.
 *
 * @module lib/calendar/grid-window
 */
import { getLocalDayStart, wallClockMinutesFrom } from '@/lib/calendar/timezone';

/**
 * The grid always shows at least 07:00 to 19:00.
 *
 * Without a floor the window is derived purely from whatever happens to be on
 * the calendar, so it changes shape as the MC pages through the weeks: one
 * week ends at 20:00 because of a single evening meeting, the next ends at
 * 17:00, and the grid appears to be truncating the day at random. A fixed
 * minimum makes the calendar feel like a calendar, and content still widens
 * it beyond these bounds whenever something falls outside.
 */
const MIN_WINDOW_START_HOUR = 7;
const MIN_WINDOW_END_HOUR = 19;

/**
 * Compute the grid window (startHour, endHour) for a day-view.
 *
 * Examines all availability rules to find the earliest start time and latest
 * end time, then applies 1-hour buffers to both. If no rules exist, defaults
 * to 07:00-21:00. The window is then widened to at least 07:00-19:00, and
 * again to cover `contentHours` so that anything actually drawn on the grid
 * falls inside it. Final result is clamped to 00:00-24:00.
 *
 * Why content widens the window: availability says when the MC is bookable,
 * not what is on their calendar. A wedding at 18:00 or an external meeting at
 * 07:00 sits outside a 09:00-17:00 schedule, and a window derived from
 * availability alone would push it past the grid edge, where the band
 * geometry clamps it to a sliver at the boundary. The MC would see a hint of
 * something at the edge, or nothing at all, and no indication that the grid
 * was hiding it. Showing an hour or two of empty space is much cheaper than
 * concealing a booking.
 *
 * @param rules - availability rules (any weekday; only times matter)
 * @param contentHours - local-time hour spans of items drawn on the grid
 *   (bookings, external busy blocks). Fractional hours are widened outward.
 * @returns { startHour, endHour } where endHour is exclusive
 *
 * @example
 * // No rules: defaults to 07:00-21:00
 * computeGridWindow([]); // { startHour: 7, endHour: 21 }
 *
 * // Rule 09:00-17:00: buffers to 08:00-18:00, then the 19:00 floor applies
 * computeGridWindow([{ start_time: "09:00", end_time: "17:00" }]);
 * // { startHour: 7, endHour: 19 }
 *
 * // Rule 06:00-18:00: clamps at 00:00
 * computeGridWindow([{ start_time: "06:00", end_time: "18:00" }]);
 * // { startHour: 0, endHour: 19 } (05:00 clamped to 00:00)
 *
 * // A 21:00 wedding widens the window past the standard day
 * computeGridWindow(
 *   [{ start_time: "09:00", end_time: "17:00" }],
 *   [{ startHour: 21, endHour: 22.5 }],
 * );
 * // { startHour: 7, endHour: 23 }
 */
export function computeGridWindow(
  rules: Array<{ start_time: string; end_time: string }>,
  contentHours: Array<{ startHour: number; endHour: number }> = [],
): { startHour: number; endHour: number } {
  let startHour: number;
  let endHour: number;

  if (rules.length === 0) {
    startHour = 7;
    endHour = 21;
  } else {
    let minStart = 24;
    let maxEnd = 0;

    for (const rule of rules) {
      const [ruleStartHour = 0] = rule.start_time.split(':').map(Number);
      const [ruleEndHour = 0] = rule.end_time.split(':').map(Number);
      minStart = Math.min(minStart, ruleStartHour);
      maxEnd = Math.max(maxEnd, ruleEndHour);
    }

    startHour = minStart - 1;
    endHour = maxEnd + 1;
  }

  // Never narrower than a standard day, so the grid keeps its shape from week
  // to week instead of tracking whatever happens to be booked.
  startHour = Math.min(startHour, MIN_WINDOW_START_HOUR);
  endHour = Math.max(endHour, MIN_WINDOW_END_HOUR);

  for (const span of contentHours) {
    // Round outward: a 09:20 start belongs in the 09:00 row, and a 17:40 end
    // needs the 18:00 row to exist or its band is clipped.
    startHour = Math.min(startHour, Math.floor(span.startHour));
    endHour = Math.max(endHour, Math.ceil(span.endHour));
  }

  return {
    startHour: Math.max(0, startHour),
    endHour: Math.min(24, endHour),
  };
}

/**
 * Convert grid items to the local-time hour spans `computeGridWindow` wants.
 *
 * Each item is measured against the start of its OWN local day rather than a
 * shared reference day, so a week's worth of items from seven different days
 * all reduce to comparable hour offsets.
 *
 * @param items - items drawn on the grid, with ISO 8601 start and end
 * @param timezone - IANA timezone the grid is rendered in
 * @returns hour spans measured from local midnight, suitable for computeGridWindow
 */
export function toContentHours(
  items: Array<{ start: string; end: string }>,
  timezone: string,
): Array<{ startHour: number; endHour: number }> {
  const MINUTES_PER_HOUR = 60;

  return items.map((item) => {
    const start = new Date(item.start);
    const end = new Date(item.end);
    const dayStart = getLocalDayStart(start, timezone);

    // Wall-clock, not elapsed: the window is compared against hour labels, and
    // on a daylight saving day the two scales are an hour apart.
    return {
      startHour: wallClockMinutesFrom(start, dayStart, timezone) / MINUTES_PER_HOUR,
      endHour: wallClockMinutesFrom(end, dayStart, timezone) / MINUTES_PER_HOUR,
    };
  });
}
