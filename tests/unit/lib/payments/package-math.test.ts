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
