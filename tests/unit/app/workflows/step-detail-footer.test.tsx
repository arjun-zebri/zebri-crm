/**
 * The step detail footer on a send still behind an earlier step.
 *
 * Snooze gives it a date the engine runs on sight and Send & complete
 * runs it now, so either would send it before the to-do or Wait above
 * it. Neither is offered; the footer says why instead.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  StepDetailFooter,
  type StepDetailFooterProps,
} from '@/app/(dashboard)/workflows/step-detail-footer';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const base: StepDetailFooterProps = {
  loaded: true,
  coupleId: 'couple-1',
  canSave: true,
  errored: false,
  automated: true,
  blockedReason: null,
  saving: false,
  acting: false,
  onSave: vi.fn(),
  onAct: vi.fn(),
};

describe('StepDetailFooter', () => {
  it('offers Snooze and Send & complete on a released send', () => {
    render(<StepDetailFooter {...base} />);
    expect(screen.getByRole('button', { name: 'Snooze' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send & complete/ })).toBeInTheDocument();
  });

  it('offers neither on a send still behind an earlier step, and says why', () => {
    const reason = 'This step waits for "Wait" to finish first.';
    render(<StepDetailFooter {...base} blockedReason={reason} />);
    expect(screen.queryByRole('button', { name: 'Snooze' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Send & complete/ })).toBeNull();
    expect(screen.getByText(reason)).toBeInTheDocument();
    // Editing the message is still fine: it sends nothing.
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });
});
