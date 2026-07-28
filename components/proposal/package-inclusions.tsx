/**
 * Renders the chosen package's add-on items as couple-toggleable rows.
 *
 * Styling mirrors the invoice line-items block: a small section label with a
 * hairline rule, then hairline-separated rows (no boxed cards), all coloured
 * and typed from the MC's branding. Horizontal document padding comes from the
 * block wrapper; the block carries only vertical rhythm.
 *
 * @module components/proposal/package-inclusions
 */
'use client'

import type { CSSProperties } from 'react'

import { resolveTextStyle, caseText } from '@/app/(dashboard)/branding/blocks/text-style'
import type { PackageInclusionsBlock } from '@/app/(dashboard)/branding/blocks/types'
import { Checkbox } from '@/components/ui/checkbox'
import { pad } from '@/lib/branding/public-blocks/shared'
import { VarChip } from '@/lib/branding/public-blocks/var-chip'
import { roleDefaults } from '@/lib/branding/type-defaults'
import { addOnItems, formatCurrency } from '@/lib/payments/proposal-view'

import { useProposalBlock } from './proposal-block-context'

/**
 * Renders add-on items of the chosen option as couple-toggleable rows. Each
 * add-on is a checkbox bound to the selection state; toggling calls onToggle.
 * Renders an empty marker (keeping its test hook) when there are no add-ons.
 *
 * @param block - The packageInclusions block carrying heading/item style overrides.
 * @param variablePreview - Editor-only: add-ons are filled from the proposal, so
 *   the template shows placeholder rows of mint `{{ … }}` chips (disabled ticks)
 *   instead of concrete sample data. The sent document renders the real add-ons.
 */
export function PackageInclusions({
  block,
  variablePreview = false,
}: {
  block: PackageInclusionsBlock
  variablePreview?: boolean
}) {
  const { options, chosenId, selection, onToggle, branding } = useProposalBlock()

  const p = pad(branding)
  const headingDefaults = roleDefaults(branding, 'sectionLabel')
  const itemDefaults = roleDefaults(branding, 'body')
  const headingCss = resolveTextStyle(block.headingStyle, headingDefaults)
  const itemCss = resolveTextStyle(block.itemStyle, itemDefaults)
  // Amounts sit a touch heavier than their description, matching line items.
  const amountCss: CSSProperties = {
    ...itemCss,
    fontWeight: ((itemCss.fontWeight as number) ?? 400) + 100,
    textAlign: 'right',
  }

  const heading = (
    <p className="pb-3 border-b" style={{ ...headingCss, borderBottomColor: branding.border_color }}>
      {caseText('Optional add-ons', block.headingStyle, headingDefaults)}
    </p>
  )

  if (variablePreview) {
    return (
      <div data-testid="package-inclusions" className={p.blockY}>
        {heading}
        {[0, 1].map((i) => (
          <div
            key={`ph-${i}`}
            className={`flex items-center gap-3 ${p.rowY} border-b last:border-b-0`}
            style={{ borderBottomColor: branding.border_color }}
          >
            <Checkbox checked={false} onChange={() => {}} ariaLabel="Add-on placeholder" disabled />
            <span className="flex-1 min-w-0" style={itemCss}>
              <VarChip label="Add-on" hint="Optional add-ons are filled from the proposal when it's sent." />
            </span>
            <span className="shrink-0 tabular-nums" style={amountCss}>
              <VarChip label="Amount" hint="Each add-on's price, filled from the proposal." />
            </span>
          </div>
        ))}
      </div>
    )
  }

  const chosen = options.find((o) => o.id === chosenId) ?? options[0]
  if (!chosen) return null

  const addOns = addOnItems(chosen)
  if (addOns.length === 0) return <div data-testid="package-inclusions" />

  return (
    <div data-testid="package-inclusions" className={p.blockY}>
      {heading}
      {addOns.map((item) => (
        <div
          key={item.id}
          className={`flex items-center gap-3 ${p.rowY} border-b last:border-b-0`}
          style={{ borderBottomColor: branding.border_color }}
        >
          <Checkbox
            checked={selection[item.id] ?? false}
            onChange={(checked) => onToggle?.(item.id, checked)}
            ariaLabel={item.description}
          />
          <span className="flex-1 min-w-0 break-words" style={itemCss}>
            {caseText(item.description, block.itemStyle, itemDefaults)}
          </span>
          <span className="shrink-0 tabular-nums" style={amountCss}>
            {formatCurrency(item.amount)}
          </span>
        </div>
      ))}
    </div>
  )
}
