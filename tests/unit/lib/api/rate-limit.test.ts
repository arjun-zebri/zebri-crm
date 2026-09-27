import { vi } from 'vitest';

import {
  AUTH_RATE_LIMITS,
  _resetWorkflowSendLimitersForTest,
  checkWorkflowSendLimit,
  inMemoryLimiter,
  ipOf,
  STRIPE_RATE_LIMITS,
  WORKFLOW_SEND_BURST_LIMIT,
  WORKFLOW_SEND_DAILY_CAP,
} from '@/lib/api/rate-limit';
import type { AutomatedSendWindow } from '@/lib/email/send-log';

/**
 * The daily cap reads the tenant's automated `couple_emails` count
 * (Task 30). Stubbed here so each case can state the count; the real
 * query runs in `tests/integration/email/automated-send-log.test.ts`.
 */
const sendWindow = vi.hoisted(() => ({
  current: { status: 'ok', count: 0 } as AutomatedSendWindow,
  reopensAt: null as number | null,
}));
vi.mock('@/lib/email/send-log', () => ({
  AUTOMATED_SEND_WINDOW_MS: 24 * 60 * 60 * 1000,
  readAutomatedSendWindow: vi.fn(async () => sendWindow.current),
  automatedSendWindowReopensAt: vi.fn(async () => sendWindow.reopensAt),
}));

