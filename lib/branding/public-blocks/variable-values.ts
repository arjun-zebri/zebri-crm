/**
 * Build the variable id -> display value map for a public document surface.
 *
 * The rich-text renderer resolves `{{ … }}` chips against this map. Values come
 * from the branding (business identity) and the document payload (couple,
 * numbers, dates, amounts). Ids not available on a given surface simply resolve
 * to empty. Several surfaces share generic payload fields (`refNumber`,
 * `expiresAt`), so the surface-specific ids (`invoice_number` /
 * `contract_number` / …) all map to the same source; a surface only ever offers
 * the ids that make sense for it, so mapping the extras is harmless.
 *
 * @module lib/branding/public-blocks/variable-values
 */
import { formatVariableValue } from '../document-variables'
import type { PublicBranding } from '../public-surface'

import type { PublicDocData } from './shared'

/**
 * Compute the resolved, formatted variable values for a document.
 *
 * @param branding - The public branding (business identity fields).
 * @param doc - The document payload (couple, ref number, dates, amounts).
 */
export function buildVariableValues(
  branding: PublicBranding,
  doc: PublicDocData,
): Record<string, string> {
  const discount =
    doc.discountType && (doc.discountValue ?? 0) > 0
      ? doc.discountType === 'percentage'
        ? doc.subtotal * (doc.discountValue ?? 0) / 100
        : (doc.discountValue ?? 0)
      : 0
  const taxable = doc.subtotal - discount
  const tax = taxable * (doc.taxRate / 100)
  const total = taxable + tax

  const refNumber = doc.refNumber || ''
  const dateValue = doc.expiresAt ?? ''

  return {
    // Couple
    couple_name: formatVariableValue('text', doc.coupleName ?? ''),
    event_date: formatVariableValue('date', doc.eventDate ?? ''),
    venue: formatVariableValue('text', doc.venue ?? ''),
    // Business identity
    business_name: formatVariableValue('text', branding.business_name ?? ''),
    abn: formatVariableValue('text', branding.abn ?? ''),
    business_phone: formatVariableValue('text', branding.phone ?? ''),
    business_website: formatVariableValue('text', branding.website ?? ''),
    // Document number (surface-specific ids share the generic ref field)
    invoice_number: formatVariableValue('text', refNumber),
    contract_number: formatVariableValue('text', refNumber),
    // Document date (due / expiry share the generic expiresAt field)
    due_date: formatVariableValue('date', dateValue),
    expiry_date: formatVariableValue('date', dateValue),
    // Amounts
    subtotal: formatVariableValue('currency', doc.subtotal),
    tax: formatVariableValue('currency', tax),
    total: formatVariableValue('currency', total),
  }
}
