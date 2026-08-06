'use client'

import { Card } from '@/components/ui/card'
import { isPastDue } from '@/lib/utils'

import { useDashboardInvoices } from './use-dashboard'

interface DashboardInvoicesProps {
  onCoupleClick: (couple: { id: string; name: string }) => void
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)
}

const isOverdue = isPastDue

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short',
  })
}

export function DashboardInvoices({ onCoupleClick }: DashboardInvoicesProps) {
  const { data: invoices, isLoading } = useDashboardInvoices()

  if (isLoading) {
    return (
      <Card>
        <h2 className="text-base sm:text-xl font-semibold text-gray-900 mb-4">Outstanding Invoices</h2>
        <div className="space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse flex items-center gap-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="h-3.5 bg-gray-100 rounded-control w-36 mb-1.5" />
                <div className="h-3 bg-gray-100 rounded-control w-16" />
              </div>
              <div className="h-3.5 bg-gray-100 rounded-control w-14 shrink-0" />
              <div className="h-3 bg-gray-100 rounded-control w-10 shrink-0" />
            </div>
          ))}
        </div>
      </Card>
    )
  }

  if (!invoices || invoices.length === 0) {
    return (
      <Card>
        <h2 className="text-base sm:text-xl font-semibold text-gray-900 mb-4">Outstanding Invoices</h2>
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">No outstanding invoices.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col">
      <h2 className="text-xl font-semibold text-gray-900 mb-4 shrink-0">Outstanding Invoices</h2>
      <div className="space-y-1 flex-1 max-h-60 overflow-y-auto scrollbar-hover pr-1">
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
                <span className="truncate block text-gray-900 transition-opacity group-hover:opacity-80">
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
    </Card>
  )
}
