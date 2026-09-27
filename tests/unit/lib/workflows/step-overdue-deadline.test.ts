/**
 * Where the `step_overdue` emitter stops when it runs out of its slice
 * of the tick, and whether it says so.
 *
 * The emitter's own integration spec covers the deadline end to end
 * against real Supabase, but not the case that matters most here: the
 * deadline landing partway through the rows of the **last** batch. That
 * needs the total row count and the clock both pinned, and the emitter
 * scans every tenant's overdue steps, so neither is controllable against
 * a shared database. Hence a fake client and fake timers: three rows,
 * one batch, and a clock that jumps after the first emit.
 *
 * The bug this pins: the deadline used to be a plain predicate, and the
 * flag saying "we stopped early" was set by the caller that observed it.
 * The per-row emit loop was the one caller that did not set it, so when
 * the deadline landed among the rows of the final batch there was no
 * next iteration left to notice, and the run returned a partial count
 * with no alert. That is the silent stop the whole deadline exists to
 * remove, one level further down.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sendAlert } from '@/lib/alerts/send-alert';
import { stepOverdueEmitter } from '@/lib/workflows/emitters/step-overdue';
import type { Database } from '@/types/database';

vi.mock('@/lib/alerts/send-alert', () => ({
  sendAlert: vi.fn(async () => undefined),
}));

const T0 = new Date('2026-09-23T04:00:00.000Z').getTime();

/** One overdue manual step as the emitter's scan reads it. */
function overdueRow(id: string): Record<string, unknown> {
  return {
    id,
    instance_id: 'instance-1',
    type: 'todo',
    title: `Overdue ${id}`,
    due_at: '2026-09-01T00:00:00.000Z',
    status: 'pending',
    workflow_instances: { id: 'instance-1', user_id: 'u1', couple_id: 'c1', status: 'active' },
  };
}

/**
 * The smallest client the emitter can run against.
 *
 * Every query builder method returns the same object and awaiting it
 * yields that table's canned rows, which is enough for a reader that
 * only ever filters, orders and limits. `rpc` stands in for
 * `emit_automation_event` and calls `onEmit`, which is where the test
 * moves the clock.
 */
function fakeClient(
  rows: Record<string, unknown>[],
  onEmit: (n: number) => void,
): SupabaseClient<Database> {
  let emits = 0;
  const tableRows: Record<string, unknown[]> = {
    workflow_steps: rows,
    // Nothing has fired today, so every row is new.
    automation_events: [],
  };
  const builder = (table: string): unknown => {
    const self: unknown = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === 'then') {
            return (resolve: (value: unknown) => void) =>
              resolve({ data: tableRows[table] ?? [], error: null });
          }
          return () => self;
        },
      },
    );
    return self;
  };
  return {
    from: (table: string) => builder(table),
    rpc: async () => {
      emits += 1;
      onEmit(emits);
      return { error: null };
    },
  } as unknown as SupabaseClient<Database>;
}

/** The scan-capped alerts fired so far. */
function cappedAlerts() {
  return vi
    .mocked(sendAlert)
    .mock.calls.map((call) => call[0])
    .filter((event) => event.type === 'automation_overdue_scan_capped');
}

describe('step_overdue emitter deadline', () => {
  beforeEach(() => {
    vi.mocked(sendAlert).mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports stopping when the deadline lands inside the last batch', async () => {
    const rows = [overdueRow('a'), overdueRow('b'), overdueRow('c')];
    // Three rows is one batch, so the outer loop never comes round
    // again: if the row loop does not report, nothing does.
    const client = fakeClient(rows, (n) => {
      if (n === 1) vi.setSystemTime(T0 + 5_000);
    });

    const emitted = await stepOverdueEmitter.run(client, { deadline: T0 + 1_000 });

    // It got through the scan and the first row, then stopped among the
    // rows rather than after them.
    expect(emitted).toBe(1);

    const capped = cappedAlerts();
    expect(capped).toHaveLength(1);
    expect(capped[0]).toMatchObject({ reason: 'deadline' });
  });

  it('says nothing when the whole batch fits inside the deadline', async () => {
    const rows = [overdueRow('a'), overdueRow('b'), overdueRow('c')];
    const client = fakeClient(rows, () => undefined);

    const emitted = await stepOverdueEmitter.run(client, { deadline: T0 + 60_000 });

    expect(emitted).toBe(3);
    expect(cappedAlerts()).toHaveLength(0);
  });

  it('walks everything when there is no deadline at all', async () => {
    // A direct call (a test, a one-off script) must behave exactly as it
    // did before the deadline existed, even with the clock far past
    // anything the tick would have allowed.
    const rows = [overdueRow('a'), overdueRow('b')];
    const client = fakeClient(rows, () => {
      vi.setSystemTime(T0 + 600_000);
    });

    const emitted = await stepOverdueEmitter.run(client);

    expect(emitted).toBe(2);
    expect(cappedAlerts()).toHaveLength(0);
  });
});
