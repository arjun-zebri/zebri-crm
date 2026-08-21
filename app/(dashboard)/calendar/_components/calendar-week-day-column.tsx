/**
 * Single day column for week view grid.
 * Renders header, availability bands, busy blocks, and booking chips for one day.
 *
 * @module app/(dashboard)/calendar/_components/calendar-week-day-column
 */
import type { BusyEvent } from '@/lib/calendar/free-busy';
import { DAY_HEADER_HEIGHT_PX, type GridConfig } from '@/lib/calendar/grid-layout';
import { zonedDateParts } from '@/lib/scheduling/timezone';
import type { Database } from '@/types/database';

import type { Booking } from '../use-bookings';

type AvailabilityRule = Database['public']['Tables']['availability_rules']['Row'];
type AvailabilityOverride = Database['public']['Tables']['availability_overrides']['Row'];

import { GridAvailabilityBands } from './grid-availability-bands';
import { GridBookingChip } from './grid-booking-chip';
import { GridBusyBlocks } from './grid-busy-blocks';
import { GridCurrentTimeIndicator } from './grid-current-time-indicator';

/**
 * Props for CalendarWeekDayColumn.
 */
export interface CalendarWeekDayColumnProps {
  /** Index 0-6 for Sunday-Saturday. */
  dayIndex: number;
  /** UTC instant representing midnight of this day in MC's timezone. */
  dayDate: Date;
  /** Weekday name for display. */
  weekdayName: string;
  /** Start of day in MC's timezone. */
  dayStart: Date;
  /** Grid configuration. */
  gridConfig: GridConfig;
  /** Height of grid in pixels. */
  gridHeightPx: number;
  /** MC's timezone (IANA string). */
  timezone: string;
  /** Availability rules for this weekday. */
  rulesForWeekday: AvailabilityRule[];
  /** Availability overrides for any date. */
  overridesForDate: AvailabilityOverride[];
  /** Bookings for this day. */
  bookingsForDay: Booking[];
  /** Layout results from layoutOverlaps. */
  layoutResult: Array<{ item: Booking; col: number; totalCols: number }>;
  /** External busy events for this day. */
  busyForDay: BusyEvent[];
  /** Callback when booking is selected. */
  onSelectBooking: (booking: Booking) => void;
}

/**
 * Single day column for week view.
 * Renders day header, availability bands, busy blocks, booking chips, and time indicator.
 *
 * @param props - CalendarWeekDayColumnProps
 * @returns JSX element
 */
export function CalendarWeekDayColumn({
  dayIndex,
  dayDate,
  weekdayName,
  dayStart,
  gridConfig,
  gridHeightPx,
  timezone,
  rulesForWeekday,
  overridesForDate,
  bookingsForDay,
  layoutResult,
  busyForDay,
  onSelectBooking,
}: CalendarWeekDayColumnProps) {
  const { date: localDate } = zonedDateParts(dayDate, timezone);
  const dayNumberStr = localDate.split('-')[2];

  return (
    <div
      key={dayIndex}
      data-testid={`grid-day-column-${dayIndex}`}
      className="flex-1 relative flex flex-col"
      // Explicit height rather than letting the row stretch it. As a flex item
      // the column would otherwise take the height of the VISIBLE track, so its
      // background and the divide-x rule between columns stopped at the fold
      // while the absolutely positioned chips inside carried on down the page.
      style={{ height: `${DAY_HEADER_HEIGHT_PX + gridHeightPx}px` }}
    >
      {/* Day header. Height is shared with the hour rail via DAY_HEADER_HEIGHT_PX
          so the two stay aligned; change one and you must change the other. */}
      <div
        className="flex-shrink-0 px-3 flex flex-col items-center justify-center text-center border-b border-border"
        style={{ height: `${DAY_HEADER_HEIGHT_PX}px` }}
      >
        <div className="text-body text-text-muted font-medium">{weekdayName}</div>
        <div
          className="text-body font-semibold mt-0.5 text-text"
          data-testid={`grid-day-header-${dayIndex}`}
        >
          {dayNumberStr}
        </div>
      </div>

      {/* Grid content */}
      {/* No flex-1 here. This is a column flex container, so flex-1 would make
          the flex algorithm size the body to the visible track and silently
          override the explicit height, leaving the body a different length
          from the hour rail and every label pointing at the wrong time. */}
      <div
        className="relative overflow-hidden shrink-0"
        style={{ height: `${gridHeightPx}px` }}
      >
        {/* Availability bands (background) */}
        <GridAvailabilityBands
          rulesForWeekday={rulesForWeekday}
          overridesForDate={overridesForDate}
          date={dayDate}
          dayStart={dayStart}
          gridConfig={gridConfig}
          timezone={timezone}
        />

        {/* Busy blocks (external calendar) */}
        {busyForDay.length > 0 && (
          <GridBusyBlocks busy={busyForDay} dayStart={dayStart} gridConfig={gridConfig} />
        )}

        {/* Booking chips (foreground) */}
        {/* No Empty state per column: seven of them across an ordinary week is
            noise, and the column already shows availability and busy blocks. */}
        {layoutResult.map((layout) => {
            const originalBooking = bookingsForDay.find((b) => b.id === layout.item.id);
            if (!originalBooking) return null;
            return (
              <GridBookingChip
                key={layout.item.id}
                booking={originalBooking}
                colIndex={layout.col}
                totalCols={layout.totalCols}
                dayStart={dayStart}
                gridConfig={gridConfig}
                onSelectBooking={onSelectBooking}
                data-testid={`grid-booking-chip-${layout.item.id}`}
              />
            );
        })}

        {/* Current-time indicator */}
        <GridCurrentTimeIndicator
          columnDate={dayDate}
          dayStart={dayStart}
          gridConfig={gridConfig}
          timezone={timezone}
        />
      </div>
    </div>
  );
}
