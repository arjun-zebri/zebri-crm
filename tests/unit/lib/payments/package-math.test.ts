/**
 * Money math for packages v2 (quantities, optional add-ons, weekend
 * loading). These numbers land verbatim on quotes and invoices, so the
 * rounding and flattening rules are worth pinning exactly.
 */
import { describe, expect, it } from 'vitest'

import {
  flattenItem,
  lineTotal,
  packageTotals,
  weekendLoadingLine,
} from '@/lib/payments/package-math'

describe('lineTotal', () => {
  it('multiplies quantity by the per-unit amount', () => {
    expect(lineTotal({ description: 'Extra hour', amount: 150, quantity: 2 })).toBe(300)
  })

  it('treats a missing, null, zero, or negative quantity as 1', () => {
    expect(lineTotal({ description: 'x', amount: 550 })).toBe(550)
    expect(lineTotal({ description: 'x', amount: 550, quantity: null })).toBe(550)
    expect(lineTotal({ description: 'x', amount: 550, quantity: 0 })).toBe(550)
    expect(lineTotal({ description: 'x', amount: 550, quantity: -2 })).toBe(550)
  })

  it('rounds to whole cents', () => {
    // 3 × 33.335 = 100.005 → 100.01, not 100.00499…
    expect(lineTotal({ description: 'x', amount: 33.335, quantity: 3 })).toBe(100.01)
  })
})

describe('packageTotals', () => {
  const items = [
    { description: 'Ceremony hosting', amount: 550 },
    { description: 'Reception MC', amount: 900 },
    { description: 'Rehearsal attendance', amount: 200, optional: true },
    { description: 'Extra hour', amount: 150, quantity: 2, optional: true },
  ]

  it('splits base, add-ons, and full totals', () => {
    expect(packageTotals(items)).toEqual({ base: 1450, addOns: 500, full: 1950 })
  })

  it('returns zeros for an empty package', () => {
    expect(packageTotals([])).toEqual({ base: 0, addOns: 0, full: 0 })
  })
})

describe('flattenItem', () => {
  it('passes single-unit items through unchanged', () => {
    expect(flattenItem({ description: 'Ceremony hosting', amount: 550 })).toEqual({
      description: 'Ceremony hosting',
      amount: 550,
    })
  })

  it('prefixes multi-unit items with the count and prices the line total', () => {
    expect(flattenItem({ description: 'Extra hour', amount: 150, quantity: 2 })).toEqual({
      description: '2 × Extra hour',
      amount: 300,
    })
  })

  it('keeps fractional quantities readable', () => {
    expect(flattenItem({ description: 'Travel (hrs)', amount: 100, quantity: 1.5 })).toEqual({
      description: '1.5 × Travel (hrs)',
      amount: 150,
    })
  })
})

describe('weekendLoadingLine', () => {
  it('computes the loading off the subtotal with a transparent label', () => {
    expect(weekendLoadingLine(1450, 15)).toEqual({
      description: 'Weekend rate loading (15%)',
      amount: 217.5,
    })
  })

  it('returns null when unset, zero, or there is nothing to load', () => {
    expect(weekendLoadingLine(1450, null)).toBeNull()
    expect(weekendLoadingLine(1450, undefined)).toBeNull()
    expect(weekendLoadingLine(1450, 0)).toBeNull()
    expect(weekendLoadingLine(0, 15)).toBeNull()
  })
})

describe('packageTotals — single-price mode', () => {
  // An MC selling "the Gold package, $2,400" should not have to invent
  // per-line figures that add up to it. In single mode the line items are
  // unpriced inclusions and `fixedPrice` is the base.
  const inclusions = [
    { description: 'MC Ceremony', amount: 0, quantity: 1 },
    { description: 'Reception hosting', amount: 0, quantity: 1 },
    { description: 'Rehearsal', amount: 250, quantity: 1, optional: true },
  ]

  it('uses the fixed price as the base, ignoring item amounts', () => {
    expect(packageTotals(inclusions, { pricingMode: 'single', fixedPrice: 2400 })).toEqual({
      base: 2400,
      addOns: 250,
      full: 2650,
    })
  })

  it('still prices add-ons individually in single mode', () => {
    // "One total" is about the base package the couple is quoted; an add-on is
    // a discrete extra and has to carry its own price to be worth offering.
    const { addOns } = packageTotals(inclusions, { pricingMode: 'single', fixedPrice: 2400 })
    expect(addOns).toBe(250)
  })

  it('ignores stray item prices that a mode switch left behind', () => {
    // Switching an itemised package to single must not double-count: the old
    // per-item figures stay in the DB but stop contributing.
    const leftovers = [
      { description: 'MC Ceremony', amount: 900, quantity: 1 },
      { description: 'Reception hosting', amount: 1100, quantity: 1 },
    ]
    expect(packageTotals(leftovers, { pricingMode: 'single', fixedPrice: 2400 }).base).toBe(2400)
  })

  it('treats a missing fixed price as zero rather than falling back to the sum', () => {
    // A half-configured single-price package should read as $0, which is
    // visibly wrong to the MC, rather than silently quoting the item sum they
    // deliberately stopped maintaining.
    expect(packageTotals(inclusions, { pricingMode: 'single', fixedPrice: null }).base).toBe(0)
  })

  it('is unchanged for itemised packages and when no pricing is passed', () => {
    const priced = [
      { description: 'MC Ceremony', amount: 900, quantity: 1 },
      { description: 'Rehearsal', amount: 250, quantity: 1, optional: true },
    ]
    const withoutPricing = packageTotals(priced)
    expect(packageTotals(priced, { pricingMode: 'itemised' })).toEqual(withoutPricing)
    expect(packageTotals(priced, { pricingMode: null, fixedPrice: 9999 })).toEqual(withoutPricing)
    expect(withoutPricing.base).toBe(900)
  })
})
