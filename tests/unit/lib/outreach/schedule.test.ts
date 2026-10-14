import { describe, expect, it } from 'vitest';

import { localDateKey, localParts, nextSendTime, rampCap, zonedTimeToUtc, type NextSendInput } from '@/lib/outreach/sequencer/schedule';

const settings = { windowStart: '09:00', windowEnd: '16:00', weekdays: [1, 2, 3, 4, 5] };

function input(over: Partial<NextSendInput>): NextSendInput {
  return {
    base: new Date('2026-10-12T00:00:00Z'),
    delayDays: 0,
    timezone: 'Australia/Sydney',
    settings,
    notBefore: new Date('2026-10-12T00:00:00Z'),
    dayCounts: new Map(),
    capFor: () => 30,
    random: () => 0,
    ...over,
  };
}

describe('zonedTimeToUtc', () => {
  it('round-trips wall-clock time, including across DST', () => {
    // 9:00 in Sydney on a DST date (AEDT, +11).
    expect(zonedTimeToUtc(2026, 10, 12, 9, 0, 'Australia/Sydney').toISOString()).toBe('2026-10-11T22:00:00.000Z');
    // Perth has no DST (+8).
    expect(zonedTimeToUtc(2026, 10, 12, 9, 0, 'Australia/Perth').toISOString()).toBe('2026-10-12T01:00:00.000Z');
  });
});

describe('nextSendTime', () => {
  it('lands inside the window in the recipient timezone', () => {
    // 2026-10-12 00:00Z is Monday 11:00 in Sydney; random 0 picks the first free minute.
    const at = nextSendTime(input({}))!;
    const p = localParts(at, 'Australia/Sydney');
    expect(p.weekday).toBe(1);
    expect(p.hour * 60 + p.minute).toBeGreaterThanOrEqual(11 * 60);
    expect(p.hour).toBeLessThan(16);
  });

  it('uses Perth hours for a Perth celebrant', () => {
    const at = nextSendTime(input({ timezone: 'Australia/Perth', notBefore: new Date('2026-10-11T12:00:00Z') }))!;
    expect(localParts(at, 'Australia/Perth').hour).toBe(9);
  });

  it('rolls past weekends', () => {
    // Saturday base.
    const at = nextSendTime(input({ base: new Date('2026-10-16T23:00:00Z'), notBefore: new Date('2026-10-16T23:00:00Z') }))!;
    expect(localParts(at, 'Australia/Sydney').weekday).toBe(1);
  });

  it('applies the delay', () => {
    const at = nextSendTime(input({ delayDays: 3 }))!;
    expect(localDateKey(at, 'Australia/Sydney')).toBe('2026-10-15');
  });

  it('rolls to the next day when the cap is full', () => {
    const full = new Map([['2026-10-12', 5]]);
    const at = nextSendTime(input({ dayCounts: full, capFor: () => 5 }))!;
    expect(localDateKey(at, 'Australia/Sydney')).toBe('2026-10-13');
  });

  it('returns null for an impossible window', () => {
    expect(nextSendTime(input({ settings: { ...settings, windowEnd: '08:00' } }))).toBeNull();
  });
});

describe('rampCap', () => {
  it('steps up weekly and never beats the hard cap', () => {
    const ramp = [5, 10, 20, 30];
    expect(rampCap('2026-10-12', null, ramp, 30)).toBe(5);
    expect(rampCap('2026-10-12', '2026-10-12', ramp, 30)).toBe(5);
    expect(rampCap('2026-10-19', '2026-10-12', ramp, 30)).toBe(10);
    expect(rampCap('2026-12-30', '2026-10-12', ramp, 25)).toBe(25);
  });
});
