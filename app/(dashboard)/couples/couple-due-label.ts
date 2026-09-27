/**
 * A step's due date in the MC's words, for the couple's Workflow list.
 *
 * Pure, and out of the tab component so the tab stays an orchestrator.
 *
 * @module app/(dashboard)/couples/couple-due-label
 */

import { zonedDateParts } from '@/lib/scheduling/timezone';
import type { WorkflowStepRow } from '@/types/workflows';

/**
 * "Today", "Overdue · 2026-09-01", a plain date, "Failed", or nothing.
 *
 * Nothing for a finished, skipped or cancelled step: none of them is
 * coming, so a date would read as a promise. A cancelled step is never
 * "Failed" either; its workflow was stopped, nothing went wrong.
 *
 * @param step - the step
 * @param timezone - IANA zone that decides what "today" is
 * @param now - injectable for tests
 */
export function coupleDueLabel(
  step: WorkflowStepRow,
  timezone: string,
  now: Date = new Date(),
): string {
  if (step.status === 'errored') return 'Failed';
  if (step.status === 'done' || step.status === 'skipped' || step.status === 'cancelled') return '';
  if (step.due_at === null) return '';
  const today = zonedDateParts(now, timezone).date;
  const due = zonedDateParts(new Date(step.due_at), timezone).date;
  if (due === today) return 'Today';
  return due < today ? `Overdue · ${due}` : due;
}
