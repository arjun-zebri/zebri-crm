/**
 * A step's due date in the MC's words, for the couple's Workflow list.
 *
 * Pure, and out of the tab component so the tab stays an orchestrator.
 *
 * @module app/(dashboard)/couples/couple-due-label
 */

import { zonedDateParts } from '@/lib/scheduling/timezone';
import type { StepProjection } from '@/lib/workflows/schedule-projection';
import type { WorkflowStepRow } from '@/types/workflows';

/**
 * "Today", "Overdue · 2026-09-01", a plain date, "Failed", or nothing.
 *
 * Nothing for a finished, skipped or cancelled step: none of them is
 * coming, so a date would read as a promise. A cancelled step is never
 * "Failed" either; its workflow was stopped, nothing went wrong.
 *
 * Given a projection (see `./couple-step-projection`), a step the
 * engine has not dated yet (anything behind a Wait) reads the time it
 * will actually run. A step with a stored `due_at` keeps it. A Wait reads when it ends ("Until
 * 2027-03-30"), since the day it started tells the MC nothing about
 * the send below it. A step only a person can release says why
 * ("After you OK Send email · …") rather than showing nothing.
 *
 * @param step - the step
 * @param timezone - IANA zone that decides what "today" is
 * @param now - injectable for tests
 * @param projection - the step's projected run, when its workflow is running
 */
export function coupleDueLabel(
  step: WorkflowStepRow,
  timezone: string,
  now: Date = new Date(),
  projection?: StepProjection,
): string {
  if (step.status === 'errored') return 'Failed';
  if (step.status === 'done' || step.status === 'skipped' || step.status === 'cancelled') return '';
  const today = zonedDateParts(now, timezone).date;
  const local = (at: string) => zonedDateParts(new Date(at), timezone).date;
  if (step.type === 'wait' && projection?.at) {
    const ends = local(projection.at);
    return `Until ${ends === today ? 'today' : ends}`;
  }
  // A stored date wins: the projection would call an overdue send
  // "Today" (it runs on the next tick), hiding a step that is stuck.
  // The projection only fills in what the engine has not dated yet.
  if (step.due_at === null) {
    if (!projection) return '';
    if (projection.at === null) return projection.gate ?? '';
  }
  const due = local(step.due_at ?? (projection?.at as string));
  if (due === today) return 'Today';
  return due < today ? `Overdue · ${due}` : due;
}
