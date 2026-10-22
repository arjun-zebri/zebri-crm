import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, vi } from 'vitest';

import { Badge } from '@/components/ui-v2/badge';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogBody, DialogFooter, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { EmptyState } from '@/components/ui-v2/empty-state';
import { GroupLabel } from '@/components/ui-v2/group-label';
import { IconCircle } from '@/components/ui-v2/icon-circle';
import { ProgressBar } from '@/components/ui-v2/progress-bar';
import { Timeline } from '@/components/ui-v2/timeline';

/** A stand-in icon that records the props it was given. */
function Glyph({ className, strokeWidth }: { className?: string; strokeWidth?: number }) {
  return <svg data-testid="glyph" className={className} data-stroke={strokeWidth} />;
}

describe('<IconCircle /> (v2)', () => {
  it('holds a 16px glyph in a 32px neutral circle, hidden from assistive tech', () => {
    const { container } = render(<IconCircle icon={Glyph} />);
    const circle = container.firstElementChild!;
    expect(circle).toHaveAttribute('aria-hidden', 'true');
    expect(circle).toHaveClass('size-8', 'rounded-pill', 'bg-zebra-100', 'text-zebra-500');
    expect(screen.getByTestId('glyph')).toHaveClass('size-4');
    // Zebri icons carry their own weight, so the circle passes no stroke.
    expect(screen.getByTestId('glyph')).not.toHaveAttribute('data-stroke');
  });

  it('takes a meaningful tone only when asked', () => {
    const { container, rerender } = render(<IconCircle icon={Glyph} tone="grass" />);
    expect(container.firstElementChild).toHaveClass('bg-grass-100', 'text-grass-800');
    rerender(<IconCircle icon={Glyph} tone="warning" />);
    expect(container.firstElementChild).toHaveClass('bg-warning/15', 'text-warning-ink');
  });

  it('is 48px with a 20px glyph at size lg', () => {
    const { container } = render(<IconCircle size="lg" icon={Glyph} />);
    expect(container.firstElementChild).toHaveClass('size-12');
    expect(screen.getByTestId('glyph')).toHaveClass('size-5');
  });
});

describe('<GroupLabel /> (v2)', () => {
  it('is the quiet group-label style on the element asked for', () => {
    render(<GroupLabel as="h3">Today</GroupLabel>);
    const label = screen.getByRole('heading', { level: 3, name: 'Today' });
    expect(label).toHaveClass('type-body', 'text-zebra-400');
  });

  it('is a paragraph by default', () => {
    render(<GroupLabel>Arrange</GroupLabel>);
    expect(screen.getByText('Arrange').tagName).toBe('P');
  });
});

describe('<EmptyState /> (v2)', () => {
  it('shows the title, the line and an optional glyph and action', () => {
    render(<EmptyState icon={Glyph} title="No clients yet" body="Couples you add show here." action={<button type="button">New client</button>} />);
    expect(screen.getByText('No clients yet')).toHaveClass('type-subheading');
    expect(screen.getByText('Couples you add show here.')).toHaveClass('type-body', 'text-zebra-500');
    expect(screen.getByTestId('glyph')).toHaveClass('size-5');
    expect(screen.getByRole('button', { name: 'New client' })).toBeInTheDocument();
  });

  it('has no glyph or action unless given', () => {
    render(<EmptyState title="Nothing here" body="Yet." />);
    expect(screen.queryByTestId('glyph')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('<Badge dot /> (v2)', () => {
  it('leads with a decorative dot in its tone', () => {
    render(
      <Badge dot tone="warning">
        Waiting
      </Badge>,
    );
    const dot = screen.getByText('Waiting').querySelector('span[aria-hidden="true"]');
    expect(dot).toHaveClass('size-1.5', 'rounded-pill', 'bg-warning');
  });

  it('has no dot unless asked', () => {
    render(<Badge>Soon</Badge>);
    expect(screen.getByText('Soon').querySelector('span')).toBeNull();
  });
});

describe('dialog parts (v2)', () => {
  beforeAll(() => {
    // jsdom lacks the native dialog methods and matchMedia.
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.open = false;
    };
  });

  it("titles the dialog quietly and closes it from the header's Close, with no bars", async () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} aria-labelledby="t">
        <DialogHeader id="t" icon={Glyph} title="Send invoice" aside="Step 1 of 2" />
        <DialogBody>Body</DialogBody>
        <DialogFooter>
          <button type="button">Send</button>
        </DialogFooter>
      </Dialog>,
    );
    const title = screen.getByRole('heading', { name: 'Send invoice', hidden: true });
    expect(title).toHaveClass('type-label', 'text-zebra-500');
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    expect(title.closest('header')!.className).not.toMatch(/border/);
    expect(screen.getByText('Send').closest('footer')!.className).not.toMatch(/border/);
    await userEvent.click(screen.getByRole('button', { name: 'Close', hidden: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the old `note` prop working, and drops Close when not closable', () => {
    render(
      <Dialog open onClose={() => {}} aria-labelledby="t2">
        <DialogHeader id="t2" title="Lodge" note="To the registry" closable={false} />
      </Dialog>,
    );
    expect(screen.getByText('To the registry')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close', hidden: true })).toBeNull();
  });

  it('pads a large dialog more from sm up', () => {
    render(
      <Dialog open size="lg" onClose={() => {}} aria-labelledby="t3">
        <DialogBody>Roomy</DialogBody>
      </Dialog>,
    );
    expect(screen.getByText('Roomy')).toHaveClass('p-6', 'sm:p-10');
  });
});

describe('ProgressBar', () => {
  it('reports its count as a labelled progressbar', () => {
    render(<ProgressBar label="Isla: answers in" value={6} max={20} />);
    const bar = screen.getByRole('progressbar', { name: 'Isla: answers in' });
    expect(bar).toHaveAttribute('aria-valuenow', '6');
    expect(bar).toHaveAttribute('aria-valuemax', '20');
  });

  it('clamps the fill to the track, and copes with nothing to count', () => {
    const { container, rerender } = render(<ProgressBar label="x" value={30} max={20} />);
    const fill = () => container.querySelector('[role="progressbar"] > div') as HTMLElement;
    expect(fill().style.getPropertyValue('--progress')).toBe('100%');
    rerender(<ProgressBar label="x" value={0} max={0} />);
    expect(fill().style.getPropertyValue('--progress')).toBe('0%');
  });
});

describe('ProgressBar edge', () => {
  it('lies along its parent\'s bottom edge, square', () => {
    render(<ProgressBar edge label="Part 3 of 9" value={3} max={9} />);
    const bar = screen.getByRole('progressbar', { name: 'Part 3 of 9' });
    expect(bar).toHaveClass('absolute', '-bottom-px', 'h-0.5');
    expect(bar.firstElementChild).not.toHaveClass('rounded-pill');
  });
});

describe('Timeline', () => {
  const steps = [
    { label: 'Sent to the couple', when: '28 Sep', state: 'done' as const },
    { label: 'Answers back', state: 'now' as const },
    { label: 'Wedding', when: 'Sat 31 Oct', state: 'later' as const },
  ];

  it('lists its steps in order, marking the current one', () => {
    render(<Timeline label="History" steps={steps} />);
    const items = within(screen.getByRole('list', { name: 'History' })).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[0]).toHaveTextContent('Sent to the couple (done)28 Sep');
  });

  it('greys what is still to come', () => {
    render(<Timeline label="History" steps={steps} />);
    expect(screen.getByText('Wedding')).toHaveClass('text-zebra-500');
    expect(screen.getByText('Answers back')).toHaveClass('text-zebra-950');
  });
});
