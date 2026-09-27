/**
 * A step that finished never strands the steps behind it (Task 36 fix
 * round 1, review I1).
 *
 * The completion is one guarded write; merging the output, skipping the
 * losing branch and re-dating the followers are separate statements. A
 * failure in any of those after the completion landed used to go to
 * `run`'s catch, whose `markErrored` matches nothing on a `done` row, so
 * the followers kept a null date for good. Now the failure is caught,
 * alerted with the instance id (deduped), counted, and left for the
 * tick's heal pass. And the review's M6: a completion write that itself
 * fails puts the "may or may not have sent" message on the step.
 *
 * @module tests/unit/lib/workflows/unsettled-completion.test
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/alerts/send-alert', () => ({ sendAlert: vi.fn(async () => undefined) }));

const loadDueSteps = vi.fn();
vi.mock('@/lib/workflows/due-steps', () => ({
  loadDueSteps: (...args: unknown[]) => loadDueSteps(...args),
}));
vi.mock('@/lib/workflows/account-pause', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/workflows/account-pause')>()),
  loadAccountPauses: vi.fn(async () => new Map()),
}));
vi.mock('@/lib/workflows/context', () => ({
  buildStepContext: vi.fn(async () => ({ instanceId: 'instance-1', stepId: 'step-1' })),
}));
vi.mock('@/lib/workflows/execute-step', () => ({
  executeStep: vi.fn(async () => ({ result: { kind: 'ok', output: { sent: 1 } } })),
  quietHoursHoldUntil: vi.fn(() => null),
}));

import { sendAlert } from '@/lib/alerts/send-alert';
import {
  _resetUnsettledAlertDedupForTest,
  advanceDueSteps,
  completeStep,
  runStepNow,
} from '@/lib/workflows/executor';

import { type Call, called, failed, fakeSupabase, type Reply } from './fake-supabase';

const instance = {
  id: 'instance-1',
  user_id: 'user-1',
  couple_id: 'couple-1',
  template_id: null,
  status: 'active',
  applied_at: '2026-09-01T00:00:00.000Z',
  is_default: false,
  is_personal: false,
  context: {},
};

const step = {
  id: 'step-1',
  instance_id: 'instance-1',
  type: 'action',
  status: 'pending',
  due_at: '2026-01-01T00:00:00.000Z',
  requires_approval: false,
  config: { actionType: 'add_note' },
  attempt_count: 0,
};

/** Is this the step's guarded completion write (status done, guarded on running)? */
function completionWrite(calls: Call[]): boolean {
  return calls.some(
    (c) => c.method === 'update' && (c.args[0] as { status?: string }).status === 'done',
  );
}

/**
 * Is this the instance context merge? An RPC since the Phase 6 wave
 * (`workflow_merge_step_outputs`, one SQL statement), no longer an update
 * of the whole context.
 */
function contextMerge(fn: string): boolean {
  return fn === 'workflow_merge_step_outputs';
}

/**
 * The engine's guarded writes that are RPCs since the Phase 6 wave (the
 * claim, the wait's finish and hold, which also require the instance to
 * be active): each answers "this caller got it" unless `broken` fails it.
 */
function engineRpc(broken: (fn: string) => boolean = () => false) {
  return (fn: string): Reply => {
    if (broken(fn)) return failed();
    if (fn === 'workflow_claim_step' || fn === 'workflow_finish_wait' || fn === 'workflow_hold_wait') {
      return { data: true };
    }
    return { data: null };
  };
}

/** A database where everything works, except what `broken` says fails. */
function db(broken: (table: string, calls: Call[]) => boolean, brokenRpc: (fn: string) => boolean = () => false) {
  return fakeSupabase((table, calls): Reply => {
    if (broken(table, calls)) return failed();
    if (table === 'workflow_instances' && called(calls, 'maybeSingle')) return { data: instance };
    // The tick's batched read (Task 38): the same row, as a list.
    if (table === 'workflow_instances' && called(calls, 'in')) return { data: [instance] };
    if (table === 'workflow_steps' && called(calls, 'maybeSingle')) return { data: step };
    if (table === 'workflow_steps' && called(calls, 'update')) return { data: [{ id: 'step-1' }] };
    if (table === 'workflow_steps' && called(calls, 'select')) return { data: [], count: 1 };
    return { data: null };
  }, engineRpc(brokenRpc));
}

/** Nothing fails on a table: for the cases where only an RPC does. */
const noTable = () => false;

/** The status each errored write on workflow_steps set, and its message. */
function erroredWrites(log: ReturnType<typeof db>['log']): string[] {
  return log
    .filter((q) => q.table === 'workflow_steps')
    .flatMap((q) => q.calls)
    .filter((c) => c.method === 'update' && (c.args[0] as { status?: string }).status === 'errored')
    .map((c) => (c.args[0] as { error_message: string }).error_message);
}

