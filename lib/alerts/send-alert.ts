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
import { sendSlackAlert, slackSuppressed, type SlackPayload } from './slack';


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
    case 'invoice_payment_stage_mismatch':
      return `invoice=${event.invoiceId} · missing stages=${event.missingStageIds.join(', ')}`;
    case 'invoice_payment_status_indeterminate':
      return `invoice=${event.invoiceId} · status unknown, retry pending — ${event.failureReason}`;
    case 'email_rate_limit_hit':
      return `action=${event.action} · user=${event.userId} · ip=${event.ip}`;
    case 'resend_send_failed':
      return event.errorMessage;
    case 'resend_bounced':
      return `user=${event.userId}${event.reason ? `, ${event.reason}` : ''}`;
    case 'cron_job_failed':
      return `job=${event.job} — ${event.errorMessage}`;
    case 'cron_job_missed':
      return `job=${event.job}${event.lastRunAt ? ` · last run ${event.lastRunAt}` : ''}`;
    case 'auth_anomaly':
      return `kind=${event.kind}${event.userId ? ` · user=${event.userId}` : ''} — ${event.detail}`;
    case 'auth_rate_limit_hit':
      return `action=${event.action} · ip=${event.ip}${event.userId ? ` · user=${event.userId}` : ''}`;
    case 'mfa_recovery_code_used':
      return `user=${event.userId} · recovery code spent, 2FA removed (factors=${event.factorsRemoved}); account is password-only until 2FA is turned back on`;
    case 'rls_denied_spike':
      return `${event.count} denials on ${event.table} in the last ${event.windowMinutes}m`;
    case 'admin_shadow_entered':
      return `admin=${event.actorId} → target=${event.targetEmail} (${event.targetUserId})`;
    case 'admin_shadow_exit_refused':
      return `reason=${event.reason} · session=${event.sessionUserId ?? 'none'} · claimed admin=${
        event.claimedAdminId ?? 'none'
      }`;
    case 'admin_user_deleted':
      return `admin=${event.actorId} deleted ${event.targetEmail} (${event.targetUserId})`;
    case 'admin_user_comped':
      return `admin=${event.actorId} comped ${event.targetEmail} → ${event.plan}`;
    case 'admin_refund_issued':
      return `admin=${event.actorId} refunded $${(event.amountCents / 100).toFixed(2)} to ${event.targetEmail}${
        event.paymentIntentId ? ` · pi=${event.paymentIntentId}` : ''
      }`;
    case 'automation_failed':
      return `automation=${event.automationId} run=${event.runId} — ${event.message}`;
    case 'automation_paused_missing_variables':
      return `automation=${event.automationId} run=${event.runId} · couple=${
        event.coupleId ?? 'unknown'
      } — paused, missing: ${event.missingVariables.join(', ') || 'unknown'}`;
    case 'automation_tick_slow':
      return `tick took ${event.durationMs}ms · ${event.actionsExecuted} actions`;
    case 'automation_tick_backlog':
      return `pending events=${event.pendingEvents}`;
    case 'automation_emitters_skipped':
      return `ran=${event.ran} · skipped=${event.skipped.join(', ')}`;
    case 'automation_overdue_scan_capped':
      return `stopped on ${event.reason} · scanned=${event.scanned} · ceiling=${event.ceiling}`;
    case 'automation_overdue_read_failed':
      return `stage=${event.stage} · count=${event.count} · ${event.errorMessage}`;
    case 'workflow_step_stuck':
      return `recovered=${event.count} · steps=${event.stepIds.join(', ')}`;
    case 'workflow_step_failed':
      return `step=${event.stepId} · instance=${event.instanceId} · attempts=${event.attempts}: ${event.message}`;
    case 'workflow_email_sent':
      return `"${event.stepTitle}"${event.coupleId ? ` · couple=${event.coupleId}` : ''}${
        event.contactId ? ` · contact=${event.contactId}` : ''
      }${event.stepId ? ` · step=${event.stepId}` : ''}`;
    case 'workflow_send_rate_limited':
      return `user=${event.userId} · scope=${event.scope} · attempted=${event.attempted} · retry in ${Math.ceil(event.retryAfterMs / 1000)}s`;
    case 'mailbox_disconnected':
      return `user=${event.userId} · ${event.provider} mailbox connection marked failed (${event.reason}); automated email now sends from the shared address until they reconnect`;
    case 'workflow_send_cap_unreadable':
      return `user=${event.userId} · daily send count unreadable (code ${event.code ?? 'thrown'}), automated sends held and retrying each minute`;
    case 'workflow_events_stale':
      return `${event.count} bus events older than 24h skipped, not dispatched${
        event.suppressed > 0 ? ` (+${event.suppressed} more since the last alert)` : ''
      }${event.userId ? ` · user=${event.userId}` : ''}`;
    case 'workflow_reads_failed':
      return `failed reads: executor=${event.executor} · dispatch=${event.dispatch} · heal=${event.heal}${
        event.site ? ` · first=${event.site}` : ''
      }; the work was left for the next tick`;
    case 'workflow_step_unsettled':
      return `instance=${event.instanceId} · ${
        event.stepId ? `step=${event.stepId} finished, but ${event.site} failed after it` : `completion check failed at ${event.site}`
      }; ${
        event.marked
          ? "the next tick's heal pass redoes it"
          : 'marking it for the heal pass failed too, so re-date it by hand (tick and untick a step on it)'
      }`;
    case 'workflow_apply_failed':
      return `user=${event.userId} · template=${event.templateId} · couple=${event.coupleId ?? 'none'} · instance=${event.instanceId}${
        event.triggerEventId ? ` · event=${event.triggerEventId}` : ''
      } apply failed after the instance was created; cancelled as setup_interrupted`;
    case 'workflow_send_partial_failure':
      return `user=${event.userId} · couple=${event.coupleId ?? 'none'} · step=${event.stepId ?? 'none'} · instance=${
        event.instanceId ?? 'none'
      } · ${event.actionType} sent ${event.sent} of ${event.sent + event.failed}, ${event.failed} failed (code ${
        event.code ?? 'none'
      })`;
    case 'automated_send_log_failed':
      return `user=${event.userId} · couple=${event.coupleId} · step=${event.stepId ?? 'none'} · instance=${
        event.instanceId ?? 'none'
      } · ${event.outcome} send not logged (code ${event.code ?? 'thrown'})`;
    case 'workflow_exit_failed':
      return `user=${event.userId} · couple=${event.coupleId ?? 'unknown'} · stage=${event.toStatus ?? 'unknown'} · event=${event.eventId}: ${event.message}`;
    case 'workflows_account_paused':
      return `user=${event.userId} · workflow automation ${event.action}`;
    case 'proposal_accepted':
      return `user=${event.userId} · ${event.proposalNumber} accepted by couple=${event.coupleId ?? 'unknown'} · $${event.total.toFixed(2)}`;
    case 'proposal_opened':
      return `user=${event.userId} · ${event.proposalNumber} opened by couple=${event.coupleId ?? 'unknown'}`;
    case 'proposal_declined':
      return `user=${event.userId} · ${event.proposalNumber} declined by couple=${event.coupleId ?? 'unknown'} (${event.reason})`;
    case 'proposal_close_failed':
      return `user=${event.userId ?? 'unknown'} · proposal=${event.proposalId ?? 'unknown'} · stage=${event.stage} · ${event.reason}`;
    case 'lead_blocked_plan_limit':
      return `user=${event.userId} · ${event.email} — website lead blocked by plan limit`;
    case 'lead_new_enquiry':
      return `user=${event.userId} · ${event.email}${
        event.businessName ? ` · ${event.businessName}` : ''
      } — new website enquiry`;
    case 'booking_created':
      return `user=${event.userId} · ${event.email}: booking=${event.bookingId}`;
    case 'booking_created_without_calendar':
      return `user=${event.userId} · booking=${event.bookingId} · ${event.locationType} — booked with no connected calendar${
        event.locationType === 'video' ? ' (no join link sent)' : ''
      }`;
    case 'booking_event_push_failed':
      return `user=${event.userId} · ${event.provider} status=${event.status} · booking=${event.bookingId}`;
    case 'booking_video_link_missing':
      return `user=${event.userId} · ${event.provider} · booking=${event.bookingId} — event created but no video link (couple told "link to follow"): ${event.diagnostic}`;
    case 'bug_report_submitted':
      return `${event.ticketRef ?? 'new ticket'} · ${event.reportType} · "${event.title}" — ${event.reporter} on ${event.routePath}\n${event.notionUrl}`;
    case 'bug_report_notion_sync_failed':
      // The full text rides along on purpose: with no retry path, this Slack
      // message is the only copy anyone will look at when re-filing by hand.
      return `report=${event.reportId} — ${event.reason}\n*${event.title}* (${event.reporter})\n${event.description}`;
    case 'bug_report_screenshot_upload_failed':
      return `report=${event.reportId} — ticket filed without its screenshot: ${event.reason}`;
    case 'app_error':
      return `${event.source ? `${event.source}: ` : ''}${event.message}`;
  }
}

