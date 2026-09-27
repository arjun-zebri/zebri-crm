'use client';

/**
 * The confirm in front of every Resume on the couple's Workflow tab.
 *
 * Resuming never sends a backlog: whatever fell due while the workflow
 * was not running is skipped (`lib/workflows/resume`). The MC has to be
 * told that before they press it, or a skipped reminder reads as a bug.
 *
 * @module app/(dashboard)/couples/workflow-resume-dialog
 */

import { ConfirmDialog } from '@/components/ui/confirm-dialog';

import type { ResumeTarget } from './use-instance-controls';

export interface WorkflowResumeDialogProps {
  /** The workflow being asked about; null keeps the dialog closed. */
  target: ResumeTarget | null;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** See {@link WorkflowResumeDialogProps}. */
export function WorkflowResumeDialog({
  target,
  loading,
  onConfirm,
  onCancel,
}: WorkflowResumeDialogProps) {
  // A paused workflow's dates were kept current while it was paused, so
  // what is ahead keeps its date. A stopped one's were not: its steps are
  // re-dated from today, and a wait that was running starts over.
  const description =
    target?.from === 'cancelled'
      ? 'Steps that fell due while it was stopped will be skipped, not sent. Everything else is re-dated from today, and any wait starts again from the beginning.'
      : 'Steps that fell due while it was paused will be skipped, not sent. Everything still ahead keeps its date.';
  return (
    <ConfirmDialog
      open={target !== null}
      tone="primary"
      title={`Resume ${target?.name ?? 'this workflow'}?`}
      description={description}
      confirmLabel="Resume"
      // Same label busy or not, so the button keeps its width.
      loadingLabel="Resume"
      loading={loading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
