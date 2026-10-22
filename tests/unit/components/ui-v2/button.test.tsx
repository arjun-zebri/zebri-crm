import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { vi } from 'vitest';

import { Button } from '@/components/ui-v2/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

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

describe('<Button square /> tooltip (v2)', () => {
  it('names an icon-only button with a tooltip from its aria-label, never a native title', () => {
    render(<Button square aria-label="Close">x</Button>);
    const btn = screen.getByRole('button', { name: 'Close' });
    expect(btn).not.toHaveAttribute('title');
    const tip = btn.querySelector('[data-tip]');
    expect(tip).toHaveTextContent('Close');
    // It repeats the name, so assistive tech does not hear it twice.
    expect(tip).toHaveAttribute('aria-hidden', 'true');
  });

  it('takes custom words, or none with tooltip={false}', () => {
    render(
      <>
        <Button square aria-label="Previous month" tooltip="Back a month">‹</Button>
        <Button square aria-label="Next month" tooltip={false}>›</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Previous month' }).querySelector('[data-tip]')).toHaveTextContent('Back a month');
    expect(screen.getByRole('button', { name: 'Next month' }).querySelector('[data-tip]')).toBeNull();
  });

  it('draws no tooltip on a labelled button', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' }).querySelector('[data-tip]')).toBeNull();
  });

  it('still works as a Radix asChild trigger: props and ref reach the <button>', async () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Popover>
        <PopoverTrigger asChild>
          <Button ref={ref} square aria-label="More">⋯</Button>
        </PopoverTrigger>
        <PopoverContent size="menu" aria-label="More">
          <p>Menu body</p>
        </PopoverContent>
      </Popover>,
    );
    const btn = screen.getByRole('button', { name: 'More' });
    expect(ref.current).toBe(btn);
    expect(btn).toHaveAttribute('aria-haspopup', 'dialog');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByText('Menu body')).toBeInTheDocument();
  });

  it('takes the one focus mark, not a ring', () => {
    render(<Button>Save</Button>);
    const cls = screen.getByRole('button', { name: 'Save' }).className;
    expect(cls).toContain('focus-mark');
    expect(cls).not.toMatch(/focus-key:ring|ring-offset/);
  });
});
