'use client'

import { resolveTextStyle, type TextStyleDefaults } from '@/app/(dashboard)/branding/blocks/text-style'
import type { TotalsBlock } from '@/app/(dashboard)/branding/blocks/types'
import type { PublicBranding } from '../public-surface'
import { fmt, pad, type PublicDocData } from './shared'

export function RenderTotals({
  block,
  branding,
  doc,
}: {
  block: TotalsBlock
  branding: PublicBranding
  doc: PublicDocData
}) {
  const p = pad(branding)
  const subtotal = doc.subtotal
  const discountAmt = doc.discountType && (doc.discountValue ?? 0) > 0
    ? (doc.discountType === 'percentage' ? subtotal * (doc.discountValue ?? 0) / 100 : (doc.discountValue ?? 0))
    : 0
  const taxableAmount = subtotal - discountAmt
  const tax = taxableAmount * (doc.taxRate / 100)
  const total = taxableAmount + tax

  const totalDefaults: TextStyleDefaults = {
    fontFamily: branding.font_heading,
    fontSize: 18,
    fontWeight: branding.font_weight,
    color: branding.text_color || '#111827',
    align: 'left',
    lineHeight: 1.2,
    letterSpacing: 0,
  }
  const totalCss = resolveTextStyle(block.totalStyle, totalDefaults)
  const muted = branding.muted_color || '#6B7280'
  const text = branding.text_color || '#111827'

  return (
    <div className={`${p.docX} ${p.blockY}`}>
      <div className="space-y-1.5 pt-3 border-t border-gray-200">
        {block.showSubtotal && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm" style={{ color: muted }}>Subtotal</span>
            <span className="text-sm tabular-nums" style={{ color: text }}>{fmt(subtotal)}</span>
          </div>
        )}
        {discountAmt > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: muted }}>
              Discount{doc.discountType === 'percentage' ? ` (${doc.discountValue}%)` : ''}
            </span>
            <span className="text-sm text-red-500 tabular-nums">-{fmt(discountAmt)}</span>
          </div>
        )}
        {doc.taxRate > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: muted }}>GST ({doc.taxRate}%)</span>
            <span className="text-sm tabular-nums" style={{ color: text }}>{fmt(tax)}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-3 mt-2 border-t border-gray-200">
          <span style={{ ...totalCss, fontSize: undefined }}>Total</span>
          <span className="tabular-nums" style={totalCss}>{fmt(total)}</span>
        </div>
      </div>
    </div>
  )
}
