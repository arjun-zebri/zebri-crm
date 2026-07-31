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
      type: 'stripe_webhook_replay';
      severity: 'warn';
      eventId: string;
      eventType: string;
      /** Number of replays within the 60s window (≥ 3 triggers this). */
      replayCount: number;
    })
  | (BaseEvent & {
      type: 'stripe_rate_limit_hit';
      severity: 'warn';
      /** Route or server-action key from STRIPE_RATE_LIMITS. */
      action:
        | 'checkout'
        | 'portal'
        | 'billingHistory'
        | 'invoicePayment'
        | 'cancelSubscription'
        | 'resumeSubscription'
        | 'changePlan'
        | 'paymentMethod';
      ip: string;
      userId?: string;
    })
  | (BaseEvent & {
      type: 'stripe_events_prune_high';
      severity: 'warn';
      /** Number of rows the daily prune deleted. Alerts above ~5k. */
      deletedCount: number;
      olderThanDays: number;
    })
  | (BaseEvent & {
      type: 'stripe_connect_onboarding_failed';
      severity: 'warn';
      userId: string;
      reason: string;
    })
  | (BaseEvent & {
      // Connect account.updated webhook reported a non-null
      // `requirements.disabled_reason` — Stripe has paused some
      // capability and the MC needs to take action (re-verify,
      // upload a document, etc.). Surfaced inside Zebri via
      // <ConnectNotificationBanner>, but the alert also flags it
      // operationally so we know which MCs are stuck.
      type: 'stripe_connect_disabled';
      severity: 'warn';
      userId: string;
      accountId: string;
      disabledReason: string;
      currentlyDue: string[];
      pastDue: string[];
    })
  | (BaseEvent & {
      // Vendor removed our platform from their Stripe account via
      // the Stripe Dashboard. We can no longer charge on their
      // behalf — invoices with `stripe_payment_enabled` will start
      // failing until they re-connect. Worth a Slack ping so we
      // can reach out.
      type: 'stripe_connect_deauthorized';
      severity: 'warn';
      userId: string;
      accountId: string;
    })
  | (BaseEvent & {
      // A single IP hit the burst threshold on invalid public-token
      // attempts (Phase 2D.2 — share-token enumeration / scanning).
      // The IP is rate-limited from that point; this alert just
      // surfaces it operationally so we can see if a sustained
      // attack is in progress.
      type: 'public_token_attempt_burst';
      severity: 'warn';
      ip: string;
      surface: 'invoice' | 'quote' | 'portal' | 'contract';
      /** Number of invalid attempts inside the burst window
       *  (typically 10 in 60s). */
      attempts: number;
    })
  | (BaseEvent & {
      // Couple-side payment-success page received a session_id that
      // didn't validate against Stripe (mismatched account, wrong
      // invoice, payment_intent not succeeded). Almost always a
      // signal of someone fiddling with the redirect URL.
      type: 'payment_success_param_tampered';
      severity: 'warn';
      invoiceToken: string;
      sessionId: string;
      reason: string;
    })
  | (BaseEvent & {
      // A Checkout session for an invoice included stage IDs in metadata
      // that do not correspond to any stage rows on that invoice. Money
      // has already moved, so this is a reconciliation emergency: the
      // session metadata and the database disagree about what stages this
      // payment settles. Humans must intervene.
      type: 'invoice_payment_stage_mismatch';
      severity: 'error';
      invoiceId: string;
      missingStageIds: string[];
    })
  | (BaseEvent & {
      // The webhook succeeded (money moved via Stripe), but we cannot
      // determine the invoice's new status because a database query failed.
      // The stage stamping is idempotent and will re-run on the next
      // Checkout retry, so the invoice will eventually reach the correct
      // status. This alert is for visibility: the invoice is in a
      // temporarily inconsistent state.
      type: 'invoice_payment_status_indeterminate';
      severity: 'error';
      invoiceId: string;
      failureReason: string;
    })

  // ───── Email / Resend ──────────────────────────────────────────────
  | (BaseEvent & {
      type: 'email_rate_limit_hit';
      severity: 'warn';
      action: 'sendQuote' | 'sendInvoice' | 'sendTemplate';
      userId: string;
      ip: string;
    })
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
      type: 'auth_rate_limit_hit';
      severity: 'warn';
      action: 'login' | 'signup' | 'resetPassword' | 'updatePassword' | 'changePassword';
      ip: string;
      userId?: string;
    })
  | (BaseEvent & {
      type: 'rls_denied_spike';
      severity: 'warn';
      table: string;
      count: number;
      windowMinutes: number;
    })

  // ───── Admin actions (Phase 13) ───────────────────────────────────
  | (BaseEvent & {
      type: 'admin_shadow_entered';
      severity: 'warn';
      actorId: string;
      targetUserId: string;
      targetEmail: string;
    })
  | (BaseEvent & {
      type: 'admin_user_deleted';
      severity: 'error';
      actorId: string;
      targetUserId: string;
      targetEmail: string;
    })
  | (BaseEvent & {
      type: 'admin_user_comped';
      severity: 'warn';
      actorId: string;
      targetUserId: string;
      targetEmail: string;
      plan: 'pro' | 'max';
    })
  | (BaseEvent & {
      type: 'admin_refund_issued';
      severity: 'warn';
      actorId: string;
      targetUserId: string;
      targetEmail: string;
      amountCents: number;
      paymentIntentId?: string;
    })

  // ───── Automations ─────────────────────────────────────────────────
  | (BaseEvent & {
      type: 'automation_failed';
      severity: 'error';
      automationId: string;
      runId: string;
      message: string;
    })
  | (BaseEvent & {
      type: 'automation_paused_missing_variables';
      severity: 'warn';
      automationId: string;
      runId: string;
      coupleName: string | null;
      missingVariables: string[];
    })
  | (BaseEvent & {
      type: 'automation_tick_slow';
      severity: 'warn';
      durationMs: number;
      actionsExecuted: number;
    })
  | (BaseEvent & {
      type: 'automation_tick_backlog';
      severity: 'warn';
      pendingEvents: number;
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
