/**
 * The dispatcher's owner scope.
 *
 * `dispatchPendingEvents` runs from two places now: the cron sweep,
 * which must see every tenant, and the immediate kick a mutation fires,
 * which must see exactly one. The filter is the whole difference
 * between those two, so it is pinned here rather than left to the
 * integration suite.
 */
import { describe, expect, it } from 'vitest';

import { dispatchPendingEvents } from '@/lib/workflows/dispatcher';
import type { Database } from '@/types/database';

interface Recorded {
  tables: string[];
  eq: [string, unknown][];
  gte: [string, unknown][];
}

/**
 * A PostgREST builder stub: every filter returns itself, awaiting it
 * yields no rows, and the `eq` calls are recorded.
 */
function fakeSupabase(recorded: Recorded) {
  const builder = () => {
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'is', 'order', 'limit', 'in', 'not', 'lte', 'neq', 'update']) {
      chain[method] = () => chain;
    }
    chain['eq'] = (column: string, value: unknown) => {
      recorded.eq.push([column, value]);
      return chain;
    };
    chain['gte'] = (column: string, value: unknown) => {
      recorded.gte.push([column, value]);
      return chain;
    };
    // Thenable, so `await query` resolves like a real builder.
    chain['then'] = (resolve: (r: { data: unknown[] }) => unknown) => resolve({ data: [] });
    return chain;
  };
  return {
    from: (table: string) => {
      recorded.tables.push(table);
      return builder();
    },
  } as unknown as Parameters<typeof dispatchPendingEvents>[0] & { db: Database };
}

describe('dispatchPendingEvents', () => {
  it('filters the bus to one owner when given a userId', async () => {
    const recorded: Recorded = { tables: [], eq: [], gte: [] };

    await dispatchPendingEvents(fakeSupabase(recorded), 50, { userId: 'user-1' });

    expect(recorded.tables).toContain('automation_events');
    expect(recorded.eq).toContainEqual(['user_id', 'user-1']);
  });

  it('windows the batch when given a since', async () => {
    // Oldest-first plus a limit means a backlog fills the batch with
    // history and starves the event the caller is waiting on. The
    // window is what stops that.
    const recorded: Recorded = { tables: [], eq: [], gte: [] };

    await dispatchPendingEvents(fakeSupabase(recorded), 50, {
      userId: 'user-1',
      since: '2026-09-06T10:00:00.000Z',
    });

    expect(recorded.gte).toContainEqual(['created_at', '2026-09-06T10:00:00.000Z']);
  });

  it('reads the whole bus when the cron leaves it unset', async () => {
    const recorded: Recorded = { tables: [], eq: [], gte: [] };

    await dispatchPendingEvents(fakeSupabase(recorded));

    expect(recorded.tables).toContain('automation_events');
    expect(recorded.eq).toEqual([]);
    expect(recorded.gte).toEqual([]);
  });
});
