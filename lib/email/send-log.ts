/**
 * The automated-send log: one `couple_emails` row per automated
 * recipient message, and the per-tenant daily count read from it.
 *
 * Two jobs, one table, which is why they live together:
 *
 * - **"Did it arrive?"** Every automated message writes a row once the
 *   transport has answered: `sent` with the provider's message id, or
 *   `failed` with the transport's error. The Resend webhook then
 *   advances the row by that id (delivered, bounced, complained,
 *   deferred), and the couple's Emails tab shows the result.
 * - **The daily send cap.** {@link readAutomatedSendWindow} counts the
 *   tenant's automated rows from the last 24 hours. Because it counts
 *   real rows, the figure is the same in every process, survives a cold
 *   start, and is shared by the cron tick and the MC's approve-and-send,
 *   where the in-memory bucket it replaced was none of those.
 *
 * One row per message, not per attempt (fix round 1, I2). Each row
 * carries the send's per-recipient idempotency key as `attempt_key`,
 * and the `log_automated_send` database function upserts on it: a
 * retried send updates its own row, a success replaces an earlier
 * failure, and a retry that Resend deduplicated (same key, same id)
 * leaves the row, and anything the webhook has since written, alone.
 *
 * Logging is strictly after the send and never fails it: an email that
 * went out stays sent whatever happens to its log row. A failed write
 * raises `automated_send_log_failed` (ids only, at most once per tenant
 * per {@link LOG_ALERT_DEDUP_MS}) and the send carries on.
 *
 * Server-only (service-role client).
 *
 * @module lib/email/send-log
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { sendAlert } from '@/lib/alerts';
import { logger } from '@/lib/alerts/logger';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/types/database';

import type { ResolvedSender } from './sender-identity';

/** The `couple_emails.source` every automated row carries. */
export const AUTOMATION_SOURCE = 'automation';

/**
 * Which transport carried a message, as `couple_emails.transport`
 * stores it. `resend` is the shared Zebri domain the daily cap
 * protects; `gmail` and `graph` are the MC's own mailbox.
 */
export type SendTransport = 'resend' | 'gmail' | 'graph';

/** The {@link SendTransport} a resolved sender dispatches through. */
export function transportOf(sender: ResolvedSender): SendTransport {
  if (sender.transport === 'resend') return 'resend';
  return sender.oauth.provider === 'google' ? 'gmail' : 'graph';
}

/** How far back the daily cap looks. */
export const AUTOMATED_SEND_WINDOW_MS = 24 * 60 * 60 * 1000;

/** One automated message, after the transport has answered. */
export interface AutomatedSendLogEntry {
  /** The tenant (workflow owner). */
  userId: string;
  /** The couple the step runs for. */
  coupleId: string;
  /** The workflow step that sent it. */
  stepId: string | null | undefined;
  /** The workflow instance the step belongs to. */
  instanceId: string | null | undefined;
  /** The one address this message went to. */
  to: string;
  /** The transport that carried it. Only `resend` rows count toward the cap. */
  transport: SendTransport;
  /**
   * The send's per-recipient idempotency key (`sendIdempotencyKey`), the
   * row's identity across retries. Absent only when the send had no step
   * id, in which case every attempt is its own row.
   */
  attemptKey: string | null | undefined;
  /** The rendered subject line. */
  subject: string;
  /**
   * What the transport said. `messageId` is absent on a success only for
   * a transport that returns none (Microsoft Graph); such a row can never
   * be advanced by the webhook, which is fine because Graph raises none.
   */
  result: { ok: true; messageId?: string | undefined } | { ok: false; error: string };
}

/**
 * How long one tenant's `automated_send_log_failed` alert suppresses the
 * next. A failing insert usually fails for every send in a tick (the
 * database is unreachable, a migration is missing), and one Slack line
 * per recipient would bury the channel.
 */
const LOG_ALERT_DEDUP_MS = 10 * 60 * 1000;

