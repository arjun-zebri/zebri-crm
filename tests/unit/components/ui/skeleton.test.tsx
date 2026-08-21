/**
 * Skeleton primitive tests.
 *
 * @module tests/unit/components/ui/skeleton
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Skeleton, SkeletonText, SkeletonRegion } from '@/components/ui/skeleton';

describe('Skeleton', () => {
  it('pulses and uses the emphasis surface token', () => {
    const { container } = render(<Skeleton className="h-4 w-48" />);
    const el = container.firstElementChild!;

    expect(el.className).toContain('animate-pulse');
    expect(el.className).toContain('bg-surface-emphasis');
  });

  it('passes caller sizing through, since a skeleton has no size of its own', () => {
    const { container } = render(<Skeleton className="h-4 w-48" />);

    expect(container.firstElementChild!.className).toContain('h-4');
    expect(container.firstElementChild!.className).toContain('w-48');
  });

  it('uses the control radius by default and the pill radius on request', () => {
    const { container, rerender } = render(<Skeleton />);
    expect(container.firstElementChild!.className).toContain('rounded-control');

    rerender(<Skeleton shape="pill" />);
    expect(container.firstElementChild!.className).toContain('rounded-pill');
  });

  it('hides itself from assistive technology', () => {
    // A screen reader gains nothing from a list of empty shapes; the region
    // wrapper announces the wait in words instead.
    const { container } = render(<Skeleton />);

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('SkeletonText', () => {
  it('draws three lines by default', () => {
    render(<SkeletonText />);

    expect(screen.getAllByTestId('skeleton')).toHaveLength(3);
  });

  it('draws the requested number of lines', () => {
    render(<SkeletonText lines={5} />);

    expect(screen.getAllByTestId('skeleton')).toHaveLength(5);
  });

  it('shortens the last line so it reads as prose rather than a table', () => {
    render(<SkeletonText lines={3} />);
    const lines = screen.getAllByTestId('skeleton');

    expect(lines[0]!.className).toContain('w-full');
    expect(lines[1]!.className).toContain('w-full');
    expect(lines[2]!.className).toContain('w-2/3');
  });

  it('handles a single line by shortening it', () => {
    render(<SkeletonText lines={1} />);
    const lines = screen.getAllByTestId('skeleton');

    expect(lines).toHaveLength(1);
    expect(lines[0]!.className).toContain('w-2/3');
  });
});

describe('SkeletonRegion', () => {
  it('announces what is loading, once, in words', () => {
    render(
      <SkeletonRegion label="Loading bookings">
        <Skeleton />
        <Skeleton />
      </SkeletonRegion>
    );

    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-label', 'Loading bookings');
    expect(region).toHaveAttribute('aria-busy', 'true');
  });
});

describe('Skeleton tone', () => {
  it('uses the app surface token by default', () => {
    const { container } = render(<Skeleton />);

    expect(container.firstElementChild!.className).toContain('bg-surface-emphasis');
  });

  it('tints from the current text colour when told to inherit', () => {
    // The public booking page carries the MC's own palette, where a fixed grey
    // either vanishes into a dark background or fights a light one.
    const { container } = render(<Skeleton tone="inherit" />);

    expect(container.firstElementChild!.className).toContain('bg-current');
    expect(container.firstElementChild!.className).not.toContain('bg-surface-emphasis');
  });

  it('passes the tone down to every line of SkeletonText', () => {
    render(<SkeletonText tone="inherit" lines={3} />);

    for (const line of screen.getAllByTestId('skeleton')) {
      expect(line.className).toContain('bg-current');
    }
  });
});
