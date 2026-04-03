'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface QuoteItem {
  id: string
  description: string
  amount: number
  position: number
}

interface PublicQuote {
  id: string
  title: string
  quote_number: string
  status: string
  subtotal: number
  tax_rate: number | null
  discount_type: 'percentage' | 'fixed' | null
  discount_value: number | null
  notes: string | null
  expires_at: string | null
  accepted_at: string | null
  couple_name: string
  business_name: string | null
  items: QuoteItem[]
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

type PageState = 'loading' | 'not_found' | 'active' | 'expired' | 'accepted' | 'declined'

export default function PublicQuotePage() {
  const params = useParams<{ token: string }>()
  const supabase = createClient()

  const [quote, setQuote] = useState<PublicQuote | null>(null)
  const [pageState, setPageState] = useState<PageState>('loading')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [confirmingAccept, setConfirmingAccept] = useState(false)

  const load = async () => {
    const { data, error } = await supabase.rpc('get_public_quote', { token: params.token })
    if (error || !data) {
      setPageState('not_found')
      return
    }

    const q = data as PublicQuote
    setQuote(q)

    if (q.status === 'accepted') { setPageState('accepted'); return }
    if (q.status === 'declined') { setPageState('declined'); return }
    if (q.expires_at && new Date(q.expires_at + 'T00:00:00') < new Date()) {
      setPageState('expired')
      return
    }
    setPageState('active')
  }

  useEffect(() => { load() }, [params.token])

  const handleAccept = async () => {
    setActionLoading(true)
    setActionError('')
    const { data } = await supabase.rpc('accept_quote', { token: params.token })
    setActionLoading(false)
    if (data?.error) {
      if (data.error === 'expired') setPageState('expired')
      else if (data.error === 'already_actioned') await load()
      else setActionError('Something went wrong. Please try again.')
      return
    }
    await load()
  }

  const handleDecline = async () => {
    setActionLoading(true)
    setActionError('')
    const { data } = await supabase.rpc('decline_quote', { token: params.token })
    setActionLoading(false)
    if (data?.error) {
      if (data.error === 'already_actioned') await load()
      else setActionError('Something went wrong. Please try again.')
      return
    }
    await load()
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Loading */}
        {pageState === 'loading' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-4">
            <div className="h-5 w-24 bg-gray-100 rounded animate-pulse" />
            <div className="h-7 w-64 bg-gray-100 rounded animate-pulse" />
            <div className="space-y-2 pt-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </div>
        )}

