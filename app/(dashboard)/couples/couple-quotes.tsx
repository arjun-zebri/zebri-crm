'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { FileText } from 'lucide-react'
import { QuoteBuilderModal } from '../quotes/quote-builder-modal'
import { InvoiceBuilderModal } from '../invoices/invoice-builder-modal'

interface CoupleQuotesProps {
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

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-50 text-blue-600',
  accepted: 'bg-emerald-50 text-emerald-600',
  declined: 'bg-red-50 text-red-600',
  expired: 'bg-gray-100 text-gray-500',
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount)
}

export function CoupleQuotes({ coupleId, coupleName }: CoupleQuotesProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null)
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null)

  const { data: quotes, isLoading } = useQuery({
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

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  const allQuotes = quotes || []

  return (
    <>
      <div>
        {allQuotes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400 mb-3">No quotes yet.</p>
            <button
              onClick={() => createQuote.mutate()}
              disabled={createQuote.isPending}
              className="text-xs text-gray-500 border border-gray-200 rounded-xl px-2.5 py-1 hover:bg-gray-50 transition cursor-pointer disabled:opacity-50"
            >
              {createQuote.isPending ? 'Creating...' : '+ New Quote'}
            </button>
          </div>
        ) : (
          <div>
            <div className="space-y-1 mb-3">
              {allQuotes.map((quote) => (
                <button
                  key={quote.id}
                  onClick={() => setActiveQuoteId(quote.id)}
                  className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-gray-50 transition text-left border border-transparent hover:border-gray-100"
                >
                  <FileText size={14} strokeWidth={1.5} className="text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{quote.title}</p>
                    <p className="text-xs text-gray-400">{quote.quote_number}</p>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
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
            <button
              onClick={() => createQuote.mutate()}
              disabled={createQuote.isPending}
              className="text-sm text-gray-400 hover:text-gray-600 transition cursor-pointer disabled:opacity-50"
            >
              {createQuote.isPending ? 'Creating...' : '+ New Quote'}
            </button>
          </div>
        )}
      </div>

      {!!activeQuoteId && (
        <QuoteBuilderModal
          quoteId={activeQuoteId}
          isOpen
          onClose={() => setActiveQuoteId(null)}
          onCreateInvoice={(invId) => {
            setActiveQuoteId(null)
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
    </>
  )
}
