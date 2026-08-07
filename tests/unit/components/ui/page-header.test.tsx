import { render, screen } from '@testing-library/react';

import { PageHeader } from '@/components/ui/page-header';

describe('<PageHeader />', () => {
  it('renders the title as the page heading', () => {
    render(<PageHeader title="Couples" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Couples' })).toBeInTheDocument();
  });

  it('renders a count as "N total"', () => {
    render(<PageHeader title="Couples" count={42} />);

    expect(screen.getByText('42 total')).toBeInTheDocument();
  });

  it('renders a zero count rather than treating it as absent', () => {
    render(<PageHeader title="Couples" count={0} />);

    expect(screen.getByText('0 total')).toBeInTheDocument();
  });

  it('omits the meta slot entirely when no count or meta is given', () => {
    const { container } = render(<PageHeader title="Calendar" />);

    expect(container.querySelectorAll('span')).toHaveLength(0);
  });

  it('prefers a custom meta slot over the count', () => {
    render(<PageHeader title="Payments" count={9} meta={<span>3 overdue</span>} />);

    expect(screen.getByText('3 overdue')).toBeInTheDocument();
    expect(screen.queryByText('9 total')).not.toBeInTheDocument();
  });

  it('renders actions alongside the title', () => {
    render(<PageHeader title="Tasks" actions={<button>New task</button>} />);

    expect(screen.getByRole('button', { name: 'New task' })).toBeInTheDocument();
  });

  it('scales the title down below the sm breakpoint', () => {
    // 30px titles crowd a phone screen, so the header is 2xl until sm.
    render(<PageHeader title="Couples" />);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveClass('text-2xl');
    expect(heading).toHaveClass('sm:text-display');
  });
});
