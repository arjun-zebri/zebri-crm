/**
 * Tests for timezone utilities.
 *
 * @module tests/unit/lib/calendar/timezone
 */
import { describe, it, expect } from 'vitest';

import { getLocalDayStart } from '@/lib/calendar/timezone';

describe('getLocalDayStart', () => {
  it('returns the UTC midnight for a UTC date in UTC timezone', () => {
    const utcDate = new Date('2026-08-20T15:30:00Z');
    const result = getLocalDayStart(utcDate, 'UTC');

    // In UTC, 2026-08-20 15:30 is in the 20th, so local midnight is 2026-08-20 00:00 UTC
    expect(result).toEqual(new Date('2026-08-20T00:00:00Z'));
  });

  it('returns local midnight in Australia/Melbourne timezone', () => {
    // 2026-08-20 15:30 UTC is 2026-08-21 01:30 in Melbourne (UTC+10)
    // So the local midnight before this instant is 2026-08-21 00:00 AEST
    // which is 2026-08-20 14:00 UTC
    const utcDate = new Date('2026-08-20T15:30:00Z');
    const result = getLocalDayStart(utcDate, 'Australia/Melbourne');

    expect(result).toEqual(new Date('2026-08-20T14:00:00Z'));
  });

  it('handles a date just before midnight in the target timezone', () => {
    // 2026-08-20 13:59 UTC is 2026-08-20 23:59 AEST (still 20th)
    const utcDate = new Date('2026-08-20T13:59:00Z');
    const result = getLocalDayStart(utcDate, 'Australia/Melbourne');

    // Local midnight on 2026-08-20 is 2026-08-19 14:00 UTC
    expect(result).toEqual(new Date('2026-08-19T14:00:00Z'));
  });

  it('handles a date in US/Eastern timezone', () => {
    // 2026-08-20 04:00 UTC is 2026-08-20 00:00 EDT (UTC-4 in summer)
    const utcDate = new Date('2026-08-20T04:00:00Z');
    const result = getLocalDayStart(utcDate, 'US/Eastern');

    // So local midnight is 2026-08-20 04:00 UTC
    expect(result).toEqual(new Date('2026-08-20T04:00:00Z'));
  });

  it('handles midnight crossing in Asia/Tokyo', () => {
    // 2026-08-20 14:59 UTC is 2026-08-20 23:59 JST (UTC+9)
    const beforeMidnight = new Date('2026-08-20T14:59:00Z');
    const resultBefore = getLocalDayStart(beforeMidnight, 'Asia/Tokyo');

    // Local date is 2026-08-20, so local midnight is 2026-08-20 00:00 JST = 2026-08-19 15:00 UTC
    expect(resultBefore).toEqual(new Date('2026-08-19T15:00:00Z'));

    // 2026-08-20 15:00 UTC is 2026-08-21 00:00 JST
    const afterMidnight = new Date('2026-08-20T15:00:00Z');
    const resultAfter = getLocalDayStart(afterMidnight, 'Asia/Tokyo');

    // Local date is 2026-08-21, so local midnight is 2026-08-21 00:00 JST = 2026-08-20 15:00 UTC
    expect(resultAfter).toEqual(new Date('2026-08-20T15:00:00Z'));
  });
});
