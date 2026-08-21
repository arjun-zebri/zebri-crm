/**
 * Unit tests for the availability editor's pure helpers: week state
 * transforms, duration maths, and the dirty check behind Save/Discard.
 *
 * @module tests/unit/app/calendar/availability-utils
 */
import { describe, it, expect } from 'vitest';

import {
  clearWeek,
  copyMondayToWeekdays,
  emptyWeek,
  formatHours,
  formatOverrideDate,
  formatTimeLabel,
  isEnabled,
  isSameWeek,
  rulesFromWeek,
  setDayEnabled,
  setDayWindows,
  weekFromRules,
  weekMinutes,
  windowsFor,
  windowsMinutes,
  type WeekState,
} from '@/app/(dashboard)/calendar/availability-utils';

/** Mon 9-5, Sat 8-11 and 3-6:30. */
function sampleWeek(): WeekState {
  return weekFromRules([
    { weekday: 1, start_time: '09:00', end_time: '17:00' },
    { weekday: 6, start_time: '08:00', end_time: '11:00' },
    { weekday: 6, start_time: '15:00', end_time: '18:30' },
  ]);
}

describe('weekFromRules', () => {
  it('normalizes Postgres HH:MM:SS times to HH:mm', () => {
    const week = weekFromRules([
      { weekday: 1, start_time: '09:00:00', end_time: '17:00:00' },
    ]);

    expect(windowsFor(week, 1)).toEqual([{ start: '09:00', end: '17:00' }]);
  });

  it('groups multiple windows under one weekday and enables it once', () => {
    const week = sampleWeek();

    expect(windowsFor(week, 6)).toHaveLength(2);
    expect(week.enabled.filter((d) => d === 6)).toHaveLength(1);
  });

  it('leaves days with no rules disabled', () => {
    expect(isEnabled(sampleWeek(), 0)).toBe(false);
  });
});

describe('rulesFromWeek', () => {
  it('round-trips the rules it was built from', () => {
    expect(rulesFromWeek(sampleWeek())).toEqual([
      { weekday: 1, start_time: '09:00', end_time: '17:00' },
      { weekday: 6, start_time: '08:00', end_time: '11:00' },
      { weekday: 6, start_time: '15:00', end_time: '18:30' },
    ]);
  });

  it('drops the windows of a disabled day', () => {
    const week = setDayEnabled(sampleWeek(), 6, false);

    expect(rulesFromWeek(week)).toEqual([
      { weekday: 1, start_time: '09:00', end_time: '17:00' },
    ]);
  });
});

describe('setDayEnabled', () => {
  it('seeds a default window the first time a day is switched on', () => {
    const week = setDayEnabled(emptyWeek(), 3, true);

    expect(windowsFor(week, 3)).toEqual([{ start: '09:00', end: '17:00' }]);
  });

  it('keeps the windows of a day switched off, so toggling back restores them', () => {
    const off = setDayEnabled(sampleWeek(), 6, false);
    const backOn = setDayEnabled(off, 6, true);

    expect(windowsFor(backOn, 6)).toHaveLength(2);
  });

  it('does not duplicate a day that is already enabled', () => {
    const week = setDayEnabled(sampleWeek(), 1, true);

    expect(week.enabled.filter((d) => d === 1)).toHaveLength(1);
  });
});

