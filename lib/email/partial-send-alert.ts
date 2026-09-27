/**
 * `workflow_send_partial_failure`: a send step reached some of its
 * recipients and failed on others (audit M6).
 *
 * The step itself stays `done`, because re-running it would send a
 * second copy to everyone it already reached (see
 * `lib/workflows/send-outcome`). That makes the engine look healthy
 * while a vendor or a spouse never got the email, so this alert is how
 * anyone on call hears about it. The MC sees it on the step.
 *
 * Ids, counts and a provider error code only: the provider's message can
 * quote the recipient's address, and `sendAlert` refuses couple PII
 * (T27). Deduped per tenant the way `workflow_send_cap_unreadable` is:
 * in memory, one per tenant per ten minutes, because a dead vendor
 * mailbox fails on every workflow that copies them and one line per step
 * would bury the channel. Held in a plain map (as `./send-log` does for
 * its own alert) rather than `inMemoryLimiter`: every send action would
 * otherwise import `lib/api/rate-limit` through this module, which
 * several suites replace wholesale, and the semantics are the same.
 *
 * @module lib/email/partial-send-alert
 */
import { sendAlert } from '@/lib/alerts';
import type { ActionType } from '@/types/automations';

/** One alert per tenant per ten minutes, like the unreadable-cap alert. */
const PARTIAL_FAILURE_ALERT_WINDOW_MS = 10 * 60 * 1000;

/**
 * How long the send step waits on the Slack post. The executor cannot
 * preempt a running step, so a slow await here stalls every due step
 * behind this one in the tick. The Slack transport bounds each post at
 * `SLACK_TIMEOUT_MS` (three seconds) since Task 36; this stays because
 * it is tighter, matching `send_email`'s own two-second alert settle.
 * Past it the alert is best-effort.
 */
const ALERT_DEADLINE_MS = 2000;

/** Per-tenant time of the last partial-failure alert. */
const lastAlertAt = new Map<string, number>();

/** Whether an alert for `userId` may fire now; records it if so. */
function claimAlert(userId: string, now = Date.now()): boolean {
  const last = lastAlertAt.get(userId);
  if (last !== undefined && now - last < PARTIAL_FAILURE_ALERT_WINDOW_MS) return false;
  lastAlertAt.set(userId, now);
  return true;
}

/** What one partially failed send step reports. */
export interface PartialSendFailureAlertInput {
  /** The tenant (workflow owner). */
  userId: string;
  coupleId: string | null;
  stepId: string | null | undefined;
  instanceId: string | null | undefined;
  /** The action that sent, e.g. `send_email`. */
  actionType: ActionType;
  /** Messages that went out. */
  sent: number;
  /** Messages that did not. Nothing is raised when this is 0. */
  failed: number;
  /** The last failure's `DispatchResult.code`, never its message. */
  code: string | null;
}

/**
 * Raise `workflow_send_partial_failure` for a step, at most once per
 * tenant per window. Never throws. Awaited by the caller, not left
 * floating (a promise still in flight when a Vercel handler returns may
 * never finish), and bounded by {@link ALERT_DEADLINE_MS}.
 */
export async function alertPartialSendFailure(input: PartialSendFailureAlertInput): Promise<void> {
  if (input.failed <= 0) return;
  if (!claimAlert(input.userId)) return;
  const alert = sendAlert({
    type: 'workflow_send_partial_failure',
    severity: 'warn',
    userId: input.userId,
    coupleId: input.coupleId,
    stepId: input.stepId ?? null,
    instanceId: input.instanceId ?? null,
    actionType: input.actionType,
    sent: input.sent,
    failed: input.failed,
    code: input.code,
  }).catch(() => undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      alert,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ALERT_DEADLINE_MS);
      }),
    ]);
  } finally {
    // Cleared so a finished alert leaves no timer holding the process open.
    if (timer) clearTimeout(timer);
  }
}

/** Test-only: forget every tenant's last partial-failure alert. */
export function _resetPartialSendAlertDedupForTest(): void {
  lastAlertAt.clear();
}
