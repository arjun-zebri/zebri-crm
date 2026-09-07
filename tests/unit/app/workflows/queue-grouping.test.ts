import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GROUP_BY,
  GROUP_BY_OPTIONS,
  groupByLabel,
  groupQueueItems,
} from '@/app/(dashboard)/workflows/queue-grouping';
import type { QueueItem } from '@/lib/workflows/queue';

const TZ = 'Australia/Sydney';
const NOW = new Date('2026-09-09T23:00:00Z'); // 10 Sep, 09:00 in Sydney

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

function due(date: string): string {
  return new Date(`${date}T09:00:00+10:00`).toISOString();
}

const ids = (items: QueueItem[]): string[] => items.map((i) => i.stepId);

describe('groupQueueItems — date', () => {
  it('is the default, and cuts the list into bands', () => {
    expect(DEFAULT_GROUP_BY).toBe('date');
    const items = [
      item({ stepId: 'late', dueAt: due('2026-09-08') }),
      item({ stepId: 'now', dueAt: due('2026-09-10') }),
      item({ stepId: 'soon', dueAt: due('2026-09-11') }),
    ];
    const buckets = groupQueueItems(items, 'date', TZ, NOW);
    expect(buckets.map((b) => b.key)).toEqual(['overdue', 'today', 'tomorrow']);
    expect(buckets[0]?.urgent).toBe(true);
  });
});

describe('groupQueueItems — couple', () => {
  const items = [
    item({ stepId: 'mine', coupleId: null, coupleName: null }),
    item({ stepId: 'far', coupleId: 'c2', coupleName: 'Ben and Tara', weddingDate: '2026-12-01' }),
    item({ stepId: 'near', coupleId: 'c1', coupleName: 'Sam and Alex', weddingDate: '2026-10-01' }),
    item({ stepId: 'near2', coupleId: 'c1', coupleName: 'Sam and Alex', weddingDate: '2026-10-01' }),
  ];

  it('puts the nearest wedding first and the personal list last', () => {
    const buckets = groupQueueItems(items, 'couple', TZ, NOW);
    expect(buckets.map((b) => b.label)).toEqual(['Sam and Alex', 'Ben and Tara', 'My to-dos']);
    expect(ids(buckets[0]?.items ?? [])).toEqual(['near', 'near2']);
  });

  it('puts the wedding date on the rail', () => {
    const buckets = groupQueueItems(items, 'couple', TZ, NOW);
    expect(buckets[0]?.subtitle).toBe('Thu 1 Oct');
    // Nothing to show for the personal list, and no empty second line.
    expect(buckets[2]?.subtitle).toBeUndefined();
  });

  it('never hides a step: every grouping holds the whole list', () => {
    const total = (groupBy: 'date' | 'couple' | 'handler') =>
      groupQueueItems(items, groupBy, TZ, NOW).reduce((sum, b) => sum + b.items.length, 0);
    expect(total('date')).toBe(items.length);
    expect(total('couple')).toBe(items.length);
    expect(total('handler')).toBe(items.length);
  });
});

describe('groupQueueItems — handler', () => {
  it('splits the MC’s own work from the engine’s, theirs first', () => {
    const items = [
      item({ stepId: 'auto', type: 'action' }),
      item({ stepId: 'byhand', type: 'todo' }),
    ];
    const buckets = groupQueueItems(items, 'handler', TZ, NOW);
    expect(buckets.map((b) => b.label)).toEqual(['You', 'Zebri']);
    expect(ids(buckets[0]?.items ?? [])).toEqual(['byhand']);
    expect(ids(buckets[1]?.items ?? [])).toEqual(['auto']);
  });

  it('drops a side that has nothing in it', () => {
    const buckets = groupQueueItems([item({ type: 'todo' })], 'handler', TZ, NOW);
    expect(buckets.map((b) => b.key)).toEqual(['you']);
  });
});

describe('groupByLabel', () => {
  it('reads back as a sentence on the button', () => {
    expect(groupByLabel('date')).toBe('Group by date');
    expect(groupByLabel('couple')).toBe('Group by couple');
    expect(groupByLabel('handler')).toBe('Group by who does it');
  });

  it('offers three groupings and no more', () => {
    expect(GROUP_BY_OPTIONS).toHaveLength(3);
  });
});
