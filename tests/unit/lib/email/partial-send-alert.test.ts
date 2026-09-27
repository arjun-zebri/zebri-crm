/**
 * `workflow_send_partial_failure` (Task 31, audit M6): a step that mailed
 * some of its recipients and failed on others stays green in the engine,
 * so the alert is how anyone on call finds out. Ids, counts and an error
 * code only (T27), and one per tenant per ten minutes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendAlertMock = vi.fn<(event: unknown) => Promise<void>>(async () => undefined);
vi.mock('@/lib/alerts', () => ({ sendAlert: (event: unknown) => sendAlertMock(event) }));

import { assertNoCouplePii } from '@/lib/alerts/send-alert';
import {
  _resetPartialSendAlertDedupForTest,
  alertPartialSendFailure,
} from '@/lib/email/partial-send-alert';

const input = {
  userId: 'user-1',
  coupleId: 'couple-1',
  stepId: 'step-1',
  instanceId: 'instance-1',
  actionType: 'send_email' as const,
  sent: 1,
  failed: 1,
  code: 'validation_error',
};

beforeEach(() => {
  sendAlertMock.mockClear();
  _resetPartialSendAlertDedupForTest();
});

describe('alertPartialSendFailure', () => {
  it('raises the alert with ids, counts and the code', async () => {
    await alertPartialSendFailure(input);
    expect(sendAlertMock).toHaveBeenCalledWith({
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
    });
    // And the event itself clears the PII guard untouched.
    const event = sendAlertMock.mock.calls[0]![0] as Parameters<typeof assertNoCouplePii>[0];
    expect(assertNoCouplePii(event)).toBe(event);
  });

  it('raises at most one per tenant inside the window', async () => {
    await alertPartialSendFailure(input);
    await alertPartialSendFailure({ ...input, stepId: 'step-2' });
    await alertPartialSendFailure({ ...input, userId: 'user-2' });
    expect(sendAlertMock).toHaveBeenCalledTimes(2);
    expect(sendAlertMock.mock.calls.map((c) => (c[0] as { userId: string }).userId)).toEqual([
      'user-1',
      'user-2',
    ]);
  });

  it('raises again once the ten-minute window has passed', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-09-25T00:00:00Z'));
      await alertPartialSendFailure(input);
      vi.setSystemTime(new Date('2026-09-25T00:09:59Z'));
      await alertPartialSendFailure(input);
      vi.setSystemTime(new Date('2026-09-25T00:10:01Z'));
      await alertPartialSendFailure(input);
      expect(sendAlertMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does nothing when nothing failed', async () => {
    await alertPartialSendFailure({ ...input, failed: 0 });
    expect(sendAlertMock).not.toHaveBeenCalled();
  });
});
