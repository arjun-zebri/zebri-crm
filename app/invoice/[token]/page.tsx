'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
  position: number
}

interface PublicInvoice {
  id: string
  invoice_number: string
  title: string
  status: string
  subtotal: number
  due_date: string | null
  notes: string | null
  paid_at: string | null
  couple_name: string
  business_name: string | null
  items: InvoiceItem[]
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

type PageState = 'loading' | 'not_found' | 'active' | 'overdue' | 'paid' | 'cancelled'

export default function PublicInvoicePage() {
  const params = useParams<{ token: string }>()
  const supabase = createClient()

  const [invoice, setInvoice] = useState<PublicInvoice | null>(null)
  const [pageState, setPageState] = useState<PageState>('loading')

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.rpc('get_public_invoice', { token: params.token })
      if (error || !data) {
        setPageState('not_found')
        return
      }

      const inv = data as PublicInvoice
      setInvoice(inv)

      if (inv.status === 'paid') { setPageState('paid'); return }
      if (inv.status === 'cancelled') { setPageState('cancelled'); return }
      if (
        inv.due_date &&
        new Date(inv.due_date + 'T00:00:00') < new Date()
      ) {
        setPageState('overdue')
        return
      }
      setPageState('active')
    }

    load()
  }, [params.token])

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

        {/* Not found / disabled / cancelled */}
        {(pageState === 'not_found' || pageState === 'cancelled') && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
            <p className="text-sm font-medium text-gray-900 mb-1">Invoice unavailable</p>
            <p className="text-sm text-gray-500">
              {pageState === 'cancelled'
                ? 'This invoice is no longer active.'
                : 'This invoice is no longer available.'}
            </p>
          </div>
        )}

        {/* Invoice content */}
        {invoice && pageState !== 'not_found' && pageState !== 'cancelled' && pageState !== 'loading' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="px-8 py-7 border-b border-gray-100">
              {invoice.business_name && (
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  {invoice.business_name}
                </p>
              )}
              <h1 className="text-2xl font-semibold text-gray-900 mb-1">{invoice.title}</h1>
              <p className="text-sm text-gray-500">{invoice.couple_name}</p>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <span className="text-xs text-gray-400">{invoice.invoice_number}</span>
                {invoice.due_date && (
                  <span
                    className={`text-xs font-medium ${
                      pageState === 'overdue' ? 'text-red-500' : 'text-gray-400'
                    }`}
                  >
                    {pageState === 'overdue' ? 'Overdue · ' : 'Due '}
                    {formatDate(invoice.due_date)}
                  </span>
                )}
              </div>
            </div>

            {/* Status banners */}
            {pageState === 'paid' && (
              <div className="px-8 py-4 bg-emerald-50 border-b border-emerald-100">
                <p className="text-sm font-medium text-emerald-700">
                  This invoice has been paid. Thank you.
                  {invoice.paid_at && ` · ${formatDate(invoice.paid_at.split('T')[0])}`}
                </p>
              </div>
            )}
            {pageState === 'overdue' && (
              <div className="px-8 py-4 bg-red-50 border-b border-red-100">
                <p className="text-sm text-red-600 font-medium">
                  This invoice is overdue.
                  {invoice.business_name
                    ? ` Please contact ${invoice.business_name} if you have any questions.`
                    : ''}
                </p>
              </div>
            )}

            {/* Line items */}
            <div className="px-8 py-6">
              {/* Header row */}
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Description</span>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Amount</span>
              </div>

              {(!invoice.items || invoice.items.length === 0) ? (
                <p className="text-sm text-gray-400 py-4">No line items.</p>
              ) : (
                invoice.items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between py-3 border-b border-gray-50 gap-4">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-800">{item.description}</span>
                      {item.quantity !== 1 && (
                        <span className="text-xs text-gray-400 block">
                          {item.quantity} × {formatCurrency(item.unit_price)}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-900 font-medium tabular-nums shrink-0">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))
              )}

              {/* Total */}
              <div className="flex items-center justify-between pt-4">
                <span className="text-sm font-semibold text-gray-900">Total</span>
                <span className="text-lg font-semibold text-gray-900 tabular-nums">
                  {formatCurrency(invoice.subtotal)}
                </span>
              </div>
            </div>

            {/* Payment notes */}
            {invoice.notes && (
              <div className="px-8 pb-8">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                  Payment instructions
                </p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
