/**
 * Tests for the public booking page skeleton.
 *
 * @module tests/unit/app/book/booking-skeleton
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { BookingPageSkeleton } from '@/app/book/[token]/booking-skeleton';

describe('BookingPageSkeleton', () => {
  it('announces what is loading in words', () => {
    render(<BookingPageSkeleton />);

    expect(
      screen.getByRole('status', { name: 'Loading booking page' })
    ).toBeInTheDocument();
  });

  it('draws a full six-week month grid so the calendar does not resize', () => {
    render(<BookingPageSkeleton />);

    // 42 day cells, plus the surrounding placeholders. Checking the grid
    // specifically: a short grid would grow when the real month arrived.
    const { container } = render(<BookingPageSkeleton />);
    const monthGrid = container.querySelector('.grid-cols-7');

    expect(monthGrid).not.toBeNull();
    expect(monthGrid!.children).toHaveLength(42);
  });

  it('tints every placeholder from the page colour, not a fixed grey', () => {
    // The surface is branded, so a hardcoded grey would clash with a dark
    // palette. Every placeholder must inherit.
    render(<BookingPageSkeleton />);

    for (const placeholder of screen.getAllByTestId('skeleton')) {
      expect(placeholder.className).toContain('bg-current');
      expect(placeholder.className).not.toContain('bg-surface-emphasis');
    }
  });

  it('hides its placeholders from assistive technology', () => {
    render(<BookingPageSkeleton />);

    for (const placeholder of screen.getAllByTestId('skeleton')) {
      expect(placeholder).toHaveAttribute('aria-hidden', 'true');
    }
  });
});
