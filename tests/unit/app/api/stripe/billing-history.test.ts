/**
 * Unit tests for `app/api/stripe/billing-history/route` — auth +
 * "no customer" + rate-limit branches.
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUserMock = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
  })),
}));
vi.mock('@/lib/alerts', () => ({
  sendAlert: vi.fn(async () => undefined),
}));

beforeEach(() => {
  vi.resetModules();
  getUserMock.mockReset();
});

async function loadRoute() {
  return await import('@/app/api/stripe/billing-history/route');
}

function req(): NextRequest {
  return new NextRequest('http://localhost/api/stripe/billing-history', { method: 'GET' });
}

describe('GET /api/stripe/billing-history', () => {
  it('returns 401 when no auth session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { GET } = await loadRoute();
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it('returns empty results when the user has no stripe_customer_id', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: { id: 'u_no_billing', email: 'u@test', app_metadata: { account_type: 'vendor' } },
      },
    });
    const { GET } = await loadRoute();
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ invoices: [], upcoming: null });
  });

  it('returns 429 after 30 rapid requests from the same user', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: { id: 'u_history_burst', email: 'u@test', app_metadata: {} },
      },
    });
    const { GET } = await loadRoute();
    for (let i = 0; i < 30; i++) {
      await GET(req());
    }
    const thirtyfirst = await GET(req());
    expect(thirtyfirst.status).toBe(429);
  });
});
