/**
 * The Upcoming row.
 *
 * A held send used to render as a row whose only click target was its
 * (empty) title button, so it could not be opened and there was no way
 * to authorise it at all. The row now opens as a whole and says when it
 * is waiting on a person, which is what these cover.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { QueueBucket } from '@/app/(dashboard)/workflows/queue-buckets';
import { UpcomingList } from '@/app/(dashboard)/workflows/upcoming-list';
import type { QueueItem } from '@/lib/workflows/queue';

const TZ = 'Australia/Sydney';

function item(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    stepId: 'step-1',
    instanceId: 'inst-1',
    instanceName: 'Booking flow',
    coupleId: 'couple-1',
    coupleName: 'Sam & Priya',
    weddingDate: '2026-11-14',
    title: 'Send email · Welcome!',
    type: 'action',
    status: 'pending',
    dueAt: '2026-09-06T02:00:00Z',
    requiresApproval: false,
    ...overrides,
  };
}

function bucket(items: QueueItem[]): QueueBucket {
  return { key: 'today', label: 'Today', urgent: false, items };
}

function renderList(items: QueueItem[], handlers: Record<string, unknown> = {}) {
  const props = {
    onTick: vi.fn(),
    onOpen: vi.fn(),
    onSnooze: vi.fn(),
    onSkip: vi.fn(),
    onOpenCouple: vi.fn(),
    ...handlers,
  } as {
    onTick: ReturnType<typeof vi.fn>;
    onOpen: ReturnType<typeof vi.fn>;
    onSnooze: ReturnType<typeof vi.fn>;
    onSkip: ReturnType<typeof vi.fn>;
    onOpenCouple: ReturnType<typeof vi.fn>;
  };
  render(<UpcomingList buckets={[bucket(items)]} timezone={TZ} groupBy="date" {...props} />);
  return props;
}

describe('UpcomingList', () => {
  it('opens the step from anywhere on the row', () => {
    const { onOpen } = renderList([item()]);
    fireEvent.click(screen.getByRole('listitem'));
    expect(onOpen).toHaveBeenCalledWith('step-1');
  });

  it('says whose move it is on a send that is waiting for the MC', () => {
    // The ⚡ says "Zebri runs this", which is the opposite of what a
    // held send needs the MC to know.
    renderList([item({ requiresApproval: true })]);
    expect(screen.getByText('Needs your OK')).toBeInTheDocument();
  });

  it('says nothing of the sort on a send that goes by itself', () => {
    renderList([item()]);
    expect(screen.queryByText('Needs your OK')).toBeNull();
  });

  it('ticks without opening the step', () => {
    const { onTick, onOpen } = renderList([
      item({ type: 'todo', title: 'Ring the venue' }),
    ]);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mark "Ring the venue" done' }));
    expect(onTick).toHaveBeenCalledWith('step-1');
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('keeps the row menu visible rather than waiting for a hover', () => {
    // A control that only appears under the pointer is a control an MC
    // has to already know about.
    renderList([item()]);
    expect(screen.getByRole('button', { name: 'Row actions' })).not.toHaveClass('opacity-0');
  });

  it('snoozes and skips from the row menu', () => {
    const { onSnooze, onSkip } = renderList([item()]);
    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));
    fireEvent.click(screen.getByText('Next week'));
    expect(onSnooze).toHaveBeenCalledWith('step-1', 7);

    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));
    fireEvent.click(screen.getByText('Skip this step'));
    expect(onSkip).toHaveBeenCalledWith('step-1');
  });
});
