/**
 * `invoice_due` time-based emitter (A3).
 *
 * Fires when an invoice with status `'sent'` (i.e. a balance is still
 * outstanding — it hasn't been marked `paid` or `cancelled`) has a
 * `due_date` that matches the lead-time configured on an active
 * `invoice_due` automation. e.g. an automation with `config.days = 3`
 * fires on `due_date - 3 days`; `days = 0` fires on the due date
 * itself. Direct sibling of the A1 `quote_due` emitter — same shape,
 * same dedupe, anchored on the invoice's `due_date` instead of a
 * quote's `expires_at`.
 *
 * # Emit semantics
 *
 *   - One event per (invoice, days-lead-time, calendar day). Two
 *     automations with the same `days` value share the same event;
 *     two automations with different `days` get separate events.
 *   - Payload carries `days_until_due` so the trigger's
 *     {@link TriggerSpec.match} can narrow to "this automation's
 *     configured lead-time" — without that, all `invoice_due`
 *     automations would fire for every emitted event regardless of
 *     their lead-time (the A1 narrowing lesson).
 *   - Idempotency: an event with the same
 *     (`source_id`, `event_type`, `days_until_due`) already emitted
 *     today is skipped. Across ticks this means each invoice gets at
 *     most one event per (lead-time, day).
 *
 * # Known limitations
 *
 *   - Anchored on the top-level `due_date` only. Payment-schedule
 *     installment dates (`deposit_due_date` / `final_due_date`) are
 *     not yet wired — a future emitter or config flag can add them.
 *     The `isFinalBalance` config field is accepted by the schema but
 *     **not enforced** here for the same reason.
 *   - Only `status = 'sent'` invoices are candidates. A `draft`
 *     invoice hasn't reached the couple, and `paid` / `cancelled`
 *     invoices have no balance to chase.
 *   - Day boundaries are UTC (same AEDT caveat as `quote_due` — see
 *     that module).
 *
 * @module lib/automations/time-emitters/invoice-due
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { getTriggerSpec } from '@/lib/automations/triggers'
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

/**
 * Lower bound for "today" in UTC. Used by the dedupe query so we only
 * consider events already emitted on this calendar day.
 */
function startOfUtcDay(): string {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString()
}

/**
 * Render the `due_date` value (a Postgres `date`, ISO `YYYY-MM-DD`)
 * for an invoice whose lead-time is `days` from today.
 */
function dueDateForLeadDays(days: number): string {
  const today = new Date()
  const target = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  )
  target.setUTCDate(target.getUTCDate() + days)
  return target.toISOString().slice(0, 10)
}

/**
 * Resolve the `days` lead-time from a raw trigger_config jsonb.
 *
 * Defers to the trigger spec's Zod schema so the `.default(0)` on the
 * `days` field is applied uniformly — an automation saved before the
 * inspector wrote its defaults will have an empty config jsonb, and
 * without this `parseDays({})` would skip it even though the user
 * picked the trigger and never overrode the default (the A1 picker
 * regression). Returns null only when the config is unrecoverably
 * invalid; those automations are skipped rather than coerced.
 */
function parseDays(config: unknown): number | null {
  const spec = getTriggerSpec('invoice_due')
  if (!spec) return null
  const parsed = spec.configSchema.safeParse(config ?? {})
  if (!parsed.success) return null
  const days = (parsed.data as { days?: unknown }).days
  if (typeof days !== 'number' || !Number.isFinite(days)) return null
  if (days < 0 || days > 365) return null
  return Math.floor(days)
}

/**
 * Collect every (user, days) pair across active `invoice_due`
 * automations. The emitter only emits for combinations that at least
 * one active automation cares about — there's no value publishing
 * events nothing will match.
 */
async function collectActiveLeadTimes(
  supabase: SupabaseClient<Database>,
): Promise<Map<string, Set<number>>> {
  const { data, error } = await supabase
    .from('automations' as never)
    .select('user_id, trigger_config')
    .eq('status', 'active')
    .eq('trigger_type', 'invoice_due')

  if (error) throw new Error(`load invoice_due automations: ${error.message}`)

  const grouped = new Map<string, Set<number>>()
  for (const row of (data ?? []) as Array<{
    user_id: string
    trigger_config: unknown
  }>) {
    const days = parseDays(row.trigger_config)
    if (days === null) continue
    if (!grouped.has(row.user_id)) grouped.set(row.user_id, new Set())
    grouped.get(row.user_id)!.add(days)
  }
  return grouped
}

/**
 * Has an event already been emitted today for this
 * (invoice, days_until_due) bucket? Prevents re-emit across ticks
 * within the same calendar day.
 */
async function alreadyEmittedToday(
  supabase: SupabaseClient<Database>,
  invoiceId: string,
  daysUntilDue: number,
  dayStart: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('automation_events' as never)
    .select('id, payload')
    .eq('source_table', 'invoices')
    .eq('source_id', invoiceId)
    .eq('event_type', 'invoice_due')
    .gte('created_at', dayStart)
    .limit(50)

  if (error) throw new Error(`dedupe lookup: ${error.message}`)
  // Narrow by payload field in JS — JSON path operators aren't
  // ergonomic via PostgREST, and the per-day window is already tiny.
  for (const row of (data ?? []) as Array<{
    id: string
    payload: { days_until_due?: unknown } | null
  }>) {
    if (Number(row.payload?.days_until_due) === daysUntilDue) return true
  }
  return false
}

/**
 * Find invoices for `userId` that should fire `invoice_due` today for
 * the given `days` lead-time. Only `sent` invoices are candidates —
 * draft invoices haven't reached the couple, and paid / cancelled
 * invoices have no balance to chase.
 */
async function loadCandidates(
  supabase: SupabaseClient<Database>,
  userId: string,
  days: number,
): Promise<CandidateInvoice[]> {
  const targetDate = dueDateForLeadDays(days)
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
 * Emit a single `invoice_due` event for an invoice at a given
 * lead-time. The RPC bypasses RLS via SECURITY DEFINER, which is
 * exactly what we want — the tick is system-initiated.
 */
async function emit(
  supabase: SupabaseClient<Database>,
  invoice: CandidateInvoice,
  daysUntilDue: number,
): Promise<void> {
  const { error } = await supabase.rpc('emit_automation_event' as never, {
    p_user_id: invoice.user_id,
    p_source_table: 'invoices',
    p_source_id: invoice.id,
    p_event_type: 'invoice_due',
    p_payload: {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      couple_id: invoice.couple_id,
      due_date: invoice.due_date,
      subtotal: invoice.subtotal,
      days_until_due: daysUntilDue,
    } as never,
    p_couple_id: invoice.couple_id,
  } as never)
  if (error) throw new Error(`emit invoice_due: ${error.message}`)
}

/**
 * The exported emitter. Reads active automations, fans out per
 * (user, lead-time) pair, dedupes per day, emits matching events.
 */
export const invoiceDueEmitter: TimeEmitter = {
  type: 'invoice_due',
  async run(supabase) {
    const dayStart = startOfUtcDay()
    const grouped = await collectActiveLeadTimes(supabase)
    if (grouped.size === 0) return 0

    let emitted = 0
    for (const [userId, leadTimes] of grouped) {
      for (const days of leadTimes) {
        const candidates = await loadCandidates(supabase, userId, days)
        for (const invoice of candidates) {
          if (await alreadyEmittedToday(supabase, invoice.id, days, dayStart)) {
            continue
          }
          await emit(supabase, invoice, days)
          emitted += 1
        }
      }
    }
    return emitted
  },
}
