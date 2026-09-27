'use client';

/**
 * The words on a workflow's on/off confirmation.
 *
 * Scoped to this workflow and these couples only. An account-wide stop
 * is a separate control, so nothing here says "stop all emails": it
 * would promise more than this switch does.
 *
 * @module app/(dashboard)/workflows/template-status-dialog
 */

import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

import { PreflightDialog } from './preflight-list';
import type { TemplateStatusChange } from './use-template-status-change';

/** "1 couple", "4 couples". */
export function couplesLabel(n: number): string {
  return `${n} ${n === 1 ? 'couple' : 'couples'}`;
}

/** Renders the pending change from {@link TemplateStatusChange}, if any. */
export function TemplateStatusDialog({
  pending,
  blocked,
  onBlockedClose,
  resume,
  onResumeChange,
  saving,
  onConfirm,
  onCancel,
}: TemplateStatusChange['dialog']) {
  // A Turn on the pre-flight refused: the list, and nothing to confirm.
  if (blocked) return <PreflightDialog problems={blocked} onClose={onBlockedClose} />;

  if (pending?.kind === 'on') {
    const n = pending.couples ?? 0;
    return (
      <ConfirmDialog
        open
        tone="primary"
        title="Turn this workflow on?"
        description="It starts applying to new couples again."
        confirmLabel="Turn on"
        loadingLabel="Turn on"
        loading={saving}
        onConfirm={onConfirm}
        onCancel={onCancel}
      >
        <Checkbox
          checked={resume}
          onChange={onResumeChange}
          label={`Resume the ${couplesLabel(n)} paused when this was turned off`}
        />
        <p className="mt-2 text-body text-text-muted">
          Steps that fell due while it was off will be skipped, not sent.
        </p>
      </ConfirmDialog>
    );
  }

  const n = pending?.couples ?? null;
  return (
    <ConfirmDialog
      open={pending !== null}
      title={
        n === null
          ? 'Pause this workflow for the couples running it?'
          : `Pause this workflow for ${couplesLabel(n)}?`
      }
      description="It stops applying to new couples, and no new steps will run for the couples running it. A step already running finishes. You can resume them when you turn it back on."
      confirmLabel="Turn off"
      loadingLabel="Turn off"
      loading={saving}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
