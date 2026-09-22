/**
 * Titles and due wording for one step on a couple's Workflow tab.
 *
 * The rule the row used to get wrong, which pushed an MC into deleting
 * steps that were doing their job (2026-09-16, see
 * `.claude/docs/workflows.md`):
 *
 * - An engine step is never "overdue" to the MC. A branch timed "6
 *   months before the wedding" for a couple booked 3 months out is past
 *   its date on the day it is applied, and that is fine: the engine runs
 *   it on its next sweep. Painting it red invites a clean-up.
 *
 * (Naming an untitled step lives in `lib/workflows/step-label`, which
 * the loader already applies; a branch is named by its timing there.)
 *
 * Pure so the rule is unit-tested without rendering.
 *
 * @module app/(dashboard)/couples/step-labels
 */

import { zonedDateParts } from '@/lib/scheduling/timezone';
import { isAutomated } from '@/lib/workflows/steps';
import type { WorkflowStepRow } from '@/types/workflows';

/**
 * True when a step is the MC's and its date has passed.
 *
 * Automated steps never qualify: their date is the engine's cue, not a
 * deadline the MC missed. Errored ones are surfaced by status instead.
 */
export function isOverdueForMc(step: WorkflowStepRow, today: string, timezone: string): boolean {
  if (step.status !== 'pending' || step.due_at === null) return false;
  if (isAutomated(step.type)) return false;
  return zonedDateParts(new Date(step.due_at), timezone).date < today;
}

/**
 * The due wording for one row. Empty string renders nothing.
 *
 * @param step - the step
 * @param timezone - the MC's IANA zone, which decides what "today" is
 * @param now - injectable for tests
 */
export function stepDueLabel(step: WorkflowStepRow, timezone: string, now: Date = new Date()): string {
  if (step.status === 'errored') return 'Failed';
  if (step.status === 'done' || step.status === 'skipped') return '';
  if (step.due_at === null) return '';
  const today = zonedDateParts(now, timezone).date;
  const due = zonedDateParts(new Date(step.due_at), timezone).date;
  if (due === today) return isAutomated(step.type) ? 'Runs today' : 'Today';
  if (due < today) return isAutomated(step.type) ? 'Due to run' : `Overdue · ${due}`;
  return due;
}
