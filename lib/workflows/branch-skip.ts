/**
 * Skip a branch side, and everything under it, at any depth.
 *
 * A branch's lanes are anchored to the branch step, and a branch nested
 * on a lane is anchored the same way. Skipping only the direct children
 * of a losing side left a nested branch there `skipped` with its own two
 * lanes still pending, and both of them were then dated and ran: the
 * wrong emails went out (Task 36 fix round 2, re-review N3). So every
 * skip of a branch side goes through here, and follows
 * {@link descendantsOf}, the walk the apply-time and resume skips
 * already use.
 *
 * Three callers: the executor when a branch picks a lane, the tick's
 * heal pass redoing that after a failed write, and "Skip this step" on a
 * branch step, which takes both lanes because a skipped branch chose
 * neither.
 *
 * @module lib/workflows/branch-skip
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Json } from '@/types/database';
import type { WorkflowInstanceRow, WorkflowStepRow } from '@/types/workflows';

import { descendantsOf } from './apply-skips';
import { writeAudit } from './audit';
import { throwIfReadFailed } from './read-failure';

/** Which of a branch's sides to skip: one lane, or both. */
export type BranchSide = 'yes' | 'no' | 'both';

/**
 * The unfinished steps a skip of `side` under `branchId` must take:
 * pending or waiting, on that side, at any depth.
 *
 * @param steps - every step in the instance
 * @param branchId - the branch whose side is skipped
 * @param side - one lane, or both
 */
export function stepsUnderSide(
  steps: WorkflowStepRow[],
  branchId: string,
  side: BranchSide,
): WorkflowStepRow[] {
  if (side === 'both') return descendantsOf(steps, branchId);
  const out: WorkflowStepRow[] = [];
  for (const child of steps) {
    if (child.parent_step_id !== branchId || child.branch_path !== side) continue;
    if (child.status === 'pending' || child.status === 'waiting') out.push(child);
    out.push(...descendantsOf(steps, child.id));
  }
  return out;
}

/**
 * Mark every unfinished step on a branch side skipped, with the branch
 * as the reason (`skip_reason`), and write one audit row when anything
 * was.
 *
 * Skipped rather than deleted: the MC can see which way the workflow went
 * and why. The write matches only steps still pending or waiting, so a
 * repeat (the heal redoing a skip that did land) writes nothing and no
 * second audit row.
 *
 * @param supabase - service-role client
 * @param instance - the branch's instance
 * @param branchId - the branch step
 * @param side - the side not taken, or both for a skipped branch
 * @param opts.site - the read-failure site for this caller
 * @param opts.reason - the audit row's reason, shown on the timeline
 * @param opts.via - who redid it, when it is not the first attempt
 * @param opts.audit - write the timeline row (default true). The MC's own
 *   "Skip this step" on a branch passes false: its `step_skipped` row for
 *   the branch is already the line, and a second one for the same step
 *   read as two skips (Task 36 re-review 2, N9).
 * @returns how many steps were skipped
 * @throws WorkflowReadError when the step read or the write fails: a side
 *   left pending runs alongside the other
 */
export async function skipBranchSide(
  supabase: SupabaseClient<Database>,
  instance: WorkflowInstanceRow,
  branchId: string,
  side: BranchSide,
  opts: { site: string; reason: string; via?: string; audit?: boolean },
): Promise<number> {
  const { data: rows, error: readError } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('instance_id', instance.id);
  throwIfReadFailed(`${opts.site}.read`, readError);
  const targets = stepsUnderSide((rows ?? []) as unknown as WorkflowStepRow[], branchId, side);
  if (targets.length === 0) return 0;

  const { data, error } = await supabase
    .from('workflow_steps')
    // `skip_reason: 'branch'` is what lets a reopened branch bring these
    // back, and only these (Phase 6 residual F3).
    .update({ status: 'skipped', completed_at: new Date().toISOString(), skip_reason: 'branch' })
    .in(
      'id',
      targets.map((s) => s.id),
    )
    .in('status', ['pending', 'waiting'])
    .select('id');
  throwIfReadFailed(opts.site, error);
  const skipped = data?.length ?? 0;
  if (skipped === 0 || opts.audit === false) return skipped;

  const detail: Record<string, Json> = { reason: opts.reason, path: side };
  if (opts.via) detail['via'] = opts.via;
  await writeAudit(supabase, {
    userId: instance.user_id,
    instanceId: instance.id,
    stepId: branchId,
    coupleId: instance.couple_id,
    event: 'step_skipped',
    detail,
  });
  return skipped;
}
