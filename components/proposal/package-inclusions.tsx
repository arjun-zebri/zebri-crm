/**
 * Renders the chosen package's add-on items as couple-toggleable rows.
 *
 * @module components/proposal/package-inclusions
 */
'use client'

import type { PackageInclusionsBlock } from '@/app/(dashboard)/branding/blocks/types'
import { addOnItems, formatCurrency } from '@/lib/payments/proposal-view'
import { useProposalBlock } from './proposal-block-context'

/**
 * Renders add-on items of the chosen option as couple-toggleable rows.
 * Each add-on is a checkbox bound to the selection state; toggling calls
 * onToggle. Renders nothing when there are no add-ons.
 */
export function PackageInclusions({ block }: { block: PackageInclusionsBlock }) {
  const { options, chosenId, selection, onToggle } = useProposalBlock()

  const chosen = options.find((o) => o.id === chosenId) ?? options[0]
  if (!chosen) return null

  const addOns = addOnItems(chosen)
  if (addOns.length === 0) return <div data-testid="package-inclusions" />

  return (
    <div data-testid="package-inclusions" className="space-y-3">
      <h3 className="text-sm font-semibold text-text">Optional add-ons</h3>
      {addOns.map((item) => (
        <label
          key={item.id}
          className="flex items-center gap-3 p-2 rounded border border-border hover:bg-surface-muted transition-colors cursor-pointer"
        >
          <input
            type="checkbox"
            checked={selection[item.id] ?? false}
            onChange={(e) => onToggle?.(item.id, e.target.checked)}
            className="cursor-pointer"
          />
          <div className="flex-1">
            <div className="text-sm text-text">{item.description}</div>
          </div>
          <div className="text-sm font-semibold text-text whitespace-nowrap">
            {formatCurrency(item.amount)}
          </div>
        </label>
      ))}
    </div>
  )
}
