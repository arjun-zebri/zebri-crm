/**
 * Pure grid-layout engine for Day and Week hour grids.
 *
 * No React, no DOM, no dates-from-now. Every function takes what it needs
 * as arguments so tests can pin exact numbers.
 *
 * @module lib/calendar/grid-layout
 */

/**
 * Configuration for the grid: visible hour range and pixel density.
 *
 * @example
 * const cfg: GridConfig = { startHour: 6, endHour: 18, pxPerMinute: 2, timeZone: 'Australia/Sydney' };
 */
import { wallClockMinutesFrom } from '@/lib/calendar/timezone';

/**
 * Height in pixels of the weekday header above each week-view day column.
 *
 * The hour rail carries no header of its own, so it offsets its labels by
 * this much to line up with the columns beside it. Both sides read this
 * constant rather than hard-coding a Tailwind height, because a mismatch
 * misaligns every hour label in the grid without any visible error.
 */
export const DAY_HEADER_HEIGHT_PX = 56;

/**
 * Vertical scale of the hour grid, in pixels per minute.
 *
 * 2.25 puts an hour at 135px, so the shortest bookable slot (30 minutes) gets
 * ~67px: enough for the couple name and the meeting type on separate lines
 * without the chip clipping its own text. At the previous 1.5 an hour was 90px
 * and a half-hour booking had barely 30px of usable space once padding was
 * taken out, which is why chips looked cramped.
 */
export const PX_PER_MINUTE = 2.25;

export interface GridConfig {
  /** Start hour (0-23), inclusive. Grid renders from this hour. */
  startHour: number;
  /** End hour (0-23), exclusive. Grid renders up to but not including this hour. */
  endHour: number;
  /** Pixel height per minute. 2 = 120px per hour. */
  pxPerMinute: number;
  /**
   * IANA timezone the grid is rendered in.
   *
   * Lives on the config rather than travelling as a separate prop so that the
   * hour labels and the band positions are guaranteed to be computed against
   * the same clock. They were not, once, and every band on a daylight saving
   * changeover day was drawn an hour off its label.
   */
  timeZone: string;
}

/**
 * Minimum rendered height in pixels for any band, so small intervals stay
 * clickable and readable. 44px is 22 minutes at pxPerMinute=2. This is
 * chosen to match the DraggableEvent minimum in event-day-calendar.tsx
 * (line 139: `Math.max(liveDuration * MIN_PX, 44)`), ensuring the layout
 * engine and the renderer stay in sync.
 */
const MIN_HEIGHT_PX = 44;

/**
 * Calculates minutes elapsed from midnight to the given instant.
 *
 * @param instant - the point in time to measure
 * @param dayStart - the start of the day (used to establish timezone context; typically 00:00 UTC)
 * @returns minutes from midnight, including fractional minutes
 *
 * @example
 * const dayStart = new Date("2026-08-20T00:00:00Z");
 * const nineAm = new Date("2026-08-20T09:00:00Z");
 * minutesFromGridStart(nineAm, dayStart, 'Australia/Sydney'); // 540
 */
export function minutesFromGridStart(
  instant: Date,
  dayStart: Date,
  timeZone: string,
): number {
  return wallClockMinutesFrom(instant, dayStart, timeZone);
}

/**
 * Computes the top position and height of a band (interval) on the grid.
 *
 * Returns `null` if the interval lies entirely outside the visible window
 * (before startHour or after endHour). When the interval straddles an edge,
 * clamps the band to the grid: a booking that starts before startHour
 * renders from the top (topPx = 0); one that runs past endHour renders to
 * the bottom without overflow.
 *
 * Enforces a minimum rendered height (MIN_HEIGHT_PX) so small intervals
 * stay clickable, except when clamping would violate the grid boundary.
 * A band at the very bottom edge may be shorter than the minimum if
 * enforcing it would overflow the grid.
 *
 * @param interval - `{ start, end }` in ISO 8601 UTC strings
 * @param dayStart - start of the day, for context
 * @param cfg - grid config
 * @returns `{ topPx, heightPx }` or null if entirely outside the window
 */
