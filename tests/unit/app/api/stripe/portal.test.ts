/**
 * Unit tests for `app/api/stripe/portal/route` — auth + rate-limit
 * + "no billing account" branches.
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
  return await import('@/app/api/stripe/portal/route');
}

function req(): NextRequest {
  return new NextRequest('http://localhost/api/stripe/portal', { method: 'POST' });
}

describe('POST /api/stripe/portal', () => {
  it('returns 401 when no auth session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { POST } = await loadRoute();
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it('returns 400 when the user has no stripe_customer_id', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: { id: 'u_no_billing', email: 'u@test', app_metadata: { account_type: 'vendor' } },
      },
    });
    const { POST } = await loadRoute();
    const res = await POST(req());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/billing/i);
  });

  it('returns 429 after 10 rapid requests from the same user', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: { id: 'u_portal_burst', email: 'u@test', app_metadata: {} },
      },
    });
    const { POST } = await loadRoute();
    for (let i = 0; i < 10; i++) {
      await POST(req());
    }
    const eleventh = await POST(req());
    expect(eleventh.status).toBe(429);
  });
});
