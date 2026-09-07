import { describe, expect, it } from 'vitest';

import { groupDoneItems } from '@/app/(dashboard)/workflows/queue-grouping';
import type { QueueItem } from '@/lib/workflows/queue';

const TZ = 'Australia/Sydney';
const NOW = new Date('2026-09-09T23:00:00Z'); // 10 Sep, 09:00 in Sydney

function done(over: Partial<QueueItem> = {}): QueueItem {
  return {
    stepId: 's1',
    instanceId: 'i1',
    instanceName: 'Booked to wedding day',
    coupleId: 'c1',
    coupleName: 'Sam and Alex',
    weddingDate: null,
    title: 'Ring the venue',
    type: 'todo',
    status: 'done',
    dueAt: null,
    completedAt: '2026-09-09T23:30:00Z',
    ...over,
  };
}

describe('groupDoneItems', () => {
  it('names today and yesterday, and dates everything older', () => {
    const buckets = groupDoneItems(
      [
        done({ stepId: 'now', completedAt: '2026-09-09T23:30:00Z' }), // 10 Sep, Sydney
        done({ stepId: 'yest', completedAt: '2026-09-08T23:30:00Z' }), // 9 Sep
        done({ stepId: 'old', completedAt: '2026-09-01T02:00:00Z' }), // 1 Sep
      ],
      TZ,
      NOW,
    );
    expect(buckets.map((b) => b.label)).toEqual(['Today', 'Yesterday', 'Tue 1 Sep']);
  });

  it('reads the day in the MC’s zone, not UTC', () => {
    // 22:30 on 10 Sep in Sydney is already 11 Sep in UTC terms for a
    // naive reader; it must still land under Today.
    const buckets = groupDoneItems(
      [done({ completedAt: '2026-09-10T12:30:00Z' })],
      TZ,
      new Date('2026-09-10T12:00:00Z'),
    );
    expect(buckets[0]?.label).toBe('Today');
  });

  it('puts the newest day first and the newest row first within it', () => {
    const buckets = groupDoneItems(
      [
        done({ stepId: 'early', completedAt: '2026-09-09T21:00:00Z' }),
        done({ stepId: 'late', completedAt: '2026-09-09T23:50:00Z' }),
      ],
      TZ,
      NOW,
    );
    expect(buckets[0]?.items.map((i) => i.stepId)).toEqual(['late', 'early']);
  });

  it('keeps a skipped step, labelled by its own status', () => {
    const buckets = groupDoneItems([done({ stepId: 'sk', status: 'skipped' })], TZ, NOW);
    expect(buckets[0]?.items[0]?.status).toBe('skipped');
  });

  it('gives a legacy row with no completed_at a home rather than dropping it', () => {
    const buckets = groupDoneItems(
      [done({ stepId: 'ok' }), done({ stepId: 'legacy', completedAt: null })],
      TZ,
      NOW,
    );
    expect(buckets.map((b) => b.key)).toEqual(['2026-09-10', 'undated']);
    expect(buckets[1]?.label).toBe('Earlier');
  });

  it('never drops a row', () => {
    const items = [done({ stepId: 'a' }), done({ stepId: 'b', status: 'skipped' })];
    const total = groupDoneItems(items, TZ, NOW).reduce((sum, b) => sum + b.items.length, 0);
    expect(total).toBe(items.length);
  });
});
