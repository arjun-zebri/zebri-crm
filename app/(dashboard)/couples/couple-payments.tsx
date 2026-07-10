'use client'

import * as Popover from '@radix-ui/react-popover'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, PackageOpen, Receipt, Plus } from 'lucide-react'
import { useState } from 'react'

import { InvoiceBuilderModal } from '@/components/builders/invoice-builder-modal'
import { ProposalBuilderModal } from '@/components/builders/proposal-builder-modal'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'
import { isPastDue } from '@/lib/utils'

import { CoupleTabEmpty, CoupleTabShell, tabStat, type TabStat } from './couple-tab-shell'

interface CouplePaymentsProps {
  coupleId: string
  coupleName: string
}

interface Proposal {
  id: string
  proposal_number: string
  title: string
  status: string
  subtotal: number
  created_at: string
}

interface Invoice {
  id: string
  invoice_number: string
  title: string
  status: string
  subtotal: number
  due_date: string | null
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-50 text-blue-600',
  accepted: 'bg-emerald-50 text-emerald-600',
  declined: 'bg-red-50 text-red-600',
  expired: 'bg-gray-100 text-gray-500',
  paid: 'bg-emerald-50 text-emerald-600',
  overdue: 'bg-red-50 text-red-600',
  cancelled: 'bg-gray-100 text-gray-400',
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount)
}

