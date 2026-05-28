import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Heart } from 'lucide-react';
import { vi } from 'vitest';

import { Empty } from '@/components/ui/empty';

describe('<Empty />', () => {
  it('renders title and description', () => {
    render(<Empty title="No couples" description="Add your first couple to start." />);
    expect(screen.getByText('No couples')).toBeInTheDocument();
    expect(screen.getByText('Add your first couple to start.')).toBeInTheDocument();
  });

  it('renders an action and invokes it on click', async () => {
    const onClick = vi.fn();
    render(
      <Empty
        icon={Heart}
        title="No couples"
        action={<button onClick={onClick}>New couple</button>}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'New couple' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('omits the icon wrapper when no icon is supplied', () => {
    const { container } = render(<Empty title="Empty" />);
    expect(container.querySelector('svg')).toBeNull();
  });
});
