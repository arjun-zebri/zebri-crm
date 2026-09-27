/**
 * The tick's per-pass reads (Task 38): batched, chunked, never a failed
 * read mistaken for a missing row, and never trusted past a moment.
 *
 * @module tests/unit/lib/workflows/pass-reads.test
 */
import { describe, expect, it } from 'vitest';

import { createPassReads, PASS_READ_CHUNK, readInstancesInChunks } from '@/lib/workflows/pass-reads';
import { CONTEXT_UNREADABLE, isWorkflowReadError } from '@/lib/workflows/read-failure';

import { type Call, called, failed, fakeSupabase, type Reply } from './fake-supabase';

/** The ids an `in(...)` call asked for. */
function inIds(calls: Call[]): string[] {
  return (calls.find((c) => c.method === 'in')?.args[1] ?? []) as string[];
}

/** Every asked-for instance exists, on template `tpl-<id>`, except `gone-*`. */
function rows(table: string, calls: Call[]): Reply {
  const ids = inIds(calls).filter((id) => !id.startsWith('gone'));
  if (table === 'workflow_instances') {
    return { data: ids.map((id) => ({ id, status: 'active', template_id: `tpl-${id}` })) };
  }
  return { data: ids.map((id) => ({ id, quiet_hours_start: '21:00', quiet_hours_end: '08:00' })) };
}

const ids = (n: number, prefix = 'i') => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

describe('createPassReads', () => {
  it('reads 250 instances in chunks of at most 100, in run order, starting from one row', async () => {
    const { client, log } = fakeSupabase(rows);
    const order = ids(250);
    const reads = createPassReads(client, order, { freshMs: 60_000, clock: () => 0 });

    for (const [i, id] of order.entries()) {
      reads.startStep(i);
      expect((await reads.instance(id))?.id).toBe(id);
    }

    // Nothing is measured before the first read, so it costs what the
    // per-step read cost. Every later read is sized from the rate the
    // rows were used, here instantly, so it is a full chunk.
    expect(log.map((q) => inIds(q.calls).length)).toEqual([1, 100, 100, 49]);
    expect(log.every((q) => called(q.calls, 'select'))).toBe(true);
    expect(inIds(log[1]!.calls)[0]).toBe('i1');
  });

  it('reads a missing instance as null, the way the single read did', async () => {
    const { client } = fakeSupabase(rows);
    const reads = createPassReads(client, ['i0', 'gone-1'], { freshMs: 60_000 });
    expect(await reads.instance('gone-1')).toBeNull();
  });

  it('throws on a failed batch and caches nothing, so the next step asks again', async () => {
    let fail = true;
    const { client, log } = fakeSupabase((table, calls) => (fail ? failed() : rows(table, calls)));
    const reads = createPassReads(client, ['i0', 'i1'], { freshMs: 60_000 });

    await expect(reads.instance('i0')).rejects.toSatisfy(
      (e: unknown) => isWorkflowReadError(e) && e.site === 'executor.load_instance',
    );
    fail = false;
    expect((await reads.instance('i1'))?.id).toBe('i1');
    expect(log).toHaveLength(2);
  });

  it('re-reads an invalidated instance, and one older than the freshness window', async () => {
    let now = 0;
    const { client, log } = fakeSupabase(rows);
    const reads = createPassReads(client, ['i0', 'i1'], { freshMs: 1_000, clock: () => now });

    reads.startStep(0);
    await reads.instance('i0');
    await reads.instance('i1');
    // The first read is one row; the second is sized from use.
    expect(log.map((q) => inIds(q.calls))).toEqual([['i0'], ['i1']]);
    await reads.instance('i1');
    expect(log).toHaveLength(2);

    reads.invalidate('i0');
    await reads.instance('i0');
    expect(log).toHaveLength(3);
    expect(inIds(log[2]!.calls)).toEqual(['i0']);

    now = 1_000;
    await reads.instance('i1');
    expect(log).toHaveLength(4);
  });

  it('batches the quiet hours of the instances it has read, and returns null with no template', async () => {
    const { client, log } = fakeSupabase(rows);
    const order = ids(3);
    const reads = createPassReads(client, order, { freshMs: 60_000, clock: () => 0 });
    for (const id of order) await reads.instance(id);

    expect(await reads.quietHours(null)).toBeNull();
    // The first read of the pass is one row; the next is sized from use.
    expect(await reads.quietHours('tpl-i0')).toEqual({ start: '21:00', end: '08:00' });
    expect(await reads.quietHours('tpl-i1')).toEqual({ start: '21:00', end: '08:00' });
    expect(await reads.quietHours('tpl-i2')).toEqual({ start: '21:00', end: '08:00' });
    expect(await reads.quietHours('gone-tpl')).toBeNull();

    const templateReads = log.filter((q) => q.table === 'workflow_templates');
    expect(templateReads.map((q) => inIds(q.calls))).toEqual([
      ['tpl-i0'],
      ['tpl-i1', 'tpl-i2'],
      ['gone-tpl'],
    ]);
  });

  it('throws the context-unreadable error on a failed quiet-hours batch, never "no override"', async () => {
    const { client } = fakeSupabase((table, calls) =>
      table === 'workflow_templates' ? failed() : rows(table, calls),
    );
    const reads = createPassReads(client, ['i0'], { freshMs: 60_000 });
    await expect(reads.quietHours('tpl-i0')).rejects.toSatisfy(
      (e: unknown) =>
        isWorkflowReadError(e) && e.site === 'executor.load_quiet_hours' && e.message === CONTEXT_UNREADABLE,
    );
  });

  it('caps a quiet-hours batch at the chunk size', async () => {
    const { client, log } = fakeSupabase(rows);
    const order = ids(PASS_READ_CHUNK + 20);
    const reads = createPassReads(client, order, { freshMs: 60_000, clock: () => 0 });
    for (const id of order) await reads.instance(id);
    await reads.quietHours('tpl-i0');
    await reads.quietHours('tpl-i1');
    const templateReads = log.filter((q) => q.table === 'workflow_templates');
    expect(inIds(templateReads[1]!.calls)).toHaveLength(PASS_READ_CHUNK);
  });
});

