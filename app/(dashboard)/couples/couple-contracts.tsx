'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileSignature } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { ContractBuilderModal } from '../contracts/contract-builder-modal'

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

const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] }

export function CoupleContracts({ coupleId, coupleName }: CoupleContractsProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [activeContractId, setActiveContractId] = useState<string | null>(null)

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

  const createContract = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not authenticated')
      const { data: num, error: numError } = await supabase.rpc('generate_contract_number', {
        p_user_id: user.user.id,
      })
      if (numError) throw numError
      const { data, error } = await supabase
        .from('contracts')
        .insert({
          user_id: user.user.id,
          couple_id: coupleId,
          title: `Contract for ${coupleName}`,
          contract_number: num as string,
          status: 'draft',
          content: EMPTY_DOC,
        })
        .select('id')
        .single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['couple-contracts', coupleId] })
      setActiveContractId(id)
    },
    onError: () => toast('Failed to create contract', 'error'),
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
      </div>
    )
  }

  const all = contracts || []

  return (
    <>
      <div>
        {all.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400 mb-3">No contracts yet.</p>
            <button
              onClick={() => createContract.mutate()}
              disabled={createContract.isPending}
              className="text-xs text-gray-500 border border-gray-200 rounded-xl px-2.5 py-1 hover:bg-gray-50 transition cursor-pointer disabled:opacity-50"
            >
              {createContract.isPending ? 'Creating…' : '+ New Contract'}
            </button>
          </div>
        ) : (
          <div>
            <div className="space-y-1 mb-3">
              {all.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveContractId(c.id)}
                  className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-gray-50 transition text-left border border-transparent hover:border-gray-100"
                >
                  <FileSignature size={14} strokeWidth={1.5} className="text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{c.title}</p>
                    <p className="text-xs text-gray-400">{c.contract_number}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[c.status] || STATUS_STYLES.draft}`}>
                    {c.status}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => createContract.mutate()}
              disabled={createContract.isPending}
              className="text-sm text-gray-400 hover:text-gray-600 transition cursor-pointer disabled:opacity-50"
            >
              {createContract.isPending ? 'Creating…' : '+ New Contract'}
            </button>
          </div>
        )}
      </div>

      {!!activeContractId && (
        <ContractBuilderModal
          contractId={activeContractId}
          coupleId={coupleId}
          coupleName={coupleName}
          isOpen
          onClose={() => setActiveContractId(null)}
        />
      )}
    </>
  )
}
