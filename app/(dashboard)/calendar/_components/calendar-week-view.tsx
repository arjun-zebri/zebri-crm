/**
 * Week view with seven day columns sharing one hour rail.
 *
 * Reuses Day view components: GridHourColumn, GridAvailabilityBands,
 * GridBusyBlocks, GridBookingChip, GridAllDayBand. Each column computes
 * its own availability and overlaps independently, but shares the grid window
 * so hours line up across the week.
 *
 * @module app/(dashboard)/calendar/_components/calendar-week-view
 */
'use client';

import { useMemo } from 'react';

import type { GridConfig } from '@/lib/calendar/grid-layout';
import { layoutOverlaps } from '@/lib/calendar/grid-layout';
import { DAY_HEADER_HEIGHT_PX } from '@/lib/calendar/grid-layout';
import { PX_PER_MINUTE } from '@/lib/calendar/grid-layout';
import { computeGridWindow, toContentHours } from '@/lib/calendar/grid-window';
import { excludeBookingMirrors } from '@/lib/calendar/intervals';
import { getLocalDayStart } from '@/lib/calendar/timezone';
import { zonedDateParts, zonedTimeToUtc } from '@/lib/scheduling/timezone';

import { useAvailability } from '../use-availability';
import type { Booking } from '../use-bookings';
import { useBookingsInRange } from '../use-bookings';
import { useBusyRange } from '../use-busy';
import { useMcTimezone } from '../use-mc-timezone';

import { CalendarLegend } from './calendar-legend';
import { CalendarSkeleton } from './calendar-skeleton';
import { CalendarWeekDayColumn } from './calendar-week-day-column';
import { GridAllDayBand, type AllDayEvent } from './grid-all-day-band';
import { GridHourColumn } from './grid-hour-column';

/**
 * Props for WeekView.
 */
