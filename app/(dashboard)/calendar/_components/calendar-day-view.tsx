/**
 * Day view with hour grid, availability bands, bookings, and all-day events.
 *
 * @module app/(dashboard)/calendar/_components/calendar-day-view
 */
'use client';

import { useMemo } from 'react';

import type { GridConfig } from '@/lib/calendar/grid-layout';
import { layoutOverlaps } from '@/lib/calendar/grid-layout';
import { PX_PER_MINUTE } from '@/lib/calendar/grid-layout';
import { computeGridWindow, toContentHours } from '@/lib/calendar/grid-window';
import { excludeBookingMirrors } from '@/lib/calendar/intervals';
import { getLocalDayEnd, getLocalDayStart } from '@/lib/calendar/timezone';
import { zonedDateParts } from '@/lib/scheduling/timezone';

import { useAvailability } from '../use-availability';
import type { Booking } from '../use-bookings';
import { useBookingsInRange } from '../use-bookings';
import { useBusyRange } from '../use-busy';
import { useMcTimezone } from '../use-mc-timezone';

import { CalendarLegend } from './calendar-legend';
import { CalendarSkeleton } from './calendar-skeleton';
import { GridAllDayBand, type AllDayEvent } from './grid-all-day-band';
import { GridAvailabilityBands } from './grid-availability-bands';
import { GridBookingChip } from './grid-booking-chip';
import { GridBusyBlocks } from './grid-busy-blocks';
import { GridCurrentTimeIndicator } from './grid-current-time-indicator';
import { GridHourColumn } from './grid-hour-column';

/**
 * Props for DayView.
 */
export interface DayViewProps {
  /** The date being displayed. */
  currentDate: Date;
  /**
   * Wedding events keyed by `YYYY-MM-DD` in the MC's timezone.
   *
   * Weddings are all-day, so they cannot be placed on the hour grid; they
   * render in the band above it. This was hardcoded to an empty list when the
   * grid was first built, which meant weddings were invisible in every view
   * except month.
   */
  eventsByDate: Record<string, AllDayEvent[]>;
  /** Callback when an all-day event (wedding) is clicked, passing couple ID. */
  onSelectCouple: (coupleId: string) => void;
  /** Callback when a booking chip is clicked. */
  onSelectBooking: (booking: Booking) => void;
}


/**
 * Day view with hour grid, availability bands, bookings, and all-day events.
 *
 * @param props - DayViewProps
 * @returns JSX element
 */
