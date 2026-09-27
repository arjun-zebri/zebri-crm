/**
 * The quiet-hours check a sleeping wait gets at the moment it wakes.
 *
 * A woken wait finishes without being evaluated again and releases the
 * send behind it at once, so a wake stored inside quiet hours (the
 * wedding recompute writes one unshifted) must hold to the window's end.
 */
import { describe, expect, it } from 'vitest';

import { quietHoursHoldUntil } from '@/lib/workflows/execute-step';
import type { RunContext } from '@/types/automations';
import type { WorkflowStepRow } from '@/types/workflows';

/** Only the two fields the check reads; the rest of a context is noise here. */
const ctx = {
  mc: { quietHoursStart: '21:00', quietHoursEnd: '08:00', quietHoursTimezone: 'Australia/Sydney' },
  couple: { timezone: 'Australia/Sydney' },
} as unknown as RunContext;

function wait(config: Record<string, unknown>): WorkflowStepRow {
  return { type: 'wait', config } as unknown as WorkflowStepRow;
}

const INSIDE = new Date('2027-05-31T21:30:00.000Z'); // 07:30 in Sydney
const OUTSIDE = new Date('2027-05-31T23:00:00.000Z'); // 09:00 in Sydney

describe('quietHoursHoldUntil', () => {
  it('holds a wait woken inside the window until the window ends', () => {
    const hold = quietHoursHoldUntil(wait({ mode: 'duration', durationMinutes: 60 }), ctx, null, INSIDE);
    expect(hold?.toISOString()).toBe('2027-05-31T22:00:00.000Z');
  });

  it('lets a wait woken outside the window finish', () => {
    expect(
      quietHoursHoldUntil(wait({ mode: 'duration', durationMinutes: 60 }), ctx, null, OUTSIDE),
    ).toBeNull();
  });

  it('lets a wait that opted out of quiet hours finish', () => {
    expect(
      quietHoursHoldUntil(
        wait({ mode: 'duration', durationMinutes: 60, respectQuietHours: false }),
        ctx,
        null,
        INSIDE,
      ),
    ).toBeNull();
  });

  it('never holds anything but a wait', () => {
    const action = { type: 'action', config: {} } as unknown as WorkflowStepRow;
    expect(quietHoursHoldUntil(action, ctx, null, INSIDE)).toBeNull();
  });
});
