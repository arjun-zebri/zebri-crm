/**
 * Alert dispatcher.
 *
 * Single entry point for every operational/business alert. Builds a
 * Slack message from the typed {@link AlertEvent}, forwards it via the
 * existing Slack webhook ({@link sendSlackAlert}), and writes a
 * structured log record (also delivered to any registered logger
 * {@link Transport}s — see `lib/alerts/logger`).
 *
 * Call sites stay tiny:
 * ```ts
 * import { sendAlert } from '@/lib/alerts/send-alert'
 *
 * await sendAlert({
 *   type: 'stripe_webhook_failed',
 *   severity: 'error',
 *   eventType: event.type,
 *   errorMessage: err.message,
 * })
 * ```
 *
 * @module lib/alerts/send-alert
 */

import type { AlertEvent } from './events';
import { logger } from './logger';
import { sendSlackAlert, type SlackPayload } from './slack';


const SEVERITY_EMOJI: Record<AlertEvent['severity'], string> = {
  info: ':information_source:',
  warn: ':warning:',
  error: ':rotating_light:',
};

/** Build a Slack payload from a typed event. Pure; no I/O. */
export function formatSlackMessage(event: AlertEvent): SlackPayload {
  const emoji = SEVERITY_EMOJI[event.severity];
  const title = `${emoji} ${event.type.replace(/_/g, ' ')}`;
  const detail = describe(event);
  return {
    text: detail ? `${title}\n${detail}` : title,
  };
}

function describe(event: AlertEvent): string {
  switch (event.type) {
    case 'signup_completed':
      return `${event.displayName} (${event.email}) — ${event.businessName ?? 'no business'}`;
    case 'subscription_created':
      return `${event.email} → ${event.plan}${event.amount !== undefined ? ` ($${event.amount})` : ''}`;
    case 'subscription_cancelled':
    case 'subscription_churn':
      return `${event.email} on ${event.plan}${event.reason ? ` — ${event.reason}` : ''}`;
    case 'payment_failed':
      return `${event.email ?? 'unknown'} ${event.invoiceId ? `· invoice ${event.invoiceId} ` : ''}— ${event.reason}`;
    case 'stripe_webhook_failed':
      return `event=${event.eventType} — ${event.errorMessage}`;
    case 'stripe_webhook_replay':
      return `event=${event.eventType} · id=${event.eventId} · replays=${event.replayCount}`;
    case 'stripe_rate_limit_hit':
      return `action=${event.action} · ip=${event.ip}${event.userId ? ` · user=${event.userId}` : ''}`;
    case 'stripe_events_prune_high':
      return `deleted=${event.deletedCount} rows older than ${event.olderThanDays}d`;
    case 'stripe_connect_onboarding_failed':
      return `user=${event.userId} — ${event.reason}`;
    case 'stripe_connect_disabled':
      return `user=${event.userId} · acct=${event.accountId} — ${event.disabledReason}${
        event.pastDue.length > 0 ? ` · past_due=${event.pastDue.length}` : ''
      }${event.currentlyDue.length > 0 ? ` · due=${event.currentlyDue.length}` : ''}`;
    case 'stripe_connect_deauthorized':
      return `user=${event.userId} · acct=${event.accountId}`;
    case 'public_token_attempt_burst':
      return `surface=${event.surface} · ip=${event.ip} · attempts=${event.attempts}`;
    case 'payment_success_param_tampered':
      return `invoiceToken=${event.invoiceToken} · session=${event.sessionId} — ${event.reason}`;
    case 'email_rate_limit_hit':
      return `action=${event.action} · user=${event.userId} · ip=${event.ip}`;
    case 'resend_send_failed':
      return `to=${event.to} · "${event.subject}" — ${event.errorMessage}`;
    case 'resend_bounced':
      return `to=${event.to} · "${event.subject}"${event.reason ? ` — ${event.reason}` : ''}`;
    case 'cron_job_failed':
      return `job=${event.job} — ${event.errorMessage}`;
    case 'cron_job_missed':
      return `job=${event.job}${event.lastRunAt ? ` · last run ${event.lastRunAt}` : ''}`;
    case 'auth_anomaly':
      return `kind=${event.kind}${event.userId ? ` · user=${event.userId}` : ''} — ${event.detail}`;
    case 'auth_rate_limit_hit':
      return `action=${event.action} · ip=${event.ip}${event.userId ? ` · user=${event.userId}` : ''}`;
    case 'rls_denied_spike':
      return `${event.count} denials on ${event.table} in the last ${event.windowMinutes}m`;
    case 'app_error':
      return `${event.source ? `${event.source}: ` : ''}${event.message}`;
  }
}

/**
 * Dispatch an alert. Sends to Slack (best-effort — never throws to caller)
 * and writes a structured log record at the matching severity.
 */
export async function sendAlert(event: AlertEvent): Promise<void> {
  // Structured log first — happens regardless of Slack availability.
  const message = `alert: ${event.type}`;
  const context: Record<string, unknown> = { ...event };
  if (event.severity === 'error') logger.error(message, undefined, context);
  else if (event.severity === 'warn') logger.warn(message, context);
  else logger.info(message, context);

  // Slack: fire-and-forget; sendSlackAlert already swallows errors.
  await sendSlackAlert(formatSlackMessage(event));
}
