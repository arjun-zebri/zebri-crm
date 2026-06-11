/**
 * `invoice_overdue` time-based emitter (A4).
 *
 * Fires when an invoice with status `'sent'` (a balance is still
 * outstanding) has sat past its `due_date` for the threshold
 * configured on an active `invoice_overdue` automation. The threshold
 * is `max(1, daysOverdueMin ?? 1)` — see
 * {@link invoiceOverdueThresholdDays} — so "overdue" always means
 * strictly past the due date; the due date itself belongs to
 * `invoice_due` with `days: 0`. Direct sibling of the A2
 * `quote_overdue` emitter.
 *
 * # Emit semantics
 *
 *   - One event per (invoice, threshold, calendar day). An invoice
 *     fires once when it crosses each active threshold — not every
 *     day it remains overdue. Two automations with the same threshold
 *     share one event; different thresholds get separate events on
 *     their respective days.
 *   - Payload carries `days_overdue` so the trigger's match() can
 *     narrow to "this automation's threshold" — same pattern as
 *     `quote_overdue`'s `days_overdue` and `invoice_due`'s
 *     `days_until_due`.
 *   - Idempotency: an event with the same
 *     (`source_id`, `event_type`, `days_overdue`) already emitted
 *     today is skipped.
 *
 * # Known limitations
 *
 *   - Anchored on the top-level `due_date` only. Payment-schedule
 *     installment dates (`deposit_due_date` / `final_due_date`) are
 *     not yet wired. The `isFinalBalance` and
 *     `daysUntilEventOp`/`daysUntilEventValue` config fields are
 *     accepted by the schema but **not enforced** here — the emitter
 *     payload carries no event-date anchor, and final-balance
 *     tracking is out of A4's scope.
 *   - Only `status = 'sent'` invoices are candidates (draft hasn't
 *     reached the couple; paid / cancelled have no balance).
 *   - Day boundaries are UTC (same caveat as `quote_due`).
 *   - Fires forward only: an invoice already deeper overdue than the
 *     threshold when the automation is activated will not retro-fire.
 *
 * @module lib/automations/time-emitters/invoice-overdue
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  getTriggerSpec,
  invoiceOverdueThresholdDays,
} from '@/lib/automations/triggers'
import type { Database } from '@/types/database'

import type { TimeEmitter } from './index'

/** An invoice row that could potentially fire. */
interface CandidateInvoice {
  id: string
  user_id: string
  couple_id: string | null
  invoice_number: string | null
  due_date: string | null
  subtotal: number | null
}

/** Lower bound for "today" in UTC, for the per-day dedupe window. */
function startOfUtcDay(): string {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString()
}

/**
 * Render the `due_date` value (a Postgres `date`, ISO `YYYY-MM-DD`)
 * for an invoice that is exactly `daysOverdue` days past its due date
 * today.
 */
function dueDateForOverdueDays(daysOverdue: number): string {
  const today = new Date()
  const target = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  )
  target.setUTCDate(target.getUTCDate() - daysOverdue)
  return target.toISOString().slice(0, 10)
}

/**
 * Resolve the effective overdue threshold from a raw trigger_config
 * jsonb. Defers to the trigger spec's Zod schema so saved-but-empty
 * configs behave like the defaults (the A1 picker regression).
 * Returns null if the config is unrecoverably invalid, or describes
 * an impossible window (max below the effective min) that match()
 * could never accept — those automations are skipped rather than
 * having events emitted that nothing will route.
 */
function parseThreshold(config: unknown): number | null {
  const spec = getTriggerSpec('invoice_overdue')
  if (!spec) return null
  const parsed = spec.configSchema.safeParse(config ?? {})
  if (!parsed.success) return null
  const data = parsed.data as {
    daysOverdueMin?: number
    daysOverdueMax?: number
  }
  const threshold = invoiceOverdueThresholdDays(data)
  if (data.daysOverdueMax !== undefined && threshold > data.daysOverdueMax) {
    return null
  }
  return threshold
}

/**
 * Collect every (user, threshold) pair across active
 * `invoice_overdue` automations — the emitter only emits combinations
 * something will actually match.
 */
