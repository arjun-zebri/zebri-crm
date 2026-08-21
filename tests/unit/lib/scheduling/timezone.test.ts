import { describe, expect, it } from 'vitest';

import { zonedDateParts, zonedTimeToUtc } from '@/lib/scheduling/timezone';

describe('zonedTimeToUtc', () => {
  it('converts Sydney winter time (AEST, UTC+10)', () => {
    expect(zonedTimeToUtc('2026-07-15', '10:00', 'Australia/Sydney').toISOString()).toBe(
      '2026-07-15T00:00:00.000Z',
    );
  });

  it('converts Sydney summer time (AEDT, UTC+11)', () => {
    expect(zonedTimeToUtc('2026-12-15', '10:00', 'Australia/Sydney').toISOString()).toBe(
      '2026-12-14T23:00:00.000Z',
    );
  });

  it('is correct on the AEDT spring-forward day (2026-10-04)', () => {
    // DST starts 2026-10-04 02:00 AEST -> 03:00 AEDT in Australia/Sydney.
    // 10:00 that morning is already AEDT (UTC+11).
    expect(zonedTimeToUtc('2026-10-04', '10:00', 'Australia/Sydney').toISOString()).toBe(
      '2026-10-03T23:00:00.000Z',
    );
    // 01:00, before the jump, is still AEST (UTC+10).
    expect(zonedTimeToUtc('2026-10-04', '01:00', 'Australia/Sydney').toISOString()).toBe(
      '2026-10-03T15:00:00.000Z',
    );
  });

  it('handles a UTC zone and a negative-offset zone', () => {
    expect(zonedTimeToUtc('2026-03-01', '12:00', 'UTC').toISOString()).toBe(
      '2026-03-01T12:00:00.000Z',
    );
    expect(zonedTimeToUtc('2026-03-01', '12:00', 'America/New_York').toISOString()).toBe(
      '2026-03-01T17:00:00.000Z',
    );
  });
});

describe('zonedDateParts', () => {
  it('crosses the date line correctly', () => {
    // 14:30 UTC on Jan 5 is Jan 6, 01:30 in Sydney (AEDT).
    expect(zonedDateParts(new Date('2026-01-05T14:30:00Z'), 'Australia/Sydney')).toEqual({
      date: '2026-01-06',
      weekday: 2,
    });
  });

  it('maps weekdays 0..6 Sunday-first', () => {
    // 2026-01-04 is a Sunday in UTC.
    expect(zonedDateParts(new Date('2026-01-04T12:00:00Z'), 'UTC').weekday).toBe(0);
  });
});
