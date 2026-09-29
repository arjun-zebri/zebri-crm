import { describe, expect, it, vi } from 'vitest';

import { gatePillLabel, rowActions } from '@/app/(dashboard)/workflows/upcoming-row-parts';
import type { QueueItem } from '@/lib/workflows/queue';

function item(over: Partial<QueueItem> = {}): QueueItem {
  return {
    stepId: 's1',
    instanceId: 'i1',
    instanceName: 'Flow',
    coupleId: 'c1',
    coupleName: 'Sam & Priya',
    weddingDate: null,
    title: 'Send email',
    type: 'action',
    status: 'pending',
    dueAt: '2026-09-27T03:06:00.000Z',
    ...over,
  };
}

const on = { onSnooze: vi.fn(), onSkip: vi.fn(), onOpenCouple: vi.fn() };

describe('rowActions', () => {
  it('offers snooze on a released send', () => {
    const labels = rowActions(item(), on).map((a) => a.label);
    expect(labels).toEqual(['Tomorrow', 'Next week', 'Skip this step', 'Open the couple']);
  });

  it('offers no snooze on a send still behind an earlier step', () => {
    // A date on it is one the engine runs on sight: the email would go
    // before the Wait or to-do above it.
    const labels = rowActions(
      item({ blocked: true, dueAt: null, gate: 'After you finish Call' }),
      on,
    ).map((a) => a.label);
    expect(labels).toEqual(['Skip this step', 'Open the couple']);
  });

  it('snoozes the row it belongs to', () => {
    rowActions(item(), on)[1]?.onSelect();
    expect(on.onSnooze).toHaveBeenCalledWith('s1', 7);
  });
});

describe('gatePillLabel', () => {
  it('reads any wait on an earlier step as one short pill', () => {
    expect(gatePillLabel('After you OK “5 Months to GO!”')).toBe('After previous step');
    expect(gatePillLabel('After you finish “Call the venue”')).toBe('After previous step');
    expect(gatePillLabel('Depends on “Paid deposit?”')).toBe('After previous step');
  });

  it('keeps a reason that is about the step itself', () => {
    expect(gatePillLabel('No date set')).toBe('No date set');
    expect(gatePillLabel('Needs a wedding date')).toBe('Needs a wedding date');
  });
});
