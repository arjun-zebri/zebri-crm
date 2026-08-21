/**
 * Tests for grid-window computation.
 *
 * @module tests/unit/lib/calendar/grid-window
 */
import { describe, it, expect } from 'vitest';

import { computeGridWindow, toContentHours } from '@/lib/calendar/grid-window';

describe('computeGridWindow', () => {
  it('defaults to 07:00-21:00 when no rules exist', () => {
    const result = computeGridWindow([]);
    expect(result).toEqual({ startHour: 7, endHour: 21 });
  });

  it('applies 1-hour buffer below earliest start', () => {
    // 05:00 - 1 = 04:00. An early start has to reach past the 07:00 floor for
    // the buffer to be observable at all; any start after 08:00 is absorbed by it.
    const result = computeGridWindow([{ start_time: '05:00', end_time: '17:00' }]);
    expect(result.startHour).toBe(4);
  });

  it('applies 1-hour buffer above latest end', () => {
    // 20:00 + 1 = 21:00, past the 19:00 floor so the buffer is what shows.
    const result = computeGridWindow([{ start_time: '09:00', end_time: '20:00' }]);
    expect(result.endHour).toBe(21);
  });

  it('never shows a window narrower than a standard day', () => {
    // A 10:00-15:00 schedule buffers to 09:00-16:00, but the grid still draws
    // 07:00-19:00 so it does not change shape as the MC pages through weeks.
    const result = computeGridWindow([{ start_time: '10:00', end_time: '15:00' }]);
    expect(result).toEqual({ startHour: 7, endHour: 19 });
  });

  it('clamps startHour to 0', () => {
    const result = computeGridWindow([{ start_time: '00:30', end_time: '10:00' }]);
    expect(result.startHour).toBe(0); // 00:30 - 1 = -0:30, clamped to 0
  });

  it('clamps endHour to 24', () => {
    const result = computeGridWindow([{ start_time: '14:00', end_time: '23:30' }]);
    expect(result.endHour).toBe(24); // 23:30 + 1 = 24:30, clamped to 24
  });

  it('handles multiple rules by using earliest and latest', () => {
    const rules = [
      { start_time: '10:00', end_time: '12:00' },
      { start_time: '14:00', end_time: '18:00' },
      { start_time: '09:00', end_time: '20:00' }, // This defines the window
    ];
    const result = computeGridWindow(rules);
    expect(result).toEqual({ startHour: 7, endHour: 21 }); // 09:00 - 1 floored to 7, 20:00 + 1
  });

  it('ignores non-digit characters in time strings (uses split and map)', () => {
    // The implementation splits by ':' and parses the first element
    // so '09:00' becomes 9
    const result = computeGridWindow([{ start_time: '09:00', end_time: '17:00' }]);
    expect(result).toEqual({ startHour: 7, endHour: 19 });
  });

  it('handles edge case: all-day window (00:00-24:00)', () => {
    const result = computeGridWindow([{ start_time: '00:00', end_time: '23:59' }]);
    // 00:00 - 1 clamped to 0, 23:59 + 1 clamped to 24
    expect(result).toEqual({ startHour: 0, endHour: 24 });
  });
});

