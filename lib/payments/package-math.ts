/**
 * Pure money math for packages (v2 commercial fields).
 *
 * A package item's `amount` is the PER-UNIT price; `quantity` defaults
 * to 1 so pre-v2 rows are unchanged. Items flagged `optional` are
 * add-ons offered alongside the base package: they never count toward
 * the package's headline total, and the builders let the MC tick which
 * ones to include when applying.
 *
 * Quote/invoice line items (and the builders' items table) carry no
 * quantity, so applying flattens a multi-unit item to "N × description"
 * with the line total as its amount.
 *
 * All amounts are AUD dollars; results are rounded to cents.
 *
 * @module lib/payments/package-math
 */

/** The priced shape package math operates on (a `package_items` row subset). */
export interface PackagePricedItem {
  description: string
  /** Per-unit price in dollars. */
  amount: number
  /** Unit count; missing/invalid values are treated as 1. */
  quantity?: number | null
  /** True for an add-on offered alongside the base package. */
  optional?: boolean | null
}

/** A flattened line ready for a quote/invoice items table (no quantity). */
export interface FlattenedLineItem {
  description: string
  amount: number
}

/** Round to whole cents: keeps float drift out of displayed totals. */
function roundCents(amount: number): number {
  return Math.round(amount * 100) / 100
}

/** Coerce a stored quantity to something multipliable (bad data → 1). */
function safeQuantity(quantity: number | null | undefined): number {
  return typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0 ? quantity : 1
}

/** Line total for one item: quantity × per-unit amount, in cents-rounded dollars. */
export function lineTotal(item: PackagePricedItem): number {
  return roundCents(safeQuantity(item.quantity) * (Number(item.amount) || 0))
}

/**
 * How a package arrives at its base price.
 *
 * `itemised` (the default, and every package created before this existed) sums
 * the required line items. `single` ignores those amounts entirely: the items
 * are unpriced inclusions and {@link PackagePricing.fixedPrice} is the price.
 *
 * The distinction exists because an MC selling "the Gold package, $2,400"
 * otherwise had to invent per-line figures that add to 2400, and the couple
 * then saw a breakdown the MC never meant to quote.
 */
export type PackagePricingMode = 'itemised' | 'single'

/** The package-level pricing fields `packageTotals` needs. */
export interface PackagePricing {
  /** Missing or null is treated as `itemised`, so old rows are unaffected. */
  pricingMode?: PackagePricingMode | null
  /** The whole base price in `single` mode. Ignored when itemised. */
  fixedPrice?: number | null
}

/**
 * Base (required), add-on (optional), and combined totals for a package.
 *
 * Add-ons stay individually priced in BOTH modes: "a single total" is about
 * the base package the couple is quoted, while an add-on is a discrete extra
 * the MC ticks on, and it has to carry its own price to be worth offering.
 *
 * @param items - Every package item, base and optional.
 * @param pricing - Package-level pricing. Omit for itemised (the default).
 */
export function packageTotals(
  items: readonly PackagePricedItem[],
  pricing?: PackagePricing,
): {
  base: number
  addOns: number
  full: number
} {
  let base = 0
  let addOns = 0
  for (const item of items) {
    if (item.optional) addOns += lineTotal(item)
    else base += lineTotal(item)
  }
  if (pricing?.pricingMode === 'single') {
    base = Number(pricing.fixedPrice) || 0
  }
  return { base: roundCents(base), addOns: roundCents(addOns), full: roundCents(base + addOns) }
}

/**
 * Flatten a package item for a quantity-less items table: multi-unit
 * items become "N × description" priced at the line total.
 */
export function flattenItem(item: PackagePricedItem): FlattenedLineItem {
  const quantity = safeQuantity(item.quantity)
  return {
    // Trailing zeros trimmed ("1.5 ×", not "1.50 ×").
    description: quantity === 1 ? item.description : `${String(quantity)} × ${item.description}`,
    amount: lineTotal(item),
  }
}

/**
 * The transparent peak-rate line appended when a package with a weekend
 * loading is applied ("Weekend rate loading (15%)" = 15% of `subtotal`).
 * Returns null when the loading is unset/zero or nothing is priced;
 * the MC deletes the line for an off-peak date.
 */
export function weekendLoadingLine(
  subtotal: number,
  loadingPercent: number | null | undefined,
): FlattenedLineItem | null {
  if (!loadingPercent || loadingPercent <= 0 || subtotal <= 0) return null
  return {
    description: `Weekend rate loading (${String(loadingPercent)}%)`,
    amount: roundCents(subtotal * (loadingPercent / 100)),
  }
}
