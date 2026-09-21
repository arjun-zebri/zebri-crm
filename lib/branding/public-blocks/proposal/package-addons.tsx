'use client'

import type { ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style'
import type { PublicProposalItem } from '@/lib/proposals/public-types'

import type { PublicBranding } from '../../public-surface'
import { roleDefaults } from '../../type-defaults'
import { fmt } from '../shared'

/**
 * A package card's add-on list: one checkbox row per optional item. Split
 * out of `package-card.tsx` to keep that file under the component line
 * budget. Uses a native checkbox (not the app's `Checkbox` primitive, which
 * is styled with Zebri app tokens) so the couple-facing page stays on the
 * MC's own brand colour.
 *
 * Ticking an add-on on a card that isn't selected yet would otherwise be
 * inert (the couple's selection only ever tracks one option's add-ons, so an
 * unselected card's ticks can never render as checked): the handler selects
 * this option first, which resets add-ons to its defaults, then applies the
 * toggle on top of that.
 */
export function PackageAddons({
  items,
  branding,
  addonIds,
  locked,
  selected,
  onSelect,
  onToggleAddon,
  renderItem,
  decimals = 2,
}: {
  items: PublicProposalItem[]
  branding: PublicBranding
  addonIds: readonly string[]
  locked: boolean
  selected: boolean
  onSelect?: (() => void) | undefined
  onToggleAddon?: ((id: string) => void) | undefined
  /** Editor slot: replaces one row's content (`PackageCardSlots.addon`); the `<li>` keeps the brand body type. */
  renderItem?: ((item: PublicProposalItem, index: number) => ReactNode) | undefined
  /** Decimal places for each add-on's amount; the card passes its own price format so the list matches the total. */
  decimals?: 0 | 2 | undefined
}) {
  if (items.length === 0) return null
  const bodyStyle = resolveTextStyle(undefined, roleDefaults(branding, 'body'))

  const handleToggle = (id: string) => {
    if (!selected) onSelect?.()
    onToggleAddon?.(id)
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-2 border-t p-0 pt-4" style={{ borderColor: branding.border_color }}>
      {items.map((item, index) => (
        <li key={item.id} style={renderItem ? bodyStyle : undefined}>
          {renderItem ? renderItem(item, index) : (
            <label className="flex items-center gap-2" style={bodyStyle}>
              <input
                type="checkbox"
                checked={addonIds.includes(item.id)}
                disabled={locked}
                onChange={() => handleToggle(item.id)}
                style={{ accentColor: branding.brand_color }}
              />
              {item.description}
              <span style={{ color: branding.muted_color }}>+ {fmt(item.amount * item.quantity, decimals)}</span>
            </label>
          )}
        </li>
      ))}
    </ul>
  )
}