export interface WeekViewProps {
  /** The date for the week (can be any date in the week). */
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
 * Week view with seven day columns sharing one hour rail.
 *
 * @param props - WeekViewProps
 * @returns JSX element
 */
export function WeekView({
  currentDate,
  eventsByDate,
  onSelectCouple,
  onSelectBooking,
}: WeekViewProps) {
  // Data fetching
  const { data: availability, isLoading: availLoading } = useAvailability();
  const timezone = useMcTimezone();

  // Get the week dates and query range in local time when timezone is available
  const { weekDates, weekStartUtc, weekEndUtc } = useMemo(() => {
    // Fallback: compute week boundary using UTC timezone (same logic as the main path)
    // This ensures consistency between the fallback and main paths
    if (!availability) {
      const fallbackTz = 'UTC';
      const { date: localDate, weekday: localWeekday } = zonedDateParts(currentDate, fallbackTz);
      const [yearStr, monthStr, dayStr] = localDate.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);
      const day = Number(dayStr);

      const daysToSunday = localWeekday;
      const dayNum = day - daysToSunday;
      let sundayYear: number = year;
      let sundayMonth: number = month;
      let sundayDay: number = dayNum;

      if (sundayDay < 1) {
        sundayMonth--;
        if (sundayMonth < 1) {
          sundayMonth = 12;
          sundayYear--;
        }
        const daysInPrevMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        if (sundayMonth === 2 && ((sundayYear % 4 === 0 && sundayYear % 100 !== 0) || sundayYear % 400 === 0)) {
          sundayDay += 29;
        } else {
          sundayDay += daysInPrevMonth[sundayMonth - 1]!;
        }
      }

      const sundayDateStr = `${sundayYear}-${String(sundayMonth).padStart(2, '0')}-${String(sundayDay).padStart(2, '0')}`;
      const localWeekStartUtc = zonedTimeToUtc(sundayDateStr, '00:00', fallbackTz);

      let nextYear: number = sundayYear;
      let nextMonth: number = sundayMonth;
      let nextDay: number = sundayDay + 7;
      const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      if (nextMonth === 2 && ((nextYear % 4 === 0 && nextYear % 100 !== 0) || nextYear % 400 === 0)) {
        if (nextDay > 29) {
          nextDay -= 29;
          nextMonth++;
          if (nextMonth > 12) {
            nextMonth = 1;
            nextYear++;
          }
        }
      } else {
        if (nextDay > daysInMonth[nextMonth - 1]!) {
          nextDay -= daysInMonth[nextMonth - 1]!;
          nextMonth++;
          if (nextMonth > 12) {
            nextMonth = 1;
            nextYear++;
          }
        }
      }
      const nextSundayDateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
      const localWeekEndUtc = zonedTimeToUtc(nextSundayDateStr, '00:00', fallbackTz);

      const dates: Date[] = [];
      let currentYear: number = sundayYear;
      let currentMonth: number = sundayMonth;
      let currentDay: number = sundayDay;

      for (let i = 0; i < 7; i++) {
        const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
        const utcInstant = zonedTimeToUtc(dateStr, '00:00', fallbackTz);
        dates.push(utcInstant);

        currentDay++;
        const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        if (currentMonth === 2 && ((currentYear % 4 === 0 && currentYear % 100 !== 0) || currentYear % 400 === 0)) {
          if (currentDay > 29) {
            currentDay = 1;
            currentMonth++;
            if (currentMonth > 12) {
              currentMonth = 1;
              currentYear++;
            }
          }
        } else {
          if (currentDay > daysInMonth[currentMonth - 1]!) {
            currentDay = 1;
            currentMonth++;
            if (currentMonth > 12) {
              currentMonth = 1;
              currentYear++;
            }
          }
        }
      }

      return {
        weekDates: dates,
        weekStartUtc: localWeekStartUtc,
        weekEndUtc: localWeekEndUtc,
      };
    }

    // Compute week start in the MC's local timezone to ensure column boundaries are local
    const { date: localDate, weekday: localWeekday } = zonedDateParts(
      currentDate,
      timezone,
    );
    const [yearStr, monthStr, dayStr] = localDate.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);

    // Compute local Sunday by working with date strings (avoids timezone confusion)
    // Subtract weekday days to get Sunday
    const daysToSunday = localWeekday;
    const dayNum = day - daysToSunday;
    let sundayYear: number = year;
    let sundayMonth: number = month;
    let sundayDay: number = dayNum;

    // Handle month wraparound
    if (sundayDay < 1) {
      sundayMonth--;
      if (sundayMonth < 1) {
        sundayMonth = 12;
        sundayYear--;
      }
      // Days in previous month
      const daysInPrevMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      if (sundayMonth === 2 && ((sundayYear % 4 === 0 && sundayYear % 100 !== 0) || sundayYear % 400 === 0)) {
        sundayDay += 29;
      } else {
        sundayDay += daysInPrevMonth[sundayMonth - 1]!;
      }
    }

    const sundayDateStr = `${sundayYear}-${String(sundayMonth).padStart(2, '0')}-${String(sundayDay).padStart(2, '0')}`;

    // Get UTC instant of local Sunday 00:00
    const localWeekStartUtc = zonedTimeToUtc(sundayDateStr, '00:00', timezone);

    // Compute next Sunday (7 days ahead) using date string arithmetic
    let nextYear: number = sundayYear;
    let nextMonth: number = sundayMonth;
    let nextDay: number = sundayDay + 7;
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (nextMonth === 2 && ((nextYear % 4 === 0 && nextYear % 100 !== 0) || nextYear % 400 === 0)) {
      if (nextDay > 29) {
        nextDay -= 29;
        nextMonth++;
        if (nextMonth > 12) {
          nextMonth = 1;
          nextYear++;
        }
      }
    } else {
      if (nextDay > daysInMonth[nextMonth - 1]!) {
        nextDay -= daysInMonth[nextMonth - 1]!;
        nextMonth++;
        if (nextMonth > 12) {
          nextMonth = 1;
          nextYear++;
        }
      }
    }
    const nextSundayDateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
    const localWeekEndUtc = zonedTimeToUtc(nextSundayDateStr, '00:00', timezone);

    // Generate 7 week dates in UTC starting from local week start
    // Work with date strings to properly handle DST
    const dates: Date[] = [];
    let currentYear: number = sundayYear;
    let currentMonth: number = sundayMonth;
    let currentDay: number = sundayDay;

    for (let i = 0; i < 7; i++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
      const utcInstant = zonedTimeToUtc(dateStr, '00:00', timezone);
      dates.push(utcInstant);

      // Advance to next day
      currentDay++;
      const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      if (currentMonth === 2 && ((currentYear % 4 === 0 && currentYear % 100 !== 0) || currentYear % 400 === 0)) {
        if (currentDay > 29) {
          currentDay = 1;
          currentMonth++;
          if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
          }
        }
      } else {
        if (currentDay > daysInMonth[currentMonth - 1]!) {
          currentDay = 1;
          currentMonth++;
          if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
          }
        }
      }
    }

    return {
      weekDates: dates,
      weekStartUtc: localWeekStartUtc,
      weekEndUtc: localWeekEndUtc,
    };
  }, [currentDate, availability, timezone]);

  const { data: bookings = [], isLoading: bookingsLoading } = useBookingsInRange(
    weekStartUtc,
    weekEndUtc,
  );

  // Fetch busy intervals for the entire week. Dates are taken in the MC's
  // timezone, not via toISOString: the UTC date of a local week boundary can
  // land on the previous day, which would request the wrong week entirely.
  const { date: dateStrFrom } = zonedDateParts(weekStartUtc, timezone);
  const { date: dateStrTo } = zonedDateParts(new Date(weekEndUtc.getTime() - 1), timezone);
  const { data: busyData, isLoading: busyLoading } = useBusyRange(dateStrFrom, dateStrTo);

  // Filter bookings by status
  const confirmedBookings = bookings.filter(
    (b) => b.status === 'confirmed' || b.status === 'completed',
  );

  // Compute grid window from availability, widened to cover everything drawn
  // this week. Availability alone is not enough: an early-morning external
  // meeting or an evening wedding falls outside the bookable hours, and a
  // window that ends before it would clamp it to the grid edge instead of
  // showing it.
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

  // Weddings for any day in the visible week, flattened into the band above
  // the grid. They have no start time, so they cannot sit on the hour rows.
  const allDayEvents: AllDayEvent[] = weekDates.flatMap((dayDate) => {
    const { date } = zonedDateParts(dayDate, timezone);
    return eventsByDate[date] ?? [];
  });

  // Loading state
  if (availLoading || bookingsLoading || busyLoading) {
    return <CalendarSkeleton view="week" />;
  }

  const unavailable = busyData?.unavailable;

  const WEEKDAY_NAMES: string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
        {/* Hour column (fixed on left) */}
        <GridHourColumn
          startHour={startHour}
          endHour={endHour}
          pxPerMinute={PX_PER_MINUTE}
          gridHeightPx={gridHeightPx}
          topOffsetPx={DAY_HEADER_HEIGHT_PX}
        />

        {/* Seven day columns */}
        <div className="flex flex-1 divide-x divide-border items-start">
          {weekDates.map((dayDate, dayIndex) => {
            const dayWeekday = dayIndex;
            const dayStart = getLocalDayStart(dayDate, timezone);
            const rulesForWeekday = availability?.rules.filter((r) => r.weekday === dayWeekday) || [];
            const overridesForDate = availability?.overrides || [];
            const bookingsForDay = confirmedBookings.filter((b) => {
              const bookingDate = new Date(b.starts_at);
              const bookingLocalDate = getLocalDayStart(bookingDate, timezone);
              return bookingLocalDate.getTime() === dayStart.getTime();
            });
            const bookingsForLayout = bookingsForDay.map((b) => ({
              ...b,
              start: b.starts_at,
              end: b.ends_at,
            }));
            const layoutResult = layoutOverlaps(bookingsForLayout);
            const busyForDay = excludeBookingMirrors(
              busyData?.busy.filter((b) => {
                const busyDate = new Date(b.start);
                const busyLocalDate = getLocalDayStart(busyDate, timezone);
                return busyLocalDate.getTime() === dayStart.getTime();
              }) ?? [],
              confirmedBookings.map((b) => ({
                start: b.starts_at,
                end: b.ends_at,
                externalEventIds: b.external_event_ids,
              })),
            );

            return (
              <CalendarWeekDayColumn
                key={dayIndex}
                dayIndex={dayIndex}
                dayDate={dayDate}
                weekdayName={WEEKDAY_NAMES[dayWeekday] ?? 'Sun'}
                dayStart={dayStart}
                gridConfig={gridConfig}
                gridHeightPx={gridHeightPx}
                timezone={timezone}
                rulesForWeekday={rulesForWeekday}
                overridesForDate={overridesForDate}
                bookingsForDay={bookingsForDay}
                layoutResult={layoutResult}
                busyForDay={busyForDay}
                onSelectBooking={onSelectBooking}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
