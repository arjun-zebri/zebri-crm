/**
 * Unit tests for the post-consent redirect in `app/api/oauth/callback/route`.
 *
 * The `return` destination round-trips through a third-party consent screen,
 * so it is deliberately an allowlist and not a caller-supplied path. These
 * pin both halves: an MC who started on `/calendar` comes back there, and a
 * tampered cookie can only ever land them on Settings.
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUserMock = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
  })),
}));

vi.mock('@/lib/alerts/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const exchangeCodeMock = vi.fn();
const fetchUserEmailMock = vi.fn();
vi.mock('@/lib/oauth/tokens', () => ({
  exchangeCode: (...args: unknown[]) => exchangeCodeMock(...args),
  fetchUserEmail: (...args: unknown[]) => fetchUserEmailMock(...args),
}));

const saveCalendarConnectionMock = vi.fn();
vi.mock('@/lib/calendar/connections', () => ({
  saveCalendarConnection: (...args: unknown[]) => saveCalendarConnectionMock(...args),
}));

const STATE = 'google.calendar.abc123';

beforeEach(() => {
  vi.resetModules();
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: 'u1' } } });
  exchangeCodeMock.mockReset().mockResolvedValue({
    accessToken: 'at',
    refreshToken: 'rt',
    expiresIn: 3600,
  });
  fetchUserEmailMock.mockReset().mockResolvedValue('mc@test');
  saveCalendarConnectionMock.mockReset().mockResolvedValue(undefined);
});

/** Build a callback request carrying the state cookie plus a return cookie. */
async function callbackReq(returnCookie?: string) {
  const { OAUTH_STATE_COOKIE, OAUTH_RETURN_COOKIE } = await import(
    '@/app/api/oauth/authorize/route'
  );
  const req = new NextRequest(
    `http://localhost/api/oauth/callback?code=abc&state=${STATE}`,
  );
  req.cookies.set(OAUTH_STATE_COOKIE, STATE);
  if (returnCookie !== undefined) req.cookies.set(OAUTH_RETURN_COOKIE, returnCookie);
  return req;
}

describe('GET /api/oauth/callback — calendar return destination', () => {
  it('returns the MC to /calendar when that is where they started', async () => {
    const { GET } = await import('@/app/api/oauth/callback/route');
    const res = await GET(await callbackReq('calendar'));
    expect(res.headers.get('location')).toContain('/calendar?calendar=connected');
    expect(saveCalendarConnectionMock).toHaveBeenCalled();
  });

  it('returns the MC to Settings when no return cookie is present', async () => {
    const { GET } = await import('@/app/api/oauth/callback/route');
    const res = await GET(await callbackReq());
    expect(res.headers.get('location')).toContain('/settings?tab=public&calendar=connected');
  });

  it('ignores an off-allowlist return cookie instead of redirecting to it', async () => {
    const { GET } = await import('@/app/api/oauth/callback/route');
    const res = await GET(await callbackReq('https://evil.test'));
    const location = res.headers.get('location') ?? '';
    expect(location).not.toContain('evil.test');
    expect(location).toContain('/settings?tab=public');
  });

  it('keeps a declined consent on the page the MC started from', async () => {
    const { OAUTH_RETURN_COOKIE } = await import('@/app/api/oauth/authorize/route');
    const { GET } = await import('@/app/api/oauth/callback/route');
    const req = new NextRequest('http://localhost/api/oauth/callback?error=access_denied');
    req.cookies.set(OAUTH_RETURN_COOKIE, 'calendar');

    const res = await GET(req);
    // Why: the decline branch runs before the state is parsed, so it has no
    // purpose to switch on and must rely on the return cookie alone.
    expect(res.headers.get('location')).toContain('/calendar?calendar=error');
  });
});
