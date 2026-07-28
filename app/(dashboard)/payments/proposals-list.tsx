/**
 * Proposals tab content for the /payments page.
 *
 * Renders the shared {@link PaymentsTable} with proposal-specific row
 * cells (primary-option subtotal, created date, status pill). The
 * pill derives "expired" for display when a sent proposal is past its
 * expiry — the DB keeps `sent` so a late acceptance stays possible if
 * the MC extends the date.
 *
 * @module app/(dashboard)/payments/proposals-list
 */
'use client';

import { PackageOpen } from 'lucide-react';
import type { ReactNode } from 'react';

import { formatCurrency, PaymentsTable, PaymentsTableIcons } from './payments-table';
import type { Proposal } from './use-payments-data';

const PROPOSAL_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-50 text-blue-600',
  accepted: 'bg-emerald-50 text-emerald-600',
  declined: 'bg-red-50 text-red-600',
  expired: 'bg-gray-100 text-gray-500',
};

/** Display status: sent + past expiry reads as expired. */
export function displayStatus(proposal: Proposal): string {
  if (
    proposal.status === 'sent' &&
    proposal.expires_at &&
    proposal.expires_at < new Date().toISOString().slice(0, 10)
  ) {
    return 'expired';
  }
  return proposal.status;
}

function statusPill(status: string, noWrap = false): ReactNode {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${noWrap ? 'whitespace-nowrap ' : ''}${PROPOSAL_STATUS_STYLES[status] || PROPOSAL_STATUS_STYLES.draft}`}
    >
      {status}
    </span>
  );
}

export interface ProposalsListProps {
  loading: boolean;
  proposals: Proposal[];
  searching: boolean;
  onOpen: (proposalId: string) => void;
}

export function ProposalsList({ loading, proposals, searching, onOpen }: ProposalsListProps) {
  return (
    <PaymentsTable
      loading={loading}
      rows={proposals}
      emptyIcon={<PackageOpen size={32} strokeWidth={1} className="text-gray-200 mx-auto mb-3" />}
      emptyMessage={
        searching
          ? 'No proposals match your search.'
          : 'No proposals yet. Offer a couple your packages to get started.'
      }
      lastColLabel="Date"
      lastColIcon={PaymentsTableIcons.Calendar}
      valueColLabel="Total"
      valueColIcon={PaymentsTableIcons.Dollar}
      renderRow={(proposal) => ({
        key: proposal.id,
        onClick: () => onOpen(proposal.id),
        number: proposal.proposal_number,
        title: proposal.title,
        coupleName: proposal.couple.name,
        statusPill: statusPill(displayStatus(proposal)),
        valueCell: (
          <span className="text-sm text-gray-500 group-hover:text-gray-900 tabular-nums">
            {formatCurrency(proposal.subtotal)}
          </span>
        ),
        lastCell: (
          <span className="text-sm text-gray-500 group-hover:text-gray-900">
            {new Date(proposal.created_at).toLocaleDateString('en-AU', {
              day: 'numeric',
              month: 'short',
            })}
          </span>
        ),
        mobileValueRight: (
          <span className="text-sm font-medium text-gray-900 tabular-nums shrink-0">
            {formatCurrency(proposal.subtotal)}
          </span>
        ),
        mobileStatus: statusPill(displayStatus(proposal), true),
        mobileSecondary: null,
      })}
    />
  );
}
