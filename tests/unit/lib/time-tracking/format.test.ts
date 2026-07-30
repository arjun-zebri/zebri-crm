import { describe, expect, it } from 'vitest';

import {
  TIMER_CAP_MS,
  capReachedAt,
  entryDurationMs,
  formatDuration,
  formatElapsed,
  isOverCap,
  sumByCategory,
  totalMs,
} from '@/lib/time-tracking/format';
import type { TimeEntry } from '@/types/time-tracking';

/** Minimal entry factory so each test states only what it cares about. */
function entry(over: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 'e1',
    couple_id: 'c1',
    started_at: '2026-07-30T02:00:00.000Z',
    ended_at: '2026-07-30T02:48:00.000Z',
    category_id: null,
    category_name: null,
    note: null,
    auto_stopped: false,
    ...over,
  };
}

describe('formatElapsed', () => {
  it('renders zero as 00:00:00', () => {
    expect(formatElapsed(0)).toBe('00:00:00');
  });

  it('zero-pads hours, minutes and seconds', () => {
    expect(formatElapsed(12 * 60_000 + 47_000)).toBe('00:12:47');
  });

  it('keeps counting hours past 24 rather than wrapping', () => {
    expect(formatElapsed(26 * 3_600_000 + 61_000)).toBe('26:01:01');
  });

  it('clamps negative input to zero (clock skew must never show -1)', () => {
    expect(formatElapsed(-5_000)).toBe('00:00:00');
  });
});

describe('formatDuration', () => {
  it('renders sub-hour durations in minutes only', () => {
    expect(formatDuration(48 * 60_000)).toBe('48m');
  });

  it('renders hours and minutes', () => {
    expect(formatDuration(75 * 60_000)).toBe('1h 15m');
  });

  it('drops a zero minute part', () => {
    expect(formatDuration(2 * 3_600_000)).toBe('2h');
  });

  it('floors seconds into the minute below', () => {
    expect(formatDuration(59_000)).toBe('0m');
  });
});

describe('entryDurationMs', () => {
  it('uses ended_at for a finished entry and ignores now', () => {
    expect(entryDurationMs(entry(), Date.parse('2026-07-30T09:00:00Z'))).toBe(
      48 * 60_000,
    );
  });

  it('measures a running entry against now', () => {
    const running = entry({ ended_at: null });
    expect(entryDurationMs(running, Date.parse('2026-07-30T02:10:00Z'))).toBe(
      10 * 60_000,
    );
  });

  it('caps a running entry at the 8h cap', () => {
    const running = entry({ ended_at: null });
    expect(entryDurationMs(running, Date.parse('2026-07-31T02:00:00Z'))).toBe(
      TIMER_CAP_MS,
    );
  });
});

describe('cap helpers', () => {
  it('capReachedAt returns started_at plus 8h as ISO', () => {
    expect(capReachedAt('2026-07-30T02:00:00.000Z')).toBe(
      '2026-07-30T10:00:00.000Z',
    );
  });

  it('isOverCap is false at exactly the cap', () => {
    expect(
      isOverCap('2026-07-30T02:00:00.000Z', Date.parse('2026-07-30T10:00:00Z')),
    ).toBe(false);
  });

  it('isOverCap is true one millisecond past the cap', () => {
    expect(
      isOverCap(
        '2026-07-30T02:00:00.000Z',
        Date.parse('2026-07-30T10:00:00.001Z'),
      ),
    ).toBe(true);
  });
});

describe('totals', () => {
  const entries = [
    entry({ id: 'a', category_name: 'Meeting' }),
    entry({
      id: 'b',
      category_name: 'Meeting',
      started_at: '2026-07-28T00:00:00.000Z',
      ended_at: '2026-07-28T01:00:00.000Z',
    }),
    entry({
      id: 'c',
      category_name: null,
      started_at: '2026-07-27T00:00:00.000Z',
      ended_at: '2026-07-27T00:12:00.000Z',
    }),
  ];

  it('totalMs sums finished entries', () => {
    expect(totalMs(entries)).toBe(48 * 60_000 + 60 * 60_000 + 12 * 60_000);
  });

  it('sumByCategory groups by name, biggest first, uncategorised last', () => {
    expect(sumByCategory(entries)).toEqual([
      { label: 'Meeting', ms: 108 * 60_000 },
      { label: 'Uncategorised', ms: 12 * 60_000 },
    ]);
  });

  it('sumByCategory returns an empty list for no entries', () => {
    expect(sumByCategory([])).toEqual([]);
  });
});
