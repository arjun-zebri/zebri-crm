/**
 * The immediate kick.
 *
 * A workflow whose apply rule is "when a couple is added" opened its
 * instance only when the daily cron ran, so adding a couple appeared to
 * do nothing at all. The mutation now runs the same two passes for the
 * MC who caused the event, and these pin the two properties that make
 * that safe: it is scoped to that one owner, and it can never fail the
 * mutation that called it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Typed as variadic so the recorded calls keep their arguments; the
// kick's contract is entirely in what it passes.
const dispatchMock = vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({
  processedEvents: 0,
  matchedTemplates: 0,
  openedInstances: 0,
  appointmentsCompleted: 0,
}));
const advanceMock = vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({
  stepsExecuted: 0,
  instancesCompleted: 0,
  errors: 0,
}));
const errorMock = vi.fn();

vi.mock('@/lib/workflows/dispatcher', () => ({
  dispatchPendingEvents: (...args: unknown[]) => dispatchMock(...args),
}));
vi.mock('@/lib/workflows/executor', () => ({
  advanceDueSteps: (...args: unknown[]) => advanceMock(...args),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ marker: 'admin' }),
}));
vi.mock('@/lib/alerts/logger', () => ({
  logger: { error: (...args: unknown[]) => errorMock(...args) },
}));
// Stands in for a request scope: `after` runs the work, unless the
// test asks it to behave as it does outside one.
const afterMock = vi.fn<(work: () => unknown) => void>((work) => {
  void work();
});
vi.mock('next/server', () => ({ after: (work: () => unknown) => afterMock(work) }));

const { kickWorkflows, scheduleKick } = await import('@/lib/workflows/kick');

describe('kickWorkflows', () => {
  beforeEach(() => {
    dispatchMock.mockClear();
    advanceMock.mockClear();
    errorMock.mockClear();
  });

  it('runs both passes scoped to the one owner', async () => {
    // Unscoped, one MC adding a couple would work every other tenant's
    // backlog on their request - and send their mail.
    await kickWorkflows('user-1');

    expect(dispatchMock).toHaveBeenCalledTimes(1);
    const opts = dispatchMock.mock.calls[0]?.[2] as { userId: string; since: string };
    expect(opts.userId).toBe('user-1');
    expect(advanceMock).toHaveBeenCalledTimes(1);
    expect(advanceMock.mock.calls[0]?.[1]).toEqual({ userId: 'user-1' });
  });

  it('windows the dispatch to the recent past', async () => {
    // The batch is oldest-first: against a backlog, a limit alone
    // drains history and leaves the event the MC is watching for
    // undispatched. Verified the hard way against a real 164-event bus.
    const before = Date.now();
    await kickWorkflows('user-1');

    const { since } = dispatchMock.mock.calls[0]?.[2] as { since: string };
    const ms = new Date(since).getTime();
    expect(ms).toBeLessThan(before);
    // Recent, not historical: minutes back, never hours.
    expect(before - ms).toBeLessThanOrEqual(10 * 60 * 1000);
  });

  it('dispatches before it executes', async () => {
    // An instance opened by this pass has steps that may already be
    // due; the MC expects the first one to have run by the time they
    // look at it.
    const order: string[] = [];
    dispatchMock.mockImplementationOnce(async () => {
      order.push('dispatch');
      return {
        processedEvents: 0,
        matchedTemplates: 0,
        openedInstances: 0,
        appointmentsCompleted: 0,
      };
    });
    advanceMock.mockImplementationOnce(async () => {
      order.push('advance');
      return { stepsExecuted: 0, instancesCompleted: 0, errors: 0 };
    });

    await kickWorkflows('user-1');

    expect(order).toEqual(['dispatch', 'advance']);
  });

  it('never throws into the mutation that called it', async () => {
    // The event keeps its null processed_at, so the cron sweep picks it
    // up. A failed kick costs freshness, never the couple that was
    // being created.
    dispatchMock.mockRejectedValueOnce(new Error('bus unreachable'));

    await expect(kickWorkflows('user-1')).resolves.toBeUndefined();
    expect(errorMock).toHaveBeenCalled();
  });
});

describe('scheduleKick', () => {
  beforeEach(() => {
    dispatchMock.mockClear();
    afterMock.mockClear();
  });

  it('waits for the response before doing any work', () => {
    scheduleKick('user-1');
    expect(afterMock).toHaveBeenCalledTimes(1);
  });

  it('still kicks when there is no request to wait for', async () => {
    // A script or a test calling the action straight from Node has no
    // request scope, and `after` throws. Dropping the kick there would
    // make the engine look broken in exactly the place it is tested.
    afterMock.mockImplementationOnce(() => {
      throw new Error('`after` was called outside a request scope.');
    });

    expect(() => scheduleKick('user-1')).not.toThrow();
    await vi.waitFor(() => expect(dispatchMock).toHaveBeenCalledTimes(1));
  });
});
