/**
 * The step actions answer a failed read with a message the MC can read
 * (Task 36 fix round 1, review I2).
 *
 * Task 36 made the engine's reads throw rather than read as "nothing
 * there". A throw out of a server action reaches the MC as Next's generic
 * "An error occurred in the Server Components render" text in a
 * production build, or as nothing at all where the caller has no
 * onError. Each action now catches and returns `{ ok: false, error }`
 * with a sentence, and never the database's own text.
 *
 * @module tests/unit/app/workflows/instance-actions-failures.test
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/alerts/send-alert', () => ({ sendAlert: vi.fn(async () => undefined) }));

const { called, fakeSupabase } = await import('../../lib/workflows/fake-supabase');

const STEP_ID = '11111111-1111-4111-8111-111111111111';

/** The caller's own client: owns an active step. */
const own = fakeSupabase((table, calls) => {
  // The detail load's sibling list is a plain select, not a single row.
  if (table === 'workflow_steps' && !called(calls, 'maybeSingle')) return { data: [{ id: STEP_ID }] };
  if (table === 'workflow_steps') {
    return {
      data: {
        id: STEP_ID,
        instance_id: 'instance-1',
        status: 'pending',
        type: 'action',
        config: {},
        requires_approval: true,
      },
    };
  }
  if (table === 'workflow_instances') return { data: { id: 'instance-1', status: 'active' } };
  return { data: [] };
}).client;
(own as unknown as { auth: unknown }).auth = {
  getUser: async () => ({ data: { user: { id: 'user-1' } } }),
};
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => own }));

const admin = fakeSupabase((table) =>
  table === 'workflow_instances' ? { data: { id: 'instance-1', status: 'active' } } : { data: null },
).client;
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }));

const executor = vi.hoisted(() => ({
  completeStep: vi.fn(),
  reopenStep: vi.fn(),
  runStepNow: vi.fn(),
  completeInstanceIfDone: vi.fn(),
}));
vi.mock('@/lib/workflows/executor', () => executor);

const buildStepContext = vi.hoisted(() => vi.fn());
vi.mock('@/lib/workflows/context', () => ({ buildStepContext }));

import {
  approveStepAction,
  loadStepDetailAction,
  previewStepAction,
  retryStepAction,
  skipStepAction,
  tickStepAction,
  untickStepAction,
} from '@/app/(dashboard)/workflows/instance-actions';
import { UNEXPECTED_FAILURE } from '@/lib/workflows/action-failure';
import { CONTEXT_UNREADABLE, DB_UNREACHABLE, WorkflowReadError } from '@/lib/workflows/read-failure';

const dbDown = () => new WorkflowReadError('executor.load_instance', { message: 'connection reset by peer' });

describe('step actions on a failed read', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('tick returns the readable message, not the database text', async () => {
    executor.completeStep.mockRejectedValue(dbDown());
    const res = await tickStepAction({ stepId: STEP_ID });
    expect(res).toEqual({ ok: false, error: DB_UNREACHABLE });
  });

  it('skip returns the readable message', async () => {
    executor.completeStep.mockRejectedValue(dbDown());
    expect(await skipStepAction({ stepId: STEP_ID })).toEqual({ ok: false, error: DB_UNREACHABLE });
  });

  it('untick returns the readable message', async () => {
    executor.reopenStep.mockRejectedValue(dbDown());
    expect(await untickStepAction({ stepId: STEP_ID })).toEqual({ ok: false, error: DB_UNREACHABLE });
  });

  it('retry passes on a step-level message, such as "may or may not have sent"', async () => {
    executor.runStepNow.mockRejectedValue(
      new WorkflowReadError('executor.complete_step', { message: 'x' }, 'It may or may not have sent.'),
    );
    expect(await retryStepAction({ stepId: STEP_ID })).toEqual({
      ok: false,
      error: 'It may or may not have sent.',
    });
  });

  it('approve hides an unexpected error behind a plain sentence', async () => {
    executor.runStepNow.mockRejectedValue(new Error('TypeError: cannot read properties of null'));
    expect(await approveStepAction({ stepId: STEP_ID })).toEqual({ ok: false, error: UNEXPECTED_FAILURE });
  });

  it('approve reports a send whose finishing failed, without asking for a second press', async () => {
    executor.runStepNow.mockResolvedValue('unsettled');
    expect(await approveStepAction({ stepId: STEP_ID })).toEqual({
      ok: true,
      data: { notice: 'Sent. Finishing the step failed; it will retry.' },
    });
  });

  it('approve reports no notice on a clean send', async () => {
    executor.runStepNow.mockResolvedValue(true);
    expect(await approveStepAction({ stepId: STEP_ID })).toEqual({ ok: true, data: null });
  });

  it('preview returns the readable message when the step context cannot be read', async () => {
    buildStepContext.mockRejectedValue(
      new WorkflowReadError('context.couple', { message: 'x' }, CONTEXT_UNREADABLE),
    );
    expect(await previewStepAction({ stepId: STEP_ID })).toEqual({ ok: false, error: CONTEXT_UNREADABLE });
  });

  it('the detail load returns the readable message when the step context cannot be read', async () => {
    buildStepContext.mockRejectedValue(
      new WorkflowReadError('context.couple', { message: 'x' }, CONTEXT_UNREADABLE),
    );
    expect(await loadStepDetailAction({ stepId: STEP_ID })).toEqual({ ok: false, error: CONTEXT_UNREADABLE });
  });
});