/**
 * Per-tenant time of the last log-failure alert. A plain map rather than
 * `inMemoryLimiter`: `lib/api/rate-limit` imports this module for the
 * daily count, and importing it back would be a cycle.
 */
const lastLogAlertAt = new Map<string, number>();

/** Whether a log-failure alert for `userId` should fire now; records it if so. */
function claimLogAlert(userId: string, now = Date.now()): boolean {
  const last = lastLogAlertAt.get(userId);
  if (last !== undefined && now - last < LOG_ALERT_DEDUP_MS) return false;
  lastLogAlertAt.set(userId, now);
  return true;
}

/** Test-only: forget every tenant's last log-failure alert. */
export function _resetSendLogAlertDedupForTest(): void {
  lastLogAlertAt.clear();
}

/** Raise `automated_send_log_failed` for this entry, deduped per tenant. */
async function alertLogFailure(entry: AutomatedSendLogEntry, code: string | null): Promise<void> {
  if (!claimLogAlert(entry.userId)) return;
  await sendAlert({
    type: 'automated_send_log_failed',
    severity: 'error',
    userId: entry.userId,
    coupleId: entry.coupleId,
    stepId: entry.stepId ?? null,
    instanceId: entry.instanceId ?? null,
    outcome: entry.result.ok ? 'sent' : 'failed',
    code,
  });
}

/**
 * Write one automated message's `couple_emails` row. Never throws.
 *
 * Call it once per recipient message, after the transport has answered,
 * with the service-role client the send already holds. Goes through
 * `log_automated_send`, which upserts on {@link AutomatedSendLogEntry.attemptKey}
 * (see the module doc for the rules).
 *
 * Every error is alerted, a unique violation included: the one
 * duplicate that means "already logged" (the same attempt key) is
 * absorbed inside the function, so a 23505 that reaches here is a
 * conflict on some other key (a provider id already on another row)
 * and is worth a person's look.
 *
 * @param supabase A service-role client. Automated rows are not
 *   writable by the authenticated role (see the Task 30 migrations).
 * @param entry The message and its outcome.
 */
export async function logAutomatedSend(
  supabase: SupabaseClient<Database>,
  entry: AutomatedSendLogEntry,
): Promise<void> {
  const r = entry.result;
  try {
    const { error } = await supabase.rpc('log_automated_send', {
      p_user_id: entry.userId,
      p_couple_id: entry.coupleId,
      p_to_email: entry.to,
      p_subject: entry.subject,
      p_status: r.ok ? 'sent' : 'failed',
      p_transport: entry.transport,
      ...(entry.stepId ? { p_step_id: entry.stepId } : {}),
      ...(entry.instanceId ? { p_instance_id: entry.instanceId } : {}),
      ...(r.ok && r.messageId ? { p_provider_message_id: r.messageId } : {}),
      ...(r.ok ? {} : { p_error: r.error }),
      ...(entry.attemptKey ? { p_attempt_key: entry.attemptKey } : {}),
    });
    if (!error) return;
    logger.error('[send-log] could not log an automated send', {
      userId: entry.userId,
      stepId: entry.stepId ?? null,
      code: error.code,
    });
    await alertLogFailure(entry, error.code ?? null);
  } catch (err) {
    // A thrown client (a mocked or misconfigured one) is the same
    // outcome as an error result: the send stands, the log is missing.
    logger.error('[send-log] automated send log threw', {
      userId: entry.userId,
      stepId: entry.stepId ?? null,
      error: err instanceof Error ? err.message : String(err),
    });
    await alertLogFailure(entry, null);
  }
}

/**
 * The tenant's shared-domain automated sends in the last
 * {@link AUTOMATED_SEND_WINDOW_MS}.
 *
 * - `ok`: `count` rows.
 * - `unknown`: the count could not be read. `code` is the database or
 *   PostgREST error code (null when the client threw), safe to alert on;
 *   `reason` is the message, for logs only.
 */
