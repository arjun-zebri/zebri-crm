import { afterEach, beforeEach, vi } from 'vitest';

// Mock the Slack transport before importing send-alert so the import-time
// binding captures the spy. The logger writes to console (silenced here).
vi.mock('@/lib/alerts/slack', () => ({
  sendSlackAlert: vi.fn().mockResolvedValue(undefined),
  // These tests assert dispatch behaviour, not the local-run gate, so the
  // gate is stubbed open. Suppression itself is covered in
  // tests/unit/alerts/send-alert-suppression.test.ts.
  slackSuppressed: vi.fn().mockReturnValue(false),
}));

import { registerTransport, type LogContext } from '@/lib/alerts/logger';
import { sendAlert, formatSlackMessage } from '@/lib/alerts/send-alert';
import { sendSlackAlert } from '@/lib/alerts/slack';

describe('formatSlackMessage', () => {
  it('formats a signup_completed event', () => {
    const payload = formatSlackMessage({
      type: 'signup_completed',
      severity: 'info',
      email: 'sarah@example.com',
      displayName: 'Sarah',
      businessName: 'Sarah MC',
    });
    expect(payload.text).toContain(':information_source:');
    expect(payload.text).toContain('signup completed');
    expect(payload.text).toContain('Sarah');
    expect(payload.text).toContain('sarah@example.com');
    expect(payload.text).toContain('Sarah MC');
  });

  it('uses the danger emoji for error severity', () => {
    const payload = formatSlackMessage({
      type: 'payment_failed',
      severity: 'error',
      email: 'a@b.com',
      reason: 'card_declined',
    });
    expect(payload.text).toContain(':rotating_light:');
    expect(payload.text).toContain('card_declined');
  });

  it('names the missing join link for a video booking with no calendar', () => {
    const payload = formatSlackMessage({
      type: 'booking_created_without_calendar',
      severity: 'warn',
      userId: 'u1',
      bookingId: 'b1',
      locationType: 'video',
    });
    expect(payload.text).toContain('u1');
    expect(payload.text).toContain('b1');
    expect(payload.text).toContain('no connected calendar');
    // Why: a video booking without a push is worse than the others, because
    // the couple receives a "Video call" confirmation with nothing to click.
    expect(payload.text).toContain('no join link sent');
  });

  it('omits the join-link note for a non-video booking with no calendar', () => {
    const payload = formatSlackMessage({
      type: 'booking_created_without_calendar',
      severity: 'warn',
      userId: 'u1',
      bookingId: 'b1',
      locationType: 'in_person',
    });
    expect(payload.text).toContain('no connected calendar');
    expect(payload.text).not.toContain('no join link sent');
  });

  it('uses the warning emoji for warn severity', () => {
    const payload = formatSlackMessage({
      type: 'rls_denied_spike',
      severity: 'warn',
      table: 'couples',
      count: 42,
      windowMinutes: 5,
    });
    expect(payload.text).toContain(':warning:');
    expect(payload.text).toContain('42 denials on couples');
  });
});

describe('sendAlert', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(sendSlackAlert).mockClear();
  });

  it('dispatches via Slack with the formatted payload', async () => {
    await sendAlert({
      type: 'stripe_webhook_failed',
      severity: 'error',
      eventType: 'invoice.payment_failed',
      errorMessage: 'signature invalid',
    });
    expect(sendSlackAlert).toHaveBeenCalledTimes(1);
    const [arg] = vi.mocked(sendSlackAlert).mock.calls[0]!;
    expect(arg.text).toContain('stripe webhook failed');
    expect(arg.text).toContain('signature invalid');
  });

  it('writes an error-severity log for error events', async () => {
    await sendAlert({
      type: 'cron_job_failed',
      severity: 'error',
      job: 'expire-contracts',
      errorMessage: 'timeout',
    });
    expect(console.error).toHaveBeenCalled();
  });

  it('writes a warn-severity log for warn events', async () => {
    await sendAlert({
      type: 'resend_bounced',
      severity: 'warn',
      to: 'a@b.com',
      subject: 'Quote',
    });
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('sendAlert structured log', () => {
  /** Capture every record the logger emits for the duration of one test. */
  function captureLogs() {
    const records: Array<{ message: string; context: LogContext }> = [];
    const off = registerTransport((_level, message, context) => {
      records.push({ message, context });
    });
    return { records, off };
  }

  it('masks a capability token before it reaches the log sink', async () => {
    const { records, off } = captureLogs();
    try {
      await sendAlert({
        type: 'booking_created',
        severity: 'info',
        userId: 'user-1',
        email: 'mc@example.com',
        bookerName: 'Alice',
        manageToken: '11111111-2222-3333-4444-555555555555',
      });
    } finally {
      off();
    }

    const record = records.find((r) => r.message === 'alert: booking_created');
    expect(record).toBeDefined();
    // A prefix survives so one token can be followed across log lines during
    // an incident; the rest is gone, because the whole value cancels and
    // reschedules the booking for anyone who can read the logs.
    expect(record!.context.manageToken).toBe('11111111…');
    expect(JSON.stringify(record!.context)).not.toContain('555555555555');
  });

  it('leaves non-token fields untouched', async () => {
    const { records, off } = captureLogs();
    try {
      await sendAlert({
        type: 'booking_created',
        severity: 'info',
        userId: 'user-1',
        email: 'mc@example.com',
        bookerName: 'Alice',
        manageToken: '11111111-2222-3333-4444-555555555555',
      });
    } finally {
      off();
    }

    const record = records.find((r) => r.message === 'alert: booking_created')!;
    expect(record.context.email).toBe('mc@example.com');
    expect(record.context.bookerName).toBe('Alice');
    expect(record.context.userId).toBe('user-1');
  });

  it('never printed the token on the Slack line either', async () => {
    const payload = formatSlackMessage({
      type: 'booking_created',
      severity: 'info',
      userId: 'user-1',
      email: 'mc@example.com',
      bookerName: 'Alice',
      manageToken: '11111111-2222-3333-4444-555555555555',
    });
    expect(payload.text).not.toContain('11111111');
  });
});
