/**
 * Rows for the /proposals list, rendered through the shared PaymentsTable
 * so proposals, invoices, and contracts read as one family.
 *
 * @module app/(dashboard)/proposals/proposals-list
 */
'use client';

import { Calendar, DollarSign, FileHeart } from 'lucide-react';

import { PaymentsTable } from '@/app/(dashboard)/payments/payments-table';
import { StatePill, type StatePillProps } from '@/components/ui/state-pill';
import type { ProposalStatus } from '@/lib/proposals/types';

import type { ProposalListRow } from './use-proposals';

export type { ProposalListRow } from './use-proposals';

export const PROPOSAL_STATE_PILL: Record<ProposalStatus, StatePillProps> = {
  draft: { label: 'Draft', tone: 'neutral' },
  sent: { label: 'Sent', tone: 'info', dot: 'hollow' },
  viewed: { label: 'Viewed', tone: 'info', dot: 'filled' },
  accepted: { label: 'Accepted', tone: 'success', dot: 'filled' },
  declined: { label: 'Declined', tone: 'danger' },
  expired: { label: 'Expired', tone: 'neutral' },
};

/** The figure the list shows: the popular option, else the first, else 0. */
export function headlineTotal(row: ProposalListRow): number {
  const sorted = [...row.proposal_options].sort((a, b) => a.position - b.position);
  const pick = sorted.find((o) => o.is_popular) ?? sorted[0];
  return pick ? Number(pick.subtotal) : 0;
}

const money = (n: number) => `$${n.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : ' - ';

export interface ProposalsListProps {
  loading: boolean;
  proposals: ProposalListRow[];
  searching: boolean;
  onOpen: (id: string) => void;
}

/** The /proposals table body. See {@link ProposalsListProps}. */
export function ProposalsList({ loading, proposals, searching, onOpen }: ProposalsListProps) {
  return (
    <PaymentsTable
      loading={loading}
      rows={proposals}
      emptyIcon={<FileHeart size={32} strokeWidth={1} className="text-text-subtle mx-auto mb-3" />}
      emptyMessage={
        searching ? 'No proposals match your search.' : 'No proposals yet. Create one with the + New button.'
      }
      valueColLabel="Total"
      valueColIcon={<DollarSign size={12} strokeWidth={1.5} />}
      lastColLabel="Expires"
      lastColIcon={<Calendar size={12} strokeWidth={1.5} />}
      renderRow={(p) => {
        const pill = <StatePill {...PROPOSAL_STATE_PILL[p.status]} />;
        return {
          key: p.id,
          onClick: () => onOpen(p.id),
          number: p.proposal_number,
          title: p.title,
          coupleName: p.couple.name,
          statusPill: pill,
          valueCell: <span className="text-body text-text-muted group-hover:text-text">{money(headlineTotal(p))}</span>,
          lastCell: <span className="text-body text-text-muted group-hover:text-text">{shortDate(p.expires_at)}</span>,
          mobileValueRight: <span className="text-body text-text">{money(headlineTotal(p))}</span>,
          mobileStatus: pill,
          mobileSecondary: p.last_viewed_at ? `Viewed ${shortDate(p.last_viewed_at)}` : null,
        };
      }}
    />
  );
}
