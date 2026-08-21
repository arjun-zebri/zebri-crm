/**
 * Unit tests for week view grid column headers and timezone handling.
 */
import { describe, it, expect } from 'vitest';

import { bandGeometry, minutesFromGridStart, type GridConfig } from '@/lib/calendar/grid-layout';
import { getLocalDayStart } from '@/lib/calendar/timezone';
import { zonedDateParts, zonedTimeToUtc } from '@/lib/scheduling/timezone';

describe('WeekView column headers - timezone handling', () => {
  it('displays correct column headers for Sydney timezone (week starting Sunday 16 August 2026)', () => {
    // Aug 16, 2026 is a Saturday; Sunday is Aug 17 in UTC.
    // But in Australia/Sydney (UTC+10), Sunday Aug 16 is actually 2026-08-15T14:00:00Z UTC.
    // So the Sunday column should show 16, and Saturday shows 22.
    const timezone = 'Australia/Sydney';

    // Create a UTC instant that corresponds to Sunday 2026-08-16 midnight Sydney time
    // This is 2026-08-15T14:00:00Z
    const sundayMidnightUtc = zonedTimeToUtc('2026-08-16', '00:00', timezone);

    // Extract the day number in Sydney timezone
    const { date: localDate } = zonedDateParts(sundayMidnightUtc, timezone);
    const dayNumber = localDate.split('-')[2];

    expect(dayNumber).toBe('16');
    expect(localDate).toBe('2026-08-16');
  });

  it('generates correct week column dates for full week Sunday-Saturday in Sydney timezone', () => {
    const timezone = 'Australia/Sydney';

    // Generate all 7 dates for the week starting Sunday Aug 16, 2026 (Sydney time)
    const weekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const utcInstant = zonedTimeToUtc('2026-08-16', '00:00', timezone);
      const offsetMs = i * 24 * 60 * 60 * 1000;
      const dayUtc = new Date(utcInstant.getTime() + offsetMs);
      const { date: localDate } = zonedDateParts(dayUtc, timezone);
      weekDates.push(localDate.split('-')[2]!);
    }

    // Should read 16 through 22 in Sydney time
    expect(weekDates).toEqual(['16', '17', '18', '19', '20', '21', '22']);
  });

  it('handles UTC timezone without distortion', () => {
    const timezone = 'UTC';

    // In UTC, 2026-08-16 00:00 is just 2026-08-16
    const utcInstant = zonedTimeToUtc('2026-08-16', '00:00', timezone);
    const { date: localDate } = zonedDateParts(utcInstant, timezone);
    const dayNumber = localDate.split('-')[2];

    expect(dayNumber).toBe('16');
  });

  it('preserves weekday order across timezone boundaries', () => {
    const timezone = 'Australia/Sydney';

    // Weekday 0 = Sunday, 6 = Saturday
    // Get the week starting Sunday Aug 16 (Sydney time)
    const weekdayNumbers: number[] = [];
    for (let i = 0; i < 7; i++) {
      const utcInstant = zonedTimeToUtc('2026-08-16', '00:00', timezone);
      const offsetMs = i * 24 * 60 * 60 * 1000;
      const dayUtc = new Date(utcInstant.getTime() + offsetMs);
      const { weekday } = zonedDateParts(dayUtc, timezone);
      weekdayNumbers.push(weekday);
    }

    // Should be Sun(0) through Sat(6)
    expect(weekdayNumbers).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe('WeekView grid rendering across a DST transition', () => {
  // This was a real defect, parked as a skipped test until the cause was
  // found. The grid positioned bands by ELAPSED time since local midnight
  // while labelling its rows with WALL-CLOCK hours. Those two scales agree on
  // an ordinary day and come apart on a changeover day, when the local day is
  // 23 or 25 hours long, so every band after the transition was drawn a full
  // row away from the label it belonged to. The fix was to position bands by
  // wall-clock time; these tests hold that line.
  const SYDNEY = 'Australia/Sydney';

  // Sydney moves to daylight time at 02:00 on Sunday 2026-10-04, making that
  // local day 23 hours long. Both instants below are 10:00 in their own local
  // day, one on the changeover day itself and one after it.
  const SUNDAY_10AM_UTC = '2026-10-03T23:00:00Z';
  const WEDNESDAY_10AM_UTC = '2026-10-06T23:00:00Z';

  const cfg: GridConfig = {
    startHour: 8,
    endHour: 18,
    pxPerMinute: 1.5,
    timeZone: SYDNEY,
  };

  function geometryFor(startUtc: string, endUtc: string) {
    const dayStart = getLocalDayStart(new Date(startUtc), SYDNEY);
    return bandGeometry({ start: startUtc, end: endUtc }, dayStart, cfg);
  }

  it('places 10:00 on the changeover day at the same offset as 10:00 after it', () => {
    const sunday = geometryFor(SUNDAY_10AM_UTC, '2026-10-04T00:00:00Z');
    const wednesday = geometryFor(WEDNESDAY_10AM_UTC, '2026-10-07T00:00:00Z');

    expect(sunday).not.toBeNull();
    expect(wednesday).not.toBeNull();
    expect(sunday!.topPx).toBe(wednesday!.topPx);
  });

  it('places both on the 10:00 row, hand-derived', () => {
    // 10:00 is 600 minutes into the day; the grid starts at 08:00, or 480.
    // (600 - 480) * 1.5 px per minute = 180px.
    const sunday = geometryFor(SUNDAY_10AM_UTC, '2026-10-04T00:00:00Z');

    expect(sunday!.topPx).toBe(180);
    // One hour tall: 60 * 1.5.
    expect(sunday!.heightPx).toBe(90);
  });

  it('measures the changeover day by the clock, not by elapsed time', () => {
    // The distinction the bug turned on. Midnight to 10:00 on 2026-10-04 is
    // only NINE elapsed hours, because the 02:00 hour never happens. Reading
    // 9 here instead of 10 is precisely what put every band a row out.
    const dayStart = getLocalDayStart(new Date(SUNDAY_10AM_UTC), SYDNEY);
    const elapsedHours =
      (new Date(SUNDAY_10AM_UTC).getTime() - dayStart.getTime()) / (60 * 60 * 1000);

    expect(elapsedHours).toBe(9);
    expect(minutesFromGridStart(new Date(SUNDAY_10AM_UTC), dayStart, SYDNEY)).toBe(600);
  });

  it('still agrees with elapsed time on an ordinary day', () => {
    // A week later, no transition in play: the two scales must coincide again,
    // proving the fix did not simply trade one offset for another.
    const ordinary = '2026-10-13T23:00:00Z';
    const dayStart = getLocalDayStart(new Date(ordinary), SYDNEY);
    const elapsedMinutes =
      (new Date(ordinary).getTime() - dayStart.getTime()) / (60 * 1000);

    expect(minutesFromGridStart(new Date(ordinary), dayStart, SYDNEY)).toBe(elapsedMinutes);
    expect(elapsedMinutes).toBe(600);
  });
});
