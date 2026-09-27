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
 * Before any of that, the tick takes a lease (`acquire_scheduler_lease`,
 * `supabase/migrations/20261003200000_scheduler_lease.sql`) so a slow
 * run and the next minute's run never work the same due steps at once.
 * A tick that does not hold the lease returns immediately. A finished
 * tick hands the lease straight back, from a `finally` so a throw on the
 * way out cannot skip it: {@link LEASE_TTL_SECONDS} has to outlast the
 * longest tick, which makes it longer than the gap between two ticks, so
 * a lease left to expire on a healthy system would refuse the next
 * minute's run and quietly halve the schedule. The expiry is there for
 * the run that dies without reaching its release: at 120 seconds against
 * a 60 second cadence that is one or two missed ticks, depending on
 * where in the minute the run died. The release carries the token this
 * run acquired with, so a run whose lease expired mid-flight cannot
 * release its successor's hold.
 * The lease RPCs are guarded like every other pass: a failed check
 * alerts and answers `ok: false`, so an outage never reads as the
 * ordinary "another tick already holds it" skip.
 *
 * Each tick:
 *
 *   1. Recovers steps a dead function left stuck in `running`, via
 *      {@link sweepStuckSteps}, before anything else runs: a step
 *      stranded by the previous tick is surfaced as errored rather than
 *      staying invisible for another hour. In the same breath,
 *      cancels instances an apply started and never finished, via
 *      {@link sweepInterruptedApplies}, so a dead apply does not hold
 *      the couple's dedupe key.
 *   2. Advances every due workflow step, chaining through zero-delay
 *      followers, within {@link EXECUTOR_BUDGET_MS}.
 *   3. On the quarter hour only, runs the time-based emitters: "what
 *      should fire now" for triggers like `invoice_due` / `step_overdue`
 *      that have no source-row change to hook a DB trigger off. They are
 *      all day-granular, so once every 15 minutes is already generous,
 *      and it keeps the other 56 ticks an hour cheap.
 *   4. Dispatches unprocessed bus events (stale ones are stamped skipped
 *      first), matching them to active workflow templates and opening
 *      applied instances. A newly opened instance's first step runs on
 *      the next tick, one minute later; the immediate kick covers the
 *      cases where the MC is watching.
 *   5. Stamps the `automations-tick` heartbeat, which the hourly digest
 *      and the pg_cron watchdog both watch (`lib/workflows/heartbeat.ts`).
 *      The stamp is the run record: it names every pass that failed
 *      (`failedPasses`) and counts the reads that failed inside passes
 *      that carried on (`failedReads`), so a tick that could not read is
 *      never recorded as a clean one that found nothing to do.
 *
 * The route keeps its `automations-tick` path: it is named in the
 * scheduler migration, and renaming a live cron endpoint is a needless
 * outage risk.
 *
 * Bearer-auth via the shared cron-auth helper.
 */

import { randomUUID } from 'node:crypto'

import { NextRequest, NextResponse } from 'next/server'

import { revokeExpiredShadowSessions } from '@/lib/admin/shadow-sessions'
import { sendAlert } from '@/lib/alerts/send-alert'
import { isCronAuthorized } from '@/lib/api/cron-auth'
import { runTimeEmitters, type TimeEmittersResult } from '@/lib/automations/time-emitters'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchPendingEvents as dispatchWorkflowEvents } from '@/lib/workflows/dispatcher'
import { advanceDueSteps, sweepStuckSteps } from '@/lib/workflows/executor'
import { healStrandedInstances } from '@/lib/workflows/heal'
import { recordHeartbeat, TICK_HEARTBEAT } from '@/lib/workflows/heartbeat'
import { sweepInterruptedApplies } from '@/lib/workflows/interrupted-applies'
import { describeFailure } from '@/lib/workflows/read-failure'
import { alertTickReadFailures } from '@/lib/workflows/tick-alerts'

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

/**
 * The heal pass's slice, measured from the start of the tick and inside
 * the executor's: the heal runs first, so every millisecond it spends
 * comes out of the time due steps get (re-review N4). A healthy tick
 * heals nothing and spends one read; a backlog is healed over several
 * ticks, each instance keeping its marker until its turn.
 */
export const HEAL_BUDGET_MS = 10_000

/**
 * The emitters' own slice, measured from the moment they start.
 *
 * The overdue emitter can have thousands of rows to walk, each one its
 * own round trip, and it runs after the executor has already spent its
 * share. Without a slice of its own a backlog could run the whole
 * function past the platform's limit, which kills the tick mid-pass:
 * no heartbeat, no lease release, and the watchdog woken. Every emitter
 * here is day-granular and the pass runs four times an hour, so work
 * left behind is picked up fifteen minutes later.
 */
export const EMITTERS_BUDGET_MS = 10_000

const TICK_SLOW_THRESHOLD_MS = 30_000

