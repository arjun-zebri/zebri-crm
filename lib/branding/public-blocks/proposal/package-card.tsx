'use client'

import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style'
import { getTextColor } from '@/lib/branding/contrast'
import { optionBaseSubtotal, optionTotal, weekendLoadingAmount, type PricedOption } from '@/lib/proposals/pricing'
import type { PublicProposalItem, PublicProposalOption } from '@/lib/proposals/public-types'
import { PACKAGE_PRICE_FREQUENCY_SUFFIX } from '@/lib/proposals/types'

import type { PublicBranding } from '../../public-surface'
import { roleDefaults } from '../../type-defaults'
import { fmt, inheritAlign } from '../shared'

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
 * Editor slots for one card (the template editor edits packages in place,
 * founder ruling 2026-09-18). Each replaces exactly the node it names and
 * nothing else, so the card's own layout, typography and brand styling
 * are the single source for how a package looks typed-into or sent.
 */
export interface PackageCardSlots {
  title?: ReactNode
  description?: ReactNode
  /** Replaces the price figure (a single-price card edits it here). */
  price?: ReactNode
  /** Replaces one inclusion row's content (the `<li>` and its brand type stay). When given, the inclusion list also renders while empty so the editor can offer "Add inclusion" under it. */
  item?: (item: PublicProposalItem, index: number) => ReactNode
  /** Replaces one add-on row's content. */
  addon?: (item: PublicProposalItem, index: number) => ReactNode
  /** Rendered after the lines, before the CTA (the editor's add-line buttons). */
  footer?: ReactNode
  /** Pinned to the card's top-right corner (the editor's per-card menu). */
  corner?: ReactNode
  /** Replaces the CTA/select button (the editor: a click opens a popover to edit the shared button label, instead of firing the real select action, which only exists on the public page). */
  cta?: ReactNode
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
  ctaBackgroundColor,
  ctaTextColor,
  cardBackgroundColor,
  addonIds,
  onSelect,
  onToggleAddon,
  slots,
}: {
  option: PublicProposalOption
  branding: PublicBranding
  selected: boolean
  locked: boolean
  showInclusions: boolean
  ctaLabel: string
  /** Overrides the not-yet-selected button's background/text; unset keeps `branding.brand_color`/`getTextColor`. */
  ctaBackgroundColor?: string | undefined
  ctaTextColor?: string | undefined
  /** Overrides the card's own surface; unset keeps `branding.surface_color`. */
  cardBackgroundColor?: string | undefined
  addonIds: readonly string[]
  onSelect?: (() => void) | undefined
  onToggleAddon?: ((id: string) => void) | undefined
  slots?: PackageCardSlots | undefined
}) {
  // Every text style inherits the section's alignment (`inheritAlign`'s
  // own doc) rather than pinning the role default `left`; the flex rows
  // (inclusion + price) are unaffected either way.
  const headingStyle = inheritAlign(resolveTextStyle(undefined, roleDefaults(branding, 'sectionHeading')))
  const bodyStyle = inheritAlign(resolveTextStyle(undefined, roleDefaults(branding, 'body')))
  const totalStyle = inheritAlign(resolveTextStyle(undefined, roleDefaults(branding, 'total')))
  const finePrintStyle = inheritAlign(resolveTextStyle(undefined, roleDefaults(branding, 'finePrint')))

  const base = option.pricing_mode === 'single' ? (option.fixed_price ?? 0) : optionBaseSubtotal(priced(option).items)
  const total = optionTotal(priced(option), addonIds)
  const requiredItems = option.items.filter((i) => !i.is_addon)
  const addonItems = option.items.filter((i) => i.is_addon)
  // Itemised total is a sum, not a recurring amount, so the frequency
  // suffix only ever reads on a `single`-mode card's own fixed price.
  const frequencySuffix = option.pricing_mode === 'single' ? PACKAGE_PRICE_FREQUENCY_SUFFIX[option.price_frequency ?? 'one_time'] : ''
  // One price format per card (2026-09-20 feedback): the total, each
  // itemised line and each add-on all show cents or none together, so a
  // "Round numbers" card never reads `$1,650` beside `+ $150.00`.
  const priceDecimals = option.price_decimals === 'whole' ? 0 : 2

  return (
    // eslint-disable-next-line jsx-a11y/role-supports-aria-props -- `aria-pressed` marks the card's selection state for tests/tooling; the CTA button inside carries the real accessible state
    <article
      aria-pressed={selected}
      data-option-id={option.id}
      className={`relative flex h-full flex-col gap-4 p-6 ${selected ? 'shadow-lg' : ''}`}
      style={{
        border: `2px solid ${selected ? branding.brand_color : branding.border_color}`,
        borderRadius: branding.corner_radius,
        background: cardBackgroundColor ?? branding.surface_color,
      }}
    >
      {option.is_popular && (
        // Straddles the card's own top border (half in, half out) rather
        // than sitting in the content flow, so a "Most popular" card's
        // title lines up with every other card's instead of starting
        // lower - the badge would otherwise be the one thing making the
        // popular card taller than its neighbours.
        <span
          className="absolute -top-3 left-6 rounded-pill px-3 py-1"
          style={{ ...finePrintStyle, background: branding.brand_color, color: getTextColor(branding.brand_color) }}
        >
          Most popular
        </span>
      )}
      {slots?.corner ? <div className="absolute right-3 top-3">{slots.corner}</div> : null}
      <div className={slots?.corner ? 'pr-8' : ''}>
        <h3 className="m-0" style={headingStyle}>{slots?.title ?? option.title}</h3>
        {option.description && !slots?.description && (
          <p className="m-0 mt-1" style={{ ...bodyStyle, color: branding.muted_color }}>{option.description}</p>
        )}
        {slots?.description && (
          // A `div`, not the `p` above: the editor's field is itself block content, which a `p` cannot hold.
          <div className="mt-1" style={{ ...bodyStyle, color: branding.muted_color }}>{slots.description}</div>
        )}
      </div>

      <div>
        <p className="m-0" style={totalStyle}>{slots?.price ?? <>{fmt(total, priceDecimals)}{frequencySuffix}</>}</p>
        {option.gst_inclusive && <p className="m-0" style={{ ...finePrintStyle, color: branding.muted_color }}>incl. GST</p>}
        {!!option.weekend_loading_percent && option.weekend_loading_percent > 0 && (
          <p className="m-0" style={{ ...finePrintStyle, color: branding.muted_color }}>
            Includes {option.weekend_loading_percent}% weekend loading ({fmt(weekendLoadingAmount(base, option.weekend_loading_percent))})
          </p>
        )}
      </div>

      {(showInclusions || slots?.item) && (requiredItems.length > 0 || slots?.item) && (
        // Inclusions the sent proposal hides still render for the editor
        // (its slot is the only way to price an itemised card), dimmed so
        // the canvas still says "not shown".
        <ul className={`m-0 flex list-none flex-col gap-2 p-0 ${showInclusions ? '' : 'opacity-50'}`}>
          {requiredItems.map((item, index) => (
            <li key={item.id} className="flex items-center justify-between gap-2" style={bodyStyle}>
              {slots?.item ? slots.item(item, index) : (
                <>
                  <span className="flex items-center gap-2">
                    <Check size={16} strokeWidth={1.5} style={{ color: branding.brand_color }} aria-hidden="true" />
                    {item.description}
                    {item.quantity !== 1 && <span style={{ color: branding.muted_color }}> x {item.quantity}</span>}
                  </span>
                  {option.pricing_mode === 'itemised' && (
                    <span style={{ color: branding.muted_color }}>{fmt(item.amount * item.quantity, priceDecimals)}</span>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <PackageAddons items={addonItems} branding={branding} addonIds={addonIds} locked={locked} selected={selected} onSelect={onSelect} onToggleAddon={onToggleAddon} renderItem={slots?.addon} decimals={priceDecimals} />

      {slots?.footer}

      {/* `mt-auto`: every card is already the same height as the tallest
          card in the whole grid (`h-full` above, plus `auto-rows-fr` on the
          grid in `packages.tsx` so a wrapped second row matches the first),
          so this pins the CTA to the same bottom Y in every card regardless
          of how many inclusions/add-ons pushed the content above it taller
          or shorter than its neighbours. */}
      <div className="mt-auto">
        {!locked ? (
          slots?.cta ?? (
            <button
              type="button"
              onClick={onSelect}
              className="w-full rounded-control px-4 py-2"
              style={
                selected
                  ? { border: `2px solid ${branding.brand_color}`, background: branding.surface_color, color: branding.brand_color }
                  : { background: ctaBackgroundColor ?? branding.brand_color, color: ctaTextColor ?? getTextColor(ctaBackgroundColor ?? branding.brand_color) }
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
          )
        ) : (
          selected && <p className="m-0 text-center" style={{ ...bodyStyle, color: branding.brand_color }}>Your choice</p>
        )}
      </div>
    </article>
  )
}
