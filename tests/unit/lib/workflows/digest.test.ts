import { describe, expect, it } from 'vitest';

import {
  DIGEST_LOCAL_HOUR,
  digestSize,
  digestSubject,
  DIGEST_LOCAL_HOURS,
  isDigestHour,
  localHour,
  type DigestPayload,
} from '@/lib/workflows/digest';
import type { QueueItem } from '@/lib/workflows/queue';

function item(title: string): QueueItem {
  return {
    stepId: 's1',
    instanceId: 'i1',
    instanceName: 'Booked to wedding day',
    coupleId: 'c1',
    coupleName: 'Sam and Alex',
    weddingDate: null,
    title,
    type: 'todo',
    status: 'pending',
    dueAt: null,
  };
}

function payload(over: Partial<DigestPayload> = {}): DigestPayload {
  return {
    userId: 'u1',
    timezone: 'Australia/Sydney',
    localDate: '2026-09-10',
    review: [],
    overdue: [],
    today: [],
    sendingToday: [],
    ...over,
  };
}

describe('localHour', () => {
  it('reads the wall clock in the given zone, not UTC', () => {
    // 21:00 UTC is 07:00 the next morning in Sydney (AEST, +10).
    expect(localHour(new Date('2026-06-09T21:00:00Z'), 'Australia/Sydney')).toBe(7);
    expect(localHour(new Date('2026-06-09T21:00:00Z'), 'UTC')).toBe(21);
  });

  it('renders midnight as 0, not 24', () => {
    expect(localHour(new Date('2026-06-09T00:00:00Z'), 'UTC')).toBe(0);
  });
});

describe('isDigestHour', () => {
  it('follows daylight saving rather than a fixed UTC time', () => {
    // Sydney is +10 in June and +11 in December, so the one daily run at
    // 21:00 UTC is 7am in one half of the year and 8am in the other. Both
    // have to pass, or half the year gets no digest.
    expect(isDigestHour(new Date('2026-06-09T21:00:00Z'), 'Australia/Sydney')).toBe(true);
    expect(isDigestHour(new Date('2026-12-09T21:00:00Z'), 'Australia/Sydney')).toBe(true);
  });

  it('absorbs the Hobby plan running the job up to 59 minutes late', () => {
    // Vercel gives no timing precision below Pro: `0 21 * * *` fires
    // anywhere in the 21:00 hour, and the local hour must not change.
    expect(isDigestHour(new Date('2026-06-09T21:59:00Z'), 'Australia/Sydney')).toBe(true);
    expect(isDigestHour(new Date('2026-12-09T21:59:00Z'), 'Australia/Sydney')).toBe(true);
  });

  it('stays shut outside the morning window', () => {
    // The guard that matters: a window this wide must not creep past the
    // morning, or an MC gets the day's plan after the day has gone. Sydney
    // is +11 in December and +10 in June, so these are 6am and 9am local.
    expect(isDigestHour(new Date('2026-12-09T19:00:00Z'), 'Australia/Sydney')).toBe(false);
    expect(isDigestHour(new Date('2026-12-09T22:00:00Z'), 'Australia/Sydney')).toBe(false);
    expect(isDigestHour(new Date('2026-06-09T20:00:00Z'), 'Australia/Sydney')).toBe(false);
    expect(isDigestHour(new Date('2026-06-09T23:00:00Z'), 'Australia/Sydney')).toBe(false);
  });

  it('opens on the hour it aims for', () => {
    expect(DIGEST_LOCAL_HOURS).toContain(DIGEST_LOCAL_HOUR);
    expect(localHour(new Date('2026-06-09T21:00:00Z'), 'Australia/Sydney')).toBe(
      DIGEST_LOCAL_HOUR,
    );
  });
});

describe('digestSize', () => {
  it('counts every group, so a quiet day is zero', () => {
    expect(digestSize(payload())).toBe(0);
    expect(
      digestSize(
        payload({
          review: [item('a')],
          overdue: [item('b')],
          today: [item('c')],
          sendingToday: [item('d')],
        }),
      ),
    ).toBe(4);
  });
});

describe('digestSubject', () => {
  it('leads with the held sends, which are the only thing that stops', () => {
    expect(digestSubject(payload({ review: [item('a')], today: [item('b')] }))).toBe(
      '1 message needs your OK today',
    );
    expect(digestSubject(payload({ review: [item('a'), item('b')] }))).toBe(
      '2 messages need your OK today',
    );
  });

  it('leads with overdue when nothing is held', () => {
    expect(digestSubject(payload({ overdue: [item('a')], today: [item('b')] }))).toBe(
      '1 overdue, plus 1 due today',
    );
  });

  it('falls back to what is due today', () => {
    expect(digestSubject(payload({ today: [item('a')] }))).toBe('1 thing due today');
    expect(digestSubject(payload({ today: [item('a'), item('b')] }))).toBe(
      '2 things due today',
    );
  });
});
