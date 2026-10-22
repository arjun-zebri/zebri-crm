import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { married } from '@/app/design-system/v2/pages/dashboard/bdm/bdm-data';
import {
  markChecked,
  setWeddingDate,
  simulateMeeting,
  simulateReturn,
  simulateWedding,
  startPaperwork,
  usePaperwork,
} from '@/app/design-system/v2/pages/dashboard/bdm/bdm-store';
import { stepLabels } from '@/app/design-system/v2/pages/dashboard/bdm/status';

/**
 * A couple booked without a wedding date: the paperwork asks for it at
 * the Lodge step, since lodging opens only once the day has been, and the
 * demo's Simulate the wedding gets it there at once.
 */

const start = (client: string) => {
  startPaperwork(client, ['Mia Rossi', 'Leo Park'], 'Date to come', 'Venue to come');
  simulateReturn(client);
  markChecked(client);
  return renderHook(() => usePaperwork(client));
};

describe('a wedding with no date', () => {
  it('waits for "the wedding", not "Date to come"', () => {
    const { result } = start('No date');
    expect(stepLabels(result.current!)[2]).toBe('Lodge · after the wedding');
    expect(married(result.current!)).toBe(false);
  });

  it('takes a date as the demo writes one', () => {
    const { result } = start('Given a date');
    act(() => setWeddingDate('Given a date', '2027-03-06'));
    expect(result.current!.date).toBe('Sat 6 Mar 2027');
    expect(stepLabels(result.current!)[2]).toBe('Lodge · after Sat 6 Mar');
  });

  it('is married, with the certificate signed, once the wedding is simulated', () => {
    const { result } = start('Simulated');
    act(() => simulateWedding('Simulated'));
    expect(married(result.current!)).toBe(true);
    expect(result.current!.checks['witness2Signed']).toBe('Yes');
    expect(result.current!.checks['certNumber']).toBe('1452639');
  });
});

describe('Simulate the wedding and the notice', () => {
  it('moves the received date to a month before the day, so the notice is not late', async () => {
    const { issuesOf } = await import('@/app/design-system/v2/pages/dashboard/bdm/rules');
    const { result } = start('Not late');
    act(() => simulateWedding('Not late'));
    expect(issuesOf(result.current!).filter((i) => i.key.includes('received'))).toEqual([]);
  });
});

describe('the whole demo path, one press a step', () => {
  it('leaves nothing to tick and nothing BDM would turn away', async () => {
    const { issuesOf } = await import('@/app/design-system/v2/pages/dashboard/bdm/rules');
    const { checksLeft, solemnisationLeft } = await import('@/app/design-system/v2/pages/dashboard/bdm/status');
    startPaperwork('Whole path', ['Mia Rossi', 'Leo Park'], 'Date to come', 'Venue to come');
    const { result } = renderHook(() => usePaperwork('Whole path'));
    act(() => simulateReturn('Whole path'));
    act(() => simulateMeeting('Whole path'));
    expect(checksLeft(result.current!)).toBe(0);
    act(() => markChecked('Whole path'));
    act(() => simulateWedding('Whole path'));
    expect(solemnisationLeft(result.current!)).toBe(0);
    expect(issuesOf(result.current!)).toEqual([]);
  });
});
