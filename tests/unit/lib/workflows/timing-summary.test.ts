import { describe, expect, it } from 'vitest';

import {
  describeTiming,
  formatSendTime,
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
    // `hours` is now a valid apply_relative unit too (Task 7 widened
    // DelayUnit onto apply_relative), so it is kept rather than coerced.
    // `months` still has no meaning on after_previous, so that one falls
    // back to days.
    expect(toStepTiming({ mode: 'apply_relative', amount: 2, unit: 'hours' })).toEqual({
      mode: 'apply_relative',
      amount: 2,
      unit: 'hours',
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

describe('toStepTiming with minutes and sendTime', () => {
  it('keeps minutes and a valid send time', () => {
    expect(toStepTiming({ mode: 'after_previous', delayAmount: 45, unit: 'minutes' })).toEqual({ mode: 'after_previous', delayAmount: 45, unit: 'minutes' })
    expect(toStepTiming({ mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'days', sendTime: '09:15' })).toEqual({ mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'days', sendTime: '09:15' })
  })

  it('drops an off-grid send time rather than crashing the row', () => {
    expect(toStepTiming({ mode: 'apply_relative', amount: 1, unit: 'days', sendTime: '09:10' })).toEqual({ mode: 'apply_relative', amount: 1, unit: 'days' })
  })

  it('drops a send time that arrived with a sub-day unit', () => {
    expect(toStepTiming({ mode: 'apply_relative', amount: 30, unit: 'minutes', sendTime: '09:00' })).toEqual({ mode: 'apply_relative', amount: 30, unit: 'minutes' })
  })
})

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

describe('wording with minutes and send times', () => {
  it('formatSendTime reads as an MC would say it', () => {
    expect(formatSendTime('09:15')).toBe('9:15am')
    expect(formatSendTime('13:00')).toBe('1:00pm')
    expect(formatSendTime('00:00')).toBe('12:00am')
    expect(formatSendTime('12:30')).toBe('12:30pm')
  })

  it('describeTiming appends the send time and speaks minutes', () => {
    expect(describeTiming({ mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'days', sendTime: '09:15' })).toBe('2 days before the wedding at 9:15am')
    expect(describeTiming({ mode: 'apply_relative', amount: 1, unit: 'weeks', sendTime: '17:00' })).toBe('1 week after the workflow starts at 5:00pm')
    expect(describeTiming({ mode: 'after_previous', delayAmount: 45, unit: 'minutes' })).toBe('45 minutes after the step above')
    expect(describeTiming({ mode: 'apply_relative', amount: 30, unit: 'minutes' })).toBe('30 minutes after the workflow starts')
    expect(describeTiming({ mode: 'wedding_relative', direction: 'before', amount: 0, unit: 'days', sendTime: '09:00' })).toBe('On the wedding day at 9:00am')
  })

  it('shortTiming stays compact', () => {
    expect(shortTiming({ mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'days', sendTime: '09:15' })).toBe('2d before wedding, 9:15am')
    expect(shortTiming({ mode: 'after_previous', delayAmount: 45, unit: 'minutes' })).toBe('+45m')
    expect(shortTiming({ mode: 'apply_relative', amount: 0, unit: 'days', sendTime: '09:00' })).toBe('On start, 9:00am')
  })
})
