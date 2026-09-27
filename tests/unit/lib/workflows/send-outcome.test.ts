/**
 * The partial-send warning (Task 31, audit M6).
 *
 * A step that mailed one of two recipients stays `done` (erroring it
 * would re-run it and double-send the one that worked), so the warning
 * is derived from the step's output. These pin the derivation every
 * surface uses: the couple's checklist row, the step detail and the
 * activity feed.
 */
import { describe, expect, it } from 'vitest';

import { partialSendFailure, partialSendFailureLabel } from '@/lib/workflows/send-outcome';

describe('partialSendFailure', () => {
  it('reads the counts and the reason off a send step output', () => {
    expect(
      partialSendFailure({ recipients: 2, sent: 1, failed: 1, last_error: 'mailbox full' }),
    ).toEqual({ sent: 1, failed: 1, reason: 'mailbox full' });
  });

  it('is null when nothing failed', () => {
    expect(partialSendFailure({ sent: 2, failed: 0 })).toBeNull();
    expect(partialSendFailure({ sent: true, message_id: 'm1' })).toBeNull();
  });

  it('is null for anything that is not a send output', () => {
    expect(partialSendFailure(null)).toBeNull();
    expect(partialSendFailure('failed')).toBeNull();
    expect(partialSendFailure([1, 2])).toBeNull();
    expect(partialSendFailure({ failed: 'many' })).toBeNull();
  });

  it('counts a boolean or missing sent as none, and a missing reason as null', () => {
    expect(partialSendFailure({ failed: 1, emailed: true })).toEqual({ sent: 0, failed: 1, reason: null });
  });
});

describe('partialSendFailureLabel', () => {
  it('says how many of how many went, and how many failed', () => {
    expect(partialSendFailureLabel({ sent: 1, failed: 1, reason: null })).toBe('Sent to 1 of 2, 1 failed');
    expect(partialSendFailureLabel({ sent: 3, failed: 2, reason: 'x' })).toBe('Sent to 3 of 5, 2 failed');
  });
});
