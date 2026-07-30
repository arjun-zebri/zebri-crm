/**
 * One editable stage on the invoice builder's payment timeline.
 *
 * Unpaid stages edit inline (label, amount type, value, date). Paid stages
 * lock completely: money has moved against them, so the only honest UI is
 * read-only. `isNextUnpaid` gates the Mark-paid button because couples settle
 * stages in order, and letting the MC record stage 3 before stage 2 would put
 * the invoice into a state the public page cannot represent.
 *
 * @module components/builders/parts/payment-stage-row
 */
'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X } from 'lucide-react'

import { DatePicker } from '@/components/ui/date-picker'
import { Select } from '@/components/ui/select'
import { StatePill } from '@/components/ui/state-pill'
import type { InvoiceStage, StageAmountType } from '@/types/payment-schedule'

const FIELD_CLS =
  'h-9 inline-flex items-center rounded-xl border border-border bg-surface px-3 text-sm text-text transition-colors'

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100)
}

function formatDateShort(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export interface PaymentStageRowProps {
  stage: InvoiceStage
  canEdit: boolean
  /** True for the earliest unpaid stage, which is the only payable one. */
  isNextUnpaid: boolean
  markPending: boolean
  onChange: (patch: Partial<InvoiceStage>) => void
  onRemove: () => void
  onMarkPaid: () => void
}

export function PaymentStageRow({
  stage,
  canEdit,
  isNextUnpaid,
  markPending,
  onChange,
  onRemove,
  onMarkPaid,
}: PaymentStageRowProps) {
  const paid = Boolean(stage.paidAt)
  const editable = canEdit && !paid
  const unit = stage.amountType === 'percent' ? '%' : '$'

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
    // A paid stage cannot move: its position is part of the payment record.
    disabled: !editable,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative ${isDragging ? 'opacity-50' : ''}`}
    >
      <span
        aria-hidden
        className={`absolute -left-7 top-1 inline-flex h-3 w-3 rounded-full ${
          paid ? 'bg-success' : 'border-2 border-warning bg-surface'
        }`}
      />
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-body font-medium text-text">{stage.label}</span>
        <span className="text-sm text-text-muted tabular-nums">
          {stage.amountType === 'remainder' ? 'remainder' : `${String(stage.amountValue ?? 0)}${unit}`}
          {' · '}
          {formatCurrency(stage.amountCents)}
        </span>
        <span className="text-caption text-text-muted">
          {paid ? `Paid ${formatDateShort(stage.paidAt) ?? ''}` : `Due ${formatDateShort(stage.dueDate) ?? '—'}`}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <StatePill
            label={paid ? 'Paid' : 'Due'}
            tone={paid ? 'success' : 'warning'}
            dot={paid ? 'filled' : 'hollow'}
          />
          {editable && (
            <>
              <span
                {...attributes}
                {...listeners}
                aria-label={`Reorder ${stage.label}`}
                className="cursor-grab text-text-subtle active:cursor-grabbing"
              >
                <GripVertical size={14} strokeWidth={1.5} />
              </span>
              <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove ${stage.label}`}
                className="cursor-pointer text-text-subtle transition-colors hover:text-danger"
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            </>
          )}
        </span>
      </div>

      {editable && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {/* Uncontrolled, with a key derived from the committed value, rather
              than local state kept in sync by an effect. Mirroring props into
              state inside a useEffect trips `react-hooks/set-state-in-effect`,
              which is an ESLint *error* in this repo, and the key achieves the
              same result: the field shows the committed value, the MC types
              without re-resolving the whole schedule on every keystroke, and
              blur commits. */}
          <input
            key={`label-${stage.label}`}
            defaultValue={stage.label}
            onBlur={(e) => {
              const next = e.target.value.trim()
              if (next && next !== stage.label) onChange({ label: next })
            }}
            aria-label="Stage label"
            className={`${FIELD_CLS} w-32 focus:outline-none`}
          />
          <Select
            value={stage.amountType}
            onValueChange={(v) => {
              const amountType = v as StageAmountType
              // A remainder carries no value; switching to it must clear one or
              // the SQL check constraint rejects the row.
              onChange(
                amountType === 'remainder'
                  ? { amountType, amountValue: null }
                  : { amountType, amountValue: stage.amountValue ?? 0 },
              )
            }}
            aria-label="Stage amount type"
            options={[
              { value: 'percent', label: '%' },
              { value: 'fixed', label: '$' },
              { value: 'remainder', label: 'Remaining balance' },
            ]}
          />
          {stage.amountType === 'remainder' ? (
            <span className="text-caption text-text-muted">Remaining balance</span>
          ) : (
            <div className={`${FIELD_CLS} gap-1`}>
              <input
                key={`amount-${String(stage.amountValue ?? '')}`}
                type="number"
                min={0}
                defaultValue={stage.amountValue ?? ''}
                onBlur={(e) => {
                  const next = Number(e.target.value)
                  if (Number.isFinite(next) && next !== stage.amountValue) {
                    onChange({ amountValue: next })
                  }
                }}
                aria-label="Stage amount"
                className="w-14 bg-transparent text-sm text-text tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-sm text-text-muted">{unit}</span>
            </div>
          )}
          <DatePicker
            value={stage.dueDate ?? ''}
            onChange={(v) => onChange({ dueDate: v || null })}
            iconPosition="left"
          />
          {isNextUnpaid && (
            <button
              type="button"
              onClick={onMarkPaid}
              disabled={markPending}
              className="h-9 inline-flex cursor-pointer items-center rounded-xl bg-success px-3 text-sm font-medium text-text-inverse transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {markPending ? 'Saving...' : 'Mark paid'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
