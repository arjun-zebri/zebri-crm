'use client';

/**
 * Stands in for the packages and add-ons editors in the Details modal when
 * a proposal carries its own Layout v2 design.
 *
 * Such a proposal has two things that must agree: the package cards the
 * couple reads off `proposals.layout`, and the `proposal_options` rows the
 * contract and invoice are built from. The design editor keeps the rows in
 * step with the cards (`features/proposals/data/resync-options.ts`), so a
 * second editor here would let an MC change the rows without the couple's
 * page following, and quietly bill a different figure from the one on
 * screen. One place to edit packages, and this points at it.
 *
 * @module components/builders/parts/proposal-packages-from-design
 */
import { LayoutTemplate } from 'lucide-react';
import Link from 'next/link';

import { buttonClassName } from '@/components/ui/button';

/** Props for {@link ProposalPackagesFromDesign}. */
export interface ProposalPackagesFromDesignProps {
  /** The proposal whose design holds the packages. */
  proposalId: string;
  /** An accepted proposal is frozen, so the link out is dropped rather than leading somewhere read-only. */
  canEdit: boolean;
}

/** See {@link ProposalPackagesFromDesignProps}. */
export function ProposalPackagesFromDesign({ proposalId, canEdit }: ProposalPackagesFromDesignProps) {
  return (
    <section className="space-y-2">
      <h3 className="text-section text-text">Packages</h3>
      <p className="text-body text-text-muted">
        This proposal has its own design, and its packages live on it. Editing them there keeps what the couple reads and
        what the contract charges the same.
      </p>
      {canEdit ? (
        <Link href={`/proposals/${proposalId}/design`} className={buttonClassName({ variant: 'secondary', className: 'gap-1.5' })}>
          <LayoutTemplate size={14} strokeWidth={1.5} />
          Edit design
        </Link>
      ) : null}
    </section>
  );
}
