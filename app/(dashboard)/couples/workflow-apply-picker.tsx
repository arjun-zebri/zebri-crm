'use client';

/**
 * "Apply workflow" picker for a couple.
 *
 * Lists the MC's non-archived templates. A template already running on
 * this couple is shown as such and needs a confirm to apply again,
 * because a second copy means a second set of emails.
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

export interface WorkflowApplyPickerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Template ids already applied to this couple and not cancelled. */
  appliedTemplateIds: string[];
  onApply: (templateId: string, force: boolean) => Promise<string | null>;
}

/** The apply picker. See {@link WorkflowApplyPickerProps}. */
export function WorkflowApplyPicker({
  isOpen,
  onClose,
  appliedTemplateIds,
  onApply,
}: WorkflowApplyPickerProps) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = useQuery({
    enabled: isOpen,
    queryKey: ['applicable-workflow-templates'],
    queryFn: async () => {
      const res = await loadApplicableTemplatesAction();
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
  });

  async function apply(templateId: string, force: boolean) {
    setBusyId(templateId);
    try {
      const id = await onApply(templateId, force);
      if (id) onClose();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Start a workflow" size="md">
        {query.isLoading ? (
          <Loading label="Loading your workflows" />
        ) : query.error ? (
          <ErrorState
            title="Could not load your workflows"
            error={query.error as Error}
            onRetry={() => void query.refetch()}
          />
        ) : (query.data ?? []).length === 0 ? (
          <Empty
            title="No workflows ready yet"
            description="Turn one on from the Workflows page and it will show up here."
            size="sm"
          />
        ) : (
          <ul className="divide-y divide-border">
            {(query.data ?? []).map((template) => {
              const already = appliedTemplateIds.includes(template.id);
              return (
                <li key={template.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-body text-text">{template.name}</span>
                    {template.description ? (
                      <span className="block truncate text-body text-text-muted">
                        {template.description}
                      </span>
                    ) : already ? (
                      <span className="block text-body text-text-muted">Already running</span>
                    ) : null}
                  </div>
                  <Button
                    variant={already ? 'outline' : 'primary'}
                    loading={busyId === template.id}
                    onClick={() => {
                      if (already) setConfirming(template.id);
                      else void apply(template.id, false);
                    }}
                  >
                    {already ? 'Start again' : 'Start'}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      <ConfirmDialog
        open={confirming !== null}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming) void apply(confirming, true);
          setConfirming(null);
        }}
        title="Start this workflow again?"
        description="This couple already has it running. Starting it again creates a second copy, so any automated emails in it will send twice."
        confirmLabel="Start again"
      />
    </>
  );
}
