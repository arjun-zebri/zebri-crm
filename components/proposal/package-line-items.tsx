/**
 * Renders the chosen package's base (included, non-add-on) items as styled rows.
 *
 * Styling mirrors the invoice line-items block: an optional section label with a
 * hairline rule, then hairline-separated rows (no boxed cards), all coloured and
 * typed from the MC's branding. Horizontal document padding comes from the block
 * wrapper; the block carries only vertical rhythm.
 *
 * @module components/proposal/package-line-items
 */
'use client'

import type { CSSProperties, ReactNode } from 'react'

import { resolveTextStyle, caseText } from '@/app/(dashboard)/branding/blocks/text-style'
import type { PackageLineItemsBlock } from '@/app/(dashboard)/branding/blocks/types'
import { pad } from '@/lib/branding/public-blocks/shared'
import { VarChip } from '@/lib/branding/public-blocks/var-chip'
import { roleDefaults } from '@/lib/branding/type-defaults'
import { baseItems, formatCurrency } from '@/lib/payments/proposal-view'

import { useProposalBlock } from './proposal-block-context'

/**
 * Renders base (included) items of the chosen option as styled rows. Each item
 * displays description and amount with styling from the block overrides.
 * Renders an empty marker (keeping its test hook) when there are no base items.
 *
 * @param block - The packageLineItems block carrying row/header/item style overrides.
 * @param variablePreview - Editor-only: base items are filled from the proposal, so
 *   the template shows placeholder rows of mint `{{ … }}` chips instead of concrete
 *   sample data. The sent document renders the couple's actual base items.
 */
export function PackageLineItems({
  block,
  variablePreview = false,
  headingSlot,
}: {
  block: PackageLineItemsBlock
  variablePreview?: boolean
  /** Editor slot: an inline editor for the heading text. */
  headingSlot?: ReactNode
}) {
  const { options, chosenId, branding } = useProposalBlock()

  const p = pad(branding)
  const showHeader = block.showHeader ?? true
  const rowStyle = block.rowStyle ?? 'lines'
  const headerDefaults = roleDefaults(branding, 'sectionLabel')
  const itemDefaults = roleDefaults(branding, 'body')
  const headerCss = resolveTextStyle(block.headerStyle, headerDefaults)
  const itemCss = resolveTextStyle(block.itemStyle, itemDefaults)
  // Amounts sit a touch heavier than their description, matching line items.
  const amountCss: CSSProperties = {
    ...itemCss,
    fontWeight: ((itemCss.fontWeight as number) ?? 400) + 100,
    textAlign: 'right',
  }
  const rowBorder = rowStyle === 'lines' ? 'border-b last:border-b-0' : ''

  const heading = (
    <p data-subtarget="header" className="pb-3 border-b" style={{ ...headerCss, borderBottomColor: branding.border_color }}>
      {headingSlot ?? caseText(block.heading || 'Included services', block.headerStyle, headerDefaults)}
    </p>
  )

  if (variablePreview) {
    return (
      <div data-testid="package-line-items" className={p.blockY}>
        {showHeader && heading}
        {[0, 1].map((i) => (
          <div
            key={`ph-${i}`}
            data-subtarget="item"
            className={`flex justify-between items-start gap-4 ${p.rowY} ${rowBorder} mt-2 first:mt-0`}
            style={rowBorder ? { borderBottomColor: branding.border_color } : {}}
          >
            <div className="flex-1 min-w-0">
              <span style={itemCss}>
                <VarChip label="Item" hint="Base items are filled from the proposal when it's sent." />
              </span>
            </div>
            <span className="shrink-0 tabular-nums" style={amountCss}>
              <VarChip label="Amount" hint="Each included item's amount, filled from the proposal." />
            </span>
          </div>
        ))}
      </div>
    )
  }

  const chosen = options.find((o) => o.id === chosenId) ?? options[0]
  if (!chosen) return null

  const baseItemsList = baseItems(chosen)
  if (baseItemsList.length === 0) return <div data-testid="package-line-items" />

  return (
    <div data-testid="package-line-items" className={p.blockY}>
      {showHeader && heading}
      {baseItemsList.map((item) => (
        <div
          key={item.id}
          data-subtarget="item"
          className={`flex justify-between items-start gap-4 ${p.rowY} ${rowBorder} mt-2 first:mt-0`}
          style={rowBorder ? { borderBottomColor: branding.border_color } : {}}
        >
          <div className="flex-1 min-w-0 break-words">
            <span style={itemCss}>{caseText(item.description, block.itemStyle, itemDefaults)}</span>
          </div>
          <span
            className="shrink-0 tabular-nums"
            style={{ ...amountCss }}
          >
            {caseText(formatCurrency(item.amount), block.itemStyle, itemDefaults)}
          </span>
        </div>
      ))}
    </div>
  )
}
