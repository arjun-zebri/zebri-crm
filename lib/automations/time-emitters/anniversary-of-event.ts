/**
 * `anniversary_of_event` time-based emitter (T3).
 *
 * Fires on the calendar anniversary of an event — when today's MM-DD
 * matches the event's MM-DD and the elapsed whole years matches the
 * automation's config. `config.years = 1` fires on the first
 * anniversary; with `config.maxYears` set, it fires every year from
 * `years` through `maxYears` (e.g. years 1–5).
 *
 * # Semantics & limitations
 *
 *   - Anniversaries are for **past** events only (elapsed ≥ 1 year).
 *   - MM-DD is matched exactly against UTC "today", so a 29 Feb event
 *     only fires in leap years. Acceptable for a nice-to-have reminder.
 *   - One event per (event, years-since, calendar day); payload carries
 *     `years_since` so {@link TriggerSpec.match} routes it to the
 *     automation(s) whose `years` (or `years..maxYears` range) it hits.
 *   - Cancelled events never fire.
 *
 * Per-user events are loaded once and the MM-DD match is done in JS —
 * PostgREST can't filter on a month-day expression, and an MC's
 * past-event count is small enough for a daily tick.
 *
 * @module lib/automations/time-emitters/anniversary-of-event
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { getTriggerSpec } from '@/lib/automations/triggers'
import type { Database } from '@/types/database'

import type { TimeEmitter } from './index'

interface CandidateEvent {
  id: string
  user_id: string
  couple_id: string
  date: string
  event_type: string | null
  title: string | null
}

interface AnniversaryConfig {
  years: number
  maxYears?: number
}

/** Lower bound for "today" in UTC — scopes the dedupe query. */
function startOfUtcDay(): string {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString()
}

/** Today's MM-DD + full year in UTC. */
function utcToday(): { mmdd: string; year: number; iso: string } {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const day = String(now.getUTCDate()).padStart(2, '0')
  return { mmdd: `${month}-${day}`, year, iso: `${year}-${month}-${day}` }
}

/** Does an elapsed-years value match this automation's config? */
function matchesConfig(elapsed: number, cfg: AnniversaryConfig): boolean {
  if (cfg.maxYears !== undefined) {
    return elapsed >= cfg.years && elapsed <= cfg.maxYears
  }
  return elapsed === cfg.years
}

/** Parse a raw trigger_config into the year fields (Zod defaults applied). */
function parseConfig(config: unknown): AnniversaryConfig | null {
  const spec = getTriggerSpec('anniversary_of_event')
  if (!spec) return null
  const parsed = spec.configSchema.safeParse(config ?? {})
  if (!parsed.success) return null
  const data = parsed.data as { years?: unknown; maxYears?: unknown }
  const years = data.years
  if (typeof years !== 'number' || !Number.isFinite(years) || years < 1) return null
  const maxYears =
    typeof data.maxYears === 'number' && Number.isFinite(data.maxYears)
      ? Math.floor(data.maxYears)
      : undefined
  return { years: Math.floor(years), ...(maxYears ? { maxYears } : {}) }
}

/** Collect active anniversary configs per user. */
async function collectActiveConfigs(
  supabase: SupabaseClient<Database>,
): Promise<Map<string, AnniversaryConfig[]>> {
  const { data, error } = await supabase
    .from('automations' as never)
    .select('user_id, trigger_config')
    .eq('status', 'active')
    .eq('trigger_type', 'anniversary_of_event')

  if (error) {
    throw new Error(`load anniversary_of_event automations: ${error.message}`)
  }

  const grouped = new Map<string, AnniversaryConfig[]>()
  for (const row of (data ?? []) as Array<{
    user_id: string
    trigger_config: unknown
  }>) {
    const cfg = parseConfig(row.trigger_config)
    if (!cfg) continue
    if (!grouped.has(row.user_id)) grouped.set(row.user_id, [])
    grouped.get(row.user_id)!.push(cfg)
  }
  return grouped
}

/** Already emitted today for this (event, years_since) bucket? */
async function alreadyEmittedToday(
  supabase: SupabaseClient<Database>,
  eventId: string,
  yearsSince: number,
  dayStart: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('automation_events' as never)
    .select('id')
    .eq('source_table', 'events')
    .eq('source_id', eventId)
    .eq('event_type', 'anniversary_of_event')
    .gte('created_at', dayStart)
    .limit(50)

  if (error) throw new Error(`dedupe lookup: ${error.message}`)
  for (const row of (data ?? []) as Array<{ id: string }>) {
    const { data: full } = await supabase
      .from('automation_events' as never)
      .select('payload')
      .eq('id', row.id)
      .maybeSingle()
    const payload = (full as { payload?: { years_since?: unknown } } | null)
      ?.payload
    if (Number(payload?.years_since) === yearsSince) return true
  }
  return false
}

/** Load this user's past, non-cancelled events (anniversary candidates). */
async function loadPastEvents(
  supabase: SupabaseClient<Database>,
  userId: string,
  todayIso: string,
): Promise<CandidateEvent[]> {
  const { data, error } = await supabase
    .from('events' as never)
    .select('id, user_id, couple_id, date, event_type, title, status')
    .eq('user_id', userId)
    .lte('date', todayIso)
    .neq('status', 'cancelled')

  if (error) throw new Error(`load events: ${error.message}`)
  return (data ?? []) as CandidateEvent[]
}

async function emit(
  supabase: SupabaseClient<Database>,
  event: CandidateEvent,
  yearsSince: number,
): Promise<void> {
  const { error } = await supabase.rpc('emit_automation_event' as never, {
    p_user_id: event.user_id,
    p_source_table: 'events',
    p_source_id: event.id,
    p_event_type: 'anniversary_of_event',
    p_payload: {
      event_id: event.id,
      couple_id: event.couple_id,
      date: event.date,
      event_type: event.event_type,
      title: event.title,
      years_since: yearsSince,
    } as never,
    p_couple_id: event.couple_id,
  } as never)
  if (error) throw new Error(`emit anniversary_of_event: ${error.message}`)
}

export const anniversaryOfEventEmitter: TimeEmitter = {
  type: 'anniversary_of_event',
  async run(supabase) {
    const dayStart = startOfUtcDay()
    const today = utcToday()
    const grouped = await collectActiveConfigs(supabase)
    if (grouped.size === 0) return 0

    let emitted = 0
    for (const [userId, configs] of grouped) {
      const events = await loadPastEvents(supabase, userId, today.iso)
      for (const event of events) {
        // event.date is `YYYY-MM-DD`; compare MM-DD + compute elapsed.
        if (event.date.slice(5, 10) !== today.mmdd) continue
        const elapsed = today.year - Number(event.date.slice(0, 4))
        if (!Number.isFinite(elapsed) || elapsed < 1) continue
        if (!configs.some((c) => matchesConfig(elapsed, c))) continue
        if (await alreadyEmittedToday(supabase, event.id, elapsed, dayStart)) {
          continue
        }
        await emit(supabase, event, elapsed)
        emitted += 1
      }
    }
    return emitted
  },
}
