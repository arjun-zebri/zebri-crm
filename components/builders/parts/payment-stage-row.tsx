/**
 * One stage on the invoice builder's applied payment timeline.
 *
 * Displays: label, resolved share and amount, due (or paid) date, and a state
 * pill. Unpaid stages show an editable DatePicker for the due date; paid
 * stages show the paid date as locked read-only text. Editing of amount/label/
 * timing happens in the schedule modal via "Change". The only action here is
 * recording a manual payment, and only once the invoice is live (`canRecord`):
 * while drafting there is nothing to record. Recording is gated to the earliest
 * unpaid stage because couples settle in order.
 *
 * Manual due date overrides: when the MC changes a due date here, it persists
 * to `invoice_payment_stages.due_date`. Reapplying a schedule template
 * recomputes all dates, so manually set dates are lost on reapply (why-comment
 * added: this is the intended UX: MCs can always re-edit after reapply).
 *
 * @module components/builders/parts/payment-stage-row
 */
'use client'

import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
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
  /** Called when the MC manually edits an unpaid stage's due date.
   *  Passes the stage id and new due date (YYYY-MM-DD). Paid stages ignore this. */
  onDueDateChange: (stageId: string, newDueDate: string) => void
}

export function PaymentStageRow({
  stage,
  canRecord,
  isNextUnpaid,
  markPending,
  onMarkPaid,
  onDueDateChange,
}: PaymentStageRowProps) {
  const paid = Boolean(stage.paidAt)
  const unit = stage.amountType === 'percent' ? '%' : '$'

  return (
    <div className="relative">
      <span
        aria-hidden
        className={`absolute -left-7 top-1 inline-flex h-3 w-3 rounded-pill ${
          paid ? 'bg-success' : 'border-2 border-warning bg-surface'
        }`}
      />
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-body font-medium text-text">{stage.label}</span>
        <span className="text-body text-text-muted tabular-nums">
          {stage.amountType === 'remainder' ? 'remainder' : `${String(stage.amountValue ?? 0)}${unit}`}
          {' · '}
          {formatCurrency(stage.amountCents)}
        </span>
        {paid ? (
          <span className="text-body text-text-muted">
            Paid {formatDateShort(stage.paidAt) ?? ''}
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-body text-text-muted">Due</span>
            <DatePicker
              value={stage.dueDate ?? ''}
              onChange={(newDate) => onDueDateChange(stage.id, newDate)}
              placeholder="Set date"
              className="w-32"
            />
          </div>
        )}
        <span className="ml-auto flex items-center gap-2">
          <StatePill
            label={paid ? 'Paid' : 'Due'}
            tone={paid ? 'success' : 'warning'}
            dot={paid ? 'filled' : 'hollow'}
          />
          {canRecord && !paid && isNextUnpaid && (
            <Button variant="success" onClick={onMarkPaid} loading={markPending}>
              Record payment
            </Button>
          )}
        </span>
      </div>
    </div>
  )
}
