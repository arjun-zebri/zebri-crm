/**
 * Pure time-interval helpers shared by the free/busy module and (Phase
 * B) the slot engine. Intervals are ISO 8601 UTC strings, half-open
 * [start, end): lexicographic comparison on the normalised strings is
 * NOT assumed; epoch millis are compared instead.
 *
 * @module lib/calendar/intervals
 */

/** A busy block on someone's calendar, UTC ISO strings. */
export interface BusyInterval {
  start: string;
  end: string;
}

/**
 * Sort intervals and coalesce any that overlap or touch. Touching
 * intervals merge because a meeting ending 10:00 and one starting 10:00
 * leave no bookable gap between them.
 */
export function mergeIntervals(intervals: BusyInterval[]): BusyInterval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort(
    (a, b) => Date.parse(a.start) - Date.parse(b.start),
  );
  const out: BusyInterval[] = [{ ...sorted[0]! }];
  for (const next of sorted.slice(1)) {
    const last = out[out.length - 1]!;
    if (Date.parse(next.start) <= Date.parse(last.end)) {
      if (Date.parse(next.end) > Date.parse(last.end)) last.end = next.end;
    } else {
      out.push({ ...next });
    }
  }
  return out;
}

/**
 * Remove `cut` interval from `intervals`, splitting any interval that
 * fully contains it. Used when a booker reschedules: their own booking
 * was pushed to the MC's calendar, so that window must not count as
 * busy against them.
 *
 * Handles five cases: no overlap (unchanged), cut covering an interval
 * entirely (interval dropped), cut trimming the start, cut trimming the
 * end, and cut strictly inside an interval (split into two).
 *
 * @param intervals - list of busy intervals
 * @param cut - interval to remove
 * @returns new array with cut interval removed/trimmed
 */
export function subtractInterval(
  intervals: BusyInterval[],
  cut: BusyInterval,
): BusyInterval[] {
  const cutStart = Date.parse(cut.start);
  const cutEnd = Date.parse(cut.end);

  const result: BusyInterval[] = [];

  for (const interval of intervals) {
    const intervalStart = Date.parse(interval.start);
    const intervalEnd = Date.parse(interval.end);

    // No overlap: keep as-is
    if (intervalEnd <= cutStart || intervalStart >= cutEnd) {
      result.push(interval);
      continue;
    }

    // Cut covers the entire interval: drop it
    if (cutStart <= intervalStart && cutEnd >= intervalEnd) {
      continue;
    }

    // Cut trims only the start
    if (cutStart <= intervalStart && cutEnd < intervalEnd) {
      result.push({
        start: cut.end,
        end: interval.end,
      });
      continue;
    }

    // Cut trims only the end
    if (cutStart > intervalStart && cutEnd >= intervalEnd) {
      result.push({
        start: interval.start,
        end: cut.start,
      });
      continue;
    }

    // Cut is strictly inside: split into two
    if (cutStart > intervalStart && cutEnd < intervalEnd) {
      result.push({
        start: interval.start,
        end: cut.start,
      });
      result.push({
        start: cut.end,
        end: interval.end,
      });
      continue;
    }
  }

  return result;
}

/**
 * Drop external busy events that are just the mirror of a Zebri booking.
 *
 * Confirming a booking pushes it to the MC's Google or Outlook calendar, so
 * free/busy hands the same appointment straight back. Left in, the grid draws
 * an external busy block underneath the booking's own chip and the agenda
 * lists one commitment twice.
 *
 * Matched by the provider's event id where both sides have one, because Zebri
 * stored that id when it created the event. Times are only a fallback: a
 * reschedule, a provider normalising a timestamp, or an event created before
 * ids were captured all defeat exact time matching, and a genuinely separate
 * meeting that happens to occupy the same half hour would be wrongly hidden by
 * it.
 *
 * @param busy - external busy events from the MC's connected calendars
 * @param bookings - the MC's Zebri bookings, with their stored external ids
 * @returns busy events with the mirrored ones removed
 */
export function excludeBookingMirrors<T extends { start: string; end: string; id?: string }>(
  busy: T[],
  bookings: Array<{
    start: string;
    end: string;
    externalEventIds?: Record<string, string> | null;
  }>,
): T[] {
  if (bookings.length === 0) return busy;

  const mirroredIds = new Set<string>();
  for (const booking of bookings) {
    for (const eventId of Object.values(booking.externalEventIds ?? {})) {
      if (eventId) mirroredIds.add(eventId);
    }
  }

  // Compare instants rather than strings: the same moment is expressible in
  // more than one ISO form, and providers do not agree on which to send.
  const bookingTimes = new Set(
    bookings.map((b) => `${Date.parse(b.start)}-${Date.parse(b.end)}`),
  );

  return busy.filter((event) => {
    if (event.id && mirroredIds.has(event.id)) return false;
    return !bookingTimes.has(`${Date.parse(event.start)}-${Date.parse(event.end)}`);
  });
}
