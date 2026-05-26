/**
 * Unit tests for `POST /api/stripe/connect/account-session`.
 *
 * Covers auth, "no account bound" rejection, the happy path with a
 * mocked Stripe `accountSessions.create` returning a client_secret,
 * and rate-limit.
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUserMock = vi.fn();
const accountSessionsCreateMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
  })),
}));
vi.mock('@/lib/payments/stripe', () => ({
  stripe: {
    accountSessions: { create: accountSessionsCreateMock },
  },
}));

beforeEach(() => {
  vi.resetModules();
  getUserMock.mockReset();
  accountSessionsCreateMock.mockReset();
});

async function loadRoute() {
  return await import('@/app/api/stripe/connect/account-session/route');
}

function req(headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost/api/stripe/connect/account-session', {
    method: 'POST',
    headers,
  });
}

describe('POST /api/stripe/connect/account-session', () => {
  it('returns 401 when there is no auth session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const { POST } = await loadRoute();
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it('returns 400 when the user has no Connect account bound', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u_no_acct', app_metadata: {} } },
      error: null,
    });
    const { POST } = await loadRoute();
    const res = await POST(req());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no connect account/i);
  });

  it('mints an account session and returns the client_secret', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'u_session',
          app_metadata: { stripe_connect_account_id: 'acct_abc' },
        },
      },
      error: null,
    });
    accountSessionsCreateMock.mockResolvedValue({
      client_secret: 'accs_secret_xyz',
      expires_at: 1234567890,
    });
    const { POST } = await loadRoute();
    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.client_secret).toBe('accs_secret_xyz');
    expect(accountSessionsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        account: 'acct_abc',
        components: expect.objectContaining({
          account_onboarding: { enabled: true },
        }),
      }),
    );
  });

  it('returns 429 after 30 rapid requests from the same IP', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'u_burst',
          app_metadata: { stripe_connect_account_id: 'acct_burst' },
        },
      },
      error: null,
    });
    accountSessionsCreateMock.mockResolvedValue({
      client_secret: 'accs_x',
      expires_at: 1,
    });
    const { POST } = await loadRoute();
    const ip = '1.2.3.4-acct-session-burst';
    for (let i = 0; i < 30; i++) {
      await POST(req({ 'x-forwarded-for': ip }));
    }
    const thirty_first = await POST(req({ 'x-forwarded-for': ip }));
    expect(thirty_first.status).toBe(429);
  });
});
