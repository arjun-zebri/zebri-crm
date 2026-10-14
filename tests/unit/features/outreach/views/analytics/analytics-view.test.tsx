// tests/unit/features/outreach/views/analytics/analytics-view.test.tsx
/**
 * Analytics tab: the campaign picker only appears once there is something
 * to filter, and the empty state offers a way to the campaigns.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn(), push }),
}));

const campaigns = { data: [] as { id: string; name: string }[] };
const analytics = {
  isPending: false,
  isError: false,
  refetch: vi.fn(),
  data: { funnel: { contacted: 0 }, daily: [], bounceRate: null, optOutRate: null, report: {} } as unknown,
};
vi.mock('@/features/outreach/hooks', () => ({
  useCampaigns: () => campaigns,
  useAnalytics: () => analytics,
}));

// The chart and tables are not under test here; the empty branch never renders them.
vi.mock('@/features/outreach/views/analytics/report-tables', () => ({ ReportTables: () => null }));
vi.mock('@/features/outreach/views/analytics/funnel-strip', () => ({ FunnelStrip: () => null }));
vi.mock('@/features/outreach/views/analytics/deliverability-card', () => ({ DeliverabilityCard: () => null }));

import { AnalyticsView } from '@/features/outreach/views/analytics-view';

beforeEach(() => {
  push.mockClear();
  campaigns.data = [];
  analytics.data = { funnel: { contacted: 0 }, daily: [], bounceRate: null, optOutRate: null, report: {} };
});

describe('Analytics campaign picker', () => {
  it('is hidden when there are no campaigns', () => {
    render(<AnalyticsView />);
    expect(screen.queryByLabelText('Campaign')).not.toBeInTheDocument();
  });

  it('is hidden when campaigns exist but nothing has been sent', () => {
    campaigns.data = [{ id: 'c1', name: 'Spring' }];
    render(<AnalyticsView />);
    expect(screen.queryByLabelText('Campaign')).not.toBeInTheDocument();
  });

  it('appears once there are sends to compare', () => {
    campaigns.data = [{ id: 'c1', name: 'Spring' }];
    analytics.data = { ...(analytics.data as object), funnel: { contacted: 12 } };
    render(<AnalyticsView />);
    expect(screen.getByLabelText('Campaign')).toBeInTheDocument();
  });
});

describe('Analytics empty state', () => {
  it('explains the wait and offers a secondary way to the campaigns', () => {
    render(<AnalyticsView />);
    expect(screen.getByText('Nothing sent yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Go to campaigns' }));
    expect(push).toHaveBeenCalledWith('/admin/outreach?view=campaigns');
  });
});
