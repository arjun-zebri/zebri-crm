/**
 * Unit tests for `lib/api/public-token-limiter`.
 *
 * The token-attempt limiter is the only thing standing between the
 * public share-token RPC surface and a determined enumeration
 * attack. Pin the invariants:
 *
 * 1. First 60 invalid attempts from one IP are allowed (so a
 *    couple's flaky bookmark or a legitimate scraper hitting a few
 *    URLs doesn't cause a 429).
 * 2. 61st attempt is blocked.
 * 3. Burst alert fires exactly once on the 11th attempt within 60s
 *    (the burst threshold) — NOT on every subsequent attempt.
 * 4. Each IP has its own buckets — one attacker doesn't lock out
 *    other users.
 *
 * The buckets are process-local in-memory, so we reset between
 * tests via the exported `_resetForTest` helper.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  _resetForTest,
  recordInvalidTokenAttempt,
} from '@/lib/api/public-token-limiter';

// Mock sendAlert so we can observe burst-alert firing without
// hitting Slack.
const sendAlertMock = vi.fn();
vi.mock('@/lib/alerts/send-alert', () => ({
  sendAlert: (event: unknown) => sendAlertMock(event),
}));

beforeEach(() => {
  _resetForTest();
  sendAlertMock.mockReset();
});

afterEach(() => {
  _resetForTest();
});

describe('recordInvalidTokenAttempt', () => {
  it('allows the first 60 invalid attempts from one IP', async () => {
    // Generate 60 attempts. To avoid the burst threshold (10/60s),
    // we'd normally need 7 hours of real time — but the in-memory
    // limiter just compares against the bucket's `resetAt`. Since
    // the burst window is purely informational (drives an alert,
    // not the allow decision), we can let it fire and just check
    // `allowed` here.
    for (let i = 0; i < 60; i += 1) {
      const result = await recordInvalidTokenAttempt({
        ip: '1.2.3.4',
        surface: 'invoice',
      });
      expect(result.allowed, `attempt ${i + 1} should be allowed`).toBe(true);
    }
  });

  it('blocks the 61st attempt from the same IP', async () => {
    for (let i = 0; i < 60; i += 1) {
      await recordInvalidTokenAttempt({ ip: '1.2.3.4', surface: 'invoice' });
    }
    const result = await recordInvalidTokenAttempt({
      ip: '1.2.3.4',
      surface: 'invoice',
    });
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('does not block a different IP', async () => {
    for (let i = 0; i < 70; i += 1) {
      await recordInvalidTokenAttempt({ ip: 'attacker', surface: 'invoice' });
    }
    const victim = await recordInvalidTokenAttempt({
      ip: 'innocent',
      surface: 'invoice',
    });
    expect(victim.allowed).toBe(true);
  });

  it('fires the burst alert exactly once on the 11th attempt within 60s', async () => {
    for (let i = 0; i < 11; i += 1) {
      await recordInvalidTokenAttempt({
        ip: 'burst-ip',
        surface: 'quote',
      });
    }
    expect(sendAlertMock).toHaveBeenCalledTimes(1);
    expect(sendAlertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'public_token_attempt_burst',
        ip: 'burst-ip',
        surface: 'quote',
      }),
    );
  });

  it('does NOT re-fire the burst alert on subsequent attempts within the same window', async () => {
    for (let i = 0; i < 20; i += 1) {
      await recordInvalidTokenAttempt({ ip: 'burst-ip', surface: 'invoice' });
    }
    // 20 attempts cross the threshold once; only one alert.
    expect(sendAlertMock).toHaveBeenCalledTimes(1);
  });

  it('reports the surface label on the alert (so we know which page is being scanned)', async () => {
    for (let i = 0; i < 11; i += 1) {
      await recordInvalidTokenAttempt({ ip: '5.6.7.8', surface: 'portal' });
    }
    expect(sendAlertMock).toHaveBeenCalledWith(
      expect.objectContaining({ surface: 'portal' }),
    );
  });
});
