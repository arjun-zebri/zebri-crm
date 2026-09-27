/**
 * Table-driven PII regression coverage for every {@link AlertEvent}
 * variant (T27 — strip couple-side PII from Slack alerts).
 *
 * `fixtures` is typed as a mapped object keyed by `AlertEvent['type']`,
 * so a new event variant added to `lib/alerts/events.ts` with no fixture
 * here fails to compile rather than silently going untested. Every
 * fixture below must:
 *   - carry no couple/vendor/contact/guest email or name;
 *   - pass {@link assertNoCouplePii} untouched (nothing to redact);
 *   - render a Slack line with no email outside the MC allowlist.
 *
 * @module tests/unit/lib/alerts/no-couple-pii
 */
import { describe, expect, it, vi } from 'vitest';

import type { AlertEvent } from '@/lib/alerts/events';
import { assertNoCouplePii, formatSlackMessage } from '@/lib/alerts/send-alert';

/**
 * `${type}:${field}` pairs allowed to carry a real email address. Keyed
 * by event type and field together (T27, fix round 1), matching the
 * shape of the allowlist under test, not a bare field name: a field
 * called `email` on one event says nothing about whether `email` is
 * safe on another. Kept as an independent hard-coded list (rather than
 * importing the private one in `send-alert.ts`) so a change to one does
 * not blind the other's test.
 */
