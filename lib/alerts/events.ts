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
      // Zebri's own Stripe subscription billing, not a couple's invoice
      // (couple invoice-payment problems surface via `invoiceId`-keyed
      // events below, with no email at all). `email` is therefore always
      // the MC's own billing address, allowlisted (T27).
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
      surface:
        | 'invoice'
        | 'proposal'
        | 'portal'
        | 'contract'
        | 'lead'
        | 'slots'
        | 'booking'
        | 'manage'
        | 'unsubscribe';
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
      action: 'sendProposal' | 'sendInvoice' | 'sendTemplate';
      userId: string;
      ip: string;
    })
  | (BaseEvent & {
      // No `to` and no `subject` (T27, fix round 1): the recipient of a
      // transactional send is a couple, contact or vendor, never Zebri's
      // own customer, and the rendered subject line is exactly the same
      // couple-name-interpolation risk `workflow_email_sent.subject` had
      // (a bounced "Invoice for Sarah & Jake" would otherwise reach
      // Slack). No id is threaded to this (currently unused) call path,
      // so there is nothing to stand in for the address either; the
      // error message still says enough to act on.
      type: 'resend_send_failed';
      severity: 'error';
      errorMessage: string;
    })
  | (BaseEvent & {
      // No `to` and no `subject` (T27, fix round 1, same reasoning as
      // `resend_send_failed`). `userId` is the tenant whose
      // `email_suppression` row this bounce/complaint wrote, and it plus
      // `reason` is enough to find the suppression row and the original
      // message in the app; the couple's/contact's rendered subject
      // line never needs to leave it.
      type: 'resend_bounced';
      severity: 'warn';
      userId: string;
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
      action:
        | 'login'
        | 'signup'
        | 'resetPassword'
        | 'updatePassword'
        | 'changePassword'
        | 'redeemRecoveryCode'
        | 'issueRecoveryCodes'
        | 'verifyTotpUser'
        | 'verifyTotpIp';
      ip: string;
      userId?: string;
    })
  | (BaseEvent & {
      /**
       * An MC signed in with a 2FA recovery code instead of their
       * authenticator app (Phase 4, Task 23). The code is spent and
       * their TOTP factor removed, so the account is back to password
       * only until they turn 2FA on again. Worth a look if the MC did
       * not expect it: whoever did this held the password too. Ids
       * only, no name or email.
       */
      type: 'mfa_recovery_code_used';
      severity: 'warn';
      userId: string;
      /** TOTP factors removed by the redemption (normally 1). */
      factorsRemoved: number;
    })
  | (BaseEvent & {
      type: 'rls_denied_spike';
      severity: 'warn';
      table: string;
      count: number;
      windowMinutes: number;
    })

  // ───── Admin actions (Phase 13) ─────────────────────────────────────
  // `targetEmail` on every event below is the target `auth.users` row's
  // own address: always an MC's Zebri account, never a couple's. MC
  // account emails stay in alerts (T27 ruling): they are Zebri's own
  // customers, and support needs to recognise the account by more than
  // a uuid.
  | (BaseEvent & {
      type: 'admin_shadow_entered';
      severity: 'warn';
      actorId: string;
      targetUserId: string;
      targetEmail: string;
    })
  | (BaseEvent & {
      // exitShadow refused to mint an admin session: no valid signed
      // grant, a grant for another user, or an admin who is no longer
      // one. Ids only, never emails or names.
      type: 'admin_shadow_exit_refused';
      severity: 'warn';
      reason:
        | 'no_session'
        | 'invalid_grant'
        | 'target_mismatch'
        | 'admin_cookie_mismatch'
        | 'admin_lookup_failed'
        | 'not_admin';
      sessionUserId: string | null;
      claimedAdminId: string | null;
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
      /** Which couple the paused step belongs to. Ids only (T27), never
       *  the couple's name. */
      coupleId: string | null;
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
  | (BaseEvent & {
      // The time-emitter pass ran out of its slice of the tick before
      // every emitter had a turn. Distinct from a truncated tick, which
      // means work is waiting and will be picked up next time: most of
      // these emitters fire on a date being exactly so many days away,
      // so an emitter that did not run has missed that day for every
      // couple it would have matched, and nothing replays it.
      type: 'automation_emitters_skipped';
      severity: 'warn';
      /** Trigger types that never got their turn, in registry order. */
      skipped: string[];
      /** How many did run, for a sense of how far the pass got. */
      ran: number;
    })
  | (BaseEvent & {
      // The step_overdue emitter hit its per-run row ceiling while paging
      // through overdue manual steps. It stops there rather than looping
      // forever, but a run this size on a per-minute cron means the
      // overdue backlog is outgrowing what one tick can drain, and the
      // steps past the ceiling wait until the next run to get an event.
      type: 'automation_overdue_scan_capped';
      severity: 'warn';
      /**
       * What stopped the run. 'row_ceiling' is a runaway (more overdue
       * steps than any real day produces); 'deadline' is the tick's own
       * time budget, which means the backlog is real but the pass is
       * simply not getting through it fast enough. They call for
       * different answers, so the alert says which.
       */
      reason: 'row_ceiling' | 'deadline';
      /** Rows read this run before the ceiling stopped the page-through. */
      scanned: number;
      /** The ceiling itself, so the alert still reads right if it's tuned. */
      ceiling: number;
    })
  | (BaseEvent & {
      // A read the step_overdue emitter depends on returned a Postgres or
      // PostgREST error instead of rows, or came back holding rows but
      // could not be trusted anyway. Distinct from
      // `automation_overdue_scan_capped`, which fires when the run
      // intentionally stops at its row ceiling with more work still
      // waiting: this fires when a read failed outright and the run does
      // not know what it missed (stage 'scan'), had to skip a batch of
      // steps rather than risk re-nagging a couple with a stale dedupe
      // read (stage 'dedupe'), or the dedupe read came back holding
      // exactly its row cap, which PostgREST returns with no error, so a
      // full result and a genuinely complete one are indistinguishable on
      // the wire (stage 'dedupe_truncated').
      type: 'automation_overdue_read_failed';
      severity: 'error';
      stage: 'scan' | 'dedupe' | 'dedupe_truncated';
      /** Rows already scanned (stage 'scan'), or the ids in the batch that
       *  was skipped (stage 'dedupe' / 'dedupe_truncated'). */
      count: number;
      errorMessage: string;
    })
  | (BaseEvent & {
      // A step's function was killed (or its write failed) after it was
      // claimed and moved to `running`, so nothing else in the app could
      // ever see it again: the due query only selects `pending` and
      // `waiting`, and Try again only accepts `errored`. `sweepStuckSteps`
      // finds one still `running` past the staleness window and errors
      // it so the MC can check and retry. No couple names or email
      // addresses here, just step ids, since this is an operational
      // signal, not a support ticket.
      type: 'workflow_step_stuck';
      severity: 'error';
      /** How many steps this sweep recovered. */
      count: number;
      /** First ten recovered step ids, for a quick look in the logs. */
      stepIds: string[];
    })
  | (BaseEvent & {
      // A step failed and the executor buried it `errored`. Usually that
      // means its attempts are spent, but not always: an action can
      // report a failure as unrecoverable (a setting only the MC can
      // fix, or a send whose transport cannot deduplicate a repeat), and
      // those are buried on the first attempt. `attempts` says which.
      // Distinct from `workflow_step_stuck`, which is a dead function
      // recovered by the sweep: this is a step that ran, failed, and was
      // finished by the executor itself. No couple names or email
      // addresses here, just step ids, since this is an operational
      // signal, not a support ticket.
      type: 'workflow_step_failed';
      severity: 'error';
      stepId: string;
      instanceId: string;
      /** Attempts made before the executor gave up. */
      attempts: number;
      message: string;
    })
  | (BaseEvent & {
      // Fired once per delivered recipient right after a successful
      // send_email dispatch, so the owner sees automated sends happen
      // instead of discovering them later from a message id buried in
      // workflow_steps.output. No recipient address or couple name (T27):
      // the recipient is always a couple, contact or vendor, and this is
      // Slack, not the app. `coupleId` plus `contactId` are enough to look
      // the send up from the couple's profile.
      type: 'workflow_email_sent';
      severity: 'info';
      /** The step's display title (`stepDisplayTitle()`), not the
       *  rendered subject line (T27, fix round 1): a rendered subject
       *  can carry a couple's name through interpolation; the stored
       *  title is written once in the builder and never per-couple. */
      stepTitle: string;
      coupleId: string | null;
      /** The resolved recipient's contact/couple-contact row id, null
       *  for the couple's own primary/spouse address (see
       *  `ResolvedRecipient.contactId`). */
      contactId: string | null;
      stepId: string | null;
      messageId: string | null;
    })

  | (BaseEvent & {
      // A tenant's automated sends hit lib/api/rate-limit.ts's per-tenant
      // WORKFLOW_SEND_BURST_LIMIT or WORKFLOW_SEND_DAILY_CAP. The step
      // that tripped it is deferred (ActionResult kind 'sleep'), not
      // failed, so nothing here means an email was lost, only that one
      // is queued for later. Still worth a Slack line: a workflow that
      // silently stops sending, whether for a minute (burst) or the
      // rest of the day (cap), is exactly the "nobody finds out" failure
      // this alerting effort exists to close off. Deduped to one alert
      // per {tenant, scope, window} in checkWorkflowSendLimit so a large
      // legitimate bulk send does not fire one of these per deferred
      // step.
      type: 'workflow_send_rate_limited';
      severity: 'warn';
      userId: string;
      /** Which threshold was hit. */
      scope: 'burst' | 'daily_cap';
      /** Recipients this attempt alone was about to send to. */
      attempted: number;
      /** Milliseconds until the tenant's window reopens and sends resume. */
      retryAfterMs: number;
    })
  | (BaseEvent & {
      // An MC's connected Gmail or Outlook mailbox is dead for good (Phase
      // 5 fix wave, M7; lib/email/sender-identity.ts): the grant was
      // revoked or expired (`invalid_grant`), or the stored token cannot
      // be decrypted. The connection was marked failed, so their
      // automated email now goes from the shared Zebri address until they
      // reconnect in Settings. Fires once per flip (the write is
      // conditional on the row still being connected), so it is deduped
      // across processes. Ids and a reason code only.
      type: 'mailbox_disconnected';
      severity: 'warn';
      userId: string;
      provider: 'google' | 'microsoft';
      reason: 'grant_revoked' | 'token_unreadable';
    })
  | (BaseEvent & {
      // The per-tenant daily send count (couple_emails, Task 30) could
      // not be read, so checkWorkflowSendLimit held the send (fail
      // closed, fix round 1 I3). Nothing hit a limit. A persistent
      // failure holds every shared-domain automated send while the tick
      // looks healthy, which is why this is an error and not silent.
      // Deduped to one per tenant per ten minutes. `code` is the
      // database / PostgREST error code, never a message.
      type: 'workflow_send_cap_unreadable';
      severity: 'error';
      userId: string;
      code: string | null;
    })
  | (BaseEvent & {
      // Bus events older than a day were stamped `skipped: stale` instead
      // of being dispatched (Task 36, audit M4; lib/workflows/dispatcher.ts).
      // After any outage over a day, every enquiry that arrived during it
      // goes this way, and before this alert nothing said so. `count` is
      // this batch; `suppressed` is what earlier batches skipped inside
      // the dedupe window without an alert of their own. A suppressed
      // count only reaches Slack with the next batch in the same scope
      // (review M1); the Admin card's record shows every batch. `userId` is set when the immediate kick for
      // one MC did the skipping, null for the cron sweep. Deduped to one
      // per scope per ten minutes. Counts and an MC id only.
      type: 'workflow_events_stale';
      severity: 'error';
      count: number;
      suppressed: number;
      userId: string | null;
    })
  | (BaseEvent & {
      // Reads failed inside a tick pass that carried on (Task 36): the
      // executor left `executor` steps or instances unrun or unfinished,
      // and dispatch left `dispatch` events unprocessed for the next
      // tick. A failed read used to read as "nothing to do", so the tick
      // reported a clean pass. A whole pass that failed is `app_error`
      // from the tick's guard instead. Deduped to one per ten minutes.
      type: 'workflow_reads_failed';
      severity: 'error';
      executor: number;
      dispatch: number;
      /** Instances the heal pass could not fix this tick (fix round 1). */
      heal: number;
      /**
       * The first failed read's site, e.g. `executor.load_instance`
       * (review M2), so on-call knows which read without the logs. A code
       * path name, never data. Null when the passes did not say.
       */
      site: string | null;
    })
  | (BaseEvent & {
      // A step finished (its completion write landed) but the bookkeeping
      // after it failed: merging its output, skipping the branch not
      // taken, re-dating the steps behind it, or completing the instance
      // (Task 36 fix round 1, review I1). The executor marks the instance
      // (`needs_recompute_at`), and the tick's heal pass finds it through
      // `workflow_stranded_instances` and redoes the bookkeeping on the
      // next tick. Before this, the followers kept a null date for good
      // behind a green tick. Also raised, with no step, when the tick's
      // closing completion check fails for one instance (Phase 6 review
      // M1): its last step may have finished, and the heal completes it.
      // Ids and the failing read's site only. Deduped to one per
      // instance per ten minutes.
      type: 'workflow_step_unsettled';
      severity: 'error';
      instanceId: string;
      /** The step that finished, or null for a failed completion check. */
      stepId: string | null;
      site: string;
      /**
       * Whether the marker landed. False means the database refused that
       * write too, so the heal pass will not find this instance: a person
       * has to re-date it (tick and untick a step on it).
       */
      marked: boolean;
    })
  | (BaseEvent & {
      // An apply failed after its instance row was created (Task 36 fix
      // round 1): the step snapshot, the dating or the go-live. The
      // half-built instance is cancelled as `setup_interrupted`, which the
      // couple's Stopped strip shows ("Its setup did not finish ... Start
      // it again instead"). The dispatcher marks the event handled, since
      // the per-event unique index would refuse a retry, so this alert is
      // how anyone hears about it. Ids only. Deduped to one per workflow
      // per ten minutes.
      type: 'workflow_apply_failed';
      severity: 'error';
      userId: string;
      templateId: string;
      coupleId: string | null;
      instanceId: string;
      triggerEventId: string | null;
    })
  | (BaseEvent & {
      // A workflow send step reached some of its recipients and failed on
      // others (Task 31, audit M6; lib/email/partial-send-alert.ts). The
      // step stays done, since re-running it would double-send everyone
      // it reached, so without this the engine looks healthy while a
      // vendor or a spouse never got the email. The MC sees a warning on
      // the step. Ids, counts and the provider's error code only (the
      // provider's message can quote the address). Deduped to one per
      // tenant per ten minutes.
      type: 'workflow_send_partial_failure';
      severity: 'warn';
      userId: string;
      coupleId: string | null;
      stepId: string | null;
      instanceId: string | null;
      /** The action that sent, e.g. `send_email`. */
      actionType: string;
      sent: number;
      failed: number;
      /** `DispatchResult.code` of the last failure, or null. Never a message. */
      code: string | null;
    })
  | (BaseEvent & {
      // An automated email went out (or failed) but its couple_emails
      // row could not be written (Task 30, lib/email/send-log.ts). The
      // send itself stands: logging is strictly after it and never fails
      // it. What is lost is the Emails-tab record, the webhook's delivery
      // status for that message, and one unit of the tenant's daily cap
      // count. Ids only. Deduped to one per tenant per ten minutes, since
      // a failing insert usually fails for every send in the tick.
      type: 'automated_send_log_failed';
      severity: 'error';
      userId: string;
      coupleId: string;
      stepId: string | null;
      instanceId: string | null;
      /** Which row was lost: a successful send's or a failed one's. */
      outcome: 'sent' | 'failed';
      /** The Postgres / PostgREST error code, or null when the client threw. */
      code: string | null;
    })
  | (BaseEvent & {
      // The dispatcher could not apply a workflow's exit rules for a
      // couple's stage change (Task 21): the couple keeps receiving the
      // workflow that should have stopped. The event is left
      // undispatched and retried every tick until it works or turns
      // stale (24h). Deduped to one alert per tenant per hour in
      // lib/workflows/exit-dispatch.ts, so a persistent failure does not
      // ping every minute.
      type: 'workflow_exit_failed';
      severity: 'error';
      userId: string;
      coupleId: string | null;
      eventId: string;
      /** The stage the couple moved into. */
      toStatus: string | null;
      message: string;
    })
  | (BaseEvent & {
      // One workflow could not hand a couple on to the next
      // (lib/workflows/chain). `depth_limit`: a chain opened more than
      // MAX_CHAIN_DEPTH workflows in a row, almost certainly workflows
      // starting each other in a loop; the step errors and the MC sees
      // why. `emit_failed`: a workflow finished but its
      // `workflow_completed` event could not be written, so anything
      // set to start "when this workflow is completed" did not.
      type: 'workflow_chain_failed';
      severity: 'warn' | 'error';
      userId: string;
      coupleId: string | null;
      instanceId: string;
      reason: 'depth_limit' | 'emit_failed';
      message: string;
    })
  | (BaseEvent & {
      // An MC pressed the account-wide stop for workflow automation, or
      // lifted it (Task 18). A stop is the MC's own emergency brake, so
      // it usually means a workflow just did something they did not
      // expect; the owner wants to hear about that the same minute.
      type: 'workflows_account_paused';
      severity: 'warn';
      userId: string;
      /** Which way the switch moved. */
      action: 'paused' | 'resumed';
    })

  // ───── Proposals (Phase C close) ────────────────────────────────────
  | (BaseEvent & {
      type: 'proposal_accepted';
      severity: 'info';
      /** The MC whose proposal was accepted. */
      userId: string;
      proposalNumber: string;
      /** Ids only (T27), never the couple's name. */
      coupleId: string | null;
      /** The accepted option's total, in dollars. */
      total: number;
    })
  | (BaseEvent & {
      // The couple opened the proposal's public page for the first time.
      // Reported by `record_proposal_events` off the very first `opened`
      // event it accepts for a session; deliberately separate from
      // proposal_accepted/proposal_declined, which fire on the close, not
      // the read.
      type: 'proposal_opened';
      severity: 'info';
      /** The MC whose proposal was opened. */
      userId: string;
      proposalNumber: string;
      /** Ids only (T27), never the couple's name. */
      coupleId: string | null;
    })
  | (BaseEvent & {
      type: 'proposal_declined';
      severity: 'info';
      /** The MC whose proposal was declined. */
      userId: string;
      proposalNumber: string;
      /** Ids only (T27), never the couple's name. */
      coupleId: string | null;
      reason: string;
    })
  | (BaseEvent & {
      // The accept/decline/finalize close sequence failed partway through.
      // The couple-side effect (RPC row, or the signature itself) is already
      // recorded, so this is never a rollback signal; it is visibility that
      // one of the close's side effects (rendering the contract, or turning
      // a signature into a booking) needs a human to check on.
      type: 'proposal_close_failed';
      severity: 'error';
      /** Null when the failure happened before the MC could be resolved. */
      userId: string | null;
      /** Null when the failure happened before the proposal could be resolved. */
      proposalId: string | null;
      /** Which step of the close failed. */
      stage: 'accept_rpc' | 'publish' | 'finalize';
      reason: string;
    })

  // ───── Lead capture ────────────────────────────────────────────────
  // `email` on both events below is the MC's own account address
  // (`result.mc_email`), never the inbound lead's, allowlisted (T27).
  // The lead themselves carries no PII into either event.
  | (BaseEvent & {
      type: 'lead_blocked_plan_limit';
      severity: 'warn';
      /** The MC whose plan cap blocked the inbound website lead. */
      userId: string;
      email: string;
    })
  | (BaseEvent & {
      type: 'lead_new_enquiry';
      severity: 'info';
      /** The MC who received the inbound website enquiry. */
      userId: string;
      email: string;
      /** The MC's business name, when known. */
      businessName?: string;
    })

  // ───── Scheduler: Bookings ─────────────────────────────────────────
  | (BaseEvent & {
      type: 'booking_created';
      severity: 'info';
      /** The MC who received the booking. */
      userId: string;
      /** The MC's own account address, allowlisted (T27). */
      email: string;
      /** The new booking row. No booker name (T27): the booker is
       *  couple-side, not Zebri's own customer. */
      bookingId: string;
      /** The booking's share token for the manage page. */
      manageToken: string;
    })
  | (BaseEvent & {
      type: 'booking_created_without_calendar';
      severity: 'warn';
      /** The MC who has no connected calendar. */
      userId: string;
      /** The booking that was created but never pushed anywhere. */
      bookingId: string;
      /** Where the meeting happens; 'video' also means no join link was minted. */
      locationType: 'video' | 'phone' | 'in_person';
    })
  | (BaseEvent & {
      type: 'booking_event_push_failed';
      severity: 'warn';
      /** The MC whose calendar push failed. */
      userId: string;
      /** Which provider failed (google or microsoft). */
      provider: 'google' | 'microsoft';
      /** The HTTP status code from the provider. */
      status: number;
      /** The booking ID that failed to push. */
      bookingId: string;
    })
  | (BaseEvent & {
      type: 'booking_video_link_missing';
      severity: 'warn';
      /** The MC whose calendar accepted the event but minted no link. */
      userId: string;
      /** Which provider the event went to. */
      provider: 'google' | 'microsoft';
      /** The video booking the couple was told "link to follow" for. */
      bookingId: string;
      /**
       * What the provider answered, verbatim from the push: Graph's
       * `isOnlineMeeting` / `onlineMeetingProvider` plus the calendar's
       * allowed providers, or Google's conference request status.
       */
      diagnostic: string;
    })

  // ───── In-app feedback ─────────────────────────────────────────────
  | (BaseEvent & {
      type: 'bug_report_submitted';
      severity: 'info';
      /** Notion reference, e.g. 'ZEB-42'. Null when Notion gave us no number. */
      ticketRef: string | null;
      /** What the MC titled it. */
      title: string;
      /** Report kind the MC picked. */
      reportType: 'Bug' | 'Feature' | 'Improvement';
      /** Who filed it. */
      reporter: string;
      /** The page they were on when they hit the pill. */
      routePath: string;
      /** Deep link to the Notion ticket. */
      notionUrl: string;
    })
  | (BaseEvent & {
      type: 'bug_report_notion_sync_failed';
      severity: 'error';
      /** Row id in `bug_reports`, which still holds the full report. */
      reportId: string;
      /** Repeated in full so the ticket can be re-filed from Slack alone. */
      title: string;
      description: string;
      reporter: string;
      /** Why Notion refused it. */
      reason: string;
    })
  | (BaseEvent & {
      type: 'bug_report_screenshot_upload_failed';
      severity: 'warn';
      /** Row id in `bug_reports`. The ticket was still filed, without the image. */
      reportId: string;
      reason: string;
    })

  // ───── Integrations ────────────────────────────────────────────────
  | (BaseEvent & {
      type: 'spotify_api_failed';
      severity: 'error';
      /** HTTP status from Spotify, or 0 when no response / no credentials. */
      status: number;
      /** `missing_credentials`, `token`, `search` or `track`. */
      code: string;
    })

  // ───── Error reporting ────────────────────────────────────────────
  | (BaseEvent & {
      // Any server-side `logger.error`, forwarded by
      // `lib/alerts/server-error-transport`. Carries the real cause
      // (the Postgres or provider error) that the friendly message an
      // MC sees deliberately hides.
      type: 'server_error';
      severity: 'error';
      /** The logger message, e.g. `[couples/actions] deleteCoupleAction failed`. */
      source: string;
      /** The underlying error's own message. */
      message: string;
      code?: string;
      detail?: string;
      hint?: string;
      /** The MC's own login email, looked up from `userId` (allowlisted). */
      account?: string;
      userId?: string;
      /** Record ids from the log context (`coupleId`, `stepId`, ...). Ids only, never values. */
      ids: Record<string, string>;
      /** `describeBuild()`, e.g. "b0c5991 · production". */
      build: string;
      at: string;
    })
  | (BaseEvent & {
      // A failure in front of an MC, reported by the browser through
      // `/api/alerts/client-error`. Account, browser and build are
      // filled in server-side.
      type: 'client_error';
      severity: 'warn' | 'error';
      kind: 'mutation' | 'render' | 'crash';
      message: string;
      code?: string;
      digest?: string;
      mutation?: string;
      /** Redacted `pathname + search`. */
      page: string;
      /** The signed-in MC's own login email (allowlisted); absent on public pages. */
      account?: string;
      userId?: string;
      browser: string;
      build: string;
      at: string;
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

// ───── Compile-time PII guard (T27) ──────────────────────────────────
//
// A couple's name has no place on any AlertEvent member: it is always
// expressible as an id (`coupleId`, `contactId`, `bookingId`, ...) that a
// human can look up in the app instead. `KeysOf` distributes over the
// union so it collects every key any member ever declares, then the two
// assertions below fail to typecheck the moment `coupleName` or
// `bookerName` reappears anywhere in the union; see the T27 ruling in
// `.superpowers/sdd/2026-09-23-workflows-trust-remediation/progress.md`.
type KeysOf<T> = T extends unknown ? keyof T : never;
type AlertEventKeys = KeysOf<AlertEvent>;
type AssertKeyAbsent<K extends string> = K extends AlertEventKeys
  ? [`Forbidden PII key "${K}" reappeared on AlertEvent, replace it with an id (T27)`]
  : true;
// Exported (not just declared) so `no-unused-vars` leaves it alone; the
// value itself is never meant to be read, only assigned, which is where
// the compile error surfaces if either key comes back.
export const assertNoCoupleNameKey: AssertKeyAbsent<'coupleName'> = true;
export const assertNoBookerNameKey: AssertKeyAbsent<'bookerName'> = true;
