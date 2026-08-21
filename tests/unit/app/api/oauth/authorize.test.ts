/**
 * Unit tests for `app/api/oauth/authorize/route` — the gates in front of
 * the provider redirect. Pins the production incident where the route
 * returned a raw 500 (blank error page) when the provider's OAuth client
 * credentials were missing from the environment: a misconfigured deploy
 * must bounce the MC back to settings with `oauth=error`, never crash.
 */
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getUserMock = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
  })),
}));

// Keep the alert logger silent during these tests.
vi.mock('@/lib/alerts/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

beforeEach(() => {
  vi.resetModules();
  getUserMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function loadRoute() {
  // Import fresh each test so the in-module rate-limit bucket starts clean.
  return await import('@/app/api/oauth/authorize/route');
}

function req(provider: string, query = ''): NextRequest {
  return new NextRequest(
    `http://localhost/api/oauth/authorize?provider=${provider}${query}`,
  );
}

/** Read one cookie's value off a redirect response. */
function cookie(res: Response, name: string): string | undefined {
  return res.headers
    .getSetCookie()
    .find((c) => c.startsWith(`${name}=`))
    ?.split(';')[0]
    ?.split('=')[1];
}

const user = { id: 'u1', email: 'mc@test', app_metadata: {} };

describe('GET /api/oauth/authorize', () => {
  it('redirects to login when no auth session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { GET } = await loadRoute();
    const res = await GET(req('google'));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('redirects back to settings with oauth=error for an unknown provider', async () => {
    getUserMock.mockResolvedValue({ data: { user } });
    const { GET } = await loadRoute();
    const res = await GET(req('yahoo'));
    expect(res.headers.get('location')).toContain('oauth=error');
  });

  it('redirects back to settings with oauth=error when the provider credentials are not configured', async () => {
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID', '');
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET', '');
    getUserMock.mockResolvedValue({ data: { user } });
    const { GET } = await loadRoute();
    const res = await GET(req('google'));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('location')).toContain('oauth=error');
  });

  it('redirects to the Google consent screen when credentials are configured', async () => {
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID', 'client-id');
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET', 'client-secret');
    getUserMock.mockResolvedValue({ data: { user } });
    const { GET } = await loadRoute();
    const res = await GET(req('google'));
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('accounts.google.com');
    expect(location).toContain('gmail.send');
  });

  describe('return destination', () => {
    beforeEach(() => {
      vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID', 'client-id');
      vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET', 'client-secret');
      getUserMock.mockResolvedValue({ data: { user } });
    });

    it('stores an allowlisted return destination for the callback to read', async () => {
      const { GET, OAUTH_RETURN_COOKIE } = await loadRoute();
      const res = await GET(req('google', '&purpose=calendar&return=calendar'));
      expect(cookie(res, OAUTH_RETURN_COOKIE)).toBe('calendar');
    });

    it('defaults to settings when no return destination is given', async () => {
      const { GET, OAUTH_RETURN_COOKIE } = await loadRoute();
      const res = await GET(req('google', '&purpose=calendar'));
      expect(cookie(res, OAUTH_RETURN_COOKIE)).toBe('settings');
    });

    it('falls back to settings rather than echoing an off-list destination', async () => {
      const { GET, OAUTH_RETURN_COOKIE } = await loadRoute();
      // Why: this value survives a round trip through a third-party consent
      // screen, so echoing it back would be an open redirect.
      const res = await GET(
        req('google', `&purpose=calendar&return=${encodeURIComponent('https://evil.test')}`),
      );
      expect(cookie(res, OAUTH_RETURN_COOKIE)).toBe('settings');
    });
  });
});
