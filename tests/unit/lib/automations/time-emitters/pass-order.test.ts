/**
 * The order the time-emitters run in, and what happens to the ones that
 * do not get a turn.
 *
 * The pass has a slice of the tick and runs its emitters one after
 * another, so an emitter that does not finish takes everything behind it
 * with it. That is not equally survivable for all of them.
 * `step_overdue` is deferrable: it dedupes by calendar day, so an
 * unfinished run carries on fifteen minutes later. The rest fire on a
 * date being exactly so many days away, so a run they miss is a day
 * nobody gets back. Since `step_overdue` is also the only one whose work
 * grows with the backlog, it is the one that has to run last.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sendAlert } from '@/lib/alerts/send-alert';
import { runTimeEmitters, timeEmitterRegistry } from '@/lib/automations/time-emitters';
import type { Database } from '@/types/database';

vi.mock('@/lib/alerts/send-alert', () => ({
  sendAlert: vi.fn(async () => undefined),
}));

/** Never touched: every emitter is skipped in the tests that use it. */
const unusedClient = {} as SupabaseClient<Database>;

describe('time-emitter pass order', () => {
  beforeEach(() => {
    vi.mocked(sendAlert).mockClear();
  });

  it('runs the unbounded emitter last', () => {
    const order = timeEmitterRegistry.map((emitter) => emitter.type);
    expect(order[order.length - 1]).toBe('step_overdue');
    // And it really is in there, so a rename cannot make this vacuous.
    expect(order).toContain('step_overdue');
  });

  it('runs the emitters whose miss is permanent before it', () => {
    const order: string[] = timeEmitterRegistry.map((emitter) => emitter.type);
    const overdueAt = order.indexOf('step_overdue');
    for (const type of ['time_before_event', 'time_after_event', 'anniversary_of_event']) {
      expect(order.indexOf(type), type).toBeGreaterThanOrEqual(0);
      expect(order.indexOf(type), type).toBeLessThan(overdueAt);
    }
  });

  it('names the emitters it skipped, rather than only counting them', async () => {
    // A deadline already in the past: nothing gets a turn.
    const result = await runTimeEmitters(unusedClient, { deadline: Date.now() - 1 });

    expect(result.skippedEmitters).toBe(timeEmitterRegistry.length);
    expect(result.skipped).toEqual(timeEmitterRegistry.map((emitter) => emitter.type));
    // The count alone only ever reached the tick's `truncated` flag,
    // which also means "dispatch has a backlog" and is ordinary. A
    // missed emitter is not.
    expect(vi.mocked(sendAlert)).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'automation_emitters_skipped',
        severity: 'warn',
        ran: 0,
        skipped: expect.arrayContaining(['step_overdue', 'time_before_event']),
      }),
    );
  });

  it('says nothing when every emitter got its turn', async () => {
    // Every emitter stubbed to a no-op, so the pass completes without a
    // database and without the deadline ever coming into it.
    const spies = timeEmitterRegistry.map((emitter) =>
      vi.spyOn(emitter, 'run').mockResolvedValue(0),
    );

    const result = await runTimeEmitters(unusedClient);

    for (const spy of spies) {
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    }
    expect(result.skipped).toEqual([]);
    expect(result.skippedEmitters).toBe(0);
    expect(vi.mocked(sendAlert)).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'automation_emitters_skipped' }),
    );
  });
});
