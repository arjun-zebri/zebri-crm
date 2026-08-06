'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Receipt, Plus } from 'lucide-react'
import { useState } from 'react'

import { InvoiceBuilderModal } from '@/components/builders/invoice-builder-modal'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'
import { isPastDue } from '@/lib/utils'

import { CoupleTabEmpty, CoupleTabShell, tabStat, type TabStat } from './couple-tab-shell'

interface CouplePaymentsProps {
  coupleId: string
  coupleName: string
}

interface Invoice {
  id: string
  invoice_number: string
  title: string
  status: string
  subtotal: number
  due_date: string | null
  invoice_payment_stages: { amount_cents: number; paid_at: string | null }[]
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-50 text-blue-600',
  deposit_paid: 'bg-amber-50 text-amber-600',
  paid: 'bg-emerald-50 text-emerald-600',
  overdue: 'bg-red-50 text-red-600',
  cancelled: 'bg-gray-100 text-gray-400',
}

/** Human-readable label for a stored invoice status (no raw `deposit_paid`). */
const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  deposit_paid: 'Part paid',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount)
}

/**
 * Payments tab for a couple profile: their invoices, newest first, with a
 * running invoiced total. Invoices are created manually here or from the
 * invoice builder; nothing is generated automatically.
 */
export function CouplePayments({ coupleId, coupleName }: CouplePaymentsProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null)

  const { data: invoices, isLoading: isInvoicesLoading } = useQuery({
    queryKey: ['couple-invoices', coupleId],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, title, status, subtotal, due_date, invoice_payment_stages(amount_cents, paid_at)')
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

  const allInvoices = invoices || []
  const invoicesTotal = allInvoices.reduce((sum, i) => sum + i.subtotal, 0)

  const isEmpty = !isInvoicesLoading && allInvoices.length === 0

  const paidCount = allInvoices.filter((i) => i.status === 'paid').length
  const stats: TabStat[] = []
  if (allInvoices.length > 0) stats.push({ label: tabStat(allInvoices.length, 'invoice') })
  if (paidCount > 0) stats.push({ label: `${paidCount} paid`, tone: 'success' })

  const actions = (
    <Button
      size="sm"
      className="cursor-pointer gap-1.5"
      onClick={() => createInvoice.mutate()}
      disabled={createInvoice.isPending}
    >
      <Plus size={14} strokeWidth={1.5} />
      New invoice
    </Button>
  )

  return (
    <CoupleTabShell title="Payments" stats={isEmpty ? undefined : stats} actions={actions}>
      {isEmpty ? (
        <CoupleTabEmpty
          icon={Receipt}
          title="No invoices yet"
          description="Create an invoice with the button above."
        />
      ) : (
        <div className="flex flex-col flex-1">
          {isInvoicesLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-control animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {allInvoices.map((invoice) => {
                const isOverdue =
                  isPastDue(invoice.due_date) && !['paid', 'cancelled'].includes(invoice.status)
                const dueDateFormatted = invoice.due_date
                  ? new Date(invoice.due_date + 'T00:00:00').toLocaleDateString('en-AU', {
                      day: 'numeric',
                      month: 'short',
                    })
                  : '-'

                // Collected so far, from the paid schedule stages.
                const paidAmount =
                  invoice.invoice_payment_stages
                    .filter((s) => s.paid_at !== null)
                    .reduce((sum, s) => sum + s.amount_cents, 0) / 100
                // Show the running total only while a schedule is part-paid — a
                // fully-paid or single-payment invoice reads clearly from the pill.
                const showProgress = paidAmount > 0 && invoice.status !== 'paid'

                return (
                  <button
                    key={invoice.id}
                    onClick={() => setActiveInvoiceId(invoice.id)}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-control hover:bg-gray-50 transition text-left border border-transparent hover:border-gray-100"
                  >
                    <Receipt size={13} strokeWidth={1.5} className="text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">{invoice.title}</p>
                      <p className="text-xs text-gray-400">
                        {invoice.invoice_number}
                        {showProgress && (
                          <span className="text-emerald-600">
                            {' · '}
                            {formatCurrency(paidAmount)} paid
                          </span>
                        )}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-pill ${
                        STATUS_STYLES[invoice.status] || STATUS_STYLES.draft
                      }`}
                    >
                      {STATUS_LABELS[invoice.status] ?? invoice.status}
                    </span>
                    <span
                      className={`hidden sm:inline shrink-0 text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}
                    >
                      {dueDateFormatted}
                    </span>
                    <span className="shrink-0 text-sm text-gray-700 font-medium tabular-nums">
                      {formatCurrency(invoice.subtotal)}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Totals row */}
          <div className="mt-auto px-2 pt-6 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">Invoiced</span>
            {isInvoicesLoading ? (
              <div className="h-4 w-16 bg-gray-100 rounded-control animate-pulse" />
            ) : (
              <span className="text-sm font-semibold text-gray-900 tabular-nums">
                {formatCurrency(invoicesTotal)}
              </span>
            )}
          </div>
        </div>
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
