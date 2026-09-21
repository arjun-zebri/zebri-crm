/**
 * "Download PDF" action for the proposal detail page: fetches the full
 * print row and the MC's current branding on demand, then prints through
 * the exact same `ProposalPage` the couple's link renders. Split out of
 * `proposal-detail.tsx` to keep that file under the component line budget.
 *
 * @module app/(dashboard)/proposals/[id]/proposal-pdf-button
 */
'use client';

import { FileDown } from 'lucide-react';

import { useProposalForPrint } from '@/app/(dashboard)/proposals/use-proposals';
import { printProposal } from '@/components/print/print-proposal';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useCurrentBranding } from '@/lib/branding/use-current-branding';
import { toPublicProposal } from '@/lib/proposals/to-public';

/** Props for {@link ProposalPdfButton}. */
export interface ProposalPdfButtonProps {
  /** The proposal to print. */
  proposalId: string;
}

/** See {@link ProposalPdfButtonProps}. */
export function ProposalPdfButton({ proposalId }: ProposalPdfButtonProps) {
  const { toast } = useToast();
  const { refetch, isFetching } = useProposalForPrint(proposalId);
  const { branding, blocks, loading: brandingLoading } = useCurrentBranding('proposal');

  const download = async () => {
    const { data: row, error } = await refetch();
    if (error || !row) {
      toast('Could not load this proposal for print', 'error');
      return;
    }
    if (!branding) {
      toast('Could not load your branding', 'error');
      return;
    }
    printProposal(toPublicProposal(row, branding, blocks), blocks);
  };

  return (
    <Button variant="secondary" onClick={() => void download()} loading={isFetching || brandingLoading} className="gap-1.5">
      <FileDown size={14} strokeWidth={1.5} /> Download PDF
    </Button>
  );
}
