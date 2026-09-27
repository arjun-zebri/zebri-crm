/**
 * The tick's heal pass: finish the bookkeeping a failed write left behind.
 *
 * A step's completion is one guarded write. What follows it (merging its
 * output into the instance, skipping the branch not taken, re-dating the
 * steps behind it, completing the instance) is separate statements. When
 * one of those fails after the completion landed, the executor alerts
 * `workflow_step_unsettled`, marks the instance (`needs_recompute_at`)
 * and carries on (`settleAfterCompletion` in `./executor`), and nothing
 * else would ever look at the instance again: an undated step is
 * invisible to the due read. This pass finds the marked instances and
 * redoes the bookkeeping, in the order the executor does it, so one
 * database blip costs a tick of latency rather than the rest of the
 * workflow (Task 36 fix round 1, review I1). On success it clears the
 * marker it read.
 *
 * Marked instances only (fix round 2, re-review N1). The pass used to
 * infer strands from the shape of the steps (an undated follower of a
 * finished step), and a step whose date the MC took off to hold it has
 * exactly that shape: the heal re-dated it within a minute and the
 * executor sent it. The marker is written by the failure itself, so a
 * held step is never touched, and a strand from before the marker
 * existed stays as it was rather than being sent late.
 *
 * The instances come from `workflow_stranded_instances` (migrations
 * 20261023400000 and 20261023500000), one small partial-index read on a
 * tick with nothing to heal. It is keyset paged, {@link HEAL_PAGE_SIZE}
 * at a time, at most {@link HEAL_MAX_PAGES} pages a tick, and it stops
 * starting instances at the deadline the tick gives it, so a large
 * backlog is healed over several ticks rather than eating the executor's
 * slice (re-review N4).
 *
 * Every step is idempotent, so healing an instance twice (two ticks
 * racing, or an instance that was only half stranded) changes nothing the
 * second time.
 *
 * @module lib/workflows/heal
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Json } from '@/types/database';
import type { WorkflowInstanceRow, WorkflowStepRow } from '@/types/workflows';

import { type BranchSide, skipBranchSide } from './branch-skip';
import { completeInstanceIfDone, recomputeInstance } from './executor';
import { describeFailure, isWorkflowReadError, throwIfReadFailed } from './read-failure';

/** Instances read per page. */
export const HEAL_PAGE_SIZE = 50;

/** Pages per tick: at most 200 instances healed a minute. */
export const HEAL_MAX_PAGES = 4;

/** What one heal pass did. */
export interface HealResult {
  /** Instances whose bookkeeping was redone. */
  healed: number;
  /** Instances the pass could not heal; the next tick tries again. */
  failed: number;
  /** The first failure's read site, for the tick's alert. */
  firstFailedSite: string | null;
  /** The deadline stopped the pass with instances still to look at. */
  truncated: boolean;
}

/**
 * Heal every marked instance, a bounded slice per call.
 *
 * @param supabase - service-role client (execute on the finder is
 *   revoked from every other role)
 * @param opts.deadline - epoch ms after which no further instance starts;
 *   the rest keep their marker for the next tick
 * @returns what was healed and what could not be
 * @throws WorkflowReadError when the finder itself fails: an empty answer
 *   there would read as "nothing stranded"
 */
export async function healStrandedInstances(
  supabase: SupabaseClient<Database>,
  opts: { deadline?: number } = {},
): Promise<HealResult> {
  const result: HealResult = { healed: 0, failed: 0, firstFailedSite: null, truncated: false };
  let after: string | null = null;
  const pastDeadline = () => opts.deadline !== undefined && Date.now() >= opts.deadline;

  for (let page = 0; page < HEAL_MAX_PAGES; page += 1) {
    if (pastDeadline()) {
      result.truncated = true;
      break;
    }
    const found = await supabase.rpc('workflow_stranded_instances', {
      p_limit: HEAL_PAGE_SIZE,
      ...(after ? { p_after: after } : {}),
    });
    throwIfReadFailed('heal.stranded_instances', found.error);
    const ids: string[] = (found.data ?? []).map((row) => row.instance_id);

    for (const id of ids) {
      if (pastDeadline()) {
        result.truncated = true;
        return result;
      }
      try {
        await healInstance(supabase, id);
        result.healed += 1;
      } catch (err) {
        // One instance that cannot be healed must not stop the rest. It
        // keeps its marker, pushed a few minutes ahead, so a heal that
        // fails every time is retried on a backoff rather than named
        // first on every tick, ahead of every instance behind it (N10).
        result.failed += 1;
        result.firstFailedSite ??= isWorkflowReadError(err) ? err.site : 'heal.unexpected';
        console.error('[workflows] could not heal instance', id, describeFailure(err));
        await deferMarker(supabase, id);
      }
    }

    if (ids.length < HEAL_PAGE_SIZE) break;
    after = ids[ids.length - 1] ?? null;
  }

  return result;
}

/**
 * Redo one instance's bookkeeping: merge any finished step's output the
 * instance context is missing, skip everything under each finished
 * branch's losing side (both sides of a skipped branch), re-date the
 * steps, complete the instance if nothing is left, then clear the marker.
 *
 * The branch skips come before the re-dating on purpose. Re-dating first
 * would date the losing side's head too (its branch step is finished),
 * and both sides would run.
 */
