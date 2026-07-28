/**
 * Renders the price summary (subtotal, GST, total) for the chosen package
 * and current add-on selection.
 *
 * Styling mirrors the invoice totals block: a top hairline rule, right-aligned
 * tabular figures, and a ruled Total row, all coloured and typed from the MC's
 * branding. No boxed card. Horizontal document padding comes from the block
 * wrapper; the block carries only vertical rhythm.
 *
 * @module components/proposal/package-totals
 */
'use client'

import type { CSSProperties, ReactNode } from 'react'

import { resolveTextStyle, caseText } from '@/app/(dashboard)/branding/blocks/text-style'
import type { PackageTotalsBlock } from '@/app/(dashboard)/branding/blocks/types'
import { pad } from '@/lib/branding/public-blocks/shared'
import { VarChip } from '@/lib/branding/public-blocks/var-chip'
import { roleDefaults } from '@/lib/branding/type-defaults'
import { formatCurrency, selectionTotal } from '@/lib/payments/proposal-view'

import { useProposalBlock } from './proposal-block-context'

/** A label/value row with a right-aligned tabular figure. */
function Row({ label, value, css }: { label: ReactNode; value: ReactNode; css: CSSProperties }) {
  return (
    <div className="flex items-center">
      <span className="flex-1 min-w-0 break-words" style={css}>
        {label}
      </span>
      <span className="shrink-0 tabular-nums ml-4" style={{ ...css, textAlign: 'right' }}>
        {value}
      </span>
    </div>
  )
}

/**
 * Renders the live-recalculating price summary for the chosen option + current
 * add-on selection: subtotal, GST (if applicable), and total.
 *
 * @param block - The packageTotals block carrying subtotal/total style overrides.
 * @param variablePreview - Editor-only: the amounts are computed from the real
 *   proposal, so the template shows mint `{{ Amount }}` chips.
 */
export function PackageTotals({
  block,
  variablePreview = false,
}: {
  block: PackageTotalsBlock
  variablePreview?: boolean
}) {
  const { options, chosenId, selection, branding } = useProposalBlock()

  const p = pad(branding)
  const rowDefaults = roleDefaults(branding, 'body')
  const totalDefaults = roleDefaults(branding, 'total')
  const subtotalCss = resolveTextStyle(block.subtotalStyle, rowDefaults)
  const totalCss = resolveTextStyle(block.totalStyle, totalDefaults)

  if (variablePreview) {
    return (
      <div className={p.blockY}>
        <div className="space-y-1.5 pt-3 border-t" style={{ borderTopColor: branding.border_color }}>
          <div className="pt-2">
            <Row
              label={caseText('Subtotal', block.subtotalStyle, rowDefaults)}
              value={<VarChip label="Amount" hint="The subtotal, summed from the package and its selected add-ons." />}
              css={subtotalCss}
            />
          </div>
          <div className="pt-3 mt-2 border-t" style={{ borderTopColor: branding.border_color }}>
            <Row
              label={caseText('Total', block.totalStyle, totalDefaults)}
              value={<VarChip label="Amount" hint="The total, calculated from the selection and any GST." />}
              css={totalCss}
            />
          </div>
        </div>
      </div>
    )
  }

  const chosen = options.find((o) => o.id === chosenId) ?? options[0]
  if (!chosen) return null

  const subtotal = selectionTotal(chosen, selection)
  const gstAmount = chosen.gst_inclusive ? 0 : Math.round(subtotal * 0.1)
  const grandTotal = subtotal + gstAmount

  return (
    <div className={p.blockY}>
      <div
        className="space-y-1.5 pt-3 border-t"
        style={{ borderTopColor: branding.border_color }}
      >
        <div className="pt-2">
          <Row
            label={caseText('Subtotal', block.subtotalStyle, rowDefaults)}
            value={formatCurrency(subtotal)}
            css={subtotalCss}
          />
        </div>
        {!chosen.gst_inclusive && gstAmount > 0 && (
          <Row label="GST (10%)" value={formatCurrency(gstAmount)} css={subtotalCss} />
        )}
        <div className="pt-3 mt-2 border-t" style={{ borderTopColor: branding.border_color }}>
          <Row
            label={caseText('Total', block.totalStyle, totalDefaults)}
            value={formatCurrency(grandTotal)}
            css={totalCss}
          />
        </div>
      </div>
    </div>
  )
}
