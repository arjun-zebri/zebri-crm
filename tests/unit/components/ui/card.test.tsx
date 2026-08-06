import { render, screen } from '@testing-library/react';

import { Card } from '@/components/ui/card';

describe('<Card />', () => {
  it('applies the radius, border and surface tokens by default', () => {
    render(<Card>body</Card>);

    const card = screen.getByText('body');
    // One corner radius app-wide: cards share it with buttons and inputs.
    expect(card).toHaveClass('rounded-control');
    expect(card).toHaveClass('border', 'border-border');
    expect(card).toHaveClass('bg-card');
  });

  it('defaults to medium padding', () => {
    render(<Card>body</Card>);

    expect(screen.getByText('body')).toHaveClass('p-6');
  });

  it.each([
    ['none', null],
    ['sm', 'p-4'],
    ['md', 'p-6'],
    ['lg', 'p-8'],
  ] as const)('maps padding=%s to %s', (padding, expected) => {
    render(<Card padding={padding}>body</Card>);

    const card = screen.getByText('body');
    if (expected) expect(card).toHaveClass(expected);
    else expect(card.className).not.toMatch(/\bp-\d/);
  });

  it('switches to the muted surface', () => {
    render(<Card surface="muted">body</Card>);

    expect(screen.getByText('body')).toHaveClass('bg-surface-muted');
  });

  it('drops the border when borderless, keeping radius and padding', () => {
    render(<Card borderless>body</Card>);

    const card = screen.getByText('body');
    expect(card).not.toHaveClass('border');
    expect(card).toHaveClass('rounded-control', 'p-6');
  });

  it('appends caller classes after its own so layout can be overridden', () => {
    render(<Card className="flex flex-col max-h-80">body</Card>);

    const card = screen.getByText('body');
    expect(card).toHaveClass('flex', 'flex-col', 'max-h-80');
    expect(card).toHaveClass('rounded-control');
  });

  it('renders a different element when asked', () => {
    render(<Card as="section">body</Card>);

    expect(screen.getByText('body').tagName).toBe('SECTION');
  });
});