async function healInstance(supabase: SupabaseClient<Database>, instanceId: string): Promise<void> {
  const { data: instanceRow, error: instanceError } = await supabase
    .from('workflow_instances')
    .select('*')
    .eq('id', instanceId)
    .maybeSingle();
  throwIfReadFailed('heal.load_instance', instanceError);
  const instance = instanceRow as unknown as WorkflowInstanceRow | null;
  // Gone, or no longer active since the finder read it: nothing to heal
  // now. A paused instance keeps its marker for when it is active again.
  if (!instance || instance.status !== 'active') return;

  const { data: stepRows, error: stepsError } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('instance_id', instanceId);
  throwIfReadFailed('heal.load_steps', stepsError);
  const steps = (stepRows ?? []) as unknown as WorkflowStepRow[];
  const done = steps.filter((s) => s.status === 'done');

  await mergeMissingOutputs(supabase, instance, done);
  for (const branch of steps) {
    if (branch.type !== 'branch') continue;
    const side = sideToSkip(branch);
    if (!side) continue;
    await skipBranchSide(supabase, instance, branch.id, side, {
      site: 'heal.skip_losing_branch',
      reason: side === 'both' ? 'branch skipped' : 'branch not taken',
      via: 'heal',
    });
  }
  await recomputeInstance(supabase, instance);
  await completeInstanceIfDone(supabase, instance.id);
  await clearMarker(supabase, instance);
}

/**
 * Which side of a finished branch must be skipped: the lane its output
 * did not take, both lanes of a skipped branch, or nothing.
 */
function sideToSkip(branch: WorkflowStepRow): BranchSide | null {
  if (branch.status === 'skipped') return 'both';
  if (branch.status !== 'done') return null;
  const taken = (branch.output as { branch_taken?: unknown } | null)?.branch_taken;
  if (taken === 'yes') return 'no';
  if (taken === 'no') return 'yes';
  return null;
}

/**
 * Clear the marker this heal read, and only that one. Guarded on the
 * value: a failure that marked the instance again while the heal ran
 * wrote a newer stamp, which must survive for the next tick.
 */
async function clearMarker(
  supabase: SupabaseClient<Database>,
  instance: WorkflowInstanceRow,
): Promise<void> {
  if (!instance.needs_recompute_at) return;
  const { error } = await supabase
    .from('workflow_instances')
    .update({ needs_recompute_at: null })
    .eq('id', instance.id)
    .eq('needs_recompute_at', instance.needs_recompute_at);
  throwIfReadFailed('heal.clear_marker', error);
}

/**
 * How far a failed heal pushes the instance's marker ahead. The finder
 * names only markers that are due (`<= now()`, 20261024000000), so this
 * is the retry backoff for an instance whose heal keeps failing.
 */
export const HEAL_RETRY_BACKOFF_MS = 5 * 60 * 1000;

/**
 * Push a marker that could not be healed a few minutes ahead. Only a due
 * marker moves: a failure the executor stamped after the heal's read is
 * newer and already due, and deferring it too is harmless (the same
 * instance, retried shortly). Never throws: this runs inside a failure,
 * and a marker left due is only retried on the next tick, as before.
 */
async function deferMarker(supabase: SupabaseClient<Database>, instanceId: string): Promise<void> {
  try {
    const now = new Date();
    const { error } = await supabase
      .from('workflow_instances')
      .update({ needs_recompute_at: new Date(now.getTime() + HEAL_RETRY_BACKOFF_MS).toISOString() })
      .eq('id', instanceId)
      .lte('needs_recompute_at', now.toISOString());
    if (error) console.error('[workflows] could not defer a heal marker', instanceId, error.message);
  } catch (err) {
    console.error('[workflows] could not defer a heal marker', instanceId, describeFailure(err));
  }
}

/**
 * Put back any finished step's output the instance context is missing
 * (the merge that failed). A follower reads it: `update_task` finds the
 * to-do `create_task` made through it.
 *
 * In SQL (`workflow_merge_step_outputs` with `p_keep_existing`,
 * 20261023900000), and only for keys still missing when the statement
 * runs. It used to write the whole `context` back from the row this heal
 * read, so a kick pass merging another step's output in between was
 * erased, and with the marker then cleared nothing would ever put it back
 * (Phase 6 review M3).
 */
async function mergeMissingOutputs(
  supabase: SupabaseClient<Database>,
  instance: WorkflowInstanceRow,
  done: WorkflowStepRow[],
): Promise<void> {
  const context = (instance.context ?? {}) as Record<string, unknown>;
  const outputs = (context['step_outputs'] ?? {}) as Record<string, unknown>;
  const missing = done.filter((s) => s.output !== null && !(s.id in outputs));
  if (missing.length === 0) return;
  const add: Record<string, Json> = {};
  for (const step of missing) add[step.id] = step.output as Json;
  const { error } = await supabase.rpc('workflow_merge_step_outputs', {
    p_instance_id: instance.id,
    p_outputs: add as Json,
    p_keep_existing: true,
  });
  throwIfReadFailed('heal.merge_outputs', error);
}
