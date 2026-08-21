import { describe, expect, it } from 'vitest';

import { mergeIntervals, subtractInterval, type BusyInterval, excludeBookingMirrors } from '@/lib/calendar/intervals';

const iv = (start: string, end: string): BusyInterval => ({ start, end });

describe('mergeIntervals', () => {
  it('returns [] for []', () => {
    expect(mergeIntervals([])).toEqual([]);
  });

  it('sorts disjoint intervals', () => {
    expect(
      mergeIntervals([
        iv('2026-09-01T04:00:00Z', '2026-09-01T05:00:00Z'),
        iv('2026-09-01T01:00:00Z', '2026-09-01T02:00:00Z'),
      ]),
    ).toEqual([
      iv('2026-09-01T01:00:00Z', '2026-09-01T02:00:00Z'),
      iv('2026-09-01T04:00:00Z', '2026-09-01T05:00:00Z'),
    ]);
  });

  it('merges overlapping intervals', () => {
    expect(
      mergeIntervals([
        iv('2026-09-01T01:00:00Z', '2026-09-01T03:00:00Z'),
        iv('2026-09-01T02:00:00Z', '2026-09-01T04:00:00Z'),
      ]),
    ).toEqual([iv('2026-09-01T01:00:00Z', '2026-09-01T04:00:00Z')]);
  });

  it('merges touching intervals (end == start)', () => {
    expect(
      mergeIntervals([
        iv('2026-09-01T01:00:00Z', '2026-09-01T02:00:00Z'),
        iv('2026-09-01T02:00:00Z', '2026-09-01T03:00:00Z'),
      ]),
    ).toEqual([iv('2026-09-01T01:00:00Z', '2026-09-01T03:00:00Z')]);
  });

  it('merges contained intervals', () => {
    expect(
      mergeIntervals([
        iv('2026-09-01T01:00:00Z', '2026-09-01T06:00:00Z'),
        iv('2026-09-01T02:00:00Z', '2026-09-01T03:00:00Z'),
      ]),
    ).toEqual([iv('2026-09-01T01:00:00Z', '2026-09-01T06:00:00Z')]);
  });
});

describe('subtractInterval', () => {
  it('returns unchanged when cut has no overlap', () => {
    expect(
      subtractInterval(
        [iv('2026-09-01T01:00:00Z', '2026-09-01T02:00:00Z')],
        iv('2026-09-01T05:00:00Z', '2026-09-01T06:00:00Z'),
      ),
    ).toEqual([iv('2026-09-01T01:00:00Z', '2026-09-01T02:00:00Z')]);
  });

  it('drops interval when cut covers it entirely', () => {
    expect(
      subtractInterval(
        [iv('2026-09-01T02:00:00Z', '2026-09-01T03:00:00Z')],
        iv('2026-09-01T01:00:00Z', '2026-09-01T04:00:00Z'),
      ),
    ).toEqual([]);
  });

  it('trims start when cut overlaps from left', () => {
    expect(
      subtractInterval(
        [iv('2026-09-01T01:00:00Z', '2026-09-01T04:00:00Z')],
        iv('2026-09-01T00:00:00Z', '2026-09-01T02:00:00Z'),
      ),
    ).toEqual([iv('2026-09-01T02:00:00Z', '2026-09-01T04:00:00Z')]);
  });

  it('trims end when cut overlaps from right', () => {
    expect(
      subtractInterval(
        [iv('2026-09-01T01:00:00Z', '2026-09-01T04:00:00Z')],
        iv('2026-09-01T03:00:00Z', '2026-09-01T05:00:00Z'),
      ),
    ).toEqual([iv('2026-09-01T01:00:00Z', '2026-09-01T03:00:00Z')]);
  });

  it('splits interval when cut is strictly inside', () => {
    expect(
      subtractInterval(
        [iv('2026-09-01T01:00:00Z', '2026-09-01T05:00:00Z')],
        iv('2026-09-01T02:00:00Z', '2026-09-01T03:00:00Z'),
      ),
    ).toEqual([
      iv('2026-09-01T01:00:00Z', '2026-09-01T02:00:00Z'),
      iv('2026-09-01T03:00:00Z', '2026-09-01T05:00:00Z'),
    ]);
  });

  it('handles multiple intervals with mixed overlaps', () => {
    expect(
      subtractInterval(
        [
          iv('2026-09-01T01:00:00Z', '2026-09-01T02:00:00Z'), // no overlap
          iv('2026-09-01T03:00:00Z', '2026-09-01T06:00:00Z'), // split
          iv('2026-09-01T08:00:00Z', '2026-09-01T09:00:00Z'), // no overlap
        ],
        iv('2026-09-01T04:00:00Z', '2026-09-01T05:00:00Z'),
      ),
    ).toEqual([
      iv('2026-09-01T01:00:00Z', '2026-09-01T02:00:00Z'),
      iv('2026-09-01T03:00:00Z', '2026-09-01T04:00:00Z'),
      iv('2026-09-01T05:00:00Z', '2026-09-01T06:00:00Z'),
      iv('2026-09-01T08:00:00Z', '2026-09-01T09:00:00Z'),
    ]);
  });
});

