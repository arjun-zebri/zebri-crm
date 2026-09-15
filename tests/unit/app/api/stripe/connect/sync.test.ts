/**
 * Unit tests for `POST /api/stripe/connect/sync`.
 *
 * The important invariant: the manual sync must write BOTH stores
 * that "is Stripe connected?" is read from. The Settings page reads
 * the `connect_accounts` mirror, but the branding readiness pill and
 * the invoice-payment route read `app_metadata.stripe_connect_enabled`
 * via the entitlements helper. Before this test, sync only wrote the
 * mirror, so an MC whose `account.updated` webhook never landed saw
 * "Connected" in Settings and "Stripe connection for card payments"
 * missing on the invoice canvas at the same time.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUserMock = vi.fn();
const accountsRetrieveMock = vi.fn();
const syncConnectAccountMock = vi.fn();
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
  stripe: { accounts: { retrieve: accountsRetrieveMock } },
}));
vi.mock('@/lib/payments/connect-account', () => ({
  syncConnectAccount: syncConnectAccountMock,
}));
vi.mock('@/lib/auth/entitlements', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/auth/entitlements')>(
      '@/lib/auth/entitlements',
    );
  return { ...actual, updateEntitlements: updateEntitlementsMock };
});
vi.mock('@/lib/alerts/send-alert', () => ({
  sendAlert: vi.fn(async () => undefined),
}));

beforeEach(() => {
  vi.resetModules();
  getUserMock.mockReset();
  accountsRetrieveMock.mockReset();
  syncConnectAccountMock.mockReset().mockResolvedValue('acct_bound');
  updateEntitlementsMock.mockReset().mockResolvedValue(undefined);
});

async function loadRoute() {
  return await import('@/app/api/stripe/connect/sync/route');
}

function req(): Request {
  return new Request('http://localhost/api/stripe/connect/sync', {
    method: 'POST',
  });
}

function boundUser() {
  return {
    data: {
      user: {
        id: 'u_bound',
        app_metadata: {
          account_type: 'vendor',
          stripe_connect_account_id: 'acct_bound',
        },
      },
    },
    error: null,
  };
}

describe('POST /api/stripe/connect/sync', () => {
  it('returns 401 when there is no auth session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const { POST } = await loadRoute();
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it('returns 400 when no Connect account is bound', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u_none', app_metadata: { account_type: 'vendor' } } },
      error: null,
    });
    const { POST } = await loadRoute();
    const res = await POST(req());
    expect(res.status).toBe(400);
    expect(accountsRetrieveMock).not.toHaveBeenCalled();
  });

  it('flips app_metadata.stripe_connect_enabled on when Stripe reports charges_enabled', async () => {
    getUserMock.mockResolvedValue(boundUser());
    accountsRetrieveMock.mockResolvedValue({
      id: 'acct_bound',
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
    });
    const { POST } = await loadRoute();
    const res = await POST(req());
    expect(res.status).toBe(200);

    expect(syncConnectAccountMock).toHaveBeenCalledWith(
      'u_bound',
      expect.objectContaining({ id: 'acct_bound', charges_enabled: true }),
    );
    expect(updateEntitlementsMock).toHaveBeenCalledWith(
      expect.anything(),
      'u_bound',
      { stripe_connect_account_id: 'acct_bound', stripe_connect_enabled: true },
    );
  });

  it('flips app_metadata.stripe_connect_enabled off when Stripe reports charges disabled', async () => {
    getUserMock.mockResolvedValue(boundUser());
    accountsRetrieveMock.mockResolvedValue({
      id: 'acct_bound',
      charges_enabled: false,
    });
    const { POST } = await loadRoute();
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(updateEntitlementsMock).toHaveBeenCalledWith(
      expect.anything(),
      'u_bound',
      { stripe_connect_account_id: 'acct_bound', stripe_connect_enabled: false },
    );
  });
});