describe('copyMondayToWeekdays', () => {
  it('applies Monday windows to Tuesday through Friday', () => {
    const week = copyMondayToWeekdays(sampleWeek());

    for (const weekday of [2, 3, 4, 5]) {
      expect(isEnabled(week, weekday)).toBe(true);
      expect(windowsFor(week, weekday)).toEqual([{ start: '09:00', end: '17:00' }]);
    }
  });

  it('leaves the weekend alone', () => {
    const week = copyMondayToWeekdays(sampleWeek());

    expect(windowsFor(week, 6)).toHaveLength(2);
    expect(isEnabled(week, 0)).toBe(false);
  });

  it('copies Monday being off, switching the weekdays off too', () => {
    const mondayOff = setDayEnabled(sampleWeek(), 1, false);
    const week = copyMondayToWeekdays(mondayOff);

    expect(isEnabled(week, 2)).toBe(false);
  });

  it('copies windows by value, so editing Tuesday does not touch Monday', () => {
    const week = copyMondayToWeekdays(sampleWeek());
    const edited = setDayWindows(week, 2, [{ start: '10:00', end: '12:00' }]);

    expect(windowsFor(edited, 1)).toEqual([{ start: '09:00', end: '17:00' }]);
  });
});

describe('clearWeek', () => {
  it('switches every day off but keeps the windows for Discard', () => {
    const week = clearWeek(sampleWeek());

    expect(week.enabled).toEqual([]);
    expect(rulesFromWeek(week)).toEqual([]);
    expect(windowsFor(week, 1)).toEqual([{ start: '09:00', end: '17:00' }]);
  });
});

describe('duration maths', () => {
  it('totals the minutes in a set of windows', () => {
    expect(windowsMinutes([{ start: '08:00', end: '11:00' }])).toBe(180);
    expect(
      windowsMinutes([
        { start: '08:00', end: '11:00' },
        { start: '15:00', end: '18:30' },
      ]),
    ).toBe(390);
  });

  it('counts a backwards window as zero rather than negative', () => {
    expect(windowsMinutes([{ start: '17:00', end: '09:00' }])).toBe(0);
  });

  it('totals only the enabled days across the week', () => {
    expect(weekMinutes(sampleWeek())).toBe(480 + 390);
    expect(weekMinutes(clearWeek(sampleWeek()))).toBe(0);
  });

  it('formats whole and half hours without trailing zeros', () => {
    expect(formatHours(480)).toBe('8h');
    expect(formatHours(390)).toBe('6.5h');
    expect(formatHours(0)).toBe('0h');
  });
});

describe('isSameWeek', () => {
  it('treats a reloaded copy as unchanged', () => {
    expect(isSameWeek(sampleWeek(), sampleWeek())).toBe(true);
  });

  it('ignores the order days were switched on in', () => {
    const a = setDayEnabled(setDayEnabled(emptyWeek(), 1, true), 2, true);
    const b = setDayEnabled(setDayEnabled(emptyWeek(), 2, true), 1, true);

    expect(isSameWeek(a, b)).toBe(true);
  });

  it('ignores windows retained on a disabled day', () => {
    const off = setDayEnabled(sampleWeek(), 6, false);
    const never = weekFromRules([
      { weekday: 1, start_time: '09:00', end_time: '17:00' },
    ]);

    expect(isSameWeek(off, never)).toBe(true);
  });

  it('sees an edited window as a change', () => {
    const edited = setDayWindows(sampleWeek(), 1, [{ start: '10:00', end: '17:00' }]);

    expect(isSameWeek(edited, sampleWeek())).toBe(false);
  });
});

describe('labels', () => {
  it('renders 24h times as 12h with a period', () => {
    expect(formatTimeLabel('09:00')).toBe('9:00 AM');
    expect(formatTimeLabel('13:30')).toBe('1:30 PM');
    expect(formatTimeLabel('00:15')).toBe('12:15 AM');
    expect(formatTimeLabel('12:00')).toBe('12:00 PM');
  });

  it('renders an override date as weekday, day, month', () => {
    // en-AU, matching lib/utils formatDate: September abbreviates to "Sept".
    expect(formatOverrideDate('2026-09-12')).toBe('Sat 12 Sept');
    expect(formatOverrideDate('2026-08-21')).toBe('Fri 21 Aug');
  });

  it('falls back to the raw string on an unparseable date', () => {
    expect(formatOverrideDate('not-a-date')).toBe('not-a-date');
  });
});
