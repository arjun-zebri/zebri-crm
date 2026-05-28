/**
 * Unit tests for `app/api/stripe/checkout/route` — the auth + Zod +
 * rate-limit branches. The Stripe SDK happy path is intentionally
 * not exercised here (it's a network call covered by manual smoke
 * and the broader integration suite); these tests pin the gates
 * that stand between an attacker and that call.
 */
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getUserMock = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
  })),
}));

// Keep the alert module silent during these tests.
vi.mock('@/lib/alerts', () => ({
  sendAlert: vi.fn(async () => undefined),
}));

beforeEach(() => {
  vi.resetModules();
  getUserMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

async function loadRoute() {
  // Import the route fresh each test so the in-module rate-limit
  // bucket starts clean.
  return await import('@/app/api/stripe/checkout/route');
}

function req(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/stripe/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/stripe/checkout', () => {
  it('returns 401 when no auth session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { POST } = await loadRoute();
    const res = await POST(req({ plan: 'pro' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for an unknown plan', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u1', email: 'u@test', app_metadata: {} } },
    });
    const { POST } = await loadRoute();
    const res = await POST(req({ plan: 'enterprise' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid');
  });

  it('returns 400 for a missing plan field', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u2', email: 'u@test', app_metadata: {} } },
    });
    const { POST } = await loadRoute();
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it('returns 429 after 5 rapid requests from the same user', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u_burst', email: 'u@test', app_metadata: {} } },
    });
    const { POST } = await loadRoute();
    // The 6th call must be rate-limited regardless of subsequent
    // logic. Sending bad-plan bodies so we don't actually hit Stripe;
    // the rate-limit gate runs BEFORE Zod parsing.
    for (let i = 0; i < 5; i++) {
      await POST(req({ plan: 'pro' }));
    }
    const sixth = await POST(req({ plan: 'pro' }));
    expect(sixth.status).toBe(429);
    expect(sixth.headers.get('Retry-After')).toBeDefined();
  });
});