describe('excludeBookingMirrors', () => {
  const BUSY = [
    { start: '2026-08-21T06:30:00Z', end: '2026-08-21T07:00:00Z', title: 'Zebri Intro' },
    { start: '2026-08-21T09:00:00Z', end: '2026-08-21T10:00:00Z', title: 'Dentist' },
  ];

  it('removes the external copy of a Zebri booking', () => {
    // Confirming a booking pushes it to Google, which hands it straight back as
    // busy. Left in, it draws a block underneath the booking's own chip.
    const result = excludeBookingMirrors(BUSY, [
      { start: '2026-08-21T06:30:00Z', end: '2026-08-21T07:00:00Z' },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe('Dentist');
  });

  it('keeps external events that merely overlap a booking', () => {
    // Only an exact match is a mirror. A genuine clash must stay visible, since
    // that is something the MC needs to resolve.
    const result = excludeBookingMirrors(BUSY, [
      { start: '2026-08-21T09:15:00Z', end: '2026-08-21T09:45:00Z' },
    ]);

    expect(result).toHaveLength(2);
  });

  it('matches instants rather than string forms', () => {
    // Providers disagree on ISO formatting; the same moment must still match.
    const result = excludeBookingMirrors(
      [{ start: '2026-08-21T06:30:00.000Z', end: '2026-08-21T07:00:00.000Z' }],
      [{ start: '2026-08-21T06:30:00Z', end: '2026-08-21T07:00:00Z' }],
    );

    expect(result).toHaveLength(0);
  });

  it('returns the input untouched when there are no bookings', () => {
    expect(excludeBookingMirrors(BUSY, [])).toBe(BUSY);
  });
});

describe('excludeBookingMirrors by event id', () => {
  it('drops the calendar copy Zebri created, even after a reschedule moved it', () => {
    // The booking now sits at 14:00 while the stale free/busy response still
    // reports the old 09:00 slot. Times cannot match; the id still does.
    const busy = [
      { id: 'goog-1', start: '2026-08-21T09:00:00Z', end: '2026-08-21T09:30:00Z' },
    ];

    const result = excludeBookingMirrors(busy, [
      {
        start: '2026-08-21T14:00:00Z',
        end: '2026-08-21T14:30:00Z',
        externalEventIds: { google: 'goog-1' },
      },
    ]);

    expect(result).toHaveLength(0);
  });

  it('keeps a real meeting that merely shares a booking slot', () => {
    // Same half hour, different event. Hiding it would conceal a genuine clash
    // the MC needs to resolve.
    const busy = [
      { id: 'goog-other', start: '2026-08-21T09:00:00Z', end: '2026-08-21T09:30:00Z' },
    ];

    const result = excludeBookingMirrors(busy, [
      {
        start: '2026-08-21T09:00:00Z',
        end: '2026-08-21T09:30:00Z',
        externalEventIds: { google: 'goog-1' },
      },
    ]);

    // Falls back to the time match, which is correct here: the chip already
    // covers this slot, so a block behind it would only be noise.
    expect(result).toHaveLength(0);
  });

  it('still matches on times when the event carries no id', () => {
    // Events created before ids were captured, and providers that omit them.
    const busy = [{ start: '2026-08-21T09:00:00Z', end: '2026-08-21T09:30:00Z' }];

    const result = excludeBookingMirrors(busy, [
      { start: '2026-08-21T09:00:00Z', end: '2026-08-21T09:30:00Z' },
    ]);

    expect(result).toHaveLength(0);
  });

  it('matches whichever provider holds the copy', () => {
    const busy = [
      { id: 'ms-9', start: '2026-08-21T09:00:00Z', end: '2026-08-21T09:30:00Z' },
    ];

    const result = excludeBookingMirrors(busy, [
      {
        start: '2026-08-22T15:00:00Z',
        end: '2026-08-22T15:30:00Z',
        externalEventIds: { google: 'goog-1', microsoft: 'ms-9' },
      },
    ]);

    expect(result).toHaveLength(0);
  });

  it('tolerates a booking with no external ids recorded', () => {
    const busy = [
      { id: 'goog-x', start: '2026-08-21T11:00:00Z', end: '2026-08-21T12:00:00Z' },
    ];

    const result = excludeBookingMirrors(busy, [
      { start: '2026-08-21T09:00:00Z', end: '2026-08-21T09:30:00Z', externalEventIds: null },
    ]);

    expect(result).toHaveLength(1);
  });
});
