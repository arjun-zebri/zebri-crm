/**
 * One stage on the invoice builder's applied payment timeline.
 *
 * A read-only summary line: label, resolved share and amount, due (or paid)
 * date, and a state pill. Editing of shape happens in the schedule modal via
 * "Change". The only action here is recording a manual payment, and only once
 * the invoice is live (`canRecord`): while drafting there is nothing to record.
 * Recording is gated to the earliest unpaid stage because couples settle in
 * order.
 *
 * @module components/builders/parts/payment-stage-row
 */
'use client'

import { StatePill } from '@/components/ui/state-pill'
import type { InvoiceStage } from '@/types/payment-schedule'

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100)
}

function formatDateShort(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export interface PaymentStageRowProps {
  stage: InvoiceStage
  /** The invoice is live (sent / part-paid), so payments can be recorded. */
  canRecord: boolean
  /** True for the earliest unpaid stage, the only one that can be recorded. */
  isNextUnpaid: boolean
  markPending: boolean
  onMarkPaid: () => void
}

export function PaymentStageRow({
  stage,
  canRecord,
  isNextUnpaid,
  markPending,
  onMarkPaid,
}: PaymentStageRowProps) {
  const paid = Boolean(stage.paidAt)
  const unit = stage.amountType === 'percent' ? '%' : '$'

  return (
    <div className="relative">
      <span
        aria-hidden
        className={`absolute -left-7 top-1 inline-flex h-3 w-3 rounded-full ${
          paid ? 'bg-success' : 'border-2 border-warning bg-surface'
        }`}
      />
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-text">{stage.label}</span>
        <span className="text-sm text-text-muted tabular-nums">
          {stage.amountType === 'remainder' ? 'remainder' : `${String(stage.amountValue ?? 0)}${unit}`}
          {' · '}
          {formatCurrency(stage.amountCents)}
        </span>
        <span className="text-caption text-text-muted">
          {paid
            ? `Paid ${formatDateShort(stage.paidAt) ?? ''}`
            : `Due ${formatDateShort(stage.dueDate) ?? '—'}`}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <StatePill
            label={paid ? 'Paid' : 'Due'}
            tone={paid ? 'success' : 'warning'}
            dot={paid ? 'filled' : 'hollow'}
          />
          {canRecord && !paid && isNextUnpaid && (
            <button
              type="button"
              onClick={onMarkPaid}
              disabled={markPending}
              className="inline-flex h-7 cursor-pointer items-center rounded-lg bg-success px-2.5 text-caption font-medium text-text-inverse transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {markPending ? 'Saving...' : 'Record payment'}
            </button>
          )}
        </span>
      </div>
    </div>
  )
}
