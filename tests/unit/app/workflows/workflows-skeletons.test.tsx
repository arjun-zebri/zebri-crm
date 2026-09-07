import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  TemplatesSkeleton,
  UpcomingSkeleton,
} from '@/app/(dashboard)/workflows/workflows-skeletons';

describe('UpcomingSkeleton', () => {
  it('announces the wait once, in words', () => {
    render(<UpcomingSkeleton />);
    // The shapes themselves are aria-hidden, so a screen reader hears
    // "Loading your day" instead of a list of empty boxes.
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(region).toHaveAccessibleName('Loading your day');
  });

  it('draws the rail and the row, not a spinner', () => {
    const { container } = render(<UpcomingSkeleton />);
    expect(container.querySelectorAll('[data-testid="skeleton"]').length).toBeGreaterThan(0);
  });
});

describe('TemplatesSkeleton', () => {
  it('announces the wait once, in words', () => {
    render(<TemplatesSkeleton />);
    expect(screen.getByRole('status')).toHaveAccessibleName('Loading workflows');
  });

  it('lays the placeholders out on the grid the real cards use', () => {
    const { container } = render(<TemplatesSkeleton />);
    // Same grid classes as the live library, so the cards do not jump
    // sideways when the data lands.
    expect(screen.getByRole('status').className).toContain('sm:grid-cols-2');
    expect(container.querySelectorAll('[data-testid="skeleton"]').length).toBeGreaterThan(0);
  });
});
