/**
 * /proposals list. Orchestrator: search state + open builder + navigate
 * to detail. Rows and the header are co-located components.
 *
 * @module app/(dashboard)/proposals/page
 */
'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';

import { ProposalBuilderModal } from '@/components/builders/proposal-builder-modal';
import { ErrorState } from '@/components/ui/error-state';

import { ProposalsFrame } from './proposals-frame';
import { ProposalsHeader } from './proposals-header';
import { ProposalsList } from './proposals-list';
import { useProposals } from './use-proposals';

export default function ProposalsPage() {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const { data, isLoading, error, refetch } = useProposals();

  const filtered = useMemo(() => {
    const rows = data ?? [];
    if (!search) return rows;
    const s = search.toLowerCase();
    return rows.filter(
      (p) =>
        p.title.toLowerCase().includes(s) ||
        p.proposal_number.toLowerCase().includes(s) ||
        p.couple.name.toLowerCase().includes(s) ||
        p.status.includes(s),
    );
  }, [data, search]);

  return (
    <ProposalsFrame>
      <div className="space-y-6">
        <ProposalsHeader
          count={data?.length ?? 0}
          search={search}
          onSearchChange={setSearch}
          searchInputRef={searchInputRef}
          onNew={() => setNewOpen(true)}
        />
        {error ? (
          <ErrorState title="Could not load proposals" error={error} onRetry={() => void refetch()} />
        ) : (
          <ProposalsList
            loading={isLoading}
            proposals={filtered}
            searching={search.length > 0}
            onOpen={(id) => router.push(`/proposals/${id}`)}
          />
        )}
        {newOpen ? (
          <ProposalBuilderModal
            proposalId={null}
            isOpen
            onClose={() => setNewOpen(false)}
            onSaved={(id) => {
              setNewOpen(false);
              router.push(`/proposals/${id}`);
            }}
          />
        ) : null}
      </div>
    </ProposalsFrame>
  );
}
