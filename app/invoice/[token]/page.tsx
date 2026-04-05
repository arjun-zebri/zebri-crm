'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PayWithCardButton } from './pay-with-card-button'
import { CheckCircle } from 'lucide-react'

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
  tax_rate: number
  due_date: string | null
  notes: string | null
  paid_at: string | null
  couple_name: string
  business_name: string | null
  bank_account_name: string | null
  bank_bsb: string | null
  bank_account_number: string | null
  items: InvoiceItem[]
  // Payment schedule
  deposit_percent: number | null
  deposit_due_date: string | null
  deposit_paid_at: string | null
  final_due_date: string | null
  final_paid_at: string | null
  // Card payments
  stripe_payment_enabled: boolean
  stripe_connect_enabled: boolean
  share_token: string
  // Branding
  logo_url: string | null
  brand_color: string
  tagline: string | null
  abn: string | null
  show_contact_on_documents: boolean
  phone: string | null
  website: string | null
  instagram_url: string | null
  facebook_url: string | null
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

  const taxAmount = invoice ? invoice.subtotal * ((invoice.tax_rate || 0) / 100) : 0
  const total = invoice ? invoice.subtotal + taxAmount : 0
  const hasSchedule = invoice?.deposit_percent != null
  const depositAmount = hasSchedule ? total * ((invoice!.deposit_percent!) / 100) : 0
  const finalAmount = hasSchedule ? total - depositAmount : 0
  const showCardButton =
    invoice?.stripe_payment_enabled &&
    invoice?.stripe_connect_enabled &&
    !hasSchedule &&
    pageState !== 'paid' &&
    pageState !== 'cancelled'

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

        {/* Not found / cancelled */}
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
              {invoice.logo_url ? (
                <img
                  src={invoice.logo_url}
                  alt={invoice.business_name || 'Logo'}
                  className="max-h-12 object-contain mb-3"
                />
              ) : invoice.business_name ? (
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  {invoice.business_name}
                </p>
              ) : null}
              {invoice.tagline && (
                <p className="text-xs text-gray-400 mb-3">{invoice.tagline}</p>
              )}
              <h1 className="text-2xl font-semibold text-gray-900 mb-1">{invoice.title}</h1>
              <p className="text-sm text-gray-500">{invoice.couple_name}</p>
              {invoice.abn && (
                <p className="text-xs text-gray-400 mt-1">ABN: {invoice.abn}</p>
              )}
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <span className="text-xs text-gray-400">{invoice.invoice_number}</span>
                {invoice.due_date && !hasSchedule && (
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

              {/* Subtotal + GST + Total */}
              <div className="pt-4 space-y-2">
                {(invoice.tax_rate || 0) > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Subtotal</span>
                      <span className="text-sm text-gray-700 tabular-nums">{formatCurrency(invoice.subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">GST ({invoice.tax_rate}%)</span>
                      <span className="text-sm text-gray-700 tabular-nums">{formatCurrency(taxAmount)}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">Total</span>
                  <span className="text-lg font-semibold text-gray-900 tabular-nums">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment schedule */}
            {hasSchedule && (
              <div className="px-8 pb-6">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Payment schedule
                </p>
                <div className="space-y-2">
                  {/* Deposit */}
                  <div className="flex items-center justify-between py-2.5 border-b border-gray-50">
                    <div>
                      <span className="text-sm text-gray-800">
                        Deposit ({invoice.deposit_percent}%)
                      </span>
                      {invoice.deposit_due_date && (
                        <span className="text-xs text-gray-400 block">
                          Due {formatDate(invoice.deposit_due_date)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 tabular-nums">
                        {formatCurrency(depositAmount)}
                      </span>
                      {invoice.deposit_paid_at && (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Paid
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Final balance */}
                  <div className="flex items-center justify-between py-2.5">
                    <div>
                      <span className="text-sm text-gray-800">
                        Final balance ({100 - invoice.deposit_percent!}%)
                      </span>
                      {invoice.final_due_date && (
                        <span className="text-xs text-gray-400 block">
                          Due {formatDate(invoice.final_due_date)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 tabular-nums">
                        {formatCurrency(finalAmount)}
                      </span>
                      {invoice.final_paid_at && (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Paid
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Payment notes & bank details */}
            {(invoice.notes || invoice.bank_account_name || invoice.bank_bsb || invoice.bank_account_number) && (
              <div className="px-8 pb-8">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Payment instructions
                </p>
                <div className="space-y-3">
                  {invoice.notes && (
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{invoice.notes}</p>
                  )}
                  {(invoice.bank_account_name || invoice.bank_bsb || invoice.bank_account_number) && (
                    <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
                      {invoice.bank_account_name && (
                        <div>
                          <span className="text-gray-500">Account name:</span>
                          <span className="text-gray-900 ml-2">{invoice.bank_account_name}</span>
                        </div>
                      )}
                      {invoice.bank_bsb && (
                        <div>
                          <span className="text-gray-500">BSB:</span>
                          <span className="text-gray-900 ml-2 font-mono">{invoice.bank_bsb}</span>
                        </div>
                      )}
                      {invoice.bank_account_number && (
                        <div>
                          <span className="text-gray-500">Account:</span>
                          <span className="text-gray-900 ml-2 font-mono">{invoice.bank_account_number}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Contact footer */}
            {invoice.show_contact_on_documents && (invoice.phone || invoice.website || invoice.instagram_url || invoice.facebook_url) && (
              <div className="px-8 py-6 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-400">
                {invoice.phone && <span>{invoice.phone}</span>}
                {invoice.website && (
                  <a href={invoice.website} target="_blank" rel="noopener noreferrer" className="hover:text-gray-600">
                    {invoice.website}
                  </a>
                )}
                {invoice.instagram_url && (
                  <a href={invoice.instagram_url} target="_blank" rel="noopener noreferrer" className="hover:text-gray-600">
                    Instagram
                  </a>
                )}
                {invoice.facebook_url && (
                  <a href={invoice.facebook_url} target="_blank" rel="noopener noreferrer" className="hover:text-gray-600">
                    Facebook
                  </a>
                )}
              </div>
            )}

            {/* Pay with card */}
            {showCardButton && (
              <div className="px-8 pb-8">
                <PayWithCardButton invoiceId={invoice.id} shareToken={invoice.share_token} brandColor={invoice.brand_color || '#000000'} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
