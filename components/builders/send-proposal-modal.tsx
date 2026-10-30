'use client';

/**
 * Send a proposal: pick a couple, see exactly what they will see, send.
 *
 * Replaces the per-proposal re-authoring the old `ProposalBuilderModal`
 * asked for (founder review, 2026-09-22: "the personal note shouldnt come
 * from this - it should just come from the template and same with
 * everything else (like packages)"). The template is the document; this
 * modal only chooses who gets it and when it expires, then either sends it
 * or hands the new proposal to the design editor.
 *
 * `ProposalBuilderModal` stays for legacy v1 proposals; this is the Layout
 * v2 path.
 *
 * @module components/builders/send-proposal-modal
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { SendProposalControls } from '@/components/builders/parts/send-proposal-controls';
import { SendProposalFooter } from '@/components/builders/parts/send-proposal-footer';
import { SendProposalPreview } from '@/components/builders/parts/send-proposal-preview';
import { useSendProposal } from '@/components/builders/parts/use-send-proposal';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { useCurrentBranding } from '@/lib/branding/use-current-branding';

/** Props for {@link SendProposalModal}. */
export interface SendProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Preselected couple (opened from a couple's profile). */
  initialCoupleId?: string | null;
  initialCoupleName?: string | null;
  /** Preselected template (opened from a template card). Defaults to the account default. */
  initialTemplateId?: string | null;
  /** Fired after a successful send with the new proposal's id. */
  onSent?: (proposalId: string) => void;
}

/** See {@link SendProposalModalProps}. */
export function SendProposalModal({
  isOpen,
  onClose,
  initialCoupleId,
  initialCoupleName,
  initialTemplateId,
  onSent,
}: SendProposalModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { branding, loading: brandingLoading } = useCurrentBranding('proposal');
  const state = useSendProposal({ initialCoupleId, initialTemplateId });
  // Set on click and never cleared: the editor route replaces this page,
  // so the only way back out of the busy state is leaving the modal.
  const [opening, setOpening] = useState(false);
  const busy = state.send.isPending || opening;

  const onSend = () =>
    state.send.mutate(undefined, {
      onSuccess: (proposalId) => {
        toast('Proposal sent', 'success');
        onSent?.(proposalId);
        onClose();
      },
      // The modal stays open on a failure: the draft already exists, so
      // clicking Send again retries the email rather than creating a
      // second proposal (see `useSendProposal`).
      onError: (error) => toast(error.message, 'error'),
    });

  // No create here any more: the editor opens on the template's layout and
  // the proposal row is written by the first real change (see
  // `use-send-proposal.ts`), so quitting out of it leaves nothing behind.
  const onEdit = () => {
    if (!state.editHref) return;
    setOpening(true);
    router.push(state.editHref);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Send a proposal"
      size="fullscreen"
      footer={
        <SendProposalFooter
          blockedReason={state.sendBlockReason}
          loading={state.loading}
          canEdit={state.canEdit}
          sending={state.send.isPending}
          editing={opening}
          onEdit={onEdit}
          onSend={onSend}
        />
      }
    >
      {/* Sticky rather than a second scroll box: the modal body is already
          a scroll container, so the row simply pins to its top while the
          page scrolls under it. The negative margins let the bar's surface
          reach the body's edges and cover what passes beneath. */}
      <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 border-b border-border bg-surface px-4 py-4 sm:-mx-6 sm:px-6">
        <SendProposalControls
          couples={state.couples}
          selectedCoupleId={state.couple?.id ?? initialCoupleId ?? null}
          selectedCoupleName={state.couple?.name ?? initialCoupleName ?? null}
          onSelectCouple={state.selectCouple}
          templates={state.templates}
          selectedTemplate={state.template}
          onSelectTemplate={state.selectTemplate}
          expiresAt={state.expiresAt}
          onExpiresAtChange={state.setExpiresAt}
          disabled={busy}
        />
      </div>
      <SendProposalPreview
        template={state.template}
        branding={branding}
        loading={state.loadingTemplates || brandingLoading}
        error={state.templatesError}
        onRetry={state.retryTemplates}
        coupleName={state.couple?.name ?? initialCoupleName ?? null}
        eventDate={state.couple?.event_date ?? null}
        venue={state.couple?.venue ?? null}
        expiresAt={state.expiresAt}
        depositPercent={state.depositPercent}
      />
    </Modal>
  );
}
