'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FileText, Receipt, Plus } from 'lucide-react'
import { QuoteBuilderModal } from '../quotes/quote-builder-modal'
import { InvoiceBuilderModal } from '../invoices/invoice-builder-modal'

interface CouplePaymentsProps {
  coupleId: string
  coupleName: string
}

interface Quote {
  id: string
  quote_number: string
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

  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null)
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null)
  const [deleteQuoteId, setDeleteQuoteId] = useState<string | null>(null)
  const [deleteInvoiceId, setDeleteInvoiceId] = useState<string | null>(null)

  const { data: quotes, isLoading: isQuotesLoading } = useQuery({
    queryKey: ['couple-quotes', coupleId],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('quotes')
        .select('id, quote_number, title, status, subtotal, created_at')
        .eq('couple_id', coupleId)
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data as Quote[]) || []
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

  const createQuote = useMutation({
    mutationFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { data: numData, error: numError } = await supabase.rpc('generate_quote_number', {
        p_user_id: user.user.id,
      })
      if (numError) throw numError

      const { data, error } = await supabase
        .from('quotes')
        .insert({
          user_id: user.user.id,
          couple_id: coupleId,
          title: `Quote for ${coupleName}`,
          quote_number: numData as string,
          status: 'draft',
          subtotal: 0,
        })
        .select('id')
        .single()

      if (error) throw error
      return data.id as string
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['couple-quotes', coupleId] })
      setActiveQuoteId(id)
    },
    onError: () => toast('Failed to create quote'),
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
      const dueDateStr = dueDate.toISOString().split('T')[0]

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

  const deleteQuote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('quotes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couple-quotes', coupleId] })
      setDeleteQuoteId(null)
      setActiveQuoteId(null)
      toast('Quote deleted')
    },
    onError: () => toast('Failed to delete quote'),
  })

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invoices').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couple-invoices', coupleId] })
      setDeleteInvoiceId(null)
      setActiveInvoiceId(null)
      toast('Invoice deleted')
    },
    onError: () => toast('Failed to delete invoice'),
  })

  const isLoading = isQuotesLoading || isInvoicesLoading
  const allQuotes = quotes || []
  const allInvoices = invoices || []

  const quotesTotal = allQuotes.reduce((sum, q) => sum + q.subtotal, 0)
  const invoicesTotal = allInvoices.reduce((sum, i) => sum + i.subtotal, 0)

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-16">
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col flex-1">
        <div className="grid grid-cols-2 gap-16 flex-1">
          {/* Quotes column */}
          <div>
            <button
              onClick={() => createQuote.mutate()}
              disabled={createQuote.isPending}
              className="group flex items-center gap-1.5 mb-4 cursor-pointer disabled:opacity-50"
            >
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 group-hover:text-gray-600 transition">
                Quotes
              </h3>
              <Plus size={12} strokeWidth={2} className="text-gray-900 group-hover:text-gray-600 transition" />
            </button>

            {allQuotes.length > 0 ? (
              <div className="space-y-1">
                {allQuotes.map((quote) => (
                  <button
                    key={quote.id}
                    onClick={() => setActiveQuoteId(quote.id)}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 transition text-left border border-transparent hover:border-gray-100"
                  >
                    <FileText size={13} strokeWidth={1.5} className="text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">{quote.title}</p>
                      <p className="text-xs text-gray-400">{quote.quote_number}</p>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full capitalize ${
                        STATUS_STYLES[quote.status] || STATUS_STYLES.draft
                      }`}
                    >
                      {quote.status}
                    </span>
                    <span className="shrink-0 text-sm text-gray-700 font-medium tabular-nums">
                      {formatCurrency(quote.subtotal)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-300 py-1">No quotes yet</p>
            )}
          </div>

          {/* Invoices column */}
          <div>
            <button
              onClick={() => createInvoice.mutate()}
              disabled={createInvoice.isPending}
              className="group flex items-center gap-1.5 mb-4 cursor-pointer disabled:opacity-50"
            >
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 group-hover:text-gray-600 transition">
                Invoices
              </h3>
              <Plus size={12} strokeWidth={2} className="text-gray-900 group-hover:text-gray-600 transition" />
            </button>

            {allInvoices.length > 0 ? (
              <div className="space-y-1">
                {allInvoices.map((invoice) => {
                  const isOverdue =
                    invoice.due_date &&
                    new Date(invoice.due_date + 'T00:00:00') < new Date() &&
                    !['paid', 'cancelled'].includes(invoice.status)
                  const dueDateFormatted = invoice.due_date
                    ? new Date(invoice.due_date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
                    : '—'

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
                      <span className={`shrink-0 text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
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
              <p className="text-sm text-gray-300 py-1">No invoices yet</p>
            )}
          </div>
        </div>

        {/* Totals row */}
        <div className="mt-auto grid grid-cols-2 gap-16">
          <div className="flex items-center justify-between px-2 pt-6 border-t border-gray-100">
            <span className="text-xs text-gray-400">Quoted</span>
            <span className="text-sm font-semibold text-gray-900 tabular-nums">{formatCurrency(quotesTotal)}</span>
          </div>
          <div className="flex items-center justify-between px-2 pt-6 border-t border-gray-100">
            <span className="text-xs text-gray-400">Invoiced</span>
            <span className="text-sm font-semibold text-gray-900 tabular-nums">{formatCurrency(invoicesTotal)}</span>
          </div>
        </div>
      </div>

      {!!activeQuoteId && (
        <QuoteBuilderModal
          quoteId={activeQuoteId}
          initialCoupleId={coupleId}
          isOpen
          onClose={() => setActiveQuoteId(null)}
          onCreateInvoice={(invId) => {
            setActiveQuoteId(null)
            setActiveInvoiceId(invId)
          }}
          onDelete={() => setDeleteQuoteId(activeQuoteId)}
        />
      )}

      {!!activeInvoiceId && (
        <InvoiceBuilderModal
          invoiceId={activeInvoiceId}
          isOpen
          onClose={() => setActiveInvoiceId(null)}
          onDelete={() => setDeleteInvoiceId(activeInvoiceId)}
        />
      )}

      <ConfirmDialog
        open={!!deleteQuoteId}
        title="Delete Quote"
        description="Are you sure you want to delete this quote? This cannot be undone."
        onConfirm={() => deleteQuoteId && deleteQuote.mutate(deleteQuoteId)}
        onCancel={() => setDeleteQuoteId(null)}
        loading={deleteQuote.isPending}
      />

      <ConfirmDialog
        open={!!deleteInvoiceId}
        title="Delete Invoice"
        description="Are you sure you want to delete this invoice? This cannot be undone."
        onConfirm={() => deleteInvoiceId && deleteInvoice.mutate(deleteInvoiceId)}
        onCancel={() => setDeleteInvoiceId(null)}
        loading={deleteInvoice.isPending}
      />
    </>
  )
}
