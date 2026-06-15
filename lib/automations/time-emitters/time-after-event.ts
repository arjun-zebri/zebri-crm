/**
 * `time_after_event` time-based emitter (T2).
 *
 * Mirror of {@link timeBeforeEventEmitter} on the far side of the
 * event date: fires when an event's `date` is the configured number
 * of days **in the past** — e.g. an automation with `config.amount = 1`
 * fires the day after the wedding (thank-you), `amount = 7` a week
 * after (review request). `amount = 0` fires on the event day itself.
 *
 * Day-grain only, same as T1: the emitter ignores any automation whose
 * `unit` isn't `days`, and cancelled events never fire. Day boundaries
 * are UTC. See `automations-wiring.md` for the locked decision.
 *
 * # Emit semantics
 *
 *   - One event per (event, days-after, calendar day). Payload carries
 *     `days_after` + `event_type` so {@link TriggerSpec.match} narrows
 *     to this automation's configured lag and (optional) event type.
 *   - Idempotency: dedupe by (`source_id`, `event_type`, `days_after`)
 *     within the UTC calendar day.
 *
 * @module lib/automations/time-emitters/time-after-event
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { getTriggerSpec } from '@/lib/automations/triggers'
import type { Database } from '@/types/database'

import type { TimeEmitter } from './index'

/** An event row that could potentially fire (see T1 for the cast note). */
interface CandidateEvent {
  id: string
  user_id: string
  couple_id: string
  date: string
  event_type: string | null
  title: string | null
}

/** Lower bound for "today" in UTC — used to scope the dedupe query. */
function startOfUtcDay(): string {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString()
}

/**
 * The `events.date` value (ISO `YYYY-MM-DD`) of an event that was
 * `days` in the past relative to today.
 */
function eventDateForLagDays(days: number): string {
  const today = new Date()
  const target = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  )
  target.setUTCDate(target.getUTCDate() - days)
  return target.toISOString().slice(0, 10)
}

/**
 * Resolve the day-grain lag from a raw `trigger_config` jsonb. Returns
 * null (skip the automation) when the config is invalid, the amount is
 * out of range, or the unit isn't `days`.
 */
function parseLagDays(config: unknown): number | null {
  const spec = getTriggerSpec('time_after_event')
  if (!spec) return null
  const parsed = spec.configSchema.safeParse(config ?? {})
  if (!parsed.success) return null
  const data = parsed.data as { amount?: unknown; unit?: unknown }
  if (data.unit !== 'days') return null
  const amount = data.amount
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return null
  if (amount < 0 || amount > 365) return null
  return Math.floor(amount)
}

/**
 * Collect every (user, days) pair across active `time_after_event`
 * automations — the emitter only emits for lags an active automation
 * actually cares about.
 */
async function collectActiveLags(
  supabase: SupabaseClient<Database>,
): Promise<Map<string, Set<number>>> {
  const { data, error } = await supabase
    .from('automations' as never)
    .select('user_id, trigger_config')
    .eq('status', 'active')
    .eq('trigger_type', 'time_after_event')

  if (error) {
    throw new Error(`load time_after_event automations: ${error.message}`)
  }

  const grouped = new Map<string, Set<number>>()
  for (const row of (data ?? []) as Array<{
    user_id: string
    trigger_config: unknown
  }>) {
    const days = parseLagDays(row.trigger_config)
    if (days === null) continue
    if (!grouped.has(row.user_id)) grouped.set(row.user_id, new Set())
    grouped.get(row.user_id)!.add(days)
  }
  return grouped
}

/**
 * Has an event already been emitted today for this (event, days_after)
 * bucket? Prevents re-emit across ticks within the same calendar day.
 */
async function alreadyEmittedToday(
  supabase: SupabaseClient<Database>,
  eventId: string,
  daysAfter: number,
  dayStart: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('automation_events' as never)
    .select('id')
    .eq('source_table', 'events')
    .eq('source_id', eventId)
    .eq('event_type', 'time_after_event')
    .gte('created_at', dayStart)
    .limit(50)

  if (error) throw new Error(`dedupe lookup: ${error.message}`)
  for (const row of (data ?? []) as Array<{ id: string }>) {
    const { data: full } = await supabase
      .from('automation_events' as never)
      .select('payload')
      .eq('id', row.id)
      .maybeSingle()
    const payload = (full as { payload?: { days_after?: unknown } } | null)
      ?.payload
    if (Number(payload?.days_after) === daysAfter) return true
  }
  return false
}

/** Find events for `userId` whose `date` was exactly `days` ago. */
async function loadCandidates(
  supabase: SupabaseClient<Database>,
  userId: string,
  days: number,
): Promise<CandidateEvent[]> {
  const targetDate = eventDateForLagDays(days)
  const { data, error } = await supabase
    .from('events' as never)
    .select('id, user_id, couple_id, date, event_type, title, status')
    .eq('user_id', userId)
    .eq('date', targetDate)
    .neq('status', 'cancelled')

  if (error) throw new Error(`load events: ${error.message}`)
  return (data ?? []) as CandidateEvent[]
}

/** Emit a single `time_after_event` event for an event at a given lag. */
async function emit(
  supabase: SupabaseClient<Database>,
  event: CandidateEvent,
  daysAfter: number,
): Promise<void> {
  const { error } = await supabase.rpc('emit_automation_event' as never, {
    p_user_id: event.user_id,
    p_source_table: 'events',
    p_source_id: event.id,
    p_event_type: 'time_after_event',
    p_payload: {
      event_id: event.id,
      couple_id: event.couple_id,
      date: event.date,
      event_type: event.event_type,
      title: event.title,
      days_after: daysAfter,
    } as never,
    p_couple_id: event.couple_id,
  } as never)
  if (error) throw new Error(`emit time_after_event: ${error.message}`)
}

/**
 * The exported emitter. Reads active automations, fans out per
 * (user, lag) pair, dedupes per day, emits matching events.
 */
export const timeAfterEventEmitter: TimeEmitter = {
  type: 'time_after_event',
  async run(supabase) {
    const dayStart = startOfUtcDay()
    const grouped = await collectActiveLags(supabase)
    if (grouped.size === 0) return 0

    let emitted = 0
    for (const [userId, lags] of grouped) {
      for (const days of lags) {
        const candidates = await loadCandidates(supabase, userId, days)
        for (const event of candidates) {
          if (await alreadyEmittedToday(supabase, event.id, days, dayStart)) {
            continue
          }
          await emit(supabase, event, days)
          emitted += 1
        }
      }
    }
    return emitted
  },
}
