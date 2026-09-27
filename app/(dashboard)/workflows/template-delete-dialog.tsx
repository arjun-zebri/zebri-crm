'use client';

/**
 * Deleting a workflow, and the couples it stops.
 *
 * Deleting a template cancels every couple still running it or paused
 * on it (`deleteTemplateAction`), so the confirmation names how many,
 * counted on the server when the MC chooses Delete, the same way the
 * on/off switch does. Unlike the switch, it always asks: deleting the
 * workflow itself cannot be undone, whoever is running it.
 *
 * @module app/(dashboard)/workflows/template-delete-dialog
 */

import { useRef, useState } from 'react';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';

import { countTemplateEnrolmentsAction } from './actions';
import { couplesLabel } from './template-status-dialog';

/** The delete waiting on the MC's answer. */
interface PendingDelete {
  templateId: string;
  /** Couples it will stop; null when the count could not be read. */
  couples: number | null;
}

/** State and handlers for {@link TemplateDeleteDialog}. */
export function useTemplateDelete(remove: (templateId: string) => Promise<void>) {
  const [pending, setPending] = useState<PendingDelete | null>(null);
  const [saving, setSaving] = useState(false);
  // Ignores a second Delete while the first count is still in flight.
  const inFlight = useRef(false);

  async function request(templateId: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    const res = await countTemplateEnrolmentsAction({ templateId }).finally(() => {
      inFlight.current = false;
    });
    setPending({ templateId, couples: res.ok ? res.data.live : null });
  }

  async function confirm() {
    if (!pending) return;
    setSaving(true);
    try {
      await remove(pending.templateId);
    } finally {
      setSaving(false);
      setPending(null);
    }
  }

  return {
    request,
    dialog: {
      pending,
      saving,
      onConfirm: () => void confirm(),
      onCancel: () => setPending(null),
    },
  };
}

/** The confirmation itself. Spread `useTemplateDelete().dialog` onto it. */
export function TemplateDeleteDialog({
  pending,
  saving,
  onConfirm,
  onCancel,
}: ReturnType<typeof useTemplateDelete>['dialog']) {
  const n = pending?.couples ?? null;
  const title =
    n === 0
      ? 'Delete this workflow?'
      : n === null
        ? 'Delete this workflow and stop it for the couples running it?'
        : `Delete this workflow and stop it for ${couplesLabel(n)}?`;
  const description =
    n === 0
      ? 'No couple is running it. The workflow cannot be recovered.'
      : 'Their workflow is stopped and no new steps will run for them. A step already running finishes. The workflow cannot be recovered.';

  return (
    <ConfirmDialog
      open={pending !== null}
      title={title}
      description={description}
      confirmLabel="Delete"
      loadingLabel="Delete"
      loading={saving}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
