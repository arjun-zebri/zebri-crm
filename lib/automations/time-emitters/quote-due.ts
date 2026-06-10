/**
 * `quote_due` time-based emitter.
 *
 * Fires when a quote with status `'sent'` has an `expires_at` that
 * matches the lead-time configured on an active `quote_due`
 * automation. e.g. an automation with `config.days = 3` fires on
 * `expires_at - 3 days`; `days = 0` fires on the expiry date itself.
 *
 * Today there is no `quote_due_date` column on `quotes` — the
 * canonical "due date" for a quote is `expires_at` (when the offer
 * to the couple lapses). That's the date the MC means when they
 * pick "Quote due" in the builder. Other domains (invoices, tasks,
 * events) each have their own due-date column and will be wired by
 * separate emitters following the same shape as this one.
 *
 * # Emit semantics
 *
 *   - One event per (quote, days-lead-time, calendar day). Two
 *     automations with the same `days` value share the same event;
 *     two automations with different `days` get separate events.
 *   - Payload carries `days_until_due` so the trigger's
 *     {@link TriggerSpec.match} can narrow to "this automation's
 *     configured lead-time" — without that, all `quote_due`
 *     automations would fire for every emitted event, regardless of
 *     their lead-time.
 *   - Idempotency: an event with the same
 *     (`source_id`, `event_type`, `days_until_due`) already emitted
 *     today is skipped. Across ticks this means each quote gets at
 *     most one event per (lead-time, day).
 *
 * # Known limitation
 *
 * Day boundaries are computed against UTC. An MC working in
 * AEDT (UTC+11) will see "today" tick over at 11 am local time
 * rather than midnight. For Phase 14a foundation this is acceptable
 * — most due-date messaging tolerates a same-day offset. A future
 * pass can read each user's timezone from their MC snapshot and
 * compute the bucket per-user.
 *
 * @module lib/automations/time-emitters/quote-due
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { getTriggerSpec } from '@/lib/automations/triggers'
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

/**
 * Lower bound for "today" in UTC. Used by the dedupe query so we
 * only consider events already emitted on this calendar day.
 */
function startOfUtcDay(): string {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString()
}

/**
 * Render the `expires_at` value (a Postgres `date`) for a quote
 * whose lead-time is `days` from today. Postgres dates are
 * ISO `YYYY-MM-DD`.
 */
function expiryDateForLeadDays(days: number): string {
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
 * Defers to the trigger spec's Zod schema so the `.default(0)` on
 * the `days` field is applied uniformly. An automation that was
 * saved before the inspector wrote its defaults will have an empty
 * config jsonb — without this, `parseDays({})` would return null
 * and skip the automation, even though the user picked the trigger
 * and never overrode the default.
 *
 * Returns null only if the config is unrecoverably invalid (e.g.
 * `days: -5` or `days: 'huh'`) — those automations are skipped
 * rather than silently coerced.
 */
function parseDays(config: unknown): number | null {
  const spec = getTriggerSpec('quote_due')
  if (!spec) return null
  const parsed = spec.configSchema.safeParse(config ?? {})
  if (!parsed.success) return null
  const days = (parsed.data as { days?: unknown }).days
  if (typeof days !== 'number' || !Number.isFinite(days)) return null
  if (days < 0 || days > 365) return null
  return Math.floor(days)
}

/**
 * Collect every (user, days) pair across active `quote_due`
 * automations. The emitter only emits for combinations that at
 * least one active automation cares about — there's no value
 * publishing events that nothing will match.
 */
async function collectActiveLeadTimes(
  supabase: SupabaseClient<Database>,
): Promise<Map<string, Set<number>>> {
  const { data, error } = await supabase
    .from('automations' as never)
    .select('user_id, trigger_config')
    .eq('status', 'active')
    .eq('trigger_type', 'quote_due')

  if (error) throw new Error(`load quote_due automations: ${error.message}`)

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
 * (quote, days_until_due) bucket? Prevents re-emit across ticks
 * within the same calendar day.
 */
async function alreadyEmittedToday(
  supabase: SupabaseClient<Database>,
  quoteId: string,
  daysUntilDue: number,
  dayStart: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('automation_events' as never)
    .select('id')
    .eq('source_table', 'quotes')
    .eq('source_id', quoteId)
    .eq('event_type', 'quote_due')
    .gte('created_at', dayStart)
    .limit(50)

  if (error) throw new Error(`dedupe lookup: ${error.message}`)
  // Filter by payload field in JS — JSON path operators aren't
  // ergonomic via PostgREST, and the gating is already narrow.
  for (const row of (data ?? []) as Array<{
    id: string
  }>) {
    // The `id` row alone doesn't tell us the days_until_due. Pull
    // payload separately for any candidate matches — there's almost
    // never more than one row at this point thanks to the per-day
    // bucket.
    const { data: full } = await supabase
      .from('automation_events' as never)
      .select('payload')
      .eq('id', row.id)
      .maybeSingle()
    const payload = (full as { payload?: { days_until_due?: unknown } } | null)
      ?.payload
    const existing = Number(payload?.days_until_due)
    if (existing === daysUntilDue) return true
  }
  return false
}

/**
 * Find quotes for `userId` that should fire `quote_due` today for
 * the given `days` lead-time. Only `sent` quotes are candidates —
 * draft / accepted / declined don't have a meaningful "due date"
 * notion from a chase-up automation's perspective.
 */
async function loadCandidates(
  supabase: SupabaseClient<Database>,
  userId: string,
  days: number,
): Promise<CandidateQuote[]> {
  const targetDate = expiryDateForLeadDays(days)
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
 * Emit a single `quote_due` event for a quote at a given lead-time.
 * The RPC bypasses RLS via SECURITY DEFINER, which is exactly what
 * we want — the tick is system-initiated, not user-initiated.
 */
async function emit(
  supabase: SupabaseClient<Database>,
  quote: CandidateQuote,
  daysUntilDue: number,
): Promise<void> {
  const { error } = await supabase.rpc('emit_automation_event' as never, {
    p_user_id: quote.user_id,
    p_source_table: 'quotes',
    p_source_id: quote.id,
    p_event_type: 'quote_due',
    p_payload: {
      quote_id: quote.id,
      quote_number: quote.quote_number,
      couple_id: quote.couple_id,
      expires_at: quote.expires_at,
      subtotal: quote.subtotal,
      days_until_due: daysUntilDue,
    } as never,
    p_couple_id: quote.couple_id,
  } as never)
  if (error) throw new Error(`emit quote_due: ${error.message}`)
}

/**
 * The exported emitter. Reads active automations, fans out per
 * (user, lead-time) pair, dedupes per day, emits matching events.
 */
export const quoteDueEmitter: TimeEmitter = {
  type: 'quote_due',
  async run(supabase) {
    const dayStart = startOfUtcDay()
    const grouped = await collectActiveLeadTimes(supabase)
    if (grouped.size === 0) return 0

    let emitted = 0
    for (const [userId, leadTimes] of grouped) {
      for (const days of leadTimes) {
        const candidates = await loadCandidates(supabase, userId, days)
        for (const quote of candidates) {
          if (await alreadyEmittedToday(supabase, quote.id, days, dayStart)) {
            continue
          }
          await emit(supabase, quote, days)
          emitted += 1
        }
      }
    }
    return emitted
  },
}
