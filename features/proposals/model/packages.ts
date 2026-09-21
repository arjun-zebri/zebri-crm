/**
 * The packages a proposal template authors itself (founder ruling,
 * 2026-09-18: "Qwilr-style, packages live in the block"). A packages
 * section carries `PackagesData.options`: one {@link PackageOption} per
 * card, each with its own priced lines, edited in place on the canvas.
 * These are the seed for a proposal's `proposal_options` rows when a
 * proposal is created from the template (Phase 4 copies them, then the
 * proposal's own rows are the live source); until then they are what the
 * editor, the Preview overlay and the template thumbnail render.
 *
 * Shapes are camelCase like the rest of the layout model; `toPublicOption`
 * adapts one to the snake_case `PublicProposalOption` the shared card
 * renderer and pricing module already operate on, so the public
 * components never learn a second shape.
 *
 * @module features/proposals/model/packages
 */
import { optionBaseSubtotal, type PricedOption } from '@/lib/proposals/pricing'
import type { PublicProposalItem, PublicProposalOption } from '@/lib/proposals/public-types'
import type { PackagePriceDecimals, PackagePriceFrequency, ProposalPricingMode } from '@/lib/proposals/types'

import { plainText } from './doc'
import type { RichDoc } from './layout'

/** Caps for a template's packages section. Mirrors the builder's own 1-3 option guidance loosely: cards past three wrap to a second row, six is where a "grid" stops reading as options. */
export const PACKAGE_LIMITS = {
  /** Cards per packages section. */
  maxOptions: 6,
  /** Priced lines (inclusions + add-ons) per card. */
  maxItems: 20,
  /** Dollars per line or fixed price. */
  maxAmount: 1_000_000,
} as const

/** One priced line inside a package: an inclusion (`isAddon: false`) or an optional add-on the couple can tick. */
export interface PackageItem {
  id: string
  /** Rich text (or, for a card saved before this field took rich text, a legacy plain string) - the same `InlineField`/`TextBar` pairing every other proposal text field uses. */
  description: RichDoc | string
  /** Dollars. */
  amount: number
  quantity: number
  isAddon: boolean
  /** Add-ons only: ticked by default when the couple lands on the card. */
  defaultIncluded: boolean
}

/** One package card. */
export interface PackageOption {
  id: string
  /** Rich text (or a legacy plain string); see {@link PackageItem.description}. */
  title: RichDoc | string
  /** Rich text (or a legacy plain string); see {@link PackageItem.description}. */
  description: RichDoc | string
  /** `itemised` prices the card as the sum of its inclusions; `single` shows `fixedPrice` and lists inclusions unpriced. */
  pricingMode: ProposalPricingMode
  /** Dollars; read only in `single` mode. */
  fixedPrice: number | null
  /** How often a `single`-mode price recurs; unset (or `one_time`) shows the figure alone, with no `/ week` etc suffix. Template-only for now - see {@link PackagePriceFrequency}. Ignored in `itemised` mode. */
  priceFrequency?: PackagePriceFrequency
  /** How many decimal places the card's amounts (fixed price, inclusion and add-on amounts) display and are typed with; unset (or `cents`) shows `$150.00`, `whole` shows `$150` and rounds what is typed. Template-only for now - see {@link PackagePriceDecimals}. Only settable from the `single`-mode price popover, but honoured in both modes. */
  priceDecimals?: PackagePriceDecimals
  gstInclusive: boolean
  weekendLoadingPercent: number | null
  /** The "Most popular" badge. At most one card per section should carry it; the card menu enforces that by clearing the others. */
  isPopular: boolean
  /** Overrides the section's shared CTA label/colours for this card only (2026-09-19 feedback: "we just want it for that card where we are changing it"). Unset falls back to `PackagesData.ctaLabel`/`ctaBackgroundColor`/`ctaTextColor`. */
  ctaLabel?: string
  ctaBackgroundColor?: string
  ctaTextColor?: string
  items: PackageItem[]
}

/** A fresh client-side id; the `pk-`/`pi-` prefixes match the Branding editor's own item ids so a debugger can tell a package from a FAQ item at a glance. */
function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** A blank inclusion (or, with `isAddon`, an unticked add-on). */
export function newPackageItem(isAddon = false): PackageItem {
  return { id: newId('pi'), description: '', amount: 0, quantity: 1, isAddon, defaultIncluded: false }
}

