/**
 * The Textarea primitive.
 *
 * It exists so prose fields stop being hand-rolled `<textarea>`
 * elements with a copied class string; these lock in the parts that
 * drifted when they were: label linkage, the error path, and the
 * resize axis.
 */
import { render, screen } from '@testing-library/react';

import { Textarea } from '@/components/ui/textarea';

describe('<Textarea />', () => {
  it('links its label to the field', () => {
    render(<Textarea label="Note" />);
    expect(screen.getByLabelText('Note')).toBeInTheDocument();
  });

  it('defaults to four rows and takes an override', () => {
    const { rerender } = render(<Textarea label="Note" />);
    expect(screen.getByLabelText('Note')).toHaveAttribute('rows', '4');
    rerender(<Textarea label="Note" rows={8} />);
    expect(screen.getByLabelText('Note')).toHaveAttribute('rows', '8');
  });

  it('renders help text, described by the field', () => {
    render(<Textarea label="Note" help="Only you see this." />);
    const field = screen.getByLabelText('Note');
    expect(field.getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText('Only you see this.')).toBeInTheDocument();
  });

  it('replaces help with the error, and marks the field invalid', () => {
    render(<Textarea label="Note" help="Only you see this." error="A note is required." />);
    const field = screen.getByLabelText('Note');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('A note is required.');
    expect(screen.queryByText('Only you see this.')).not.toBeInTheDocument();
  });

  it('resizes vertically only', () => {
    // Horizontal resize drags the field out of whatever column it is
    // in, which is never what an MC meant to do.
    render(<Textarea label="Note" />);
    expect(screen.getByLabelText('Note').className).toContain('resize-y');
  });

  it('drops the resize handle when the layout is fixed', () => {
    render(<Textarea label="Note" resizable={false} />);
    const field = screen.getByLabelText('Note');
    expect(field.className).toContain('resize-none');
    expect(field.className).not.toContain('resize-y');
  });
});
