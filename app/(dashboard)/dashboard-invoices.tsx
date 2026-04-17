'use client'

import { Loader2 } from 'lucide-react'
import { useDashboardInvoices } from './use-dashboard'

interface DashboardInvoicesProps {
  onCoupleClick: (couple: { id: string; name: string }) => void
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dateStr + 'T00:00:00') < today
}

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short',
  })
}

export function DashboardInvoices({ onCoupleClick }: DashboardInvoicesProps) {
  const { data: invoices, isLoading } = useDashboardInvoices()

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base sm:text-xl font-semibold text-gray-900 mb-4">Outstanding Invoices</h2>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" strokeWidth={1.5} />
        </div>
      </div>
    )
  }

  if (!invoices || invoices.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base sm:text-xl font-semibold text-gray-900 mb-4">Outstanding Invoices</h2>
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">No outstanding invoices.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col">
      <h2 className="text-xl font-semibold text-gray-900 mb-4 shrink-0">Outstanding Invoices</h2>
      <div className="space-y-1 flex-1 max-h-60 overflow-y-auto pr-1">
        {invoices.map((invoice) => {
          const overdue = isOverdue(invoice.due_date)
          const clickable = !!invoice.couple
          return (
            <div
              key={invoice.id}
              onClick={() => { if (invoice.couple) onCoupleClick(invoice.couple) }}
              className={`flex items-center gap-3 py-2 transition text-sm ${
                clickable ? 'cursor-pointer group' : 'cursor-default'
              }`}
            >
              <div className="flex-1 min-w-0">
                <span className={`truncate block transition ${clickable ? 'text-gray-900 group-hover:text-black group-hover:underline underline-offset-2 decoration-gray-300' : 'text-gray-900'}`}>
                  {invoice.couple?.name ?? invoice.title}
                </span>
                <span className="text-xs text-gray-400">{invoice.invoice_number}</span>
              </div>
              <span className="text-sm font-medium text-gray-900 tabular-nums shrink-0">
                {formatCurrency(invoice.subtotal)}
              </span>
              {invoice.due_date && (
                <span className={`text-xs shrink-0 ${overdue ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                  {formatDueDate(invoice.due_date)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
