/**
 * The tick reads instances and quiet hours per pass, not per step
 * (Task 38).
 *
 * Every due step used to cost its own instance read before it ran, its
 * own quiet-hours read inside the run, and its own instance read again
 * when the pass checked whether the workflow had finished. That is the
 * first thing that bends as accounts grow. These tests count the reads a
 * pass makes against the real schema, and pin the behaviour the batching
 * must not change: a failed batch is a failed read for every step it
 * covered (never "instance missing"), state the pass itself changed is
 * re-read, and a pause the MC presses mid-pass is still seen once the
 * batch has aged.
 *
 * @module tests/integration/workflows/executor-batch-reads.test
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { advanceDueSteps } from '@/lib/workflows/executor';
import { CONTEXT_UNREADABLE } from '@/lib/workflows/read-failure';
import type { Json } from '@/types/database';

import { createTestUser, serviceClient, type DbClient, type TestUser } from '../helpers/supabase';

const admin = serviceClient();
let user: TestUser;
const PAST = '2025-01-01T00:00:00.000Z';

beforeAll(async () => {
  user = await createTestUser(
    {},
    { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
  );
});

afterAll(async () => {
  await user?.cleanup();
});

/** One query the wrapped client started: its table, first call, and the rest. */
interface Query {
  table: string;
  method: string;
  args: unknown[];
  /** Every call chained after the first (`.in(...)`, `.eq(...)`, ...). */
  chain: { method: string; args: unknown[] }[];
}

/** What a hook may do to one query before it runs. */
interface HookResult {
  /** Replacement arguments for the first builder call. */
  args?: unknown[];
  /** Work that must finish before the query itself runs. */
  before?: PromiseLike<unknown>;
}

/**
 * A builder that records every chained call into `q.chain` and, when a
 * `gate` is given, waits for it before running. Every chained call
 * returns another such builder, so `.update().eq().select()` is recorded
 * and still waits.
 */
function recorded<T extends object>(target: T, q: Query, gate: PromiseLike<unknown> | null): T {
  return new Proxy(target, {
    get(t, prop) {
      const value = (t as Record<string | symbol, unknown>)[prop];
      if (prop === 'then' && gate) {
        return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
          gate.then(() => (t as unknown as PromiseLike<unknown>).then(resolve, reject), reject);
      }
      if (typeof value !== 'function' || prop === 'then') {
        return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(t) : value;
      }
      return (...args: unknown[]) => {
        q.chain.push({ method: String(prop), args });
        const next = (value as (...a: unknown[]) => unknown).apply(t, args);
        return next && typeof next === 'object' ? recorded(next, q, gate) : next;
      };
    },
  });
}

/**
 * The service client, recording every query it starts. `hook` sees each
 * query before it runs and may swap its arguments (a column that does
 * not exist makes one read fail for real) or hold it until other work
 * has landed (a pause the MC presses mid-pass).
 */
