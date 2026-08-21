/**
 * Booking presentation helper tests.
 *
 * These strings appear on every booking surface, so the cases that matter are
 * the timezone ones: an instant that lands on a different calendar day in the
 * MC's zone must group and read as that day.
 *
 * @module tests/unit/app/calendar/booking-display
 */

import { describe, it, expect } from 'vitest';

import {
  formatCountdown,
  formatDayHeading,
  formatFullDate,
  formatShortDate,
  formatTime,
  formatTimeRange,
  groupByDay,
  locationLabel,
} from '@/app/(dashboard)/calendar/booking-display';
import type { Booking } from '@/app/(dashboard)/calendar/use-bookings';

const SYDNEY = 'Australia/Sydney';

/** A booking at a given instant, with everything else stubbed out. */
function booking(id: string, startsAt: string, endsAt: string, status = 'confirmed'): Booking {
  return {
    id,
    name: `Booker ${id}`,
    email: 'booker@example.com',
    partner_name: null,
    phone: null,
    starts_at: startsAt,
    ends_at: endsAt,
    status,
    notes: null,
    video_join_url: null,
    external_event_ids: null,
    created_at: '2026-08-18T02:00:00Z',
    timezone: SYDNEY,
    couple: null,
    meeting_type: null,
  };
}

describe('locationLabel', () => {
  it('reads each location type as prose', () => {
    expect(locationLabel('video')).toBe('video call');
    expect(locationLabel('phone')).toBe('phone');
    expect(locationLabel('in_person')).toBe('in person');
  });

  it('falls back to the raw value, de-underscored', () => {
    expect(locationLabel('some_new_type')).toBe('some new type');
    expect(locationLabel(null)).toBe('');
  });
});

describe('formatTime', () => {
  it('renders the MC-zone clock time with no space before the meridiem', () => {
    expect(formatTime('2026-08-21T06:30:00Z', SYDNEY)).toBe('4:30pm');
  });

  it('uses the given zone, not the host zone', () => {
    expect(formatTime('2026-08-21T06:30:00Z', 'UTC')).toBe('6:30am');
  });
});

describe('formatTimeRange', () => {
  it('spans start to end and names the zone', () => {
    expect(formatTimeRange('2026-08-21T06:30:00Z', '2026-08-21T07:00:00Z', SYDNEY)).toBe(
      '4:30pm–5:00pm AEST',
    );
  });
});

describe('formatFullDate / formatShortDate', () => {
  it('formats in the MC zone', () => {
    expect(formatFullDate('2026-08-21T06:30:00Z', SYDNEY)).toBe('Fri 21 Aug 2026');
    expect(formatShortDate('2026-08-18T02:00:00Z', SYDNEY)).toBe('18 Aug');
  });

  it('rolls the date over when the zone puts the instant on the next day', () => {
    // 2026-08-20T16:00Z is already 21 Aug in Sydney.
    expect(formatFullDate('2026-08-20T16:00:00Z', SYDNEY)).toBe('Fri 21 Aug 2026');
    expect(formatFullDate('2026-08-20T16:00:00Z', 'UTC')).toBe('Thu 20 Aug 2026');
  });
});

describe('formatDayHeading', () => {
  const now = new Date('2026-08-20T15:00:00Z'); // 21 Aug 01:00 in Sydney

  it('prefixes today and tomorrow', () => {
    expect(formatDayHeading('2026-08-20T16:00:00Z', SYDNEY, now)).toBe('Today · Fri 21 Aug');
    expect(formatDayHeading('2026-08-21T23:00:00Z', SYDNEY, now)).toBe('Tomorrow · Sat 22 Aug');
  });

  it('leaves other days as a plain date', () => {
    expect(formatDayHeading('2026-08-24T02:00:00Z', SYDNEY, now)).toBe('Mon 24 Aug');
  });
});

describe('formatCountdown', () => {
  const now = new Date('2026-08-21T06:30:00Z');

  it('counts down to a future booking', () => {
    expect(
      formatCountdown(
        { starts_at: '2026-08-21T08:30:00Z', ends_at: '2026-08-21T09:00:00Z', status: 'confirmed' },
        now,
      ),
    ).toBe('Starts in 2 hours');
  });

  it('says when a booking is running', () => {
    expect(
      formatCountdown(
        { starts_at: '2026-08-21T06:00:00Z', ends_at: '2026-08-21T07:00:00Z', status: 'confirmed' },
        now,
      ),
    ).toBe('Happening now');
  });

  it('measures a finished booking from its end', () => {
    expect(
      formatCountdown(
        { starts_at: '2026-08-18T06:00:00Z', ends_at: '2026-08-18T06:30:00Z', status: 'confirmed' },
        now,
      ),
    ).toBe('Ended 3 days ago');
  });

  it('stays silent for a cancelled booking', () => {
    expect(
      formatCountdown(
        { starts_at: '2026-08-21T08:30:00Z', ends_at: '2026-08-21T09:00:00Z', status: 'cancelled' },
        now,
      ),
    ).toBe('');
  });
});

describe('groupByDay', () => {
  const now = new Date('2026-08-20T15:00:00Z');

  it('groups consecutive bookings that share an MC-zone date', () => {
    const groups = groupByDay(
      [
        booking('a', '2026-08-20T16:00:00Z', '2026-08-20T16:30:00Z'),
        booking('b', '2026-08-20T23:00:00Z', '2026-08-20T23:30:00Z'),
        booking('c', '2026-08-21T23:00:00Z', '2026-08-21T23:30:00Z'),
      ],
      SYDNEY,
      now,
    );

    expect(groups).toHaveLength(2);
    expect(groups[0]?.heading).toBe('Today · Fri 21 Aug');
    expect(groups[0]?.isToday).toBe(true);
    expect(groups[0]?.bookings.map((b) => b.id)).toEqual(['a', 'b']);
    expect(groups[1]?.heading).toBe('Tomorrow · Sat 22 Aug');
    expect(groups[1]?.isToday).toBe(false);
  });

  it('returns nothing for an empty list', () => {
    expect(groupByDay([], SYDNEY, now)).toEqual([]);
  });
});
