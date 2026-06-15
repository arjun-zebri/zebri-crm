/**
 * `time_before_event` time-based emitter.
 *
 * Fires when an event's `date` is the configured number of days away
 * — e.g. an automation with `config.amount = 7` fires when the
 * wedding (or rehearsal) is exactly 7 days out; `amount = 0` fires on
 * the day itself. This is the "set and forget" backbone of MC flows
 * (countdown checklists, final-details requests, day-before nudges).
 *
 * # Day-grain only
 *
 * The offset is measured in **days** (locked 2026-06-14 — see
 * `automations-wiring.md`). The daily cron can't serve sub-day
 * offsets without upgrading Vercel, so the emitter ignores any
 * automation whose `unit` isn't `days`. The inspector offers no unit
 * picker, and `calendarConfig.unit` defaults to `days`.
 *
 * # Emit semantics
 *
 *   - One event per (event, days-before, calendar day). Two
 *     automations with the same `amount` share one event; different
 *     `amount` values get separate events.
 *   - Payload carries `days_before` + `event_type` so the trigger's
 *     {@link TriggerSpec.match} can narrow to this automation's
 *     configured lead-time and (optionally) event type.
 *   - Idempotency: an event with the same (`source_id`, `event_type`,
 *     `days_before`) already emitted today is skipped, so each event
 *     fires at most once per (lead-time, day) across ticks.
 *   - Cancelled events never fire — a called-off wedding shouldn't
 *     trigger a countdown reminder.
 *
 * # Known limitation
 *
 * Day boundaries are UTC, same as the `_due` / `_overdue` emitters:
 * an MC in AEDT sees "today" tick over at ~11am local. Acceptable
 * for day-grain countdown messaging; revisit if per-user timezones
 * are ever needed.
 *
 * @module lib/automations/time-emitters/time-before-event
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { getTriggerSpec } from '@/lib/automations/triggers'
import type { Database } from '@/types/database'

import type { TimeEmitter } from './index'

/**
 * An event row that could potentially fire. `event_type` isn't in the
 * generated `events` Row type yet (added by migration
 * `20260605000000`, types not regenerated), so this query uses the
 * untyped table access the other emitters use for the bus tables.
 */
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
 * The `events.date` value (a Postgres `date`, ISO `YYYY-MM-DD`) of an
 * event that is `days` from today.
 */
function eventDateForLeadDays(days: number): string {
  const today = new Date()
  const target = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  )
  target.setUTCDate(target.getUTCDate() + days)
  return target.toISOString().slice(0, 10)
}

/**
 * Resolve the day-grain lead-time from a raw `trigger_config` jsonb.
 *
 * Defers to the trigger spec's Zod schema so `unit`'s `.default('days')`
 * is applied uniformly. Returns null — i.e. the automation is skipped —
 * when the config is invalid, the amount is out of range, or the unit
 * isn't `days` (sub-day offsets are out of scope for the daily cron).
 */
function parseLeadDays(config: unknown): number | null {
  const spec = getTriggerSpec('time_before_event')
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
 * Collect every (user, days) pair across active `time_before_event`
 * automations. The emitter only emits for combinations at least one
 * active automation cares about.
 */
async function collectActiveLeadTimes(
  supabase: SupabaseClient<Database>,
): Promise<Map<string, Set<number>>> {
  const { data, error } = await supabase
    .from('automations' as never)
    .select('user_id, trigger_config')
    .eq('status', 'active')
    .eq('trigger_type', 'time_before_event')

  if (error) {
    throw new Error(`load time_before_event automations: ${error.message}`)
  }

  const grouped = new Map<string, Set<number>>()
  for (const row of (data ?? []) as Array<{
    user_id: string
    trigger_config: unknown
  }>) {
    const days = parseLeadDays(row.trigger_config)
    if (days === null) continue
    if (!grouped.has(row.user_id)) grouped.set(row.user_id, new Set())
    grouped.get(row.user_id)!.add(days)
  }
  return grouped
}

/**
 * Has an event already been emitted today for this (event, days_before)
 * bucket? Prevents re-emit across ticks within the same calendar day.
 */
async function alreadyEmittedToday(
  supabase: SupabaseClient<Database>,
  eventId: string,
  daysBefore: number,
  dayStart: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('automation_events' as never)
    .select('id')
    .eq('source_table', 'events')
    .eq('source_id', eventId)
    .eq('event_type', 'time_before_event')
    .gte('created_at', dayStart)
    .limit(50)

  if (error) throw new Error(`dedupe lookup: ${error.message}`)
  for (const row of (data ?? []) as Array<{ id: string }>) {
    const { data: full } = await supabase
      .from('automation_events' as never)
      .select('payload')
      .eq('id', row.id)
      .maybeSingle()
    const payload = (full as { payload?: { days_before?: unknown } } | null)
      ?.payload
    if (Number(payload?.days_before) === daysBefore) return true
  }
  return false
}

/**
 * Find events for `userId` whose `date` is exactly `days` away.
 * Cancelled events are excluded — a called-off event shouldn't fire a
 * countdown reminder.
 */
async function loadCandidates(
  supabase: SupabaseClient<Database>,
  userId: string,
  days: number,
): Promise<CandidateEvent[]> {
  const targetDate = eventDateForLeadDays(days)
  const { data, error } = await supabase
    .from('events' as never)
    .select('id, user_id, couple_id, date, event_type, title, status')
    .eq('user_id', userId)
    .eq('date', targetDate)
    .neq('status', 'cancelled')

  if (error) throw new Error(`load events: ${error.message}`)
  return (data ?? []) as CandidateEvent[]
}

/** Emit a single `time_before_event` event for an event at a lead-time. */
async function emit(
  supabase: SupabaseClient<Database>,
  event: CandidateEvent,
  daysBefore: number,
): Promise<void> {
  const { error } = await supabase.rpc('emit_automation_event' as never, {
    p_user_id: event.user_id,
    p_source_table: 'events',
    p_source_id: event.id,
    p_event_type: 'time_before_event',
    p_payload: {
      event_id: event.id,
      couple_id: event.couple_id,
      date: event.date,
      event_type: event.event_type,
      title: event.title,
      days_before: daysBefore,
    } as never,
    p_couple_id: event.couple_id,
  } as never)
  if (error) throw new Error(`emit time_before_event: ${error.message}`)
}

/**
 * The exported emitter. Reads active automations, fans out per
 * (user, lead-time) pair, dedupes per day, emits matching events.
 */
export const timeBeforeEventEmitter: TimeEmitter = {
  type: 'time_before_event',
  async run(supabase) {
    const dayStart = startOfUtcDay()
    const grouped = await collectActiveLeadTimes(supabase)
    if (grouped.size === 0) return 0

    let emitted = 0
    for (const [userId, leadTimes] of grouped) {
      for (const days of leadTimes) {
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
