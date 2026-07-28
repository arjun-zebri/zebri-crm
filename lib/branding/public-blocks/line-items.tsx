'use client'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle, caseText } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { LineItemsBlock } from '@/app/(dashboard)/branding/blocks/types'

import type { PublicBranding } from '../public-surface'
import { roleDefaults } from '../type-defaults'

import { fmt, pad, type PublicDocData } from './shared'
import { VarChip } from './var-chip'

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
  variablePreview = false,
  chrome,
}: {
  block: LineItemsBlock
  branding: PublicBranding
  doc: PublicDocData
  /**
   * Editor-only: line items are filled from the real document, so the template
   * shows placeholder rows of mint `{{ … }}` chips instead of concrete sample
   * data. The sent document renders the couple's actual items.
   */
  variablePreview?: boolean
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

  if (!variablePreview && (!doc.items || doc.items.length === 0)) {
    const emptyDefaults = roleDefaults(branding, 'body')
    const emptyCss = resolveTextStyle({}, emptyDefaults)
    return (
      <div className={`${p.blockY}`}>
        <p style={emptyCss}>{caseText('No line items.', {}, emptyDefaults)}</p>
      </div>
    )
  }

  return (
    <div className={`${p.blockY} relative`}>
      {/* data-subtarget tags the header + item rows for click-to-style in the editor; inert on the public surface. */}
      {showHeader && (
        <div data-subtarget="header" className="flex justify-between items-center pb-3 border-b gap-4" style={{ borderBottomColor: branding.border_color }}>
          <span style={{ ...headerCss, flex: 1 }}>{caseText('Description', block.headerStyle, headerDefaults)}</span>
          <span style={{ ...headerCss, marginLeft: '1rem' }}>{caseText('Amount', block.headerStyle, headerDefaults)}</span>
        </div>
      )}
      {variablePreview
        ? // Placeholder rows: the real items are unknown until the document is
          // sent, so show a few mint-chip rows that keep the header/item styling
          // targets clickable without inventing sample data.
          [0, 1, 2].map((i) => (
            <div
              key={`ph-${i}`}
              data-subtarget="item"
              className={`flex justify-between items-start gap-4 ${p.rowY} ${rowBorder}`}
              style={rowBorder ? { borderBottomColor: branding.border_color } : {}}
            >
              <div className="flex-1 min-w-0">
                <span style={itemCss}>
                  <VarChip label="Item" hint="Line items are filled from the document when it's sent." />
                </span>
              </div>
              <span className="shrink-0 tabular-nums" style={{ ...itemCss, textAlign: 'right' }}>
                <VarChip label="Amount" hint="Each line item's amount, filled from the document." />
              </span>
            </div>
          ))
        : doc.items.map((item) => (
            <div key={item.id} data-subtarget="item" className={`flex justify-between items-start gap-4 ${p.rowY} ${rowBorder}`} style={rowBorder ? { borderBottomColor: branding.border_color } : {}}>
              <div className="flex-1 min-w-0 break-words">
                <span style={itemCss}>{caseText(item.description, block.itemStyle, itemDefaults)}</span>
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
                {caseText(fmt(item.amount), block.itemStyle, itemDefaults)}
              </span>
            </div>
          ))}
      {chrome}
    </div>
  )
}
