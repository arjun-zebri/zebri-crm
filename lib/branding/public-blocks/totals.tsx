'use client'

import type { CSSProperties, ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle, caseText } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { TotalsBlock } from '@/app/(dashboard)/branding/blocks/types'
import { invoiceDiscountAmount, invoiceTotal } from '@/lib/payments/invoice-total'

import type { PublicBranding } from '../public-surface'
import { roleDefaults } from '../type-defaults'

import { fmt, pad, type PublicDocData } from './shared'
import { VarChip } from './var-chip'

interface RowProps {
  label: string
  value: ReactNode
  css: CSSProperties
  /** @deprecated No longer affects layout. Kept for backward compatibility. */
  spread?: boolean
  /** Editor click-to-style target tag; inert on the public surface. */
  subtarget?: string
}

function Row({ label, value, css, subtarget }: RowProps) {
  return (
    <div className="flex items-center" data-subtarget={subtarget}>
      <span className="flex-1 min-w-0 break-words" style={css}>
        {label}
      </span>
      <span className="shrink-0 tabular-nums ml-4" style={{ ...css, textAlign: 'right' }}>
        {value}
      </span>
    </div>
  )
}

export function RenderTotals({
  block,
  branding,
  doc,
  variablePreview = false,
  chrome,
}: {
  block: TotalsBlock
  branding: PublicBranding
  doc: PublicDocData
  /**
   * Editor-only: the amounts are computed from the couple's real line items, so
   * the template shows mint `{{ … }}` chips instead of concrete sample figures.
   * The sent document renders the real subtotal/GST/total.
   */
  variablePreview?: boolean
  chrome?: React.ReactNode
}) {
  const p = pad(branding)
  const subtotal = doc.subtotal
  const discountAmt = invoiceDiscountAmount(doc)
  const taxableAmount = subtotal - discountAmt
  const tax = taxableAmount * (doc.taxRate / 100)
  const total = invoiceTotal(doc)

  const rowDefaults = roleDefaults(branding, 'body')
  const totalDefaults = roleDefaults(branding, 'total')
  const subtotalCss = resolveTextStyle(block.subtotalStyle, rowDefaults)
  const taxCss = resolveTextStyle(block.taxStyle, rowDefaults)
  const totalCss = resolveTextStyle(block.totalStyle, totalDefaults)
  const spread = block.colSpread ?? true

  return (
    <div className={`${p.blockY} relative`}>
      <div className="space-y-1.5 pt-3 border-t" style={{ borderTopColor: branding.border_color }} data-testid="totals-rule">
        {block.showSubtotal && (
          <div className="pt-2">
            <Row label={caseText('Subtotal', block.subtotalStyle, rowDefaults)} value={variablePreview ? <VarChip label="Amount" hint="The subtotal, summed from the line items." /> : fmt(subtotal)} css={subtotalCss} spread={spread} subtarget="subtotal" />
          </div>
        )}
        {discountAmt > 0 && (
          <Row
            label={caseText(`Discount${doc.discountType === 'percentage' ? ` (${doc.discountValue}%)` : ''}`, {}, rowDefaults)}
            value={`-${fmt(discountAmt)}`}
            css={rowDefaults}
            spread={spread}
          />
        )}
        {doc.taxRate > 0 && (block.showTax ?? true) && (
          <Row label={caseText(`GST (${doc.taxRate}%)`, block.taxStyle, rowDefaults)} value={variablePreview ? <VarChip label="Amount" hint="GST, calculated from the subtotal and tax rate." /> : fmt(tax)} css={taxCss} spread={spread} subtarget="tax" />
        )}
        <div className="pt-3 mt-2 border-t" style={{ borderTopColor: branding.border_color }}>
          <Row label={caseText('Total', block.totalStyle, totalDefaults)} value={variablePreview ? <VarChip label="Amount" hint="The total, calculated from the subtotal, any discount, and GST." /> : fmt(total)} css={totalCss} spread={spread} subtarget="total" />
          {/* Display-only note. Deliberately not styleable from the
              branding editor: it's a tax disclosure, not decoration, so
              it always renders in the muted body voice. */}
          {doc.gstInclusive ? (
            <p className="mt-1.5" style={{ ...rowDefaults, fontSize: 12, color: branding.muted_color }}>
              Prices include GST
            </p>
          ) : null}
        </div>
      </div>
      {chrome}
    </div>
  )
}
