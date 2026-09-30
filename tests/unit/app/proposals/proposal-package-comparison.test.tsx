/**
 * F2: a card click is not a commitment. Only a signed acceptance reads
 * "Chosen"; a package the couple only clicked reads "Selected".
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProposalPackageComparison } from '@/app/(dashboard)/proposals/[id]/proposal-package-comparison';
import type { PackageEngagementRow } from '@/features/proposals';

const rows = (chosenBy: PackageEngagementRow['chosenBy']): PackageEngagementRow[] => [
  { optionId: 'o1', title: 'Premium', views: 2, seconds: 40, chosenBy: null },
  { optionId: 'o2', title: 'Full day', views: 1, seconds: 10, chosenBy },
];

describe('ProposalPackageComparison', () => {
  it('says Chosen and "chose" for an accepted package', () => {
    render(<ProposalPackageComparison rows={rows('accepted')} />);
    expect(screen.getByText('Chosen')).toBeInTheDocument();
    expect(screen.queryByText('Selected')).not.toBeInTheDocument();
    expect(screen.getByText('Lingered on Premium, chose Full day.')).toBeInTheDocument();
  });

  it('says Selected, never Chosen, for a package only clicked', () => {
    render(<ProposalPackageComparison rows={rows('selected')} />);
    expect(screen.getByText('Selected')).toBeInTheDocument();
    expect(screen.queryByText('Chosen')).not.toBeInTheDocument();
    expect(screen.getByText('Lingered on Premium, selected Full day.')).toBeInTheDocument();
  });

  it('shows neither pill nor helper line with no selection', () => {
    render(<ProposalPackageComparison rows={rows(null)} />);
    expect(screen.queryByText('Chosen')).not.toBeInTheDocument();
    expect(screen.queryByText('Selected')).not.toBeInTheDocument();
    expect(screen.queryByText(/Lingered on/)).not.toBeInTheDocument();
  });
});