describe('computeGridWindow - content widening', () => {
  const NINE_TO_FIVE = [{ start_time: '09:00', end_time: '17:00' }];

  it('leaves the window alone when all content sits inside it', () => {
    // The standard 07:00-19:00 day already contains a 10:00-11:00 booking.
    const result = computeGridWindow(NINE_TO_FIVE, [{ startHour: 10, endHour: 11 }]);

    expect(result).toEqual({ startHour: 7, endHour: 19 });
  });

  it('extends the end hour to reach an evening wedding', () => {
    // A 19:00-22:30 wedding runs past the standard day. Without widening,
    // bandGeometry clamps it to a sliver on the grid's bottom edge.
    const result = computeGridWindow(NINE_TO_FIVE, [{ startHour: 19, endHour: 22.5 }]);

    expect(result.endHour).toBe(23);
    expect(result.startHour).toBe(7);
  });

  it('extends the start hour to reach an early external meeting', () => {
    const result = computeGridWindow(NINE_TO_FIVE, [{ startHour: 6.5, endHour: 7 }]);

    expect(result.startHour).toBe(6);
    expect(result.endHour).toBe(19);
  });

  it('rounds fractional content outward so no band is clipped', () => {
    // 06:40 must land in the 06:00 row and 18:20 must have a 19:00 row to end in.
    const result = computeGridWindow(NINE_TO_FIVE, [
      { startHour: 6 + 40 / 60, endHour: 18 + 20 / 60 },
    ]);

    expect(result.startHour).toBe(6);
    expect(result.endHour).toBe(19);
  });

  it('widens for the outermost item across several content spans', () => {
    const result = computeGridWindow(NINE_TO_FIVE, [
      { startHour: 10, endHour: 11 },
      { startHour: 5, endHour: 6 },
      { startHour: 20, endHour: 21 },
      { startHour: 13, endHour: 14 },
    ]);

    expect(result).toEqual({ startHour: 5, endHour: 21 });
  });

  it('clamps to the day even when content runs past midnight', () => {
    const result = computeGridWindow(NINE_TO_FIVE, [{ startHour: 22, endHour: 26 }]);

    expect(result.endHour).toBe(24);
  });

  it('widens the no-rules default window too', () => {
    // No availability configured still defaults to 07:00-21:00, and a 22:00
    // booking has to drag the end out or it is invisible.
    const result = computeGridWindow([], [{ startHour: 22, endHour: 23 }]);

    expect(result).toEqual({ startHour: 7, endHour: 23 });
  });

  it('keeps the floor when content sits well inside the standard day', () => {
    // Proves the floor is a floor and not an override: midday content must not
    // shrink the window around itself.
    const result = computeGridWindow(NINE_TO_FIVE, [{ startHour: 12, endHour: 13 }]);

    expect(result).toEqual({ startHour: 7, endHour: 19 });
  });
});

describe('toContentHours', () => {
  it('measures hours from local midnight, not UTC midnight', () => {
    // 2026-08-17T00:30:00Z is 10:30 on the 17th in Sydney (UTC+10).
    // Measured against UTC midnight it would read 0.5 and wrongly drag the
    // window down to hour 0.
    const spans = toContentHours(
      [{ start: '2026-08-17T00:30:00Z', end: '2026-08-17T01:30:00Z' }],
      'Australia/Sydney',
    );

    expect(spans).toHaveLength(1);
    expect(spans[0]!.startHour).toBeCloseTo(10.5, 6);
    expect(spans[0]!.endHour).toBeCloseTo(11.5, 6);
  });

  it('gives the same hour span to the same local time on different days', () => {
    const spans = toContentHours(
      [
        { start: '2026-08-17T00:00:00Z', end: '2026-08-17T01:00:00Z' },
        { start: '2026-08-20T00:00:00Z', end: '2026-08-20T01:00:00Z' },
      ],
      'Australia/Sydney',
    );

    expect(spans[0]).toEqual(spans[1]);
  });

  it('holds the local hour across a daylight saving transition', () => {
    // Sydney moves to daylight time on 2026-10-04. Both instants below are
    // 10:00 local on their own day, one either side of the change. Measuring
    // from each item's own local midnight keeps them equal; a fixed 24-hour
    // assumption would put the second one an hour out.
    const spans = toContentHours(
      [
        { start: '2026-10-03T23:00:00Z', end: '2026-10-04T00:00:00Z' },
        { start: '2026-10-06T23:00:00Z', end: '2026-10-07T00:00:00Z' },
      ],
      'Australia/Sydney',
    );

    expect(spans[0]!.startHour).toBeCloseTo(10, 6);
    expect(spans[1]!.startHour).toBeCloseTo(10, 6);
  });

  it('returns an empty array for no items', () => {
    expect(toContentHours([], 'Australia/Sydney')).toEqual([]);
  });
});
