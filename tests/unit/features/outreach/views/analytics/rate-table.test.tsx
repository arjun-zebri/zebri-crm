// tests/unit/features/outreach/views/analytics/rate-table.test.tsx
/**
 * Analytics comparison tables: plain column names, counts instead of
 * meaningless rates for groups too small to compare, and rates with their
 * range once a group is big enough.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RateTable } from '@/features/outreach/views/analytics/rate-table';
import type { BreakdownRow } from '@/lib/outreach/analytics/compute';

const rate = { successes: 2, n: 4, rate: 0.5, low: 0.2, high: 0.8 };
const metrics = { n: 4, reply: rate, positive: rate, booked: rate, paying: rate, optOut: rate };
const big = { successes: 12, n: 100, rate: 0.12, low: 0.06, high: 0.21 };
const bigMetrics = { n: 100, reply: big, positive: big, booked: big, paying: big, optOut: big };

describe('RateTable', () => {
  it('uses plain column headers', () => {
    render(<RateTable title="Steps" rows={[{ key: 'a', label: 'Step 1', metrics } as unknown as BreakdownRow]} />);
    expect(screen.getByRole('columnheader', { name: 'Sample size' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Demo booked' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Opted out' })).toBeInTheDocument();
  });

  it('shows counts, not rates, and says once that small groups show counts', () => {
    render(<RateTable title="Steps" rows={[{ key: 'a', label: 'Step 1', metrics } as unknown as BreakdownRow]} />);
    expect(screen.getByText(/under 30 sends, a group shows counts, not rates/i)).toBeVisible();
    expect(screen.getAllByText('2 of 4')).toHaveLength(5);
    expect(screen.queryByText('50%')).not.toBeInTheDocument();
  });

  it('shows the rate and its range once a group is big enough', () => {
    render(<RateTable title="Steps" rows={[{ key: 'a', label: 'Step 1', metrics: bigMetrics } as unknown as BreakdownRow]} />);
    expect(screen.getAllByText('12%')).toHaveLength(5);
    expect(screen.getAllByText('6% to 21%')).toHaveLength(5);
    expect(screen.queryByText(/too early to compare/i)).not.toBeInTheDocument();
  });
});
