/**
 * The tick's per-pass reads of instances and quiet hours (Task 38).
 *
 * Every due step used to read its own instance before it ran and its
 * own template's quiet hours inside the run: two queries per step, and
 * the first thing that bends as accounts grow. A pass now reads both in
 * batches of up to a hundred ids, ahead of the steps that need them.
 *
 * Four rules keep the batch from changing what the tick does:
 *
 * - **A failed batch is a failed read, never a missing row.** A read
 *   that errors throws the same `WorkflowReadError`, with the same site
 *   and message, the per-step read threw, and caches nothing. The step
 *   that asked counts it exactly as before, and the next step to ask
 *   tries again, so an outage costs each step its own failed read, as
 *   it always did.
 * - **What the pass itself wrote is re-read.** The executor calls
 *   {@link PassReads.invalidate} on every instance it ran a step on: the
 *   step merged its output into the instance's context, and a later
 *   step handed the old row would both miss that output and overwrite
 *   it.
 * - **No row is used once it is older than {@link PASS_READ_FRESH_MS}.**
 *   The MC can pause a workflow, turn a template off, or edit its quiet
 *   hours while a pass runs. This is NOT the window the per-step read
 *   had. That read came one step's own queries before its send (tens of
 *   milliseconds, a few hundred at most); a batched row can be up to a
 *   second older on top. What that costs (review of Task 38): a pause
 *   can let at most one more step per instance run, in a window about a
 *   second wider than before; turning a template off can let about a
 *   second of the pass's steps run across that template's instances. That
 *   cost is now closed at the claim: `workflow_claim_step` (and the
 *   wait's finish and hold) require the instance to be active in the same
 *   statement (Phase 6 wave, migration 20261023800000), so a step whose
 *   batched row is stale but whose instance was paused or switched off is
 *   refused as a lost claim. The batched row still decides what the pass
 *   tries; the claim decides what runs. A stop, an exit rule, a template
 *   delete and the account-wide stop cancel the steps, so the claim
 *   matches nothing, and the send gate re-reads the account stop.
 * - **A batch is only as big as the pass can use before it ages** (review
 *   I1). A full hundred rows for steps that each take a second would be
 *   read, used once, and thrown away: fewer queries, a hundred times the
 *   rows. So each batch is sized from how many rows the pass used since
 *   the previous read, over how long that took: at that rate, how many
 *   will it use in the next {@link PASS_READ_FRESH_MS}? The first read of
 *   a pass has nothing to measure and asks for one row, the per-step
 *   cost. Fast steps grow the batch to a hundred; slow ones settle at
 *   the one or two rows a second they use, which is never more reads or
 *   rows than one per step.
 *
 * @module lib/workflows/pass-reads
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';
import type { WorkflowInstanceRow } from '@/types/workflows';

import { CONTEXT_UNREADABLE, throwIfReadFailed } from './read-failure';

/**
 * Ids per `in(...)` read, at most. Every id rides in the request URL: a
 * hundred uuids keep it near 4KB, inside the gateway limit. An unbounded
 * list once overflowed it and halted every tenant (the Phase 3 stop-list
 * bug), so no batch here is ever larger, however large the pass.
 */
export const PASS_READ_CHUNK = 100;

/**
 * How long a batched row may be used before it is read again, in ms.
 * A pause or Turn off made mid-pass is caught at the claim, which
 * requires the instance to be active, so this bounds wasted attempts
 * (a step tried and refused), not steps that run. Raising it trades
 * fewer reads for more of those refused attempts.
 */
export const PASS_READ_FRESH_MS = 1_000;

/** A template's quiet-hours override, or null when it has none. */
export type QuietHours = { start: string | null; end: string | null } | null;

/** The pass's batched reads. See the module comment for the rules. */
export interface PassReads {
  /**
   * The pass is now running the step at this index of `upcoming`. Batches
   * look ahead from here, so they never spend slots on instances whose
   * steps the pass has already run (review M4).
   */
  startStep(index: number): void;
  /**
   * One instance, or null when it does not exist.
   *
   * @throws WorkflowReadError (`executor.load_instance`) when the read
   *   fails, never null
   */
  instance(id: string): Promise<WorkflowInstanceRow | null>;
  /**
   * A template's quiet hours, or null (no template, no such template,
   * or no override).
   *
   * @throws WorkflowReadError (`executor.load_quiet_hours`, carrying
   *   {@link CONTEXT_UNREADABLE}) when the read fails, never null:
   *   "no override" would send inside the MC's quiet window
   */
  quietHours(templateId: string | null): Promise<QuietHours>;
  /** The pass wrote to this instance: read it again before next use. */
  invalidate(instanceId: string): void;
}

/** A cached row and when the read that produced it started. */
interface Entry<T> {
  value: T;
  readAt: number;
}

/**
 * Sizes one table's batches from how fast the pass used the rows it
 * already read. See the module comment's last rule.
 */
function batchSizer(freshMs: number, clock: () => number) {
  let lastReadAt: number | null = null;
  let used = 0;
  return {
    /** A row was served from the cache. */
    hit() {
      used += 1;
    },
    /** How many ids the read about to happen should ask for. */
    size(): number {
      if (lastReadAt === null) return 1;
      const elapsed = clock() - lastReadAt;
      if (elapsed <= 0) return PASS_READ_CHUNK;
      // Rounded down: a row that would age a moment before its step asks
      // is a row read for nothing.
      const fits = Math.floor((used * freshMs) / elapsed);
      return Math.min(PASS_READ_CHUNK, Math.max(1, fits));
    },
    /** A read landed at `at`, and served the row that asked for it. */
    read(at: number) {
      lastReadAt = at;
      used = 1;
    },
  };
}

