/**
 * Cash-basis payment ledger for the Payments Reports tab.
 *
 * Most sole traders/small businesses lodge tax on a cash basis (income
 * counted when it's *received*, not when it's invoiced), so the report
 * is built from individual payments — each paid `invoice_payment_stage`,
 * or the single payment of a stageless invoice — not from invoice
 * totals. That is also exactly the ledger an accountant wants at tax
 * time: one row per dollar that actually landed.
 *
 * GST: an invoice carries one `tax_rate` applied to its whole total, so
 * every payment against it carries GST at that same rate — this is
 * exact, not an approximation. `netCents = grossCents / (1 + rate/100)`.
 *
 * @module lib/payments/report-transactions
 */
import type { StageBalanceInput } from '@/lib/payments/invoice-balance'
import { invoiceTotal } from '@/lib/payments/invoice-total'

/** A stage row plus its display label, for the transaction description. */
export interface ReportStageInput extends StageBalanceInput {
  label: string
}

/** The invoice fields a report transaction is derived from. */
export interface ReportInvoiceInput {
  id: string
  invoice_number: string
  status: string
  subtotal: number
  tax_rate: number
  discount_type: string | null
  discount_value: number | null
  paid_at: string | null
  couple: { name: string }
}

/** One payment actually received, in cents, net/GST split out. */
export interface PaymentTransaction {
  invoiceId: string
  invoiceNumber: string
  coupleName: string
  /** Stage label, or "Payment" for a stageless invoice. */
  description: string
  /** ISO date the payment was received. */
  paidAt: string
  grossCents: number
  gstCents: number
  netCents: number
}

/** Split a gross (tax-inclusive) amount into net + GST at `taxRate` percent. */
function splitGst(grossCents: number, taxRate: number): { netCents: number; gstCents: number } {
  if (taxRate <= 0) return { netCents: grossCents, gstCents: 0 }
  const netCents = Math.round(grossCents / (1 + taxRate / 100))
  return { netCents, gstCents: grossCents - netCents }
}

/**
 * Every payment actually received for one invoice (cash-basis), oldest
 * first. Cancelled invoices contribute nothing — any stage marked paid
 * before cancellation is presumed refunded/void for reporting purposes.
 */
export function getInvoiceTransactions(
  invoice: ReportInvoiceInput,
  stages: ReportStageInput[],
): PaymentTransaction[] {
  if (invoice.status === 'cancelled') return []

  const shared = {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    coupleName: invoice.couple.name,
  }

  if (stages.length === 0) {
    if (invoice.status !== 'paid' || !invoice.paid_at) return []
    const grossCents = Math.round(
      invoiceTotal({
        subtotal: invoice.subtotal,
        taxRate: invoice.tax_rate,
        discountType: invoice.discount_type,
        discountValue: invoice.discount_value,
      }) * 100,
    )
    return [
      { ...shared, description: 'Payment', paidAt: invoice.paid_at, grossCents, ...splitGst(grossCents, invoice.tax_rate) },
    ]
  }

  return stages
    .filter((s): s is ReportStageInput & { paid_at: string } => s.paid_at !== null)
    .map((s) => ({
      ...shared,
      description: s.label,
      paidAt: s.paid_at,
      grossCents: s.amount_cents,
      ...splitGst(s.amount_cents, invoice.tax_rate),
    }))
    .sort((a, b) => a.paidAt.localeCompare(b.paidAt))
}

/** Transactions whose `paidAt` date falls within `[start, end]` (inclusive). */
export function filterTransactionsByDate(
  transactions: PaymentTransaction[],
  range: { start: string; end: string },
): PaymentTransaction[] {
  return transactions.filter((t) => {
    const date = t.paidAt.slice(0, 10)
    return date >= range.start && date <= range.end
  })
}

/** Sum of gross/net/GST across a set of transactions. */
export function summarizeTransactions(transactions: PaymentTransaction[]): {
  grossCents: number
  netCents: number
  gstCents: number
} {
  return transactions.reduce(
    (acc, t) => ({
      grossCents: acc.grossCents + t.grossCents,
      netCents: acc.netCents + t.netCents,
      gstCents: acc.gstCents + t.gstCents,
    }),
    { grossCents: 0, netCents: 0, gstCents: 0 },
  )
}

/** The `lib/utils/csv#downloadCsv` input shape for a ledger export. */
export interface TransactionsCsv {
  headers: string[]
  rows: Array<Array<string | number>>
  filename: string
}

/** Shape a transaction list into the accountant-facing CSV export. */
export function toTransactionsCsv(
  transactions: PaymentTransaction[],
  range: { start: string; end: string },
): TransactionsCsv {
  return {
    headers: ['Date', 'Invoice', 'Couple', 'Description', 'Net (AUD)', 'GST (AUD)', 'Gross (AUD)'],
    rows: transactions.map((t) => [
      t.paidAt.slice(0, 10),
      t.invoiceNumber,
      t.coupleName,
      t.description,
      (t.netCents / 100).toFixed(2),
      (t.gstCents / 100).toFixed(2),
      (t.grossCents / 100).toFixed(2),
    ]),
    filename: `payments-${range.start}-to-${range.end}`,
  }
}
