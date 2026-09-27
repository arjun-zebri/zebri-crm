/**
 * Which steps a fresh apply skips because their date is already gone.
 *
 * The one statement of the Task 19 rule, pure (no database, no React),
 * so the two places that need it cannot drift apart:
 *
 * - `settlePastOnApply` (`./resume`) plans with it, then writes the
 *   skips to the new instance before it goes live;
 * - the Start preview (`./apply-projection`) plans with it to flag the
 *   rows as "will be skipped" before the MC commits.
 *
 * The rule, judged at the apply moment:
 *
 * - An automated `action` whose own timing is wedding-relative and whose
 *   due date is before the apply is skipped. A step timed from the apply
 *   or from its predecessor is due "now" at the earliest, which is the
 *   "send the welcome email immediately" case, so it never is.
 * - A `wait` that has not started and whose own date (`relative_to_event`
 *   or `until_date`, via the executor's `computeWaitWakeAt`) is before
 *   the apply is skipped too, whatever its timing: left alone, the tick
 *   would finish it at once and release the send behind it early.
 * - Only what the executor would run now is judged (`isExecutable`), so
 *   a to-do, a step held for approval, and anything still gated are
 *   never skipped.
 * - A `branch` whose own timing is wedding-relative and whose date is
 *   before the apply is skipped, and so is every step under it, on both
 *   lanes and at any depth, whatever their own dates. A skipped branch
 *   releases both of its lanes (`recomputeDueDates` anchors a lane's head
 *   to the branch's completion, skipped or not), so leaving the subtree
 *   would run both sides of a decision that was never made.
 * - The cascade: whatever a skip releases on the spot (an undated
 *   follower, dated by the skip itself to "now") is judged again, so a
 *   zero-delay send straight after a skipped one is skipped with it.
 *   "Released by the skip" is judged by the skip alone, the step directly
 *   above, not by the transitive release rule (`./timing`, owner ruling
 *   2026-09-27): an earlier step still open at the apply (a send timed
 *   "on apply") would otherwise hold the stale follower undated, and it
 *   would send once that step ran. Skipping sends nothing, so judging it
 *   this way keeps both rules. A follower with a real delay is not
 *   skipped and falls under the transitive rule like any other step: it
 *   waits for the earlier open step, then is dated from the later of the
 *   two.
 *   A released branch goes the same way as a released send, with its
 *   subtree: it inherited the skipped step's moment, and the lane it
 *   picked would send at that moment.
 *
 * @module lib/workflows/apply-skips
 */

import { computeWaitWakeAt, waitConfigSchema } from '@/lib/automations/conditions';
import type { WaitActionConfig } from '@/types/automations';
import type { WorkflowStepRow } from '@/types/workflows';

import { isExecutable } from './executable';
import { computeDueAt, isHeld, recomputeDueDates, RELEASES_NEXT, type InstanceAnchors } from './timing';
import { toStepTiming } from './timing-summary';

/** What {@link planApplySkips} decided. */
export interface ApplySkipPlan {
  /** The steps to skip, in the order the rule reached them. */
  skippedIds: string[];
  /**
   * The subset of {@link skippedIds} skipped only because a branch above
   * them was: the audit line says so rather than blaming their own date.
   */
  withBranchIds: string[];
  /**
   * Every step as it stands once the skips land: skipped ones marked so,
   * with `completed_at` at the apply moment, and what they released
   * dated from it. The preview reads its dates from here.
   */
  steps: WorkflowStepRow[];
}

/**
 * Is this a wedding-anchored step whose date fell before the apply?
 *
 * @param step - a dated step
 * @param appliedAt - the apply moment
 */
export function isPastWeddingAnchored(step: WorkflowStepRow, appliedAt: Date): boolean {
  return (
    step.timing.mode === 'wedding_relative' &&
    step.due_at !== null &&
    new Date(step.due_at).getTime() < appliedAt.getTime()
  );
}

/**
 * Is this a wait that has not started and whose own date was already
 * gone at `appliedAt`? Only the two date modes can be; a config that
 * does not parse is left for the executor to report.
 *
 * @param step - any step
 * @param weddingDate - the couple's wedding date, `YYYY-MM-DD`, or null
 * @param appliedAt - the apply moment
 */
export function isPastWait(
  step: WorkflowStepRow,
  weddingDate: string | null,
  appliedAt: Date,
): boolean {
  if (step.type !== 'wait' || step.status !== 'pending') return false;
  const parsed = waitConfigSchema.safeParse(step.config ?? {});
  if (!parsed.success) return false;
  const config = parsed.data as WaitActionConfig;
  if (config.mode !== 'relative_to_event' && config.mode !== 'until_date') return false;
  // With no date to wait for, computeWaitWakeAt answers `appliedAt`
  // itself, which is not before it: an undated wait is never skipped.
  const wake = computeWaitWakeAt(config, { couple: { eventDate: weddingDate } }, appliedAt);
  return wake.getTime() < appliedAt.getTime();
}

/**
 * The first-pass decision: of the steps the executor would run now,
 * does the apply skip this one? A branch that answers true takes its
 * subtree with it ({@link descendantsOf}).
 */
export function isSkippedOnApply(
  step: WorkflowStepRow,
  weddingDate: string | null,
  appliedAt: Date,
): boolean {
  return (
    isPastWait(step, weddingDate, appliedAt) ||
    ((step.type === 'action' || step.type === 'branch') &&
      isPastWeddingAnchored(step, appliedAt))
  );
}

