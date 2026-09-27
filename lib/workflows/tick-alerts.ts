/**
 * The tick's failed-read alert, and its dedupe.
 *
 * Lives outside the route so the dedupe state can be reset by tests
 * without the route module exporting anything Next does not expect of it.
 *
 * @module lib/workflows/tick-alerts
 */

import { sendAlert } from '@/lib/alerts/send-alert';

/**
 * One `workflow_reads_failed` alert per ten minutes, the
 * `workflow_send_cap_unreadable` window. A read failing every minute is
 * one incident; the heartbeat still records every tick's count.
 */
const READS_FAILED_ALERT_WINDOW_MS = 10 * 60 * 1000;

/** When the last `workflow_reads_failed` alert went, in this instance. */
let lastReadsFailedAlertAt: number | null = null;

/** What one tick's passes reported as failed reads. */
export interface TickReadFailures {
  /** Steps or instances the executor left unrun or unfinished. */
  executor: number;
  /** Events dispatch left unprocessed. */
  dispatch: number;
  /** Stranded instances the heal pass could not fix. */
  heal: number;
  /** The first failed read's site, when a pass said (review M2). */
  site: string | null;
}

/**
 * Raise `workflow_reads_failed` when any count is above zero, at most
 * once per ten minutes.
 *
 * Awaited by the tick, not fired and forgotten (Phase 6 review I2): a
 * Slack post still in flight when a Vercel function returns may never
 * complete, and a persistent read failure (steps left due, events left
 * unprocessed, a heal failing every tick) would then reach nobody. The
 * transport's timeout bounds the wait. The quiet window starts only once
 * a post has landed, so a lost post does not also silence the next ten
 * minutes. The Admin scheduler card shows the count and site from the
 * heartbeat as well, so a failed read is on screen even when Slack is
 * down.
 */
export async function alertTickReadFailures(failures: TickReadFailures): Promise<void> {
  if (failures.executor + failures.dispatch + failures.heal === 0) return;
  const now = Date.now();
  if (lastReadsFailedAlertAt !== null && now - lastReadsFailedAlertAt < READS_FAILED_ALERT_WINDOW_MS) {
    return;
  }
  const delivered = await sendAlert({ type: 'workflow_reads_failed', severity: 'error', ...failures }).catch(
    () => false,
  );
  if (delivered) lastReadsFailedAlertAt = now;
}

/** Test-only: forget when the last alert went. */
export function _resetTickAlertsForTest(): void {
  lastReadsFailedAlertAt = null;
}
