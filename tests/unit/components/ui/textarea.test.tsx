import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { Textarea } from '@/components/ui/textarea';

describe('<Textarea />', () => {
  it('associates the label with the textarea via htmlFor/id', () => {
    render(<Textarea label="Message" />);
    const area = screen.getByLabelText('Message');
    expect(area.tagName).toBe('TEXTAREA');
  });

  it('renders help text and links it via aria-describedby', () => {
    render(<Textarea label="Message" help="Tell us about your day." />);
    const area = screen.getByLabelText('Message');
    const help = screen.getByText('Tell us about your day.');
    expect(area.getAttribute('aria-describedby')).toContain(help.id);
  });

  it('renders an error in place of help, marks aria-invalid, and exposes role=alert', () => {
    render(<Textarea label="Message" help="optional" error="Required" />);
    const area = screen.getByLabelText('Message');
    expect(area).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
    expect(screen.queryByText('optional')).toBeNull();
  });

  it('updates on user typing', async () => {
    const onChange = vi.fn();
    render(<Textarea label="Message" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Message'), 'Hello');
    expect(onChange).toHaveBeenCalled();
  });

  it('is not user-resizable', () => {
    render(<Textarea label="Message" />);
    expect(screen.getByLabelText('Message').className).toContain('resize-none');
  });
});
