/**
 * A couple's steps, merged into the order the MC works them.
 *
 * The tab used to render one checklist per applied workflow, which put
 * the engine's structure on screen instead of the MC's day: two headings
 * (one of them the auto-created "General" bucket nobody made), a
 * progress bar per workflow, and the one overdue call buried under a
 * send that is not due for a fortnight. An MC does not think "step 7 of
 * the enquiry workflow"; they think "what needs me on this couple".
 *
 * So every visible instance's steps land in one list, split into what
 * needs a person now and what is coming, with the workflow's name
 * demoted to a chip on the row.
 *
 * Pure and separate from the component so the classification can be
 * tested without rendering anything.
 *
 * @module app/(dashboard)/couples/couple-workflow-buckets
 */

import { zonedDateParts } from '@/lib/scheduling/timezone';
import { needsReview } from '@/lib/workflows/needs-review';
import { resumeRefusal } from '@/lib/workflows/resume-eligibility';
import type {
  WorkflowInstanceWithSteps,
  WorkflowStepRow,
} from '@/types/workflows';

/** One row of the merged list. */
export interface CoupleStepRow {
  step: WorkflowStepRow;
  /**
   * The workflow this step came from, or null when it is a loose to-do.
   *
   * Null for the couple's default instance: its stored name is
   * "General", which is a heading for a workflow the MC never made.
   * A loose to-do simply carries no chip.
   */
  workflowName: string | null;
  /** True when the row's workflow is running or paused and can still be stopped. */
  canStop: boolean;
  /**
   * True when the row's workflow is running and one the MC started, so it
   * can be paused. Never the couple's own to-do list: that holds their
   * loose to-dos, not a sequence, and pausing it would hide them.
   */
  canPause: boolean;
  /**
   * True when the row's workflow is paused and the server would resume
   * it (see `resumeRefusal`). A pause an apply is still building is not.
   */
  canResume: boolean;
  /**
   * True when the row's workflow is paused. Nothing on it runs until it
   * is resumed, so the row has to say so rather than look like any
   * other upcoming step.
   */
  paused: boolean;
  instanceId: string;
}

/** The three groups the tab renders. */
export interface CoupleStepBuckets {
  /** Waiting on a person: held sends, failures, anything overdue. */
  needsYouNow: CoupleStepRow[];
  /** Everything still to come, soonest first. */
  next: CoupleStepRow[];
  /** Finished or skipped, most recent first. */
  done: CoupleStepRow[];
}

/** Steps with no date sit after dated ones rather than at the top. */
function byDueDate(a: CoupleStepRow, b: CoupleStepRow): number {
  const left = a.step.due_at;
  const right = b.step.due_at;
  if (left === null && right === null) return a.step.position - b.step.position;
  if (left === null) return 1;
  if (right === null) return -1;
  return left.localeCompare(right) || a.step.position - b.step.position;
}

/** Most recently finished first, undated last. */
function byCompletedAt(a: CoupleStepRow, b: CoupleStepRow): number {
  const left = a.step.completed_at ?? '';
  const right = b.step.completed_at ?? '';
  return right.localeCompare(left);
}

/**
 * Split one couple's instances into the tab's three groups.
 *
 * @param instances - the couple's instances, cancelled ones already dropped
 * @param timezone - IANA zone that decides what "overdue" means today
 * @param now - injectable for tests
 */
export function bucketCoupleSteps(
  instances: WorkflowInstanceWithSteps[],
  timezone: string,
  now: Date = new Date(),
): CoupleStepBuckets {
  const today = zonedDateParts(now, timezone).date;
  const buckets: CoupleStepBuckets = { needsYouNow: [], next: [], done: [] };

  for (const instance of instances) {
    for (const step of instance.steps) {
      const row: CoupleStepRow = {
        step,
        workflowName: instance.is_default ? null : instance.name,
        canStop:
          !instance.is_default &&
          (instance.status === 'active' || instance.status === 'paused'),
        canPause:
          !instance.is_default && !instance.is_personal && instance.status === 'active',
        canResume: instance.status === 'paused' && resumeRefusal(instance) === null,
        paused: instance.status === 'paused',
        instanceId: instance.id,
      };

      // A cancelled step is a stopped workflow's, and the tab lists those
      // separately. It is not done (nobody did it), not work (nothing will
      // run it) and not a failure.
      if (step.status === 'cancelled') continue;

      if (step.status === 'done' || step.status === 'skipped') {
        buckets.done.push(row);
        continue;
      }

      const overdue =
        step.due_at !== null &&
        zonedDateParts(new Date(step.due_at), timezone).date < today;

      if (step.status === 'errored' || needsReview(step, now) || overdue) {
        buckets.needsYouNow.push(row);
      } else {
        buckets.next.push(row);
      }
    }
  }

  buckets.needsYouNow.sort(byDueDate);
  buckets.next.sort(byDueDate);
  buckets.done.sort(byCompletedAt);
  return buckets;
}
