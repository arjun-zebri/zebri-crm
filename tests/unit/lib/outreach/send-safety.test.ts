import { describe, expect, it } from 'vitest';

import { isDefinitiveRefusal, GmailError } from '@/lib/outreach/gmail/client';
import { bareMessageId } from '@/lib/outreach/services/send-recovery';
import { isSlowPassDue, SLOW_PASS_INTERVAL_MS } from '@/lib/outreach/services/tick';

describe('isDefinitiveRefusal', () => {
  it('is true only for a 4xx answer, where Gmail definitely did not send', () => {
    expect(isDefinitiveRefusal(new GmailError('Gmail 429', 429, false))).toBe(true);
    expect(isDefinitiveRefusal(new GmailError('Gmail 400', 400, false))).toBe(true);
  });

  it('is false for a timeout, network failure or 5xx, which may have sent', () => {
    expect(isDefinitiveRefusal(new GmailError('Gmail request failed', 0, false))).toBe(false);
    expect(isDefinitiveRefusal(new GmailError('Gmail 503', 503, false))).toBe(false);
    expect(isDefinitiveRefusal(new Error('boom'))).toBe(false);
  });
});

describe('bareMessageId', () => {
  it('strips the angle brackets Gmail search does not accept', () => {
    expect(bareMessageId('<abc-123@zebri.com.au>')).toBe('abc-123@zebri.com.au');
  });
});

describe('isSlowPassDue', () => {
  const t0 = Date.parse('2026-10-13T00:00:00Z');

  it('is due when it has never run', () => {
    expect(isSlowPassDue(null, t0)).toBe(true);
  });

  it('runs about every five minutes at a one-minute cadence', () => {
    const last = new Date(t0).toISOString();
    const ticks = Array.from({ length: 10 }, (_, i) => t0 + (i + 1) * 60_000);
    const runs = ticks.filter((t) => isSlowPassDue(last, t));
    expect(runs[0]).toBe(t0 + 5 * 60_000);
  });

  it('runs on every fifteen-minute tick, so it is never starved by cadence', () => {
    const quarter = (i: number) => t0 + i * 15 * 60_000;
    let last: string | null = null;
    const runs: number[] = [];
    for (let i = 1; i <= 8; i++) {
      if (isSlowPassDue(last, quarter(i))) {
        runs.push(quarter(i));
        last = new Date(quarter(i)).toISOString();
      }
    }
    expect(runs).toHaveLength(8);
  });

  it('is not due again before the interval', () => {
    expect(isSlowPassDue(new Date(t0).toISOString(), t0 + SLOW_PASS_INTERVAL_MS - 60_000)).toBe(false);
  });
});
