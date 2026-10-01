import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { Button } from '@/components/ui-v2/button';

describe('<Button /> (v2)', () => {
  it('plain variant has no padding, so it sits flush with the text around it', () => {
    render(<Button variant="plain">Add another</Button>);
    expect(screen.getByRole('button', { name: 'Add another' })).not.toHaveClass('px-4');
  });

  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
  });

  it('fires onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('announces the rolling label once, not twice', () => {
    render(<Button>Save</Button>);
    // getByRole matches the exact accessible name, so "Save Save" would fail here.
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('is disabled and aria-busy while loading, and keeps its accessible name', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('takes the faded disabled colour while loading', () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' }).className).toContain('disabled:opacity-50');
  });

  it('drops the side padding for an icon-only square button', () => {
    render(<Button square aria-label="Close">x</Button>);
    const cls = screen.getByRole('button', { name: 'Close' }).className;
    expect(cls).toContain('w-9');
    expect(cls).not.toContain('px-4');
  });

  it('applies the variant classes', () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('bg-danger');
  });

  it('drops motion under prefers-reduced-motion', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' }).className).toContain(
      'motion-reduce:transition-none',
    );
  });
});
