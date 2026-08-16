/**
 * The canonical invoice money math: subtotal → discount → GST → total.
 *
 * Extracted from the public totals block (`lib/branding/public-blocks/
 * totals.tsx`) so every surface that needs a grand total (public
 * invoice, admin value metrics) computes the same number the couple
 * sees. Never re-derive this formula inline.
 *
 * @module lib/payments/invoice-total
 */

/** The scalar money columns stored on an `invoices` row. */
export interface InvoiceTotalInput {
  /** Sum of the line items, in dollars. */
  subtotal: number
  /** GST percentage applied after the discount (e.g. 10 for 10%). */
  taxRate: number
  /** `'percentage'` | `'fixed'` as stored in `invoices.discount_type`. */
  discountType?: string | null
  /** Percent (0-100) or dollar amount, depending on `discountType`. */
  discountValue?: number | null
}

/**
 * Dollar value of the discount line. Zero when no discount is set or
 * the value is non-positive.
 */
export function invoiceDiscountAmount(input: InvoiceTotalInput): number {
  const value = input.discountValue ?? 0
  if (!input.discountType || value <= 0) return 0
  return input.discountType === 'percentage' ? (input.subtotal * value) / 100 : value
}

/**
 * The grand total the couple is asked to pay:
 * `(subtotal - discount) * (1 + taxRate/100)`.
 */
export function invoiceTotal(input: InvoiceTotalInput): number {
  const taxable = input.subtotal - invoiceDiscountAmount(input)
  return taxable + taxable * (input.taxRate / 100)
}
