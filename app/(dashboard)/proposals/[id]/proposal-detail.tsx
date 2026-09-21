/**
 * Detail body for one proposal: header facts, options summary, links to
 * the generated contract and invoice (Phase C), decline note, actions.
 * Engagement summary and timeline mount here in Phase D.
 *
 * @module app/(dashboard)/proposals/[id]/proposal-detail
 */
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Pencil, RotateCcw } from 'lucide-react';
import Link from 'next/link';

import { revertProposalToDraftAction } from '@/app/(dashboard)/proposals/actions';
import { headlineTotal, PROPOSAL_STATE_PILL } from '@/app/(dashboard)/proposals/proposals-list';
import { PROPOSALS_QUERY_KEY, type ProposalDetailRow } from '@/app/(dashboard)/proposals/use-proposals';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { PageHeader } from '@/components/ui/page-header';
import { StatePill } from '@/components/ui/state-pill';
import { useToast } from '@/components/ui/toast';

import { ProposalEngagement } from './proposal-engagement';
import { ProposalOptionsSummary } from './proposal-options-summary';
import { ProposalPdfButton } from './proposal-pdf-button';

const longDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

// Kept as a plain lookup rather than importing the builder's decline-picker
// options: the detail page only ever renders the label, never edits it.
const DECLINE_REASONS: Record<string, string> = {
  price: 'Price', date: 'Date no longer works', other_vendor: 'Went with someone else', other: 'Other',
};

export interface ProposalDetailProps {
  /** Full detail row from {@link useProposal}. */
  proposal: ProposalDetailRow;
  /** Opens the builder modal in edit mode. */
  onEdit: () => void;
  /** Called after a mutation (e.g. revert) so the caller can refetch. */
  onChanged: () => void;
}

/** See {@link ProposalDetailProps}. */
export function ProposalDetail({ proposal: p, onEdit, onChanged }: ProposalDetailProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const facts = [
    p.email_sent_at ? `Sent ${longDate(p.email_sent_at)}` : 'Not sent',
    `${p.view_count} views`,
    p.last_viewed_at ? `Last viewed ${longDate(p.last_viewed_at)}` : null,
    p.expires_at ? `Expires ${longDate(p.expires_at)}` : null,
    `Version ${p.version}`,
  ].filter(Boolean);

  // Mirrors the invalidation set in `useProposalForm`'s own revert path so
  // every surface that can change a proposal's status (the builder modal,
  // and this page) agrees on which caches go stale: the /proposals list,
  // the builder's own detail query (keyed separately, see `useProposal`),
  // and the couple-profile tab's list.
  const revert = useMutation({
    mutationFn: () => revertProposalToDraftAction(p.id),
    onSuccess: (r) => {
      if (!r.ok) {
        toast(r.error, 'error');
        return;
      }
      void queryClient.invalidateQueries({ queryKey: PROPOSALS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['proposal', p.id] });
      void queryClient.invalidateQueries({ queryKey: ['couple-proposals', p.couple.id] });
      toast('Reverted to draft', 'success');
      onChanged();
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={p.title || 'Untitled proposal'}
        meta={
          <span className="flex items-center gap-2">
            <span className="text-body text-text-muted">{p.proposal_number}</span>
            <StatePill {...PROPOSAL_STATE_PILL[p.status]} />
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <ProposalPdfButton proposalId={p.id} />
            {p.share_token_enabled ? (
              <CopyButton
                value={() => `${window.location.origin}/proposal/${p.share_token}`}
                label="Copy link"
                copiedLabel="Link copied"
              />
            ) : null}
            {p.share_token_enabled ? (
              <Button
                variant="secondary"
                onClick={() => window.open(`${window.location.origin}/proposal/${p.share_token}`, '_blank')}
                className="gap-1.5"
              >
                <ExternalLink size={14} strokeWidth={1.5} /> Open
              </Button>
            ) : null}
            {p.status !== 'draft' && p.status !== 'accepted' ? (
              <Button variant="secondary" onClick={() => revert.mutate()} loading={revert.isPending} className="gap-1.5">
                <RotateCcw size={14} strokeWidth={1.5} /> Revert to draft
              </Button>
            ) : null}
            {p.status !== 'accepted' ? (
              <Button onClick={onEdit} className="gap-1.5">
                <Pencil size={14} strokeWidth={1.5} /> Edit
              </Button>
            ) : null}
          </div>
        }
      />
      <p className="text-body text-text-muted">
        <Link href={`/couples?openCouple=${p.couple.id}`} className="text-text hover:underline">{p.couple.name}</Link>
        {' · '}{facts.join(' · ')}
      </p>

      <ProposalEngagement proposal={p} />

      {p.status === 'declined' ? (
        <div className="rounded-control border border-border bg-surface-muted p-4 space-y-1">
          <p className="text-body font-medium text-text">Declined{p.declined_reason ? `: ${DECLINE_REASONS[p.declined_reason] ?? p.declined_reason}` : ''}</p>
          {p.declined_message ? <p className="text-body text-text-muted">{p.declined_message}</p> : null}
        </div>
      ) : null}

      <ProposalOptionsSummary options={p.proposal_options} headline={headlineTotal(p)} />

      {p.contract_id || p.invoice_id ? (
        // Both land on the plain /payments list, not a specific record: the
        // page doesn't read a `tab` (or any record-scoped) query param today.
        // Deep-linking straight to the generated contract/invoice lands with
        // Phase C, which is what first populates `contract_id`/`invoice_id`.
        <section className="flex gap-3 text-body">
          {p.contract_id ? <Link href="/payments" className="text-text hover:underline">View contract</Link> : null}
          {p.invoice_id ? <Link href="/payments" className="text-text hover:underline">View invoice</Link> : null}
        </section>
      ) : null}
    </div>
  );
}
