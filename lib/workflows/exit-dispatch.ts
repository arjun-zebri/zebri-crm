/**
 * The dispatcher's half of exit rules: stop the workflows a stage change
 * exits.
 *
 * For each `couple_stage_changed` event, one statement
 * (`exit_workflow_instances_for_stage`, 20261012000000) cancels that
 * couple's running and paused instances of every workflow of the MC whose
 * `exit_statuses` holds the new stage, with `cancelled_reason =
 * 'exit_rule'`. A trigger marks their open steps `cancelled` in the same
 * statement (20261011000000). One audit row per stopped instance names
 * the stage.
 *
 * Latency: the stop lands when the dispatcher reads the event, within one
 * tick of the move (sooner when the MC's own action kicks the dispatcher).
 * A step the executor has already claimed and is running when the couple
 * moves finishes; the next one does not start. That is the same rule as
 * turning a workflow off.
 *
 * Idempotent: the statement only matches `active` and `paused` instances,
 * so a replayed event finds nothing left to stop and writes nothing.
 *
 * A failure is not swallowed. The dispatcher still runs the event's
 * applies, leaves the event unprocessed so the next tick retries it (the
 * stale sweep, 24h, caps that), and raises `workflow_exit_failed`
 * through {@link reportExitFailure}, at most once per tenant per hour.
 *
 * @module lib/workflows/exit-dispatch
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { sendAlert } from '@/lib/alerts/send-alert';
import { inMemoryLimiter } from '@/lib/api/rate-limit';
import type { AutomationEventRow } from '@/types/automations';
import type { Database } from '@/types/database';

import { writeAuditMany } from './audit';

/** How long one tenant's exit-failure alert silences the next. */
const EXIT_ALERT_WINDOW_MS = 60 * 60 * 1000;

/**
 * One `workflow_exit_failed` per tenant per window. A failing exit is
 * retried every minute; without this each retry would ping Slack. The
 * same in-process bucket pattern as `workflowSendAlertDedup` in
 * `lib/api/rate-limit.ts`.
 */
let exitAlertDedup = inMemoryLimiter({ windowMs: EXIT_ALERT_WINDOW_MS, max: 1 });

/** Test-only: forget which tenants were alerted. */
export function _resetExitAlertDedupForTest(): void {
  exitAlertDedup = inMemoryLimiter({ windowMs: EXIT_ALERT_WINDOW_MS, max: 1 });
}

/**
 * Log an exit failure and raise `workflow_exit_failed`, deduped per
 * tenant. Never throws: the dispatcher calls it from its error path.
 *
 * @param event - the event whose exit call failed
 * @param err - what the call threw
 */
export async function reportExitFailure(event: AutomationEventRow, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[workflows] exit rules failed for event', event.id, message);
  try {
    const dedup = await exitAlertDedup.check(event.user_id);
    if (!dedup.allowed) return;
    await sendAlert({
      type: 'workflow_exit_failed',
      severity: 'error',
      userId: event.user_id,
      coupleId: event.couple_id,
      eventId: event.id,
      toStatus: toStatusOf(event),
      message,
    });
  } catch (alertErr) {
    console.error('[workflows] exit failure alert threw', alertErr);
  }
}

/** The stage a `couple_stage_changed` event moved into, or null. */
function toStatusOf(event: AutomationEventRow): string | null {
  const payload = event.payload as Record<string, unknown> | null;
  const value = payload?.['to_status'];
  return typeof value === 'string' && value.trim() ? value : null;
}

/**
 * Stop the workflows this event's stage change exits.
 *
 * Call it before matching the event against apply rules, so a stage that
 * starts workflow A and stops workflow B does both in one pass, and a
 * workflow never sees its own new instance stopped by the same event.
 *
 * @param supabase - a service-role client; this runs from the cron tick
 * @param event - any bus event; only `couple_stage_changed` does anything
 * @returns how many instances were stopped
 * @throws when the statement fails, so the caller's per-event guard logs it
 */
export async function applyExitRules(
  supabase: SupabaseClient<Database>,
  event: AutomationEventRow,
): Promise<number> {
  if (event.event_type !== 'couple_stage_changed' || !event.couple_id) return 0;
  const toStatus = toStatusOf(event);
  if (!toStatus) return 0;

  const { data, error } = await supabase.rpc('exit_workflow_instances_for_stage', {
    p_user_id: event.user_id,
    p_couple_id: event.couple_id,
    p_to_status: toStatus,
  });
  if (error) throw new Error(`exit rules: ${error.message}`);

  const stopped = data ?? [];
  await writeAuditMany(
    supabase,
    stopped.map((row) => ({
      userId: event.user_id,
      instanceId: row.instance_id,
      coupleId: row.couple_id,
      event: 'instance_cancelled' as const,
      detail: { reason: 'exit_rule', stage: row.stage, workflow: row.workflow },
    })),
  );
  return stopped.length;
}
