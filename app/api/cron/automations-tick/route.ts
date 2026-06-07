/**
 * Cron route: tick the automations engine once.
 *
 * Vercel Cron fires this every minute. Each tick:
 *
 *   1. Runs the time-based emitters — computes "what should fire
 *      now" for triggers like `quote_due` / `task_overdue` that
 *      have no source-row state change to hook a DB trigger off.
 *      New events land in the bus and are dispatched on this same
 *      tick.
 *   2. Dispatches up to N unprocessed events from the bus -
 *      matches them to active automations, opens runs.
 *   3. Advances up to N live runs by one action each.
 *
 * All three halves are budget-capped so a backlog can't run the
 * function past Vercel's timeout. If unprocessed events ever
 * grow above a threshold, the tick fires a Slack alert so we
 * notice before users do.
 *
 * Bearer-auth via the shared cron-auth helper. Mirrors
 * `app/api/cron/expire-contracts/route.ts`.
 */

import { NextRequest, NextResponse } from 'next/server'

import { sendAlert } from '@/lib/alerts/send-alert'
import { isCronAuthorized } from '@/lib/api/cron-auth'
import { dispatchPendingEvents } from '@/lib/automations/dispatcher'
import { advanceLiveRuns } from '@/lib/automations/runner'
import { runTimeEmitters } from '@/lib/automations/time-emitters'
import { createAdminClient } from '@/lib/supabase/admin'

const TICK_SLOW_THRESHOLD_MS = 30_000
const TICK_BACKLOG_THRESHOLD = 1_000

async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const started = Date.now()

  // Run time-emitters BEFORE the dispatcher so events emitted on
  // this tick are picked up in the same pass — minimises the
  // worst-case delivery latency to one tick rather than two.
  const emitters = await runTimeEmitters(supabase)
  const dispatch = await dispatchPendingEvents(supabase)
  const runner = await advanceLiveRuns(supabase)

  const durationMs = Date.now() - started

  if (durationMs > TICK_SLOW_THRESHOLD_MS) {
    void sendAlert({
      type: 'automation_tick_slow',
      severity: 'warn',
      durationMs,
      actionsExecuted: runner.actionsExecuted,
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

  return NextResponse.json({
    ok: true,
    duration_ms: durationMs,
    emitters,
    dispatch,
    runner,
    backlog: count ?? 0,
  })
}

export const GET = handle
export const POST = handle