export function CouplePayments({ coupleId, coupleName }: CouplePaymentsProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [activeProposalId, setActiveProposalId] = useState<string | null>(null)
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null)

  const { data: proposals, isLoading: isProposalsLoading } = useQuery({
    queryKey: ['couple-proposals', coupleId],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('proposals')
        .select('id, proposal_number, title, status, subtotal, created_at')
        .eq('couple_id', coupleId)
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data as Proposal[]) || []
    },
  })

  const { data: invoices, isLoading: isInvoicesLoading } = useQuery({
    queryKey: ['couple-invoices', coupleId],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, title, status, subtotal, due_date')
        .eq('couple_id', coupleId)
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data as Invoice[]) || []
    },
  })

  const createInvoice = useMutation({
    mutationFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { data: numData, error: numError } = await supabase.rpc('generate_invoice_number', {
        p_user_id: user.user.id,
      })
      if (numError) throw numError

      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 7)
      const dueDateStr = dueDate.toISOString().slice(0, 10)

      const { data, error } = await supabase
        .from('invoices')
        .insert({
          user_id: user.user.id,
          couple_id: coupleId,
          title: `Invoice for ${coupleName}`,
          invoice_number: numData as string,
          status: 'draft',
          subtotal: 0,
          due_date: dueDateStr,
        })
        .select('id')
        .single()

      if (error) throw error
      return data.id as string
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['couple-invoices', coupleId] })
      setActiveInvoiceId(id)
    },
    onError: () => toast('Failed to create invoice'),
  })

  const allProposals = proposals || []
  const allInvoices = invoices || []

  const invoicesTotal = allInvoices.reduce((sum, i) => sum + i.subtotal, 0)

  // Single centred empty only when the whole tab is empty; once any
  // section has data we fall back to the stacked two-column layout.
  const isLoading = isProposalsLoading || isInvoicesLoading
  const isEmpty =
    !isLoading && allProposals.length === 0 && allInvoices.length === 0

  // Counts + key statuses on the left; the dollar totals sit in the bottom row.
  const acceptedCount = allProposals.filter((p) => p.status === 'accepted').length
  const paidCount = allInvoices.filter((i) => i.status === 'paid').length
  const stats: TabStat[] = []
  if (allProposals.length > 0) stats.push({ label: tabStat(allProposals.length, 'proposal') })
  if (allInvoices.length > 0) stats.push({ label: tabStat(allInvoices.length, 'invoice') })
  if (acceptedCount > 0) stats.push({ label: `${acceptedCount} accepted`, tone: 'success' })
  if (paidCount > 0) stats.push({ label: `${paidCount} paid`, tone: 'success' })

  const actions = (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button size="sm" className="cursor-pointer gap-1.5">
          <Plus size={14} strokeWidth={1.5} />
          New
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={6}
          className="z-[80] w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1 text-sm"
        >
          <Popover.Close asChild>
            <button
              onClick={() => setActiveProposalId('new')}
              className="w-full flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-50 transition cursor-pointer disabled:opacity-50"
            >
              <PackageOpen size={14} strokeWidth={1.5} className="text-gray-400" />
              New proposal
            </button>
          </Popover.Close>
          <Popover.Close asChild>
            <button
              onClick={() => createInvoice.mutate()}
              disabled={createInvoice.isPending}
              className="w-full flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-50 transition cursor-pointer disabled:opacity-50"
            >
              <Receipt size={14} strokeWidth={1.5} className="text-gray-400" />
              New invoice
            </button>
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )

  return (
    <CoupleTabShell title="Payments" stats={isEmpty ? undefined : stats} actions={actions}>
      {isEmpty ? (
        <CoupleTabEmpty
          icon={Receipt}
          title="No payments yet"
          description="Create a proposal or invoice with the button above."
        />
      ) : (
      <div className="flex flex-col flex-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-16 flex-1">
          {/* Proposals + Quotes column */}
          <div>
            {(allProposals.length > 0 || isProposalsLoading) && (
              <div className="mb-8">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-900">
                  Proposals
                </h3>
                {isProposalsLoading ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {allProposals.map((proposal) => (
                      <button
                        key={proposal.id}
                        onClick={() => setActiveProposalId(proposal.id)}
                        className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 transition text-left border border-transparent hover:border-gray-100"
                      >
                        <PackageOpen size={13} strokeWidth={1.5} className="text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">{proposal.title}</p>
                          <p className="text-xs text-gray-400">{proposal.proposal_number}</p>
                        </div>
                        <span
                          className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full capitalize ${
                            STATUS_STYLES[proposal.status] || STATUS_STYLES.draft
                          }`}
                        >
                          {proposal.status}
                        </span>
                        <span className="shrink-0 text-sm text-gray-700 font-medium tabular-nums">
                          {formatCurrency(proposal.subtotal)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Invoices column */}
          <div>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-900">
              Invoices
            </h3>

            {isInvoicesLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : allInvoices.length > 0 ? (
              <div className="space-y-1">
                {allInvoices.map((invoice) => {
                  const isOverdue =
                    isPastDue(invoice.due_date) &&
                    !['paid', 'cancelled'].includes(invoice.status)
                  const dueDateFormatted = invoice.due_date
                    ? new Date(invoice.due_date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
                    : '-'

                  return (
                    <button
                      key={invoice.id}
                      onClick={() => setActiveInvoiceId(invoice.id)}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 transition text-left border border-transparent hover:border-gray-100"
                    >
                      <Receipt size={13} strokeWidth={1.5} className="text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate">{invoice.title}</p>
                        <p className="text-xs text-gray-400">{invoice.invoice_number}</p>
                      </div>
                      <span
                        className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full capitalize ${
                          STATUS_STYLES[invoice.status] || STATUS_STYLES.draft
                        }`}
                      >
                        {invoice.status}
                      </span>
                      <span className={`hidden sm:inline shrink-0 text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                        {dueDateFormatted}
                      </span>
                      <span className="shrink-0 text-sm text-gray-700 font-medium tabular-nums">
                        {formatCurrency(invoice.subtotal)}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-1">No invoices yet.</p>
            )}
          </div>
        </div>

        {/* Totals row */}
        <div className="mt-auto px-2 pt-6 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-400">Invoiced</span>
          {isInvoicesLoading ? (
            <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
          ) : (
            <span className="text-sm font-semibold text-gray-900 tabular-nums">{formatCurrency(invoicesTotal)}</span>
          )}
        </div>
      </div>
      )}

      {!!activeProposalId && (
        <ProposalBuilderModal
          proposalId={activeProposalId}
          initialCoupleId={coupleId}
          isOpen
          onClose={() => setActiveProposalId(null)}
          onDuplicated={(newId) => setActiveProposalId(newId)}
          onCreateInvoice={(invId) => {
            setActiveProposalId(null)
            setActiveInvoiceId(invId)
          }}
        />
      )}

      {!!activeInvoiceId && (
        <InvoiceBuilderModal
          invoiceId={activeInvoiceId}
          isOpen
          onClose={() => setActiveInvoiceId(null)}
        />
      )}
    </CoupleTabShell>
  )
}
