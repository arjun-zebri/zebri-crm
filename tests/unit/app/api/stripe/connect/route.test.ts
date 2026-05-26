/**
 * Unit tests for `POST /api/stripe/connect`.
 *
 * Covers auth gate, rate-limit, idempotent re-call (returns existing
 * accountId), and the happy path (creates a fresh Express account
 * via the mocked Stripe client + seeds the mirror via the mocked
 * connect-account upserter).
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUserMock = vi.fn();
const accountsCreateMock = vi.fn();
const accountsRetrieveMock = vi.fn();
const syncConnectAccountMock = vi.fn();
const readConnectAccountMock = vi.fn();
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
vi.mock('@/lib/payments/stripe', () => ({
  stripe: {
    accounts: {
      create: accountsCreateMock,
      retrieve: accountsRetrieveMock,
    },
  },
}));
vi.mock('@/lib/payments/connect-account', () => ({
  syncConnectAccount: syncConnectAccountMock,
  readConnectAccount: readConnectAccountMock,
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
vi.mock('@/lib/alerts/send-alert', () => ({
  sendAlert: vi.fn(async () => undefined),
}));

beforeEach(() => {
  vi.resetModules();
  getUserMock.mockReset();
  accountsCreateMock.mockReset();
  accountsRetrieveMock.mockReset();
  syncConnectAccountMock.mockReset().mockResolvedValue('acct_new');
  readConnectAccountMock.mockReset().mockResolvedValue(null);
  updateEntitlementsMock.mockReset().mockResolvedValue(undefined);
});

async function loadRoute() {
  return await import('@/app/api/stripe/connect/route');
}

function req(headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost/api/stripe/connect', {
    method: 'POST',
    headers,
  });
}

describe('POST /api/stripe/connect', () => {
  it('returns 401 when there is no auth session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const { POST } = await loadRoute();
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it('returns the existing accountId without calling Stripe when already bound', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'u_bound',
          app_metadata: {
            stripe_connect_account_id: 'acct_existing',
            account_type: 'vendor',
          },
        },
      },
      error: null,
    });
    const { POST } = await loadRoute();
    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ accountId: 'acct_existing' });
    expect(accountsCreateMock).not.toHaveBeenCalled();
  });

  it('creates a fresh Express account when no binding exists and no last_account_id', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: { id: 'u_new', app_metadata: { account_type: 'vendor' } },
      },
      error: null,
    });
    accountsCreateMock.mockResolvedValue({ id: 'acct_fresh' });
    const { POST } = await loadRoute();
    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accountId).toBe('acct_fresh');
    expect(accountsCreateMock).toHaveBeenCalledWith({ type: 'express' });
    expect(syncConnectAccountMock).toHaveBeenCalledWith(
      'u_new',
      expect.objectContaining({ id: 'acct_fresh', charges_enabled: false }),
    );
    expect(updateEntitlementsMock).toHaveBeenCalledWith(
      expect.anything(),
      'u_new',
      expect.objectContaining({
        stripe_connect_account_id: 'acct_fresh',
        stripe_connect_enabled: false,
      }),
    );
  });

  it('returns 429 after rapid-fire requests from the same IP', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'u_burst',
          app_metadata: { stripe_connect_account_id: 'acct_x' },
        },
      },
      error: null,
    });
    const { POST } = await loadRoute();
    // Limiter is 5/min/IP. The unique IP header keeps this test
    // isolated from other route-test files in the same process.
    const ip = '1.2.3.4-connect-route-burst';
    for (let i = 0; i < 5; i++) {
      await POST(req({ 'x-forwarded-for': ip }));
    }
    const sixth = await POST(req({ 'x-forwarded-for': ip }));
    expect(sixth.status).toBe(429);
  });
});
