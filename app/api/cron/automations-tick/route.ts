/**
 * Cron route: tick the workflows engine once.
 *
 * pg_cron calls this every 15 minutes (`zebri:automations-tick` in
 * `supabase/migrations/20261001000000_pg_cron_scheduler.sql`). It runs
 * inside a Vercel function with a hard duration limit, so the three
 * passes share one deadline: whatever is not reached stays where it is
 * (events unprocessed, steps due) and the next tick takes it, oldest
 * first. A tick that keeps truncating is a capacity signal, which is why
 * the response and the heartbeat both record it.
 *
 * Each tick:
 *
 *   1. Runs the time-based emitters: computes "what should fire now" for
 *      triggers like `invoice_due` / `step_overdue` that have no
 *      source-row state change to hook a DB trigger off. New events land
 *      in the bus and are dispatched on this same tick.
 *   2. Dispatches up to N unprocessed events from the bus, matching them
 *      to active workflow templates and opening applied instances.
 *   3. Advances every due workflow step.
 *   4. Stamps the `automations-tick` heartbeat, which the hourly digest
 *      watches (`lib/workflows/heartbeat.ts`).
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
import { runTimeEmitters } from '@/lib/automations/time-emitters'
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
const TICK_BUDGET_MS = 45_000
const TICK_SLOW_THRESHOLD_MS = 30_000
const TICK_BACKLOG_THRESHOLD = 1_000

async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const started = Date.now()
  const deadline = started + TICK_BUDGET_MS

  // Run time-emitters BEFORE the dispatcher so events emitted on
  // this tick are picked up in the same pass, which keeps the
  // worst-case delivery latency to one tick rather than two.
  const emitters = await runTimeEmitters(supabase, { deadline })

  // Each pass is isolated: dispatch throwing must not cost every due
  // step its turn, and vice versa.
  const workflowDispatch = await guard('workflows.dispatch', () =>
    dispatchWorkflowEvents(supabase, 500, { deadline }),
  )
  const workflowExecutor = await guard('workflows.executor', () =>
    advanceDueSteps(supabase, { deadline }),
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
    recordHeartbeat(supabase, TICK_HEARTBEAT, { truncated, durationMs }),
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
