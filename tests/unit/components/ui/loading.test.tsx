import { render, screen } from '@testing-library/react';

import { Loading } from '@/components/ui/loading';

describe('<Loading />', () => {
  it('exposes role="status" for assistive tech', () => {
    render(<Loading />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the label and uses it as the aria-label', () => {
    render(<Loading label="Loading couples" />);
    expect(screen.getByText('Loading couples')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading couples');
  });

  it('falls back to "Loading" as aria-label when no label', () => {
    render(<Loading />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading');
  });
});
