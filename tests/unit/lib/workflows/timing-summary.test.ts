import { describe, expect, it } from 'vitest';

import {
  describeTiming,
  isDefaultTiming,
  shortTiming,
  toStepTiming,
} from '@/lib/workflows/timing-summary';
import { DEFAULT_STEP_TIMING } from '@/types/workflows';

describe('toStepTiming', () => {
  it('reads a wedding-relative timing back whole', () => {
    expect(
      toStepTiming({ mode: 'wedding_relative', direction: 'after', amount: 3, unit: 'months' }),
    ).toEqual({ mode: 'wedding_relative', direction: 'after', amount: 3, unit: 'months' });
  });

  it('falls back to the default for anything unrecognised', () => {
    // A step saved by an older build, or by a hand-written migration,
    // must still render rather than crashing the row it appears in.
    expect(toStepTiming(null)).toEqual(DEFAULT_STEP_TIMING);
    expect(toStepTiming('two weeks')).toEqual(DEFAULT_STEP_TIMING);
    expect(toStepTiming({ mode: 'whenever' })).toEqual(DEFAULT_STEP_TIMING);
  });

  it('coerces a bad unit into one its mode allows', () => {
    // `hours` only exists on after_previous. Left through, it would make
    // a calendar shift the timing module cannot compute.
    expect(toStepTiming({ mode: 'apply_relative', amount: 2, unit: 'hours' })).toEqual({
      mode: 'apply_relative',
      amount: 2,
      unit: 'days',
    });
    expect(
      toStepTiming({ mode: 'after_previous', delayAmount: 2, unit: 'months' }),
    ).toEqual({ mode: 'after_previous', delayAmount: 2, unit: 'days' });
  });

  it('never returns a negative amount', () => {
    // Direction carries the sign for wedding-relative; a negative amount
    // as well would flip it back and schedule after instead of before.
    expect(
      toStepTiming({ mode: 'wedding_relative', direction: 'before', amount: -4, unit: 'weeks' }),
    ).toMatchObject({ amount: 4, direction: 'before' });
  });
});

describe('describeTiming', () => {
  it('speaks in wedding-relative time', () => {
    expect(
      describeTiming({ mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'weeks' }),
    ).toBe('2 weeks before the wedding');
  });

  it('singularises', () => {
    expect(
      describeTiming({ mode: 'wedding_relative', direction: 'after', amount: 1, unit: 'days' }),
    ).toBe('1 day after the wedding');
  });

  it('names the wedding day itself rather than saying "0 days"', () => {
    expect(
      describeTiming({ mode: 'wedding_relative', direction: 'before', amount: 0, unit: 'days' }),
    ).toBe('On the wedding day');
  });

  it('describes the two other anchors', () => {
    expect(describeTiming({ mode: 'apply_relative', amount: 3, unit: 'days' })).toBe(
      '3 days after the workflow starts',
    );
    expect(describeTiming({ mode: 'after_previous', delayAmount: 0, unit: 'days' })).toBe(
      'Straight after the step above',
    );
    expect(describeTiming({ mode: 'after_previous', delayAmount: 2, unit: 'hours' })).toBe(
      '2 hours after the step above',
    );
  });
});

describe('shortTiming and isDefaultTiming', () => {
  it('keeps the chip short', () => {
    expect(
      shortTiming({ mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'weeks' }),
    ).toBe('2w before wedding');
  });

  it('treats only a zero-delay chain as the default', () => {
    // The chip is hidden for the default, so a workflow with no
    // deliberate scheduling does not read as if every step were set.
    expect(isDefaultTiming({ mode: 'after_previous', delayAmount: 0, unit: 'days' })).toBe(true);
    expect(isDefaultTiming({ mode: 'after_previous', delayAmount: 1, unit: 'days' })).toBe(false);
    expect(
      isDefaultTiming({ mode: 'wedding_relative', direction: 'before', amount: 0, unit: 'days' }),
    ).toBe(false);
  });
});
