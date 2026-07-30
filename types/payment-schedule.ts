/**
 * Shared domain types for custom payment schedules.
 *
 * A *template* stage lives on a saved `payment_schedules` row and stores a
 * relative due offset, so it is portable to any future invoice. A *resolved*
 * stage lives on `invoice_payment_stages` and stores a concrete date and an
 * integer cent amount, frozen at apply time so a paid stage cannot shift when
 * the MC later edits a line item.
 *
 * @module types/payment-schedule
 */

/** How a stage's amount is expressed. */
export type StageAmountType = 'percent' | 'fixed' | 'remainder'

/**
 * One stage on a saved, reusable schedule.
 *
 * `amountValue` is a percentage for `'percent'`, **dollars** for `'fixed'`, and
 * null for `'remainder'`. Dollars rather than cents because the rest of the
 * invoice surface (`invoices.subtotal`) is dollars; only the resolved
 * `amountCents` is in cents.
 */
export interface TemplateStage {
  label: string
  amountType: StageAmountType
  amountValue: number | null
  /** Days after the invoice issue date that this stage falls due. */
  dueOffsetDays: number
}

/** One stage stamped onto a specific invoice, with its amount frozen. */
export interface ResolvedStage {
  /** 1-based, contiguous, ascending. */
  position: number
  label: string
  amountType: StageAmountType
  amountValue: number | null
  amountCents: number
  /** ISO `YYYY-MM-DD`, or null when the stage carries no date. */
  dueDate: string | null
}

/** A saved schedule with its template stages. */
export interface PaymentSchedule {
  id: string
  name: string
  isDefault: boolean
  stages: TemplateStage[]
}

/** A stage row read back from `invoice_payment_stages`. */
export interface InvoiceStage extends ResolvedStage {
  id: string
  paidAt: string | null
}
