/**
 * Derive an invoice's status from its payment stage rows.
 *
 * A payment schedule defines N stages, each with a due date and amount. When
 * a stage is paid, its `paid_at` field is stamped. The invoice's overall status
 * depends on how many stages remain unpaid:
 *
 * - No stage rows exist (stageless invoice): fully paid, so status = 'paid'.
 * - One or more stages remain unpaid: some payment pending, so status = 'deposit_paid'.
 * - All stage rows are paid: complete, so status = 'paid'.
 *
 * Note: `deposit_paid` is a slight misnomer under N stages (it is not necessarily
 * a deposit anymore), but renaming would touch badge maps, automations, and saved
 * filters. A later task relabels it to "Part paid" in the UI only, keeping the
 * stored value stable.
 *
 * @module lib/payments/invoice-status
 */
import type { Database } from '@/types/database'

export type StageRow = Pick<Database['public']['Tables']['invoice_payment_stages']['Row'], 'id' | 'paid_at'>

/**
 * Derive an invoice's status from its stage rows.
 *
 * @param stages - The stage rows for the invoice (can be empty).
 * @returns The status the invoice should have: 'paid' if fully settled, 'deposit_paid' if partially settled, or the given current status if nothing is paid yet.
 *
 * @example
 * // Stageless invoice (no stages)
 * deriveInvoiceStatusFromStages([]) // 'paid'
 *
 * // All stages paid
 * deriveInvoiceStatusFromStages([
 *   { id: 'st1', paid_at: '2026-07-02T00:00:00Z' },
 *   { id: 'st2', paid_at: '2026-07-02T00:00:00Z' },
 * ]) // 'paid'
 *
 * // Some stages paid
 * deriveInvoiceStatusFromStages([
 *   { id: 'st1', paid_at: '2026-07-02T00:00:00Z' },
 *   { id: 'st2', paid_at: null },
 * ]) // 'deposit_paid'
 *
 * // No stages paid
 * deriveInvoiceStatusFromStages([
 *   { id: 'st1', paid_at: null },
 *   { id: 'st2', paid_at: null },
 * ]) // undefined (caller must preserve current status)
 */
export function deriveInvoiceStatusFromStages(stages: StageRow[]): 'paid' | 'deposit_paid' | undefined {
  // Stageless invoice (no stage rows): nothing left to pay, so fully paid.
  if (stages.length === 0) {
    return 'paid'
  }

  // Count unpaid stages.
  const unpaidCount = stages.filter((s) => s.paid_at === null).length

  // All stages are paid: fully settled.
  if (unpaidCount === 0) {
    return 'paid'
  }

  // Some stages remain unpaid: partial payment received.
  if (unpaidCount > 0 && unpaidCount < stages.length) {
    return 'deposit_paid'
  }

  // No stages are paid yet: status unchanged (return undefined as signal).
  return undefined
}
