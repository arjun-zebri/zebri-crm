/**
 * "How much is left to pay on this invoice, and when is it next due."
 *
 * A stageless invoice is binary: unpaid (owes the full total) or paid
 * (owes nothing) — driven by `invoices.status`. A staged invoice
 * (one or more `invoice_payment_stages` rows) can be partially paid,
 * so the balance is the total minus whatever stages already carry a
 * `paid_at`. Both cases are handled here so callers (the Invoices
 * list, the payments reports ledger) never re-derive this branch.
 *
 * Amounts are computed in cents throughout: `invoice_payment_stages
 * .amount_cents` is already an integer, and `invoiceTotal()` returns
 * dollars, so it is rounded once at the boundary rather than summed
 * as floats.
 *
 * @module lib/payments/invoice-balance
 */
import { invoiceTotal, type InvoiceTotalInput } from '@/lib/payments/invoice-total'

/** The invoice fields needed to compute its balance. */
export interface InvoiceBalanceInput extends InvoiceTotalInput {
  status: string
  /** Optional: only used for a stageless invoice's "next due" date. */
  due_date?: string | null
}

/** The stage fields needed to compute an invoice's balance. */
export interface StageBalanceInput {
  amount_cents: number
  paid_at: string | null
  due_date: string | null
}

/** Result of {@link getInvoiceBalance}. All money values are in cents. */
export interface InvoiceBalance {
  /** The grand total (subtotal - discount + GST), in cents. */
  totalCents: number
  /** Sum of what has actually been paid, in cents. */
  paidCents: number
  /** What is still owed, in cents. Never negative. */
  balanceCents: number
  /** The soonest unpaid due date, or null if nothing is owed / no
   *  due date is set. */
  nextDueDate: string | null
  /** True once nothing is owed (including cancelled invoices, which
   *  are excluded from balance reporting entirely). */
  isFullyPaid: boolean
}

/** The `invoices` row shape as it comes back from Supabase (snake_case). */
export interface DbInvoiceMoneyFields {
  subtotal: number
  tax_rate: number
  discount_type: string | null
  discount_value: number | null
  status: string
  due_date: string | null
}

/**
 * {@link getInvoiceBalance}, taking the raw Supabase row shape instead
 * of `InvoiceTotalInput`'s camelCase fields — every caller reads
 * `invoices` straight off the wire, so this is the one it should use.
 */
export function getInvoiceBalanceFromDb(
  invoice: DbInvoiceMoneyFields,
  stages: StageBalanceInput[],
): InvoiceBalance {
  return getInvoiceBalance(
    {
      subtotal: invoice.subtotal,
      taxRate: invoice.tax_rate,
      discountType: invoice.discount_type,
      discountValue: invoice.discount_value,
      status: invoice.status,
      due_date: invoice.due_date,
    },
    stages,
  )
}

/**
 * Derive the outstanding balance + next due date for one invoice.
 *
 * @param invoice - The invoice's money + status fields.
 * @param stages - That invoice's `invoice_payment_stages` rows, if any (empty for a stageless invoice).
 */
export function getInvoiceBalance(
  invoice: InvoiceBalanceInput,
  stages: StageBalanceInput[],
): InvoiceBalance {
  const totalCents = Math.round(invoiceTotal(invoice) * 100)

  // A cancelled invoice owes nothing, regardless of what was or wasn't
  // paid before cancellation — it should never appear as outstanding.
  if (invoice.status === 'cancelled') {
    return { totalCents, paidCents: 0, balanceCents: 0, nextDueDate: null, isFullyPaid: true }
  }

  if (stages.length === 0) {
    const isFullyPaid = invoice.status === 'paid'
    return {
      totalCents,
      paidCents: isFullyPaid ? totalCents : 0,
      balanceCents: isFullyPaid ? 0 : totalCents,
      nextDueDate: isFullyPaid ? null : (invoice.due_date ?? null),
      isFullyPaid,
    }
  }

  const paidCents = stages
    .filter((s) => s.paid_at !== null)
    .reduce((sum, s) => sum + s.amount_cents, 0)
  // Clamp rather than trust the subtraction: stage amounts are frozen at
  // apply-time and a later discount/tax-rate edit can leave them stale.
  const balanceCents = Math.max(totalCents - paidCents, 0)

  const nextUnpaid = stages
    .filter((s) => s.paid_at === null && s.due_date !== null)
    .sort((a, b) => (a.due_date as string).localeCompare(b.due_date as string))[0]

  return {
    totalCents,
    paidCents,
    balanceCents,
    nextDueDate: balanceCents === 0 ? null : (nextUnpaid?.due_date ?? null),
    isFullyPaid: balanceCents === 0,
  }
}
