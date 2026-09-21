/**
 * Heartbeats for background jobs.
 *
 * The scheduler lives in Postgres (pg_cron) and the engine in Next.js
 * routes; nothing in between tells anyone when a route stopped being
 * called. So the tick stamps a row at the end of every run and the hourly
 * digest, an independent job, alerts when that stamp goes stale. Two jobs
 * watching each other is the cheapest detection that needs no third
 * scheduler.
 *
 * @module lib/workflows/heartbeat
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database, Json } from '@/types/database'

/** The tick's heartbeat name. */
export const TICK_HEARTBEAT = 'automations-tick'

/**
 * Three missed 15-minute ticks. One missed tick is pg_net timing out on a
 * slow route; three is the scheduler not running.
 */
export const TICK_STALE_MS = 45 * 60_000

/** Upsert `name`'s row with the current instant. Service-role client only. */
export async function recordHeartbeat(
  supabase: SupabaseClient<Database>,
  name: string,
  detail?: Json,
): Promise<void> {
  const { error } = await supabase
    .from('system_heartbeats')
    .upsert({ name, last_run_at: new Date().toISOString(), detail: detail ?? null })
  if (error) throw new Error(`heartbeat ${name}: ${error.message}`)
}

/** The last stamped instant for `name`, or null when it has never run. */
export async function readHeartbeat(
  supabase: SupabaseClient<Database>,
  name: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('system_heartbeats')
    .select('last_run_at')
    .eq('name', name)
    .maybeSingle()
  return data?.last_run_at ?? null
}

/** Pure: is a heartbeat missing or older than `maxAgeMs` at `now`? */
export function isHeartbeatStale(lastRunAt: string | null, now: Date, maxAgeMs: number): boolean {
  if (!lastRunAt) return true
  return now.getTime() - new Date(lastRunAt).getTime() > maxAgeMs
}
