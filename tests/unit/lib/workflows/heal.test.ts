/**
 * The tick's heal pass (Task 36 fix round 1, review I1).
 *
 * Finds the instances a failed bookkeeping write marked
 * (`needs_recompute_at`, through `workflow_stranded_instances`, keyset
 * paged) and redoes the bookkeeping: skip everything under each finished
 * branch's losing side, re-date the steps, complete the instance if
 * nothing is left, then clear the marker it read. Its own read throws;
 * one instance that cannot be healed is counted, keeps its marker, and
 * the rest carry on. It stops starting instances at its deadline.
 *
 * @module tests/unit/lib/workflows/heal.test
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/alerts/send-alert', () => ({ sendAlert: vi.fn(async () => undefined) }));

import { HEAL_PAGE_SIZE, healStrandedInstances } from '@/lib/workflows/heal';
import { isWorkflowReadError } from '@/lib/workflows/read-failure';

import { type Call, called, failed, fakeSupabase } from './fake-supabase';

const instance = (id: string) => ({
  id,
  user_id: 'user-1',
  couple_id: null,
  template_id: null,
  status: 'active',
  applied_at: '2026-09-01T00:00:00.000Z',
  is_default: false,
  is_personal: false,
  context: {},
  needs_recompute_at: '2026-09-26T01:00:00.123456+00:00',
});

/** The update that clears the marker, if the pass wrote one. */
function markerClear(log: { table: string; calls: Call[] }[]) {
  return log.find(
    (q) =>
      q.table === 'workflow_instances' &&
      q.calls.some(
        (c) =>
          c.method === 'update' &&
          (c.args[0] as { needs_recompute_at?: unknown }).needs_recompute_at === null,
      ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('healStrandedInstances', () => {
  it('throws when the stranded read fails, rather than reporting nothing stranded', async () => {
    const { client } = fakeSupabase(() => ({ data: [] }), () => failed());
    await expect(healStrandedInstances(client)).rejects.toSatisfy(isWorkflowReadError);
  });

  it('pages by instance id and stops at a short page', async () => {
    const pages: unknown[] = [];
    const full = Array.from({ length: HEAL_PAGE_SIZE }, (_, i) => ({
      instance_id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
    }));
    const { client } = fakeSupabase(
      (table, calls) =>
        table === 'workflow_instances' && called(calls, 'maybeSingle')
          ? { data: instance('x') }
          : { data: [], count: 1 },
      (_fn, args) => {
        pages.push(args);
        return { data: pages.length === 1 ? full : [] };
      },
    );

    await healStrandedInstances(client);

    expect(pages).toEqual([
      { p_limit: HEAL_PAGE_SIZE },
      { p_limit: HEAL_PAGE_SIZE, p_after: full[full.length - 1]!.instance_id },
    ]);
  });

  it('skips everything under a finished branch\'s losing side, nested branches included (N3)', async () => {
    const base = { instance_id: 'i1', completed_at: null, output: null, position: 0, status: 'pending', type: 'todo', timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' } };
    const steps = [
      { ...base, id: 'b', type: 'branch', status: 'done', completed_at: '2026-09-02T00:00:00.000Z', output: { branch_taken: 'yes' }, parent_step_id: null, branch_path: null },
      { ...base, id: 'win', parent_step_id: 'b', branch_path: 'yes' },
      { ...base, id: 'nested', type: 'branch', parent_step_id: 'b', branch_path: 'no' },
      { ...base, id: 'nested-yes', parent_step_id: 'nested', branch_path: 'yes' },
      { ...base, id: 'nested-no', parent_step_id: 'nested', branch_path: 'no' },
    ];
    const { client, log } = fakeSupabase(
      (table, calls) => {
        if (table === 'workflow_instances' && called(calls, 'maybeSingle')) return { data: instance('i1') };
        if (table === 'workflow_steps' && called(calls, 'update')) return { data: [{ id: 'x' }] };
        return { data: steps, count: 1 };
      },
      () => ({ data: [{ instance_id: 'i1' }] }),
    );

    const result = await healStrandedInstances(client);

    expect(result.healed).toBe(1);
    const skip = log.find(
      (q) =>
        q.table === 'workflow_steps' &&
        q.calls.some((c) => c.method === 'update' && (c.args[0] as { status?: string }).status === 'skipped'),
    );
    expect(skip).toBeDefined();
    const ids = skip!.calls.find((c) => c.method === 'in' && c.args[0] === 'id')?.args[1] as string[];
    expect([...ids].sort()).toEqual(['nested', 'nested-no', 'nested-yes']);
  });

  it('clears the marker it read once the instance is healed, and only that one', async () => {
    const { client, log } = fakeSupabase(
      (table, calls) =>
        table === 'workflow_instances' && called(calls, 'maybeSingle')
          ? { data: instance('i1') }
          : { data: [], count: 1 },
      () => ({ data: [{ instance_id: 'i1' }] }),
    );

    await healStrandedInstances(client);

    const clear = markerClear(log);
    expect(clear).toBeDefined();
    // Guarded on the value read: a failure marking it again mid-heal wins.
    expect(clear!.calls.find((c) => c.method === 'eq' && c.args[0] === 'needs_recompute_at')?.args[1]).toBe(
      '2026-09-26T01:00:00.123456+00:00',
    );
  });

  it('keeps the marker on an instance it could not heal', async () => {
    const { client, log } = fakeSupabase(
      (table, calls) => {
        if (table === 'workflow_instances' && called(calls, 'maybeSingle')) return { data: instance('i1') };
        if (table === 'workflow_steps') return failed();
        return { data: [], count: 1 };
      },
      () => ({ data: [{ instance_id: 'i1' }] }),
    );

    const result = await healStrandedInstances(client);

    expect(result.failed).toBe(1);
    expect(markerClear(log)).toBeUndefined();
  });

  it('starts no instance past its deadline (N4)', async () => {
    const { client, log } = fakeSupabase(
      (table, calls) =>
        table === 'workflow_instances' && called(calls, 'maybeSingle')
          ? { data: instance('i1') }
          : { data: [], count: 1 },
      () => ({ data: [{ instance_id: 'i1' }, { instance_id: 'i2' }] }),
    );

    const result = await healStrandedInstances(client, { deadline: Date.now() - 1 });

    expect(result.healed).toBe(0);
    expect(result.truncated).toBe(true);
    expect(log.some((q) => q.table === 'workflow_instances')).toBe(false);
  });

  it('counts an instance it cannot heal and carries on with the next', async () => {
    const { client } = fakeSupabase(
      (table, calls) => {
        if (table === 'workflow_instances' && called(calls, 'maybeSingle')) {
          return called(calls, 'eq', 'id') &&
            calls.find((c) => c.method === 'eq' && c.args[0] === 'id')?.args[1] === 'bad'
            ? failed()
            : { data: instance('good') };
        }
        return { data: [], count: 1 };
      },
      () => ({ data: [{ instance_id: 'bad' }, { instance_id: 'good' }] }),
    );

    const result = await healStrandedInstances(client);

    expect(result.failed).toBe(1);
    expect(result.healed).toBe(1);
    expect(result.firstFailedSite).toBe('heal.load_instance');
  });
});
