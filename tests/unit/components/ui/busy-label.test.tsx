import { render, screen } from '@testing-library/react';

import { BusyLabel } from '@/components/ui/busy-label';

describe('<BusyLabel />', () => {
  it('keeps the label mounted while busy, so the box does not collapse', () => {
    // The whole point: the label holds its width and the spinner is laid
    // over it. Unmounting or hiding the text would resize the control.
    const { rerender } = render(<BusyLabel busy={false}>Save changes</BusyLabel>);
    expect(screen.getByText('Save changes')).toBeInTheDocument();

    rerender(<BusyLabel busy>Save changes</BusyLabel>);
    expect(screen.getByText('Save changes')).toBeInTheDocument();
  });

  it('fades the label with opacity rather than visibility', () => {
    // `invisible` would strip the button's accessible name; `opacity-0`
    // leaves it in the a11y tree.
    render(<BusyLabel busy>Save</BusyLabel>);

    const label = screen.getByText('Save');
    expect(label).toHaveClass('opacity-0');
    expect(label.className).not.toMatch(/\binvisible\b/);
  });

  it('shows no spinner when idle', () => {
    const { container } = render(<BusyLabel busy={false}>Save</BusyLabel>);
    expect(container.querySelector('.animate-spin')).toBeNull();
  });

  it('overlays the spinner absolutely so it takes no layout space', () => {
    const { container } = render(<BusyLabel busy>Save</BusyLabel>);

    const spinner = container.querySelector('.animate-spin');
    expect(spinner).not.toBeNull();
    expect(spinner).toHaveClass('absolute');
    expect(spinner).toHaveAttribute('aria-hidden', 'true');
  });
});