describe('bookkeeping after a completion lands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetUnsettledAlertDedupForTest();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    loadDueSteps.mockResolvedValue([step]);
  });

  it('does not strand the step: counts it, alerts with the instance id, and does not error the done step', async () => {
    const { client, log } = db(noTable, contextMerge);

    const result = await advanceDueSteps(client);

    expect(result.stepsExecuted).toBe(1);
    expect(result.errors).toBe(0);
    expect(result.failedReads).toBe(1);
    expect(erroredWrites(log)).toEqual([]);
    expect(vi.mocked(sendAlert)).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'workflow_step_unsettled',
        instanceId: 'instance-1',
        stepId: 'step-1',
        site: 'executor.merge_output',
      }),
    );
  });

  it('marks the instance for the heal pass, and says so in the alert (re-review N1)', async () => {
    const { client, log } = db(noTable, contextMerge);

    await advanceDueSteps(client);

    const markWrite = log.find(
      (q) =>
        q.table === 'workflow_instances' &&
        q.calls.some(
          (c) => c.method === 'update' && 'needs_recompute_at' in (c.args[0] as object),
        ),
    );
    expect(markWrite).toBeDefined();
    expect(markWrite!.calls.find((c) => c.method === 'eq')?.args).toEqual(['id', 'instance-1']);
    expect(vi.mocked(sendAlert)).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'workflow_step_unsettled', marked: true }),
    );
  });

  it('alerts marked: false when the marker could not be written either', async () => {
    const markerWrite = (table: string, calls: Call[]) =>
      table === 'workflow_instances' &&
      calls.some((c) => c.method === 'update' && 'needs_recompute_at' in (c.args[0] as object));
    const { client } = db(markerWrite, contextMerge);

    const result = await advanceDueSteps(client);

    expect(result.errors).toBe(0);
    expect(vi.mocked(sendAlert)).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'workflow_step_unsettled', marked: false }),
    );
  });

  it('dedupes the alert per instance', async () => {
    await advanceDueSteps(db(noTable, contextMerge).client);
    await advanceDueSteps(db(noTable, contextMerge).client);
    const unsettled = vi
      .mocked(sendAlert)
      .mock.calls.filter(([e]) => e.type === 'workflow_step_unsettled');
    expect(unsettled).toHaveLength(1);
  });

  it('puts the "may or may not have sent" message on a step whose completion write failed', async () => {
    const { client, log } = db((table, calls) => table === 'workflow_steps' && completionWrite(calls));

    const result = await advanceDueSteps(client);

    expect(result.failedReads).toBe(1);
    expect(erroredWrites(log)).toEqual([
      expect.stringContaining('It may or may not have sent'),
    ]);
  });

  it('counts a woken wait whose finish write failed, and does not count it as run (review M6)', async () => {
    const wait = { ...step, type: 'wait', status: 'waiting', config: { mode: 'duration', durationMinutes: 1 } };
    loadDueSteps.mockResolvedValue([wait]);
    const { client } = fakeSupabase((table, calls) => {
      if (table === 'workflow_instances' && called(calls, 'maybeSingle')) return { data: instance };
      // The tick's batched read (Task 38): the same row, as a list.
      if (table === 'workflow_instances' && called(calls, 'in')) return { data: [instance] };
      if (table === 'workflow_steps' && called(calls, 'update')) return { data: [{ id: 'step-1' }] };
      return { data: [], count: 1 };
      // The finish is `workflow_finish_wait` since the Phase 6 wave.
    }, engineRpc((fn) => fn === 'workflow_finish_wait'));

    const result = await advanceDueSteps(client);

    expect(result.stepsExecuted).toBe(0);
    expect(result.failedReads).toBe(1);
    expect(result.failedReadSite).toBe('executor.finish_wait');
  });

  it('marks the instances of a failed completion read for the heal pass (review M3)', async () => {
    let instanceReads = 0;
    const { client, log } = fakeSupabase((table, calls): Reply => {
      if (table === 'workflow_instances' && called(calls, 'select') && called(calls, 'in')) {
        instanceReads += 1;
        // The read before the step runs works; the closing completion
        // read, after it, fails.
        return instanceReads === 1 ? { data: [instance] } : failed();
      }
      if (table === 'workflow_steps' && called(calls, 'update')) return { data: [{ id: 'step-1' }] };
      if (table === 'workflow_steps' && called(calls, 'select')) return { data: [], count: 1 };
      return { data: null };
    }, engineRpc());

    const result = await advanceDueSteps(client);

    expect(result.stepsExecuted).toBe(1);
    expect(result.failedReads).toBe(1);
    // Without the marker the heal never looks at this instance, and a
    // finished workflow shows as running until the MC acts.
    const marks = log.filter(
      (q) =>
        q.table === 'workflow_instances' &&
        q.calls.some((c) => c.method === 'update' && 'needs_recompute_at' in (c.args[0] as object)),
    );
    expect(marks).toHaveLength(1);
    expect(marks[0]!.calls.find((c) => c.method === 'in')?.args[1]).toEqual(['instance-1']);
  });

  it('completeStep reports the tick as landed when only the re-dating after it failed', async () => {
    // The step read and the write work; the recompute's step read fails.
    const { client } = fakeSupabase((table, calls) => {
      if (table === 'workflow_steps' && called(calls, 'maybeSingle')) {
        return { data: { ...step, type: 'todo' } };
      }
      if (table === 'workflow_steps' && called(calls, 'update')) return { data: [{ id: 'step-1' }] };
      if (table === 'workflow_steps') return failed();
      if (table === 'workflow_instances') return { data: instance };
      return { data: null };
    });

    await expect(completeStep(client, 'step-1')).resolves.toBe('unsettled');
    expect(vi.mocked(sendAlert)).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'workflow_step_unsettled', instanceId: 'instance-1' }),
    );
  });

  it('runStepNow says the send went but the bookkeeping did not', async () => {
    const { client } = db(noTable, contextMerge);
    await expect(runStepNow(client, 'step-1')).resolves.toBe('unsettled');
  });
});
