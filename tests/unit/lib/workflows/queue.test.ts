import { describe, expect, it } from 'vitest';

import { groupQueueItems, type QueueItem } from '@/lib/workflows/queue';

const SYDNEY = 'Australia/Sydney';

function item(over: Partial<QueueItem>): QueueItem {
  return {
    stepId: 's1',
    instanceId: 'i1',
    instanceName: 'General',
    coupleId: 'c1',
    coupleName: 'Sarah & Tom',
    weddingDate: '2026-11-14',
    title: 'Call the venue',
    type: 'todo',
    status: 'pending',
    dueAt: null,
    ...over,
  };
}

describe('groupQueueItems', () => {
  // "Now" is 2026-09-10 09:00 UTC, which is 2026-09-10 19:00 in Sydney.
  const now = new Date('2026-09-10T09:00:00Z');

  it('files yesterday as overdue', () => {
    const out = groupQueueItems([item({ dueAt: '2026-09-09T00:00:00Z' })], now, SYDNEY);
    expect(out.overdue).toHaveLength(1);
    expect(out.today).toHaveLength(0);
    expect(out.upcoming).toHaveLength(0);
  });

  it('files later today as today', () => {
    // 2026-09-10 14:00 Sydney, still ahead of the 19:00 "now".
    const out = groupQueueItems([item({ dueAt: '2026-09-10T04:00:00Z' })], now, SYDNEY);
    expect(out.today).toHaveLength(1);
  });

  it('files tomorrow as upcoming', () => {
    const out = groupQueueItems([item({ dueAt: '2026-09-11T04:00:00Z' })], now, SYDNEY);
    expect(out.upcoming).toHaveLength(1);
  });

  it('keeps a late-evening local step in today, not overdue', () => {
    // 2026-09-10 23:00 Sydney is 2026-09-10T13:00Z, which is AFTER the
    // 09:00Z "now" but on the same Sydney day. Grouping on the UTC date
    // would file it as tomorrow; grouping on the instant alone would
    // call it upcoming. It is due today.
    const out = groupQueueItems([item({ dueAt: '2026-09-10T13:00:00Z' })], now, SYDNEY);
    expect(out.today).toHaveLength(1);
    expect(out.upcoming).toHaveLength(0);
  });

  it('files an early-morning UTC step correctly across the date line', () => {
    // 2026-09-11T13:00Z is 2026-09-12 00:00 Sydney: two Sydney days out
    // even though it is barely one UTC day out.
    const out = groupQueueItems([item({ dueAt: '2026-09-11T13:00:00Z' })], now, SYDNEY);
    expect(out.upcoming).toHaveLength(1);
  });

  it('puts a step with no due date in upcoming, last', () => {
    // An ad-hoc to-do with no date is real work; dropping it would lose
    // it entirely.
    const out = groupQueueItems([item({ dueAt: null })], now, SYDNEY);
    expect(out.upcoming).toHaveLength(1);
  });

  it('sorts each group by due date, undated last', () => {
    const out = groupQueueItems(
      [
        item({ stepId: 'c', dueAt: null }),
        item({ stepId: 'b', dueAt: '2026-09-13T04:00:00Z' }),
        item({ stepId: 'a', dueAt: '2026-09-12T04:00:00Z' }),
      ],
      now,
      SYDNEY,
    );
    expect(out.upcoming.map((i) => i.stepId)).toEqual(['a', 'b', 'c']);
  });

  it('sorts overdue oldest first, because that is the most urgent', () => {
    const out = groupQueueItems(
      [
        item({ stepId: 'recent', dueAt: '2026-09-09T00:00:00Z' }),
        item({ stepId: 'ancient', dueAt: '2026-08-01T00:00:00Z' }),
      ],
      now,
      SYDNEY,
    );
    expect(out.overdue.map((i) => i.stepId)).toEqual(['ancient', 'recent']);
  });

  it('counts an errored step as overdue whatever its date', () => {
    // An errored automated step is work the MC has to deal with, and it
    // would otherwise be invisible outside the couple profile.
    const out = groupQueueItems(
      [item({ status: 'errored', type: 'action', dueAt: '2026-12-01T00:00:00Z' })],
      now,
      SYDNEY,
    );
    expect(out.overdue).toHaveLength(1);
  });

  it('groups in the MC timezone, not UTC', () => {
    // The same instant lands in different buckets depending on the zone,
    // which is the whole reason this function takes one.
    const dueAt = '2026-09-10T13:00:00Z';
    expect(groupQueueItems([item({ dueAt })], now, SYDNEY).today).toHaveLength(1);
    expect(groupQueueItems([item({ dueAt })], now, 'Etc/UTC').today).toHaveLength(1);
    expect(groupQueueItems([item({ dueAt })], now, 'America/New_York').today).toHaveLength(1);
  });
});

describe('groupQueueItems — the engine half of the day', () => {
  const now = new Date('2026-09-10T02:00:00Z');

  it('puts a due held send in front of the MC', () => {
    // The only group where doing nothing means the message never goes.
    const out = groupQueueItems(
      [
        item({
          type: 'action',
          requiresApproval: true,
          dueAt: '2026-09-10T00:00:00Z',
        }),
      ],
      now,
      SYDNEY,
    );
    expect(out.review).toHaveLength(1);
    expect(out.today).toHaveLength(0);
    expect(out.sendingToday).toHaveLength(0);
  });

  it('lists what will send by itself today, without asking for anything', () => {
    const out = groupQueueItems(
      [item({ type: 'action', dueAt: '2026-09-10T04:00:00Z' })],
      now,
      SYDNEY,
    );
    expect(out.sendingToday).toHaveLength(1);
    expect(out.today).toHaveLength(0);
  });

  it('keeps automated steps out of the to-do groups entirely', () => {
    // An MC cannot tick an automated step, so putting one in "Due today"
    // would be asking them to do something they cannot do.
    const out = groupQueueItems(
      [item({ type: 'action', dueAt: '2026-09-01T00:00:00Z' })],
      now,
      SYDNEY,
    );
    expect(out.today).toHaveLength(0);
    expect(out.upcoming).toHaveLength(0);
    expect(out.sendingToday).toHaveLength(1);
  });

  it('treats a failed automated step as the most urgent thing there is', () => {
    const out = groupQueueItems(
      [item({ type: 'action', status: 'errored', dueAt: '2026-09-01T00:00:00Z' })],
      now,
      SYDNEY,
    );
    expect(out.overdue).toHaveLength(1);
    expect(out.sendingToday).toHaveLength(0);
  });

  it('does not surface a held send before it is due', () => {
    const out = groupQueueItems(
      [item({ type: 'action', requiresApproval: true, dueAt: '2026-09-20T00:00:00Z' })],
      now,
      SYDNEY,
    );
    expect(out.review).toHaveLength(0);
    expect(out.sendingToday).toHaveLength(0);
  });
});
