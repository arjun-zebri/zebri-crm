/**
 * Renders the price summary (subtotal, GST, total) for the chosen package
 * and current add-on selection.
 *
 * @module components/proposal/package-totals
 */
'use client'

import type { PackageTotalsBlock } from '@/app/(dashboard)/branding/blocks/types'
import { formatCurrency, selectionTotal } from '@/lib/payments/proposal-view'
import { useProposalBlock } from './proposal-block-context'

/**
 * Renders the live-recalculating price summary for the chosen option +
 * current add-on selection: subtotal, GST (if applicable), and total.
 */
export function PackageTotals({ block }: { block: PackageTotalsBlock }) {
  const { options, chosenId, selection } = useProposalBlock()

  const chosen = options.find((o) => o.id === chosenId) ?? options[0]
  if (!chosen) return null

  const total = selectionTotal(chosen, selection)
  const gstAmount = chosen.gst_inclusive ? 0 : Math.round(total * 0.1)
  const grandTotal = total + gstAmount

  return (
    <div className="space-y-2 p-3 rounded-lg bg-card border border-border">
      <div className="flex justify-between text-sm">
        <span className="text-text-muted">Subtotal</span>
        <span className="text-text font-semibold">{formatCurrency(total)}</span>
      </div>

      {!chosen.gst_inclusive && gstAmount > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-text-muted">GST (10%)</span>
          <span className="text-text font-semibold">{formatCurrency(gstAmount)}</span>
        </div>
      )}

      <div className="border-t border-border pt-2 flex justify-between">
        <span className="font-semibold text-text">Total</span>
        <span className="font-semibold text-brand text-lg">{formatCurrency(grandTotal)}</span>
      </div>
    </div>
  )
}