/**
 * The cascade decision: a step a skip just released, due now, is skipped
 * if it would send (an action), would pick a lane that sends (a branch),
 * or is itself a past wait. Its own timing does not matter here: it
 * inherited "now" from the skip.
 */
export function isSkippedOnRelease(
  step: WorkflowStepRow,
  weddingDate: string | null,
  appliedAt: Date,
): boolean {
  return (
    step.type === 'action' || step.type === 'branch' || isPastWait(step, weddingDate, appliedAt)
  );
}

/**
 * Every step under a branch, on both lanes and at any depth, that has not
 * finished: what a skip of that branch must take with it. Nested branches
 * are followed, because their lanes anchor to them the same way.
 *
 * @param steps - every step in the instance
 * @param branchId - the branch being skipped
 */
export function descendantsOf(steps: WorkflowStepRow[], branchId: string): WorkflowStepRow[] {
  const out: WorkflowStepRow[] = [];
  const queue = [branchId];
  while (queue.length > 0) {
    const parent = queue.shift()!;
    for (const child of steps) {
      if (child.parent_step_id !== parent) continue;
      queue.push(child.id);
      if (child.status === 'pending' || child.status === 'waiting') out.push(child);
    }
  }
  return out;
}

/**
 * Plan every skip a fresh apply makes, without writing anything.
 *
 * @param steps - the new instance's steps, dated as `applyTemplate`
 *   dates them (every step `pending`)
 * @param anchors - the couple's wedding date, the apply moment and the
 *   MC's timezone
 * @param now - the moment the executor would next look; the apply moment
 *   or a hair after it
 * @returns the skips and the steps as they will stand after them
 */
export function planApplySkips(
  steps: WorkflowStepRow[],
  anchors: InstanceAnchors,
  now: Date,
): ApplySkipPlan {
  const appliedAt = new Date(anchors.appliedAt);
  const rows = steps.map((s) => ({ ...s }));
  const skippedIds: string[] = [];
  const withBranchIds: string[] = [];
  const mark = (row: WorkflowStepRow) => {
    row.status = 'skipped';
    row.completed_at = now.toISOString();
    skippedIds.push(row.id);
  };
  // A branch goes with its whole subtree. The subtree is marked after the
  // branch, so a row already skipped on its own account is not listed
  // twice (its status is no longer open).
  const skip = (row: WorkflowStepRow) => {
    mark(row);
    if (row.type !== 'branch') return;
    for (const child of descendantsOf(rows, row.id)) {
      mark(child);
      withBranchIds.push(child.id);
    }
  };

  for (const row of rows) {
    if (row.status !== 'pending') continue;
    if (isExecutable(row, now) && isSkippedOnApply(row, anchors.weddingDate, appliedAt)) {
      skip(row);
    }
  }

  // Release what those gated, then skip anything the release made due
  // on the spot. Only steps with no date before this recompute are
  // candidates: a step that already had a date is on its own schedule.
  // Bounded by the step count because each pass skips something new or
  // stops.
  let changed = skippedIds.length > 0;
  for (let pass = 0; changed && pass < rows.length; pass += 1) {
    const undated = new Set(rows.filter((r) => r.due_at === null).map((r) => r.id));
    const skipDates = releasedBySkip(rows, anchors);
    const released = rows.filter(
      (r) =>
        undated.has(r.id) &&
        isSkippedOnRelease(r, anchors.weddingDate, appliedAt) &&
        isExecutable({ ...r, due_at: skipDates.get(r.id) ?? null }, now),
    );
    changed = released.length > 0;
    // Re-checked per row: skipping a released branch may already have
    // taken a later row in this list with it.
    for (const row of released) if (row.status === 'pending') skip(row);
  }
  if (skippedIds.length > 0) redate(rows, anchors);

  return { skippedIds, withBranchIds, steps: rows };
}

/**
 * The date each undated chained step would take from the step directly
 * above it alone: what a skip releases on the spot. Only the cascade
 * reads it (see the module docs); the rows are dated by the real,
 * transitive {@link recomputeDueDates}.
 */
function releasedBySkip(rows: WorkflowStepRow[], anchors: InstanceAnchors): Map<string, string | null> {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out = new Map<string, string | null>();
  for (const step of rows) {
    // A held step is never released by anything; no fresh apply has one,
    // but the rule should not depend on that.
    if (step.status !== 'pending' || step.due_at !== null || isHeld(step)) continue;
    const timing = toStepTiming(step.timing);
    if (timing.mode !== 'after_previous') continue;
    const lane = rows
      .filter((r) => r.parent_step_id === step.parent_step_id && r.branch_path === step.branch_path)
      .sort((a, b) => a.position - b.position);
    const above = lane[lane.findIndex((r) => r.id === step.id) - 1];
    const branch = step.parent_step_id ? byId.get(step.parent_step_id) : undefined;
    const anchor = above
      ? RELEASES_NEXT.has(above.status)
        ? above.completed_at
        : null
      : step.parent_step_id
        ? branch?.status === 'done'
          ? branch.completed_at
          : null
        : anchors.appliedAt;
    out.set(step.id, computeDueAt(timing, { ...anchors, previousCompletedAt: anchor }));
  }
  return out;
}

/**
 * Write a fresh recompute onto the rows in place. On a new instance no
 * step is running, sleeping or retrying, so none of the executor's
 * `recomputeInstance` write filters apply.
 */
function redate(rows: WorkflowStepRow[], anchors: InstanceAnchors): void {
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const p of recomputeDueDates(rows, anchors)) {
    const row = byId.get(p.id);
    if (row) row.due_at = p.due_at;
  }
}
