import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { ErrorState } from '@/components/ui/error-state';

describe('<ErrorState />', () => {
  it('exposes role="alert"', () => {
    render(<ErrorState />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('uses a default title and renders a passed description', () => {
    render(<ErrorState description="Network unreachable" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Network unreachable')).toBeInTheDocument();
  });

  it('falls back to error.message when description is absent', () => {
    render(<ErrorState error={new Error('boom')} />);
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('renders a retry button that calls onRetry', async () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('uses a custom action slot in place of the default retry', () => {
    const onClick = vi.fn();
    render(<ErrorState action={<button onClick={onClick}>Reload</button>} />);
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });
});
