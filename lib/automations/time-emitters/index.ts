/**
 * Time-based event emitters.
 *
 * Most automation triggers fire from a DB row change — a `couples`
 * INSERT, an `invoices` UPDATE — and the corresponding DB trigger calls
 * {@link emit_automation_event} synchronously inside the transaction.
 *
 * A handful of triggers, though, don't have a source row that changes
 * when they "fire": `invoice_due`, `invoice_overdue`, `step_overdue`,
 * `time_before_event`, etc. They need to be computed each tick by
 * comparing the source row's timestamp to "now".
 *
 * This module hosts those computations. The {@link runTimeEmitters}
 * function is called from the cron tick on the quarter hour (the tick
 * itself runs every minute; every emitter here is day-granular, so
 * running them 96 times a day rather than 1,440 costs nothing), after
 * the executor's run-advance pass and before the dispatcher's
 * event-pull pass, so what it emits is dispatched in the same tick.
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
 * payload (e.g. `invoice_due` stores `days_until_due` so two
 * automations with different lead-times don't collide).
 *
 * # Targeting
 *
 * Time-emitted events fan out via the same dispatcher as DB-emitted
 * ones. So the emitter only emits for combinations of (source row,
 * config value) that actually match an active automation — there's
 * no point publishing an event nothing will match. The trigger's
 * {@link TriggerSpec.match} function narrows by config value
 * (e.g. `config.days === payload.days_until_due` for `invoice_due`).
 *
 * @module lib/automations/time-emitters
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { sendAlert } from '@/lib/alerts/send-alert'
// The workflows engine's own emitter. It lives under lib/workflows but
// registers here, because the tick has one emitter registry.
import { stepOverdueEmitter } from '@/lib/workflows/emitters/step-overdue'
import type { TriggerType } from '@/types/automations'
import type { Database } from '@/types/database'

import { anniversaryOfEventEmitter } from './anniversary-of-event'
import { consultationCompletedEmitter } from './consultation-completed'
import { invoiceDueEmitter } from './invoice-due'
import { invoiceOverdueEmitter } from './invoice-overdue'
import { timeAfterEventEmitter } from './time-after-event'
import { timeBeforeEventEmitter } from './time-before-event'

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
   *
   * @param opts.deadline - epoch ms after which the emitter should stop
   *   starting work and return what it has. An emitter that walks an
   *   unbounded number of rows, one round trip each, must honour this:
   *   the tick runs inside a function with a hard duration limit, and
   *   being killed mid-pass costs the whole tick its heartbeat and its
   *   scheduler lease. Emitters whose work is bounded and small may
   *   ignore it. Everything left behind is picked up on the next pass,
   *   fifteen minutes later; every trigger here is day-granular.
   */
  run(supabase: SupabaseClient<Database>, opts?: { deadline?: number }): Promise<number>
}

/**
 * Registry of all time-based emitters, in the order they run. Adding a
 * new time-based trigger is "implement the {@link TimeEmitter} and put
 * it in this list", with no other wiring.
 *
 * **Order is a correctness property, not a preference.** The pass runs
 * on a slice of the tick, and an emitter that does not finish takes the
 * ones behind it with it. For most of these a skipped run is a
 * permanent miss rather than deferred work: `time_before_event`,
 * `time_after_event` and `anniversary_of_event` all fire on a wedding
 * being exactly so many days away, and that day does not come round
 * again. So the bounded emitters, which cost a query or two each, go
 * first, and `step_overdue` goes **last**, because it is the only one
 * whose work grows with the backlog (thousands of rows, an RPC apiece)
 * and the only one that can consume the whole slice. It is also the one
 * that loses least by waiting: its day-bucket dedupe means an
 * unfinished run simply carries on fifteen minutes later.
 *
 * Exported so that ordering can be pinned by a test rather than by a
 * comment somebody has to notice.
 */
export const timeEmitterRegistry: readonly TimeEmitter[] = [
  invoiceDueEmitter,
  invoiceOverdueEmitter,
  timeBeforeEventEmitter,
  timeAfterEventEmitter,
  anniversaryOfEventEmitter,
  consultationCompletedEmitter,
  stepOverdueEmitter,
]

export interface TimeEmittersResult {
  /** Per-emitter event counts, keyed by trigger type. */
  emitted: Record<string, number>
  /** Total events emitted across all emitters. */
  totalEmitted: number
  /** Number of emitters that threw. */
  failedEmitters: number
  /** Emitters not run because the tick's deadline had passed. */
  skippedEmitters: number
  /**
   * Which ones, by trigger type. The count alone only ever reached the
   * tick's `truncated` flag, which reads as "there is more work waiting"
   * and is true of a dispatch backlog too. For most of these emitters a
   * skipped run is not deferred work at all: they fire on a wedding
   * being exactly so many days out, so the run that did not happen is a
   * day nobody gets back. Naming them is what makes that visible.
   */
  skipped: string[]
  /** Wall-clock duration of the full pass, ms. */
  durationMs: number
}

/**
 * Run every registered time-emitter once. One emitter throwing
 * doesn't abort the others: errors are logged via Slack and the
 * surviving emitters still get a chance to fire. The tick caller
 * keeps the result for its own slow-tick / backlog alerting.
 *
 * @param opts.deadline - epoch ms after which no further emitter starts.
 *   The tick runs inside a Vercel function with a hard duration limit;
 *   an emitter skipped now simply runs on the next quarter hour. Passed
 *   down to each emitter as well as checked between them: a single
 *   emitter can have thousands of rows to walk, so stopping only at the
 *   boundaries between emitters is not a deadline the pass respects.
 */
export async function runTimeEmitters(
  supabase: SupabaseClient<Database>,
  opts: { deadline?: number } = {},
): Promise<TimeEmittersResult> {
  const started = Date.now()
  const emitted: Record<string, number> = {}
  let totalEmitted = 0
  let failedEmitters = 0
  const skipped: string[] = []

  for (const emitter of timeEmitterRegistry) {
    if (opts.deadline !== undefined && Date.now() >= opts.deadline) {
      skipped.push(emitter.type)
      emitted[emitter.type] = 0
      continue
    }
    try {
      const n = await emitter.run(
        supabase,
        opts.deadline !== undefined ? { deadline: opts.deadline } : {},
      )
      emitted[emitter.type] = n
      totalEmitted += n
    } catch (err) {
      failedEmitters += 1
      emitted[emitter.type] = 0
      // Best-effort alert: never block the rest of the tick.
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

  if (skipped.length > 0) {
    // Not folded into the tick's `truncated` flag and left there: that
    // flag also means "dispatch has a backlog", which is ordinary and
    // self-correcting. This is not. Most of these emitters fire on a
    // date being exactly so many days away, so an emitter that did not
    // get its turn has missed that day for every couple it would have
    // matched, and nothing replays it.
    void sendAlert({
      type: 'automation_emitters_skipped',
      severity: 'warn',
      skipped,
      ran: timeEmitterRegistry.length - skipped.length,
    })
  }

  return {
    emitted,
    totalEmitted,
    failedEmitters,
    skippedEmitters: skipped.length,
    skipped,
    durationMs: Date.now() - started,
  }
}
