/**
 * The step detail for a send that reached only some recipients (Task 31,
 * audit M6): a warning callout with the counts and the reason, since the
 * step itself reads as done.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { StepDetail } from '@/app/(dashboard)/workflows/instance-actions';
import { StepDetailBody } from '@/app/(dashboard)/workflows/step-detail-body';

const base: StepDetail = {
  stepId: 'step-1',
  title: 'Send welcome email',
  description: null,
  type: 'action',
  actionType: 'send_email',
  config: {},
  status: 'done',
  errorMessage: null,
  sendWarning: null,
  dueAt: null,
  requiresApproval: false,
  instanceName: 'Booking flow',
  coupleId: 'couple-1',
  coupleName: 'Sam & Priya',
  weddingDate: null,
  stepIndex: 1,
  stepTotal: 3,
  preview: null,
  blockedReason: null,
};

describe('StepDetailBody partial send', () => {
  it('says how many went, how many failed, and why', () => {
    render(<StepDetailBody data={{ ...base, sendWarning: { sent: 1, failed: 1, reason: 'mailbox full' } }} />);
    expect(screen.getByText(/Sent to 1 of 2, 1 failed/)).toBeInTheDocument();
    expect(screen.getByText(/mailbox full/)).toBeInTheDocument();
  });

  it('says nothing about failures on a clean send', () => {
    render(<StepDetailBody data={base} />);
    expect(screen.queryByText(/failed/)).toBeNull();
  });
});
