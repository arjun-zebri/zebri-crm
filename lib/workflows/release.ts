/**
 * Is a step released, or still waiting on the step before it?
 *
 * The same rule {@link recomputeDueDates} dates steps by, asked of one
 * step: a chained (`after_previous`) step is released once every step
 * above it in its lane is done or skipped, dated steps included; the head of a branch lane
 * once its branch has decided (is `done`); the head of the top-level
 * lane at once. A wedding- or apply-dated step has its own date, so it
 * is never waiting on anything.
 *
 * Release is transitive because a to-do can be ticked early: ticking it
 * while a send above it is still behind a Wait must not release the
 * send below it ahead of that one (owner report, 2026-09-27).
 *
 * Upcoming now lists every send, including ones behind a to-do, a Wait
 * or a held approval. Snoozing one of those gave it a date the engine
 * runs on sight, and Send & complete ran it at once: the email went out
 * of order. This rule is what the list, the detail modal and the server
 * actions all refuse by, so the three can never disagree.
 *
 * @module lib/workflows/release
 */

import type { WorkflowStepRow } from '@/types/workflows';

import { stepDisplayTitle } from './step-label';
import { RELEASES_NEXT } from './timing';
import { toStepTiming } from './timing-summary';

/** The step fields the rule reads. */
export type ReleaseStep = Pick<
  WorkflowStepRow,
  | 'id'
  | 'position'
  | 'type'
  | 'status'
  | 'timing'
  | 'parent_step_id'
  | 'branch_path'
  | 'title'
  | 'config'
  | 'completed_at'
>;

/**
 * The step this one is waiting on, or null when it is released.
 *
 * @param step - the step asked about
 * @param steps - every step in its instance (it may be included)
 */
export function releaseBlocker<T extends ReleaseStep>(step: T, steps: readonly T[]): T | null {
  // Read through the same coercion the rows render with: timing is
  // stored jsonb, and an unreadable one is the default (chained).
  if (toStepTiming(step.timing).mode !== 'after_previous') return null;
  const lane = steps
    .filter((s) => s.parent_step_id === step.parent_step_id && s.branch_path === step.branch_path)
    .sort((a, b) => a.position - b.position);
  const index = lane.findIndex((s) => s.id === step.id);
  // Walk up the lane: the nearest step still open is the one it waits
  // on, past any finished step, dated or not (owner ruling, 2026-09-27).
  for (let k = index - 1; k >= 0; k -= 1) {
    const above = lane[k]!;
    // A finished row with no finish time gives `computeDueAt` no anchor,
    // so the engine leaves the step behind it undated: it releases
    // nothing here either, or the modal would offer a Snooze the engine
    // never honours.
    if (!RELEASES_NEXT.has(above.status) || !above.completed_at) return above;
  }
  if (!step.parent_step_id) return null;
  const branch = steps.find((s) => s.id === step.parent_step_id);
  // A branch that has not run yet, or that was skipped (it chose no
  // lane), releases neither side.
  return branch && branch.status !== 'done' ? branch : null;
}

/**
 * Why this step cannot be sent or moved yet, in the MC's words, or null
 * when it is released.
 *
 * @param step - the step asked about
 * @param steps - every step in its instance
 */
export function blockedReason<T extends ReleaseStep>(step: T, steps: readonly T[]): string | null {
  const blocker = releaseBlocker(step, steps);
  if (!blocker) return null;
  const title = stepDisplayTitle(blocker);
  return blocker.type === 'branch'
    ? `This step runs once "${title}" has decided which way to go.`
    : `This step waits for "${title}" to finish first.`;
}
