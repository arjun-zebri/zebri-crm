/**
 * Which steps move when one step is removed or skipped.
 *
 * An applied workflow is a chain: a step timed "straight after the step
 * above" takes its date from whatever finishes in front of it, and the
 * first step inside a branch takes its date from the branch itself. Take
 * a step out of that chain and everything hanging off it re-anchors to
 * the next thing that has finished, which is usually "now". That is how a
 * "2 months out" email ends up due the day the workflow was applied: the
 * MC removed the timer in front of it (see the 2026-09-16 incident in
 * `.claude/docs/workflows.md`).
 *
 * These helpers name that fallout before the MC confirms, so the
 * confirmation can say what will actually happen instead of "Remove?".
 *
 * @module lib/workflows/step-dependents
 */

import type { WorkflowStepRow } from '@/types/workflows';

/** Statuses that will not run again and so cannot move. */
const TERMINAL: ReadonlySet<string> = new Set(['done', 'skipped', 'errored']);

/** Siblings of `step` in its own lane (same parent and branch path), in order. */
function laneOf(step: WorkflowStepRow, steps: WorkflowStepRow[]): WorkflowStepRow[] {
  return steps
    .filter(
      (s) =>
        s.instance_id === step.instance_id &&
        s.parent_step_id === step.parent_step_id &&
        s.branch_path === step.branch_path,
    )
    .sort((a, b) => a.position - b.position);
}

/**
 * The run of steps anchored to `from`, walking forward from `startIndex`.
 *
 * The walk stops at the first step that carries its own date (a
 * wedding- or start-relative timing) or has already finished: nothing
 * past that point takes its date from `from`.
 */
function chainFrom(lane: WorkflowStepRow[], startIndex: number): WorkflowStepRow[] {
  const out: WorkflowStepRow[] = [];
  for (let i = startIndex; i < lane.length; i += 1) {
    const s = lane[i]!;
    if (TERMINAL.has(s.status) || s.timing.mode !== 'after_previous') break;
    out.push(s);
  }
  return out;
}

/**
 * Steps whose date is taken from `step` and would move if it went away.
 *
 * Covers the later siblings timed "straight after" it, and, for a
 * branch, the head of each nested lane plus its own "straight after"
 * run. Steps with their own date are left out: they keep it.
 *
 * @param step - the step about to be removed or skipped
 * @param steps - every step of the same instance, in any order
 */
export function timedDependents(
  step: WorkflowStepRow,
  steps: WorkflowStepRow[],
): WorkflowStepRow[] {
  const lane = laneOf(step, steps);
  const index = lane.findIndex((s) => s.id === step.id);
  const out = index === -1 ? [] : chainFrom(lane, index + 1);

  if (step.type === 'branch') {
    for (const path of ['yes', 'no'] as const) {
      const nested = steps
        .filter((s) => s.parent_step_id === step.id && s.branch_path === path)
        .sort((a, b) => a.position - b.position);
      out.push(...chainFrom(nested, 0));
    }
  }
  return out;
}

/**
 * Steps nested under `step`, which the database removes with it.
 *
 * Only a branch has any. Finished ones are included: removing a branch
 * takes its history with it, and the MC should know that too.
 */
export function nestedSteps(step: WorkflowStepRow, steps: WorkflowStepRow[]): WorkflowStepRow[] {
  if (step.type !== 'branch') return [];
  return steps
    .filter((s) => s.parent_step_id === step.id)
    .sort((a, b) => a.position - b.position);
}
