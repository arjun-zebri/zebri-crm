/**
 * The Upcoming row's Change date modal (ZEB-125).
 *
 * An MC needed a workflow to-do on a particular day and the row menu
 * only offered Tomorrow and Next week. These cover the picker that
 * fills that gap: it opens on the step's own month, picking a day is
 * the save, and it never offers to clear the date, because a step with
 * no date is never run.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ChangeDateModal } from '@/app/(dashboard)/workflows/change-date-modal';
import { onDate } from '@/app/(dashboard)/workflows/queue-labels';
import type { QueueItem } from '@/lib/workflows/queue';

function item(over: Partial<QueueItem> = {}): QueueItem {
  return {
    stepId: 's1',
    instanceId: 'i1',
    instanceName: 'Booking flow',
    coupleId: 'c1',
    coupleName: 'Renee & Robert',
    weddingDate: '2027-05-08',
    title: 'NOIM DONE',
    type: 'todo',
    status: 'pending',
    // Local noon, so the day reads the same in any test timezone.
    dueAt: new Date(2026, 9, 26, 12, 0).toISOString(),
    ...over,
  };
}

describe('ChangeDateModal', () => {
  it('opens on the month the step is due in', () => {
    render(<ChangeDateModal item={item()} onClose={vi.fn()} onPick={vi.fn()} />);
    expect(screen.getByText('October 2026')).toBeInTheDocument();
    expect(screen.getByText('NOIM DONE')).toBeInTheDocument();
  });

  it('moves the step to the picked day and closes', () => {
    // 20 rather than 28-30: those also appear as September's leading days.
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<ChangeDateModal item={item()} onClose={onClose} onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: '20' }));
    expect(onPick).toHaveBeenCalledWith('s1', new Date(2026, 9, 20, 12, 0).toISOString());
    expect(onClose).toHaveBeenCalled();
  });

  it('offers no way to clear the date', () => {
    render(<ChangeDateModal item={item()} onClose={vi.fn()} onPick={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  it('renders nothing while closed', () => {
    render(<ChangeDateModal item={null} onClose={vi.fn()} onPick={vi.fn()} />);
    expect(screen.queryByText('Change date')).toBeNull();
  });
});

describe('onDate', () => {
  it('keeps the time of day: an 8pm send moved is still an 8pm send', () => {
    const at = new Date(onDate(new Date(2027, 0, 27, 20, 0).toISOString(), '2027-02-03'));
    expect([at.getFullYear(), at.getMonth(), at.getDate(), at.getHours()]).toEqual([2027, 1, 3, 20]);
  });

  it('lands an undated step at 9am, the snooze hour', () => {
    const at = new Date(onDate(null, '2026-11-02'));
    expect([at.getMonth(), at.getDate(), at.getHours(), at.getMinutes()]).toEqual([10, 2, 9, 0]);
  });
});
