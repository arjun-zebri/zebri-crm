/**
 * Regression test for the day view's booking query window.
 *
 * The window used to be built with setUTCHours(0), which selects the previous
 * day for anyone east of UTC. An MC in Melbourne looking at 21 August fetched
 * the 20th, so none of the day's bookings came back and the grid showed only
 * the external calendar's copy of each one.
 *
 * @module tests/unit/app/calendar/day-view-range
 */
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { DayView } from '@/app/(dashboard)/calendar/_components/calendar-day-view';
import { zonedDateParts } from '@/lib/scheduling/timezone';

/** Records the window the view asks for, which is what these tests inspect. */
const useBookingsInRange =
  vi.fn<(from: Date, to: Date) => { data: never[]; isLoading: boolean; error: null }>(
    () => ({ data: [], isLoading: false, error: null }),
  );

vi.mock('@/app/(dashboard)/calendar/use-bookings', () => ({
  useBookings: () => ({ data: [], isLoading: false, error: null }),
  useBookingsInRange: (from: Date, to: Date) => useBookingsInRange(from, to),
}));

const availabilityResult = {
  data: { rules: [], overrides: [], timezone: 'Australia/Melbourne' },
  isLoading: false,
  error: null,
};
vi.mock('@/app/(dashboard)/calendar/use-availability', () => ({
  useAvailability: () => availabilityResult,
}));

const busyResult = { data: { busy: [], unavailable: false }, isLoading: false, error: null };
vi.mock('@/app/(dashboard)/calendar/use-busy', () => ({
  useBusyRange: () => busyResult,
}));

describe('DayView booking query window', () => {
  beforeEach(() => {
    useBookingsInRange.mockClear();
  });

  it('asks for the MC local day, not the UTC day', () => {
    // Local midnight on 21 August in Melbourne is 20 August 14:00Z. A UTC-day
    // window would run 20 Aug 00:00Z to 20 Aug 23:59Z and miss the whole day.
    const currentDate = new Date('2026-08-21T06:30:00Z');

    render(
      <DayView
        currentDate={currentDate}
        eventsByDate={{}}
        onSelectCouple={vi.fn()}
        onSelectBooking={vi.fn()}
      />
    );

    expect(useBookingsInRange).toHaveBeenCalled();
    const [from, to] = useBookingsInRange.mock.calls[0]!;

    expect(from.toISOString()).toBe('2026-08-20T14:00:00.000Z');
    expect(to.toISOString()).toBe('2026-08-21T14:00:00.000Z');
  });

  it('covers a booking sitting late in the local day', () => {
    // 16:30 Melbourne on the 21st is 06:30Z, which the old UTC window excluded.
    const currentDate = new Date('2026-08-21T06:30:00Z');

    render(
      <DayView
        currentDate={currentDate}
        eventsByDate={{}}
        onSelectCouple={vi.fn()}
        onSelectBooking={vi.fn()}
      />
    );

    const [from, to] = useBookingsInRange.mock.calls[0]!;
    const booking = new Date('2026-08-21T06:30:00Z');

    expect(booking.getTime()).toBeGreaterThanOrEqual(from.getTime());
    expect(booking.getTime()).toBeLessThan(to.getTime());
  });

  it('spans exactly one local day', () => {
    render(
      <DayView
        currentDate={new Date('2026-08-21T06:30:00Z')}
        eventsByDate={{}}
        onSelectCouple={vi.fn()}
        onSelectBooking={vi.fn()}
      />
    );

    const [from, to] = useBookingsInRange.mock.calls[0]!;
    const { date: fromDate } = zonedDateParts(from, 'Australia/Melbourne');

    expect(fromDate).toBe('2026-08-21');
    expect(to.getTime() - from.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});
