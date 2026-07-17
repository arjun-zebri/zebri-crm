'use client'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle, type TextStyleDefaults } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { LineItemsBlock } from '@/app/(dashboard)/branding/blocks/types'

import type { PublicBranding } from '../public-surface'
import { fmt, pad, type PublicDocData } from './shared'

/**
 * Renders the line items block for a document (invoice, proposal).
 * Each item displays description and amount with responsive layout.
 *
 * @note The `colSpread` prop is deprecated and no longer affects layout.
 * It is accepted for backward compatibility with existing blocks but ignored.
 */
export function RenderLineItems({
  block,
  branding,
  doc,
  chrome,
}: {
  block: LineItemsBlock
  branding: PublicBranding
  doc: PublicDocData
  chrome?: React.ReactNode
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
    <div className={`${p.docX} ${p.blockY} relative`}>
      {showHeader && (
        <div className="flex justify-between items-center pb-3 border-b border-gray-200 gap-4">
          <span style={{ ...headerCss, textTransform: 'uppercase', flex: 1 }}>Description</span>
          <span style={{ ...headerCss, textTransform: 'uppercase', marginLeft: '1rem' }}>Amount</span>
        </div>
      )}
      {doc.items.map((item, i) => (
        <div key={item.id} className={`flex justify-between items-start gap-4 ${p.rowY} ${rowBorder} ${rowBg(i)}`}>
          <div className="flex-1 min-w-0 break-words">
            <span style={itemCss}>{item.description}</span>
            {item.quantity !== undefined && item.quantity !== 1 && item.unit_price !== undefined && (
              <span className="block text-xs" style={{ color: branding.muted_color }}>
                {item.quantity} × {fmt(item.unit_price)}
              </span>
            )}
          </div>
          <span
            className="shrink-0 tabular-nums"
            style={{ ...itemCss, fontWeight: (itemCss.fontWeight as number ?? 400) + 100, textAlign: 'right' }}
          >
            {fmt(item.amount)}
          </span>
        </div>
      ))}
      {chrome}
    </div>
  )
}
