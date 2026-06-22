/**
 * Unit tests for the OAuth token operations (`lib/oauth/tokens`):
 * code exchange, access-token refresh, and connected-address lookup.
 * `fetch` is mocked; no live provider calls.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
 
global.fetch = fetchMock as any;

process.env.GOOGLE_OAUTH_CLIENT_ID = 'gid';
process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'gsec';
process.env.NEXT_PUBLIC_APP_URL = 'https://app.test';

import { exchangeCode, fetchUserEmail, refreshAccessToken } from '@/lib/oauth/tokens';

beforeEach(() => fetchMock.mockReset());

describe('exchangeCode', () => {
  it('posts the auth code and returns the token set', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'a', refresh_token: 'r', expires_in: 3600 }),
    });
    const tokens = await exchangeCode('google', 'the-code');
    expect(tokens).toEqual({ accessToken: 'a', refreshToken: 'r', expiresIn: 3600 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(init.body.toString()).toContain('grant_type=authorization_code');
    expect(init.body.toString()).toContain('the-code');
  });

  it('throws the provider error description', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_grant', error_description: 'bad code' }),
    });
    await expect(exchangeCode('google', 'x')).rejects.toThrow('bad code');
  });
});

describe('refreshAccessToken', () => {
  it('mints a fresh access token from the refresh token', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ access_token: 'a2', expires_in: 3600 }) });
    const tokens = await refreshAccessToken('google', 'r');
    expect(tokens.accessToken).toBe('a2');
    expect(fetchMock.mock.calls[0]![1].body.toString()).toContain('grant_type=refresh_token');
  });
});

describe('fetchUserEmail', () => {
  it('reads the address from Google userinfo', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ email: 'me@gmail.com' }) });
    expect(await fetchUserEmail('google', 'tok')).toBe('me@gmail.com');
    expect(fetchMock.mock.calls[0]![0]).toBe('https://openidconnect.googleapis.com/v1/userinfo');
  });

  it('reads the address from Microsoft Graph (mail / UPN)', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ userPrincipalName: 'me@outlook.com' }) });
    expect(await fetchUserEmail('microsoft', 'tok')).toBe('me@outlook.com');
    expect(fetchMock.mock.calls[0]![0]).toBe('https://graph.microsoft.com/v1.0/me');
  });
});
