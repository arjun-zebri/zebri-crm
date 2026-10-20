/**
 * The Start picker's date-anchored trigger sentence (ZEB-124).
 *
 * An MC started an "invoice due, 7 days before" workflow by hand and its
 * first email came due today. These pin the sentence the picker uses to
 * warn about that, read through the same split and schema the dispatcher
 * uses so a stored default reads the way the emitter reads it.
 */
import { describe, expect, it } from 'vitest';

import { selfStartTiming, toSelfStart } from '@/lib/workflows/self-start';

/** An `on_event` apply rule as the builder stores it. */
function onEvent(eventType: string, triggerConfig: Record<string, unknown>) {
  return { eventType, triggerConfig };
}

describe('selfStartTiming', () => {
  it('describes an invoice-due lead time', () => {
    expect(selfStartTiming('on_event', onEvent('invoice_due', { days: 7 }))).toBe(
      '7 days before each invoice is due',
    );
    expect(selfStartTiming('on_event', onEvent('invoice_due', { days: 1 }))).toBe(
      '1 day before each invoice is due',
    );
  });

  it('reads a config saved without days as the due date itself, as the emitter does', () => {
    expect(selfStartTiming('on_event', onEvent('invoice_due', {}))).toBe(
      'on the day each invoice is due',
    );
  });

  it('describes invoice overdue with the clamped threshold', () => {
    expect(selfStartTiming('on_event', onEvent('invoice_overdue', { daysOverdueMin: 3 }))).toBe(
      'when an invoice is 3 days overdue',
    );
    // 0 is clamped to 1 so it never collides with invoice_due on the day.
    expect(selfStartTiming('on_event', onEvent('invoice_overdue', { daysOverdueMin: 0 }))).toBe(
      'when an invoice is 1 day overdue',
    );
  });

  it('describes days before and after the event', () => {
    expect(
      selfStartTiming('on_event', onEvent('time_before_event', { amount: 2, unit: 'weeks' })),
    ).toBe('2 weeks before the event');
    expect(
      selfStartTiming('on_event', onEvent('time_after_event', { amount: 1, unit: 'days' })),
    ).toBe('1 day after the event');
  });

  it('describes an anniversary', () => {
    expect(selfStartTiming('on_event', onEvent('anniversary_of_event', { years: 1 }))).toBe(
      "on the couple's 1-year anniversary",
    );
  });

  it('says nothing for triggers not anchored to a date', () => {
    expect(selfStartTiming('manual', {})).toBeNull();
    expect(selfStartTiming('on_couple_created', {})).toBeNull();
    expect(selfStartTiming('on_event', onEvent('contract_signed', {}))).toBeNull();
    expect(selfStartTiming('on_event', {})).toBeNull();
  });

  it('says nothing for a config its own schema rejects', () => {
    expect(selfStartTiming('on_event', onEvent('invoice_due', { days: -4 }))).toBeNull();
  });
});

describe('toSelfStart', () => {
  it('marks a live workflow active and a draft not', () => {
    const rule = onEvent('invoice_due', { days: 7 });
    expect(toSelfStart('active', 'on_event', rule)).toEqual({
      when: '7 days before each invoice is due',
      active: true,
    });
    expect(toSelfStart('draft', 'on_event', rule)?.active).toBe(false);
    expect(toSelfStart('active', 'manual', {})).toBeNull();
  });
});
