import { vi } from 'vitest';

import { inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';

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
