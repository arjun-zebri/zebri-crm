'use client'

import { Check } from 'lucide-react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style'
import { getTextColor } from '@/lib/branding/contrast'
import { optionBaseSubtotal, optionTotal, weekendLoadingAmount, type PricedOption } from '@/lib/proposals/pricing'
import type { PublicProposalOption } from '@/lib/proposals/public-types'

import type { PublicBranding } from '../../public-surface'
import { roleDefaults } from '../../type-defaults'
import { fmt } from '../shared'

import { PackageAddons } from './package-addons'

/**
 * Adapt a `PublicProposalOption` (the RPC/sample shape) to the `PricedOption`
 * the pure pricing module operates on. Exported so the accept block (and
 * anything else that needs an option's total) shares the same conversion
 * instead of re-deriving it.
 */
export function priced(option: PublicProposalOption): PricedOption {
  return {
    pricingMode: option.pricing_mode,
    fixedPrice: option.fixed_price,
    weekendLoadingPercent: option.weekend_loading_percent,
    items: option.items.map((i) => ({ id: i.id, amount: i.amount, quantity: i.quantity, isAddon: i.is_addon })),
  }
}

/**
 * One package option: title, price, inclusions, add-ons and a select CTA.
 * Locked (post-decision) surfaces drop the CTA in favour of a static
 * "Your choice" line and disable every add-on checkbox, since nothing on
 * an accepted/expired/declined proposal is still editable.
 */
export function PackageCard({
  option,
  branding,
  selected,
  locked,
  showInclusions,
  ctaLabel,
  addonIds,
  onSelect,
  onToggleAddon,
}: {
  option: PublicProposalOption
  branding: PublicBranding
  selected: boolean
  locked: boolean
  showInclusions: boolean
  ctaLabel: string
  addonIds: readonly string[]
  onSelect?: (() => void) | undefined
  onToggleAddon?: ((id: string) => void) | undefined
}) {
  const headingStyle = resolveTextStyle(undefined, roleDefaults(branding, 'sectionHeading'))
  const bodyStyle = resolveTextStyle(undefined, roleDefaults(branding, 'body'))
  const totalStyle = resolveTextStyle(undefined, roleDefaults(branding, 'total'))
  const finePrintStyle = resolveTextStyle(undefined, roleDefaults(branding, 'finePrint'))

  const base = option.pricing_mode === 'single' ? (option.fixed_price ?? 0) : optionBaseSubtotal(priced(option).items)
  const total = optionTotal(priced(option), addonIds)
  const requiredItems = option.items.filter((i) => !i.is_addon)
  const addonItems = option.items.filter((i) => i.is_addon)

  return (
    // eslint-disable-next-line jsx-a11y/role-supports-aria-props -- `aria-pressed` marks the card's selection state for tests/tooling; the CTA button inside carries the real accessible state
    <article
      aria-pressed={selected}
      data-option-id={option.id}
      className={`flex flex-col gap-4 p-6 ${selected ? 'shadow-lg' : ''}`}
      style={{
        border: `2px solid ${selected ? branding.brand_color : branding.border_color}`,
        borderRadius: branding.corner_radius,
        background: branding.surface_color,
      }}
    >
      {option.is_popular && (
        <span
          className="self-start rounded-pill px-3 py-1"
          style={{ ...finePrintStyle, background: branding.brand_color, color: getTextColor(branding.brand_color) }}
        >
          Most popular
        </span>
      )}
      <div>
        <h3 className="m-0" style={headingStyle}>{option.title}</h3>
        {option.description && (
          <p className="m-0 mt-1" style={{ ...bodyStyle, color: branding.muted_color }}>{option.description}</p>
        )}
      </div>

      <div>
        <p className="m-0" style={totalStyle}>{fmt(total)}</p>
        {option.gst_inclusive && <p className="m-0" style={{ ...finePrintStyle, color: branding.muted_color }}>incl. GST</p>}
        {!!option.weekend_loading_percent && option.weekend_loading_percent > 0 && (
          <p className="m-0" style={{ ...finePrintStyle, color: branding.muted_color }}>
            Includes {option.weekend_loading_percent}% weekend loading ({fmt(weekendLoadingAmount(base, option.weekend_loading_percent))})
          </p>
        )}
      </div>

      {showInclusions && requiredItems.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {requiredItems.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2" style={bodyStyle}>
              <span className="flex items-center gap-2">
                <Check size={16} strokeWidth={1.5} style={{ color: branding.brand_color }} aria-hidden="true" />
                {item.description}
                {item.quantity !== 1 && <span style={{ color: branding.muted_color }}> x {item.quantity}</span>}
              </span>
              {option.pricing_mode === 'itemised' && (
                <span style={{ color: branding.muted_color }}>{fmt(item.amount * item.quantity)}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <PackageAddons items={addonItems} branding={branding} addonIds={addonIds} locked={locked} selected={selected} onSelect={onSelect} onToggleAddon={onToggleAddon} />

      {!locked ? (
        <button
          type="button"
          onClick={onSelect}
          className="w-full rounded-control px-4 py-2"
          style={
            selected
              ? { border: `2px solid ${branding.brand_color}`, background: branding.surface_color, color: branding.brand_color }
              : { background: branding.brand_color, color: getTextColor(branding.brand_color) }
          }
        >
          {selected ? (
            <span className="flex items-center justify-center gap-2">
              <Check size={16} strokeWidth={1.5} aria-hidden="true" /> Selected
            </span>
          ) : (
            ctaLabel
          )}
        </button>
      ) : (
        selected && <p className="m-0 text-center" style={{ ...bodyStyle, color: branding.brand_color }}>Your choice</p>
      )}
    </article>
  )
}
