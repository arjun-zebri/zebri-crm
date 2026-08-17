/**
 * Unit tests for `PlanComparisonDialog`.
 *
 * Covers:
 * - 3 plan columns render with names + prices,
 * - "Current" label appears on the active plan column,
 * - "Switch" buttons appear on non-current paid plans,
 * - "Cancel" button appears on the starter column when current is paid,
 * - clicking Cancel closes the modal and calls onRequestCancel,
 * - the absolute-positioned tint div is keyed off the current plan's
 *   position in the table (40% / 60% / 80% from the left).
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PlanComparisonDialog } from '@/app/(dashboard)/settings/billing/plan-comparison';

vi.mock('@/app/(dashboard)/settings/billing/actions', () => ({
  createPlanChangeSessionAction: vi.fn(async () => ({ url: 'https://stripe' })),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('PlanComparisonDialog — rendering', () => {
  it('renders all 3 plan columns when open', () => {
    render(
      <PlanComparisonDialog
        open
        onClose={vi.fn()}
        currentPlan="pro"
        isSubscribed
        cancelAtPeriodEnd={false}
        onRequestCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('Max')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <PlanComparisonDialog
        open={false}
        onClose={vi.fn()}
        currentPlan="pro"
        isSubscribed
        cancelAtPeriodEnd={false}
        onRequestCancel={vi.fn()}
      />,
    );
    expect(container.querySelector('table')).toBeNull();
  });

  it('shows "Current" on the active plan column', () => {
    render(
      <PlanComparisonDialog
        open
        onClose={vi.fn()}
        currentPlan="pro"
        isSubscribed
        cancelAtPeriodEnd={false}
        onRequestCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('shows "Switch" buttons on non-current paid plans', () => {
    render(
      <PlanComparisonDialog
        open
        onClose={vi.fn()}
        currentPlan="pro"
        isSubscribed
        cancelAtPeriodEnd={false}
        onRequestCancel={vi.fn()}
      />,
    );
    // Currently on Pro → expect a Switch on Max (the other paid plan)
    // and a Cancel on Starter.
    const switchButtons = screen.getAllByRole('button', { name: 'Switch' });
    expect(switchButtons).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('starter user sees Switch on Pro AND Max (no Cancel)', () => {
    render(
      <PlanComparisonDialog
        open
        onClose={vi.fn()}
        currentPlan="starter"
        isSubscribed={false}
        cancelAtPeriodEnd={false}
        onRequestCancel={vi.fn()}
      />,
    );
    const switchButtons = screen.getAllByRole('button', { name: 'Switch' });
    expect(switchButtons).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });
});

describe('PlanComparisonDialog — interactions', () => {
  it('Cancel button closes the modal and requests cancel-confirm', async () => {
    const onClose = vi.fn();
    const onRequestCancel = vi.fn();
    render(
      <PlanComparisonDialog
        open
        onClose={onClose}
        currentPlan="pro"
        isSubscribed
        cancelAtPeriodEnd={false}
        onRequestCancel={onRequestCancel}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onRequestCancel).toHaveBeenCalledOnce();
  });
});

describe('PlanComparisonDialog — column tint position', () => {
  it.each([
    ['starter', '40%'],
    ['pro', '60%'],
    ['max', '80%'],
  ] as const)('tint sits at %s for currentPlan=%s', (currentPlan, expectedLeft) => {
    render(
      <PlanComparisonDialog
        open
        onClose={vi.fn()}
        currentPlan={currentPlan}
        isSubscribed={currentPlan !== 'starter'}
        cancelAtPeriodEnd={false}
        onRequestCancel={vi.fn()}
      />,
    );
    // Queried from the document, not RTL's container: Modal portals to
    // the body, so its contents sit outside the render root.
    //
    // Two elements carry aria-hidden in this surface (the tint div
    // and an empty <th> in the action row). Pick the DIV — it's the
    // one with the inline `left` style we're asserting on.
    const tints = document.body.querySelectorAll<HTMLElement>('div[aria-hidden="true"]');
    expect(tints.length).toBeGreaterThan(0);
    expect(tints[0]?.style.left).toBe(expectedLeft);
  });
});