/**
 * `${AlertEvent['type']}:${field}` pairs allowed to carry a real email
 * address.
 *
 * Keyed by event type and field together, not the field name alone
 * (T27, fix round 1): a bare field-name allowlist would wave through
 * the very next regression that happens to reuse `email` for a
 * couple/contact/vendor address on some future event, since nothing
 * would check which `type` it landed on. Every entry here names the
 * Zebri account itself (an MC, our own paying customer), never a
 * couple, contact, vendor or guest. See the T27 ruling in
 * `.superpowers/sdd/2026-09-23-workflows-trust-remediation/progress.md`
 * and the per-field reasoning left as comments in `./events.ts`.
 * `targetEmail` is the admin-actions target account; `email` covers
 * signup/subscription/payment billing mail, the lead-notification
 * routes (always `result.mc_email`), and the scheduler's booking
 * notification (always the MC's own address); `reporter` is the
 * logged-in MC's own "Name (email)" string on the in-app bug-report
 * alerts (`lib/bug-reports/submit.ts` builds it from `user.email`).
 */
const MC_EMAIL_ALLOWLIST: ReadonlySet<string> = new Set([
  'signup_completed:email',
  'subscription_created:email',
  'subscription_cancelled:email',
  'subscription_churn:email',
  'payment_failed:email',
  'lead_blocked_plan_limit:email',
  'lead_new_enquiry:email',
  'booking_created:email',
  'admin_shadow_entered:targetEmail',
  'admin_user_deleted:targetEmail',
  'admin_user_comped:targetEmail',
  'admin_refund_issued:targetEmail',
  'bug_report_submitted:reporter',
  'bug_report_notion_sync_failed:reporter',
]);

