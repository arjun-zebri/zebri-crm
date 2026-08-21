/**
 * Current-time indicator line for today's column in the grid.
 *
 * Renders a thin line at the current time across today's column,
 * with a small badge showing the time. Only renders on the current date.
 *
 * @module app/(dashboard)/calendar/_components/grid-current-time-indicator
 */
import { minutesFromGridStart } from '@/lib/calendar/grid-layout';
import type { GridConfig } from '@/lib/calendar/grid-layout';
import { getLocalDayStart } from '@/lib/calendar/timezone';

/**
 * Props for GridCurrentTimeIndicator.
 */
export interface GridCurrentTimeIndicatorProps {
  /** The date this column represents (UTC instant). */
  columnDate: Date;
  /** Start of this column's day (UTC instant). */
  dayStart: Date;
  /** Grid configuration. */
  gridConfig: GridConfig;
  /** MC's timezone (IANA string). */
  timezone: string;
}

/**
 * Current-time indicator line.
 *
 * Renders only if the column date matches today in the MC's timezone.
 * Positioned absolutely at the current time, showing a thin line with a label.
 *
 * @param props - GridCurrentTimeIndicatorProps
 * @returns JSX element or null
 */
export function GridCurrentTimeIndicator({
  columnDate,
  dayStart,
  gridConfig,
  timezone,
}: GridCurrentTimeIndicatorProps) {
  const now = new Date();
  const todayInTz = getLocalDayStart(now, timezone);
  const columnInTz = getLocalDayStart(columnDate, timezone);

  // Only show on today's column
  if (todayInTz.getTime() !== columnInTz.getTime()) {
    return null;
  }

  // Minutes since local midnight, on the same wall clock as the hour labels.
  const minutesIntoDay = minutesFromGridStart(now, dayStart, gridConfig.timeZone);
  const gridStartMinutes = gridConfig.startHour * 60;
  const gridEndMinutes = gridConfig.endHour * 60;

  // Outside the visible window: before the first row or past the last.
  if (minutesIntoDay < gridStartMinutes || minutesIntoDay > gridEndMinutes) {
    return null;
  }

  // Position is measured from the grid's first row, not from midnight. The
  // two differ by startHour, which on a grid starting at 08:00 put the line
  // eight hours below where it belonged.
  const topPx = (minutesIntoDay - gridStartMinutes) * gridConfig.pxPerMinute;

  // Formatted in the MC's timezone, not the browser's: an MC in Perth loading
  // a Sydney-timezone calendar must see the badge agree with the row it sits on.
  const badge = new Intl.DateTimeFormat('en-GB', {
    timeZone: gridConfig.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);

  return (
    <div
      className="absolute left-0 right-0 pointer-events-none z-10"
      style={{ top: `${topPx}px` }}
      data-testid="grid-current-time-indicator"
    >
      {/* Line */}
      <div className="absolute -left-1 right-0 h-0.5 bg-danger" />

      {/* Time badge */}
      <div className="absolute -left-14 -top-2 text-body text-danger font-medium">
        {badge}
      </div>
    </div>
  );
}
