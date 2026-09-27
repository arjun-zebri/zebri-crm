/**
 * Unit tests for the shared StatePill.
 */
import { render, screen } from '@testing-library/react';
import { AlertTriangle } from 'lucide-react';
import { describe, expect, it } from 'vitest';


import { StatePill } from '@/components/ui/state-pill';

describe('StatePill', () => {
  it('renders the label', () => {
    render(<StatePill label="Active" tone="success" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it.each(['neutral', 'info', 'success', 'warning', 'danger'] as const)(
    'applies the right tone classes for %s',
    (tone) => {
      const { container } = render(<StatePill label="x" tone={tone} />);
      const pill = container.firstElementChild as HTMLElement;
      // tone "neutral" → surface-muted background; others → tonal /10.
      const cls = pill.className;
      if (tone === 'neutral') {
        expect(cls).toContain('bg-surface-muted');
        expect(cls).toContain('text-text-muted');
      } else {
        expect(cls).toContain(`bg-${tone}/10`);
        expect(cls).toContain(`text-${tone}`);
      }
    },
  );

  it('renders a filled dot when dot="filled"', () => {
    const { container } = render(<StatePill label="x" tone="success" dot="filled" />);
    // Filled dot has bg-success and no border.
    const dot = container.querySelector('span[aria-hidden]') as HTMLElement | null;
    expect(dot).toBeTruthy();
    expect(dot?.className).toContain('bg-success');
    expect(dot?.className).not.toContain('border');
  });

  it('renders a hollow dot when dot="hollow"', () => {
    const { container } = render(<StatePill label="x" tone="warning" dot="hollow" />);
    const dot = container.querySelector('span[aria-hidden]') as HTMLElement | null;
    expect(dot).toBeTruthy();
    expect(dot?.className).toContain('border');
    expect(dot?.className).toContain('border-warning');
  });

  it('renders no dot by default', () => {
    const { container } = render(<StatePill label="x" tone="neutral" />);
    expect(container.querySelector('span[aria-hidden]')).toBeNull();
  });

  it('forwards extra className', () => {
    const { container } = render(
      <StatePill label="x" tone="success" className="ml-4" />,
    );
    expect((container.firstElementChild as HTMLElement).className).toContain('ml-4');
  });

  it('renders a leading icon at the icon stroke, hidden from readers', () => {
    const { container } = render(<StatePill label="Subject is required." tone="warning" icon={AlertTriangle} />);
    const svg = container.querySelector('svg') as SVGElement | null;
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('stroke-width')).toBe('1.5');
    expect(screen.getByText('Subject is required.')).toBeInTheDocument();
  });

  it('lets a sentence-length label wrap when asked, instead of overflowing', () => {
    const { container, rerender } = render(<StatePill label="x" />);
    expect((container.firstElementChild as HTMLElement).className).not.toContain('max-w-full');
    rerender(<StatePill label="A longer sentence that tells the MC what to fix" wrap />);
    const pill = container.firstElementChild as HTMLElement;
    expect(pill.className).toContain('max-w-full');
    expect(pill.className).toContain('items-start');
    // Two lines under a pill radius push the first and last glyphs out of
    // the tint (Task 34 re-review Minor 1): a wrapped pill is a control.
    expect(pill.className).toContain('rounded-control');
    expect(pill.className).not.toContain('rounded-pill');
  });
});