/** Loose enough to catch `name@domain.tld` without validating format. */
const EMAIL_SHAPE_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

/**
 * How many levels into a nested array or object {@link scanForEmail}
 * will walk before giving up. Every `AlertEvent` field today is a
 * string, a primitive, or a flat `string[]` of structural data (ids,
 * trigger types), so this cap is generous headroom, not a tuned limit:
 * it stops a pathological payload from turning a per-alert check into
 * an unbounded walk, not a real depth any current field reaches.
 */
const MAX_SCAN_DEPTH = 4;

/** What {@link scanForEmail} reports for one field's value. */
type ScanResult = { readonly found: false } | { readonly found: true; readonly redacted: unknown };

/**
 * Walk a field's value looking for an email-shaped string, recursing
 * into arrays and plain objects up to {@link MAX_SCAN_DEPTH} deep.
 *
 * A field typed as a nested structure was invisible to the original
 * top-level-only scan: an object or array hiding an address inside it
 * would sail straight through. No current field carries one, but the
 * guard's whole purpose is to catch the next regression, not just the
 * shapes that exist today. Returns the redacted value alongside the
 * `found` flag so a match anywhere in the tree can be redacted in
 * place without a second pass.
 */
function scanForEmail(value: unknown, depth: number): ScanResult {
  if (depth > MAX_SCAN_DEPTH) return { found: false };
  if (typeof value === 'string') {
    return EMAIL_SHAPE_RE.test(value) ? { found: true, redacted: '[redacted]' } : { found: false };
  }
  if (Array.isArray(value)) {
    let found = false;
    const next = value.map((item) => {
      const scanned = scanForEmail(item, depth + 1);
      if (scanned.found) found = true;
      return scanned.found ? scanned.redacted : item;
    });
    return found ? { found: true, redacted: next } : { found: false };
  }
  if (value && typeof value === 'object') {
    let found = false;
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const scanned = scanForEmail(v, depth + 1);
      if (scanned.found) found = true;
      next[k] = scanned.found ? scanned.redacted : v;
    }
    return found ? { found: true, redacted: next } : { found: false };
  }
  return { found: false };
}