export type AutomatedSendWindow =
  | { status: 'ok'; count: number }
  | { status: 'unknown'; reason: string; code: string | null };

/**
 * The statuses the daily cap counts: every message that left the shared
 * domain, whatever happened to it afterwards. Not `failed`: a failed
 * attempt never left, and counting it made a retry charge its own
 * earlier failures against its admission (Phase 5 fix wave, M1). A
 * failing send loop is bounded by the executor's retries and backoff
 * instead.
 */
const CAP_STATUSES = ['sent', 'delivered', 'bounced', 'complained', 'deferred'] as const;

/**
 * The rows the daily cap counts, as one query builder. Served by
 * `couple_emails_cap_idx` (user_id, source, transport, sent_at) include
 * (status), which, unlike a partial index, a generic plan can use too.
 */
function capRows(userId: string, now: number, head: boolean) {
  const since = new Date(now - AUTOMATED_SEND_WINDOW_MS).toISOString();
  return createAdminClient()
    .from('couple_emails')
    .select('sent_at', head ? { count: 'exact', head: true } : undefined)
    .eq('user_id', userId)
    .eq('source', AUTOMATION_SOURCE)
    .eq('transport', 'resend')
    .in('status', [...CAP_STATUSES])
    .gt('sent_at', since);
}

/**
 * Count the tenant's automated `couple_emails` rows sent through the
 * shared Zebri domain (`transport = 'resend'`) in the last 24 hours that
 * actually left: sent, delivered, bounced, complained or deferred.
 *
 * Failed rows are not counted (see {@link CAP_STATUSES}). Retries of one
 * message are one row (see the module doc). MC-mailbox sends are not on
 * the shared domain and are not counted. Rows whose couple was deleted
 * still count: `couple_id` is set null, never cascaded, so deleting a
 * couple cannot reset the cap.
 *
 * This is the one daily-cap read. `checkWorkflowSendLimit` in
 * `lib/api/rate-limit` calls it for both the cron tick and
 * approve-and-send, so the two can never disagree.
 *
 * @param userId The tenant.
 * @param now Injected clock, for tests.
 */
export async function readAutomatedSendWindow(
  userId: string,
  now: number = Date.now(),
): Promise<AutomatedSendWindow> {
  try {
    const { count, error } = await capRows(userId, now, true);
    if (error) return { status: 'unknown', reason: error.message, code: error.code ?? null };
    return { status: 'ok', count: count ?? 0 };
  } catch (err) {
    return { status: 'unknown', reason: err instanceof Error ? err.message : String(err), code: null };
  }
}

/**
 * When the cap next admits `weight` more sends: the moment the row that
 * has to age out for them to fit leaves the window.
 *
 * With `count` rows in the window and a cap of `max`, `count + weight -
 * max` of them must age out, oldest first, so it is that row's
 * `sent_at` plus the window (fix round 1, M3), not the single oldest
 * row's. Clamped to the newest row when the step alone outweighs the
 * cap. Null when it cannot be read; the caller falls back to its floor.
 *
 * Read only on a breach, so an admitted send costs one query, not two.
 */
export async function automatedSendWindowReopensAt(
  userId: string,
  mustAgeOut: number,
  now: number = Date.now(),
): Promise<number | null> {
  if (mustAgeOut <= 0) return now;
  try {
    const index = mustAgeOut - 1;
    const { data, error } = await capRows(userId, now, false)
      .order('sent_at', { ascending: true })
      .range(index, index);
    if (error) return null;
    let sentAt: string | null = data?.[0]?.sent_at ?? null;
    if (!sentAt) {
      // Fewer rows than that: every one has to go, so the newest decides.
      const newest = await capRows(userId, now, false).order('sent_at', { ascending: false }).limit(1);
      sentAt = newest.data?.[0]?.sent_at ?? null;
    }
    return sentAt ? new Date(sentAt).getTime() + AUTOMATED_SEND_WINDOW_MS : null;
  } catch {
    return null;
  }
}
