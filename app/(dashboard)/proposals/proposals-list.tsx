/**
 * Rows for a list of proposals, rendered through the shared PaymentsTable
 * so proposals, invoices, and contracts read as one family. `/proposals`
 * itself no longer shows this (2026-09-19 feedback: templates + basic
 * stats only, see `page.tsx`'s module doc) - the remaining caller is a
 * couple's own Proposals tab (`couple-proposals.tsx`).
 *
 * @module app/(dashboard)/proposals/proposals-list
 */
'use client';

import { Calendar, DollarSign, Eye, FileHeart, Plus } from 'lucide-react';

import { PaymentsTable } from '@/app/(dashboard)/payments/payments-table';
import { Button } from '@/components/ui/button';
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
  /** Opens the proposal builder, for the empty state's own "New proposal" button. */
  onNew: () => void;
}

/** The table body reused wherever a list of proposals needs to render (`/proposals` was the other caller until 2026-09-19 feedback removed the per-proposal list there; a couple's own Proposals tab, `couple-proposals.tsx`, is the remaining one). */
export function ProposalsList({ loading, proposals, searching, onOpen, onNew }: ProposalsListProps) {
  return (
    <PaymentsTable
      loading={loading}
      rows={proposals}
      emptyIcon={<FileHeart size={32} strokeWidth={1} className="text-text-subtle mx-auto mb-3" />}
      emptyMessage={searching ? 'No proposals match your search.' : 'No proposals yet.'}
      emptyAction={
        // A real button, not a message naming a specific header control:
        // the header's own button label can change independently of this
        // copy (it already has, from "New proposal" to a "New" split
        // button) without this going stale.
        searching ? undefined : (
          <Button onClick={onNew} className="gap-1.5">
            <Plus size={16} strokeWidth={1.5} />
            New proposal
          </Button>
        )
      }
      valueColLabel="Total"
      valueColIcon={<DollarSign size={12} strokeWidth={1.5} />}
      lastColLabel="Expires"
      lastColIcon={<Calendar size={12} strokeWidth={1.5} />}
      renderRow={(p) => {
        const pill = <StatePill {...PROPOSAL_STATE_PILL[p.status]} />;
        // 0 views renders nothing, matching the app's existing "0 = don't
        // show a badge" convention (dashboard-stats.tsx's StatBadge).
        const views = p.view_count > 0 && (
          <span className="inline-flex items-center gap-1 text-body text-text-muted">
            <Eye size={12} strokeWidth={1.5} aria-hidden="true" />
            {p.view_count}
          </span>
        );
        const secondary = [
          p.last_viewed_at ? `Viewed ${shortDate(p.last_viewed_at)}` : null,
          p.view_count > 0 ? `${p.view_count} view${p.view_count === 1 ? '' : 's'}` : null,
        ]
          .filter(Boolean)
          .join(' · ');
        return {
          key: p.id,
          onClick: () => onOpen(p.id),
          number: p.proposal_number,
          title: p.title,
          coupleName: p.couple.name,
          statusPill: views ? (
            <div className="flex items-center gap-1.5">
              {pill}
              {views}
            </div>
          ) : (
            pill
          ),
          valueCell: <span className="text-body text-text-muted group-hover:text-text">{money(headlineTotal(p))}</span>,
          lastCell: <span className="text-body text-text-muted group-hover:text-text">{shortDate(p.expires_at)}</span>,
          mobileValueRight: <span className="text-body text-text">{money(headlineTotal(p))}</span>,
          mobileStatus: pill,
          mobileSecondary: secondary || null,
        };
      }}
    />
  );
}
