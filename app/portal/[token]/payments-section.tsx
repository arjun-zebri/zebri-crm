'use client'

import { ExternalLink } from 'lucide-react'

import { isPastDue } from '@/lib/utils'

import { PortalQuote, PortalInvoice } from './page'

interface PaymentsSectionProps {
  payments: { quotes: PortalQuote[]; invoices: PortalInvoice[] }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'draft':
      return 'bg-surface-muted text-text-muted'
    case 'sent':
      return 'bg-info/10 text-info'
    case 'accepted':
      return 'bg-success/10 text-success'
    case 'declined':
      return 'bg-danger/10 text-danger'
    case 'expired':
      return 'bg-warning/10 text-warning'
    case 'paid':
      return 'bg-success/10 text-success'
    case 'overdue':
      return 'bg-danger/10 text-danger'
    default:
      return 'bg-surface-muted text-text-muted'
  }
}

function formatAUD(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(value)
}

const isOverdue = isPastDue

export function PaymentsSection({ payments }: PaymentsSectionProps) {
  const hasQuotes = payments.quotes.length > 0
  const hasInvoices = payments.invoices.length > 0

  if (!hasQuotes && !hasInvoices) {
    return (
      <div className="border border-border rounded-card p-6 text-center">
        <p className="text-body text-text-muted">No quotes or invoices yet. Your MC will send them here.</p>
      </div>
    )
  }

  // Calculate summary
  const totalQuotes = payments.quotes.reduce((sum, q) => sum + q.subtotal, 0)
  const totalInvoices = payments.invoices.reduce((sum, i) => sum + i.subtotal, 0)
  const overdueInvoices = payments.invoices.filter(
    (i) => i.status !== 'paid' && i.status !== 'cancelled' && isOverdue(i.due_date)
  )

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      {(totalQuotes > 0 || totalInvoices > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {totalQuotes > 0 && (
            <div className="bg-surface border border-border rounded-card p-3">
              <p className="text-caption text-text-subtle">Total quotes</p>
              <p className="text-section font-semibold text-text mt-1">{formatAUD(totalQuotes)}</p>
            </div>
          )}
          {totalInvoices > 0 && (
            <div className="bg-surface border border-border rounded-card p-3">
              <p className="text-caption text-text-subtle">Total invoices</p>
              <p className="text-section font-semibold text-text mt-1">{formatAUD(totalInvoices)}</p>
            </div>
          )}
          {overdueInvoices.length > 0 && (
            <div className="bg-danger/10 border border-danger/30 rounded-card p-3">
              <p className="text-caption text-danger">Overdue</p>
              <p className="text-section font-semibold text-danger mt-1">{overdueInvoices.length}</p>
            </div>
          )}
        </div>
      )}

      {/* Quotes */}
      {hasQuotes && (
        <div>
          <h3 className="text-body font-medium text-text-muted mb-3">Quotes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {payments.quotes.map((quote) => (
              <div key={quote.id} className="bg-surface border border-border rounded-card p-4 flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-medium text-text">{quote.title}</p>
                    <p className="text-caption text-text-subtle mt-0.5">Quote #{quote.quote_number}</p>
                  </div>
                  <span className={`shrink-0 text-caption font-medium px-2 py-1 rounded-pill capitalize ${getStatusColor(quote.status)}`}>
                    {quote.status}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-auto pt-3">
                  <p className="text-body font-semibold text-text">{formatAUD(quote.subtotal)}</p>
                  {quote.share_token_enabled && quote.share_token ? (
                    <a
                      href={`/quote/${quote.share_token}`}
                      className="inline-flex items-center gap-1.5 text-caption font-medium text-brand-fg hover:text-text-muted transition cursor-pointer"
                    >
                      View <ExternalLink size={13} strokeWidth={1.5} />
                    </a>
                  ) : (
                    <span className="text-caption text-text-subtle">Not yet shared</span>
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
          <h3 className="text-body font-medium text-text-muted mb-3">Invoices</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {payments.invoices.map((invoice) => {
              const overdue = invoice.status !== 'paid' && invoice.status !== 'cancelled' && isOverdue(invoice.due_date)
              return (
                <div
                  key={invoice.id}
                  className={`border rounded-card p-4 flex flex-col ${
                    overdue
                      ? 'bg-danger/10 border-danger/30'
                      : 'bg-surface border-border hover:border-border-strong'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="min-w-0 flex-1">
                      <p className={`text-body font-medium ${overdue ? 'text-danger' : 'text-text'}`}>{invoice.title}</p>
                      <p className="text-caption text-text-subtle mt-0.5">Invoice #{invoice.invoice_number}</p>
                    </div>
                    {overdue && (
                      <span className="shrink-0 text-caption font-medium px-2 py-1 rounded-pill bg-danger text-text-inverse">
                        Overdue
                      </span>
                    )}
                  </div>
                  {invoice.due_date && (
                    <p className={`text-caption mb-3 ${overdue ? 'text-danger font-medium' : 'text-text-subtle'}`}>
                      Due {new Date(invoice.due_date + 'T00:00:00').toLocaleDateString('en-AU')}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-auto">
                    <p className="text-body font-semibold text-text">{formatAUD(invoice.subtotal)}</p>
                    {invoice.share_token_enabled && invoice.share_token ? (
                      <a
                        href={`/invoice/${invoice.share_token}`}
                        className="inline-flex items-center gap-1.5 text-caption font-medium text-brand-fg hover:text-text-muted transition cursor-pointer"
                      >
                        View <ExternalLink size={13} strokeWidth={1.5} />
                      </a>
                    ) : (
                      <span className="text-caption text-text-subtle">Not yet shared</span>
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