        {/* Not found / disabled */}
        {pageState === 'not_found' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
            <p className="text-sm font-medium text-gray-900 mb-1">Quote unavailable</p>
            <p className="text-sm text-gray-500">This quote is no longer available.</p>
          </div>
        )}

        {/* Quote content */}
        {quote && pageState !== 'not_found' && pageState !== 'loading' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="px-8 py-7 border-b border-gray-100">
              {quote.business_name && (
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  {quote.business_name}
                </p>
              )}
              <h1 className="text-2xl font-semibold text-gray-900 mb-1">{quote.title}</h1>
              <p className="text-sm text-gray-500">{quote.couple_name}</p>
              <div className="flex items-center gap-3 mt-3">
                <span className="text-xs text-gray-400">{quote.quote_number}</span>
                {quote.expires_at && pageState !== 'expired' && (
                  <span className="text-xs text-gray-400">
                    Expires {formatDate(quote.expires_at)}
                  </span>
                )}
              </div>
            </div>

            {/* Status banners */}
            {pageState === 'accepted' && (
              <div className="px-8 py-5 bg-emerald-50 border-b border-emerald-100">
                <p className="text-sm font-semibold text-emerald-700 mb-1">
                  Quote accepted{quote.accepted_at ? ` on ${formatDate(quote.accepted_at.split('T')[0])}` : ''}.
                </p>
                <p className="text-sm text-emerald-600">
                  {quote.business_name ? `${quote.business_name} will` : 'Your MC will'} be in touch to confirm the details.
                </p>
              </div>
            )}
            {pageState === 'declined' && (
              <div className="px-8 py-4 bg-gray-50 border-b border-gray-100">
                <p className="text-sm text-gray-600">You declined this quote.</p>
              </div>
            )}
            {pageState === 'expired' && (
              <div className="px-8 py-4 bg-amber-50 border-b border-amber-100">
                <p className="text-sm text-amber-700">
                  This quote expired on {formatDate(quote.expires_at!)}.
                  {quote.business_name ? ` Please contact ${quote.business_name} for an updated quote.` : ''}
                </p>
              </div>
            )}

            {/* Line items */}
            <div className="px-8 py-6">
              <div className="space-y-0">
                {/* Header row */}
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Description</span>
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Amount</span>
                </div>

                {(!quote.items || quote.items.length === 0) ? (
                  <p className="text-sm text-gray-400 py-4">No line items.</p>
                ) : (
                  quote.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-3 border-b border-gray-50">
                      <span className="text-sm text-gray-800">{item.description}</span>
                      <span className="text-sm text-gray-900 font-medium tabular-nums ml-4">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))
                )}

                {/* Totals */}
                <div className="pt-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Subtotal</span>
                    <span className="text-sm text-gray-700 tabular-nums">{formatCurrency(quote.subtotal)}</span>
                  </div>
                  {quote.discount_type && (quote.discount_value ?? 0) > 0 && (() => {
                    const discountAmt = quote.discount_type === 'percentage'
                      ? quote.subtotal * (quote.discount_value ?? 0) / 100
                      : (quote.discount_value ?? 0)
                    return (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                          Discount{quote.discount_type === 'percentage' ? ` (${quote.discount_value}%)` : ''}
                        </span>
                        <span className="text-sm text-red-500 tabular-nums">-{formatCurrency(discountAmt)}</span>
                      </div>
                    )
                  })()}
                  {(quote.tax_rate ?? 0) > 0 && (() => {
                    const discountAmt = quote.discount_type && (quote.discount_value ?? 0) > 0
                      ? (quote.discount_type === 'percentage' ? quote.subtotal * (quote.discount_value ?? 0) / 100 : (quote.discount_value ?? 0))
                      : 0
                    const taxableAmount = quote.subtotal - discountAmt
                    const taxAmt = taxableAmount * ((quote.tax_rate ?? 0) / 100)
                    return (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">GST ({quote.tax_rate}%)</span>
                        <span className="text-sm text-gray-700 tabular-nums">{formatCurrency(taxAmt)}</span>
                      </div>
                    )
                  })()}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-sm font-semibold text-gray-900">Total</span>
                    <span className="text-lg font-semibold text-gray-900 tabular-nums">
                      {(() => {
                        const discountAmt = quote.discount_type && (quote.discount_value ?? 0) > 0
                          ? (quote.discount_type === 'percentage' ? quote.subtotal * (quote.discount_value ?? 0) / 100 : (quote.discount_value ?? 0))
                          : 0
                        const taxableAmount = quote.subtotal - discountAmt
                        const tax = taxableAmount * ((quote.tax_rate ?? 0) / 100)
                        return formatCurrency(taxableAmount + tax)
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            {quote.notes && (
              <div className="px-8 pb-6">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Notes</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{quote.notes}</p>
              </div>
            )}

            {/* Action buttons — only on active state */}
            {pageState === 'active' && (
              <div className="px-8 py-6 bg-gray-50 border-t border-gray-100">
                {actionError && (
                  <p className="text-sm text-red-500 mb-4">{actionError}</p>
                )}
                {confirmingAccept ? (
                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-1">Accept this quote?</p>
                    <p className="text-xs text-gray-500 mb-4">
                      By accepting you confirm you have reviewed the details above.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={handleAccept}
                        disabled={actionLoading}
                        className="flex-1 py-3 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
                      >
                        {actionLoading ? 'Processing...' : 'Yes, accept'}
                      </button>
                      <button
                        onClick={() => setConfirmingAccept(false)}
                        disabled={actionLoading}
                        className="flex-1 py-3 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-100 transition cursor-pointer disabled:opacity-50"
                      >
                        Go back
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setConfirmingAccept(true)}
                      disabled={actionLoading}
                      className="flex-1 py-3 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
                    >
                      Accept Quote
                    </button>
                    <button
                      onClick={handleDecline}
                      disabled={actionLoading}
                      className="flex-1 py-3 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-100 transition cursor-pointer disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
