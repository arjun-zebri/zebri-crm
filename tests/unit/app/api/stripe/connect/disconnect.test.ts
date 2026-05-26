/**
 * Unit tests for `POST /api/stripe/connect/disconnect`.
 *
 * Covers auth, the happy path (hard-deletes the mirror row +
 * clears app_metadata), and the rate-limit branch. The two-phase
 * structure (deleteConnectBinding → updateEntitlements) is each
 * exercised by mocked dependencies.
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUserMock = vi.fn();
const deleteConnectBindingMock = vi.fn();
const updateEntitlementsMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
  })),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: {} as unknown },
  })),
}));
vi.mock('@/lib/payments/connect-account', () => ({
  deleteConnectBinding: deleteConnectBindingMock,
}));
vi.mock('@/lib/auth/entitlements', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/auth/entitlements')>(
      '@/lib/auth/entitlements',
    );
  return {
    ...actual,
    updateEntitlements: updateEntitlementsMock,
  };
});

beforeEach(() => {
  vi.resetModules();
  getUserMock.mockReset();
  deleteConnectBindingMock.mockReset().mockResolvedValue(undefined);
  updateEntitlementsMock.mockReset().mockResolvedValue(undefined);
});

async function loadRoute() {
  return await import('@/app/api/stripe/connect/disconnect/route');
}

function req(headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost/api/stripe/connect/disconnect', {
    method: 'POST',
    headers,
  });
}

describe('POST /api/stripe/connect/disconnect', () => {
  it('returns 401 when there is no auth session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const { POST } = await loadRoute();
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it('hard-deletes the mirror row + clears app_metadata entitlements', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'u_disconnect',
          app_metadata: { stripe_connect_account_id: 'acct_to_drop' },
        },
      },
      error: null,
    });
    const { POST } = await loadRoute();
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(deleteConnectBindingMock).toHaveBeenCalledWith('u_disconnect');
    expect(updateEntitlementsMock).toHaveBeenCalledWith(
      expect.anything(),
      'u_disconnect',
      expect.objectContaining({
        stripe_connect_account_id: undefined,
        stripe_connect_enabled: false,
      }),
    );
  });

  it('returns 500 with the underlying detail when deleteConnectBinding throws', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u_fail_delete', app_metadata: {} } },
      error: null,
    });
    deleteConnectBindingMock.mockRejectedValue(new Error('boom'));
    const { POST } = await loadRoute();
    const res = await POST(req());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.detail).toBe('boom');
  });

  it('returns 429 after 5 rapid requests from the same IP', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u_burst', app_metadata: {} } },
      error: null,
    });
    const { POST } = await loadRoute();
    const ip = '1.2.3.4-disconnect-burst';
    for (let i = 0; i < 5; i++) {
      await POST(req({ 'x-forwarded-for': ip }));
    }
    const sixth = await POST(req({ 'x-forwarded-for': ip }));
    expect(sixth.status).toBe(429);
  });
});