describe('inMemoryLimiter', () => {
  it('allows up to max, then blocks subsequent calls in the same window', async () => {
    const limiter = inMemoryLimiter({ windowMs: 1_000, max: 3 });
    expect((await limiter.check('a')).allowed).toBe(true);
    expect((await limiter.check('a')).allowed).toBe(true);
    expect((await limiter.check('a')).allowed).toBe(true);
    const fourth = await limiter.check('a');
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
    expect(fourth.retryAfter).toBeGreaterThan(0);
  });

  it('keeps separate buckets per key', async () => {
    const limiter = inMemoryLimiter({ windowMs: 1_000, max: 1 });
    expect((await limiter.check('a')).allowed).toBe(true);
    expect((await limiter.check('a')).allowed).toBe(false);
    expect((await limiter.check('b')).allowed).toBe(true);
  });

  it('resets after the window elapses', async () => {
    vi.useFakeTimers();
    try {
      const limiter = inMemoryLimiter({ windowMs: 1_000, max: 1 });
      expect((await limiter.check('a')).allowed).toBe(true);
      expect((await limiter.check('a')).allowed).toBe(false);
      vi.advanceTimersByTime(1_001);
      expect((await limiter.check('a')).allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('accepts a weight so one call can count as several units of work', async () => {
    const limiter = inMemoryLimiter({ windowMs: 1_000, max: 10 });
    const first = await limiter.check('a', 7);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(3);
    // 7 + 4 = 11 > 10.
    const second = await limiter.check('a', 4);
    expect(second.allowed).toBe(false);
  });
});

describe('ipOf', () => {
  function req(headers: Record<string, string>): Request {
    return new Request('https://example.com', { headers });
  }

  it('uses the first hop of x-forwarded-for', () => {
    expect(ipOf(req({ 'x-forwarded-for': '203.0.113.1, 10.0.0.1' }))).toBe('203.0.113.1');
  });

  it('falls back to x-real-ip when xff is missing', () => {
    expect(ipOf(req({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7');
  });

  it("returns 'unknown' when no header is present", () => {
    expect(ipOf(req({}))).toBe('unknown');
  });
});

describe('AUTH_RATE_LIMITS', () => {
  it('exports a positive window + max for every action', () => {
    for (const [key, opts] of Object.entries(AUTH_RATE_LIMITS)) {
      expect(opts.windowMs, key).toBeGreaterThan(0);
      expect(opts.max, key).toBeGreaterThan(0);
    }
  });
});

describe('STRIPE_RATE_LIMITS', () => {
  it('covers the 4 routes from Phase 2A + the 4 billing actions from Phase 2B', () => {
    expect(Object.keys(STRIPE_RATE_LIMITS).sort()).toEqual([
      'billingHistory',
      'cancelSubscription',
      'changePlan',
      'checkout',
      'invoicePayment',
      'paymentMethod',
      'portal',
      'resumeSubscription',
    ]);
  });

  it('uses 60-second windows for all routes/actions', () => {
    for (const [key, opts] of Object.entries(STRIPE_RATE_LIMITS)) {
      expect(opts.windowMs, key).toBe(60_000);
    }
  });

  it('exports a positive max for every route/action', () => {
    for (const [key, opts] of Object.entries(STRIPE_RATE_LIMITS)) {
      expect(opts.max, key).toBeGreaterThan(0);
    }
  });

  it('uses checkout max ≤ portal max ≤ billingHistory max (cheapest read = highest cap)', () => {
    expect(STRIPE_RATE_LIMITS.checkout.max).toBeLessThanOrEqual(STRIPE_RATE_LIMITS.portal.max);
    expect(STRIPE_RATE_LIMITS.portal.max).toBeLessThanOrEqual(
      STRIPE_RATE_LIMITS.billingHistory.max,
    );
  });
});

describe('checkWorkflowSendLimit', () => {
  beforeEach(() => {
    _resetWorkflowSendLimitersForTest();
  });

  it('exports positive burst and daily thresholds, burst tighter than daily', () => {
    expect(WORKFLOW_SEND_BURST_LIMIT.max).toBeGreaterThan(0);
    expect(WORKFLOW_SEND_DAILY_CAP.max).toBeGreaterThan(0);
    expect(WORKFLOW_SEND_BURST_LIMIT.max).toBeLessThan(WORKFLOW_SEND_DAILY_CAP.max);
  });

  it('allows sends under both thresholds and records the weight', async () => {
    const result = await checkWorkflowSendLimit('tenant-a', 3);
    expect(result).toEqual({ allowed: true, retryAfterMs: 0, shouldAlert: false });
  });

  it('breaches the burst threshold once weight exceeds it, and alerts once', async () => {
    // Fill the burst bucket exactly to its max first.
    await checkWorkflowSendLimit('tenant-b', WORKFLOW_SEND_BURST_LIMIT.max);
    const breach = await checkWorkflowSendLimit('tenant-b', 1);
    expect(breach.allowed).toBe(false);
    expect(breach.scope).toBe('burst');
    expect(breach.retryAfterMs).toBeGreaterThan(0);
    expect(breach.shouldAlert).toBe(true);

    // A second breach inside the same window must not alert again.
    const secondBreach = await checkWorkflowSendLimit('tenant-b', 1);
    expect(secondBreach.allowed).toBe(false);
    expect(secondBreach.shouldAlert).toBe(false);
  });

  // I4 (Phase 2 review): a step addressing more recipients than the
  // burst max used to be refused against a fresh bucket too, so it
  // re-parked every minute forever and never sent. The ruling is weight
  // over burst: a fresh, full bucket admits it and is drained by it.
  it('admits a step heavier than the burst max against a fresh bucket, and drains it', async () => {
    const heavy = WORKFLOW_SEND_BURST_LIMIT.max + 5;
    const result = await checkWorkflowSendLimit('tenant-heavy-fresh', heavy);
    expect(result.allowed).toBe(true);

    // Drained: the very next send in the same window is refused.
    const next = await checkWorkflowSendLimit('tenant-heavy-fresh', 1);
    expect(next.allowed).toBe(false);
    expect(next.scope).toBe('burst');
  });

  it('refuses a step heavier than the burst max while the bucket is partly used, with a finite retryAfter', async () => {
    await checkWorkflowSendLimit('tenant-heavy-partial', 1);
    const heavy = WORKFLOW_SEND_BURST_LIMIT.max + 5;
    const refused = await checkWorkflowSendLimit('tenant-heavy-partial', heavy);
    expect(refused.allowed).toBe(false);
    expect(refused.scope).toBe('burst');
    expect(Number.isFinite(refused.retryAfterMs)).toBe(true);
    expect(refused.retryAfterMs).toBeGreaterThan(0);
    expect(refused.retryAfterMs).toBeLessThanOrEqual(WORKFLOW_SEND_BURST_LIMIT.windowMs);
  });

  it('keeps buckets separate per tenant', async () => {
    await checkWorkflowSendLimit('tenant-c', WORKFLOW_SEND_BURST_LIMIT.max);
    const other = await checkWorkflowSendLimit('tenant-d', 1);
    expect(other.allowed).toBe(true);
  });

  describe('daily cap (counted from couple_emails)', () => {
    afterEach(() => {
      sendWindow.current = { status: 'ok', count: 0 };
      sendWindow.reopensAt = null;
    });

    it('defers once the logged count plus this step would pass the cap, until the row that must age out does', async () => {
      const { automatedSendWindowReopensAt } = await import('@/lib/email/send-log');
      sendWindow.current = { status: 'ok', count: WORKFLOW_SEND_DAILY_CAP.max };
      sendWindow.reopensAt = Date.now() + 60 * 60 * 1000;

      const breach = await checkWorkflowSendLimit('tenant-cap', 3);
      expect(breach.allowed).toBe(false);
      expect(breach.scope).toBe('daily_cap');
      expect(breach.shouldAlert).toBe(true);
      // Three rows must age out for a weight-3 step to fit, not one (M3).
      expect(automatedSendWindowReopensAt).toHaveBeenCalledWith('tenant-cap', 3, expect.any(Number));
      expect(breach.retryAfterMs).toBeGreaterThan(59 * 60 * 1000);
      expect(breach.retryAfterMs).toBeLessThanOrEqual(60 * 60 * 1000);

      const again = await checkWorkflowSendLimit('tenant-cap', 1);
      expect(again.allowed).toBe(false);
      expect(again.shouldAlert).toBe(false);
    });

    it('never asks to wake sooner than a minute, even when the reopen time is unreadable', async () => {
      sendWindow.current = { status: 'ok', count: WORKFLOW_SEND_DAILY_CAP.max };
      sendWindow.reopensAt = null;
      const breach = await checkWorkflowSendLimit('tenant-floor', 1);
      expect(breach.retryAfterMs).toBe(60_000);
    });

    it('admits a send that lands exactly on the cap', async () => {
      sendWindow.current = { status: 'ok', count: WORKFLOW_SEND_DAILY_CAP.max - 2 };
      expect((await checkWorkflowSendLimit('tenant-edge', 2)).allowed).toBe(true);
    });

    it('still defers after the in-memory limiters reset, because the count is not in memory', async () => {
      sendWindow.current = { status: 'ok', count: WORKFLOW_SEND_DAILY_CAP.max };
      expect((await checkWorkflowSendLimit('tenant-restart', 1)).allowed).toBe(false);

      _resetWorkflowSendLimitersForTest(); // what a cold start does
      const afterRestart = await checkWorkflowSendLimit('tenant-restart', 1);
      expect(afterRestart.allowed).toBe(false);
      expect(afterRestart.scope).toBe('daily_cap');
    });

    it('admits a step heavier than the cap against an empty window, so it can ever send', async () => {
      const result = await checkWorkflowSendLimit('tenant-huge', WORKFLOW_SEND_DAILY_CAP.max + 5);
      expect(result.allowed).toBe(true);
    });

    it('an unreadable count defers under its own scope and alerts once per window (I3)', async () => {
      sendWindow.current = { status: 'unknown', reason: 'canceling statement due to statement timeout', code: '57014' };
      const first = await checkWorkflowSendLimit('tenant-unknown', 1);
      expect(first).toEqual({
        allowed: false,
        scope: 'daily_cap_unreadable',
        retryAfterMs: 60_000,
        shouldAlert: true,
        errorCode: '57014',
      });

      const second = await checkWorkflowSendLimit('tenant-unknown', 1);
      expect(second.scope).toBe('daily_cap_unreadable');
      expect(second.shouldAlert).toBe(false);
    });

    it('checks burst first, so a burst breach never reads the count', async () => {
      const { readAutomatedSendWindow } = await import('@/lib/email/send-log');
      await checkWorkflowSendLimit('tenant-burst-first', WORKFLOW_SEND_BURST_LIMIT.max);
      vi.mocked(readAutomatedSendWindow).mockClear();
      const breach = await checkWorkflowSendLimit('tenant-burst-first', 1);
      expect(breach.scope).toBe('burst');
      expect(readAutomatedSendWindow).not.toHaveBeenCalled();
    });
  });
});