/**
 * Last line of defence against a couple-side email reaching Slack.
 *
 * Every field is scanned, recursively (see {@link scanForEmail});
 * landing an email-shaped string somewhere in a field not on
 * {@link MC_EMAIL_ALLOWLIST} means a call site regressed, a new field
 * carrying a couple/contact/vendor/guest address instead of an id. In
 * the test environment that is a bug in the code under test, so it
 * throws and fails the suite outright. Everywhere else the alert still
 * matters (an incident is still an incident), so the offending field
 * is redacted in place rather than the whole alert being dropped.
 *
 * Pure: returns the original event unchanged when nothing tripped it,
 * so callers that never regress pay no allocation cost.
 */
export function assertNoCouplePii(event: AlertEvent): AlertEvent {
  let redacted: Record<string, unknown> | null = null;
  for (const [key, value] of Object.entries(event)) {
    if (MC_EMAIL_ALLOWLIST.has(`${event.type}:${key}`)) continue;
    const scanned = scanForEmail(value, 0);
    if (!scanned.found) continue;

    if (process.env.NODE_ENV === 'test') {
      throw new Error(
        `sendAlert: "${event.type}" field "${key}" carries an email-shaped value. ` +
          'Couple, contact, vendor and guest addresses must never reach Slack, ' +
          'replace this field with an id (T27).',
      );
    }
    redacted ??= { ...event };
    redacted[key] = scanned.redacted;
  }
  return (redacted as AlertEvent | null) ?? event;
}

/**
 * Mask any capability token on an event before it reaches the log sink.
 *
 * Several events carry a share token so a handler can build a link
 * (`manageToken` on a new booking, `invoiceToken` on a payment event). The
 * Slack line never prints them, but the structured log record is the whole
 * event spread into a context object, which put live capability tokens into
 * the platform logs. Anyone with log access could then open, reschedule or
 * cancel the booking.
 *
 * The first 8 characters survive so a token can still be correlated across
 * log lines during an incident. That prefix is far too short to guess the
 * remaining 120 bits of a UUID.
 */
function redactTokens(event: AlertEvent): Record<string, unknown> {
  const out: Record<string, unknown> = { ...event };
  for (const [key, value] of Object.entries(out)) {
    if (/token$/i.test(key) && typeof value === 'string' && value.length > 8) {
      out[key] = `${value.slice(0, 8)}…`;
    }
  }
  return out;
}

/**
 * Dispatch an alert. Sends to Slack (best-effort — never throws to caller)
 * and writes a structured log record at the matching severity. On a local
 * dev server the Slack leg is suppressed (the log record still happens);
 * set ALERTS_DEV_SLACK=1 to override.
 *
 * Runs every event through {@link assertNoCouplePii} first (throws in
 * test, redacts elsewhere), so both the log record and the Slack line
 * below see the same PII-safe payload.
 *
 * Resolves to whether the Slack leg was handled (see `sendSlackAlert`):
 * false only when a post was tried and did not land. Most callers ignore
 * it; one that dedupes should stamp its window only on true.
 */
export async function sendAlert(event: AlertEvent): Promise<boolean> {
  const safeEvent = assertNoCouplePii(event);

  // Structured log first — happens regardless of Slack availability.
  const message = `alert: ${safeEvent.type}`;
  const context: Record<string, unknown> = redactTokens(safeEvent);
  if (safeEvent.severity === 'error') logger.error(message, undefined, context);
  else if (safeEvent.severity === 'warn') logger.warn(message, context);
  else logger.info(message, context);

  if (slackSuppressed()) {
    logger.info(`alert slack suppressed (dev): ${safeEvent.type}`);
    return true;
  }

  // Slack never throws (sendSlackAlert swallows errors); what comes back
  // says whether the post landed, for a caller that dedupes on delivery.
  return sendSlackAlert(formatSlackMessage(safeEvent));
}
