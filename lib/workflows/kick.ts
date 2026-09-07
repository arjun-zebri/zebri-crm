/**
 * Run one MC's slice of the tick, right now.
 *
 * The engine's apply rules are driven off the event bus, and until this
 * existed the only thing that read that bus was the Vercel cron
 * (`/api/cron/automations-tick`, daily on the Hobby tier). So a
 * workflow that "starts when a couple is added" opened its instance up
 * to a day after the couple was added - and never at all against a dev
 * server, which no cron reaches. Adding a couple and watching nothing
 * happen is the whole of that bug.
 *
 * So the mutation that causes the event now kicks the same two passes
 * the cron runs, scoped to the MC who made it, and the cron stays on as
 * the sweeper: it still catches the time-based emitters (`invoice_due`,
 * `step_overdue`), anything emitted by a path that does not kick, and
 * anything a kick dropped because the request ended.
 *
 * It is deliberately fire-and-forget. A failed kick costs freshness,
 * never correctness: the event keeps its null `processed_at` and the
 * next sweep picks it up. Nothing here is allowed to fail the mutation
 * that called it.
 *
 * @module lib/workflows/kick
 */

import { after } from 'next/server';

import { logger } from '@/lib/alerts/logger';
import { createAdminClient } from '@/lib/supabase/admin';

import { dispatchPendingEvents } from './dispatcher';
import { advanceDueSteps } from './executor';

/**
 * How many of the user's pending events one kick will consider.
 *
 * Small on purpose. A kick runs on a user's own request, so it answers
 * for the handful of events that request just produced; a genuine
 * backlog is the sweeper's job, on the sweeper's budget.
 */
const KICK_EVENT_LIMIT = 50;

/**
 * How far back a kick looks.
 *
 * The batch is oldest-first, so a limit alone is not enough: against a
 * backlog of 164 unprocessed events, the first kick drained the 50
 * oldest and left the couple that had just been created undispatched -
 * the exact bug this module exists to fix, reproduced by its own fix.
 * The window keeps a kick about what just happened; the sweeper owns
 * everything older.
 */
const KICK_WINDOW_MS = 5 * 60 * 1000;

/**
 * Dispatch this user's pending bus events and advance what they made
 * due, without blocking or ever throwing.
 *
 * Call it after a mutation that emits a bus event, through
 * {@link scheduleKick}, so the user's request returns first.
 *
 * @param userId - the owner whose events and instances to run.
 */
export async function kickWorkflows(userId: string): Promise<void> {
  try {
    const supabase = createAdminClient();

    // Dispatch before executing, exactly as the tick does: an instance
    // opened by this pass has steps that may already be due, and the
    // MC expects the first one to have run by the time they look.
    const since = new Date(Date.now() - KICK_WINDOW_MS).toISOString();
    await dispatchPendingEvents(supabase, KICK_EVENT_LIMIT, { userId, since });
    await advanceDueSteps(supabase, { userId });
  } catch (err) {
    // Swallowed by design: see the module note. The sweeper is the
    // safety net, so the only cost of a failure here is latency.
    logger.error('[workflows] immediate kick failed', err, { userId });
  }
}

/**
 * Queue a kick to run once the caller's response has been sent.
 *
 * `after()` needs a request scope, and a server action called straight
 * from a script or a test has none. Rather than making every call site
 * know that, the fallback runs the kick immediately: the point is that
 * the user is not kept waiting, and outside a request there is nobody
 * waiting to begin with.
 *
 * @param userId - the owner whose events and instances to run.
 */
export function scheduleKick(userId: string): void {
  try {
    after(() => kickWorkflows(userId));
  } catch {
    void kickWorkflows(userId);
  }
}
