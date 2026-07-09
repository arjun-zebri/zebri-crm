/**
 * Currency display helpers shared by the templates and builders UI.
 *
 * @module lib/payments/format
 */

/**
 * Format an amount as AUD, hiding cents when they are zero.
 *
 * Inputs accept cents (`step="0.01"`), so always rounding to whole
 * dollars misreports totals; always showing `.00` adds noise. Rounding
 * to cents first avoids float artifacts like 10.999 rendering as
 * "$10.99" with a lost cent.
 */
export function formatAUD(amount: number): string {
  const cents = Math.round((Number(amount) || 0) * 100)
  const digits = cents % 100 === 0 ? 0 : 2
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(cents / 100)
}