async function collectActiveThresholds(
  supabase: SupabaseClient<Database>,
): Promise<Map<string, Set<number>>> {
  const { data, error } = await supabase
    .from('automations' as never)
    .select('user_id, trigger_config')
    .eq('status', 'active')
    .eq('trigger_type', 'invoice_overdue')

  if (error) {
    throw new Error(`load invoice_overdue automations: ${error.message}`)
  }

  const grouped = new Map<string, Set<number>>()
  for (const row of (data ?? []) as Array<{
    user_id: string
    trigger_config: unknown
  }>) {
    const threshold = parseThreshold(row.trigger_config)
    if (threshold === null) continue
    if (!grouped.has(row.user_id)) grouped.set(row.user_id, new Set())
    grouped.get(row.user_id)!.add(threshold)
  }
  return grouped
}

/**
 * Has an event already been emitted today for this
 * (invoice, days_overdue) bucket? Prevents re-emit across ticks
 * within the same calendar day.
 */
async function alreadyEmittedToday(
  supabase: SupabaseClient<Database>,
  invoiceId: string,
  daysOverdue: number,
  dayStart: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('automation_events' as never)
    .select('id, payload')
    .eq('source_table', 'invoices')
    .eq('source_id', invoiceId)
    .eq('event_type', 'invoice_overdue')
    .gte('created_at', dayStart)
    .limit(50)

  if (error) throw new Error(`dedupe lookup: ${error.message}`)
  // Narrow by payload field in JS — JSON path operators aren't
  // ergonomic via PostgREST, and the per-day window is already tiny.
  for (const row of (data ?? []) as Array<{
    id: string
    payload: { days_overdue?: unknown } | null
  }>) {
    if (Number(row.payload?.days_overdue) === daysOverdue) return true
  }
  return false
}

/**
 * Find invoices for `userId` that cross the `daysOverdue` threshold
 * today. Only `sent` invoices are candidates — draft / paid /
 * cancelled invoices aren't an outstanding balance to chase.
 */
async function loadCandidates(
  supabase: SupabaseClient<Database>,
  userId: string,
  daysOverdue: number,
): Promise<CandidateInvoice[]> {
  const targetDate = dueDateForOverdueDays(daysOverdue)
  const { data, error } = await supabase
    .from('invoices')
    .select('id, user_id, couple_id, invoice_number, due_date, subtotal')
    .eq('user_id', userId)
    .eq('status', 'sent')
    .eq('due_date', targetDate)

  if (error) throw new Error(`load invoices: ${error.message}`)
  return (data ?? []) as CandidateInvoice[]
}

/**
 * Emit a single `invoice_overdue` event. The RPC bypasses RLS via
 * SECURITY DEFINER — correct for a system-initiated tick.
 */
async function emit(
  supabase: SupabaseClient<Database>,
  invoice: CandidateInvoice,
  daysOverdue: number,
): Promise<void> {
  const { error } = await supabase.rpc('emit_automation_event' as never, {
    p_user_id: invoice.user_id,
    p_source_table: 'invoices',
    p_source_id: invoice.id,
    p_event_type: 'invoice_overdue',
    p_payload: {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      couple_id: invoice.couple_id,
      due_date: invoice.due_date,
      subtotal: invoice.subtotal,
      days_overdue: daysOverdue,
    } as never,
    p_couple_id: invoice.couple_id,
  } as never)
  if (error) throw new Error(`emit invoice_overdue: ${error.message}`)
}

/**
 * The exported emitter. Reads active automations, fans out per
 * (user, threshold) pair, dedupes per day, emits matching events.
 */
export const invoiceOverdueEmitter: TimeEmitter = {
  type: 'invoice_overdue',
  async run(supabase) {
    const dayStart = startOfUtcDay()
    const grouped = await collectActiveThresholds(supabase)
    if (grouped.size === 0) return 0

    let emitted = 0
    for (const [userId, thresholds] of grouped) {
      for (const daysOverdue of thresholds) {
        const candidates = await loadCandidates(supabase, userId, daysOverdue)
        for (const invoice of candidates) {
          if (
            await alreadyEmittedToday(
              supabase,
              invoice.id,
              daysOverdue,
              dayStart,
            )
          ) {
            continue
          }
          await emit(supabase, invoice, daysOverdue)
          emitted += 1
        }
      }
    }
    return emitted
  },
}
