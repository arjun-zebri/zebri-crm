/**
 * Proposals tab on the Couple Profile: calm list + New proposal.
 *
 * Mirrors the shape of `CouplePayments` / `CoupleContracts` (shared shell,
 * button-row list, conditionally-mounted builder modal) rather than
 * reusing `ProposalsList` (`PaymentsTable`), which is tuned for the
 * full-width `/proposals` page, not a narrow tab.
 *
 * @module app/(dashboard)/couples/couple-proposals
 */
'use client'

import { useQuery } from '@tanstack/react-query'
import { FileHeart, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { PROPOSAL_STATE_PILL } from '@/app/(dashboard)/proposals/proposals-list'
import { ProposalBuilderModal } from '@/components/builders/proposal-builder-modal'
import { Button } from '@/components/ui/button'
import { StatePill } from '@/components/ui/state-pill'
import type { ProposalStatus } from '@/lib/proposals/types'
import { createClient } from '@/lib/supabase/client'

import { CoupleTabEmpty, CoupleTabShell, tabStat, type TabStat } from './couple-tab-shell'

interface Row {
  id: string
  proposal_number: string
  title: string
  status: ProposalStatus
  email_sent_at: string | null
  created_at: string
}

export interface CoupleProposalsProps {
  coupleId: string
  coupleName: string
}

/** See {@link CoupleProposalsProps}. */
export function CoupleProposals({ coupleId, coupleName }: CoupleProposalsProps) {
  const supabase = createClient()
  const router = useRouter()
  const [newOpen, setNewOpen] = useState(false)
  // Tracks the id a fresh "New Proposal" save has actually landed under, so
  // the modal keeps pointing at that row (not a phantom `null`) for the
  // rest of the session instead of looking half-created after Save/Send.
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['couple-proposals', coupleId],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('proposals')
        .select('id, proposal_number, title, status, email_sent_at, created_at')
        .eq('couple_id', coupleId)
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as Row[]) || []
    },
  })

  const all = data || []
  const stats: TabStat[] = [{ label: `${all.length} total` }]
  const accepted = all.filter((p) => p.status === 'accepted').length
  const sent = all.filter((p) => p.status === 'sent' || p.status === 'viewed').length
  const drafts = all.filter((p) => p.status === 'draft').length
  if (accepted > 0) stats.push({ label: `${accepted} accepted`, tone: 'success' })
  if (sent > 0) stats.push({ label: `${sent} sent` })
  if (drafts > 0) stats.push({ label: tabStat(drafts, 'draft') })

  return (
    <>
      <CoupleTabShell
        title="Proposals"
        stats={all.length > 0 ? stats : undefined}
        actions={
          <Button onClick={() => setNewOpen(true)} className="gap-1.5">
            <Plus size={14} strokeWidth={1.5} />
            New Proposal
          </Button>
        }
      >
        {isLoading ? (
          <div className="space-y-2" aria-hidden="true">
            {[1, 2].map((i) => <div key={i} className="h-10 bg-surface-emphasis rounded-control animate-pulse" />)}
          </div>
        ) : all.length === 0 ? (
          <CoupleTabEmpty icon={FileHeart} title="No proposals yet" description="Send this couple a proposal with the button above." />
        ) : (
          <div className="space-y-1">
            {all.map((p) => (
              <button
                key={p.id}
                onClick={() => router.push(`/proposals/${p.id}`)}
                className="w-full flex items-center gap-3 px-2 py-2.5 rounded-control hover:bg-surface-muted transition text-left border border-transparent hover:border-border"
              >
                <FileHeart size={14} strokeWidth={1.5} className="text-text-subtle shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-body text-text truncate">{p.title || 'Untitled proposal'}</p>
                  <p className="text-body text-text-subtle">{p.proposal_number}</p>
                </div>
                <StatePill {...PROPOSAL_STATE_PILL[p.status]} />
              </button>
            ))}
          </div>
        )}
      </CoupleTabShell>

      {newOpen && (
        <ProposalBuilderModal
          proposalId={editingId}
          initialCoupleId={coupleId}
          initialCoupleName={coupleName}
          isOpen
          onClose={() => { setNewOpen(false); setEditingId(null); void refetch() }}
          onSaved={(id) => { setEditingId(id); void refetch() }}
        />
      )}
    </>
  )
}
