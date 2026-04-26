'use client'

import { PortalQuote, PortalInvoice } from './page'
import { ExternalLink } from 'lucide-react'

interface PaymentsSectionProps {
  payments: { quotes: PortalQuote[]; invoices: PortalInvoice[] }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'draft':
      return 'bg-gray-100 text-gray-700'
    case 'sent':
      return 'bg-blue-100 text-blue-700'
    case 'accepted':
      return 'bg-emerald-100 text-emerald-700'
    case 'declined':
      return 'bg-red-100 text-red-700'
    case 'expired':
      return 'bg-amber-100 text-amber-700'
    case 'paid':
      return 'bg-emerald-100 text-emerald-700'
    case 'overdue':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

function formatAUD(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(value)
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  const due = new Date(dueDate + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}

export function PaymentsSection({ payments }: PaymentsSectionProps) {
  const hasQuotes = payments.quotes.length > 0
  const hasInvoices = payments.invoices.length > 0

  if (!hasQuotes && !hasInvoices) {
    return (
      <div className="border border-gray-200 rounded-xl p-6 text-center">
        <p className="text-sm text-gray-600">No quotes or invoices yet. Your MC will send them here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Quotes */}
      {hasQuotes && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-3">Quotes</h3>
          <div className="space-y-3">
            {payments.quotes.map((quote) => (
              <div key={quote.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{quote.title}</p>
                    <p className="text-xs text-gray-500 mt-1">Quote #{quote.quote_number}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full capitalize ${getStatusColor(quote.status)}`}>
                    {quote.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">{formatAUD(quote.subtotal)}</p>
                  {quote.share_token_enabled && quote.share_token ? (
                    <a
                      href={`/quote/${quote.share_token}`}
                      className="flex items-center gap-2 text-xs font-medium text-black hover:text-gray-700 transition"
                    >
                      View <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">Not yet shared</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invoices */}
      {hasInvoices && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-3">Invoices</h3>
          <div className="space-y-3">
            {payments.invoices.map((invoice) => {
              const overdue = invoice.status !== 'paid' && invoice.status !== 'cancelled' && isOverdue(invoice.due_date)
              return (
                <div key={invoice.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{invoice.title}</p>
                      <p className="text-xs text-gray-500 mt-1">Invoice #{invoice.invoice_number}</p>
                    </div>
                    <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full capitalize ${
                      overdue ? 'bg-red-100 text-red-700' : getStatusColor(invoice.status)
                    }`}>
                      {overdue ? 'Overdue' : invoice.status}
                    </span>
                  </div>
                  {invoice.due_date && (
                    <p className={`text-xs mb-2 ${overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                      Due {new Date(invoice.due_date + 'T00:00:00').toLocaleDateString('en-AU')}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">{formatAUD(invoice.subtotal)}</p>
                    {invoice.share_token_enabled && invoice.share_token ? (
                      <a
                        href={`/invoice/${invoice.share_token}`}
                        className="flex items-center gap-2 text-xs font-medium text-black hover:text-gray-700 transition"
                      >
                        View <ExternalLink size={12} />
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">Not yet shared</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
