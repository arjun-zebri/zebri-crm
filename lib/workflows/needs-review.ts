/**
 * The one definition of "this step is waiting for the MC's yes".
 *
 * Its own module, apart from `./review`, because the couple checklist
 * (a client component) needs it and `./review` now reaches the send's
 * own recipient and sender code for the step envelope, which must never
 * be bundled for the browser. This file imports nothing that runs on a
 * server.
 *
 * @module lib/workflows/needs-review
 */

import type { WorkflowStepRow } from '@/types/workflows';

import { isAutomated } from './steps';

/**
 * Is this step sitting in front of the MC waiting for a yes?
 *
 * Pure, and exported so the Today view, the couple checklist and the
 * tests all agree on one definition: automated, pending, flagged for
 * review, and due.
 */
export function needsReview(step: WorkflowStepRow, now: Date): boolean {
  if (!isAutomated(step.type)) return false;
  if (step.status !== 'pending') return false;
  if (!step.requires_approval) return false;
  if (step.due_at === null) return false;
  return new Date(step.due_at).getTime() <= now.getTime();
}
