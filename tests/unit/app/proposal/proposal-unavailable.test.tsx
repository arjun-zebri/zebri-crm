import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProposalUnavailable } from '@/app/proposal/[token]/_components/proposal-unavailable';
import { buildPublicBranding } from '@/lib/branding/public-branding';

const branding = buildPublicBranding({ surface_color: '#123456' });

describe('ProposalUnavailable', () => {
  it('renders no contact line when contact is omitted', () => {
    render(<ProposalUnavailable kind="expired" businessName="Anna's MC" branding={branding} />);
    expect(screen.queryByText(/Questions\?/)).toBeNull();
  });

  it('renders only the phone when that is the only contact detail available', () => {
    render(
      <ProposalUnavailable kind="expired" businessName="Anna's MC" contact={{ phone: '0400 000 000', email: null }} branding={branding} />,
    );
    expect(screen.getByText('Questions? Call 0400 000 000.')).toBeInTheDocument();
  });

  it('renders phone and email together when both are available', () => {
    render(
      <ProposalUnavailable
        kind="declined"
        businessName="Anna's MC"
        contact={{ phone: '0400 000 000', email: 'anna@example.com' }}
        branding={branding}
      />,
    );
    expect(screen.getByText('Questions? Call 0400 000 000 or email anna@example.com.')).toBeInTheDocument();
  });

  it('renders nothing when contact has neither phone nor email', () => {
    render(<ProposalUnavailable kind="expired" businessName="Anna's MC" contact={{ phone: null, email: null }} branding={branding} />);
    expect(screen.queryByText(/Questions\?/)).toBeNull();
  });

  it('styles the card surface from branding, not an app design token', () => {
    const { container } = render(<ProposalUnavailable kind="expired" businessName="Anna's MC" branding={branding} />);
    const card = container.firstChild as HTMLElement;
    expect(card.getAttribute('style')).toContain('background: rgb(18, 52, 86)'); // #123456
    expect(card.className).not.toMatch(/\bbg-surface\b/);
  });
});
