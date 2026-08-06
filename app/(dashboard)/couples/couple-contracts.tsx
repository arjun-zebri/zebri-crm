'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileSignature, Plus } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { ContractBuilderModal } from '@/components/builders/contract-builder-modal'
import { Button } from '@/components/ui/button'
import {
  contractCoupleLimit,
  STARTER_CONTRACT_COUPLE_LIMIT,
} from '@/lib/payments/subscription'
import { createClient } from '@/lib/supabase/client'

import { CoupleTabEmpty, CoupleTabShell, tabStat, type TabStat } from './couple-tab-shell'

interface Contract {
  id: string
  contract_number: string
  title: string
  status: string
  signed_at: string | null
  email_sent_at: string | null
  created_at: string
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-50 text-blue-600',
  signed: 'bg-emerald-50 text-emerald-600',
  declined: 'bg-red-50 text-red-600',
  expired: 'bg-gray-100 text-gray-500',
  revoked: 'bg-gray-100 text-gray-500',
}

interface CoupleContractsProps {
  coupleId: string
  coupleName: string
}

export function CoupleContracts({ coupleId, coupleName }: CoupleContractsProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  // `contractOpen` is separate from `activeContractId` because a new
  // draft has no id yet: null means "compose a fresh one".
  const [contractOpen, setContractOpen] = useState(false)
  const [activeContractId, setActiveContractId] = useState<string | null>(null)

  function openContract(id: string | null) {
    setActiveContractId(id)
    setContractOpen(true)
  }

  const { data: contracts, isLoading } = useQuery({
    queryKey: ['couple-contracts', coupleId],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('contracts')
        .select('id, contract_number, title, status, signed_at, email_sent_at, created_at')
        .eq('couple_id', coupleId)
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as Contract[]) || []
    },
  })

  // Starter-plan cap: max 5 distinct couples with contracts. Pro/Max
  // are uncapped. Fetch every contract.couple_id for this user and
  // count distinct values client-side; cheap (one MC has dozens of
  // contracts, not thousands) and avoids a separate count RPC. The
  // server-side enforcement (DB trigger) is a follow-up.
  const { data: limitInfo } = useQuery({
    queryKey: ['contracts-couple-limit', coupleId],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser()
      const user = userRes.user
      if (!user) throw new Error('Not authenticated')
      const limit = contractCoupleLimit(user)
      if (limit === null) {
        return { limit: null, distinctCount: 0, coupleHasContract: false }
      }
      const { data, error } = await supabase
        .from('contracts')
        .select('couple_id')
        .eq('user_id', user.id)
      if (error) throw error
      const ids = new Set<string>()
      for (const row of data ?? []) ids.add(row.couple_id as string)
      return {
        limit,
        distinctCount: ids.size,
        coupleHasContract: ids.has(coupleId),
      }
    },
  })

  const atLimit =
    !!limitInfo &&
    limitInfo.limit !== null &&
    !limitInfo.coupleHasContract &&
    limitInfo.distinctCount >= limitInfo.limit

  const all = contracts || []
  const signedCount = all.filter((c) => c.status === 'signed').length
  const sentCount = all.filter((c) => c.status === 'sent').length
  const draftCount = all.filter((c) => c.status === 'draft').length
  const stats: TabStat[] = [{ label: `${all.length} total` }]
  if (signedCount > 0) stats.push({ label: `${signedCount} signed`, tone: 'success' })
  if (sentCount > 0) stats.push({ label: `${sentCount} sent` })
  if (draftCount > 0) stats.push({ label: tabStat(draftCount, 'draft') })

  return (
    <>
      <CoupleTabShell
        title="Contracts"
        stats={all.length > 0 ? stats : undefined}
        actions={
          !atLimit ? (
            <Button size="sm" onClick={() => openContract(null)} className="cursor-pointer gap-1.5">
              <Plus size={14} strokeWidth={1.5} />
              New Contract
            </Button>
          ) : null
        }
      >
        {isLoading ? (
          <div className="space-y-2" aria-hidden="true">
            {[1, 2].map((i) => <div key={i} className="h-10 bg-gray-100 rounded-control animate-pulse" />)}
          </div>
        ) : all.length === 0 ? (
          atLimit ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400 mb-3">Free plan limit reached</p>
              <div className="text-xs text-gray-500 space-y-2">
                <p>
                  Contracts for {STARTER_CONTRACT_COUPLE_LIMIT} couples max on the free plan.
                </p>
                <Link
                  href="/settings/billing"
                  className="inline-block text-xs text-gray-700 border border-gray-200 rounded-control px-2.5 py-1 hover:bg-gray-50 transition cursor-pointer"
                >
                  Upgrade to Pro
                </Link>
              </div>
            </div>
          ) : (
            <CoupleTabEmpty
              icon={FileSignature}
              title="No contracts yet"
              description="Create a new contract with the button above."
            />
          )
        ) : (
          <div>
            <div className="space-y-1 mb-3">
              {all.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openContract(c.id)}
                  className="w-full flex items-center gap-3 px-2 py-2.5 rounded-control hover:bg-gray-50 transition text-left border border-transparent hover:border-gray-100"
                >
                  <FileSignature size={14} strokeWidth={1.5} className="text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{c.title}</p>
                    <p className="text-xs text-gray-400">{c.contract_number}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-pill capitalize ${STATUS_STYLES[c.status] || STATUS_STYLES.draft}`}>
                    {c.status}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => openContract(null)}
              className="text-sm text-gray-400 hover:text-gray-600 transition cursor-pointer px-2"
            >
              + New Contract
            </button>
          </div>
        )}
      </CoupleTabShell>

      {contractOpen && (
        <ContractBuilderModal
          contractId={activeContractId}
          initialCoupleId={coupleId}
          initialCoupleName={coupleName}
          isOpen
          onClose={() => {
            setContractOpen(false)
            setActiveContractId(null)
          }}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['couple-contracts', coupleId] })
          }}
        />
      )}
    </>
  )
}
