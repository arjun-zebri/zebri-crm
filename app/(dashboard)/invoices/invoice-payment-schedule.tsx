'use client'

import { useState, useEffect } from 'react'
import { DatePicker } from '@/components/ui/date-picker'
import { CheckCircle } from 'lucide-react'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount)
}

interface InvoicePaymentScheduleProps {
  invoiceId: string
  canEdit: boolean
  depositPercent: number
  depositDueDate: string
  finalDueDate: string
  depositPaidAt: string | null
  finalPaidAt: string | null
  depositAmount: number
  finalAmount: number
  onDepositPercentChange: (v: number) => void
  onDepositDueDateChange: (v: string) => void
  onFinalDueDateChange: (v: string) => void
  onMarkDepositPaid: () => void
  onMarkFinalPaid: () => void
  markDepositPending: boolean
  markFinalPending: boolean
}

export function InvoicePaymentSchedule({
  canEdit,
  depositPercent,
  depositDueDate,
  finalDueDate,
  depositPaidAt,
  finalPaidAt,
  depositAmount,
  finalAmount,
  onDepositPercentChange,
  onDepositDueDateChange,
  onFinalDueDateChange,
  onMarkDepositPaid,
  onMarkFinalPaid,
  markDepositPending,
  markFinalPending,
}: InvoicePaymentScheduleProps) {
  const [percentStr, setPercentStr] = useState(String(depositPercent))
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    if (!isFocused) setPercentStr(String(depositPercent))
  }, [depositPercent])

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-3">Payment schedule</p>

      <div className="space-y-3 pl-0">
        {/* Deposit row */}
        <div className="rounded-lg border border-gray-100 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Deposit</span>
            {depositPaidAt ? (
              <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                <CheckCircle className="w-3.5 h-3.5" />
                Paid
              </span>
            ) : (
              canEdit && (
                <button
                  type="button"
                  onClick={onMarkDepositPaid}
                  disabled={markDepositPending}
                  className="text-xs text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-50"
                >
                  {markDepositPending ? 'Saving...' : 'Mark paid'}
                </button>
              )
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={99}
                value={percentStr}
                onChange={(e) => setPercentStr(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => {
                  setIsFocused(false)
                  const v = Math.min(99, Math.max(1, Number(percentStr) || 1))
                  setPercentStr(String(v))
                  onDepositPercentChange(v)
                }}
                disabled={!canEdit || !!depositPaidAt}
                className="w-14 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <span className="text-sm font-medium text-gray-900 ml-auto">
              {formatCurrency(depositAmount)}
            </span>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Due date</label>
            <DatePicker
              value={depositDueDate}
              onChange={onDepositDueDateChange}
              disabled={!canEdit || !!depositPaidAt}
            />
          </div>
        </div>

        {/* Final balance row */}
        <div className="rounded-lg border border-gray-100 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Final balance</span>
            {finalPaidAt ? (
              <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                <CheckCircle className="w-3.5 h-3.5" />
                Paid
              </span>
            ) : (
              canEdit && depositPaidAt && (
                <button
                  type="button"
                  onClick={onMarkFinalPaid}
                  disabled={markFinalPending}
                  className="text-xs text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-50"
                >
                  {markFinalPending ? 'Saving...' : 'Mark paid'}
                </button>
              )
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">{100 - depositPercent}%</span>
            <span className="text-sm font-medium text-gray-900">
              {formatCurrency(finalAmount)}
            </span>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Due date</label>
            <DatePicker
              value={finalDueDate}
              onChange={onFinalDueDateChange}
              disabled={!canEdit || !!finalPaidAt}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