const MC_EMAIL_FIELDS = new Set([
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
const EMAIL_SHAPE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
/**
 * Tighter than {@link EMAIL_SHAPE}: used only to pull an address back out
 * of a formatted Slack line, where the loose pattern's `[^\s@]` also
 * swallows surrounding punctuation like the `(`/`)` around a "Name
 * (email)" reporter string or the `target=` prefix on an admin alert.
 * The guard itself only ever calls `.test()`, so it doesn't need this
 * precision — extra captured punctuation still flags the same field.
 */
const EMAIL_SHAPE_EXACT = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

type FixturesByType = { [K in AlertEvent['type']]: Extract<AlertEvent, { type: K }> };

const fixtures: FixturesByType = {
  signup_completed: {
    type: 'signup_completed',
    severity: 'info',
    email: 'mc@business.example',
    displayName: 'Alex MC',
    businessName: 'Alex Weddings',
  },
  subscription_created: {
    type: 'subscription_created',
    severity: 'info',
    email: 'mc@business.example',
    plan: 'pro',
    amount: 49,
  },
  subscription_cancelled: {
    type: 'subscription_cancelled',
    severity: 'warn',
    email: 'mc@business.example',
    plan: 'pro',
    reason: 'too expensive',
  },
  subscription_churn: {
    type: 'subscription_churn',
    severity: 'warn',
    email: 'mc@business.example',
    plan: 'pro',
    reason: 'switched providers',
  },
  payment_failed: {
    type: 'payment_failed',
    severity: 'error',
    email: 'mc@business.example',
    invoiceId: 'inv-1',
    amount: 49,
    currency: 'aud',
    reason: 'card_declined',
  },
  stripe_webhook_failed: {
    type: 'stripe_webhook_failed',
    severity: 'error',
    eventType: 'invoice.payment_failed',
    errorMessage: 'signature invalid',
  },
  stripe_webhook_replay: {
    type: 'stripe_webhook_replay',
    severity: 'warn',
    eventId: 'evt_1',
    eventType: 'checkout.session.completed',
    replayCount: 3,
  },
  stripe_rate_limit_hit: {
    type: 'stripe_rate_limit_hit',
    severity: 'warn',
    action: 'checkout',
    ip: '1.2.3.4',
    userId: 'user-1',
  },
  stripe_events_prune_high: {
    type: 'stripe_events_prune_high',
    severity: 'warn',
    deletedCount: 6000,
    olderThanDays: 90,
  },
  stripe_connect_onboarding_failed: {
    type: 'stripe_connect_onboarding_failed',
    severity: 'warn',
    userId: 'user-1',
    reason: 'account restricted',
  },
  stripe_connect_disabled: {
    type: 'stripe_connect_disabled',
    severity: 'warn',
    userId: 'user-1',
    accountId: 'acct_1',
    disabledReason: 'requirements.past_due',
    currentlyDue: ['individual.verification.document'],
    pastDue: [],
  },
  stripe_connect_deauthorized: {
    type: 'stripe_connect_deauthorized',
    severity: 'warn',
    userId: 'user-1',
    accountId: 'acct_1',
  },
  public_token_attempt_burst: {
    type: 'public_token_attempt_burst',
    severity: 'warn',
    ip: '1.2.3.4',
    surface: 'invoice',
    attempts: 11,
  },
  payment_success_param_tampered: {
    type: 'payment_success_param_tampered',
    severity: 'warn',
    invoiceToken: 'tok_1',
    sessionId: 'cs_1',
    reason: 'session mismatch',
  },
  invoice_payment_stage_mismatch: {
    type: 'invoice_payment_stage_mismatch',
    severity: 'error',
    invoiceId: 'inv-1',
    missingStageIds: ['stage-1'],
  },
  invoice_payment_status_indeterminate: {
    type: 'invoice_payment_status_indeterminate',
    severity: 'error',
    invoiceId: 'inv-1',
    failureReason: 'query failed',
  },
  email_rate_limit_hit: {
    type: 'email_rate_limit_hit',
    severity: 'warn',
    action: 'sendProposal',
    userId: 'user-1',
    ip: '1.2.3.4',
  },
  resend_send_failed: {
    type: 'resend_send_failed',
    severity: 'error',
    errorMessage: 'domain not verified',
  },
  resend_bounced: {
    type: 'resend_bounced',
    severity: 'warn',
    userId: 'user-1',
    reason: 'bounced',
  },
  cron_job_failed: {
    type: 'cron_job_failed',
    severity: 'error',
    job: 'booking-reminders',
    errorMessage: 'timeout',
  },
  cron_job_missed: {
    type: 'cron_job_missed',
    severity: 'warn',
    job: 'automations-tick',
    lastRunAt: '2026-01-01T00:00:00.000Z',
  },
  auth_anomaly: {
    type: 'auth_anomaly',
    severity: 'warn',
    kind: 'failed_login_spike',
    detail: '10 failures in 1m',
    userId: 'user-1',
  },
  auth_rate_limit_hit: {
    type: 'auth_rate_limit_hit',
    severity: 'warn',
    action: 'login',
    ip: '1.2.3.4',
    userId: 'user-1',
  },
  mfa_recovery_code_used: {
    type: 'mfa_recovery_code_used',
    severity: 'warn',
    userId: 'user-1',
    factorsRemoved: 1,
  },
  rls_denied_spike: {
    type: 'rls_denied_spike',
    severity: 'warn',
    table: 'couples',
    count: 42,
    windowMinutes: 5,
  },
  admin_shadow_entered: {
    type: 'admin_shadow_entered',
    severity: 'warn',
    actorId: 'admin-1',
    targetUserId: 'user-1',
    targetEmail: 'mc@business.example',
  },
  admin_shadow_exit_refused: {
    type: 'admin_shadow_exit_refused',
    severity: 'warn',
    reason: 'invalid_grant',
    sessionUserId: 'user-1',
    claimedAdminId: 'admin-1',
  },
  admin_user_deleted: {
    type: 'admin_user_deleted',
    severity: 'error',
    actorId: 'admin-1',
    targetUserId: 'user-1',
    targetEmail: 'mc@business.example',
  },
  admin_user_comped: {
    type: 'admin_user_comped',
    severity: 'warn',
    actorId: 'admin-1',
    targetUserId: 'user-1',
    targetEmail: 'mc@business.example',
    plan: 'pro',
  },
  admin_refund_issued: {
    type: 'admin_refund_issued',
    severity: 'warn',
    actorId: 'admin-1',
    targetUserId: 'user-1',
    targetEmail: 'mc@business.example',
    amountCents: 4900,
    paymentIntentId: 'pi_1',
  },
  automation_failed: {
    type: 'automation_failed',
    severity: 'error',
    automationId: 'auto-1',
    runId: 'run-1',
    message: 'handler threw',
  },
  automation_paused_missing_variables: {
    type: 'automation_paused_missing_variables',
    severity: 'warn',
    automationId: 'auto-1',
    runId: 'run-1',
    coupleId: 'couple-1',
    missingVariables: ['couple.spouse_name'],
  },
  automation_tick_slow: {
    type: 'automation_tick_slow',
    severity: 'warn',
    durationMs: 12000,
    actionsExecuted: 40,
  },
  automation_tick_backlog: {
    type: 'automation_tick_backlog',
    severity: 'warn',
    pendingEvents: 500,
  },
  automation_emitters_skipped: {
    type: 'automation_emitters_skipped',
    severity: 'warn',
    skipped: ['invoice_overdue'],
    ran: 5,
  },
  automation_overdue_scan_capped: {
    type: 'automation_overdue_scan_capped',
    severity: 'warn',
    reason: 'row_ceiling',
    scanned: 5000,
    ceiling: 5000,
  },
  automation_overdue_read_failed: {
    type: 'automation_overdue_read_failed',
    severity: 'error',
    stage: 'scan',
    count: 100,
    errorMessage: 'connection reset',
  },
  workflow_step_stuck: {
    type: 'workflow_step_stuck',
    severity: 'error',
    count: 3,
    stepIds: ['step-1', 'step-2', 'step-3'],
  },
  workflow_step_failed: {
    type: 'workflow_step_failed',
    severity: 'error',
    stepId: 'step-1',
    instanceId: 'instance-1',
    attempts: 3,
    message: 'transport rejected',
  },
  workflow_email_sent: {
    type: 'workflow_email_sent',
    severity: 'info',
    stepTitle: 'Send welcome email',
    coupleId: 'couple-1',
    contactId: null,
    stepId: 'step-1',
    messageId: 'msg-1',
  },
  workflow_send_rate_limited: {
    type: 'workflow_send_rate_limited',
    severity: 'warn',
    userId: 'user-1',
    scope: 'burst',
    attempted: 50,
    retryAfterMs: 30000,
  },
  mailbox_disconnected: {
    type: 'mailbox_disconnected',
    severity: 'warn',
    userId: 'user-1',
    provider: 'google',
    reason: 'grant_revoked',
  },
  workflow_send_cap_unreadable: {
    type: 'workflow_send_cap_unreadable',
    severity: 'error',
    userId: 'user-1',
    code: '57014',
  },
  workflow_events_stale: {
    type: 'workflow_events_stale',
    severity: 'error',
    count: 12,
    suppressed: 3,
    userId: null,
  },
  workflow_reads_failed: {
    type: 'workflow_reads_failed',
    severity: 'error',
    executor: 2,
    dispatch: 1,
    heal: 0,
    site: 'executor.load_instance',
  },
  workflow_step_unsettled: {
    type: 'workflow_step_unsettled',
    severity: 'error',
    instanceId: 'instance-1',
    stepId: 'step-1',
    site: 'executor.recompute_steps',
    marked: true,
  },
  workflow_apply_failed: {
    type: 'workflow_apply_failed',
    severity: 'error',
    userId: 'user-1',
    templateId: 'template-1',
    coupleId: 'couple-1',
    instanceId: 'instance-1',
    triggerEventId: 'event-1',
  },
  workflow_send_partial_failure: {
    type: 'workflow_send_partial_failure',
    severity: 'warn',
    userId: 'user-1',
    coupleId: 'couple-1',
    stepId: 'step-1',
    instanceId: 'instance-1',
    actionType: 'send_email',
    sent: 1,
    failed: 1,
    code: 'validation_error',
  },
  automated_send_log_failed: {
    type: 'automated_send_log_failed',
    severity: 'error',
    userId: 'user-1',
    coupleId: 'couple-1',
    stepId: 'step-1',
    instanceId: 'instance-1',
    outcome: 'sent',
    code: '42501',
  },
  workflow_exit_failed: {
    type: 'workflow_exit_failed',
    severity: 'error',
    userId: 'user-1',
    coupleId: 'couple-1',
    eventId: 'evt-1',
    toStatus: 'booked',
    message: 'exit rule evaluation threw',
  },
  workflows_account_paused: {
    type: 'workflows_account_paused',
    severity: 'warn',
    userId: 'user-1',
    action: 'paused',
  },
  proposal_accepted: {
    type: 'proposal_accepted',
    severity: 'info',
    userId: 'user-1',
    proposalNumber: 'PR-001',
    coupleId: 'couple-1',
    total: 4500,
  },
  proposal_opened: {
    type: 'proposal_opened',
    severity: 'info',
    userId: 'user-1',
    proposalNumber: 'PR-001',
    coupleId: 'couple-1',
  },
  proposal_declined: {
    type: 'proposal_declined',
    severity: 'info',
    userId: 'user-1',
    proposalNumber: 'PR-001',
    coupleId: 'couple-1',
    reason: 'chose another vendor',
  },
  proposal_close_failed: {
    type: 'proposal_close_failed',
    severity: 'error',
    userId: 'user-1',
    proposalId: 'proposal-1',
    stage: 'publish',
    reason: 'contract render failed',
  },
  lead_blocked_plan_limit: {
    type: 'lead_blocked_plan_limit',
    severity: 'warn',
    userId: 'user-1',
    email: 'mc@business.example',
  },
  lead_new_enquiry: {
    type: 'lead_new_enquiry',
    severity: 'info',
    userId: 'user-1',
    email: 'mc@business.example',
    businessName: 'Alex Weddings',
  },
  booking_created: {
    type: 'booking_created',
    severity: 'info',
    userId: 'user-1',
    email: 'mc@business.example',
    bookingId: 'booking-1',
    manageToken: 'token-1',
  },
  booking_created_without_calendar: {
    type: 'booking_created_without_calendar',
    severity: 'warn',
    userId: 'user-1',
    bookingId: 'booking-1',
    locationType: 'video',
  },
  booking_event_push_failed: {
    type: 'booking_event_push_failed',
    severity: 'warn',
    userId: 'user-1',
    provider: 'google',
    status: 500,
    bookingId: 'booking-1',
  },
  booking_video_link_missing: {
    type: 'booking_video_link_missing',
    severity: 'warn',
    userId: 'user-1',
    provider: 'microsoft',
    bookingId: 'booking-1',
    diagnostic: 'isOnlineMeeting=false',
  },
  bug_report_submitted: {
    type: 'bug_report_submitted',
    severity: 'info',
    ticketRef: 'ZEB-42',
    title: 'Button misaligned',
    reportType: 'Bug',
    reporter: 'Alex MC (mc@business.example)',
    routePath: '/couples',
    notionUrl: 'https://notion.so/zeb-42',
  },
  bug_report_notion_sync_failed: {
    type: 'bug_report_notion_sync_failed',
    severity: 'error',
    reportId: 'report-1',
    title: 'Button misaligned',
    description: 'Steps to reproduce: click the button.',
    reporter: 'Alex MC (mc@business.example)',
    reason: 'Notion API unavailable',
  },
  bug_report_screenshot_upload_failed: {
    type: 'bug_report_screenshot_upload_failed',
    severity: 'warn',
    reportId: 'report-1',
    reason: 'file too large',
  },
  app_error: {
    type: 'app_error',
    severity: 'error',
    message: 'unexpected error',
    source: 'test',
  },
};

const allTypes = Object.keys(fixtures) as AlertEvent['type'][];

describe('AlertEvent fixtures carry no couple-side PII (T27)', () => {
  it('covers every AlertEvent type with a fixture', () => {
    // FixturesByType already guarantees this at compile time (a missing
    // key fails to compile); this just makes it visible at runtime too.
    expect(allTypes.length).toBe(65);
  });

  it.each(allTypes)('%s: no field outside the MC allowlist looks like an email', (type) => {
    const event = fixtures[type];
    for (const [key, value] of Object.entries(event)) {
      if (MC_EMAIL_FIELDS.has(`${type}:${key}`)) continue;
      if (typeof value !== 'string') continue;
      expect(
        EMAIL_SHAPE.test(value),
        `${type}.${key} = ${JSON.stringify(value)} looks like an email`,
      ).toBe(false);
    }
  });

  it.each(allTypes)('%s: has no field literally named coupleName or bookerName', (type) => {
    const event = fixtures[type];
    expect(event).not.toHaveProperty('coupleName');
    expect(event).not.toHaveProperty('bookerName');
  });

  it.each(allTypes)('%s: assertNoCouplePii passes it through untouched', (type) => {
    const event = fixtures[type];
    expect(assertNoCouplePii(event)).toBe(event);
  });

  it.each(allTypes)('%s: the formatted Slack line has no stray email', (type) => {
    const event = fixtures[type];
    const allowedEmails = Object.entries(event)
      .filter(([key]) => MC_EMAIL_FIELDS.has(`${type}:${key}`))
      .map(([, value]) => value)
      .filter((v): v is string => typeof v === 'string');
    const text = formatSlackMessage(event).text;
    const matches = text.match(EMAIL_SHAPE_EXACT) ?? [];
    for (const match of matches) {
      const isAllowed = allowedEmails.some((allowed) => allowed.includes(match));
      expect(isAllowed, `${type} Slack line has an unexpected email-shaped string: ${match}`).toBe(
        true,
      );
    }
  });
});

describe('assertNoCouplePii', () => {
  it('throws in the test environment when a non-allowlisted field looks like an email', () => {
    // Simulates a regressed call site: a free-text field carrying an
    // address instead of an id. Cast around the type system on purpose,
    // since every real AlertEvent member is already clean.
    const poisoned = {
      type: 'workflow_email_sent',
      severity: 'info',
      stepTitle: 'oops@leaked.example',
      coupleId: 'couple-1',
      contactId: null,
      stepId: null,
      messageId: null,
    } as unknown as AlertEvent;
    expect(() => assertNoCouplePii(poisoned)).toThrow(/email-shaped/);
  });

  it('redacts instead of throwing outside the test environment', () => {
    vi.stubEnv('NODE_ENV', 'production');
    try {
      const poisoned = {
        type: 'workflow_email_sent',
        severity: 'info',
        stepTitle: 'oops@leaked.example',
        coupleId: 'couple-1',
        contactId: null,
        stepId: null,
        messageId: null,
      } as unknown as AlertEvent;
      const safe = assertNoCouplePii(poisoned) as unknown as { stepTitle: string };
      expect(safe.stepTitle).toBe('[redacted]');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('leaves an allowlisted email field alone', () => {
    const event: AlertEvent = {
      type: 'signup_completed',
      severity: 'info',
      email: 'mc@business.example',
      displayName: 'Alex MC',
    };
    expect(assertNoCouplePii(event)).toBe(event);
  });

  it('does not allowlist a field by name alone on the wrong event type', () => {
    // I1: keying by field name only would let this through, since
    // `email` is allowlisted on `signup_completed`. Keying by
    // `type:field` must catch it on an event that has never carried an
    // MC email in that field.
    const poisoned = {
      type: 'workflow_step_stuck',
      severity: 'error',
      count: 1,
      stepIds: ['step-1'],
      email: 'oops@leaked.example',
    } as unknown as AlertEvent;
    expect(() => assertNoCouplePii(poisoned)).toThrow(/email-shaped/);
  });

  it('recurses into a nested array to catch an email-shaped string (M1)', () => {
    const poisoned = {
      type: 'workflow_step_stuck',
      severity: 'error',
      count: 2,
      stepIds: ['step-1', 'oops@leaked.example'],
    } as unknown as AlertEvent;
    expect(() => assertNoCouplePii(poisoned)).toThrow(/email-shaped/);
  });

  it('recurses into a nested object to catch an email-shaped string (M1)', () => {
    const poisoned = {
      type: 'app_error',
      severity: 'error',
      message: 'test',
      source: { nested: 'oops@leaked.example' },
    } as unknown as AlertEvent;
    expect(() => assertNoCouplePii(poisoned)).toThrow(/email-shaped/);
  });

  it('redacts a nested array in place outside the test environment, leaving the rest alone (M1)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    try {
      const poisoned = {
        type: 'workflow_step_stuck',
        severity: 'error',
        count: 2,
        stepIds: ['step-1', 'oops@leaked.example'],
      } as unknown as AlertEvent;
      const safe = assertNoCouplePii(poisoned) as unknown as { stepIds: string[] };
      expect(safe.stepIds).toEqual(['step-1', '[redacted]']);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('gives up past the depth cap rather than recursing without bound (M1)', () => {
    // Ten levels of array nesting is well past any reasonable cap. The
    // guard must stop short of the email at the bottom rather than
    // walking forever, so this must NOT throw.
    let deep: unknown = 'oops@leaked.example';
    for (let i = 0; i < 10; i++) deep = [deep];
    const poisoned = {
      type: 'workflow_step_stuck',
      severity: 'error',
      count: 1,
      stepIds: deep,
    } as unknown as AlertEvent;
    expect(() => assertNoCouplePii(poisoned)).not.toThrow();
  });
});
