import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { Button } from '@/components/ui/button';

describe('<Button />', () => {
  it('renders children and defaults to type="button" (no accidental form submit)', () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('invokes onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled and aria-busy while loading, and onClick does not fire', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies the danger variant class', () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('bg-danger');
  });

  it('honours an explicit type override', () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });
});

describe('<Button /> height and icon-only', () => {
  it('has exactly one height, 32px, at the one body size', () => {
    // There is no `size` prop. Every control in the app is h-8, so a
    // button never disagrees with the input or select beside it.
    render(<Button>a</Button>);
    expect(screen.getByRole('button')).toHaveClass('h-8', 'text-body');
  });

  it('does not set a cursor utility (the base layer owns it)', () => {
    // `cursor-pointer` is a globals.css base rule so it covers raw
    // <button> too. If it were a utility here it would fight a caller's
    // deliberate `cursor-not-allowed`.
    render(<Button>a</Button>);
    expect(screen.getByRole('button').className).not.toMatch(/\bcursor-/);
  });

  it('locks width to height and drops side padding when iconOnly', () => {
    render(
      <Button iconOnly aria-label="Close">
        <span aria-hidden>x</span>
      </Button>,
    );

    const btn = screen.getByRole('button', { name: 'Close' });
    expect(btn).toHaveClass('h-8', 'w-8');
    expect(btn.className).not.toMatch(/\bpx-\d/);
  });
});

