/**
 * Heartbeats for background jobs.
 *
 * The scheduler lives in Postgres (pg_cron) and the engine in Next.js
 * routes; nothing in between tells anyone when a route stopped being
 * called. So the tick stamps a row at the end of every run, and two
 * independent watchers alert when that stamp goes stale: the hourly digest
 * (in the app) and `tick_watchdog()` (in Postgres, posting to Slack
 * through pg_net, so it still fires when the app itself is unreachable).
 *
 * @module lib/workflows/heartbeat
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database, Json } from '@/types/database'

/** The tick's heartbeat name. */
export const TICK_HEARTBEAT = 'automations-tick'

/**
 * The row the dispatcher stamps when it drops stale bus events, with the
 * count in `detail` (Task 36, audit M4). A heartbeat row rather than a
 * query of its own: the Admin scheduler card already reads every row
 * through `scheduler_status()`, so the count costs it nothing, and the
 * row is only written when a batch was actually dropped. Its
 * `last_run_at` is when that was. Neither watcher reads it: it is a
 * record, not a liveness signal.
 */
export const STALE_EVENTS_HEARTBEAT = 'workflow-stale-events'

/**
 * How old a bus event may be and still open a workflow. A note nobody
 * read for a day is history, not a trigger: production went three
 * months without a tick and, once it ran, replayed June enquiries
 * against workflows switched on in September. Anything older is
 * stamped processed with a reason and left for the audit trail.
 */
export const STALE_EVENT_MS = 24 * 60 * 60 * 1000

/**
 * Five missed one-minute ticks. One missed tick is pg_net timing out on a
 * slow route; five in a row is the scheduler not reaching the app. The
 * same window the pg_cron watchdog uses (`tick_watchdog()`), so the Admin
 * card, the digest and Slack agree on what "stale" means.
 */
export const TICK_STALE_MS = 5 * 60_000

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

/**
 * The last stamped instant for `name`, or null when it has never run.
 *
 * Throws when the read fails. Null means "never ran", which the digest
 * reports as a missed tick; a failed read reported that way sends the
 * on-call person looking at the scheduler when the database is the
 * problem.
 */
export async function readHeartbeat(
  supabase: SupabaseClient<Database>,
  name: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('system_heartbeats')
    .select('last_run_at')
    .eq('name', name)
    .maybeSingle()
  if (error) throw new Error(`read heartbeat ${name}: ${error.message}`)
  return data?.last_run_at ?? null
}

/** Pure: is a heartbeat missing or older than `maxAgeMs` at `now`? */
export function isHeartbeatStale(lastRunAt: string | null, now: Date, maxAgeMs: number): boolean {
  if (!lastRunAt) return true
  return now.getTime() - new Date(lastRunAt).getTime() > maxAgeMs
}
