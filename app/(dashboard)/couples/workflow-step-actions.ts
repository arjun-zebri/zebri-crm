/**
 * The overflow menu of a workflow step row, by the step's status.
 *
 * Pure, split out of `./workflow-step-row` (Phase 5 fix wave, parked size
 * item): an errored step offers Try again; live work can be renamed,
 * moved or skipped; a done or skipped step can be reopened; every step
 * can be removed. Cancelled steps (a stopped workflow) offer nothing that
 * treats them as live.
 *
 * @module app/(dashboard)/couples/workflow-step-actions
 */

import { inDays } from '@/app/(dashboard)/workflows/queue-labels';
import type { RowAction } from '@/components/ui/row-actions-menu';

/** What the menu can do; each is called with the step's id. */
export interface WorkflowStepActionHandlers {
  onRetry: (stepId: string) => void;
  onRename: () => void;
  onReschedule: (stepId: string, dueAt: string | null) => void;
  onSkip: (stepId: string) => void;
  onUntick: (stepId: string) => void;
  onRemove: (stepId: string) => void;
}

/** The menu for one step. See the module comment for the rules. */
export function workflowStepActions(
  step: { id: string; status: string },
  on: WorkflowStepActionHandlers,
  extraActions: RowAction[] = [],
): RowAction[] {
  const done = step.status === 'done';
  const skipped = step.status === 'skipped';
  const live = !done && !skipped && step.status !== 'cancelled';
  return [
    ...(step.status === 'errored' ? [{ label: 'Try again', onSelect: () => on.onRetry(step.id) }] : []),
    ...(live
      ? [
          { label: 'Rename', onSelect: on.onRename },
          { label: 'Tomorrow', onSelect: () => on.onReschedule(step.id, inDays(1)) },
          { label: 'Next week', onSelect: () => on.onReschedule(step.id, inDays(7)) },
          { label: 'Take the date off', onSelect: () => on.onReschedule(step.id, null) },
          { label: 'Skip this step', onSelect: () => on.onSkip(step.id) },
        ]
      : []),
    ...(done || skipped ? [{ label: 'Reopen', onSelect: () => on.onUntick(step.id) }] : []),
    { label: 'Remove', destructive: true, onSelect: () => on.onRemove(step.id) },
    ...extraActions,
  ];
}
