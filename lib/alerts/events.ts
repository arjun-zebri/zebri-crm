/**
 * Typed alert-event catalog.
 *
 * Every operational/business alert the app dispatches must have a
 * dedicated variant here. The discriminated union forces call sites to
 * supply the right payload, and the matrix in `.claude/docs/alerts.md`
 * stays in lockstep with this file (1:1 with the `type` keys below).
 *
 * Severity drives default routing (info → ops channel; warn/error →
 * incidents + Sentry capture). Routing is implemented in
 * `lib/alerts/send-alert.ts`.
 *
 * @module lib/alerts/events
 */

export type AlertSeverity = 'info' | 'warn' | 'error';

interface BaseEvent {
  severity: AlertSeverity;
}

export type AlertEvent =
  // ───── Lifecycle / business ────────────────────────────────────────
  | (BaseEvent & {
      type: 'signup_completed';
      severity: 'info';
      email: string;
      displayName: string;
      businessName?: string;
      trialEnd: string;
    })
  | (BaseEvent & {
      type: 'subscription_created';
      severity: 'info';
      email: string;
      plan: string;
      amount?: number;
    })
  | (BaseEvent & {
      type: 'subscription_cancelled';
      severity: 'warn';
      email: string;
      plan: string;
      reason?: string;
    })
  | (BaseEvent & {
      type: 'subscription_churn';
      severity: 'warn';
      email: string;
      plan: string;
      reason?: string;
    })

  // ───── Payments ────────────────────────────────────────────────────
  | (BaseEvent & {
      type: 'payment_failed';
      severity: 'error';
      email?: string;
      invoiceId?: string;
      amount?: number;
      currency?: string;
      reason: string;
    })
  | (BaseEvent & {
      type: 'stripe_webhook_failed';
      severity: 'error';
      eventType: string;
      errorMessage: string;
    })
  | (BaseEvent & {
      type: 'stripe_connect_onboarding_failed';
      severity: 'warn';
      userId: string;
      reason: string;
    })

  // ───── Email / Resend ──────────────────────────────────────────────
  | (BaseEvent & {
      type: 'resend_send_failed';
      severity: 'error';
      to: string;
      subject: string;
      errorMessage: string;
    })
  | (BaseEvent & {
      type: 'resend_bounced';
      severity: 'warn';
      to: string;
      subject: string;
      reason?: string;
    })

  // ───── Cron / background jobs ─────────────────────────────────────
  | (BaseEvent & {
      type: 'cron_job_failed';
      severity: 'error';
      job: string;
      errorMessage: string;
    })
  | (BaseEvent & {
      type: 'cron_job_missed';
      severity: 'warn';
      job: string;
      lastRunAt?: string;
    })

  // ───── Security / abuse ───────────────────────────────────────────
  | (BaseEvent & {
      type: 'auth_anomaly';
      severity: 'warn';
      kind: string; // e.g. 'failed_login_spike' | 'token_reuse'
      detail: string;
      userId?: string;
    })
  | (BaseEvent & {
      type: 'rls_denied_spike';
      severity: 'warn';
      table: string;
      count: number;
      windowMinutes: number;
    })

  // ───── Catch-all ──────────────────────────────────────────────────
  | (BaseEvent & {
      type: 'app_error';
      severity: 'error';
      message: string;
      source?: string;
    });

/** Useful for `switch` exhaustiveness checks. */
export type AlertType = AlertEvent['type'];
