'use client';

/**
 * Print a proposal: the same `ProposalPage` block tree the public link
 * renders, in the `print` frame (no reveal animation, no playing media, no
 * accept note), so the PDF matches the link because it is the link.
 * Mirrors `print-invoice.tsx`.
 *
 * @module components/print/print-proposal
 */
import type { Block } from '@/app/(dashboard)/branding/blocks/types';
import { ProposalPage } from '@/app/proposal/[token]/_components/proposal-page';
import type { ProposalLayout } from '@/features/proposals';
import { printDocument } from '@/lib/pdf/print-document';
import type { PublicProposal } from '@/lib/proposals/public-types';

/**
 * Compose the printable proposal element exactly as `/proposal/[token]`
 * does. `layout` is the v2 layout (Proposal Layout v2, Phase 1); when
 * present it prints the layout's sections instead of the v1 `blocks` tree,
 * matching whatever the couple's page actually renders.
 */
export function proposalPrintElement(proposal: PublicProposal, blocks: Block[], layout?: ProposalLayout | null) {
  return (
    <div className="print-card">
      <ProposalPage proposal={proposal} blocks={blocks} layout={layout} frame="print" />
    </div>
  );
}

/** Open the print window for a proposal. See {@link proposalPrintElement} for `layout`. */
export function printProposal(proposal: PublicProposal, blocks: Block[], layout?: ProposalLayout | null): void {
  printDocument({
    title: `Proposal ${proposal.proposal_number}`,
    element: proposalPrintElement(proposal, blocks, layout),
    branding: proposal,
  });
}