/** The lease this route takes, as named in the scheduler migration. */
const LEASE_NAME = 'automations-tick'

/**
 * How long the lease survives without a release.
 *
 * Twice {@link TICK_BUDGET_MS}, so it always outlasts a healthy tick and
 * only ever expires for a run that died. It is deliberately longer than
 * the one-minute schedule interval, which is exactly why a finished tick
 * must release rather than leave it to expire.
 */
const LEASE_TTL_SECONDS = 120

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
  skipped: [],
  durationMs: 0,
}

async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const started = Date.now()
  const deadline = started + TICK_BUDGET_MS

  // Two runs at once means two claim races for every due step. The TTL
  // is twice the tick budget so a run that dies does not wedge the
  // scheduler for long; the release below is what stops a healthy run
  // holding it into the next minute.
  //
  // The token identifies this run to the release. Minted per request
  // rather than derived from anything ambient: two runs on the same
  // instance would share a hostname or a process id, and the whole point
  // of the token is that only the run that acquired can let go.
  //
  // Routed through `guard` rather than destructured bare: a failed RPC
  // (network blip, DB unreachable) must not read as ordinary contention.
  // Both would otherwise return the same cheerful "skipped" body, and an
  // outage would report itself as healthy backoff to anyone reading the
  // response or the alert feed.
  const leaseToken = randomUUID()
  // Every pass `guard` saw fail on this run, for the run record.
  const failedPasses: string[] = []
  const guard = <T,>(source: string, pass: () => Promise<T>) => guardPass(source, pass, failedPasses)
  const leaseHeld = await guard('workflows.lease', async () => {
    const { data, error } = await supabase.rpc('acquire_scheduler_lease', {
      p_name: LEASE_NAME,
      p_ttl_seconds: LEASE_TTL_SECONDS,
      p_token: leaseToken,
    })
    if (error) throw new Error(error.message)
    return data
  })
  if (leaseHeld === null) {
    // `guard` already alerted. Distinct from the ordinary-contention
    // branch below: this tick does not know whether another tick holds
    // the lease, so it must not proceed as if it does.
    return NextResponse.json({ ok: false, skipped: 'lease check failed' }, { status: 500 })
  }
  if (!leaseHeld) {
    return NextResponse.json({ ok: true, skipped: 'another tick is running' })
  }

  // Everything from here on runs holding the lease, so everything from
  // here on is inside the try whose `finally` hands it back. An
  // unguarded throw (the backlog count below is not a pass) must not
  // leave the next minute's tick refused.
  try {
    // Cheap, and it runs first so a step stranded by the previous tick is
    // surfaced as errored rather than staying invisible for another hour.
    const stuckRecovered =
      (await guard('workflows.sweep_stuck', () => sweepStuckSteps(supabase))) ?? 0
    const interruptedApplies =
      (await guard('workflows.sweep_interrupted_applies', () =>
        sweepInterruptedApplies(supabase),
      )) ?? 0

    // Revoke the target sessions of shadow visits that have ended or
    // expired (Phase 4 fix-2, N2). Cheap (one indexed query that finds
    // nothing on almost every tick), and isolated like every pass: a
    // failure alerts and the tick carries on.
    const shadowSessionsRevoked =
      (await guard('shadow.revoke_expired', () => revokeExpiredShadowSessions(supabase))) ?? 0

    // Finish the bookkeeping a failed write left behind on a step that did
    // finish (Task 36 fix round 1, review I1), before the executor, so a
    // follower this dates can run on this same tick. Only instances the
    // failure marked (fix round 2, N1). One cheap read when there is
    // nothing to heal; bounded pages, on a slice of the executor's time,
    // when there is.
    const heal = await guard('workflows.heal_stranded', () =>
      healStrandedInstances(supabase, {
        deadline: Math.min(deadline, started + EXECUTOR_BUDGET_MS, started + HEAL_BUDGET_MS),
      }),
    )

    // Executor first, on its own slice: a due step is what the MC is
    // waiting on. Each pass is isolated: one throwing must not cost the
    // others their turn.
    const workflowExecutor = await guard('workflows.executor', () =>
      advanceDueSteps(supabase, { deadline: Math.min(deadline, started + EXECUTOR_BUDGET_MS) }),
    )

    // Emitters before dispatch so events emitted on this tick are picked
    // up in the same pass. Guarded like every other pass (it was the one
    // exception, which contradicted the comment above), and on its own
    // slice measured from now rather than from `started`: the executor
    // has already spent whatever it needed, and what is left has to cover
    // dispatch too.
    const emitters = shouldRunEmitters(new Date(started))
      ? ((await guard('workflows.emitters', () =>
          runTimeEmitters(supabase, {
            deadline: Math.min(deadline, Date.now() + EMITTERS_BUDGET_MS),
          }),
        )) ?? EMITTERS_NOT_RUN)
      : EMITTERS_NOT_RUN

    const workflowDispatch = await guard('workflows.dispatch', () =>
      dispatchWorkflowEvents(supabase, 500, { deadline }),
    )

    const durationMs = Date.now() - started
    const truncated =
      emitters.skippedEmitters > 0 ||
      (workflowDispatch?.truncated ?? false) ||
      (workflowExecutor?.truncated ?? false) ||
      (heal?.truncated ?? false)

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
    const { count, error: backlogError } = await supabase
      .from('automation_events' as never)
      .select('id', { count: 'exact', head: true })
      .is('processed_at', null)
    // An unread count is not an empty backlog. Alerted and recorded like
    // a failed pass, and reported as null rather than 0.
    const backlog = backlogError ? null : (count ?? 0)
    if (backlogError) {
      failedPasses.push('workflows.backlog')
      void sendAlert({
        type: 'app_error',
        severity: 'error',
        source: 'workflows.backlog',
        message: `tick pass failed: backlog count: ${backlogError.message}`,
      })
    } else if ((backlog ?? 0) > TICK_BACKLOG_THRESHOLD) {
      void sendAlert({
        type: 'automation_tick_backlog',
        severity: 'warn',
        pendingEvents: backlog ?? 0,
      })
    }

    // Reads that failed inside passes that carried on. Each left its work
    // where the next tick will find it, but a persistent failure would
    // leave it there for good with the tick looking healthy.
    const readFailures = {
      executor: workflowExecutor?.failedReads ?? 0,
      dispatch: workflowDispatch?.readFailures ?? 0,
      heal: heal?.failed ?? 0,
      site:
        workflowExecutor?.failedReadSite ??
        workflowDispatch?.readFailureSite ??
        heal?.firstFailedSite ??
        null,
    }
    const failedReads = readFailures.executor + readFailures.dispatch + readFailures.heal
    // Awaited before the heartbeat, inside the tail the tick keeps for
    // what is in flight: a post still running when the handler returns
    // may never land (Phase 6 review I2). The transport bounds it at 3s.
    await alertTickReadFailures(readFailures)

    // Stamp last, so a run that died mid-way reads as missed, not healthy.
    await guard('workflows.heartbeat', () =>
      recordHeartbeat(supabase, TICK_HEARTBEAT, {
        truncated,
        durationMs,
        stepsExecuted: workflowExecutor?.stepsExecuted ?? 0,
        stuckRecovered,
        processedEvents: workflowDispatch?.processedEvents ?? 0,
        staleEvents: workflowDispatch?.staleEvents ?? 0,
        failedReads,
        // Where the first one failed, so the Admin scheduler card can
        // name it without Slack.
        failedReadSite: readFailures.site,
        // Copied: the heartbeat's own failure is pushed after this runs,
        // and it could not be recorded here anyway.
        failedPasses: [...failedPasses],
      }),
    )

    return NextResponse.json({
      ok: true,
      duration_ms: durationMs,
      truncated,
      emitters,
      workflow_dispatch: workflowDispatch,
      workflow_executor: workflowExecutor,
      stuck_recovered: stuckRecovered,
      interrupted_applies: interruptedApplies,
      healed_instances: heal?.healed ?? 0,
      shadow_sessions_revoked: shadowSessionsRevoked,
      backlog,
      failed_passes: failedPasses,
    })
  } finally {
    // Hand the lease back. Without this the 120-second expiry, which has
    // to outlast the longest tick, would also outlast the one-minute gap
    // between ticks, so every second tick would find the lease held by a
    // run that finished long ago and skip. That reads as ordinary
    // contention in the response and in the alert feed, and it would
    // quietly undo the per-minute schedule this route was moved to.
    //
    // Awaited, not fired and forgotten: on Vercel a promise still in
    // flight when the handler returns is not guaranteed to run.
    await guard('workflows.lease_release', async () => {
      const { error } = await supabase.rpc('release_scheduler_lease', {
        p_name: LEASE_NAME,
        p_token: leaseToken,
      })
      if (error) throw new Error(error.message)
      return true
    })
  }
}

/**
 * Run one tick pass, alerting and returning null if it throws.
 *
 * A failure in one pass must not stop the other from getting its turn.
 * The pass's name goes into `failed`, which the heartbeat records, so
 * the run record says the pass failed rather than that it found nothing.
 */
async function guardPass<T>(
  source: string,
  pass: () => Promise<T>,
  failed: string[],
): Promise<T | null> {
  try {
    return await pass()
  } catch (err) {
    failed.push(source)
    // Awaited for the same reason as the failed-read alert: a whole pass
    // failing is the alert that matters most, and a post in flight when
    // the handler returns may never land. Bounded by the transport.
    await sendAlert({
      type: 'app_error',
      severity: 'error',
      source,
      message: `tick pass failed: ${describeFailure(err)}`,
    }).catch(() => false)
    return null
  }
}

export const GET = handle
export const POST = handle
