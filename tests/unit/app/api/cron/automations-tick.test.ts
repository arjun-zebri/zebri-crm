/**
 * Unit tests for the automations tick route.
 *
 * The engine passes are mocked; what is under test is the route's own
 * contract: the executor runs first on a capped slice, the emitters run
 * only on the quarter hour, the heartbeat carries the pass counts, and
 * one pass throwing does not cost the others their turn.
 *
 * @module tests/unit/app/api/cron/automations-tick.test
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/cron-auth', () => ({
  isCronAuthorized: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/alerts/send-alert', () => ({
  sendAlert: vi.fn(),
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

const countQuery = { count: 0 };
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        is: () => Promise.resolve({ count: countQuery.count }),
      }),
    }),
  }),
}));

import {
  EXECUTOR_BUDGET_MS,
  GET,
  shouldRunEmitters,
  TICK_BUDGET_MS,
} from '@/app/api/cron/automations-tick/route';
import { sendAlert } from '@/lib/alerts/send-alert';
import { isCronAuthorized } from '@/lib/api/cron-auth';

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
    vi.mocked(isCronAuthorized).mockReturnValue(true);
    advanceDueSteps.mockResolvedValue(executorResult);
    dispatchPendingEvents.mockResolvedValue(dispatchResult);
    runTimeEmitters.mockResolvedValue(emittersResult);
    recordHeartbeat.mockResolvedValue(undefined);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-22T10:07:00Z'));
  });

  it('rejects an unauthorised caller before touching the engine', async () => {
    vi.mocked(isCronAuthorized).mockReturnValue(false);
    const res = await GET(request());
    expect(res.status).toBe(401);
    expect(calls).toEqual([]);
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
});