function countingClient(
  hook: (q: Query) => HookResult | void = () => undefined,
): { client: DbClient; queries: Query[] } {
  const queries: Query[] = [];
  const client = new Proxy(admin, {
    get(target, prop) {
      if (prop === 'from') {
        return (table: string) => {
          const builder = target.from(table as never);
          return new Proxy(builder, {
            get(b, method) {
              const value = (b as unknown as Record<string | symbol, unknown>)[method];
              if (typeof value !== 'function') return value;
              return (...args: unknown[]) => {
                const q: Query = { table, method: String(method), args, chain: [] };
                queries.push(q);
                const effect = hook(q) ?? {};
                const result = (value as (...a: unknown[]) => unknown).apply(b, effect.args ?? args);
                return recorded(result as object, q, effect.before ?? null);
              };
            },
          });
        };
      }
      if (prop === 'rpc') {
        // An RPC is recorded as table `rpc`, method = the function name,
        // so a hook can hold the step claim (`workflow_claim_step`).
        return (fn: string, params?: unknown) => {
          const q: Query = { table: 'rpc', method: fn, args: [params], chain: [] };
          queries.push(q);
          const effect = hook(q) ?? {};
          const result = (target.rpc as (...a: unknown[]) => unknown).call(target, fn, params);
          return recorded(result as object, q, effect.before ?? null);
        };
      }
      const value = (target as unknown as Record<string | symbol, unknown>)[prop];
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });
  return { client, queries };
}

/** Reads (a query whose first call is `select`) on one table. */
function reads(queries: Query[], table: string): number {
  return queries.filter((q) => q.table === table && q.method === 'select').length;
}

/** The ids each read on one table asked for by `in(...)`. */
function inLists(queries: Query[], table: string): unknown[][] {
  return queries
    .filter((q) => q.table === table && q.method === 'select')
    .flatMap((q) => q.chain.filter((c) => c.method === 'in').map((c) => c.args[1] as unknown[]));
}

/** A couple for this user. */
async function couple(name: string): Promise<string> {
  const { data, error } = await admin
    .from('couples')
    .insert({ user_id: user.id, name, status: 'Enquiry' })
    .select('id')
    .single();
  expect(error).toBeNull();
  return data!.id;
}

/**
 * `n` workflows on one couple, each from its own template (one per
 * template and couple is enforced), each with one due `add_note` step.
 */
async function dueWorkflows(
  coupleId: string,
  n: number,
  label: string,
): Promise<{ instanceIds: string[]; stepIds: string[]; templateIds: string[] }> {
  const { data: templates, error: tplErr } = await admin
    .from('workflow_templates')
    .insert(
      Array.from({ length: n }, (_, i) => ({
        user_id: user.id,
        name: `${label} ${i}`,
        status: 'active',
        quiet_hours_start: null,
        quiet_hours_end: null,
      })) as never,
    )
    .select('id');
  expect(tplErr).toBeNull();
  const templateIds = (templates as { id: string }[]).map((t) => t.id);
  const { data: instances, error: instErr } = await admin
    .from('workflow_instances')
    .insert(
      templateIds.map((templateId, i) => ({
        user_id: user.id,
        couple_id: coupleId,
        template_id: templateId,
        name: `${label} ${i}`,
      })) as never,
    )
    .select('id');
  expect(instErr).toBeNull();
  const instanceIds = (instances as { id: string }[]).map((r) => r.id);
  const { data: steps, error: stepErr } = await admin
    .from('workflow_steps')
    .insert(
      instanceIds.map((instanceId) => ({
        instance_id: instanceId,
        position: 0,
        type: 'action',
        title: 'Add a note',
        config: { actionType: 'add_note', text: label } as Json,
        status: 'pending',
        due_at: PAST,
      })) as never,
    )
    .select('id');
  expect(stepErr).toBeNull();
  return { instanceIds, stepIds: (steps as { id: string }[]).map((s) => s.id), templateIds };
}

async function statuses(stepIds: string[]): Promise<string[]> {
  const { data } = await admin.from('workflow_steps').select('status').in('id', stepIds);
  return (data ?? []).map((r) => r.status as string);
}

describe('advanceDueSteps reads per pass, not per step', () => {
  it('costs the same handful of instance and quiet-hours reads for 3 steps as for 150', async () => {
    const coupleId = await couple('Batch Reads');

    const small = await dueWorkflows(coupleId, 3, 'Small');
    const few = countingClient();
    // A long freshness window so the count measures the batching alone,
    // not how many seconds the pass happened to take on this machine.
    const smallResult = await advanceDueSteps(few.client, { userId: user.id, readFreshMs: 600_000 });
    expect(smallResult.stepsExecuted).toBe(3);
    expect(await statuses(small.stepIds)).toEqual(['done', 'done', 'done']);

    const large = await dueWorkflows(coupleId, 150, 'Large');
    const many = countingClient();
    const largeResult = await advanceDueSteps(many.client, { userId: user.id, readFreshMs: 600_000 });
    expect(largeResult.stepsExecuted).toBe(150);
    expect(largeResult.failedReads).toBe(0);
    expect(new Set(await statuses(large.stepIds))).toEqual(new Set(['done']));

    // Instances: batches before the steps run and when the pass checks
    // for finished workflows. The first read of a pass is one row (there
    // is no rate to size it from yet); the next is sized from how fast
    // that row was used, here a full chunk. Per step, this was 6 for 3
    // steps and 2 x 150 = 300 for 150.
    expect(reads(few.queries, 'workflow_instances')).toBe(3);
    expect(reads(many.queries, 'workflow_instances')).toBe(5);
    // Quiet hours the same way. Per step, 3 and 150.
    expect(reads(few.queries, 'workflow_templates')).toBe(2);
    expect(reads(many.queries, 'workflow_templates')).toBe(3);

    // No row asked for twice: the rows moved equal the per-step
    // baseline (one per step before it ran and one at the completion
    // check; one template per step), and every id list stays inside
    // the chunk.
    const instanceRows = inLists(many.queries, 'workflow_instances');
    const templateRows = inLists(many.queries, 'workflow_templates');
    expect(instanceRows.flat()).toHaveLength(300);
    expect(templateRows.flat()).toHaveLength(150);
    for (const list of [...instanceRows, ...templateRows]) {
      expect(list.length).toBeLessThanOrEqual(100);
    }
  }, 120_000);
});

describe('what the batching must not change', () => {
  it('a failed quiet-hours batch errors each step it covered, exactly as the per-step read did', async () => {
    const coupleId = await couple('Batch Quiet Fails');
    const { stepIds } = await dueWorkflows(coupleId, 2, 'QuietFail');
    // A column that does not exist: PostgREST refuses the read for real.
    const failing = countingClient((q) =>
      q.table === 'workflow_templates' && q.method === 'select' ? { args: ['no_such_column'] } : undefined,
    );

    const result = await advanceDueSteps(failing.client, { userId: user.id });

    // Retried per step, not cached as "no quiet hours": each claimed
    // step is errored with the message the MC reads, nothing was sent.
    expect(result.failedReads).toBe(2);
    expect(result.errors).toBe(2);
    const { data } = await admin
      .from('workflow_steps')
      .select('status, error_message')
      .in('id', stepIds);
    expect(data).toEqual([
      { status: 'errored', error_message: CONTEXT_UNREADABLE },
      { status: 'errored', error_message: CONTEXT_UNREADABLE },
    ]);
  });

  it('re-reads an instance an earlier step in the same pass wrote to', async () => {
    const coupleId = await couple('Batch Dirty');
    const { instanceIds, stepIds } = await dueWorkflows(coupleId, 1, 'Dirty');
    const { data: second } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: instanceIds[0]!,
        position: 1,
        type: 'action',
        title: 'Add another note',
        config: { actionType: 'add_note', text: 'second' },
        status: 'pending',
        due_at: PAST,
      })
      .select('id')
      .single();

    // No chain: the outer loop runs both steps, from one batch read. The
    // second step's output merge starts from the instance's context; a
    // stale copy from the batch would overwrite the first step's output.
    await advanceDueSteps(admin, { userId: user.id, maxChainDepth: 0, readFreshMs: 600_000 });

    const { data: row } = await admin
      .from('workflow_instances')
      .select('context')
      .eq('id', instanceIds[0]!)
      .single();
    const outputs = ((row!.context ?? {}) as { step_outputs?: Record<string, unknown> }).step_outputs ?? {};
    expect(Object.keys(outputs).sort()).toEqual([stepIds[0]!, second!.id].sort());
  });

  it('sees a pause the MC pressed mid-pass once the batch has aged', async () => {
    const coupleId = await couple('Batch Pause');
    const { instanceIds, stepIds } = await dueWorkflows(coupleId, 2, 'Pause');
    // Due a minute later, so it runs second whatever the ids sort as.
    await admin
      .from('workflow_steps')
      .update({ due_at: '2025-01-01T00:01:00.000Z' })
      .eq('id', stepIds[1]!);
    let paused = false;
    const pausing = countingClient((q) => {
      // The first claim: the pass has read its batch and started running.
      // The MC pauses the second workflow before the claim lands. The
      // claim is the `workflow_claim_step` RPC since the Phase 6 fix wave
      // (it was a status update), so the hook keys on the RPC.
      if (paused || q.table !== 'rpc' || q.method !== 'workflow_claim_step') return;
      paused = true;
      return {
        before: admin
          .from('workflow_instances')
          .update({ status: 'paused', paused_reason: 'manual' })
          .eq('id', instanceIds[1]!)
          .then((r) => expect(r.error).toBeNull()),
      };
    });

    // A zero freshness window stands in for a step slower than the real
    // one: every read has aged by the time the next step asks.
    await advanceDueSteps(pausing.client, { userId: user.id, readFreshMs: 0 });

    expect(paused).toBe(true);
    const { data } = await admin
      .from('workflow_steps')
      .select('id, status')
      .in('id', stepIds);
    const byId = new Map((data ?? []).map((r) => [r.id, r.status]));
    expect(byId.get(stepIds[0]!)).toBe('done');
    expect(byId.get(stepIds[1]!)).toBe('pending');
  });
});
