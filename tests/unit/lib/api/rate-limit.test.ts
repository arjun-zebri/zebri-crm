import { vi } from 'vitest';

import {
  AUTH_RATE_LIMITS,
  inMemoryLimiter,
  ipOf,
  STRIPE_RATE_LIMITS,
} from '@/lib/api/rate-limit';

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