describe('batch size at the default freshness (review I1)', () => {
  /**
   * Run `n` steps the way the executor does (the instance, then its
   * template's quiet hours, then the step writes to it), `gapMs` apart
   * on a fake clock, at the default freshness window. Returns the reads
   * and the rows they transferred, per table.
   */
  async function pass(n: number, gapMs: number) {
    let now = 0;
    const { client, log } = fakeSupabase(rows);
    const order = ids(n);
    const reads = createPassReads(client, order, { clock: () => now });
    for (const [i, id] of order.entries()) {
      if (i > 0) now += gapMs;
      reads.startStep(i);
      const instance = await reads.instance(id);
      await reads.quietHours(instance!.template_id);
      reads.invalidate(id);
    }
    const tally = (table: string) => {
      const qs = log.filter((q) => q.table === table);
      return { reads: qs.length, rows: qs.reduce((sum, q) => sum + inIds(q.calls).length, 0) };
    };
    return { instances: tally('workflow_instances'), templates: tally('workflow_templates') };
  }

  // The per-step baseline: one read of one row per step, for each table.
  const N = 40;

  it.each([500, 1_500])('never reads more, or more rows, than one per step for %ims sends', async (gap) => {
    const { instances, templates } = await pass(N, gap);
    for (const t of [instances, templates]) {
      expect(t.reads).toBeLessThanOrEqual(N);
      expect(t.rows).toBeLessThanOrEqual(N);
    }
  });

  it('halves the reads for 500ms sends, with no row read twice', async () => {
    const { instances } = await pass(N, 500);
    expect(instances.reads).toBeLessThanOrEqual(N / 2 + 1);
    expect(instances.rows).toBe(N);
  });

  it('reads a handful of times for fast steps, each row once', async () => {
    const { instances, templates } = await pass(N, 5);
    for (const t of [instances, templates]) {
      expect(t.reads).toBeLessThanOrEqual(3);
      expect(t.rows).toBe(N);
    }
  });
});

describe('look-ahead (review M4)', () => {
  it('batches from the step being run, never ids the pass has already finished', async () => {
    const { client, log } = fakeSupabase(rows);
    // x runs at position 0 and again at 6; a0..a4 run in between.
    const order = ['x', 'a0', 'a1', 'a2', 'a3', 'a4', 'x', 'b0', 'b1'];
    const reads = createPassReads(client, order, { freshMs: 60_000, clock: () => 0 });
    for (const [i, id] of order.entries()) {
      reads.startStep(i);
      // Something wrote to x again (a chain, say), so position 6 re-reads it.
      if (i === 6) reads.invalidate('x');
      await reads.instance(id);
      reads.invalidate(id);
    }
    // a0..a4 have run and are stale, but nothing after position 6 needs
    // them; b0 and b1 are still fresh from the batch at position 1.
    const last = log[log.length - 1]!;
    expect(inIds(last.calls)).toEqual(['x']);
  });
});

describe('readInstancesInChunks', () => {
  it('hands each chunk its rows or its own failure', async () => {
    let n = 0;
    const { client } = fakeSupabase((table, calls) => (n++ === 1 ? failed() : rows(table, calls)));
    const seen: Array<{ size: number; failed: boolean; missing: number }> = [];

    await readInstancesInChunks(client, [...ids(150), 'gone-1'], async (chunk, result) => {
      seen.push({
        size: chunk.length,
        failed: 'error' in result,
        missing: 'rows' in result ? [...result.rows.values()].filter((r) => r === null).length : 0,
      });
    });

    expect(seen).toEqual([
      { size: 100, failed: false, missing: 0 },
      { size: 51, failed: true, missing: 0 },
    ]);
  });
});