/**
 * Build the reads for one pass.
 *
 * @param supabase - service-role client
 * @param upcoming - the instance id of each step the pass will run, in
 *   run order, duplicates included. {@link PassReads.startStep} indexes
 *   into it.
 * @param opts.freshMs - override {@link PASS_READ_FRESH_MS}
 * @param opts.clock - epoch ms, for tests
 */
export function createPassReads(
  supabase: SupabaseClient<Database>,
  upcoming: readonly string[],
  opts: { freshMs?: number | undefined; clock?: (() => number) | undefined } = {},
): PassReads {
  const freshMs = opts.freshMs ?? PASS_READ_FRESH_MS;
  const clock = opts.clock ?? Date.now;
  const instances = new Map<string, Entry<WorkflowInstanceRow | null>>();
  const templates = new Map<string, Entry<QuietHours>>();
  const instanceSizer = batchSizer(freshMs, clock);
  const templateSizer = batchSizer(freshMs, clock);
  // The step being run. Before the first startStep, everything is ahead.
  let cursor = -1;

  const usable = <T>(entry: Entry<T> | undefined): entry is Entry<T> =>
    entry !== undefined && clock() - entry.readAt < freshMs;

  /**
   * `first`, then up to `size - 1` more ids that `pick` yields from the
   * steps after the cursor, skipping duplicates and anything `needsRead`
   * refuses.
   */
  function lookAhead(
    first: string,
    size: number,
    pick: (instanceId: string) => string | null,
    needsRead: (id: string) => boolean,
  ): string[] {
    const batch = [first];
    for (let i = cursor + 1; i < upcoming.length && batch.length < size; i += 1) {
      const id = pick(upcoming[i]!);
      if (id && !batch.includes(id) && needsRead(id)) batch.push(id);
    }
    return batch;
  }

  return {
    startStep(index) {
      cursor = index;
    },

    async instance(id) {
      const cached = instances.get(id);
      if (usable(cached)) {
        instanceSizer.hit();
        return cached.value;
      }
      const batch = lookAhead(
        id,
        instanceSizer.size(),
        (instanceId) => instanceId,
        (other) => !usable(instances.get(other)),
      );
      // Stamped before the read: the row is as old as the moment it was
      // asked for, not the moment it arrived.
      const readAt = clock();
      const { data, error } = await supabase.from('workflow_instances').select('*').in('id', batch);
      // Nothing is cached, and nothing measured, on a failure, so no step
      // reads it as "gone".
      throwIfReadFailed('executor.load_instance', error);
      instanceSizer.read(readAt);
      const found = new Map(
        ((data ?? []) as unknown as WorkflowInstanceRow[]).map((row) => [row.id, row]),
      );
      // An id the read did not return is a workflow that no longer
      // exists, which the per-step read reported as null too.
      for (const batchId of batch) instances.set(batchId, { value: found.get(batchId) ?? null, readAt });
      return instances.get(id)!.value;
    },

    async quietHours(templateId) {
      if (!templateId) return null;
      const cached = templates.get(templateId);
      if (usable(cached)) {
        templateSizer.hit();
        return cached.value;
      }
      // The templates of the steps still to run whose instances the pass
      // has read. The rest join a later batch.
      const batch = lookAhead(
        templateId,
        templateSizer.size(),
        (instanceId) => instances.get(instanceId)?.value?.template_id ?? null,
        (tpl) => !usable(templates.get(tpl)),
      );
      const readAt = clock();
      const { data, error } = await supabase
        .from('workflow_templates')
        .select('id, quiet_hours_start, quiet_hours_end')
        .in('id', batch);
      throwIfReadFailed('executor.load_quiet_hours', error, CONTEXT_UNREADABLE);
      templateSizer.read(readAt);
      const found = new Map((data ?? []).map((row) => [row.id, row]));
      for (const tpl of batch) {
        const row = found.get(tpl);
        templates.set(tpl, {
          value: row ? { start: row.quiet_hours_start, end: row.quiet_hours_end } : null,
          readAt,
        });
      }
      return templates.get(templateId)!.value;
    },

    invalidate(instanceId) {
      instances.delete(instanceId);
    },
  };
}

/**
 * Many instances by id, a chunk at a time, for work that needs every
 * row fresh at once (the pass's closing check for finished workflows).
 *
 * Each chunk is its own read: `onChunk` gets the rows (a missing id maps
 * to null, exactly as a single read returned null) or the chunk's
 * failure, so one failed chunk costs only its own ids.
 *
 * @param supabase - service-role client
 * @param ids - instance ids, any length
 * @param onChunk - called once per chunk, in order
 */
export async function readInstancesInChunks(
  supabase: SupabaseClient<Database>,
  ids: readonly string[],
  onChunk: (
    chunk: readonly string[],
    result: { rows: Map<string, WorkflowInstanceRow | null> } | { error: unknown },
  ) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < ids.length; i += PASS_READ_CHUNK) {
    const chunk = ids.slice(i, i + PASS_READ_CHUNK);
    let rows: Map<string, WorkflowInstanceRow | null>;
    try {
      const { data, error } = await supabase.from('workflow_instances').select('*').in('id', chunk);
      throwIfReadFailed('executor.load_instance', error);
      const found = new Map(
        ((data ?? []) as unknown as WorkflowInstanceRow[]).map((row) => [row.id, row]),
      );
      rows = new Map(chunk.map((id) => [id, found.get(id) ?? null]));
    } catch (error) {
      await onChunk(chunk, { error });
      continue;
    }
    await onChunk(chunk, { rows });
  }
}
