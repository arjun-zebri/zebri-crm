/**
 * Unit tests for the shared Callout.
 */
import { render, screen } from '@testing-library/react';
import { Sparkles } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { Callout } from '@/components/ui/callout';

describe('Callout', () => {
  it('renders its note', () => {
    render(<Callout tone="warning">Nothing anchored after it runs until you do.</Callout>);
    expect(
      screen.getByText('Nothing anchored after it runs until you do.'),
    ).toBeInTheDocument();
  });

  it.each(['info', 'success', 'warning', 'danger'] as const)(
    'tints the box with the %s tone',
    (tone) => {
      const { container } = render(<Callout tone={tone}>x</Callout>);
      const box = container.firstElementChild as HTMLElement;
      expect(box.className).toContain(`bg-${tone}/10`);
      expect(box.className).toContain(`border-${tone}/40`);
    },
  );

  it('defaults to the info tone', () => {
    const { container } = render(<Callout>x</Callout>);
    expect((container.firstElementChild as HTMLElement).className).toContain('bg-info/10');
  });

  it('marks the tone icon decorative', () => {
    // It repeats the tone the box already carries, so a screen reader
    // announcing it would read the note twice over.
    const { container } = render(<Callout tone="danger">x</Callout>);
    expect(container.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
  });

  it('drops the icon when icon is null', () => {
    const { container } = render(
      <Callout tone="warning" icon={null}>
        x
      </Callout>,
    );
    expect(container.querySelector('svg')).toBeNull();
  });

  it('takes an icon of its own', () => {
    const { container } = render(
      <Callout tone="info" icon={Sparkles}>
        x
      </Callout>,
    );
    expect(container.querySelector('.lucide-sparkles')).toBeTruthy();
  });

  it('forwards extra className', () => {
    const { container } = render(<Callout className="mt-4">x</Callout>);
    expect((container.firstElementChild as HTMLElement).className).toContain('mt-4');
  });
});
