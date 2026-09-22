/**
 * Cron route: tick the workflows engine once.
 *
 * pg_cron calls this every minute (`zebri:automations-tick`, rescheduled
 * in `supabase/migrations/20261001200000_tick_every_minute.sql`). It runs
 * inside a Vercel function with a hard duration limit, so the passes
 * share one 45-second budget, but not equally: the executor goes first
 * with a slice of its own, because a due step is what an MC is waiting
 * on ("wait 15 minutes, then send") and nothing else in the tick may
 * starve it. Whatever a pass does not reach stays where it is (steps
 * due, events unprocessed) and the next tick takes it a minute later,
 * oldest first. A tick that keeps truncating is a capacity signal, which
 * is why the response and the heartbeat both record it.
 *
 * Each tick:
 *
 *   1. Advances every due workflow step, chaining through zero-delay
 *      followers, within {@link EXECUTOR_BUDGET_MS}.
 *   2. On the quarter hour only, runs the time-based emitters: "what
 *      should fire now" for triggers like `invoice_due` / `step_overdue`
 *      that have no source-row change to hook a DB trigger off. They are
 *      all day-granular, so once every 15 minutes is already generous,
 *      and it keeps the other 56 ticks an hour cheap.
 *   3. Dispatches unprocessed bus events (stale ones are stamped skipped
 *      first), matching them to active workflow templates and opening
 *      applied instances. A newly opened instance's first step runs on
 *      the next tick, one minute later; the immediate kick covers the
 *      cases where the MC is watching.
 *   4. Stamps the `automations-tick` heartbeat, which the hourly digest
 *      and the pg_cron watchdog both watch (`lib/workflows/heartbeat.ts`).
 *
 * The route keeps its `automations-tick` path: it is named in the
 * scheduler migration, and renaming a live cron endpoint is a needless
 * outage risk.
 *
 * Bearer-auth via the shared cron-auth helper.
 */

import { NextRequest, NextResponse } from 'next/server'

import { sendAlert } from '@/lib/alerts/send-alert'
import { isCronAuthorized } from '@/lib/api/cron-auth'
import { runTimeEmitters, type TimeEmittersResult } from '@/lib/automations/time-emitters'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchPendingEvents as dispatchWorkflowEvents } from '@/lib/workflows/dispatcher'
import { advanceDueSteps } from '@/lib/workflows/executor'
import { recordHeartbeat, TICK_HEARTBEAT } from '@/lib/workflows/heartbeat'

/** Vercel's function limit for this route (Hobby allows up to 60). */
export const maxDuration = 60

/**
 * The passes stop starting new work at this point, leaving 15 seconds
 * for the item in flight, the heartbeat write and the response.
 */
export const TICK_BUDGET_MS = 45_000

/**
 * The executor's own slice. It runs first, so this is a cap rather than
 * a reservation: it can never use more, which guarantees dispatch at
 * least the remainder. With one tick a minute, 30 seconds of due steps
 * is far more than a healthy system ever needs.
 */
export const EXECUTOR_BUDGET_MS = 30_000

const TICK_SLOW_THRESHOLD_MS = 30_000

/**
 * Unread events after dispatch. With a tick a minute and stale events
 * stamped rather than replayed, a backlog this size means dispatch is
 * losing ground and someone should look.
 */
const TICK_BACKLOG_THRESHOLD = 100

/** The emitters are day-granular; every quarter hour is plenty. */
export function shouldRunEmitters(at: Date): boolean {
  return at.getUTCMinutes() % 15 === 0
}

/** What the response carries for a tick that did not run the emitters. */
const EMITTERS_NOT_RUN: TimeEmittersResult = {
  emitted: {},
  totalEmitted: 0,
  failedEmitters: 0,
  skippedEmitters: 0,
  durationMs: 0,
}

async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const started = Date.now()
  const deadline = started + TICK_BUDGET_MS

  // Executor first, on its own slice: a due step is what the MC is
  // waiting on. Each pass is isolated: one throwing must not cost the
  // others their turn.
  const workflowExecutor = await guard('workflows.executor', () =>
    advanceDueSteps(supabase, { deadline: Math.min(deadline, started + EXECUTOR_BUDGET_MS) }),
  )

  // Emitters before dispatch so events emitted on this tick are picked
  // up in the same pass.
  const emitters = shouldRunEmitters(new Date(started))
    ? await runTimeEmitters(supabase, { deadline })
    : EMITTERS_NOT_RUN

  const workflowDispatch = await guard('workflows.dispatch', () =>
    dispatchWorkflowEvents(supabase, 500, { deadline }),
  )

  const durationMs = Date.now() - started
  const truncated =
    emitters.skippedEmitters > 0 ||
    (workflowDispatch?.truncated ?? false) ||
    (workflowExecutor?.truncated ?? false)

  // A truncated tick already means "ran out of time and left work
  // behind" - that is `truncated`'s own signal. Alerting `_slow` too
  // would just be the same fact twice; keep the slow alert for a tick
  // that finished everything but took its time getting there.
  if (durationMs > TICK_SLOW_THRESHOLD_MS && !truncated) {
    void sendAlert({
      type: 'automation_tick_slow',
      severity: 'warn',
      durationMs,
      actionsExecuted: workflowExecutor?.stepsExecuted ?? 0,
    })
  }

  // After dispatch, peek at remaining backlog. Cheap thanks to
  // the partial index.
  const { count } = await supabase
    .from('automation_events' as never)
    .select('id', { count: 'exact', head: true })
    .is('processed_at', null)
  if ((count ?? 0) > TICK_BACKLOG_THRESHOLD) {
    void sendAlert({
      type: 'automation_tick_backlog',
      severity: 'warn',
      pendingEvents: count ?? 0,
    })
  }

  // Stamp last, so a run that died mid-way reads as missed, not healthy.
  await guard('workflows.heartbeat', () =>
    recordHeartbeat(supabase, TICK_HEARTBEAT, {
      truncated,
      durationMs,
      stepsExecuted: workflowExecutor?.stepsExecuted ?? 0,
      processedEvents: workflowDispatch?.processedEvents ?? 0,
      staleEvents: workflowDispatch?.staleEvents ?? 0,
    }),
  )

  return NextResponse.json({
    ok: true,
    duration_ms: durationMs,
    truncated,
    emitters,
    workflow_dispatch: workflowDispatch,
    workflow_executor: workflowExecutor,
    backlog: count ?? 0,
  })
}

/**
 * Run one tick pass, alerting and returning null if it throws.
 *
 * A failure in one pass must not stop the other from getting its turn.
 */
async function guard<T>(source: string, pass: () => Promise<T>): Promise<T | null> {
  try {
    return await pass()
  } catch (err) {
    void sendAlert({
      type: 'app_error',
      severity: 'error',
      source,
      message: `tick pass failed: ${err instanceof Error ? err.message : String(err)}`,
    })
    return null
  }
}

export const GET = handle
export const POST = handle
