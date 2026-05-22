/**
 * Unit tests for `CancelConfirmModal`.
 *
 * - Renders the grace-period end date when provided.
 * - Falls back to generic copy when no end date is known.
 * - Busy flag disables both buttons + flips the confirm label.
 * - Confirm + cancel buttons wire to their respective callbacks.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CancelConfirmModal } from '@/app/(dashboard)/settings/billing/cancel-confirm-modal';

function setup(overrides: Partial<React.ComponentProps<typeof CancelConfirmModal>> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    busy: false,
    subscriptionEnd: null as string | null,
    ...overrides,
  };
  render(<CancelConfirmModal {...props} />);
  return props;
}

describe('CancelConfirmModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <CancelConfirmModal
        open={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        busy={false}
        subscriptionEnd={null}
      />,
    );
    expect(container.querySelector('[role="dialog"], h2')).toBeNull();
  });

  it('shows the grace-period date when subscriptionEnd is set', () => {
    setup({ subscriptionEnd: '2026-06-15T00:00:00Z' });
    expect(screen.getByText(/until/i)).toBeInTheDocument();
    // Date rendering is locale-dependent; rather than asserting the
    // exact format, we confirm the year + month parts show up.
    const body = screen.getByText(/keep access/i);
    expect(body.textContent).toMatch(/2026|Jun/);
  });

  it('falls back to generic copy when no end date is known', () => {
    setup({ subscriptionEnd: null });
    expect(
      screen.getByText(/until the end of your current billing period/i),
    ).toBeInTheDocument();
  });

  it('confirm button calls onConfirm when not busy', async () => {
    const { onConfirm } = setup();
    await userEvent.click(screen.getByRole('button', { name: /Yes, cancel/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('keep button calls onClose when not busy', async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByRole('button', { name: /Keep subscription/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('busy=true disables both buttons + flips confirm label', () => {
    setup({ busy: true });
    expect(screen.getByRole('button', { name: /Cancelling/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Keep subscription/i })).toBeDisabled();
  });
});
