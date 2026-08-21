import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/oauth/tokens', () => ({
  refreshAccessToken: vi.fn(),
}));
vi.mock('@/lib/crypto/secret-box', () => ({
  encryptSecret: vi.fn((v: string) => `enc(${v})`),
  decryptSecret: vi.fn((v: string) => v.replace(/^enc\((.*)\)$/, '$1')),
}));

import {
  getFreshAccessToken,
  saveCalendarConnection,
  type CalendarConnection,
} from '@/lib/calendar/connections';
import { refreshAccessToken } from '@/lib/oauth/tokens';

/** Minimal supabase stub recording upsert/update calls. */
function fakeSupabase() {
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const chain = (table: string) => ({
    upsert: (...args: unknown[]) => {
      calls.push({ table, method: 'upsert', args });
      return Promise.resolve({ error: null });
    },
    update: (...args: unknown[]) => {
      calls.push({ table, method: 'update', args });
      return { eq: () => Promise.resolve({ error: null }) };
    },
  });
  return { client: { from: chain } as never, calls };
}

function connection(overrides: Partial<CalendarConnection> = {}): CalendarConnection {
  return {
    id: 'conn-1',
    user_id: 'user-1',
    provider: 'google',
    account_email: 'mc@example.com',
    access_token_encrypted: 'enc(old-access)',
    refresh_token_encrypted: 'enc(refresh-1)',
    token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    status: 'connected',
    last_error: null,
    calendar_id: null,
    connected_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('saveCalendarConnection', () => {
  it('upserts encrypted tokens keyed on user_id,provider', async () => {
    const { client, calls } = fakeSupabase();
    await saveCalendarConnection(
      client,
      'user-1',
      'google',
      { accessToken: 'at', refreshToken: 'rt', expiresIn: 3600 },
      'mc@example.com',
    );
    expect(calls).toHaveLength(1);
    const [row, options] = calls[0]!.args as [Record<string, unknown>, Record<string, unknown>];
    expect(row.access_token_encrypted).toBe('enc(at)');
    expect(row.refresh_token_encrypted).toBe('enc(rt)');
    expect(row.status).toBe('connected');
    expect(options.onConflict).toBe('user_id,provider');
  });
});

describe('getFreshAccessToken', () => {
  beforeEach(() => {
    vi.mocked(refreshAccessToken).mockReset();
  });

  it('returns the stored token while it is fresh', async () => {
    const { client } = fakeSupabase();
    const token = await getFreshAccessToken(client, connection());
    expect(token).toBe('old-access');
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('refreshes and persists when the token is near expiry', async () => {
    vi.mocked(refreshAccessToken).mockResolvedValue({
      accessToken: 'new-access',
      expiresIn: 3600,
    });
    const { client, calls } = fakeSupabase();
    const nearExpiry = connection({
      token_expires_at: new Date(Date.now() + 10_000).toISOString(),
    });
    const token = await getFreshAccessToken(client, nearExpiry);
    expect(token).toBe('new-access');
    expect(refreshAccessToken).toHaveBeenCalledWith('google', 'refresh-1');
    expect(calls.some((c) => c.method === 'update')).toBe(true);
  });

  it('marks the connection errored and rethrows on refresh failure', async () => {
    const mockError = new Error('revoked');
    vi.mocked(refreshAccessToken).mockRejectedValueOnce(mockError);
    const { client, calls } = fakeSupabase();
    const nearExpiry = connection({
      token_expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    try {
      await getFreshAccessToken(client, nearExpiry);
      throw new Error('Expected getFreshAccessToken to throw');
    } catch (err) {
      expect(err).toBe(mockError);
    }
    const update = calls.find((c) => c.method === 'update');
    expect(update).toBeDefined();
    expect((update!.args[0] as Record<string, unknown>).status).toBe('error');
  });
});
