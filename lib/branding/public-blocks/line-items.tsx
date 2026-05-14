'use client'

import { resolveTextStyle, type TextStyleDefaults } from '@/app/(dashboard)/branding/blocks/text-style'
import type { LineItemsBlock } from '@/app/(dashboard)/branding/blocks/types'
import type { PublicBranding } from '../public-surface'
import { fmt, pad, type PublicDocData } from './shared'

export function RenderLineItems({
  block,
  branding,
  doc,
}: {
  block: LineItemsBlock
  branding: PublicBranding
  doc: PublicDocData
}) {
  const p = pad(branding)
  const showHeader = block.showHeader ?? true
  const rowStyle = block.rowStyle ?? 'lines'
  const headerDefaults: TextStyleDefaults = {
    fontFamily: branding.font_body,
    fontSize: 11,
    fontWeight: 500,
    color: branding.muted_color || '#9CA3AF',
    align: 'left',
    lineHeight: 1.4,
    letterSpacing: 0.06,
  }
  const itemDefaults: TextStyleDefaults = {
    fontFamily: branding.font_body,
    fontSize: 14,
    fontWeight: branding.font_body_weight,
    color: branding.text_color || '#111827',
    align: 'left',
    lineHeight: 1.4,
    letterSpacing: 0,
  }
  const headerCss = resolveTextStyle(block.headerStyle, headerDefaults)
  const itemCss = resolveTextStyle(block.itemStyle, itemDefaults)
  const rowBorder = rowStyle === 'lines' ? 'border-b border-gray-100 last:border-b-0' : ''
  const rowBg = (i: number) =>
    rowStyle === 'stripes' && i % 2 === 1 ? 'bg-gray-50/60 -mx-2 px-2 rounded-md' : ''

  if (!doc.items || doc.items.length === 0) {
    return (
      <div className={`${p.docX} ${p.blockY}`}>
        <p className="text-sm" style={{ color: branding.muted_color }}>No line items.</p>
      </div>
    )
  }

  return (
    <div className={`${p.docX} ${p.blockY}`}>
      {showHeader && (
        <div className="flex items-center justify-between pb-3 border-b border-gray-200">
          <span style={{ ...headerCss, textTransform: 'uppercase' }}>Description</span>
          <span style={{ ...headerCss, textTransform: 'uppercase' }}>Amount</span>
        </div>
      )}
      {doc.items.map((item, i) => (
        <div key={item.id} className={`flex items-start justify-between ${p.rowY} ${rowBorder} ${rowBg(i)} gap-4`}>
          <div className="flex-1 min-w-0">
            <span style={itemCss}>{item.description}</span>
            {item.quantity !== undefined && item.quantity !== 1 && item.unit_price !== undefined && (
              <span className="block text-xs" style={{ color: branding.muted_color }}>
                {item.quantity} × {fmt(item.unit_price)}
              </span>
            )}
          </div>
          <span
            className="tabular-nums shrink-0"
            style={{ ...itemCss, fontWeight: (itemCss.fontWeight as number ?? 400) + 100 }}
          >
            {fmt(item.amount)}
          </span>
        </div>
      ))}
    </div>
  )
}
