'use client'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { LineItemsBlock } from '@/app/(dashboard)/branding/blocks/types'

import type { PublicBranding } from '../public-surface'
import { roleDefaults } from '../type-defaults'

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
  const headerDefaults = roleDefaults(branding, 'sectionLabel')
  const itemDefaults = roleDefaults(branding, 'body')
  const fineDefaults = roleDefaults(branding, 'finePrint')
  const headerCss = resolveTextStyle(block.headerStyle, headerDefaults)
  const itemCss = resolveTextStyle(block.itemStyle, itemDefaults)
  const fineCss = resolveTextStyle({}, fineDefaults)
  const rowBorder = rowStyle === 'lines' ? 'border-b last:border-b-0' : ''

  if (!doc.items || doc.items.length === 0) {
    const emptyDefaults = roleDefaults(branding, 'body')
    const emptyCss = resolveTextStyle({}, emptyDefaults)
    return (
      <div className={`${p.docX} ${p.blockY}`}>
        <p style={emptyCss}>No line items.</p>
      </div>
    )
  }

  return (
    <div className={`${p.docX} ${p.blockY} relative`}>
      {showHeader && (
        <div className="flex justify-between items-center pb-3 border-b gap-4" style={{ borderBottomColor: branding.border_color }}>
          <span style={{ ...headerCss, flex: 1 }}>Description</span>
          <span style={{ ...headerCss, marginLeft: '1rem' }}>Amount</span>
        </div>
      )}
      {doc.items.map((item) => (
        <div key={item.id} className={`flex justify-between items-start gap-4 ${p.rowY} ${rowBorder}`} style={rowBorder ? { borderBottomColor: branding.border_color } : {}}>
          <div className="flex-1 min-w-0 break-words">
            <span style={itemCss}>{item.description}</span>
            {item.quantity !== undefined && item.quantity !== 1 && item.unit_price !== undefined && (
              <span className="block" style={fineCss}>
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