export function bandGeometry(
  interval: { start: string; end: string },
  dayStart: Date,
  cfg: GridConfig,
): { topPx: number; heightPx: number } | null {
  const startMinutes = minutesFromGridStart(new Date(interval.start), dayStart, cfg.timeZone);
  const endMinutes = minutesFromGridStart(new Date(interval.end), dayStart, cfg.timeZone);

  // Grid boundaries in minutes from start of day
  const gridStartMinutes = cfg.startHour * 60;
  const gridEndMinutes = cfg.endHour * 60;

  // Interval entirely before grid start or entirely after grid end
  if (endMinutes <= gridStartMinutes || startMinutes >= gridEndMinutes) {
    return null;
  }

  // Clamp to grid boundaries
  const clampedStart = Math.max(startMinutes, gridStartMinutes);
  const clampedEnd = Math.min(endMinutes, gridEndMinutes);

  // Calculate pixel positions relative to grid start
  const gridRelativeStart = clampedStart - gridStartMinutes;
  const gridRelativeEnd = clampedEnd - gridStartMinutes;

  const topPx = gridRelativeStart * cfg.pxPerMinute;
  let heightPx = (gridRelativeEnd - gridRelativeStart) * cfg.pxPerMinute;

  // Enforce minimum height, but only if it doesn't overflow the grid bottom
  const gridHeightPx = (gridEndMinutes - gridStartMinutes) * cfg.pxPerMinute;
  if (heightPx < MIN_HEIGHT_PX && topPx + MIN_HEIGHT_PX <= gridHeightPx) {
    heightPx = MIN_HEIGHT_PX;
  }

  return { topPx, heightPx };
}

/**
 * Detects overlapping items and assigns column positions.
 *
 * Genuinely overlapping items (where one starts before the other ends) are
 * grouped together. Items that merely touch (one ends exactly when the next
 * starts) do NOT overlap and each get `totalCols: 1`.
 *
 * For each group of overlapping items, a column is assigned such that no
 * two items in the same column overlap. All items in a group report the
 * same `totalCols` value (the size of their overlap group).
 *
 * Algorithm: reuses the logic from `computeColumns` in
 * `components/events/event-day-calendar.tsx`: sort by start time, group
 * overlapping items, then assign columns within each group such that each
 * column is a "free" slot with no conflicts.
 *
 * @param items - array of items with `start` and `end` (ISO 8601 UTC strings)
 * @returns array of `{ item, col, totalCols }` in input order
 */
export function layoutOverlaps<T extends { start: string; end: string }>(
  items: T[],
): Array<{ item: T; col: number; totalCols: number }> {
  const result: Array<{ item: T; col: number; totalCols: number }> = [];

  if (items.length === 0) return result;

  // Map each item to its result index for later lookup
  const itemToIndexMap = new Map(items.map((item, idx) => [item, idx]));

  // Sort by start time using epoch milliseconds (consistent with intervals.ts)
  const sorted = [...items].sort((a, b) => {
    const aStart = Date.parse(a.start);
    const bStart = Date.parse(b.start);
    return aStart - bStart;
  });

  let i = 0;
  while (i < sorted.length) {
    // Start a new overlap group
    const group: T[] = [sorted[i]!];
    let maxEnd = Date.parse(sorted[i]!.end);

    // Find all items that overlap with any item in the group so far
    let j = i + 1;
    while (j < sorted.length) {
      const jStart = Date.parse(sorted[j]!.start);
      // Overlap: this item starts before the current group's max end
      if (jStart < maxEnd) {
        group.push(sorted[j]!);
        maxEnd = Math.max(maxEnd, Date.parse(sorted[j]!.end));
        j++;
      } else {
        break;
      }
    }

    // Assign columns within this group
    // colEnds[col] = epoch ms of when that column is free
    const colEnds: number[] = [];
    const columnAssignments = new Map<T, { col: number; totalCols: number }>();

    for (const item of group) {
      const itemStart = Date.parse(item.start);
      const itemEnd = Date.parse(item.end);

      // Find the first column that is free (its end time <= this item's start)
      let assigned = colEnds.findIndex((end) => end <= itemStart);
      if (assigned === -1) {
        // No free column, create a new one
        assigned = colEnds.length;
        colEnds.push(itemEnd);
      } else {
        // Reuse this column
        colEnds[assigned] = itemEnd;
      }

      columnAssignments.set(item, { col: assigned, totalCols: -1 });
    }

    // Now we know the group size; backfill totalCols
    const totalCols = colEnds.length;
    for (const item of group) {
      const assignment = columnAssignments.get(item)!;
      columnAssignments.set(item, { col: assignment.col, totalCols });
    }

    // Add to result in original input order
    for (const item of group) {
      const resultIdx = itemToIndexMap.get(item);
      if (resultIdx !== undefined) {
        result[resultIdx] = {
          item,
          ...columnAssignments.get(item)!,
        };
      }
    }

    i = j;
  }

  return result;
}
