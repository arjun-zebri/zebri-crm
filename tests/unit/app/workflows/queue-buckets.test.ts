import { describe, expect, it } from 'vitest';

import {
  bucketFor,
  bucketQueueItems,
  flattenQueue,
  rowDueLabel,
} from '@/app/(dashboard)/workflows/queue-buckets';
import type { QueueItem } from '@/lib/workflows/queue';

const TZ = 'Australia/Sydney';
// 10 Sep 2026 is a Thursday in Sydney (09:00 local = 23:00 UTC on the 9th).
const NOW = new Date('2026-09-09T23:00:00Z');

function item(over: Partial<QueueItem> = {}): QueueItem {
  return {
    stepId: 's1',
    instanceId: 'i1',
    instanceName: 'Booked to wedding day',
    coupleId: 'c1',
    coupleName: 'Sam and Alex',
    weddingDate: null,
    title: 'Ring the venue',
    type: 'todo',
    status: 'pending',
    dueAt: null,
    ...over,
  };
}

/** Local 9am on a Sydney date, as the instant the queue would carry. */
function due(date: string): string {
  return new Date(`${date}T09:00:00+10:00`).toISOString();
}

describe('bucketFor', () => {
  const today = '2026-09-10';

  it('places a step by how far off its local date is', () => {
    expect(bucketFor(item({ dueAt: due('2026-09-08') }), today, TZ)).toBe('overdue');
    expect(bucketFor(item({ dueAt: due('2026-09-10') }), today, TZ)).toBe('today');
    expect(bucketFor(item({ dueAt: due('2026-09-11') }), today, TZ)).toBe('tomorrow');
    expect(bucketFor(item({ dueAt: due('2026-09-14') }), today, TZ)).toBe('this_week');
    expect(bucketFor(item({ dueAt: due('2026-09-20') }), today, TZ)).toBe('next_week');
    expect(bucketFor(item({ dueAt: due('2026-11-03') }), today, TZ)).toBe('later');
  });

  it('puts a failure in Overdue whatever date it carries', () => {
    // A step that broke is the MC's most urgent problem even if the
    // engine will not try it again until next month.
    expect(
      bucketFor(item({ status: 'errored', dueAt: due('2026-11-03') }), today, TZ),
    ).toBe('overdue');
  });

  it('keeps an undated to-do in the list rather than dropping it', () => {
    expect(bucketFor(item({ dueAt: null }), today, TZ)).toBe('undated');
  });

  it('reads the date in the MC’s zone, not UTC', () => {
    // 22:00 UTC on the 10th is already the 11th in Sydney. Bucketing on
    // the UTC date would file tomorrow's work under today.
    const lateNight = item({ dueAt: '2026-09-10T22:00:00Z' });
    expect(bucketFor(lateNight, today, TZ)).toBe('tomorrow');
    expect(bucketFor(lateNight, today, 'UTC')).toBe('today');
  });
});

describe('bucketQueueItems', () => {
  it('drops every empty band', () => {
    // A rail heading with nothing beside it reads as a loading state,
    // and with a filter applied it reads as a bug.
    expect(bucketQueueItems([], TZ, NOW)).toEqual([]);
  });

  it('dates the Today heading, and only that one', () => {
    // Today is the one heading whose meaning depends on which day the
    // MC is reading it.
    const buckets = bucketQueueItems(
      [item({ dueAt: due('2026-09-10') }), item({ stepId: 'x', dueAt: due('2026-11-03') })],
      TZ,
      NOW,
    );
    expect(buckets.find((b) => b.key === 'today')?.subtitle).toBe('Thu 10 Sep');
    expect(buckets.find((b) => b.key === 'later')?.subtitle).toBeUndefined();
  });

  it('orders the bands and sorts each one by date', () => {
    const buckets = bucketQueueItems(
      [
        item({ stepId: 'later', dueAt: due('2026-11-03') }),
        item({ stepId: 'late-today', dueAt: due('2026-09-10') }),
        item({ stepId: 'overdue', dueAt: due('2026-09-01') }),
        item({ stepId: 'early-today', dueAt: '2026-09-09T22:00:00Z' }),
      ],
      TZ,
      NOW,
    );
    expect(buckets.map((b) => b.key)).toEqual(['overdue', 'today', 'later']);
    expect(buckets[1]?.items.map((i) => i.stepId)).toEqual(['early-today', 'late-today']);
  });

  it('marks only Overdue as urgent', () => {
    const buckets = bucketQueueItems(
      [item({ dueAt: due('2026-09-01') }), item({ stepId: 'x', dueAt: due('2026-09-10') })],
      TZ,
      NOW,
    );
    expect(buckets.find((b) => b.key === 'overdue')?.urgent).toBe(true);
    expect(buckets.find((b) => b.key === 'today')?.urgent).toBe(false);
  });

  it('sorts undated work last', () => {
    const buckets = bucketQueueItems(
      [item({ stepId: 'no-date', dueAt: null }), item({ stepId: 'dated', dueAt: due('2026-09-10') })],
      TZ,
      NOW,
    );
    expect(buckets.map((b) => b.key)).toEqual(['today', 'undated']);
  });
});

describe('rowDueLabel', () => {
  it('says how long an overdue step has been sitting', () => {
    expect(rowDueLabel(item({ dueAt: due('2026-09-09') }), 'overdue', TZ, NOW)).toBe(
      'Yesterday',
    );
    expect(rowDueLabel(item({ dueAt: due('2026-06-15') }), 'overdue', TZ, NOW)).toBe(
      '87 days ago',
    );
  });

  it('gives a time for today, because that is what is left to decide', () => {
    expect(rowDueLabel(item({ dueAt: due('2026-09-10') }), 'today', TZ, NOW)).toBe('9:00am');
  });

  it('gives a weekday inside the fortnight and a date beyond it', () => {
    expect(rowDueLabel(item({ dueAt: due('2026-09-14') }), 'this_week', TZ, NOW)).toBe('Mon');
    expect(rowDueLabel(item({ dueAt: due('2026-11-03') }), 'later', TZ, NOW)).toBe(
      'Tue 3 Nov',
    );
  });

  it('says Failed rather than a date for a broken step', () => {
    expect(
      rowDueLabel(item({ status: 'errored', dueAt: due('2026-09-01') }), 'overdue', TZ, NOW),
    ).toBe('Failed');
  });
});

describe('flattenQueue', () => {
  it('merges every group the loader returns into one list', () => {
    // The five groups were five answers to a question the MC was not
    // asking; the list re-cuts them by date instead.
    const flat = flattenQueue({
      review: [item({ stepId: 'a' })],
      overdue: [item({ stepId: 'b' })],
      today: [item({ stepId: 'c' })],
      upcoming: [item({ stepId: 'd' })],
      sendingToday: [item({ stepId: 'e' })],
    });
    expect(flat.map((i) => i.stepId)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});
