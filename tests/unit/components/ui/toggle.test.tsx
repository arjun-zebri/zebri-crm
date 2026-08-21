/**
 * Toggle primitive tests.
 *
 * @module tests/unit/components/ui/toggle
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { Toggle } from '@/components/ui/toggle';

describe('Toggle', () => {
  it('is announced as a switch, not a bare button', () => {
    render(<Toggle checked onChange={vi.fn()} label="Active" />);

    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('reports its state through aria-checked', () => {
    const { rerender } = render(<Toggle checked onChange={vi.fn()} label="Active" />);
    expect(screen.getByRole('switch')).toBeChecked();

    rerender(<Toggle checked={false} onChange={vi.fn()} label="Active" />);
    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  it('flips to the opposite state when clicked', async () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Active" />);

    await userEvent.click(screen.getByRole('switch'));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('flips when the label is clicked, not only the switch', async () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Active" />);

    await userEvent.click(screen.getByText('Active'));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('takes its accessible name from the visible label', () => {
    render(<Toggle checked onChange={vi.fn()} label="Active" />);

    expect(screen.getByRole('switch', { name: 'Active' })).toBeInTheDocument();
  });

  it('falls back to ariaLabel when there is no visible label', () => {
    render(<Toggle checked onChange={vi.fn()} ariaLabel="Enable portal" />);

    expect(screen.getByRole('switch', { name: 'Enable portal' })).toBeInTheDocument();
  });

  it('shows a description beneath the label', () => {
    render(
      <Toggle
        checked
        onChange={vi.fn()}
        label="Active"
        description="Couples can book this."
      />
    );

    expect(screen.getByText('Couples can book this.')).toBeInTheDocument();
  });

  it('does not fire when disabled, from the switch or the label', async () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Active" disabled />);

    await userEvent.click(screen.getByRole('switch'));
    await userEvent.click(screen.getByText('Active'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses semantic tokens rather than raw colours', () => {
    // The four hand-rolled copies this replaced used bg-black, bg-emerald-500
    // and bg-gray-200 between them, none of which follow the theme.
    const { rerender } = render(<Toggle checked onChange={vi.fn()} ariaLabel="t" />);
    expect(screen.getByRole('switch').className).toContain('bg-success');

    rerender(<Toggle checked={false} onChange={vi.fn()} ariaLabel="t" />);
    expect(screen.getByRole('switch').className).toContain('bg-border-strong');
  });

  it('keeps the track the same size in both states', () => {
    // The knob slides on translate-x rather than being laid out inline, so
    // flipping the switch cannot nudge whatever sits beside it.
    const { rerender } = render(<Toggle checked onChange={vi.fn()} ariaLabel="t" />);
    const on = screen.getByRole('switch').className;

    rerender(<Toggle checked={false} onChange={vi.fn()} ariaLabel="t" />);
    const off = screen.getByRole('switch').className;

    for (const size of ['w-9', 'h-5']) {
      expect(on).toContain(size);
      expect(off).toContain(size);
    }
  });
});
