/**
 * Unit tests for the automations tick route.
 *
 * The engine passes are mocked; what is under test is the route's own
 * contract: the executor runs first on a capped slice, the emitters run
 * only on the quarter hour, the heartbeat carries the pass counts, one
 * pass throwing does not cost the others their turn, and a tick that
 * cannot take the `automations-tick` lease skips every pass rather than
 * racing whichever run already holds it. `acquire_scheduler_lease`
 * itself is exercised for real against local Supabase in
 * `tests/integration/workflows/tick-lease.test.ts`; here it is just the
 * boolean the route branches on.
 *
 * @module tests/unit/app/api/cron/automations-tick.test
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/cron-auth', () => ({
  isCronAuthorized: vi.fn().mockReturnValue(true),
}));

// Resolves true: a delivered alert. The reads-failed dedupe is stamped
// only after a post that landed (Phase 6 review I2), so a mock answering
// nothing would read as "never delivered" and disable the dedupe.
vi.mock('@/lib/alerts/send-alert', () => ({
  sendAlert: vi.fn(async () => true),
}));

const calls: string[] = [];
const advanceDueSteps = vi.fn();
const dispatchPendingEvents = vi.fn();
const runTimeEmitters = vi.fn();
const recordHeartbeat = vi.fn();

vi.mock('@/lib/workflows/executor', () => ({
  advanceDueSteps: (...args: unknown[]) => {
    calls.push('executor');
    return advanceDueSteps(...args);
  },
  // Stubbed so a clean tick is clean: left out, both sweeps threw on
  // every run, which only showed once the heartbeat named failed passes.
  sweepStuckSteps: async () => 0,
}));
vi.mock('@/lib/workflows/interrupted-applies', () => ({
  sweepInterruptedApplies: async () => 0,
}));
const healStrandedInstances = vi.fn();
/** Passes already run when the heal pass started (kept out of `calls`, which pins the other passes' order). */
const ranBeforeHeal: string[][] = [];
vi.mock('@/lib/workflows/heal', () => ({
  healStrandedInstances: (...args: unknown[]) => {
    ranBeforeHeal.push([...calls]);
    return healStrandedInstances(...args);
  },
}));
vi.mock('@/lib/workflows/dispatcher', () => ({
  dispatchPendingEvents: (...args: unknown[]) => {
    calls.push('dispatch');
    return dispatchPendingEvents(...args);
  },
}));
vi.mock('@/lib/automations/time-emitters', () => ({
  runTimeEmitters: (...args: unknown[]) => {
    calls.push('emitters');
    return runTimeEmitters(...args);
  },
}));
vi.mock('@/lib/workflows/heartbeat', () => ({
  TICK_HEARTBEAT: 'automations-tick',
  recordHeartbeat: (...args: unknown[]) => recordHeartbeat(...args),
}));

const countQuery = { count: 0, throws: false, error: null as { message: string } | null };
const rpc = vi.fn();
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        is: () =>
          countQuery.throws
            ? Promise.reject(new Error('backlog count exploded'))
            : Promise.resolve({ count: countQuery.count, error: countQuery.error }),
      }),
    }),
    rpc: (...args: unknown[]) => rpc(...args),
  }),
}));

import {
  EMITTERS_BUDGET_MS,
  EXECUTOR_BUDGET_MS,
  GET,
  HEAL_BUDGET_MS,
  shouldRunEmitters,
  TICK_BUDGET_MS,
} from '@/app/api/cron/automations-tick/route';
import { sendAlert } from '@/lib/alerts/send-alert';
import { isCronAuthorized } from '@/lib/api/cron-auth';
import { _resetTickAlertsForTest } from '@/lib/workflows/tick-alerts';

function request() {
  return new NextRequest('https://zebri.test/api/cron/automations-tick');
}

const executorResult = { stepsExecuted: 3, stepsFailed: 0, truncated: false, durationMs: 5 };
const dispatchResult = {
  processedEvents: 2,
  instancesOpened: 1,
  staleEvents: 4,
  truncated: false,
  durationMs: 5,
};
const emittersResult = {
  emitted: {},
  totalEmitted: 0,
  failedEmitters: 0,
  skippedEmitters: 0,
  durationMs: 1,
};

