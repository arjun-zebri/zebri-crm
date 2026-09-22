'use client';

/**
 * "Are you sure?" for removing or skipping a step that others are timed
 * from.
 *
 * Removing the "6 months before" timer in front of an email pulls the
 * email forward to today; nobody would do that knowingly, but the row
 * menu said only "Remove". This dialog spells out what moves. When
 * nothing is timed from the step it asks nothing and just proceeds.
 *
 * @module app/(dashboard)/couples/step-consequence-dialog
 */

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { nestedSteps, timedDependents } from '@/lib/workflows/step-dependents';
import { stepDisplayTitle } from '@/lib/workflows/step-label';
import type { WorkflowStepRow } from '@/types/workflows';

/** What the MC asked to do to which step. */
export interface PendingStepAction {
  op: 'remove' | 'skip';
  step: WorkflowStepRow;
}

export interface StepConsequenceDialogProps {
  pending: PendingStepAction | null;
  /** Every step of the couple's visible instances. */
  steps: WorkflowStepRow[];
  onConfirm: (pending: PendingStepAction) => void;
  onCancel: () => void;
}

/** Up to three titles, then "and N more". */
function nameSome(rows: WorkflowStepRow[]): string {
  const names = rows.slice(0, 3).map((s) => `"${stepDisplayTitle(s)}"`);
  const rest = rows.length - names.length;
  return rest > 0 ? `${names.join(', ')} and ${rest} more` : names.join(', ');
}

/**
 * The copy for one pending action, or null when there is nothing to warn
 * about and the action should simply run.
 */
export function describeConsequence(
  pending: PendingStepAction,
  steps: WorkflowStepRow[],
): { title: string; description: string; confirmLabel: string } | null {
  const nested = nestedSteps(pending.step, steps);
  const nestedIds = new Set(nested.map((s) => s.id));
  const movers = timedDependents(pending.step, steps).filter((s) => !nestedIds.has(s.id));
  const name = stepDisplayTitle(pending.step);

  if (pending.op === 'remove') {
    if (nested.length === 0 && movers.length === 0) return null;
    const parts: string[] = [];
    if (nested.length > 0) {
      parts.push(`${nameSome(nested)} ${nested.length === 1 ? 'sits' : 'sit'} inside it and will be removed too.`);
    }
    if (movers.length > 0) {
      parts.push(
        `${nameSome(movers)} ${movers.length === 1 ? 'is' : 'are'} timed from this step. ` +
          `Without it ${movers.length === 1 ? 'it moves' : 'they move'} up to follow the step above, which can mean becoming due straight away.`,
      );
    }
    return {
      title: `Remove "${name}"?`,
      description: parts.join(' '),
      confirmLabel: 'Remove',
    };
  }

  const dependents = timedDependents(pending.step, steps);
  if (dependents.length === 0) return null;
  return {
    title: `Skip "${name}"?`,
    description:
      `${nameSome(dependents)} ${dependents.length === 1 ? 'is' : 'are'} timed from this step and ` +
      `${dependents.length === 1 ? 'becomes' : 'become'} due as soon as it is skipped.`,
    confirmLabel: 'Skip it',
  };
}

/** See {@link StepConsequenceDialogProps}. */
export function StepConsequenceDialog({ pending, steps, onConfirm, onCancel }: StepConsequenceDialogProps) {
  const copy = pending ? describeConsequence(pending, steps) : null;
  return (
    <ConfirmDialog
      open={pending !== null && copy !== null}
      title={copy?.title ?? ''}
      description={copy?.description ?? ''}
      confirmLabel={copy?.confirmLabel ?? 'Confirm'}
      onConfirm={() => pending && onConfirm(pending)}
      onCancel={onCancel}
    />
  );
}
