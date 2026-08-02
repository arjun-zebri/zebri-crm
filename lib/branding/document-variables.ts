/**
 * Document variable registry for the branding editor's rich-text fields.
 *
 * A "variable" is an inline token the MC drops into free text (e.g.
 * `{{ couple_name }}`) that renders mint-green in the editor and resolves to the
 * real value on the sent document. This module is the single source of truth for
 * which variables each surface offers, their human labels, and how their value
 * is formatted. It is pure (no React, no TipTap) so both the editor and the
 * server-side renderer can import it.
 *
 * Value extraction from each surface's payload lives at that surface (it knows
 * its own shape); this module only defines the catalogue and formatting.
 *
 * @module lib/branding/document-variables
 */
import type { SurfaceTab } from '@/types/branding-preview'

/** How a variable's raw value is rendered to a display string. */
export type VariableFormat = 'text' | 'currency' | 'date'

/** A single insertable variable. */
export interface DocumentVariable {
  /** Stable id stored on the chip (`data-variable`) and used to resolve the value. */
  id: string
  /** Human label shown in the insert menu and inside the `{{ … }}` chip. */
  label: string
  /** Grouping for the insert menu (e.g. "Couple", "Document", "Business"). */
  group: string
  /** Controls display formatting when resolving to the sent document. */
  format: VariableFormat
  /** Plain-language note on how the value is filled, shown as a hover tooltip. */
  source: string
}

const COUPLE: DocumentVariable[] = [
  { id: 'couple_name', label: 'Couple name', group: 'Couple', format: 'text', source: "Filled with the couple's name when the document is sent." },
  { id: 'event_date', label: 'Wedding date', group: 'Couple', format: 'date', source: "The wedding date from the couple's details." },
  { id: 'venue', label: 'Venue', group: 'Couple', format: 'text', source: "The venue from the couple's details." },
]

const BUSINESS: DocumentVariable[] = [
  { id: 'business_name', label: 'Business name', group: 'Business', format: 'text', source: 'Your business name, from Settings → Branding.' },
  { id: 'abn', label: 'ABN', group: 'Business', format: 'text', source: 'Your ABN, from Settings → Branding.' },
  { id: 'business_phone', label: 'Phone', group: 'Business', format: 'text', source: 'Your phone number, from Settings → Branding.' },
  { id: 'business_website', label: 'Website', group: 'Business', format: 'text', source: 'Your website, from Settings → Branding.' },
  { id: 'business_email', label: 'Email', group: 'Business', format: 'text', source: 'Your email, from Settings → Branding.' },
]

const INVOICE_DOC: DocumentVariable[] = [
  { id: 'invoice_number', label: 'Invoice number', group: 'Document', format: 'text', source: 'The invoice number, assigned when the invoice is sent.' },
  { id: 'issue_date', label: 'Issue date', group: 'Document', format: 'date', source: 'The date the invoice is issued.' },
  { id: 'due_date', label: 'Due date', group: 'Document', format: 'date', source: "The invoice's due date." },
  { id: 'subtotal', label: 'Subtotal', group: 'Amounts', format: 'currency', source: 'Calculated from the invoice line items.' },
  { id: 'tax', label: 'Tax', group: 'Amounts', format: 'currency', source: 'The GST calculated on the invoice.' },
  { id: 'total', label: 'Total', group: 'Amounts', format: 'currency', source: 'The invoice total (line items plus tax).' },
  { id: 'deposit_amount', label: 'Deposit amount', group: 'Amounts', format: 'currency', source: 'The first payment on the invoice\'s schedule.' },
  { id: 'deposit_due_date', label: 'Deposit due date', group: 'Amounts', format: 'date', source: 'The first payment\'s due date.' },
  { id: 'final_amount', label: 'Final amount', group: 'Amounts', format: 'currency', source: 'The final balance from the payment schedule.' },
  { id: 'final_due_date', label: 'Final due date', group: 'Amounts', format: 'date', source: 'The final balance due date from the payment schedule.' },
]

const CONTRACT_DOC: DocumentVariable[] = [
  { id: 'contract_number', label: 'Contract number', group: 'Document', format: 'text', source: 'The contract number, assigned when the contract is sent.' },
  { id: 'expiry_date', label: 'Expiry date', group: 'Document', format: 'date', source: "The document's expiry date." },
  { id: 'signer_name', label: 'Signer name', group: 'Document', format: 'text', source: "The signer's name on the contract." },
]

/**
 * Variables offered on each surface. Line-item tables and totals stay
 * structured blocks; these are the text-shaped values that become inline chips.
 */
export const VARIABLES_BY_SURFACE: Record<SurfaceTab, DocumentVariable[]> = {
  invoice: [...COUPLE, ...INVOICE_DOC, ...BUSINESS],
  contract: [...COUPLE, ...CONTRACT_DOC, ...BUSINESS],
  portal: [...COUPLE, ...BUSINESS],
  vendorTimeline: [...COUPLE, ...BUSINESS],
  questionnaire: [...COUPLE, ...BUSINESS],
}

/** Flat lookup of every known variable id to its definition, across all surfaces. */
const ALL_VARIABLES: Map<string, DocumentVariable> = new Map(
  Object.values(VARIABLES_BY_SURFACE)
    .flat()
    .map((v) => [v.id, v]),
)

/**
 * Look up a variable definition by id, regardless of surface. Returns undefined
 * for an unknown id (e.g. a chip left over from another surface).
 */
export function getVariable(id: string): DocumentVariable | undefined {
  return ALL_VARIABLES.get(id)
}

/**
 * Whether `id` is a known variable. Used by the sanitizer/renderer to reject
 * chips carrying an unregistered id.
 */
export function isKnownVariable(id: string): boolean {
  return ALL_VARIABLES.has(id)
}

/**
 * Format a raw value for display on the sent document, per the variable's
 * declared format. A null/undefined/empty raw value returns `''` so a missing
 * value renders empty rather than a raw `{{ … }}` chip.
 *
 * @param format - The variable's format kind.
 * @param raw - The raw value from the surface payload (string for text/date, number for currency).
 */
export function formatVariableValue(format: VariableFormat, raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined || raw === '') return ''
  switch (format) {
    case 'currency': {
      const n = typeof raw === 'number' ? raw : Number(raw)
      if (!Number.isFinite(n)) return ''
      return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)
    }
    case 'date': {
      // Parse a YYYY-MM-DD string in UTC to avoid timezone drift, matching the
      // public renderers' fmtDate. Non-date strings pass through unchanged.
      const s = String(raw)
      if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return s
      return new Date(s.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-AU', {
        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
      })
    }
    case 'text':
    default:
      return String(raw)
  }
}
