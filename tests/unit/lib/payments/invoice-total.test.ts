/**
 * The canonical invoice money math (`lib/payments/invoice-total`).
 * These figures must match what the public totals block renders —
 * the formula was extracted from there, so the cases below pin the
 * exact behaviour: percentage vs fixed discount, GST applied after
 * the discount, and non-positive discounts ignored.
 */
import { describe, expect, it } from 'vitest'

import { invoiceDiscountAmount, invoiceTotal } from '@/lib/payments/invoice-total'

describe('invoiceDiscountAmount', () => {
  it('is zero with no discount set', () => {
    expect(invoiceDiscountAmount({ subtotal: 100, taxRate: 10 })).toBe(0)
    expect(
      invoiceDiscountAmount({ subtotal: 100, taxRate: 10, discountType: null, discountValue: 50 }),
    ).toBe(0)
  })

  it('is zero for a non-positive discount value', () => {
    expect(
      invoiceDiscountAmount({ subtotal: 100, taxRate: 0, discountType: 'fixed', discountValue: 0 }),
    ).toBe(0)
    expect(
      invoiceDiscountAmount({ subtotal: 100, taxRate: 0, discountType: 'fixed', discountValue: -5 }),
    ).toBe(0)
  })

  it('computes a percentage discount off the subtotal', () => {
    expect(
      invoiceDiscountAmount({
        subtotal: 200,
        taxRate: 10,
        discountType: 'percentage',
        discountValue: 25,
      }),
    ).toBe(50)
  })

  it('treats a fixed discount as dollars', () => {
    expect(
      invoiceDiscountAmount({ subtotal: 200, taxRate: 10, discountType: 'fixed', discountValue: 30 }),
    ).toBe(30)
  })
})

describe('invoiceTotal', () => {
  it('is subtotal when there is no discount and no tax', () => {
    expect(invoiceTotal({ subtotal: 150, taxRate: 0 })).toBe(150)
  })

  it('applies GST after the discount', () => {
    // (1000 - 10%) = 900, + 10% GST = 990.
    expect(
      invoiceTotal({ subtotal: 1000, taxRate: 10, discountType: 'percentage', discountValue: 10 }),
    ).toBe(990)
  })

  it('applies GST on top of a fixed discount', () => {
    // (500 - 100) = 400, + 10% GST = 440.
    expect(
      invoiceTotal({ subtotal: 500, taxRate: 10, discountType: 'fixed', discountValue: 100 }),
    ).toBe(440)
  })
})