export function DayView({
  currentDate,
  eventsByDate,
  onSelectCouple,
  onSelectBooking,
}: DayViewProps) {
  // Data fetching
  const { data: availability, isLoading: availLoading } = useAvailability();
  const timezone = useMcTimezone();

  // The day the MC is looking at, in their own timezone.
  const dayStartLocal = useMemo(
    () => getLocalDayStart(currentDate, timezone),
    [currentDate, timezone],
  );
  const { date: dateStr, weekday } = zonedDateParts(currentDate, timezone);

  // Query range: the MC's local day, NOT the UTC day.
  //
  // This used to call setUTCHours(0) on the current date, which for anyone east
  // of UTC selects the previous day: local midnight on 21 August in Melbourne
  // is 20 August 14:00Z, so the view fetched the 20th and every one of the
  // day's bookings fell outside the window. The grid then showed only the
  // external calendar's copy of each booking, with no chip on top of it.
  // getLocalDayEnd, not +24h: DST changeover days are 23 or 25 hours long,
  // and a fixed 24h window drops the last local hour of a fall-back day.
  const dayEndLocal = useMemo(
    () => getLocalDayEnd(currentDate, timezone),
    [currentDate, timezone],
  );

  const { data: bookings = [], isLoading: bookingsLoading } = useBookingsInRange(
    dayStartLocal,
    dayEndLocal,
  );

  const { data: busyData, isLoading: busyLoading } = useBusyRange(dateStr, dateStr);

  // Filter and prepare data
  const rulesForWeekday =
    availability?.rules.filter((r) => r.weekday === weekday) || [];
  const overridesForDate = availability?.overrides || [];

  const confirmedBookings = bookings.filter(
    (b) => b.status === 'confirmed' || b.status === 'completed',
  );

  // Compute grid window from availability, widened to cover everything drawn
  // today. Availability alone is not enough: an early-morning external meeting
  // or an evening wedding falls outside the bookable hours, and a window that
  // ends before it would clamp it to the grid edge instead of showing it.
  const { startHour, endHour } = useMemo(() => {
    const contentHours = toContentHours(
      [
        ...confirmedBookings.map((b) => ({
                start: b.starts_at,
                end: b.ends_at,
                externalEventIds: b.external_event_ids,
              })),
        ...(busyData?.busy ?? []),
      ],
      timezone,
    );

    if (!availability || availLoading) {
      return computeGridWindow([], contentHours);
    }
    // Every rule counts, not just this weekday's: only the times matter, and a
    // window that changed shape from day to day would make the grid jump.
    return computeGridWindow(availability.rules, contentHours);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability, availLoading, bookings, busyData, timezone]);

  const gridConfig: GridConfig = {
    startHour,
    endHour,
    pxPerMinute: PX_PER_MINUTE,
    timeZone: timezone,
  };

  const gridHeightPx = (endHour - startHour) * 60 * PX_PER_MINUTE;

  // Layout overlaps for booking chips
  // Map bookings to format expected by layoutOverlaps (start/end instead of starts_at/ends_at)
  const bookingsForLayout = confirmedBookings.map((b) => ({
    ...b,
    start: b.starts_at,
    end: b.ends_at,
  }));
  const layoutResult = layoutOverlaps(bookingsForLayout);

  // Separate all-day events (for now, this is a placeholder for wedding events)
  // In the future, this would come from an Events query
  // Weddings on this day, shown in the band above the grid: they are all-day,
  // so there is no hour row that could hold them.
  const allDayEvents: AllDayEvent[] = eventsByDate[dateStr] ?? [];

  // Loading state
  if (availLoading || bookingsLoading || busyLoading) {
    return <CalendarSkeleton view="day" />;
  }

  // Unavailable busy state (external calendar fetch failed)
  const unavailable = busyData?.unavailable;

  return (
    <div className="flex flex-col h-full overflow-hidden gap-3">
      {/* Legend */}
      <CalendarLegend />

      {/* All-day events band */}
      {allDayEvents.length > 0 && (
        <GridAllDayBand events={allDayEvents} onSelectCouple={onSelectCouple} />
      )}

      {/* Unavailable notice */}
      {unavailable && (
        <div className="px-4 py-2 bg-warning/10 border-b border-warning text-text-muted text-body">
          Could not load your external calendar. Showing bookings only.
        </div>
      )}

      {/* Hour grid container */}
      <div className="flex flex-1 overflow-auto">
        {/* Hour column */}
        <GridHourColumn
          startHour={startHour}
          endHour={endHour}
          pxPerMinute={PX_PER_MINUTE}
          gridHeightPx={gridHeightPx}
        />

        {/* Grid content */}
        <div className="flex-1 relative" style={{ height: `${gridHeightPx}px` }}>
          {/* Availability bands (background) */}
          <GridAvailabilityBands
            rulesForWeekday={rulesForWeekday}
            overridesForDate={overridesForDate}
            date={currentDate}
            dayStart={dayStartLocal}
            gridConfig={gridConfig}
            timezone={timezone}
          />

          {/* Busy blocks (external calendar) */}
          {busyData?.busy && (
            <GridBusyBlocks
              busy={excludeBookingMirrors(
                busyData.busy,
                confirmedBookings.map((b) => ({
                start: b.starts_at,
                end: b.ends_at,
                externalEventIds: b.external_event_ids,
              })),
              )}
              dayStart={dayStartLocal}
              gridConfig={gridConfig}
            />
          )}

          {/* Booking chips (foreground) */}
          {/* No Empty state here. The grid itself is the content: it shows the
              day's availability, external busy blocks and the current time
              whether or not a Zebri booking exists, so an overlay reading "no
              bookings" sat on top of a visibly occupied day. */}
          {layoutResult.map((layout) => {
              // Find the original booking (without the added start/end fields)
              const originalBooking = confirmedBookings.find(
                (b) => b.id === layout.item.id,
              );
              if (!originalBooking) return null;
              return (
                <GridBookingChip
                  key={layout.item.id}
                  booking={originalBooking}
                  colIndex={layout.col}
                  totalCols={layout.totalCols}
                  dayStart={dayStartLocal}
                  gridConfig={gridConfig}
                  onSelectBooking={onSelectBooking}
                />
              );
          })}

          {/* Current-time indicator */}
          <GridCurrentTimeIndicator
            columnDate={currentDate}
            dayStart={dayStartLocal}
            gridConfig={gridConfig}
            timezone={timezone}
          />
        </div>
      </div>
    </div>
  );
}
