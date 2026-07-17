'use client'

import type { CSSProperties } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle, type TextStyleDefaults } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { TotalsBlock } from '@/app/(dashboard)/branding/blocks/types'

import type { PublicBranding } from '../public-surface'
import { fmt, pad, type PublicDocData } from './shared'

interface RowProps {
  label: string
  value: string
  css: CSSProperties
  /** @deprecated No longer affects layout. Kept for backward compatibility. */
  spread?: boolean
}

function Row({ label, value, css }: RowProps) {
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

export function RenderTotals({
  block,
  branding,
  doc,
  chrome,
}: {
  block: TotalsBlock
  branding: PublicBranding
  doc: PublicDocData
  chrome?: React.ReactNode
}) {
  const p = pad(branding)
  const subtotal = doc.subtotal
  const discountAmt = doc.discountType && (doc.discountValue ?? 0) > 0
    ? (doc.discountType === 'percentage' ? subtotal * (doc.discountValue ?? 0) / 100 : (doc.discountValue ?? 0))
    : 0
  const taxableAmount = subtotal - discountAmt
  const tax = taxableAmount * (doc.taxRate / 100)
  const total = taxableAmount + tax

  const rowDefaults: TextStyleDefaults = {
    fontFamily: branding.font_body,
    fontSize: 13,
    fontWeight: 400,
    color: branding.muted_color || '#6B7280',
    align: 'left',
    lineHeight: 1.4,
    letterSpacing: 0,
  }
  const totalDefaults: TextStyleDefaults = {
    fontFamily: branding.font_heading,
    fontSize: 18,
    fontWeight: branding.font_weight,
    color: branding.text_color || '#111827',
    align: 'left',
    lineHeight: 1.2,
    letterSpacing: 0,
  }
  const subtotalCss = resolveTextStyle(block.subtotalStyle, rowDefaults)
  const taxCss = resolveTextStyle(block.taxStyle, rowDefaults)
  const totalCss = resolveTextStyle(block.totalStyle, totalDefaults)
  const spread = block.colSpread ?? true

  return (
    <div className={`${p.docX} ${p.blockY} relative`}>
      <div className="space-y-1.5 pt-3 border-t border-gray-200">
        {block.showSubtotal && (
          <div className="pt-2">
            <Row label="Subtotal" value={fmt(subtotal)} css={subtotalCss} spread={spread} />
          </div>
        )}
        {discountAmt > 0 && (
          <Row
            label={`Discount${doc.discountType === 'percentage' ? ` (${doc.discountValue}%)` : ''}`}
            value={`-${fmt(discountAmt)}`}
            css={rowDefaults}
            spread={spread}
          />
        )}
        {doc.taxRate > 0 && (block.showTax ?? true) && (
          <Row label={`GST (${doc.taxRate}%)`} value={fmt(tax)} css={taxCss} spread={spread} />
        )}
        <div className="pt-3 mt-2 border-t border-gray-200">
          <Row label="Total" value={fmt(total)} css={totalCss} spread={spread} />
        </div>
      </div>
      {chrome}
    </div>
  )
}
