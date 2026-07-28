/**
 * Draft-cleaning rules for editable line-item lists.
 *
 * @module lib/payments/line-item-draft
 */

/**
 * Normalize a drafted line-item list before save.
 *
 * A row that is entirely empty (blank description, zero amount) is an
 * abandoned "Add line item" click, not data, so it is dropped. A priced
 * row with no description would render as "Untitled item" on a
 * customer document, so it is kept but counted in `blankPriced` for
 * the form to block on.
 */
export function cleanLineItems<T extends { description: string; amount: number }>(
  items: T[],
): { items: T[]; blankPriced: number } {
  const kept = items
    .map((item) => ({ ...item, description: item.description.trim() }))
    .filter((item) => item.description !== '' || (Number(item.amount) || 0) !== 0)
  return { items: kept, blankPriced: kept.filter((i) => i.description === '').length }
}
