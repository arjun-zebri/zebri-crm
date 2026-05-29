/**
 * Unit tests for the dashboard date-math helpers.
 *
 * The math is intricate enough that subtle bugs (off-by-one days,
 * Sunday-vs-Monday week-start, end-of-month edge cases, leap-year
 * handling, Q1-vs-Q4 quarter math) can silently corrupt the stats
 * surface. These tests pin the boundary behaviour with frozen
 * `now` values.
 */
import { describe, expect, it } from 'vitest';

import {
  getChartConfig,
  getPeriodWindow,
  getRollingWindow,
} from '@/lib/dashboard/periods';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe('getRollingWindow', () => {
  // Wednesday 2026-05-13 noon UTC — a date with no special-case
  // alignment so the math is purely arithmetic.
  const now = new Date('2026-05-13T12:00:00.000Z');

  it('week → last 7 days vs previous 7', () => {
    const w = getRollingWindow('week', now);
    expect(new Date(w.currentStart).getTime()).toBe(
      now.getTime() - 7 * MS_PER_DAY,
    );
    expect(new Date(w.previousStart).getTime()).toBe(
      now.getTime() - 14 * MS_PER_DAY,
    );
    expect(w.previousEnd).toBe(w.currentStart);
  });

  it('month → last 30 days vs previous 30', () => {
    const w = getRollingWindow('month', now);
    expect(new Date(w.currentStart).getTime()).toBe(
      now.getTime() - 30 * MS_PER_DAY,
    );
    expect(new Date(w.previousStart).getTime()).toBe(
      now.getTime() - 60 * MS_PER_DAY,
    );
  });

  it('quarter → last 90 days vs previous 90', () => {
    const w = getRollingWindow('quarter', now);
    expect(new Date(w.currentStart).getTime()).toBe(
      now.getTime() - 90 * MS_PER_DAY,
    );
  });

  it('year → last 365 days vs previous 365', () => {
    const w = getRollingWindow('year', now);
    expect(new Date(w.currentStart).getTime()).toBe(
      now.getTime() - 365 * MS_PER_DAY,
    );
  });
});

describe('getPeriodWindow — week boundary', () => {
  it('Wednesday → current start = Monday of this week', () => {
    // 2026-05-13 is a Wednesday (day 3)
    const now = new Date('2026-05-13T12:00:00.000Z');
    const w = getPeriodWindow('week', now);
    const currentStart = new Date(w.currentStart);
    // Should be Monday 2026-05-11 at local midnight
    expect(currentStart.getDay()).toBe(1); // Monday
    expect(currentStart.getDate()).toBe(11);
    expect(currentStart.getMonth()).toBe(4); // May (0-indexed)
  });

  it('Sunday → current start = LAST Monday (not next Monday)', () => {
    // 2026-05-17 is a Sunday (day 0). Regression test for the
    // common "if day === 0 then daysFromMonday = 0" off-by-one
    // that would put start on the upcoming Monday instead.
    const now = new Date('2026-05-17T12:00:00.000Z');
    const w = getPeriodWindow('week', now);
    const currentStart = new Date(w.currentStart);
    expect(currentStart.getDay()).toBe(1);
    // Last Monday from Sunday May 17 is May 11
    expect(currentStart.getDate()).toBe(11);
  });

  it('Monday at noon → current start = today midnight', () => {
    const now = new Date('2026-05-11T12:00:00.000Z');
    const w = getPeriodWindow('week', now);
    const currentStart = new Date(w.currentStart);
    expect(currentStart.getDay()).toBe(1);
    expect(currentStart.getDate()).toBe(11);
    expect(currentStart.getHours()).toBe(0);
    expect(currentStart.getMinutes()).toBe(0);
  });

  it('previousStart = currentStart - 7 days', () => {
    const now = new Date('2026-05-13T12:00:00.000Z');
    const w = getPeriodWindow('week', now);
    const currentStart = new Date(w.currentStart);
    const previousStart = new Date(w.previousStart);
    expect(currentStart.getTime() - previousStart.getTime()).toBe(
      7 * MS_PER_DAY,
    );
  });
});

describe('getPeriodWindow — month boundary', () => {
  it('mid-May → currentStart = May 1', () => {
    const now = new Date('2026-05-13T12:00:00.000Z');
    const w = getPeriodWindow('month', now);
    const currentStart = new Date(w.currentStart);
    expect(currentStart.getDate()).toBe(1);
    expect(currentStart.getMonth()).toBe(4); // May
    expect(currentStart.getFullYear()).toBe(2026);
  });

  it('previousStart = April 1', () => {
    const now = new Date('2026-05-13T12:00:00.000Z');
    const w = getPeriodWindow('month', now);
    const previousStart = new Date(w.previousStart);
    expect(previousStart.getDate()).toBe(1);
    expect(previousStart.getMonth()).toBe(3); // April
  });

  it('January → previousStart = December previous year', () => {
    const now = new Date('2026-01-15T12:00:00.000Z');
    const w = getPeriodWindow('month', now);
    const previousStart = new Date(w.previousStart);
    expect(previousStart.getMonth()).toBe(11); // December
    expect(previousStart.getFullYear()).toBe(2025);
  });

  it('previousEnd respects the shorter previous month', () => {
    // March 31 2026 → February has 28 days. previousEnd should
    // cap at Feb-end, not run past it.
    const now = new Date('2026-03-31T12:00:00.000Z');
    const w = getPeriodWindow('month', now);
    const previousEnd = new Date(w.previousEnd);
    expect(previousEnd.getMonth()).toBe(1); // February
    expect(previousEnd.getDate()).toBeLessThanOrEqual(28);
  });
});