/** A blank fixed-price package with one empty inclusion, so the new card has somewhere to type straight away. Fixed price is the default mode (2026-09-18 feedback), matching the three starter cards - itemised is opt-in from the card menu. */
export function newPackageOption(): PackageOption {
  return {
    id: newId('pk'), title: '', description: '', pricingMode: 'single', fixedPrice: 0, priceFrequency: 'one_time',
    priceDecimals: 'cents', gstInclusive: true, weekendLoadingPercent: null, isPopular: false, items: [newPackageItem()],
  }
}

/**
 * The three packages every new packages section starts with (2026-09-18
 * design pass: the old two-card, four-line-item itemised starters read as
 * dense boilerplate rather than a template someone can glance at and
 * finish themselves). Each is deliberately minimal - a title, a single
 * fixed price and one inclusion - so it reads as a card to fill in, not
 * one to delete first. Deterministic ids (never `newId`) so a fresh
 * section and the editor's fallback for a template saved before packages
 * lived in the block agree exactly, and so snapshot-style assertions stay
 * stable.
 */
export function starterPackages(): PackageOption[] {
  return [
    {
      id: 'pk-starter-1', title: 'Reception MC', description: '',
      pricingMode: 'single', fixedPrice: 1400, gstInclusive: true, weekendLoadingPercent: null, isPopular: false,
      items: [
        { id: 'pi-starter-1', description: 'Reception hosting (5 hours)', amount: 0, quantity: 1, isAddon: false, defaultIncluded: true },
      ],
    },
    {
      id: 'pk-starter-2', title: 'Full day', description: '',
      pricingMode: 'single', fixedPrice: 2200, gstInclusive: true, weekendLoadingPercent: null, isPopular: true,
      items: [
        { id: 'pi-starter-2', description: 'Ceremony and reception hosting', amount: 0, quantity: 1, isAddon: false, defaultIncluded: true },
      ],
    },
    {
      id: 'pk-starter-3', title: 'Premium', description: '',
      pricingMode: 'single', fixedPrice: 2800, gstInclusive: true, weekendLoadingPercent: null, isPopular: false,
      items: [
        { id: 'pi-starter-3', description: 'Full day hosting plus rehearsal', amount: 0, quantity: 1, isAddon: false, defaultIncluded: true },
      ],
    },
  ]
}

/**
 * The packages a section renders and edits: its own `options`, or the
 * starters until it has any. A v2 packages section always owns its
 * packages; the doc's `proposal.options` is never read through a v2
 * layout (Phase 4 fills `options` from the proposal's rows instead).
 */
export function resolvePackageOptions(data: { options?: PackageOption[] }): PackageOption[] {
  return data.options ?? starterPackages()
}

/** The `PricedOption` view of a package, for `lib/proposals/pricing`. */
export function pricedPackage(option: PackageOption): PricedOption {
  return {
    pricingMode: option.pricingMode,
    fixedPrice: option.fixedPrice,
    weekendLoadingPercent: option.weekendLoadingPercent,
    items: option.items.map((i) => ({ id: i.id, amount: i.amount, quantity: i.quantity, isAddon: i.isAddon })),
  }
}

/**
 * Adapt a layout package to the shape the shared card renderer takes.
 * `subtotal` is derived here, never stored, so it cannot go stale as
 * lines are edited. `title`/`description`/each item's `description` are
 * flattened to plain text ({@link plainText}): `PublicProposalOption` is
 * shared with the DB-backed shape a real (sent) proposal's own
 * `proposal_options` rows populate it with, which are plain `text`
 * columns, so it must stay a plain string here too - only the template
 * editor's own canvas (which renders the live `PackageOption` field
 * directly, never this adapted shape) shows the rich formatting.
 */
export function toPublicOption(option: PackageOption, position: number): PublicProposalOption {
  const items: PublicProposalItem[] = option.items.map((i, index) => ({
    id: i.id, description: plainText(i.description), note: null, amount: i.amount, quantity: i.quantity,
    is_addon: i.isAddon, default_included: i.defaultIncluded, position: index,
  }))
  const subtotal = option.pricingMode === 'single' ? (option.fixedPrice ?? 0) : optionBaseSubtotal(pricedPackage(option).items)
  return {
    id: option.id, position, title: plainText(option.title), description: plainText(option.description) || null,
    pricing_mode: option.pricingMode, fixed_price: option.fixedPrice, price_frequency: option.priceFrequency,
    price_decimals: option.priceDecimals, gst_inclusive: option.gstInclusive,
    weekend_loading_percent: option.weekendLoadingPercent, is_popular: option.isPopular, subtotal, items,
    cta_label: option.ctaLabel, cta_background_color: option.ctaBackgroundColor, cta_text_color: option.ctaTextColor,
  }
}