describe('shouldRunEmitters', () => {
  it('is true on the quarter hour only', () => {
    expect(shouldRunEmitters(new Date('2026-09-22T10:00:00Z'))).toBe(true);
    expect(shouldRunEmitters(new Date('2026-09-22T10:15:00Z'))).toBe(true);
    expect(shouldRunEmitters(new Date('2026-09-22T10:45:59Z'))).toBe(true);
    expect(shouldRunEmitters(new Date('2026-09-22T10:01:00Z'))).toBe(false);
    expect(shouldRunEmitters(new Date('2026-09-22T10:14:00Z'))).toBe(false);
  });
});

describe('GET /api/cron/automations-tick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.length = 0;
    countQuery.count = 0;
    countQuery.throws = false;
    countQuery.error = null;
    vi.mocked(isCronAuthorized).mockReturnValue(true);
    rpc.mockResolvedValue({ data: true });
    advanceDueSteps.mockResolvedValue(executorResult);
    dispatchPendingEvents.mockResolvedValue(dispatchResult);
    runTimeEmitters.mockResolvedValue(emittersResult);
    recordHeartbeat.mockResolvedValue(undefined);
    healStrandedInstances.mockResolvedValue({ healed: 0, failed: 0, firstFailedSite: null });
    _resetTickAlertsForTest();
    vi.mocked(sendAlert).mockImplementation(async () => true);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-22T10:07:00Z'));
  });

  it('rejects an unauthorised caller before touching the engine', async () => {
    vi.mocked(isCronAuthorized).mockReturnValue(false);
    const res = await GET(request());
    expect(res.status).toBe(401);
    expect(calls).toEqual([]);
  });

  it('skips the tick without running any pass when the lease is not held', async () => {
    rpc.mockResolvedValue({ data: false });
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, skipped: 'another tick is running' });
    expect(calls).toEqual([]);
    expect(recordHeartbeat).not.toHaveBeenCalled();
    // A tick that never held the lease must not hand one back: the run
    // that is genuinely working would lose its protection to the one
    // that did nothing.
    expect(rpc.mock.calls.map((c) => c[0])).not.toContain('release_scheduler_lease');
  });

  /**
   * The lease TTL has to outlast the longest tick, which makes it longer
   * than the gap between two ticks. So a finished tick that does not
   * release refuses the next minute's run on a completely healthy
   * system, and the per-minute schedule quietly becomes two-minute.
   */
  it('releases the lease it took, with the same token, once the passes are done', async () => {
    await GET(request());
    const acquire = rpc.mock.calls.find((c) => c[0] === 'acquire_scheduler_lease');
    const release = rpc.mock.calls.find((c) => c[0] === 'release_scheduler_lease');
    expect(acquire).toBeDefined();
    expect(release).toBeDefined();
    const acquireArgs = acquire?.[1] as { p_name: string; p_token: string; p_ttl_seconds: number };
    const releaseArgs = release?.[1] as { p_name: string; p_token: string };
    expect(releaseArgs.p_name).toBe(acquireArgs.p_name);
    expect(releaseArgs.p_token).toBe(acquireArgs.p_token);
    // Twice the tick budget, so only a run that died ever expires.
    expect(acquireArgs.p_ttl_seconds * 1000).toBeGreaterThan(TICK_BUDGET_MS);
  });

  it('releases the lease even when the tick throws on its way out', async () => {
    countQuery.throws = true;
    await expect(GET(request())).rejects.toThrow('backlog count exploded');
    expect(rpc.mock.calls.map((c) => c[0])).toContain('release_scheduler_lease');
  });

  // Phase 4 fix-2 (N2): the tick revokes finished shadow sessions, and a
  // failure there alerts without costing any other pass its turn.
  it('sweeps finished shadow sessions and reports how many it revoked', async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === 'revoke_expired_shadow_sessions' ? { data: 2, error: null } : { data: true },
    );
    const res = await GET(request());
    expect(rpc.mock.calls.map((c) => c[0])).toContain('revoke_expired_shadow_sessions');
    expect(await res.json()).toMatchObject({ ok: true, shadow_sessions_revoked: 2 });
  });

  it('alerts when the shadow sweep fails and still runs every other pass', async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === 'revoke_expired_shadow_sessions'
        ? { data: null, error: { message: 'permission denied for table sessions' } }
        : { data: true },
    );
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, shadow_sessions_revoked: 0 });
    expect(vi.mocked(sendAlert)).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'app_error',
        source: 'shadow.revoke_expired',
        message: expect.stringContaining('permission denied'),
      }),
    );
    expect(advanceDueSteps).toHaveBeenCalled();
    expect(dispatchPendingEvents).toHaveBeenCalled();
    expect(recordHeartbeat).toHaveBeenCalled();
  });

  it('gives each tick its own lease token', async () => {
    await GET(request());
    const firstToken = (rpc.mock.calls.find((c) => c[0] === 'acquire_scheduler_lease')?.[1] as {
      p_token: string;
    }).p_token;
    rpc.mockClear();
    await GET(request());
    const secondToken = (rpc.mock.calls.find((c) => c[0] === 'acquire_scheduler_lease')?.[1] as {
      p_token: string;
    }).p_token;
    expect(secondToken).not.toBe(firstToken);
  });

  it('alerts and answers ok: false, distinct from ordinary contention, when the lease check itself fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'connection refused' } });
    const res = await GET(request());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, skipped: 'lease check failed' });
    expect(body.skipped).not.toBe('another tick is running');
    expect(calls).toEqual([]);
    expect(recordHeartbeat).not.toHaveBeenCalled();
    expect(vi.mocked(sendAlert)).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'app_error',
        source: 'workflows.lease',
        message: expect.stringContaining('connection refused'),
      }),
    );
  });

  it('runs the executor first, then dispatch, and skips the emitters off the quarter hour', async () => {
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(calls).toEqual(['executor', 'dispatch']);
    const body = await res.json();
    expect(body.emitters.durationMs).toBe(0);
    expect(body.workflow_executor.stepsExecuted).toBe(3);
  });

  it('runs the emitters between the executor and dispatch on the quarter hour', async () => {
    vi.setSystemTime(new Date('2026-09-22T10:15:00Z'));
    await GET(request());
    expect(calls).toEqual(['executor', 'emitters', 'dispatch']);
  });

  it('caps the executor at its own slice and gives dispatch the full budget', async () => {
    const started = Date.now();
    await GET(request());
    const executorOpts = advanceDueSteps.mock.calls[0]?.[1] as { deadline: number };
    expect(executorOpts.deadline).toBe(started + EXECUTOR_BUDGET_MS);
    const dispatchOpts = dispatchPendingEvents.mock.calls[0]?.[2] as { deadline: number };
    expect(dispatchOpts.deadline).toBe(started + TICK_BUDGET_MS);
    expect(EXECUTOR_BUDGET_MS).toBeLessThan(TICK_BUDGET_MS);
  });

  it('caps the emitters at their own slice, measured from when they start', async () => {
    vi.setSystemTime(new Date('2026-09-22T10:15:00Z'));
    const started = Date.now();
    await GET(request());
    const emitterOpts = runTimeEmitters.mock.calls[0]?.[1] as { deadline: number };
    // The emitter pass runs thousands of sequential round trips on a
    // backlog; without a slice of its own it can run the function past
    // the platform limit, which kills the tick mid-pass.
    expect(emitterOpts.deadline).toBe(started + EMITTERS_BUDGET_MS);
    expect(EMITTERS_BUDGET_MS).toBeLessThan(TICK_BUDGET_MS);
  });

  it('a throwing emitter pass alerts and still lets dispatch and the heartbeat run', async () => {
    vi.setSystemTime(new Date('2026-09-22T10:15:00Z'));
    runTimeEmitters.mockRejectedValue(new Error('emitter boom'));
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(calls).toEqual(['executor', 'emitters', 'dispatch']);
    expect(vi.mocked(sendAlert)).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'app_error', source: 'workflows.emitters' }),
    );
    expect(recordHeartbeat).toHaveBeenCalledTimes(1);
    expect((await res.json()).emitters).toMatchObject({ totalEmitted: 0 });
  });

  it('stamps the heartbeat last, with the pass counts', async () => {
    await GET(request());
    expect(recordHeartbeat).toHaveBeenCalledTimes(1);
    expect(recordHeartbeat.mock.calls[0]?.[1]).toBe('automations-tick');
    expect(recordHeartbeat.mock.calls[0]?.[2]).toMatchObject({
      truncated: false,
      stepsExecuted: 3,
      processedEvents: 2,
      staleEvents: 4,
    });
  });

  it('a throwing executor alerts and still lets dispatch and the heartbeat run', async () => {
    advanceDueSteps.mockRejectedValue(new Error('boom'));
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(calls).toEqual(['executor', 'dispatch']);
    expect(vi.mocked(sendAlert)).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'app_error', source: 'workflows.executor' }),
    );
    expect(recordHeartbeat.mock.calls[0]?.[2]).toMatchObject({ stepsExecuted: 0, processedEvents: 2 });
  });

  it('reports truncated when any pass ran out of budget', async () => {
    advanceDueSteps.mockResolvedValue({ ...executorResult, truncated: true });
    const res = await GET(request());
    expect((await res.json()).truncated).toBe(true);
    expect(recordHeartbeat.mock.calls[0]?.[2]).toMatchObject({ truncated: true });
  });

  it('alerts on a backlog over the threshold', async () => {
    countQuery.count = 250;
    await GET(request());
    expect(vi.mocked(sendAlert)).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'automation_tick_backlog', pendingEvents: 250 }),
    );
  });

  // Task 36 (audit M4): the run record says which passes failed, so a
  // heartbeat stamped after a failed executor no longer reads as a clean
  // tick that simply found nothing due.
  it('records the passes that failed in the heartbeat and the response', async () => {
    advanceDueSteps.mockRejectedValue(new Error('boom'));
    const res = await GET(request());
    expect(recordHeartbeat.mock.calls[0]?.[2]).toMatchObject({ failedPasses: ['workflows.executor'] });
    expect((await res.json()).failed_passes).toEqual(['workflows.executor']);
  });

  it('records no failed passes on a clean tick', async () => {
    await GET(request());
    expect(recordHeartbeat.mock.calls[0]?.[2]).toMatchObject({ failedPasses: [] });
  });

  it('alerts on reads that failed inside a pass, and records them', async () => {
    advanceDueSteps.mockResolvedValue({ ...executorResult, failedReads: 2 });
    dispatchPendingEvents.mockResolvedValue({ ...dispatchResult, readFailures: 1 });
    await GET(request());
    expect(vi.mocked(sendAlert)).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'workflow_reads_failed', executor: 2, dispatch: 1 }),
    );
    expect(recordHeartbeat.mock.calls[0]?.[2]).toMatchObject({ failedReads: 3 });
  });

  it('alerts, rather than reporting an empty backlog, when the backlog count fails', async () => {
    countQuery.error = { message: 'statement timeout' };
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(vi.mocked(sendAlert)).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'app_error', source: 'workflows.backlog' }),
    );
    expect(recordHeartbeat.mock.calls[0]?.[2]).toMatchObject({ failedPasses: ['workflows.backlog'] });
    expect((await res.json()).backlog).toBeNull();
  });

  // Fix round 1 (review I1): the heal pass redoes the bookkeeping a
  // failed write left behind, before the executor, so a follower it
  // dates can run on this same tick.
  it('heals stranded instances before the executor runs', async () => {
    ranBeforeHeal.length = 0;
    await GET(request());
    expect(ranBeforeHeal).toEqual([[]]);
    expect(calls).toContain('executor');
  });

  // Fix round 2 (re-review N4): the heal has its own slice, carved out of
  // the executor's, so a large backlog cannot eat the time due steps need.
  it('gives the heal pass a deadline inside the executor\'s slice', async () => {
    const started = Date.now();
    await GET(request());
    const healOpts = healStrandedInstances.mock.calls[0]?.[1] as { deadline: number };
    expect(healOpts.deadline).toBe(started + HEAL_BUDGET_MS);
    expect(HEAL_BUDGET_MS).toBeLessThan(EXECUTOR_BUDGET_MS);
  });

  it('a throwing heal pass alerts and still lets the executor run', async () => {
    healStrandedInstances.mockRejectedValue(new Error('rpc down'));
    await GET(request());
    expect(calls).toContain('executor');
    expect(vi.mocked(sendAlert)).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'app_error', source: 'workflows.heal_stranded' }),
    );
  });

  it('counts instances the heal could not fix as failed reads', async () => {
    healStrandedInstances.mockResolvedValue({ healed: 1, failed: 2, firstFailedSite: 'executor.load_instance' });
    await GET(request());
    expect(recordHeartbeat.mock.calls[0]?.[2]).toMatchObject({ failedReads: 2 });
  });

  // Review M2 and M6: the alert names the first read that failed, and is
  // deduped to one per ten minutes.
  it('names the first failing read, and alerts once per ten minutes', async () => {
    advanceDueSteps.mockResolvedValue({ ...executorResult, failedReads: 1, failedReadSite: 'executor.load_instance' });
    await GET(request());
    await GET(request());
    const alerts = vi.mocked(sendAlert).mock.calls.filter(([e]) => e.type === 'workflow_reads_failed');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.[0]).toMatchObject({ site: 'executor.load_instance' });

    vi.setSystemTime(new Date('2026-09-22T10:18:00Z'));
    await GET(request());
    expect(vi.mocked(sendAlert).mock.calls.filter(([e]) => e.type === 'workflow_reads_failed')).toHaveLength(2);
  });

  // Phase 6 review I2: the failed-read alert was fired and forgotten, and
  // a Slack post still in flight when a Vercel function returns may never
  // complete. With the dedupe stamped before the post, a lost post also
  // silenced the next ten minutes.
  describe('the failed-read alert is delivered, not fired and forgotten', () => {
    it('is awaited before the heartbeat is stamped', async () => {
      const order: string[] = [];
      vi.mocked(sendAlert).mockImplementation(async (event) => {
        if (event.type !== 'workflow_reads_failed') return true;
        order.push('alert-start');
        await Promise.resolve();
        await Promise.resolve();
        order.push('alert-done');
        return true;
      });
      recordHeartbeat.mockImplementation(async () => {
        order.push('heartbeat');
      });
      advanceDueSteps.mockResolvedValue({ ...executorResult, failedReads: 1, failedReadSite: 'executor.load_instance' });

      await GET(request());

      expect(order).toEqual(['alert-start', 'alert-done', 'heartbeat']);
    });

    it('does not start the ten-minute quiet window when the post did not land', async () => {
      advanceDueSteps.mockResolvedValue({ ...executorResult, failedReads: 1, failedReadSite: 'executor.load_instance' });
      vi.mocked(sendAlert).mockImplementation(async (event) => event.type !== 'workflow_reads_failed');
      await GET(request());
      vi.mocked(sendAlert).mockImplementation(async () => true);
      await GET(request());

      const alerts = vi.mocked(sendAlert).mock.calls.filter(([e]) => e.type === 'workflow_reads_failed');
      expect(alerts).toHaveLength(2);
    });

    it('records the failed read count and its site on the heartbeat, for the Admin card', async () => {
      advanceDueSteps.mockResolvedValue({ ...executorResult, failedReads: 2, failedReadSite: 'executor.load_instance' });
      await GET(request());
      expect(recordHeartbeat.mock.calls[0]?.[2]).toMatchObject({
        failedReads: 2,
        failedReadSite: 'executor.load_instance',
      });
    });

    it("awaits a failed pass's alert too", async () => {
      let deliver: (delivered: boolean) => void = () => {};
      vi.mocked(sendAlert).mockImplementation((event) =>
        event.type === 'app_error' ? new Promise<boolean>((resolve) => (deliver = resolve)) : Promise.resolve(true),
      );
      advanceDueSteps.mockRejectedValue(new Error('executor exploded'));

      const tick = GET(request());
      // Plenty of turns for every other (mocked, instant) pass to finish.
      for (let turn = 0; turn < 500; turn += 1) await Promise.resolve();
      // Still waiting on the undelivered alert: nothing after it has run.
      expect(recordHeartbeat).not.toHaveBeenCalled();

      deliver(true);
      await tick;
      expect(recordHeartbeat).toHaveBeenCalled();
    });
  });
});