describe('getPeriodWindow — quarter boundary', () => {
  it('Q1: January → currentStart = Jan 1, prev = Oct 1 prev year', () => {
    const now = new Date('2026-01-15T12:00:00.000Z');
    const w = getPeriodWindow('quarter', now);
    const currentStart = new Date(w.currentStart);
    const previousStart = new Date(w.previousStart);
    expect(currentStart.getMonth()).toBe(0); // January
    expect(currentStart.getDate()).toBe(1);
    expect(previousStart.getMonth()).toBe(9); // October
    expect(previousStart.getFullYear()).toBe(2025);
  });

  it('Q2: April → currentStart = Apr 1, prev = Jan 1', () => {
    const now = new Date('2026-04-15T12:00:00.000Z');
    const w = getPeriodWindow('quarter', now);
    expect(new Date(w.currentStart).getMonth()).toBe(3); // April
    expect(new Date(w.previousStart).getMonth()).toBe(0); // January
  });

  it('Q3: July → currentStart = Jul 1, prev = Apr 1', () => {
    const now = new Date('2026-07-15T12:00:00.000Z');
    const w = getPeriodWindow('quarter', now);
    expect(new Date(w.currentStart).getMonth()).toBe(6); // July
    expect(new Date(w.previousStart).getMonth()).toBe(3); // April
  });

  it('Q4: November → currentStart = Oct 1, prev = Jul 1', () => {
    const now = new Date('2026-11-15T12:00:00.000Z');
    const w = getPeriodWindow('quarter', now);
    expect(new Date(w.currentStart).getMonth()).toBe(9); // October
    expect(new Date(w.previousStart).getMonth()).toBe(6); // July
  });
});

describe('getPeriodWindow — year boundary', () => {
  it('mid-year → currentStart = Jan 1', () => {
    const now = new Date('2026-05-13T12:00:00.000Z');
    const w = getPeriodWindow('year', now);
    const currentStart = new Date(w.currentStart);
    expect(currentStart.getMonth()).toBe(0);
    expect(currentStart.getDate()).toBe(1);
    expect(currentStart.getFullYear()).toBe(2026);
  });

  it('previousStart = Jan 1 of previous year', () => {
    const now = new Date('2026-05-13T12:00:00.000Z');
    const w = getPeriodWindow('year', now);
    const previousStart = new Date(w.previousStart);
    expect(previousStart.getMonth()).toBe(0);
    expect(previousStart.getDate()).toBe(1);
    expect(previousStart.getFullYear()).toBe(2025);
  });
});

describe('getChartConfig', () => {
  it('week → 8 init keys (last 8 weeks)', () => {
    const now = new Date('2026-05-13T12:00:00.000Z');
    const cfg = getChartConfig('week', now);
    expect(cfg.initKeys()).toHaveLength(8);
  });

  it('month → 12 init keys (last 12 months)', () => {
    const now = new Date('2026-05-13T12:00:00.000Z');
    const cfg = getChartConfig('month', now);
    expect(cfg.initKeys()).toHaveLength(12);
  });

  it('quarter → 6 init keys (last 6 quarters)', () => {
    const now = new Date('2026-05-13T12:00:00.000Z');
    const cfg = getChartConfig('quarter', now);
    const keys = cfg.initKeys();
    expect(keys).toHaveLength(6);
    // Should have Q-prefixed labels
    expect(keys.every((k) => /^Q[1-4] '\d{2}$/.test(k))).toBe(true);
  });

  it('year → 5 init keys (last 5 years)', () => {
    const now = new Date('2026-05-13T12:00:00.000Z');
    const cfg = getChartConfig('year', now);
    const keys = cfg.initKeys();
    expect(keys).toHaveLength(5);
    // Should be ascending year strings ending in 2026
    expect(keys[keys.length - 1]).toBe('2026');
    expect(keys[0]).toBe('2022');
  });

  it('chart format function returns a non-empty string', () => {
    const now = new Date('2026-05-13T12:00:00.000Z');
    for (const period of ['week', 'month', 'quarter', 'year'] as const) {
      const cfg = getChartConfig(period, now);
      const label = cfg.format(now);
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
