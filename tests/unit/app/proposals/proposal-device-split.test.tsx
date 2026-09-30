import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProposalDeviceSplit } from '@/app/(dashboard)/proposals/[id]/proposal-device-split';

describe('ProposalDeviceSplit', () => {
  it('lists non-zero buckets in a fixed order', () => {
    render(<ProposalDeviceSplit split={{ phone: 3, tablet: 0, desktop: 1, unknown: 0 }} />);
    expect(screen.getByText('4 sessions: 3 phone, 1 desktop')).toBeInTheDocument();
  });

  it('shows unknown only when non-zero, and singular for one session', () => {
    render(<ProposalDeviceSplit split={{ phone: 0, tablet: 0, desktop: 0, unknown: 1 }} />);
    expect(screen.getByText('1 session: 1 unknown')).toBeInTheDocument();
  });

  it('renders nothing when there are no sessions', () => {
    const { container } = render(<ProposalDeviceSplit split={{ phone: 0, tablet: 0, desktop: 0, unknown: 0 }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
