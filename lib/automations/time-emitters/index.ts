/**
 * Time-based event emitters.
 *
 * Most automation triggers fire from a DB row change — a `couples`
 * INSERT, a `quotes` UPDATE — and the corresponding DB trigger calls
 * {@link emit_automation_event} synchronously inside the transaction.
 *
 * A handful of triggers, though, don't have a source row that changes
 * when they "fire": `quote_due`, `invoice_overdue`, `task_overdue`,
 * `time_before_event`, etc. They need to be computed each tick by
 * comparing the source row's timestamp to "now".
 *
 * This module hosts those computations. The {@link runTimeEmitters}
 * function is called from the cron tick once per minute, between the
 * dispatcher's event-pull pass and the runner's run-advance pass.
 * Each registered emitter runs independently — one emitter throwing
 * doesn't prevent the others from firing — and the tick is monitored
 * for overall duration so a slow emitter doesn't go unnoticed.
 *
 * # Idempotency
 *
 * Every emitter must guard against re-emitting on the next tick. The
 * convention is to dedupe by the calendar day on which the event
 * "fires for", using the existing `automation_events` table — an event
 * already emitted today for (source_id, event_type, …) means no
 * re-emit. Each emitter encodes its own bucket key inside the event
 * payload (e.g. `quote_due` stores `days_until_due` so two
 * automations with different lead-times don't collide).
 *
 * # Targeting
 *
 * Time-emitted events fan out via the same dispatcher as DB-emitted
 * ones. So the emitter only emits for combinations of (source row,
 * config value) that actually match an active automation — there's
 * no point publishing an event nothing will match. The trigger's
 * {@link TriggerSpec.match} function narrows by config value
 * (e.g. `config.days === payload.days_until_due` for `quote_due`).
 *
 * @module lib/automations/time-emitters
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { sendAlert } from '@/lib/alerts/send-alert'
import type { TriggerType } from '@/types/automations'
import type { Database } from '@/types/database'

import { invoiceDueEmitter } from './invoice-due'
import { invoiceOverdueEmitter } from './invoice-overdue'
import { quoteDueEmitter } from './quote-due'
import { quoteOverdueEmitter } from './quote-overdue'
import { taskOverdueEmitter } from './task-overdue'

/**
 * One time-based emitter. Each emitter owns the full lifecycle for
 * its trigger type: query the source data, dedupe against
 * `automation_events`, and emit via the `emit_automation_event` RPC
 * for everything that should fire on this tick.
 */
export interface TimeEmitter {
  /** Trigger type slug this emitter is responsible for. */
  readonly type: TriggerType
  /**
   * Run one pass of the emitter. Returns the number of new events
   * emitted on this tick — used by the cron route for metrics.
   */
  run(supabase: SupabaseClient<Database>): Promise<number>
}

/**
 * Registry of all time-based emitters. Adding a new time-based
 * trigger (e.g. `invoice_overdue`) is "implement the
 * {@link TimeEmitter} and append it here" — no other wiring.
 */
const registry: readonly TimeEmitter[] = [
  quoteDueEmitter,
  quoteOverdueEmitter,
  invoiceDueEmitter,
  invoiceOverdueEmitter,
  taskOverdueEmitter,
]

export interface TimeEmittersResult {
  /** Per-emitter event counts, keyed by trigger type. */
  emitted: Record<string, number>
  /** Total events emitted across all emitters. */
  totalEmitted: number
  /** Number of emitters that threw. */
  failedEmitters: number
  /** Wall-clock duration of the full pass, ms. */
  durationMs: number
}

/**
 * Run every registered time-emitter once. One emitter throwing
 * doesn't abort the others: errors are logged via Slack and the
 * surviving emitters still get a chance to fire. The tick caller
 * keeps the result for its own slow-tick / backlog alerting.
 */
export async function runTimeEmitters(
  supabase: SupabaseClient<Database>,
): Promise<TimeEmittersResult> {
  const started = Date.now()
  const emitted: Record<string, number> = {}
  let totalEmitted = 0
  let failedEmitters = 0

  for (const emitter of registry) {
    try {
      const n = await emitter.run(supabase)
      emitted[emitter.type] = n
      totalEmitted += n
    } catch (err) {
      failedEmitters += 1
      emitted[emitter.type] = 0
      // Best-effort alert — never block the rest of the tick.
      void sendAlert({
        type: 'app_error',
        severity: 'error',
        source: 'automations.time-emitters',
        message: `${emitter.type} emitter failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      })
    }
  }

  return {
    emitted,
    totalEmitted,
    failedEmitters,
    durationMs: Date.now() - started,
  }
}
