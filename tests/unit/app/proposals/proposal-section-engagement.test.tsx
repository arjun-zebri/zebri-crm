/**
 * F8: "Most readers leave around X" is a claim about readers in the
 * plural, so it needs at least three sessions behind it.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProposalSectionEngagement } from '@/app/(dashboard)/proposals/[id]/proposal-section-engagement';

const rows = [
  { id: 'a', label: 'Cover', seconds: 20, reachPct: 100 },
  { id: 'b', label: 'Packages', seconds: 5, reachPct: 34 },
];

describe('ProposalSectionEngagement', () => {
  it('does not say where most readers leave with one session', () => {
    render(<ProposalSectionEngagement rows={rows} sessions={1} />);
    expect(screen.queryByText(/Most readers leave/)).not.toBeInTheDocument();
  });

  it('does not say it with two sessions either', () => {
    render(<ProposalSectionEngagement rows={rows} sessions={2} />);
    expect(screen.queryByText(/Most readers leave/)).not.toBeInTheDocument();
  });

  it('says where most readers leave from three sessions', () => {
    render(<ProposalSectionEngagement rows={rows} sessions={3} />);
    expect(screen.getByText('Most readers leave around Packages.')).toBeInTheDocument();
  });
});
