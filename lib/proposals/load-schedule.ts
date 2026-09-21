/**
 * Load the MC's payment schedule for the finalize service, as a portable
 * template the invoice maths can resolve against a concrete total.
 *
 * Split out of `./finalize` to keep that module focused on the RPC call.
 *
 * @module lib/proposals/load-schedule
 */
import { logger } from '@/lib/alerts/logger'
import type { createAdminClient } from '@/lib/supabase/admin'
import type { TemplateStage } from '@/types/payment-schedule'

/**
 * The proposal's own schedule when it names one; else the MC's default, but
 * only when the proposal also has no `deposit_percent`; else null (no
 * schedule: `buildInvoicePayload` then builds the deposit pair, or a single
 * full payment).
 *
 * Why the percent gates the default (ruling W1): the page and the contract
 * show the deposit from `deposit_percent`, so the invoice must carry that
 * same deposit. The MC's default schedule is a fallback for a proposal that
 * says nothing about payment, never an override of what the couple saw.
 *
 * Unlike `lib/payments/load-default-schedule.ts`, whose caller can render a
 * toast for a read error, this runs unattended off the anonymous sign route
 * with no UI to report to. A read error is therefore logged and folded into
 * the same `null` "no schedule" outcome as a genuinely missing schedule, so
 * the acceptance still finalizes (with the deposit/full-payment fallback)
 * instead of failing outright on an infrastructure blip.
 */
export async function loadSchedule(
  admin: ReturnType<typeof createAdminClient>,
  scheduleId: string | null,
  userId: string,
  depositPercent: number | null,
): Promise<TemplateStage[] | null> {
  if (!scheduleId && depositPercent != null && depositPercent > 0) return null
  let query = admin
    .from('payment_schedules')
    .select('id, payment_schedule_stages(position, label, amount_type, amount_value, due_offset_value, due_offset_unit, due_offset_anchor)')
    .eq('user_id', userId)
  query = scheduleId ? query.eq('id', scheduleId) : query.eq('is_default', true)
  const { data, error } = await query.maybeSingle()
  if (error) {
    logger.error('[proposals/load-schedule] schedule lookup failed', error, { userId, scheduleId })
    return null
  }
  if (!data) return null
  return (data.payment_schedule_stages ?? [])
    .sort((a, b) => a.position - b.position)
    .map((s) => ({
      label: s.label,
      amountType: s.amount_type as TemplateStage['amountType'],
      amountValue: s.amount_value,
      offsetValue: s.due_offset_value,
      offsetUnit: s.due_offset_unit as TemplateStage['offsetUnit'],
      offsetAnchor: s.due_offset_anchor as TemplateStage['offsetAnchor'],
    }))
}
