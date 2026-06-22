/**
 * `quote_overdue` time-based emitter (A2).
 *
 * Fires when a quote with status `'sent'` has sat past its
 * `expires_at` for the threshold configured on an active
 * `quote_overdue` automation. The threshold is
 * `max(1, daysOverdueMin ?? 1)` — see
 * {@link quoteOverdueThresholdDays} — so "overdue" always means
 * strictly past the expiry date; the expiry day itself belongs to
 * `quote_due` with `days: 0`.
 *
 * # Emit semantics
 *
 *   - One event per (quote, threshold, calendar day). A quote fires
 *     once when it crosses each active threshold — not every day it
 *     remains overdue. Two automations with the same threshold share
 *     one event; different thresholds get separate events on their
 *     respective days.
 *   - Payload carries `days_overdue` so the trigger's match() can
 *     narrow to "this automation's threshold" — the same pattern as
 *     `quote_due`'s `days_until_due`.
 *   - Idempotency: an event with the same
 *     (`source_id`, `event_type`, `days_overdue`) already emitted
 *     today is skipped.
 *
 * # Known limitations
 *
 *   - Day boundaries are UTC (same as `quote_due` — see that module
 *     for the AEDT caveat).
 *   - `couplePreviouslyViewed` config is accepted by the schema but
 *     not enforced: quote view tracking doesn't exist yet. The
 *     emitter ignores it and the automation fires regardless.
 *   - The emitter only fires forward: a quote already deeper overdue
 *     than the threshold when the automation is activated will not
 *     retro-fire (triggers fire forward only — wiring doc, "What
 *     this plan does NOT cover").
 *
 * @module lib/automations/time-emitters/quote-overdue
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  getTriggerSpec,
  quoteOverdueThresholdDays,
} from '@/lib/automations/triggers'
import type { Database } from '@/types/database'

import type { TimeEmitter } from './index'

/** A quote row that could potentially fire. */
interface CandidateQuote {
  id: string
  user_id: string
  couple_id: string | null
  quote_number: string | null
  expires_at: string | null
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
 * Render the `expires_at` value (a Postgres `date`, ISO
 * `YYYY-MM-DD`) for a quote that is exactly `daysOverdue` days past
 * expiry today.
 */
function expiryDateForOverdueDays(daysOverdue: number): string {
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
 * Returns null if the config is unrecoverably invalid — those
 * automations are skipped rather than silently coerced.
 */
function parseThreshold(config: unknown): number | null {
  const spec = getTriggerSpec('quote_overdue')
  if (!spec) return null
  const parsed = spec.configSchema.safeParse(config ?? {})
  if (!parsed.success) return null
  const data = parsed.data as {
    daysOverdueMin?: number
    daysOverdueMax?: number
  }
  const threshold = quoteOverdueThresholdDays(data)
  // An impossible window (max below the effective min) can never
  // match() — don't emit events nothing will route.
  if (data.daysOverdueMax !== undefined && threshold > data.daysOverdueMax) {
    return null
  }
  return threshold
}

/**
 * Collect every (user, threshold) pair across active `quote_overdue`
 * automations — the emitter only emits combinations something will
 * actually match.
 */
async function collectActiveThresholds(
  supabase: SupabaseClient<Database>,
): Promise<Map<string, Set<number>>> {
  const { data, error } = await supabase
    .from('automations' as never)
    .select('user_id, trigger_config')
    .eq('status', 'active')
    .eq('trigger_type', 'quote_overdue')

  if (error) {
    throw new Error(`load quote_overdue automations: ${error.message}`)
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
 * (quote, days_overdue) bucket? Prevents re-emit across ticks
 * within the same calendar day.
 */
async function alreadyEmittedToday(
  supabase: SupabaseClient<Database>,
  quoteId: string,
  daysOverdue: number,
  dayStart: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('automation_events' as never)
    .select('id, payload')
    .eq('source_table', 'quotes')
    .eq('source_id', quoteId)
    .eq('event_type', 'quote_overdue')
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
 * Find quotes for `userId` that cross the `daysOverdue` threshold
 * today. Only `sent` quotes are candidates — draft / accepted /
 * declined quotes aren't awaiting a response.
 */
async function loadCandidates(
  supabase: SupabaseClient<Database>,
  userId: string,
  daysOverdue: number,
): Promise<CandidateQuote[]> {
  const targetDate = expiryDateForOverdueDays(daysOverdue)
  const { data, error } = await supabase
    .from('quotes')
    .select('id, user_id, couple_id, quote_number, expires_at, subtotal')
    .eq('user_id', userId)
    .eq('status', 'sent')
    .eq('expires_at', targetDate)

  if (error) throw new Error(`load quotes: ${error.message}`)
  return (data ?? []) as CandidateQuote[]
}

/**
 * Emit a single `quote_overdue` event. The RPC bypasses RLS via
 * SECURITY DEFINER — correct for a system-initiated tick.
 */
async function emit(
  supabase: SupabaseClient<Database>,
  quote: CandidateQuote,
  daysOverdue: number,
): Promise<void> {
  const { error } = await supabase.rpc('emit_automation_event' as never, {
    p_user_id: quote.user_id,
    p_source_table: 'quotes',
    p_source_id: quote.id,
    p_event_type: 'quote_overdue',
    p_payload: {
      quote_id: quote.id,
      quote_number: quote.quote_number,
      couple_id: quote.couple_id,
      expires_at: quote.expires_at,
      subtotal: quote.subtotal,
      days_overdue: daysOverdue,
    } as never,
    p_couple_id: quote.couple_id,
  } as never)
  if (error) throw new Error(`emit quote_overdue: ${error.message}`)
}

/**
 * The exported emitter. Reads active automations, fans out per
 * (user, threshold) pair, dedupes per day, emits matching events.
 */
export const quoteOverdueEmitter: TimeEmitter = {
  type: 'quote_overdue',
  async run(supabase) {
    const dayStart = startOfUtcDay()
    const grouped = await collectActiveThresholds(supabase)
    if (grouped.size === 0) return 0

    let emitted = 0
    for (const [userId, thresholds] of grouped) {
      for (const daysOverdue of thresholds) {
        const candidates = await loadCandidates(supabase, userId, daysOverdue)
        for (const quote of candidates) {
          if (
            await alreadyEmittedToday(supabase, quote.id, daysOverdue, dayStart)
          ) {
            continue
          }
          await emit(supabase, quote, daysOverdue)
          emitted += 1
        }
      }
    }
    return emitted
  },
}
