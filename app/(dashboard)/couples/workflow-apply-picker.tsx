'use client';

/**
 * "Start a workflow" picker for a couple.
 *
 * Lists the MC's non-archived templates. Start (or "Start again") opens a
 * preview of when each step will run for this couple, in the same modal,
 * with any step whose date has already passed flagged as skipped; only
 * "Start workflow" applies it. A template already running on this couple
 * still needs a confirm to apply again, because a second copy means a
 * second set of emails.
 *
 * @module app/(dashboard)/couples/workflow-apply-picker
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { loadApplicableTemplatesAction } from '@/app/(dashboard)/workflows/instance-actions';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Empty } from '@/components/ui/empty';
import { ErrorState } from '@/components/ui/error-state';
import { Loading } from '@/components/ui/loading';
import { Modal } from '@/components/ui/modal';

import { useApplyPreview } from './use-apply-preview';
import { WorkflowApplyList, type ApplicableTemplate } from './workflow-apply-list';
import { WorkflowApplyPreview } from './workflow-apply-preview';

export interface WorkflowApplyPickerProps {
  isOpen: boolean;
  onClose: () => void;
  /** The couple the workflow would start on, for the preview. */
  coupleId: string;
  /** Template ids already applied to this couple and not cancelled. */
  appliedTemplateIds: string[];
  onApply: (templateId: string, force: boolean) => Promise<string | null>;
}

/** The apply picker. See {@link WorkflowApplyPickerProps}. */
export function WorkflowApplyPicker({
  isOpen,
  onClose,
  coupleId,
  appliedTemplateIds,
  onApply,
}: WorkflowApplyPickerProps) {
  const [chosen, setChosen] = useState<ApplicableTemplate | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const templates = useQuery({
    enabled: isOpen,
    queryKey: ['applicable-workflow-templates'],
    queryFn: async () => {
      const res = await loadApplicableTemplatesAction();
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
  });

  const chosenId = isOpen ? (chosen?.id ?? null) : null;
  const preview = useApplyPreview(chosenId, coupleId);

  function close() {
    setChosen(null);
    onClose();
  }

  async function apply(force: boolean) {
    if (!chosenId) return;
    setBusy(true);
    try {
      const id = await onApply(chosenId, force);
      if (id) close();
    } finally {
      setBusy(false);
    }
  }

  const already = chosenId !== null && appliedTemplateIds.includes(chosenId);

  const footer = chosen ? (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" onClick={() => setChosen(null)}>
        Back
      </Button>
      <Button
        loading={busy}
        disabled={!preview.data}
        onClick={() => (already ? setConfirming(true) : void apply(false))}
      >
        Start workflow
      </Button>
    </div>
  ) : undefined;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={close}
        title={chosen ? chosen.name : 'Start a workflow'}
        size="md"
        footer={footer}
      >
        {chosen ? (
          <WorkflowApplyPreview query={preview} />
        ) : templates.isLoading ? (
          <Loading label="Loading your workflows" />
        ) : templates.error ? (
          <ErrorState
            title="Could not load your workflows"
            error={templates.error as Error}
            onRetry={() => void templates.refetch()}
          />
        ) : (templates.data ?? []).length === 0 ? (
          <Empty
            title="No workflows ready yet"
            description="Turn one on from the Workflows page and it will show up here."
            size="sm"
          />
        ) : (
          <WorkflowApplyList
            templates={templates.data ?? []}
            appliedTemplateIds={appliedTemplateIds}
            onChoose={setChosen}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={confirming}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void apply(true);
        }}
        title="Start this workflow again?"
        description="This couple already has it running. Starting it again creates a second copy, so any automated emails in it will send twice."
        confirmLabel="Start again"
      />
    </>
  );
}
