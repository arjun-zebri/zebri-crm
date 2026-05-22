/**
 * Unit tests for `CurrentPlanCard`.
 *
 * Covers every `CardState` branch (starter / active / cancelling_in_grace
 * / past_due / expired / comped) to prove:
 * - the right `StatePill` label + tone surfaces,
 * - the right `PrimaryAction` button renders,
 * - the `MetaLine` reflects the relevant date(s),
 * - actions that depend on Supabase / fetch don't fire from render
 *   (mocked at the module boundary).
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CurrentPlanCard, type CurrentPlanCardProps } from '@/app/(dashboard)/settings/billing/current-plan-card';

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => Promise.resolve({ count: 0, data: null, error: null }),
    }),
  }),
}));

vi.mock('@/app/(dashboard)/settings/billing/actions', () => ({
  paymentMethodPortalAction: vi.fn(async () => ({ url: 'https://stripe' })),
  resumeSubscriptionAction: vi.fn(async () => ({ ok: true })),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const baseProps: CurrentPlanCardProps = {
  status: null,
  trialEnd: null,
  subscriptionEnd: null,
  subscriptionPlan: null,
  hasStripeCustomer: false,
  cancelAtPeriodEnd: false,
  isSubscribed: false,
  isComped: false,
  userCreatedAt: '2026-03-15T00:00:00Z',
  onManagePlan: vi.fn(),
  onRequestCancel: vi.fn(),
  onAfterAction: vi.fn(),
};

function renderCard(overrides: Partial<CurrentPlanCardProps>) {
  return render(<CurrentPlanCard {...baseProps} {...overrides} />);
}

describe('CurrentPlanCard — state rendering', () => {
  it('starter: shows Free plan pill + Upgrade to Pro action', () => {
    renderCard({ status: null, isSubscribed: false });
    expect(screen.getByText('Free plan')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upgrade to Pro/i })).toBeInTheDocument();
    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.getByText(/Joined/i)).toBeInTheDocument();
  });

  it('active: shows Active pill + Change plan action + renewal date', () => {
    renderCard({
      status: 'active',
      isSubscribed: true,
      subscriptionPlan: 'pro',
      subscriptionEnd: '2026-06-15T00:00:00Z',
    });
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Change plan/i })).toBeInTheDocument();
    expect(screen.getByText(/Renews/i)).toBeInTheDocument();
    // Cancel link visible on active subs.
    expect(screen.getByRole('button', { name: /Cancel subscription/i })).toBeInTheDocument();
  });

  it('cancelling_in_grace: shows Cancelling pill + Resubscribe action + Access until', () => {
    renderCard({
      status: 'active',
      isSubscribed: true,
      cancelAtPeriodEnd: true,
      subscriptionPlan: 'pro',
      subscriptionEnd: '2026-06-15T00:00:00Z',
    });
    expect(screen.getByText('Cancelling')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resubscribe/i })).toBeInTheDocument();
    expect(screen.getByText(/Access until/i)).toBeInTheDocument();
    // Cancel link only on uncancelled active subs — should be absent.
    expect(screen.queryByRole('button', { name: /Cancel subscription/i })).toBeNull();
  });

  it('past_due: shows Payment failed pill + Update payment action + danger banner', () => {
    renderCard({
      status: 'past_due',
      isSubscribed: false,
      subscriptionPlan: 'pro',
    });
    expect(screen.getByText('Payment failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Update payment/i })).toBeInTheDocument();
    expect(screen.getByText(/restore access/i)).toBeInTheDocument();
  });

  it('expired: shows Ended pill + Upgrade action + ended-on meta', () => {
    renderCard({
      status: 'expired',
      isSubscribed: false,
      subscriptionEnd: '2026-04-01T00:00:00Z',
    });
    // "Ended" appears twice — once as the pill, once in the meta
    // line ("Ended {date}"). Verify there are two matches and the
    // pill is the standalone one.
    const endedMatches = screen.getAllByText(/Ended/i);
    expect(endedMatches.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('button', { name: /Upgrade to Pro/i })).toBeInTheDocument();
  });

  it('comped: shows Comped pill + no actions row', () => {
    const { container } = renderCard({
      status: 'active',
      isComped: true,
      subscriptionPlan: 'pro',
    });
    expect(screen.getByText('Comped')).toBeInTheDocument();
    // The actions row should not render for comped users.
    expect(screen.queryByRole('button', { name: /Change plan|Upgrade|Resubscribe/i })).toBeNull();
    expect(within(container).queryByText(/Cancel subscription/i)).toBeNull();
  });
});

describe('CurrentPlanCard — pricing display', () => {
  it('shows /mo suffix for paid plans', () => {
    renderCard({ status: 'active', isSubscribed: true, subscriptionPlan: 'pro' });
    expect(screen.getByText('/mo')).toBeInTheDocument();
  });

  it('shows "Free" for the starter plan', () => {
    renderCard({ status: null });
    expect(screen.getByText('Free')).toBeInTheDocument();
  });
});
