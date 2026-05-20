import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { Input } from '@/components/ui/input';

describe('<Input />', () => {
  it('associates the label with the input via htmlFor/id', () => {
    render(<Input label="Couple name" />);
    const input = screen.getByLabelText('Couple name');
    expect(input.tagName).toBe('INPUT');
  });

  it('renders help text and links it via aria-describedby', () => {
    render(<Input label="Email" help="We'll send the quote here." />);
    const input = screen.getByLabelText('Email');
    const help = screen.getByText("We'll send the quote here.");
    expect(input.getAttribute('aria-describedby')).toContain(help.id);
  });

  it('renders an error in place of help, marks aria-invalid, and exposes role=alert', () => {
    render(
      <Input
        label="Email"
        help="optional"
        error="Required"
      />,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
    expect(screen.queryByText('optional')).toBeNull();
  });

  it('updates on user typing', async () => {
    const onChange = vi.fn();
    render(<Input label="Name" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Name'), 'Sarah');
    expect(onChange).toHaveBeenCalled();
  });
});
