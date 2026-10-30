/**
 * Proposal builder modal: composition over BuilderModalShell and the
 * proposal parts. All state and persistence live in useProposalForm.
 *
 * Header CTA: none while draft (Send is the footer action); "Revert to
 * draft" in the overflow while sent; accepted proposals are read-only and
 * link out to the generated documents from the detail page.
 *
 * @module components/builders/proposal-builder-modal
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { PROPOSAL_STATE_PILL } from '@/app/(dashboard)/proposals/proposals-list';
import type { CoupleOption } from '@/components/builders/parts/builder-meta-row';
import { BuilderModalShell, type OverflowMenuItem } from '@/components/builders/parts/builder-modal-shell';
import { ProposalBuilderBody } from '@/components/builders/parts/proposal-builder-body';
import { ProposalPreviewPane } from '@/components/builders/parts/proposal-preview-pane';
import { isReadyToSend, sendBlockReason } from '@/components/builders/parts/proposal-readiness';
import { ShareAndSend } from '@/components/builders/parts/share-and-send';
import { useApplySources } from '@/components/builders/parts/use-apply-sources';
import { useProposalForm } from '@/components/builders/parts/use-proposal-form';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Loading } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { createClient } from '@/lib/supabase/client';
import { getCurrentUser } from '@/lib/supabase/current-user';

export interface ProposalBuilderModalProps {
  proposalId: string | null;
  initialCoupleId?: string;
  initialCoupleName?: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (id: string) => void;
  onDeleted?: () => void;
}

/** See {@link ProposalBuilderModalProps}. */
export function ProposalBuilderModal({ proposalId, initialCoupleId, initialCoupleName, isOpen, onClose, onSaved, onDeleted }: ProposalBuilderModalProps) {
  const supabase = createClient();
  const { toast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { form, update, dirty, isLoading, hasLayout, layout, save, send, remove, revert } = useProposalForm(proposalId, initialCoupleId ?? null, isOpen);
  const { data: sources } = useApplySources();

  const { data: couples } = useQuery({
    queryKey: ['all-couples-for-proposal'],
    queryFn: async () => {
      const user = await getCurrentUser();
      if (!user) return [];
      const { data, error } = await supabase.from('couples').select('id, name, primary_email, email').eq('user_id', user.id).order('name');
      if (error) throw error;
      return (data ?? []) as CoupleOption[];
    },
  });
  const coupleName = couples?.find((c) => c.id === form.coupleId)?.name ?? initialCoupleName ?? null;

  const canEdit = form.status !== 'accepted';
  const shareUrl = form.shareToken ? `${window.location.origin}/proposal/${form.shareToken}` : null;

  const overflow: OverflowMenuItem[] = [];
  if (form.status !== 'draft' && form.status !== 'accepted') {
    overflow.push({ label: 'Revert to draft', onClick: () => revert.mutate() });
  }

  const onSave = () =>
    save.mutate(undefined, {
      onSuccess: (d) => {
        toast('Proposal saved', 'success');
        onSaved?.(d.id);
      },
      onError: (e) => toast(e.message, 'error'),
    });
  const onSend = () =>
    send.mutate(undefined, {
      onSuccess: (id) => {
        toast('Proposal sent', 'success');
        onSaved?.(id);
      },
      onError: (e) => toast(e.message, 'error'),
    });

  return (
    <>
      <BuilderModalShell
        isOpen={isOpen}
        onClose={onClose}
        documentNumber={form.proposalNumber ?? 'New proposal'}
        statePill={form.proposalNumber ? PROPOSAL_STATE_PILL[form.status] : undefined}
        overflowItems={overflow.length ? overflow : undefined}
        onDelete={form.proposalId ? () => setConfirmDelete(true) : undefined}
        deleteLabel="Delete proposal"
        title={form.title}
        onTitleChange={(t) => update({ title: t })}
        titlePlaceholder="Anna & Jake, your wedding"
        titleReadOnly={!canEdit}
        previewPane={<ProposalPreviewPane form={form} coupleName={coupleName} layout={layout} />}
        footer={
          <ShareAndSend
            dirty={dirty}
            shareEnabled={form.shareTokenEnabled}
            shareUrl={shareUrl}
            lastSentAt={form.emailSentAt}
            locked={!canEdit}
            saving={save.isPending}
            sending={send.isPending}
            hasCouple={!!form.coupleId && isReadyToSend(form)}
            blockedReason={sendBlockReason(form)}
            onSave={onSave}
            onSend={onSend}
          />
        }
      >
        {isLoading ? (
          <Loading label="Loading proposal" />
        ) : (
          <ProposalBuilderBody
            form={form}
            update={update}
            canEdit={canEdit}
            hasLayout={hasLayout}
            couples={couples}
            coupleName={coupleName}
            sources={sources}
          />
        )}
      </BuilderModalShell>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this proposal?"
        description="The couple's link will stop working. This cannot be undone."
        confirmLabel="Delete"
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => {
              setConfirmDelete(false);
              onDeleted?.();
              onClose();
            },
            onError: (e) => toast(e.message, 'error'),
          })
        }
      />
    </>
  );
}
