/**
 * Unit tests for `GET /api/stripe/connect/status`.
 *
 * Thin route — auth gate + delegation to `readConnectAccount`. The
 * mirror-row projection logic itself is integration-tested against
 * a real Supabase in `tests/integration/connect/sync-account.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUserMock = vi.fn();
const readConnectAccountMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
  })),
}));
vi.mock('@/lib/payments/connect-account', () => ({
  readConnectAccount: readConnectAccountMock,
}));

beforeEach(() => {
  vi.resetModules();
  getUserMock.mockReset();
  readConnectAccountMock.mockReset();
});

async function loadRoute() {
  return await import('@/app/api/stripe/connect/status/route');
}

describe('GET /api/stripe/connect/status', () => {
  it('returns 401 when there is no auth session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const { GET } = await loadRoute();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns the mirror state for the authenticated user', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u_status', app_metadata: {} } },
      error: null,
    });
    const mockState = {
      accountId: 'acct_x',
      chargesEnabled: true,
      payoutsEnabled: false,
      detailsSubmitted: true,
      requirementsCurrentlyDue: [],
      requirementsPastDue: [],
      disabledReason: null,
      defaultCurrency: 'aud',
      country: 'AU',
      businessType: 'individual',
      lastAccountId: null,
    };
    readConnectAccountMock.mockResolvedValue(mockState);
    const { GET } = await loadRoute();
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.state).toEqual(mockState);
    expect(readConnectAccountMock).toHaveBeenCalledWith('u_status');
  });

  it('returns null state when the user has no mirror row yet', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u_no_row', app_metadata: {} } },
      error: null,
    });
    readConnectAccountMock.mockResolvedValue(null);
    const { GET } = await loadRoute();
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.state).toBeNull();
  });
});
