/**
 * /proposals/[id]. Orchestrator: load, render detail, open the builder.
 *
 * @module app/(dashboard)/proposals/[id]/page
 */
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { ProposalBuilderModal } from '@/components/builders/proposal-builder-modal';
import { Empty } from '@/components/ui/empty';
import { ErrorState } from '@/components/ui/error-state';
import { Loading } from '@/components/ui/loading';

import { ProposalsFrame } from '../proposals-frame';
import { useProposal } from '../use-proposals';

import { ProposalDetail } from './proposal-detail';

export default function ProposalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const { data, isLoading, error, refetch } = useProposal(id);

  if (isLoading) return <ProposalsFrame><Loading label="Loading proposal" /></ProposalsFrame>;
  if (error) return <ProposalsFrame><ErrorState title="Could not load this proposal" error={error} onRetry={() => void refetch()} /></ProposalsFrame>;
  if (!data) return <ProposalsFrame><Empty title="Proposal not found" description="It may have been deleted." /></ProposalsFrame>;

  return (
    <ProposalsFrame>
      <ProposalDetail proposal={data} onEdit={() => setEditOpen(true)} onChanged={() => void refetch()} />
      {editOpen ? (
        <ProposalBuilderModal
          proposalId={data.id}
          isOpen
          onClose={() => { setEditOpen(false); void refetch(); }}
          onDeleted={() => router.push('/proposals')}
        />
      ) : null}
    </ProposalsFrame>
  );
}
