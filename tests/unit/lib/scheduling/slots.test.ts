import { describe, expect, it } from 'vitest';

import { computeSlots, type SlotEngineConfig } from '@/lib/scheduling/slots';

/** Monday 2026-07-13 in Sydney winter (AEST, UTC+10). */
const base: SlotEngineConfig = {
  timezone: 'Australia/Sydney',
  rules: [{ weekday: 1, start_time: '10:00', end_time: '12:00' }],
  overrides: [],
  busy: [],
  durationMinutes: 30,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  minNoticeHours: 0,
  maxAdvanceDays: 60,
  now: new Date('2026-07-12T00:00:00Z'),
};
const monday = {
  start: new Date('2026-07-12T14:00:00Z'),
  end: new Date('2026-07-13T14:00:00Z'),
};

describe('computeSlots', () => {
  it('case 1: happy path, Monday 10:00-12:00 AEST, 30-min slots', () => {
    // Window [10:00, 12:00) AEST = [00:00, 02:00) UTC on 2026-07-13
    // Slot starts: 00:00, 00:30, 01:00, 01:30 (all fit, ends at 00:30, 01:00, 01:30, 02:00)
    // Slot at 02:00 would end at 02:30, outside window, excluded.
    const slots = computeSlots(base, monday);
    expect(slots).toEqual([
      { start: '2026-07-13T00:00:00Z', end: '2026-07-13T00:30:00Z' },
      { start: '2026-07-13T00:30:00Z', end: '2026-07-13T01:00:00Z' },
      { start: '2026-07-13T01:00:00Z', end: '2026-07-13T01:30:00Z' },
      { start: '2026-07-13T01:30:00Z', end: '2026-07-13T02:00:00Z' },
    ]);
  });

  it('case 2: 60-min duration, same window yields 3 slots', () => {
    // Window [00:00, 02:00) UTC, 60-min slots generated every 30 min
    // Slot starts: 00:00 (ends 01:00), 00:30 (ends 01:30), 01:00 (ends 02:00); 01:30 (ends 02:30) is outside
    const config = { ...base, durationMinutes: 60 };
    const slots = computeSlots(config, monday);
    expect(slots).toEqual([
      { start: '2026-07-13T00:00:00Z', end: '2026-07-13T01:00:00Z' },
      { start: '2026-07-13T00:30:00Z', end: '2026-07-13T01:30:00Z' },
      { start: '2026-07-13T01:00:00Z', end: '2026-07-13T02:00:00Z' },
    ]);
  });

  it('case 3: busy block removes overlapping slots', () => {
    // Busy [00:30, 01:00) UTC
    // Slot at 00:00 (ends 00:30): no overlap, kept
    // Slot at 00:30 (ends 01:00): overlaps busy start=00:30, end=01:00; bufferedSpan=[00:30, 01:00], busy=[00:30, 01:00), overlap check: 00:30 < 01:00 && 00:30 < 01:00 = true, excluded
    // Slot at 01:00 (ends 01:30): bufferedSpan=[01:00, 01:30], busy=[00:30, 01:00), overlap check: 01:00 < 01:00 = false, no overlap, kept
    // Slot at 01:30 (ends 02:00): no overlap, kept
    const config = {
      ...base,
      busy: [{ start: '2026-07-13T00:30:00Z', end: '2026-07-13T01:00:00Z' }],
    };
    const slots = computeSlots(config, monday);
    expect(slots).toEqual([
      { start: '2026-07-13T00:00:00Z', end: '2026-07-13T00:30:00Z' },
      { start: '2026-07-13T01:00:00Z', end: '2026-07-13T01:30:00Z' },
      { start: '2026-07-13T01:30:00Z', end: '2026-07-13T02:00:00Z' },
    ]);
  });

  it('case 4: buffers widen the exclusion', () => {
    // Busy [00:30, 01:00) UTC, bufferBefore=15, bufferAfter=15
    // Slot at 00:00: bufferedSpan=[23:45 (prev day), 00:45], busy=[00:30, 01:00)
    //   overlap: 23:45 < 01:00 && 00:30 < 00:45 = true, excluded
    // Slot at 00:30: bufferedSpan=[00:15, 00:45], busy=[00:30, 01:00)
    //   overlap: 00:15 < 01:00 && 00:30 < 00:45 = true, excluded
    // Slot at 01:00: bufferedSpan=[00:45, 01:15], busy=[00:30, 01:00)
    //   overlap: 00:45 < 01:00 && 00:30 < 01:15 = true, excluded
    // Slot at 01:30: bufferedSpan=[01:15, 01:45], busy=[00:30, 01:00)
    //   overlap: 01:15 < 01:00 = false, kept
    const config = {
      ...base,
      busy: [{ start: '2026-07-13T00:30:00Z', end: '2026-07-13T01:00:00Z' }],
      bufferBeforeMinutes: 15,
      bufferAfterMinutes: 15,
    };
    const slots = computeSlots(config, monday);
    expect(slots).toEqual([
      { start: '2026-07-13T01:30:00Z', end: '2026-07-13T02:00:00Z' },
    ]);
  });

  it('case 5: min notice constraint', () => {
    // now = 2026-07-13T00:15:00Z, minNoticeHours=1
    // from = max(range.start, now + 1h) = max(2026-07-12T14:00:00Z, 2026-07-13T01:15:00Z) = 2026-07-13T01:15:00Z
    // Only slots at/after 01:15: slot at 01:30 qualifies
    const config = {
      ...base,
      now: new Date('2026-07-13T00:15:00Z'),
      minNoticeHours: 1,
    };
    const slots = computeSlots(config, monday);
    expect(slots).toEqual([
      { start: '2026-07-13T01:30:00Z', end: '2026-07-13T02:00:00Z' },
    ]);
  });

  it('case 6: max advance constraint', () => {
    // now far in past, maxAdvanceDays=1, range 3 days out → no slots
    // now = 2026-07-12T00:00:00Z, to = now + 1 day = 2026-07-13T00:00:00Z
    // range.end = 2026-07-15T14:00:00Z, so to = min(range.end, now + 1 day) = 2026-07-13T00:00:00Z
    // from = 2026-07-12T14:00:00Z
    // Enumerate dates from 14:00 on 2026-07-12: that's after midnight, so local date is 2026-07-13
    // zonedDateParts(2026-07-12T14:00:00Z, Sydney) = 2026-07-13
    // But from (14:00 on 12th UTC) >= to (00:00 on 13th UTC)? 2026-07-12T14:00 < 2026-07-13T00:00, no
    // Actually to=2026-07-13T00:00:00Z
    // from=2026-07-12T14:00:00Z, to=2026-07-13T00:00:00Z
    // Window is [10:00, 12:00) AEST on 2026-07-13 = [00:00, 02:00) UTC
    // from < to, so we proceed
    // Wait, I need to think about the effective window more carefully
    // The range is [12th 14:00 UTC, 15th 14:00 UTC]
    // with = max(range.start, now + minNotice) = max(12th 14:00, 12th 00:00) = 12th 14:00
    // to = min(range.end, now + maxAdvance) = min(15th 14:00, 13th 00:00) = 13th 00:00
    // So the effective range is [12th 14:00, 13th 00:00), which is 10 hours
    // On 2026-07-13, window is [00:00, 02:00) UTC. But from = 12th 14:00 UTC, to = 13th 00:00 UTC
    // A slot must satisfy s >= from AND s + duration <= to
    // Slots start at 00:00 on 13th: 00:00 >= from (12th 14:00)? Yes, 2026-07-13T00:00 > 2026-07-12T14:00? Yes
    // 00:00 + 30min = 00:30 <= to (13th 00:00)? 2026-07-13T00:30 <= 2026-07-13T00:00? No!
    // So actually no slots fit!
    const config = {
      ...base,
      maxAdvanceDays: 1,
    };
    const range = {
      start: new Date('2026-07-12T14:00:00Z'),
      end: new Date('2026-07-15T14:00:00Z'),
    };
    const slots = computeSlots(config, range);
    expect(slots).toEqual([]);
  });

  it('case 7: block override (available=false)', () => {
    // Override on 2026-07-13: available=false → no slots
    const config = {
      ...base,
      overrides: [
        { date: '2026-07-13', available: false, start_time: null, end_time: null },
      ],
    };
    const slots = computeSlots(config, monday);
    expect(slots).toEqual([]);
  });

  it('case 8: custom-window override wins over weekly rules', () => {
    // Override on 2026-07-13: available=true, 14:00-15:00 (local)
    // 14:00 AEST = 04:00 UTC, 15:00 AEST = 05:00 UTC
    // Window [04:00, 05:00) UTC, 30-min slots: 04:00 (ends 04:30), 04:30 (ends 05:00)
    // Slot at 05:00 would end at 05:30, outside window
    const config = {
      ...base,
      overrides: [
        { date: '2026-07-13', available: true, start_time: '14:00', end_time: '15:00' },
      ],
    };
    const slots = computeSlots(config, monday);
    expect(slots).toEqual([
      { start: '2026-07-13T04:00:00Z', end: '2026-07-13T04:30:00Z' },
      { start: '2026-07-13T04:30:00Z', end: '2026-07-13T05:00:00Z' },
    ]);
  });

  it('case 9: DST spring-forward day (2026-10-04)', () => {
    // DST transition: 2026-10-04 02:00 AEST becomes 02:00 AEDT (UTC+11)
    // Rules: weekday 0 (Sunday), 09:00-11:00 (local)
    // 2026-10-04 is a Sunday (DST day)
    // 09:00 AEDT = 22:00 UTC previous day (2026-10-03)
    // 11:00 AEDT = 00:00 UTC same day (2026-10-04)
    // Window [22:00 on 3rd, 00:00 on 4th) UTC = [22:00, 24:00) with wrap
    // Slots at 22:00 (ends 22:30), 22:30 (ends 23:00), 23:00 (ends 23:30), 23:30 (ends 00:00)
    // 4 slots total, first one starts 2026-10-03T22:00:00Z
    const config = {
      ...base,
      now: new Date('2026-10-02T00:00:00Z'),
      maxAdvanceDays: 10,
      rules: [{ weekday: 0, start_time: '09:00', end_time: '11:00' }],
    };
    const range = {
      start: new Date('2026-10-03T20:00:00Z'),
      end: new Date('2026-10-04T02:00:00Z'),
    };
    const slots = computeSlots(config, range);
    expect(slots).toEqual([
      { start: '2026-10-03T22:00:00Z', end: '2026-10-03T22:30:00Z' },
      { start: '2026-10-03T22:30:00Z', end: '2026-10-03T23:00:00Z' },
      { start: '2026-10-03T23:00:00Z', end: '2026-10-03T23:30:00Z' },
      { start: '2026-10-03T23:30:00Z', end: '2026-10-04T00:00:00Z' },
    ]);
  });

  it('case 10: empty rules', () => {
    // No weekly rules, no overrides
    const config = {
      ...base,
      rules: [],
    };
    const slots = computeSlots(config, monday);
    expect(slots).toEqual([]);
  });
});
